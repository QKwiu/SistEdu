/**
 * contingencia.ts — Plano de Contingência EMIS (6 Camadas)
 *
 * Camada 2: Referências provisórias PROV-* quando EMIS falha
 * Camada 3: Canal IBAN activado quando emis_em_falha + iban_visivel_em_contingencia
 * Camada 4: Encarregado submete comprovativo → pago_manual_pendente
 * Camada 5: Gestor confirma / rejeita pagamentos manuais
 */

import { Router } from "express";
import { pool } from "@workspace/db";
import { randomBytes } from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();

/* ─── Multer: comprovativo (max 5 MB; PDF/JPG/PNG) ─── */
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const _storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `comprov-${Date.now()}-${randomBytes(6).toString("hex")}${ext}`);
  },
});
const uploadComprovativo = multer({
  storage: _storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".pdf", ".jpg", ".jpeg", ".png"];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
}).single("comprovativo");

/* ─── Auth: escola ─── */
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

/* ─── Auth: encarregado ─── */
async function getGuardianFromToken(token: string) {
  const res = await pool.query(
    `SELECT e.id, e.nome, e.telefone
     FROM encarregados e
     JOIN guardian_sessions gs ON gs.encarregado_id = e.id
     WHERE gs.token = $1 AND gs.expires_at > NOW()`,
    [token]
  );
  return res.rows[0] ?? null;
}
function guardianAuth(req: any, res: any, next: any) {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return res.status(401).json({ error: "Não autenticado." });
  req.guardianToken = h.slice(7);
  next();
}

/* ════════════════════════════════════════════════════════════════
   DB MIGRATION
   ════════════════════════════════════════════════════════════════ */
