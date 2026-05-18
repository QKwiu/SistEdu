import { Router } from "express";
import { pool } from "@workspace/db";
import { randomBytes } from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs";
import type { ServerResponse } from "http";

/* ─── SSE client registry ─── */
const sseClients = new Map<number, Set<ServerResponse>>();

function addSseClient(schoolId: number, res: ServerResponse) {
  if (!sseClients.has(schoolId)) sseClients.set(schoolId, new Set());
  sseClients.get(schoolId)!.add(res);
}
function removeSseClient(schoolId: number, res: ServerResponse) {
  sseClients.get(schoolId)?.delete(res);
}
function broadcastToSchool(schoolId: number, data: object) {
  const clients = sseClients.get(schoolId);
  if (!clients?.size) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const r of clients) { try { r.write(payload); } catch {} }
}

/* ─── Demo mode ─── */
const demoIntervals = new Map<number, ReturnType<typeof setInterval>>();
const DEMO_CHANNELS = ["GPO_EMIS","DIRECT_DEBIT","BANK_TRANSFER","POS_TPA","CASH"] as const;
const DEMO_NAMES = ["Ana Santos","Carlos Mbemba","Maria João","Pedro Ferreira","Lurdes Capita","Tomás Neto","Rosa Domingos"];

function startDemoMode(schoolId: number) {
  if (demoIntervals.has(schoolId)) return;
  const iv = setInterval(() => {
    const canal = DEMO_CHANNELS[Math.floor(Math.random() * DEMO_CHANNELS.length)];
    const nome  = DEMO_NAMES[Math.floor(Math.random() * DEMO_NAMES.length)];
    const valor = Math.floor(Math.random() * 95_000 + 12_000);
    broadcastToSchool(schoolId, {
      type: "payment", canal, aluno_nome: nome, valor,
      status: "pago", pago_em: new Date().toISOString(), is_demo: true,
    });
  }, 3500);
  demoIntervals.set(schoolId, iv);
}
function stopDemoMode(schoolId: number) {
  const iv = demoIntervals.get(schoolId);
  if (iv) { clearInterval(iv); demoIntervals.delete(schoolId); }
}

const router = Router();

/* ─── Multer setup for comprovante uploads ─── */
const uploadsDir = path.join(process.cwd(), "uploads", "comprovantes");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const comprovanteStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `comp-${Date.now()}-${randomBytes(4).toString("hex")}${ext}`;
    cb(null, unique);
  },
});
const comprovanteUpload = multer({
  storage: comprovanteStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
});

