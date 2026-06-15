import { Router, type Request, type Response, type NextFunction } from "express";
import { toError } from "../lib/errors";
import { pool } from "@workspace/db";
import { sendSMS, sendBulkSMS, SMSConfig, DEFAULT_TEMPLATES } from "../services/sms.service";
import { createTransport } from "nodemailer";

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
function schoolAuth(req: Request, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return res.status(401).json({ error: "Não autenticado." });
  req.schoolToken = h.slice(7);
  next();
}

async function adminAuth(req: Request, res: Response, next: NextFunction) {
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
    sender_name: comm.sms_sender_name || "PropinaPlus",
  };
}

/* ════════════════════════════════════
   SCHOOL ENDPOINTS
════════════════════════════════════ */

/* GET /school/comunicar/templates — merged global + school templates (school auth) */
router.get("/school/comunicar/templates", schoolAuth, async (req: Request, res: Response) => {
  const school = await getSchoolFromToken(req.schoolToken!);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const globalR = await pool.query(
    "SELECT value FROM platform_settings WHERE key='sms_templates' LIMIT 1"
  ).catch(() => ({ rows: [] as any[] }));
  const globalTemplates: Record<string, string> = globalR.rows[0]?.value ?? {};

  const schoolR = await pool.query(
    "SELECT settings FROM school_settings WHERE school_id=$1",
    [school.id]
  ).catch(() => ({ rows: [] as any[] }));
  const schoolTemplates: Record<string, string> =
    schoolR.rows[0]?.settings?.comunicacao?.sms_templates ?? {};

  const merged = { ...DEFAULT_TEMPLATES, ...globalTemplates, ...schoolTemplates };
  return res.json(merged);
});