export async function runContingenciaMigration() {
  await pool.query(`
    ALTER TABLE schools ADD COLUMN IF NOT EXISTS banco_nome       TEXT;
    ALTER TABLE schools ADD COLUMN IF NOT EXISTS banco_iban       TEXT;
    ALTER TABLE schools ADD COLUMN IF NOT EXISTS banco_titular    TEXT;
    ALTER TABLE schools ADD COLUMN IF NOT EXISTS banco_swift_bic  TEXT;
    ALTER TABLE schools ADD COLUMN IF NOT EXISTS iban_visivel_em_contingencia BOOLEAN DEFAULT FALSE;
    ALTER TABLE schools ADD COLUMN IF NOT EXISTS emis_em_falha    BOOLEAN DEFAULT FALSE;

    ALTER TABLE propinas ADD COLUMN IF NOT EXISTS comprovativo_url       TEXT;
    ALTER TABLE propinas ADD COLUMN IF NOT EXISTS comprovativo_data      DATE;
    ALTER TABLE propinas ADD COLUMN IF NOT EXISTS comprovativo_banco_origem  TEXT;
    ALTER TABLE propinas ADD COLUMN IF NOT EXISTS comprovativo_ref_transf    TEXT;
    ALTER TABLE propinas ADD COLUMN IF NOT EXISTS comprovativo_valor     NUMERIC(12,2);
    ALTER TABLE propinas ADD COLUMN IF NOT EXISTS comprovativo_submetido_em  TIMESTAMPTZ;
    ALTER TABLE propinas ADD COLUMN IF NOT EXISTS confirmado_por         TEXT;
    ALTER TABLE propinas ADD COLUMN IF NOT EXISTS confirmado_em          TIMESTAMPTZ;
    ALTER TABLE propinas ADD COLUMN IF NOT EXISTS motivo_rejeicao        TEXT;
    ALTER TABLE propinas ADD COLUMN IF NOT EXISTS tentativas_emis        INT DEFAULT 0;

    CREATE TABLE IF NOT EXISTS emis_health_log (
      id         SERIAL PRIMARY KEY,
      school_id  INTEGER REFERENCES schools(id),
      status     VARCHAR(10) NOT NULL CHECK (status IN ('ok','falha')),
      tentativa  INT  DEFAULT 0,
      detalhe    TEXT,
      criado_em  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS emis_reference_attempts (
      id              SERIAL PRIMARY KEY,
      school_id       INTEGER REFERENCES schools(id),
      propina_id      INTEGER REFERENCES propinas(id),
      tentativa       INT  DEFAULT 1,
      estado          VARCHAR(30) DEFAULT 'pendente',
      proxima_tentativa TIMESTAMPTZ,
      criado_em       TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log("[contingencia] migration OK");
}

/* ════════════════════════════════════════════════════════════════
   SCHOOL — CONFIGURAÇÕES DE CONTINGÊNCIA (IBAN)
   ════════════════════════════════════════════════════════════════ */

/* GET /school/contingencia/settings */
router.get("/school/contingencia/settings", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const r = await pool.query(
    `SELECT banco_nome, banco_iban, banco_titular, banco_swift_bic,
            iban_visivel_em_contingencia, emis_em_falha
     FROM schools WHERE id=$1`,
    [school.school_id]
  );
  res.json(r.rows[0] ?? {});
});

/* PUT /school/contingencia/settings */
router.put("/school/contingencia/settings", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const { banco_nome, banco_iban, banco_titular, banco_swift_bic, iban_visivel_em_contingencia } = req.body;
  await pool.query(
    `UPDATE schools
     SET banco_nome=$1, banco_iban=$2, banco_titular=$3, banco_swift_bic=$4,
         iban_visivel_em_contingencia=COALESCE($5, iban_visivel_em_contingencia)
     WHERE id=$6`,
    [
      banco_nome    ?? null,
      banco_iban    ?? null,
      banco_titular ?? null,
      banco_swift_bic ?? null,
      iban_visivel_em_contingencia ?? null,
      school.school_id,
    ]
  );
  res.json({ ok: true });
});

/* POST /school/contingencia/toggle-emis — activar/desactivar modo contingência manualmente */
router.post("/school/contingencia/toggle-emis", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const { emis_em_falha } = req.body;
  await pool.query(
    `UPDATE schools SET emis_em_falha=$1 WHERE id=$2`,
    [!!emis_em_falha, school.school_id]
  );
  /* Log da alteração manual */
  await pool.query(
    `INSERT INTO emis_health_log (school_id, status, detalhe)
     VALUES ($1, $2, 'Alterado manualmente pelo gestor')`,
    [school.school_id, emis_em_falha ? "falha" : "ok"]
  );
  res.json({ ok: true, emis_em_falha: !!emis_em_falha });
});

/* GET /school/contingencia/status — estado EMIS + log recente + contagem pendentes */
router.get("/school/contingencia/status", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const [scR, logR, cntR] = await Promise.all([
    pool.query(`SELECT emis_em_falha, iban_visivel_em_contingencia FROM schools WHERE id=$1`, [school.school_id]),
    pool.query(
      `SELECT status, criado_em, detalhe FROM emis_health_log
       WHERE school_id=$1 ORDER BY criado_em DESC LIMIT 20`,
      [school.school_id]
    ),
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status='contingencia')        AS contingencia,
         COUNT(*) FILTER (WHERE status='pago_manual_pendente') AS aguarda_confirmacao,
         COUNT(*) FILTER (WHERE status='pago_manual')          AS confirmados
       FROM propinas WHERE school_id=$1`,
      [school.school_id]
    ),
  ]);
  const sc = scR.rows[0] ?? {};
  const cnt = cntR.rows[0] ?? {};
  res.json({
    emis_em_falha:              sc.emis_em_falha ?? false,
    iban_visivel_em_contingencia: sc.iban_visivel_em_contingencia ?? false,
    log: logR.rows,
    contagem: {
      contingencia:       Number(cnt.contingencia ?? 0),
      aguarda_confirmacao: Number(cnt.aguarda_confirmacao ?? 0),
      confirmados:        Number(cnt.confirmados ?? 0),
    },
  });
});

/* ════════════════════════════════════════════════════════════════
   SCHOOL — RECONCILIAÇÃO DE TRANSFERÊNCIAS MANUAIS  (Camada 5)
   ════════════════════════════════════════════════════════════════ */