/* ─── DB migration (run once at startup) ─── */
export async function runReconciliationMigration() {
  await pool.query(`
    ALTER TABLE propinas
      ADD COLUMN IF NOT EXISTS internal_reference TEXT,
      ADD COLUMN IF NOT EXISTS partially_paid_amount NUMERIC(12,2) DEFAULT 0;
  `);
  await pool.query(`
    ALTER TABLE schools
      ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) DEFAULT 0;
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payment_splits (
      id            SERIAL PRIMARY KEY,
      propina_id    INTEGER NOT NULL REFERENCES propinas(id) ON DELETE CASCADE,
      payment_ref   TEXT,
      destino       TEXT    NOT NULL CHECK (destino IN ('school','platform')),
      valor         NUMERIC(12,2) NOT NULL,
      tipo          TEXT    NOT NULL DEFAULT 'propina',
      created_at    TIMESTAMP DEFAULT NOW()
    )
  `);
  /* Manual payment audit columns */
  await pool.query(`
    ALTER TABLE propinas
      ADD COLUMN IF NOT EXISTS baixa_manual        BOOLEAN   DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS baixa_manual_por    TEXT,
      ADD COLUMN IF NOT EXISTS baixa_manual_em     TIMESTAMP,
      ADD COLUMN IF NOT EXISTS baixa_manual_obs    TEXT,
      ADD COLUMN IF NOT EXISTS comprovante_url     TEXT,
      ADD COLUMN IF NOT EXISTS data_recebimento    DATE;
  `);
  /* Manual payment & webhook conflict audit log */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS manual_payment_logs (
      id            SERIAL PRIMARY KEY,
      propina_id    INTEGER REFERENCES propinas(id) ON DELETE SET NULL,
      tipo          TEXT NOT NULL CHECK (tipo IN ('baixa_manual','webhook_ignorado','webhook_processado')),
      admin_user    TEXT,
      valor         NUMERIC(12,2),
      metodo        TEXT,
      data_recebimento DATE,
      observacoes   TEXT,
      comprovante_url TEXT,
      payment_ref   TEXT,
      metadata      JSONB DEFAULT '{}',
      created_at    TIMESTAMP DEFAULT NOW()
    )
  `);
  /* Online payment tracking columns */
  await pool.query(`
    ALTER TABLE propinas
      ADD COLUMN IF NOT EXISTS transaction_id    TEXT,
      ADD COLUMN IF NOT EXISTS metodo_pagamento  TEXT,
      ADD COLUMN IF NOT EXISTS pagamento_origem  TEXT DEFAULT 'manual';
  `);
  /* Unique index on transaction_id to enforce idempotency at DB level */
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS propinas_transaction_id_unique
    ON propinas (transaction_id)
    WHERE transaction_id IS NOT NULL;
  `);
  /* ── Fecho de Caixa: payment_channel enum column ── */
  await pool.query(`
    ALTER TABLE propinas
      ADD COLUMN IF NOT EXISTS payment_channel TEXT
        CHECK (payment_channel IN ('GPO_EMIS','DIRECT_DEBIT','BANK_TRANSFER','POS_TPA','CASH'));
  `);
  /* Backfill payment_channel from metodo_pagamento for existing rows */
  await pool.query(`
    UPDATE propinas SET payment_channel =
      CASE
        WHEN metodo_pagamento ILIKE '%emis%' OR metodo_pagamento ILIKE '%gpo%'
          OR metodo_pagamento ILIKE '%multicaixa%' OR metodo_pagamento ILIKE '%express%' THEN 'GPO_EMIS'
        WHEN metodo_pagamento ILIKE '%debito%' OR metodo_pagamento ILIKE '%direct%' THEN 'DIRECT_DEBIT'
        WHEN metodo_pagamento ILIKE '%transfer%' OR metodo_pagamento ILIKE '%iban%' OR metodo_pagamento ILIKE '%bancari%' THEN 'BANK_TRANSFER'
        WHEN metodo_pagamento ILIKE '%tpa%' OR metodo_pagamento ILIKE '%terminal%' THEN 'POS_TPA'
        ELSE 'CASH'
      END
    WHERE payment_channel IS NULL;
  `);
  /* Backfill pago_em for paid records missing a payment date */
  await pool.query(`
    UPDATE propinas
    SET pago_em = COALESCE(created_at, NOW())
    WHERE status = 'pago' AND pago_em IS NULL;
  `);
  /* Composite performance index */
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_propinas_fecho_caixa
    ON propinas (school_id, payment_channel, status, pago_em);
  `);
  /* demo_mode flag on schools */
  await pool.query(`
    ALTER TABLE schools ADD COLUMN IF NOT EXISTS demo_mode BOOLEAN DEFAULT FALSE;
  `);
  /* School settings table (motor de regras configurável por tenant) */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS school_settings (
      id         SERIAL PRIMARY KEY,
      school_id  INTEGER NOT NULL UNIQUE REFERENCES schools(id) ON DELETE CASCADE,
      settings   JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMP DEFAULT NOW(),
      updated_by TEXT
    )
  `);
  /* Backfill internal_reference for propinas that don't have one yet */
  await pool.query(`
    UPDATE propinas p
    SET internal_reference = (
      SELECT sc.school_id || '-' || p.student_id || '-' || p.ano || '-' ||
             LPAD(CASE p.mes
               WHEN 'Janeiro'   THEN '01' WHEN 'Fevereiro' THEN '02' WHEN 'Março'    THEN '03'
               WHEN 'Abril'     THEN '04' WHEN 'Maio'      THEN '05' WHEN 'Junho'    THEN '06'
               WHEN 'Julho'     THEN '07' WHEN 'Agosto'    THEN '08' WHEN 'Setembro' THEN '09'
               WHEN 'Outubro'   THEN '10' WHEN 'Novembro'  THEN '11' WHEN 'Dezembro' THEN '12'
               ELSE '00' END, 2, '0') || '-' ||
             LPAD(EXTRACT(DAY FROM p.created_at)::text, 2, '0') || '-' ||
             COALESCE((
               SELECT ea.encarregado_id::text
               FROM encarregado_aluno ea WHERE ea.aluno_id = p.student_id LIMIT 1
             ), '0') || '-' || p.id
      FROM schools sc WHERE sc.id = p.school_id
    )
    WHERE p.internal_reference IS NULL
  `);
}

