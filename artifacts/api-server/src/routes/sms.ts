import { Router } from "express";
import { pool } from "@workspace/db";
import { sendSMS, sendBulkSMS, SMSConfig } from "../services/sms.service";

const router = Router();

/* ─── DB Migration ─── */
export async function runSMSMigration(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sms_logs (
      id               SERIAL PRIMARY KEY,
      school_id        INTEGER REFERENCES schools(id) ON DELETE CASCADE,
      telefone         TEXT NOT NULL,
      mensagem         TEXT NOT NULL,
      status           TEXT NOT NULL DEFAULT 'sent',
      evento           TEXT,
      idempotency_key  TEXT UNIQUE,
      provider_ref     TEXT,
      data_envio       TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  console.log("[sms] migration ok");
}

/* ─── Auth helpers ─── */
async function getSchoolFromToken(token: string) {
  const res = await pool.query(
    `SELECT sc.id AS school_id, sc.name AS school_name
     FROM sessions s
     JOIN schools sc ON sc.id = s.school_id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token]
  );
  return res.rows[0] ?? null;
}
function schoolAuth(req: any, res: any, next: any) {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return res.status(401).json({ error: "Não autenticado." });
  req.schoolToken = h.slice(7);
  next();
}

async function adminAuth(req: any, res: any, next: any) {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return res.status(401).json({ error: "Não autenticado." });
  const token = h.slice(7);
  const r = await pool.query(
    "SELECT id FROM admin_sessions WHERE token=$1 AND expires_at > NOW()",
    [token]
  );
  if (!r.rows.length) return res.status(401).json({ error: "Sessão admin inválida." });
  next();
}

/* ─── SMS Config helpers ─── */
async function getSchoolSMSConfig(schoolId: number): Promise<SMSConfig> {
  const r = await pool.query(
    "SELECT settings FROM school_settings WHERE school_id=$1",
    [schoolId]
  );
  const comm = r.rows[0]?.settings?.comunicacao ?? {};
  return {
    provider: comm.sms_provider || "mock",
    api_url: comm.sms_api_url,
    api_key: comm.sms_api_key,
    sender_name: comm.sms_sender_name || "KiwaraEsc",
  };
}

/* ════════════════════════════════════
   SCHOOL ENDPOINTS
════════════════════════════════════ */

/* GET /school/sms/logs — list SMS logs for this school */
router.get("/school/sms/logs", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const page  = Math.max(1, parseInt(req.query.page ?? "1"));
  const limit = Math.min(100, parseInt(req.query.limit ?? "50"));
  const offset = (page - 1) * limit;
  const evento = req.query.evento as string | undefined;
  const status = req.query.status as string | undefined;

  const conditions: string[] = ["school_id=$1"];
  const params: any[] = [school.school_id];
  if (evento) { params.push(evento); conditions.push(`evento=$${params.length}`); }
  if (status) { params.push(status); conditions.push(`status=$${params.length}`); }

  const where = conditions.join(" AND ");
  const countR = await pool.query(`SELECT COUNT(*) FROM sms_logs WHERE ${where}`, params);
  const total = parseInt(countR.rows[0].count);

  const logsR = await pool.query(
    `SELECT * FROM sms_logs WHERE ${where} ORDER BY data_envio DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  res.json({ logs: logsR.rows, total, page, limit });
});

/* POST /school/sms/send — manual send from school */
router.post("/school/sms/send", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const { mensagem, recipients } = req.body;
  if (!mensagem || !Array.isArray(recipients) || !recipients.length) {
    return res.status(400).json({ error: "mensagem e recipients são obrigatórios." });
  }

  const config = await getSchoolSMSConfig(school.school_id);
  const result = await sendBulkSMS(recipients, mensagem, config, school.school_id);
  res.json(result);
});

/* POST /school/sms/send-single — send single SMS from school */
router.post("/school/sms/send-single", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const { telefone, mensagem } = req.body;
  if (!telefone || !mensagem) {
    return res.status(400).json({ error: "telefone e mensagem são obrigatórios." });
  }

  const config = await getSchoolSMSConfig(school.school_id);
  const result = await sendSMS(telefone, mensagem, config, school.school_id, "manual");
  res.json(result);
});