/* GET /school/reconciliacao/manuais */
router.get("/school/reconciliacao/manuais", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const r = await pool.query(
    `SELECT
       p.id, p.mes, p.ano, p.montante, p.multa, p.status,
       p.comprovativo_url, p.comprovativo_data, p.comprovativo_banco_origem,
       p.comprovativo_ref_transf, p.comprovativo_valor, p.comprovativo_submetido_em,
       p.referencia AS ref_provisoria,
       p.confirmado_por, p.confirmado_em, p.motivo_rejeicao,
       s.nome AS aluno_nome, s.numero_processo, t.nome AS turma
     FROM propinas p
     JOIN students s ON s.id = p.student_id
     LEFT JOIN turmas t ON t.id = s.turma_id
     WHERE p.school_id=$1
       AND p.status IN ('pago_manual_pendente','pago_manual','contingencia')
     ORDER BY
       CASE p.status WHEN 'pago_manual_pendente' THEN 0 WHEN 'contingencia' THEN 1 ELSE 2 END,
       p.comprovativo_submetido_em DESC NULLS LAST,
       p.created_at DESC`,
    [school.school_id]
  );
  res.json(r.rows);
});

/* GET /school/reconciliacao/manuais/:id */
router.get("/school/reconciliacao/manuais/:id", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const r = await pool.query(
    `SELECT p.*,
            s.nome AS aluno_nome, s.numero_processo, t.nome AS turma,
            e.nome AS encarregado_nome, e.telefone AS encarregado_telefone
     FROM propinas p
     JOIN students s ON s.id = p.student_id
     LEFT JOIN turmas t ON t.id = s.turma_id
     LEFT JOIN student_encarregados se2 ON se2.student_id = s.id
     LEFT JOIN encarregados e ON e.id = se2.encarregado_id
     WHERE p.id=$1 AND p.school_id=$2
     LIMIT 1`,
    [req.params.id, school.school_id]
  );
  if (!r.rows.length) return res.status(404).json({ error: "Não encontrado." });
  res.json(r.rows[0]);
});

/* POST /school/reconciliacao/manuais/:id/confirmar — Camada 5: admin confirma */
router.post("/school/reconciliacao/manuais/:id/confirmar", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const { observacao } = req.body;
  const r = await pool.query(
    `UPDATE propinas
     SET status        = 'pago_manual',
         pago_em       = NOW(),
         confirmado_por = $1,
         confirmado_em  = NOW(),
         baixa_manual   = TRUE,
         baixa_manual_por = $1,
         baixa_manual_em  = NOW(),
         baixa_manual_obs = COALESCE($2, 'Confirmado via reconciliação de transferência')
     WHERE id=$3 AND school_id=$4 AND status='pago_manual_pendente'
     RETURNING id, mes, ano, montante, student_id`,
    [school.school_name, observacao ?? null, req.params.id, school.school_id]
  );
  if (!r.rows.length) return res.status(409).json({ error: "Propina não encontrada ou não está aguarda confirmação." });
  res.json({ ok: true, propina: r.rows[0] });
});

/* POST /school/reconciliacao/manuais/:id/rejeitar */
router.post("/school/reconciliacao/manuais/:id/rejeitar", schoolAuth, async (req: any, res) => {
  const school = await getSchoolFromToken(req.schoolToken);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });
  const { motivo } = req.body;
  if (!motivo?.trim()) return res.status(400).json({ error: "Motivo de rejeição obrigatório." });
  const r = await pool.query(
    `UPDATE propinas
     SET status              = 'contingencia',
         motivo_rejeicao     = $1,
         comprovativo_submetido_em = NULL
     WHERE id=$2 AND school_id=$3 AND status='pago_manual_pendente'
     RETURNING id`,
    [motivo.trim(), req.params.id, school.school_id]
  );
  if (!r.rows.length) return res.status(409).json({ error: "Propina não encontrada ou estado inválido." });
  res.json({ ok: true });
});

/* ════════════════════════════════════════════════════════════════
   GUARDIAN — ESTADO EMIS + IBAN  (Camada 3)
   ════════════════════════════════════════════════════════════════ */