/* ─── Helper: generate reference for a single propina ─── */
async function generateInternalReference(propinaId: number): Promise<string> {
  const r = await pool.query(`
    SELECT p.id, p.student_id, p.mes, p.ano, p.created_at,
           sc.school_id AS school_code,
           COALESCE((
             SELECT ea.encarregado_id::text
             FROM encarregado_aluno ea WHERE ea.aluno_id = p.student_id LIMIT 1
           ), '0') AS guardian_id
    FROM propinas p
    JOIN schools sc ON sc.id = p.school_id
    WHERE p.id = $1
  `, [propinaId]);
  if (!r.rows[0]) return `REF-${propinaId}`;
  const p = r.rows[0];
  const MESES: Record<string, string> = {
    "Janeiro":"01","Fevereiro":"02","Março":"03","Abril":"04","Maio":"05","Junho":"06",
    "Julho":"07","Agosto":"08","Setembro":"09","Outubro":"10","Novembro":"11","Dezembro":"12",
  };
  const mm = MESES[p.mes] ?? "00";
  const dd = String(new Date(p.created_at).getDate()).padStart(2, "0");
  return `${p.school_code}-${p.student_id}-${p.ano}-${mm}-${dd}-${p.guardian_id}-${p.id}`;
}

/* ─── Auth helpers (mirrors admin.ts and school.ts) ─── */
async function adminAuth(req: any, res: any, next: any) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Não autenticado." });
  const token = header.slice(7);
  const r = await pool.query(
    "SELECT id FROM admin_sessions WHERE token=$1 AND expires_at > NOW()", [token]
  );
  if (!r.rows.length) return res.status(401).json({ error: "Sessão inválida." });
  next();
}

async function getSchoolFromToken(token: string) {
  const res = await pool.query(
    `SELECT sc.id AS school_id, sc.name AS school_name, sc.school_id AS school_code,
            COALESCE(sc.commission_rate, 0) AS commission_rate,
            sc.email AS admin_email
     FROM sessions s JOIN schools sc ON sc.id = s.school_id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token]
  );
  return res.rows[0] ?? null;
}

function schoolAuth(req: any, res: any, next: any) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Não autenticado." });
  req.schoolToken = header.slice(7);
  next();
}

/* ─── GET /school/reconciliacao ─── */
router.get("/school/reconciliacao", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const { status, student_id, mes, ano } = req.query as any;
  const conditions: string[] = ["p.school_id = $1"];
  const params: any[] = [school.school_id];

  if (status)     { params.push(status);     conditions.push(`p.status = $${params.length}`); }
  if (student_id) { params.push(student_id); conditions.push(`p.student_id = $${params.length}`); }
  if (mes)        { params.push(mes);        conditions.push(`p.mes = $${params.length}`); }
  if (ano)        { params.push(ano);        conditions.push(`p.ano = $${params.length}`); }

  const r = await pool.query(`
    SELECT
      p.id, p.student_id, p.mes, p.ano, p.montante, p.multa, p.status,
      p.internal_reference, p.data_vencimento, p.pago_em, p.created_at,
      p.partially_paid_amount,
      p.baixa_manual, p.baixa_manual_por, p.baixa_manual_em, p.baixa_manual_obs,
      p.comprovante_url, p.data_recebimento,
      p.transaction_id, p.metodo_pagamento,
      COALESCE(p.pagamento_origem, 'manual') AS pagamento_origem,
      s.nome AS aluno_nome,
      COALESCE(t.nome, 'Sem turma') AS turma,
      pg.referencia AS ref_multicaixa, pg.entidade, pg.valor AS ref_valor,
      pg.estado AS ref_estado, pg.validade AS ref_validade,
      (p.montante + p.multa)                              AS total_fatura,
      COALESCE(
        (SELECT SUM(ps.valor) FROM payment_splits ps WHERE ps.propina_id = p.id AND ps.destino = 'school'), 0
      )                                                   AS split_escola,
      COALESCE(
        (SELECT SUM(ps.valor) FROM payment_splits ps WHERE ps.propina_id = p.id AND ps.destino = 'platform'), 0
      )                                                   AS split_plataforma
    FROM propinas p
    JOIN students s ON s.id = p.student_id
    LEFT JOIN turmas t  ON t.id = s.turma_id
    LEFT JOIN pagamentos pg ON pg.propina_id = p.id
    WHERE ${conditions.join(" AND ")}
    ORDER BY p.ano DESC, p.mes DESC, s.nome
  `, params);

  const stats = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'pendente')  AS pendentes,
      COUNT(*) FILTER (WHERE status = 'vencido')   AS vencidas,
      COUNT(*) FILTER (WHERE status = 'pago')      AS pagas,
      COALESCE(SUM(montante + multa) FILTER (WHERE status != 'pago'), 0) AS divida_total,
      COALESCE(SUM(montante + multa) FILTER (WHERE status = 'pago'),  0) AS receita_total,
      COALESCE(SUM(montante)        FILTER (WHERE status = 'pago'),   0) AS receita_escola,
      COALESCE(
        (SELECT SUM(ps.valor) FROM payment_splits ps
         JOIN propinas pp ON pp.id = ps.propina_id WHERE pp.school_id = $1 AND ps.destino = 'platform'), 0
      ) AS comissao_plataforma
    FROM propinas WHERE school_id = $1
  `, [school.school_id]);

  res.json({ propinas: r.rows, stats: stats.rows[0], commission_rate: school.commission_rate });
});