/* GET /school/sms/stats — quick stats */
router.get("/school/sms/stats", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const r = await pool.query(
    `SELECT status, COUNT(*) AS total FROM sms_logs WHERE school_id=$1 GROUP BY status`,
    [school.school_id]
  );
  const totals = await pool.query(
    "SELECT COUNT(*) AS total FROM sms_logs WHERE school_id=$1",
    [school.school_id]
  );
  const byEvent = await pool.query(
    `SELECT evento, COUNT(*) AS total FROM sms_logs WHERE school_id=$1 GROUP BY evento ORDER BY total DESC`,
    [school.school_id]
  );

  const stats: Record<string, number> = {};
  r.rows.forEach((row: any) => { stats[row.status] = parseInt(row.total); });

  res.json({
    total: parseInt(totals.rows[0].total),
    sent: stats.sent ?? 0,
    failed: stats.failed ?? 0,
    by_event: byEvent.rows,
  });
});

/* GET /school/sms/alunos — list students with guardian phones for send modal */
router.get("/school/sms/alunos", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const r = await pool.query(
    `SELECT s.id, s.nome, s.telefone_encarregado, s.nome_encarregado, t.nome AS turma
     FROM students s
     LEFT JOIN turmas t ON t.id = s.turma_id
     WHERE s.school_id=$1 AND s.estado='activo'
     ORDER BY s.nome`,
    [school.school_id]
  );
  res.json(r.rows);
});

/* GET /school/sms/encarregados — list registered guardians in this school */
router.get("/school/sms/encarregados", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  /* Encarregados registados (com conta no portal) ligados a alunos deste colégio */
  const registados = await pool.query(
    `SELECT DISTINCT ON (e.id)
            e.id, e.nome, e.telefone, e.email,
            array_agg(DISTINCT s.nome) FILTER (WHERE s.nome IS NOT NULL) AS alunos
     FROM encarregados e
     JOIN encarregado_aluno ea ON ea.encarregado_id = e.id
     JOIN students s ON s.id = ea.aluno_id
     WHERE s.school_id = $1 AND s.estado = 'activo'
     GROUP BY e.id, e.nome, e.telefone, e.email
     ORDER BY e.id, e.nome`,
    [school.school_id]
  );

  /* Encarregados não-registados (apenas telefone no estudante) */
  const naoRegistados = await pool.query(
    `SELECT DISTINCT ON (s.telefone_encarregado)
            NULL::integer AS id,
            s.nome_encarregado AS nome,
            s.telefone_encarregado AS telefone,
            NULL AS email,
            array_agg(DISTINCT s.nome) AS alunos
     FROM students s
     WHERE s.school_id = $1
       AND s.estado = 'activo'
       AND s.telefone_encarregado IS NOT NULL
       AND s.telefone_encarregado != ''
       AND s.telefone_encarregado NOT IN (
           SELECT e.telefone FROM encarregados e
           JOIN encarregado_aluno ea ON ea.encarregado_id = e.id
           JOIN students st ON st.id = ea.aluno_id
           WHERE st.school_id = $1
       )
     GROUP BY s.telefone_encarregado, s.nome_encarregado
     ORDER BY s.telefone_encarregado, s.nome_encarregado`,
    [school.school_id]
  );

  res.json({
    registados: registados.rows,
    nao_registados: naoRegistados.rows,
    total: registados.rows.length + naoRegistados.rows.length,
  });
});

/* ════════════════════════════════════
   ADMIN ENDPOINTS
════════════════════════════════════ */