/* GET /guardian/contingencia/status */
router.get("/guardian/contingencia/status", guardianAuth, async (req: any, res) => {
  const guardian = await getGuardianFromToken(req.guardianToken);
  if (!guardian) return res.status(401).json({ error: "Não autenticado." });

  const alunoR = await pool.query(
    `SELECT s.school_id
     FROM students s
     JOIN student_encarregados se ON se.student_id = s.id
     WHERE se.encarregado_id = $1
     LIMIT 1`,
    [guardian.id]
  );
  if (!alunoR.rows.length) return res.json({ emis_em_falha: false, iban_ativo: false, banco: null });

  const schoolId = alunoR.rows[0].school_id;
  const r = await pool.query(
    `SELECT emis_em_falha, iban_visivel_em_contingencia,
            banco_nome, banco_iban, banco_titular, banco_swift_bic
     FROM schools WHERE id=$1`,
    [schoolId]
  );
  const sc = r.rows[0] ?? {};
  const iban_ativo = !!(sc.emis_em_falha && sc.iban_visivel_em_contingencia);
  res.json({
    emis_em_falha: sc.emis_em_falha ?? false,
    iban_ativo,
    banco: iban_ativo ? {
      nome:      sc.banco_nome,
      iban:      sc.banco_iban,
      titular:   sc.banco_titular,
      swift_bic: sc.banco_swift_bic,
    } : null,
  });
});

/* ════════════════════════════════════════════════════════════════
   GUARDIAN — COMPROVATIVO DE TRANSFERÊNCIA  (Camada 4)
   ════════════════════════════════════════════════════════════════ */

/* POST /guardian/propinas/:id/comprovativo */
router.post("/guardian/propinas/:id/comprovativo", guardianAuth, (req: any, res: any) => {
  uploadComprovativo(req, res, async (err: any) => {
    if (err) return res.status(400).json({ error: "Ficheiro inválido. Máx. 5 MB — tipos aceites: PDF, JPG, PNG." });

    try {
      const guardian = await getGuardianFromToken(req.guardianToken);
      if (!guardian) {
        if (req.file) fs.unlinkSync(path.join(uploadsDir, req.file.filename));
        return res.status(401).json({ error: "Não autenticado." });
      }

      const propina_id = Number(req.params.id);
      const { data_transferencia, valor, banco_origem, ref_transferencia } = req.body;

      if (!data_transferencia || !valor || !banco_origem || !ref_transferencia) {
        if (req.file) fs.unlinkSync(path.join(uploadsDir, req.file.filename));
        return res.status(400).json({ error: "Preencha todos os campos: data, valor, banco de origem e referência da transferência." });
      }

      /* Verificar que a propina pertence a um aluno deste encarregado */
      const check = await pool.query(
        `SELECT p.id, p.status, p.montante, p.mes, p.ano
         FROM propinas p
         JOIN students s ON s.id = p.student_id
         JOIN student_encarregados se ON se.student_id = s.id
         WHERE p.id=$1 AND se.encarregado_id=$2`,
        [propina_id, guardian.id]
      );
      if (!check.rows.length) {
        if (req.file) fs.unlinkSync(path.join(uploadsDir, req.file.filename));
        return res.status(404).json({ error: "Propina não encontrada." });
      }

      const propina = check.rows[0];
      const estadosAceites = ["contingencia", "vencido", "pendente"];
      if (!estadosAceites.includes(propina.status)) {
        if (req.file) fs.unlinkSync(path.join(uploadsDir, req.file.filename));
        return res.status(400).json({ error: `Esta propina não aceita comprovativo no estado "${propina.status}".` });
      }

      const comprovativo_url = req.file ? `/api/uploads/${req.file.filename}` : null;

      await pool.query(
        `UPDATE propinas
         SET status                    = 'pago_manual_pendente',
             comprovativo_url          = $1,
             comprovativo_data         = $2,
             comprovativo_banco_origem = $3,
             comprovativo_ref_transf   = $4,
             comprovativo_valor        = $5,
             comprovativo_submetido_em = NOW(),
             motivo_rejeicao           = NULL
         WHERE id=$6`,
        [
          comprovativo_url,
          data_transferencia,
          banco_origem,
          ref_transferencia,
          Number(valor),
          propina_id,
        ]
      );

      res.json({ ok: true, status: "pago_manual_pendente" });
    } catch (e: any) {
      if (req.file) {
        try { fs.unlinkSync(path.join(uploadsDir, req.file.filename)); } catch {}
      }
      console.error("[contingencia:comprovativo]", e);
      res.status(500).json({ error: "Erro interno ao guardar comprovativo." });
    }
  });
});

export default router;