/* ─── POST /school/reconciliacao/baixa-manual — manual payment by school admin ─── */
router.post(
  "/school/reconciliacao/baixa-manual",
  schoolAuth,
  comprovanteUpload.single("comprovante"),
  async (req: any, res) => {
    const school = await getSchoolFromToken(req.schoolToken);
    if (!school) return res.status(401).json({ error: "Sessão inválida." });

    const { propina_id, valor_pago, metodo, data_recebimento, observacoes } = req.body;

    if (!propina_id) return res.status(400).json({ error: "ID da propina obrigatório." });
    if (!valor_pago || Number(valor_pago) <= 0) return res.status(400).json({ error: "Valor pago deve ser maior que zero." });
    if (!req.file) return res.status(400).json({ error: "Comprovante de pagamento obrigatório (PDF ou imagem)." });
    if (!data_recebimento) return res.status(400).json({ error: "Data de recebimento obrigatória." });

    const pRow = await pool.query(
      `SELECT p.*, sc.commission_rate, sc.id AS school_db_id
       FROM propinas p JOIN schools sc ON sc.id = p.school_id
       WHERE p.id = $1 AND p.school_id = $2`,
      [propina_id, school.school_id]
    );

    if (!pRow.rows.length) return res.status(404).json({ error: "Fatura não encontrada ou não pertence a este colégio." });

    const p = pRow.rows[0];

    if (p.status === "pago") {
      /* If already manually paid, block. If auto-paid (no baixa_manual flag), also block */
      const reason = p.baixa_manual ? "Fatura já registada com baixa manual." : "Fatura já marcada como paga pelo sistema.";
      return res.status(409).json({ error: reason });
    }

    const paid = Number(valor_pago);
    const total = Number(p.montante) + Number(p.multa);
    const newStatus = paid >= total ? "pago" : "pendente";
    const comprovanteUrl = `/api/uploads/comprovantes/${req.file.filename}`;

    /* Derive payment_channel from metodo */
    const payChannel = metodoToChannel(metodo ?? "Cash");

    /* Update propina with manual payment metadata */
    await pool.query(`
      UPDATE propinas
      SET status = $1,
          pago_em = NOW(),
          partially_paid_amount = CASE WHEN $1 = 'pago' THEN 0 ELSE $2 END,
          baixa_manual = TRUE,
          baixa_manual_por = $3,
          baixa_manual_em = NOW(),
          baixa_manual_obs = $4,
          comprovante_url = $5,
          data_recebimento = $6,
          payment_channel = $8
      WHERE id = $7
    `, [newStatus, paid < total ? paid : 0, school.admin_email, observacoes ?? null, comprovanteUrl, data_recebimento, p.id, payChannel]);

    /* Update pagamentos reference state */
    await pool.query("UPDATE pagamentos SET estado='PAGO' WHERE propina_id=$1", [p.id]);

    /* Calculate and save payment splits */
    const commissionRate = Number(p.commission_rate ?? 0);
    const comissaoPlataforma = paid * (commissionRate / 100);
    const valorEscola = paid - comissaoPlataforma;
    const payRef = `MAN-${Date.now()}-${randomBytes(3).toString("hex").toUpperCase()}`;

    await pool.query("DELETE FROM payment_splits WHERE propina_id=$1", [p.id]);
    await pool.query(`
      INSERT INTO payment_splits (propina_id, payment_ref, destino, valor, tipo)
      VALUES ($1,$2,'school',$3,'propina'), ($1,$2,'platform',$4,'comissao')
    `, [p.id, payRef, valorEscola, comissaoPlataforma]);

    /* Audit log */
    await pool.query(`
      INSERT INTO manual_payment_logs (propina_id, tipo, admin_user, valor, metodo, data_recebimento, observacoes, comprovante_url, payment_ref)
      VALUES ($1,'baixa_manual',$2,$3,$4,$5,$6,$7,$8)
    `, [p.id, school.admin_email, paid, metodo ?? "Manual", data_recebimento, observacoes ?? null, comprovanteUrl, payRef]);

    res.json({
      ok: true,
      payment_ref: payRef,
      status: newStatus,
      valor_pago: paid,
      total_fatura: total,
      comprovante_url: comprovanteUrl,
      baixa_manual_por: school.admin_email,
      split: { escola: valorEscola, plataforma: comissaoPlataforma, comissao_rate: commissionRate },
    });
  }
);