/* GET /admin/sms/logs — all SMS logs (global) */
router.get("/admin/sms/logs", adminAuth, async (req: any, res) => {
  const page   = Math.max(1, parseInt(req.query.page ?? "1"));
  const limit  = Math.min(100, parseInt(req.query.limit ?? "50"));
  const offset = (page - 1) * limit;
  const schoolId = req.query.school_id ? parseInt(req.query.school_id) : null;
  const status   = req.query.status as string | undefined;
  const evento   = req.query.evento as string | undefined;

  const conditions: string[] = [];
  const params: any[] = [];
  if (schoolId) { params.push(schoolId); conditions.push(`sl.school_id=$${params.length}`); }
  if (status)   { params.push(status);   conditions.push(`sl.status=$${params.length}`); }
  if (evento)   { params.push(evento);   conditions.push(`sl.evento=$${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const countR = await pool.query(`SELECT COUNT(*) FROM sms_logs sl ${where}`, params);
  const total  = parseInt(countR.rows[0].count);

  const logsR = await pool.query(
    `SELECT sl.*, sc.name AS school_name
     FROM sms_logs sl
     LEFT JOIN schools sc ON sc.id = sl.school_id
     ${where}
     ORDER BY sl.data_envio DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  res.json({ logs: logsR.rows, total, page, limit });
});

/* GET /admin/sms/stats — global SMS stats */
router.get("/admin/sms/stats", adminAuth, async (_req, res) => {
  const byStatus = await pool.query(
    "SELECT status, COUNT(*) AS total FROM sms_logs GROUP BY status"
  );
  const total = await pool.query("SELECT COUNT(*) AS total FROM sms_logs");
  const byEvent = await pool.query(
    "SELECT evento, COUNT(*) AS total FROM sms_logs GROUP BY evento ORDER BY total DESC"
  );
  const topSchools = await pool.query(
    `SELECT sc.name, COUNT(sl.id) AS total
     FROM sms_logs sl
     JOIN schools sc ON sc.id = sl.school_id
     GROUP BY sc.name ORDER BY total DESC LIMIT 10`
  );

  const stats: Record<string, number> = {};
  byStatus.rows.forEach((r: any) => { stats[r.status] = parseInt(r.total); });

  res.json({
    total: parseInt(total.rows[0].total),
    sent: stats.sent ?? 0,
    failed: stats.failed ?? 0,
    by_event: byEvent.rows,
    top_schools: topSchools.rows,
  });
});

/* GET /admin/sms/provider — global provider config */
router.get("/admin/sms/provider", adminAuth, async (_req, res) => {
  const r = await pool.query(
    "SELECT value FROM platform_settings WHERE key='sms_provider' LIMIT 1"
  ).catch(() => ({ rows: [] }));
  res.json(r.rows[0]?.value ?? {
    provider: "mock",
    api_url: "",
    api_key: "",
    sender_name: "KiwaraEsc",
  });
});

/* PUT /admin/sms/provider — update global provider config */
router.put("/admin/sms/provider", adminAuth, async (req: any, res) => {
  const { provider, api_url, api_key, sender_name } = req.body;
  await pool.query(`
    INSERT INTO platform_settings (key, value) VALUES ('sms_provider', $1::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = $1::jsonb
  `, [JSON.stringify({ provider, api_url, api_key, sender_name })]).catch(async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS platform_settings (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL
      )
    `);
    await pool.query(`
      INSERT INTO platform_settings (key, value) VALUES ('sms_provider', $1::jsonb)
      ON CONFLICT (key) DO UPDATE SET value = $1::jsonb
    `, [JSON.stringify({ provider, api_url, api_key, sender_name })]);
  });
  res.json({ ok: true });
});

/* POST /admin/sms/send — admin bulk send to multiple schools */
router.post("/admin/sms/send", adminAuth, async (req: any, res) => {
  const { mensagem, school_ids, todos } = req.body;
  if (!mensagem) return res.status(400).json({ error: "mensagem é obrigatória." });

  let schoolList: { id: number; name: string }[] = [];
  if (todos) {
    const r = await pool.query("SELECT id, name FROM schools ORDER BY name");
    schoolList = r.rows;
  } else if (Array.isArray(school_ids) && school_ids.length) {
    const r = await pool.query("SELECT id, name FROM schools WHERE id=ANY($1)", [school_ids]);
    schoolList = r.rows;
  }

  if (!schoolList.length) return res.status(400).json({ error: "Nenhum colégio seleccionado." });

  let totalSent = 0, totalFailed = 0;

  for (const sc of schoolList) {
    const studentsR = await pool.query(
      `SELECT DISTINCT ON (s.telefone_encarregado) s.telefone_encarregado AS phone, s.nome_encarregado AS name
       FROM students s
       WHERE s.school_id=$1 AND s.estado='activo' AND s.telefone_encarregado IS NOT NULL AND s.telefone_encarregado != ''`,
      [sc.id]
    );
    const encarregadosR = await pool.query(
      `SELECT DISTINCT ON (e.telefone) e.telefone AS phone, e.nome AS name
       FROM encarregados e
       JOIN encarregado_aluno ea ON ea.encarregado_id = e.id
       JOIN students st ON st.id = ea.aluno_id
       WHERE st.school_id=$1`,
      [sc.id]
    );

    const recipients = [...studentsR.rows, ...encarregadosR.rows].filter(r => r.phone);

    if (!recipients.length) continue;

    const config = await getSchoolSMSConfig(sc.id);
    const result = await sendBulkSMS(recipients, mensagem, config, sc.id);
    totalSent   += result.sent;
    totalFailed += result.failed;
  }

  res.json({ sent: totalSent, failed: totalFailed, total: totalSent + totalFailed });
});

export default router;