/* GET /school/sms/logs — list SMS logs for this school */
router.get("/school/sms/logs", schoolAuth, async (req: Request, res: Response) => {
  const school = await getSchoolFromToken(req.schoolToken!);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const page  = Math.max(1, parseInt(String(req.query.page ?? "1")));
  const limit = Math.min(100, parseInt(String(req.query.limit ?? "50")));
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
router.post("/school/sms/send", schoolAuth, async (req: Request, res: Response) => {
  const school = await getSchoolFromToken(req.schoolToken!);
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
router.post("/school/sms/send-single", schoolAuth, async (req: Request, res: Response) => {
  const school = await getSchoolFromToken(req.schoolToken!);
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
router.get("/school/sms/stats", schoolAuth, async (req: Request, res: Response) => {
  const school = await getSchoolFromToken(req.schoolToken!);
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
router.get("/school/sms/alunos", schoolAuth, async (req: Request, res: Response) => {
  const school = await getSchoolFromToken(req.schoolToken!);
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
router.get("/school/sms/encarregados", schoolAuth, async (req: Request, res: Response) => {
  const school = await getSchoolFromToken(req.schoolToken!);
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

/* GET /school/comunicar/audiencia — guardians filtered by audience mode */
router.get("/school/comunicar/audiencia", schoolAuth, async (req: Request, res: Response) => {
  const school = await getSchoolFromToken(req.schoolToken!);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const modo = (req.query.modo as string) ?? "todos";
  const turmaId = req.query.turma_id ? parseInt(req.query.turma_id as string) : null;

  const params: any[] = [school.school_id];
  let extraWhere = "";
  if (modo === "turma" && turmaId) {
    extraWhere = ` AND s.turma_id = $2`;
    params.push(turmaId);
  } else if (modo === "devedores") {
    extraWhere = ` AND EXISTS (SELECT 1 FROM propinas p WHERE p.student_id = s.id AND p.status != 'pago')`;
  }

  const registados = await pool.query(
    `SELECT e.id, e.nome, e.telefone, e.email,
            array_agg(DISTINCT s.nome) FILTER (WHERE s.nome IS NOT NULL) AS alunos,
            array_agg(DISTINCT t.nome) FILTER (WHERE t.nome IS NOT NULL) AS turmas
     FROM encarregados e
     JOIN encarregado_aluno ea ON ea.encarregado_id = e.id
     JOIN students s ON s.id = ea.aluno_id
     LEFT JOIN turmas t ON t.id = s.turma_id
     WHERE s.school_id = $1 AND s.estado = 'activo'${extraWhere}
     GROUP BY e.id, e.nome, e.telefone, e.email ORDER BY e.nome`,
    params
  );

  const naoRegistados = await pool.query(
    `SELECT DISTINCT ON (s.telefone_encarregado)
            NULL::integer AS id, s.nome_encarregado AS nome,
            s.telefone_encarregado AS telefone,
            array_agg(DISTINCT s.nome) AS alunos,
            array_agg(DISTINCT t.nome) FILTER (WHERE t.nome IS NOT NULL) AS turmas
     FROM students s LEFT JOIN turmas t ON t.id = s.turma_id
     WHERE s.school_id = $1 AND s.estado = 'activo'
       AND s.telefone_encarregado IS NOT NULL AND s.telefone_encarregado != ''
       AND s.telefone_encarregado NOT IN (
           SELECT e.telefone FROM encarregados e
           JOIN encarregado_aluno ea ON ea.encarregado_id = e.id
           JOIN students st ON st.id = ea.aluno_id
           WHERE st.school_id = $1
       )${extraWhere}
     GROUP BY s.telefone_encarregado, s.nome_encarregado
     ORDER BY s.telefone_encarregado`,
    params
  );

  return res.json({
    registados: registados.rows,
    nao_registados: naoRegistados.rows,
    total: registados.rows.length + naoRegistados.rows.length,
  });
});

/* GET /school/comunicar/canais-config — which channels are configured */
router.get("/school/comunicar/canais-config", schoolAuth, async (req: Request, res: Response) => {
  const school = await getSchoolFromToken(req.schoolToken!);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const r = await pool.query("SELECT settings FROM school_settings WHERE school_id=$1", [school.school_id]);
  const comm = r.rows[0]?.settings?.comunicacao ?? {};
  return res.json({
    sms_ativo: !!(comm.sms_activo && comm.sms_provider && comm.sms_provider !== "mock"),
    sms_provider: comm.sms_provider || "mock",
    email_ativo: !!(comm.email_activo && comm.smtp_host),
    smtp_configurado: !!comm.smtp_host,
  });
});

/* POST /school/comunicar/sms — dedicated SMS blast (Compor tab) */
router.post("/school/comunicar/sms", schoolAuth, async (req: Request, res: Response) => {
  const school = await getSchoolFromToken(req.schoolToken!);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const { mensagem, phones } = req.body;
  if (!mensagem?.trim() || !Array.isArray(phones) || phones.length === 0) {
    return res.status(400).json({ error: "mensagem e phones são obrigatórios." });
  }
  const config = await getSchoolSMSConfig(school.school_id);
  const recipients = (phones as string[]).map(p => ({ phone: p, name: "" }));
  const result = await sendBulkSMS(recipients, mensagem.trim(), config, school.school_id);
  return res.json({ ok: true, sent: result.sent, failed: result.failed });
});

/* POST /school/comunicar/email — email blast (Compor tab) */
router.post("/school/comunicar/email", schoolAuth, async (req: Request, res: Response) => {
  const school = await getSchoolFromToken(req.schoolToken!);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const { assunto, corpo, emails } = req.body;
  if (!assunto?.trim() || !corpo?.trim() || !Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({ error: "assunto, corpo e emails são obrigatórios." });
  }
  const r = await pool.query("SELECT settings FROM school_settings WHERE school_id=$1", [school.school_id]);
  const comm = r.rows[0]?.settings?.comunicacao ?? {};
  if (!comm.smtp_host || !comm.smtp_user || !comm.smtp_pass) {
    return res.status(400).json({ error: "Configuração SMTP não encontrada. Configure nas definições da escola." });
  }
  const transporter = createTransport({
    host: comm.smtp_host,
    port: parseInt(comm.smtp_port ?? "587"),
    secure: String(comm.smtp_port) === "465",
    auth: { user: comm.smtp_user, pass: comm.smtp_pass },
  });
  let sent = 0, failed = 0;
  const errors: string[] = [];
  for (const email of emails as string[]) {
    if (!email?.includes("@")) { failed++; continue; }
    try {
      await transporter.sendMail({
        from: comm.smtp_from || `"${school.school_name}" <${comm.smtp_user}>`,
        to: email,
        subject: assunto.trim(),
        html: `<div style="font-family:sans-serif;font-size:14px;line-height:1.6">${corpo.trim().replace(/\n/g, "<br>")}</div>`,
        text: corpo.trim(),
      });
      sent++;
    } catch (e: any) { failed++; errors.push(e.message); }
  }
  return res.json({ ok: true, sent, failed, errors: errors.slice(0, 5) });
});

/* ════════════════════════════════════
   ADMIN ENDPOINTS
════════════════════════════════════ */

/* GET /admin/sms/logs — all SMS logs (global) */
router.get("/admin/sms/logs", adminAuth, async (req: Request, res: Response) => {
  const page   = Math.max(1, parseInt(String(req.query.page ?? "1")));
  const limit  = Math.min(100, parseInt(String(req.query.limit ?? "50")));
  const offset = (page - 1) * limit;
  const schoolId = req.query.school_id ? parseInt(String(req.query.school_id)) : null;
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
    sender_name: "PropinaPlus",
  });
});

/* PUT /admin/sms/provider — update global provider config */
router.put("/admin/sms/provider", adminAuth, async (req: Request, res: Response) => {
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

/* GET /admin/sms/templates — get global platform SMS templates */
router.get("/admin/sms/templates", adminAuth, async (_req, res) => {
  const r = await pool.query(
    "SELECT value FROM platform_settings WHERE key='sms_templates' LIMIT 1"
  ).catch(() => ({ rows: [] }));
  res.json(r.rows[0]?.value ?? DEFAULT_TEMPLATES);
});

/* PUT /admin/sms/templates — save global platform SMS templates */
router.put("/admin/sms/templates", adminAuth, async (req: Request, res: Response) => {
  const templates = req.body;
  if (!templates || typeof templates !== "object") {
    return res.status(400).json({ error: "Corpo inválido. Envie um objecto JSON com os templates." });
  }

  await pool.query(`
    INSERT INTO platform_settings (key, value) VALUES ('sms_templates', $1::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = $1::jsonb
  `, [JSON.stringify(templates)]).catch(async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS platform_settings (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL
      )
    `);
    await pool.query(`
      INSERT INTO platform_settings (key, value) VALUES ('sms_templates', $1::jsonb)
      ON CONFLICT (key) DO UPDATE SET value = $1::jsonb
    `, [JSON.stringify(templates)]);
  });

  res.json({ ok: true });
});

/* GET /admin/sms/template-defaults — return hardcoded default templates for reference */
router.get("/admin/sms/template-defaults", adminAuth, async (_req, res) => {
  res.json(DEFAULT_TEMPLATES);
});

/* POST /admin/sms/send — admin bulk send to multiple schools */
router.post("/admin/sms/send", adminAuth, async (req: Request, res: Response) => {
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