/* ─── GET /admin/colegios/:id/reconciliacao ─── */
router.get("/admin/colegios/:id/reconciliacao", adminAuth, async (req, res) => {
  const schoolId = Number(req.params.id);
  const { status, mes, ano, student_id } = req.query as any;
  const conditions: string[] = ["p.school_id = $1"];
  const params: any[] = [schoolId];

  if (status)     { params.push(status);     conditions.push(`p.status = $${params.length}`); }
  if (student_id) { params.push(student_id); conditions.push(`p.student_id = $${params.length}`); }
  if (mes)        { params.push(mes);        conditions.push(`p.mes = $${params.length}`); }
  if (ano)        { params.push(ano);        conditions.push(`p.ano = $${params.length}`); }

  const [propinaRows, statsRow, schoolRow] = await Promise.all([
    pool.query(`
      SELECT
        p.id, p.student_id, p.mes, p.ano, p.montante, p.multa, p.status,
        p.internal_reference, p.data_vencimento, p.pago_em,
        p.partially_paid_amount,
        p.baixa_manual, p.baixa_manual_por, p.baixa_manual_em, p.baixa_manual_obs,
        p.comprovante_url, p.data_recebimento,
        p.transaction_id, p.metodo_pagamento,
        COALESCE(p.pagamento_origem, 'manual') AS pagamento_origem,
        s.nome AS aluno_nome,
        COALESCE(t.nome,'Sem turma') AS turma,
        pg.referencia AS ref_multicaixa, pg.entidade, pg.valor AS ref_valor,
        pg.estado AS ref_estado, pg.validade AS ref_validade,
        (p.montante + p.multa) AS total_fatura,
        COALESCE(
          (SELECT SUM(ps.valor) FROM payment_splits ps WHERE ps.propina_id = p.id AND ps.destino = 'school'), 0
        ) AS split_escola,
        COALESCE(
          (SELECT SUM(ps.valor) FROM payment_splits ps WHERE ps.propina_id = p.id AND ps.destino = 'platform'), 0
        ) AS split_plataforma
      FROM propinas p
      JOIN students s ON s.id = p.student_id
      LEFT JOIN turmas t ON t.id = s.turma_id
      LEFT JOIN pagamentos pg ON pg.propina_id = p.id
      WHERE ${conditions.join(" AND ")}
      ORDER BY p.ano DESC, p.mes DESC, s.nome
    `, params),
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status='pendente') AS pendentes,
        COUNT(*) FILTER (WHERE status='vencido')  AS vencidas,
        COUNT(*) FILTER (WHERE status='pago')     AS pagas,
        COALESCE(SUM(montante+multa) FILTER (WHERE status!='pago'), 0) AS divida_total,
        COALESCE(SUM(montante+multa) FILTER (WHERE status='pago'),  0) AS receita_total,
        COALESCE(
          (SELECT SUM(ps.valor) FROM payment_splits ps
           JOIN propinas pp ON pp.id = ps.propina_id WHERE pp.school_id = $1 AND ps.destino='school'), 0
        ) AS receita_escola,
        COALESCE(
          (SELECT SUM(ps.valor) FROM payment_splits ps
           JOIN propinas pp ON pp.id = ps.propina_id WHERE pp.school_id = $1 AND ps.destino='platform'), 0
        ) AS comissao_plataforma
      FROM propinas WHERE school_id = $1
    `, [schoolId]),
    pool.query("SELECT name, school_id, commission_rate FROM schools WHERE id=$1", [schoolId]),
  ]);

  res.json({
    propinas: propinaRows.rows,
    stats: statsRow.rows[0],
    school: schoolRow.rows[0],
  });
});

/* ─── GET /admin/reconciliacao — global across all schools ─── */
router.get("/admin/reconciliacao", adminAuth, async (_req, res) => {
  const [propinaRows, statsRow, schoolsRow] = await Promise.all([
    pool.query(`
      SELECT
        p.id, p.student_id, p.mes, p.ano, p.montante, p.multa, p.status,
        p.internal_reference, p.data_vencimento, p.pago_em,
        s.nome AS aluno_nome, sc.name AS escola_nome, sc.school_id AS escola_codigo,
        (p.montante + p.multa) AS total_fatura,
        COALESCE(
          (SELECT SUM(ps.valor) FROM payment_splits ps WHERE ps.propina_id = p.id AND ps.destino='school'), 0
        ) AS split_escola,
        COALESCE(
          (SELECT SUM(ps.valor) FROM payment_splits ps WHERE ps.propina_id = p.id AND ps.destino='platform'), 0
        ) AS split_plataforma
      FROM propinas p
      JOIN students s  ON s.id  = p.student_id
      JOIN schools  sc ON sc.id = p.school_id
      ORDER BY p.pago_em DESC NULLS LAST, p.created_at DESC
      LIMIT 200
    `),
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status='pendente') AS pendentes,
        COUNT(*) FILTER (WHERE status='vencido')  AS vencidas,
        COUNT(*) FILTER (WHERE status='pago')     AS pagas,
        COALESCE(SUM(montante+multa) FILTER (WHERE status!='pago'), 0) AS divida_total,
        COALESCE(SUM(montante+multa) FILTER (WHERE status='pago'),  0) AS receita_total,
        COALESCE(
          (SELECT SUM(ps.valor) FROM payment_splits ps WHERE ps.destino='school'), 0
        ) AS receita_escolas,
        COALESCE(
          (SELECT SUM(ps.valor) FROM payment_splits ps WHERE ps.destino='platform'), 0
        ) AS comissao_plataforma
      FROM propinas
    `),
    pool.query(`
      SELECT sc.id, sc.name, sc.school_id AS codigo, COALESCE(sc.commission_rate,0) AS commission_rate,
             COUNT(p.id) FILTER (WHERE p.status='pago')::int AS pagas,
             COALESCE(SUM(p.montante+p.multa) FILTER (WHERE p.status='pago'), 0) AS receita,
             COALESCE(
               (SELECT SUM(ps.valor) FROM payment_splits ps
                JOIN propinas pp ON pp.id = ps.propina_id WHERE pp.school_id = sc.id AND ps.destino='platform'), 0
             ) AS comissao
      FROM schools sc
      LEFT JOIN propinas p ON p.school_id = sc.id
      GROUP BY sc.id ORDER BY sc.name
    `),
  ]);

  res.json({
    propinas: propinaRows.rows,
    stats: statsRow.rows[0],
    schools: schoolsRow.rows,
  });
});

/* ─── POST /admin/reconciliacao/reconciliar — simulate/process a payment ─── */
router.post("/admin/reconciliacao/reconciliar", adminAuth, async (req, res) => {
  const { internal_reference, valor_pago, metodo } = req.body as {
    internal_reference: string;
    valor_pago: number;
    metodo?: string;
  };

  if (!internal_reference?.trim()) {
    return res.status(400).json({ error: "Referência interna obrigatória." });
  }
  if (!valor_pago || Number(valor_pago) <= 0) {
    return res.status(400).json({ error: "Valor pago deve ser maior que zero." });
  }

  /* Locate the propina by internal_reference */
  const pRow = await pool.query(`
    SELECT p.*, sc.commission_rate, sc.id AS school_db_id
    FROM propinas p
    JOIN schools sc ON sc.id = p.school_id
    WHERE p.internal_reference = $1
  `, [internal_reference.trim()]);

  if (!pRow.rows.length) {
    return res.status(404).json({ error: "Referência não encontrada. Verifique o código informado." });
  }

  const p = pRow.rows[0];
  const total = Number(p.montante) + Number(p.multa);

  if (p.status === "pago") {
    /* If already manually reconciled, log the webhook event and ignore the status update */
    if (p.baixa_manual) {
      await pool.query(`
        INSERT INTO manual_payment_logs (propina_id, tipo, admin_user, valor, metodo, payment_ref, metadata)
        VALUES ($1, 'webhook_ignorado', 'gateway_webhook', $2, $3,
                $4, $5::jsonb)
      `, [
        p.id,
        Number(valor_pago),
        metodo ?? "gateway",
        `WHK-${Date.now()}`,
        JSON.stringify({ internal_reference, reason: "Fatura já baixada manualmente", baixa_manual_por: p.baixa_manual_por }),
      ]);
      return res.json({
        ok: true,
        ignored: true,
        reason: "Fatura já registada como paga manualmente. Evento de gateway registado no log de auditoria.",
        internal_reference,
      });
    }
    return res.status(400).json({ error: "Esta fatura já foi paga." });
  }

  const paid = Number(valor_pago);
  const newStatus = paid >= total ? "pago" : "pendente";

  /* Update propina status */
  await pool.query(`
    UPDATE propinas SET status=$1, pago_em=NOW(),
      partially_paid_amount = CASE WHEN $1 = 'pago' THEN 0 ELSE $2 END
    WHERE id=$3
  `, [newStatus, paid < total ? paid : 0, p.id]);

  /* Update pagamentos reference state */
  await pool.query(`
    UPDATE pagamentos SET estado='PAGO' WHERE propina_id=$1
  `, [p.id]);

  /* Calculate split payment */
  const commissionRate = Number(p.commission_rate ?? 0);
  const comissaoPlataforma = paid * (commissionRate / 100);
  const valorEscola = paid - comissaoPlataforma;

  /* Delete old splits and insert new ones */
  await pool.query("DELETE FROM payment_splits WHERE propina_id=$1", [p.id]);

  const payRef = `REC-${Date.now()}-${randomBytes(3).toString("hex").toUpperCase()}`;

  await pool.query(`
    INSERT INTO payment_splits (propina_id, payment_ref, destino, valor, tipo)
    VALUES ($1,$2,'school',$3,'propina'), ($1,$2,'platform',$4,'comissao')
  `, [p.id, payRef, valorEscola, comissaoPlataforma]);

  res.json({
    ok: true,
    internal_reference,
    metodo: metodo ?? "manual",
    valor_pago: paid,
    total_fatura: total,
    status: newStatus,
    split: {
      escola: valorEscola,
      plataforma: comissaoPlataforma,
      comissao_rate: commissionRate,
    },
    payment_ref: payRef,
  });
});

/* ─── PUT /admin/colegios/:id/comissao — set commission rate ─── */
router.put("/admin/colegios/:id/comissao", adminAuth, async (req, res) => {
  const { commission_rate } = req.body;
  const rate = Number(commission_rate ?? 0);
  if (rate < 0 || rate > 100) {
    return res.status(400).json({ error: "Taxa deve estar entre 0 e 100%." });
  }
  const r = await pool.query(
    "UPDATE schools SET commission_rate=$1 WHERE id=$2 RETURNING id, name, commission_rate",
    [rate, req.params.id]
  );
  if (!r.rows.length) return res.status(404).json({ error: "Colégio não encontrado." });
  res.json(r.rows[0]);
});

/* ─── GET /school/reconciliacao/splits — splits for school's propinas ─── */
router.get("/school/reconciliacao/splits", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const r = await pool.query(`
    SELECT ps.id, ps.propina_id, ps.payment_ref, ps.destino, ps.valor, ps.tipo, ps.created_at,
           p.mes, p.ano, s.nome AS aluno_nome
    FROM payment_splits ps
    JOIN propinas p ON p.id = ps.propina_id
    JOIN students s ON s.id = p.student_id
    WHERE p.school_id = $1
    ORDER BY ps.created_at DESC
    LIMIT 100
  `, [school.school_id]);

  res.json(r.rows);
});

/* ─── Helper: period + optional reference date → { from, to } ─── */
function periodRange(periodo: string, dataRef?: string): { from: Date; to: Date } {
  const ref = dataRef ? new Date(dataRef) : new Date();
  /* to = end of the reference day */
  const to = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 23, 59, 59, 999);
  let from: Date;
  switch (periodo) {
    case "semanal":    from = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 6);   break;
    case "trimestral": from = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 89);  break;
    case "semestral":  from = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 179); break;
    case "anual":      from = new Date(ref.getFullYear(), 0, 1);                                break;
    default:           from = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());       break; // diario
  }
  return { from, to };
}

function metodoToChannel(metodo: string): string {
  const m = (metodo || "").toLowerCase();
  if (m.includes("emis") || m.includes("gpo") || m.includes("multicaixa") || m.includes("express")) return "GPO_EMIS";
  if (m.includes("debito") || m.includes("direct")) return "DIRECT_DEBIT";
  if (m.includes("transfer") || m.includes("iban") || m.includes("bancari")) return "BANK_TRANSFER";
  if (m.includes("tpa") || m.includes("terminal")) return "POS_TPA";
  return "CASH";
}

/* ─── GET /school/reconciliacao/fecho-caixa ─── */
router.get("/school/reconciliacao/fecho-caixa", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const { data_from, data_to, metodo } = req.query as any;
  /* Parse explicit date range sent by the frontend */
  const dateFrom = data_from
    ? new Date((data_from as string) + "T00:00:00.000")
    : new Date(new Date().getFullYear(), 0, 1);
  const dateTo = data_to
    ? new Date((data_to as string) + "T23:59:59.999")
    : new Date();

  const baseConditions = ["p.school_id = $1", "p.status = 'pago'", "p.pago_em >= $2", "p.pago_em <= $3"];
  const baseParams: any[] = [school.school_id, dateFrom.toISOString(), dateTo.toISOString()];

  if (metodo) {
    baseParams.push(metodo);
    baseConditions.push(`COALESCE(p.payment_channel,'CASH') = $${baseParams.length}`);
  }

  const where = baseConditions.join(" AND ");

  const [canaisRow, totaisRow, chartRow, demoRow] = await Promise.all([
    pool.query(`
      SELECT
        COALESCE(p.payment_channel, 'CASH') AS canal,
        COUNT(*)::int                        AS total_transacoes,
        COALESCE(SUM(p.montante + p.multa), 0) AS total_liquidado,
        MAX(p.pago_em)                       AS ultima_transacao
      FROM propinas p
      WHERE ${where}
      GROUP BY COALESCE(p.payment_channel, 'CASH')
      ORDER BY total_liquidado DESC
    `, baseParams),
    pool.query(`
      SELECT
        COUNT(*)::int                                              AS total_transacoes,
        COALESCE(SUM(p.montante + p.multa), 0)                   AS total_liquidado,
        COUNT(*) FILTER (WHERE p.baixa_manual)::int              AS manuais,
        COUNT(*) FILTER (WHERE NOT COALESCE(p.baixa_manual,FALSE))::int AS automaticos
      FROM propinas p WHERE ${where}
    `, baseParams),
    pool.query(`
      SELECT
        DATE_TRUNC('day', p.pago_em)         AS dia,
        COALESCE(p.payment_channel, 'CASH')  AS canal,
        COALESCE(SUM(p.montante + p.multa), 0) AS valor
      FROM propinas p
      WHERE p.school_id = $1 AND p.status = 'pago' AND p.pago_em >= $2 AND p.pago_em <= $3
      GROUP BY DATE_TRUNC('day', p.pago_em), COALESCE(p.payment_channel, 'CASH')
      ORDER BY dia
    `, [school.school_id, dateFrom.toISOString(), dateTo.toISOString()]),
    pool.query("SELECT COALESCE(demo_mode, FALSE) AS demo_mode FROM schools WHERE id = $1", [school.school_id]),
  ]);

  /* Build chart rows grouped by day with all canais as columns */
  const dayMap = new Map<string, Record<string, number>>();
  for (const r of chartRow.rows) {
    const d = new Date(r.dia).toLocaleDateString("pt-AO", { day:"2-digit", month:"2-digit" });
    if (!dayMap.has(d)) dayMap.set(d, { dia: d as any } as any);
    dayMap.get(d)![r.canal] = Number(r.valor);
  }

  res.json({
    canais:    canaisRow.rows,
    totais:    totaisRow.rows[0],
    chart:     Array.from(dayMap.values()),
    demo_mode: demoRow.rows[0]?.demo_mode ?? false,
    date_from: dateFrom.toISOString(),
    date_to:   dateTo.toISOString(),
  });
});

/* ─── POST /school/reconciliacao/demo-toggle ─── */
router.post("/school/reconciliacao/demo-toggle", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const r = await pool.query(
    `UPDATE schools SET demo_mode = NOT COALESCE(demo_mode, FALSE)
     WHERE id = $1 RETURNING COALESCE(demo_mode, FALSE) AS demo_mode`,
    [school.school_id]
  );
  const enabled = r.rows[0]?.demo_mode ?? false;
  if (enabled) startDemoMode(school.school_id);
  else          stopDemoMode(school.school_id);

  res.json({ demo_mode: enabled });
});

/* ─── GET /school/reconciliacao/stream — SSE real-time ─── */
router.get("/school/reconciliacao/stream", async (req: any, res: any) => {
  /* EventSource cannot set headers — accept token via query param or Authorization header */
  const header = req.headers.authorization as string | undefined;
  const tokenVal: string | undefined = header?.startsWith("Bearer ") ? header.slice(7) : (req.query.token as string | undefined);
  if (!tokenVal) { res.status(401).end(); return; }
  const school = await getSchoolFromToken(tokenVal);
  if (!school) { res.status(401).end(); return; }

  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  /* Send initial connected event */
  res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

  addSseClient(school.school_id, res);

  /* Keepalive every 25s */
  const ka = setInterval(() => { try { res.write(": ka\n\n"); } catch {} }, 25_000);

  req.on("close", () => {
    clearInterval(ka);
    removeSseClient(school.school_id, res);
  });
});

/* ─── POST /school/reconciliacao/baixa-manual: also set payment_channel ─── */
/* (hook into existing route — payment_channel set via metodo mapping) */

export { generateInternalReference };
export default router;
