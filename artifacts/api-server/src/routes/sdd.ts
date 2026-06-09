/**
 * sdd.ts — ISO 20022 SDD (SEPA Direct Debit) — Administração
 *
 * Geração e submissão de ficheiros pain.008.001.02 em lote para débitos directos.
 *
 * Tabelas:
 *   sdd_emissor_configs  — configuração por escola (credenciais cifradas AES-256-GCM)
 *   dd_pain008_batches   — já existe em direct-debit.ts
 *
 * Endpoints:
 *   GET  /admin/colegios/:id/sdd-config               — ler configuração do emissor
 *   PUT  /admin/colegios/:id/sdd-config               — guardar (AES-encrypted)
 *   GET  /admin/colegios/:id/sdd/batches              — listar lotes por escola
 *   POST /admin/colegios/:id/sdd/generate-batch       — gerar XML pain.008
 *   GET  /admin/colegios/:id/sdd/batches/:bid/download — descarregar XML
 *   POST /admin/colegios/:id/sdd/batches/:bid/submit  — submeter ao banco via SFTP
 *   POST /admin/colegios/:id/sdd/test-connection      — testar ligação SFTP
 */

import { Router }                 from "express";
import { z }                      from "zod";
import { pool }                   from "@workspace/db";
import { encryptAES, decryptAES } from "../lib/crypto";

// ssh2 não inclui @types separados — importar via require para evitar erros de tipagem
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Client: Ssh2Client } = require("ssh2") as { Client: new () => any };

const router = Router();

/* ─── adminAuth inline (mesmo padrão de bank.ts) ─────────────────────────── */
async function adminAuth(req: any, res: any, next: any) {
  const auth  = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Token de administrador em falta." });
  try {
    const { rows } = await pool.query(
      `SELECT id FROM admin_sessions WHERE token=$1 AND expires_at>NOW()`,
      [token]
    );
    if (!rows.length) return res.status(401).json({ error: "Sessão inválida ou expirada." });
    next();
  } catch (e) {
    console.error("[adminAuth/sdd]", e);
    res.status(500).json({ error: "Erro ao verificar sessão." });
  }
}

/* ─── Migration ───────────────────────────────────────────────────────────── */

export async function runSddMigration(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sdd_emissor_configs (
      id                SERIAL PRIMARY KEY,
      school_id         INTEGER NOT NULL UNIQUE,
      creditor_id       VARCHAR(35)  NOT NULL DEFAULT '',
      creditor_name     VARCHAR(70)  NOT NULL DEFAULT '',
      creditor_iban     VARCHAR(35)  NOT NULL DEFAULT '',
      creditor_bic      VARCHAR(11)  NOT NULL DEFAULT '',
      sequence_type     VARCHAR(4)   NOT NULL DEFAULT 'RCUR'
                        CHECK (sequence_type IN ('FRST','RCUR','FNAL','OOFF')),
      sftp_host         VARCHAR(255) NOT NULL DEFAULT '',
      sftp_port         INTEGER      NOT NULL DEFAULT 22,
      sftp_user         VARCHAR(100) NOT NULL DEFAULT '',
      sftp_outbox_path  VARCHAR(255) NOT NULL DEFAULT '/outbox',
      sftp_inbox_path   VARCHAR(255) NOT NULL DEFAULT '/inbox',
      creds_iv          TEXT,
      creds_tag         TEXT,
      creds_ct          TEXT,
      criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      actualizado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  console.log("[sdd migration] sdd_emissor_configs OK");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sdd_engine_rules (
      id                          SERIAL PRIMARY KEY,
      -- D-1 Pré-notificação
      prenotif_activo             BOOLEAN     NOT NULL DEFAULT TRUE,
      prenotif_horas_antes        INTEGER     NOT NULL DEFAULT 24,
      prenotif_email              BOOLEAN     NOT NULL DEFAULT TRUE,
      prenotif_sms                BOOLEAN     NOT NULL DEFAULT FALSE,
      prenotif_push               BOOLEAN     NOT NULL DEFAULT TRUE,
      -- D+0 Execução
      exec_auto_transicao         BOOLEAN     NOT NULL DEFAULT TRUE,
      exec_bloquear_canais        BOOLEAN     NOT NULL DEFAULT TRUE,
      -- Máquina de estados de falha
      falha_max_consecutivas      INTEGER     NOT NULL DEFAULT 3,
      falha_suspender             BOOLEAN     NOT NULL DEFAULT TRUE,
      falha_reativar_manual       BOOLEAN     NOT NULL DEFAULT TRUE,
      -- Reconciliação PAIN.002
      recon_auto_processar        BOOLEAN     NOT NULL DEFAULT TRUE,
      recon_idempotency_horas     INTEGER     NOT NULL DEFAULT 48,
      -- Ledger — Débito confirmado
      sucesso_marcar_pago         BOOLEAN     NOT NULL DEFAULT TRUE,
      sucesso_gerar_recibo        BOOLEAN     NOT NULL DEFAULT TRUE,
      sucesso_email_confirmacao   BOOLEAN     NOT NULL DEFAULT TRUE,
      -- Ledger — Débito rejeitado
      falha_marcar_vencido        BOOLEAN     NOT NULL DEFAULT TRUE,
      falha_aplicar_multa         BOOLEAN     NOT NULL DEFAULT TRUE,
      falha_email_aviso           BOOLEAN     NOT NULL DEFAULT TRUE,
      -- Mapeamento de códigos de rejeição ISO 20022
      codigos_rejeicao            JSONB       NOT NULL DEFAULT '[
        {"code":"MS03","descricao":"Saldo insuficiente","acao":"OVERDUE_MULTA"},
        {"code":"AC04","descricao":"Conta encerrada","acao":"SUSPENDER"},
        {"code":"MD01","descricao":"Débito não autorizado pelo devedor","acao":"SUSPENDER"},
        {"code":"MD06","descricao":"Mandato cancelado pelo devedor","acao":"CANCELAR"},
        {"code":"AM04","descricao":"Montante insuficiente","acao":"OVERDUE_MULTA"},
        {"code":"FF01","descricao":"Formato de ficheiro inválido","acao":"OVERDUE"},
        {"code":"AG01","descricao":"Transação proibida nesta conta","acao":"SUSPENDER"},
        {"code":"FOCR","descricao":"Falha de autenticação EMIS","acao":"SUSPENDER"}
      ]'::jsonb,
      actualizado_em              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      actualizado_por             TEXT        NOT NULL DEFAULT 'sistema'
    )
  `);
  await pool.query(`INSERT INTO sdd_engine_rules (id) VALUES (1) ON CONFLICT DO NOTHING`);
  console.log("[sdd migration] sdd_engine_rules OK");
}

/* ─── Utilitários ISO 20022 ───────────────────────────────────────────────── */

function escXml(s: string): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function validateIban(iban: string): boolean {
  const raw = iban.replace(/\s/g, "");
  return /^AO06\d{21}$/.test(raw) || /^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(raw);
}

function validateBic(bic: string): boolean {
  return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic);
}

function generateRef(prefix: string): string {
  const ts  = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${ts}-${rnd}`.slice(0, 35);
}

interface Pain008Instruction {
  instruction_id:            string;
  end_to_end_id:             string;
  mandate_id_ref:            string;
  mandate_signed_date:       string;
  sequence_type:             string;
  amount:                    number;
  debtor_name:               string;
  debtor_iban:               string;
  debtor_bic:                string;
  requested_collection_date: string;
}

function buildPain008Xml(
  batchRef: string,
  creditorId: string,
  creditorName: string,
  creditorIban: string,
  creditorBic: string,
  seqType: string,
  instructions: Pain008Instruction[]
): string {
  if (!instructions.length) throw new Error("Lista de instruções vazia.");
  const now          = new Date().toISOString().replace("Z", "+00:00");
  const totalAmount  = instructions.reduce((s, i) => s + i.amount, 0).toFixed(2);
  const collDate     = instructions[0].requested_collection_date;

  const txBlocks = instructions.map(i => `
    <DrctDbtTxInf>
      <PmtId>
        <InstrId>${escXml(i.instruction_id)}</InstrId>
        <EndToEndId>${escXml(i.end_to_end_id)}</EndToEndId>
      </PmtId>
      <InstdAmt Ccy="AOA">${i.amount.toFixed(2)}</InstdAmt>
      <DrctDbtTx>
        <MndtRltdInf>
          <MndtId>${escXml(i.mandate_id_ref)}</MndtId>
          <DtOfSgntr>${escXml(i.mandate_signed_date)}</DtOfSgntr>
          <SeqTp>${escXml(i.sequence_type)}</SeqTp>
        </MndtRltdInf>
      </DrctDbtTx>
      <DbtrAgt>
        <FinInstnId><BIC>${escXml(i.debtor_bic)}</BIC></FinInstnId>
      </DbtrAgt>
      <Dbtr><Nm>${escXml(i.debtor_name)}</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>${escXml(i.debtor_iban.replace(/\s/g, ""))}</IBAN></Id></DbtrAcct>
    </DrctDbtTxInf>`).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${escXml(batchRef)}</MsgId>
      <CreDtTm>${now}</CreDtTm>
      <NbOfTxs>${instructions.length}</NbOfTxs>
      <CtrlSum>${totalAmount}</CtrlSum>
      <InitgPty>
        <Nm>${escXml(creditorName)}</Nm>
        <Id><OrgId><Othr>
          <Id>${escXml(creditorId)}</Id>
          <SchmeNm><Prtry>SEPA</Prtry></SchmeNm>
        </Othr></OrgId></Id>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${escXml(batchRef)}-PMT</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <NbOfTxs>${instructions.length}</NbOfTxs>
      <CtrlSum>${totalAmount}</CtrlSum>
      <PmtTpInf>
        <SvcLvl><Cd>SEPA</Cd></SvcLvl>
        <LclInstrm><Cd>CORE</Cd></LclInstrm>
        <SeqTp>${escXml(seqType)}</SeqTp>
      </PmtTpInf>
      <ReqdColltnDt>${escXml(collDate)}</ReqdColltnDt>
      <Cdtr><Nm>${escXml(creditorName)}</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>${escXml(creditorIban)}</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><BIC>${escXml(creditorBic)}</BIC></FinInstnId></CdtrAgt>
      <CdtrSchmeId>
        <Id><PrvtId><Othr>
          <Id>${escXml(creditorId)}</Id>
          <SchmeNm><Prtry>SEPA</Prtry></SchmeNm>
        </Othr></PrvtId></Id>
      </CdtrSchmeId>${txBlocks}
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;
}

/* ─── Validação sintáctica do XML (estrutura mínima pain.008) ─────────────── */
function validatePain008Xml(xml: string): string[] {
  const errors: string[] = [];
  const required = [
    "urn:iso:std:iso:20022:tech:xsd:pain.008.001.02",
    "<CstmrDrctDbtInitn>",
    "<GrpHdr>",
    "<MsgId>",
    "<NbOfTxs>",
    "<CtrlSum>",
    "<PmtInf>",
    "<PmtMtd>DD</PmtMtd>",
    "<SeqTp>",
    "<ReqdColltnDt>",
    "<DrctDbtTxInf>",
    "<InstdAmt",
    "<MndtId>",
    "<IBAN>",
    "<BIC>",
  ];
  for (const token of required) {
    if (!xml.includes(token)) errors.push(`Elemento obrigatório em falta: ${token}`);
  }
  if (/[^\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFD]/.test(xml)) {
    errors.push("Caracteres inválidos detectados no XML (fora do intervalo XML 1.0).");
  }
  const nbMatch = xml.match(/<NbOfTxs>(\d+)<\/NbOfTxs>/);
  const txCount = (xml.match(/<DrctDbtTxInf>/g) ?? []).length;
  if (nbMatch && parseInt(nbMatch[1]) !== txCount) {
    errors.push(`NbOfTxs (${nbMatch[1]}) não corresponde ao número de transacções encontradas (${txCount}).`);
  }
  return errors;
}

/* ─── SFTP helpers (ssh2) ─────────────────────────────────────────────────── */

interface SftpCreds {
  sftp_password?:   string;
  ssh_private_key?: string;
}

function sftpConnect(
  host: string, port: number, user: string, creds: SftpCreds
): Promise<any> {
  return new Promise((resolve, reject) => {
    const conn = new Ssh2Client();
    const timer = setTimeout(() => {
      conn.destroy();
      reject(new Error("Timeout de ligação SFTP (10s)."));
    }, 10_000);
    conn.on("ready", () => { clearTimeout(timer); resolve(conn); });
    conn.on("error", (e: any) => { clearTimeout(timer); reject(e); });
    const cfg: any = { host, port, username: user, readyTimeout: 10_000 };
    if (creds.ssh_private_key) cfg.privateKey = creds.ssh_private_key;
    else cfg.password = creds.sftp_password ?? "";
    conn.connect(cfg);
  });
}

function sftpPutFile(conn: any, remotePath: string, content: string): Promise<void> {
  return new Promise((resolve, reject) => {
    conn.sftp((err: any, sftp: any) => {
      if (err) return reject(err);
      const buf = Buffer.from(content, "utf8");
      const ws  = sftp.createWriteStream(remotePath);
      ws.on("close",  resolve);
      ws.on("error",  reject);
      ws.write(buf);
      ws.end();
    });
  });
}

function sftpTestPaths(
  conn: any,
  outbox: string, inbox: string
): Promise<{ outbox: boolean; inbox: boolean }> {
  return new Promise((resolve, reject) => {
    conn.sftp((err: any, sftp: any) => {
      if (err) return reject(err);
      let done = 0;
      let outboxOk = false, inboxOk = false;
      const check = () => { if (++done === 2) resolve({ outbox: outboxOk, inbox: inboxOk }); };
      sftp.stat(outbox, (e: any) => { outboxOk = !e; check(); });
      sftp.stat(inbox,  (e: any) => { inboxOk  = !e; check(); });
    });
  });
}

/* ─── Zod Schemas ─────────────────────────────────────────────────────────── */

const EmissorConfigSchema = z.object({
  creditor_id:      z.string().max(35).default(""),
  creditor_name:    z.string().max(70).default(""),
  creditor_iban:    z.string().max(35).default(""),
  creditor_bic:     z.string().max(11).default(""),
  sequence_type:    z.enum(["FRST", "RCUR", "FNAL", "OOFF"]).default("RCUR"),
  sftp_host:        z.string().max(255).default(""),
  sftp_port:        z.coerce.number().int().min(1).max(65535).default(22),
  sftp_user:        z.string().max(100).default(""),
  sftp_outbox_path: z.string().max(255).default("/outbox"),
  sftp_inbox_path:  z.string().max(255).default("/inbox"),
  sftp_password:    z.string().optional(),
  ssh_private_key:  z.string().optional(),
});

/* ─── GET /admin/colegios/:id/sdd-config ──────────────────────────────────── */

router.get("/admin/colegios/:id/sdd-config", adminAuth, async (req, res) => {
  try {
    const schoolId = Number(req.params.id);
    if (!schoolId) return res.status(400).json({ error: "school_id inválido." });

    const { rows } = await pool.query(
      `SELECT id, school_id, creditor_id, creditor_name, creditor_iban, creditor_bic,
              sequence_type, sftp_host, sftp_port, sftp_user, sftp_outbox_path, sftp_inbox_path,
              creds_iv, creds_tag, creds_ct
       FROM sdd_emissor_configs WHERE school_id=$1`,
      [schoolId]
    );

    if (!rows.length) return res.json({ config: null });

    const row = rows[0];
    let sftp_password = "";
    let ssh_private_key = "";
    if (row.creds_iv && row.creds_tag && row.creds_ct) {
      try {
        const plain = decryptAES({ iv: row.creds_iv, tag: row.creds_tag, ciphertext: row.creds_ct });
        const creds = JSON.parse(plain);
        if (creds.sftp_password)   sftp_password   = "••••••••";
        if (creds.ssh_private_key) ssh_private_key = "••••••••";
      } catch { /* credenciais corrompidas — ignora */ }
    }

    return res.json({
      config: {
        creditor_id:      row.creditor_id,
        creditor_name:    row.creditor_name,
        creditor_iban:    row.creditor_iban,
        creditor_bic:     row.creditor_bic,
        sequence_type:    row.sequence_type,
        sftp_host:        row.sftp_host,
        sftp_port:        row.sftp_port,
        sftp_user:        row.sftp_user,
        sftp_outbox_path: row.sftp_outbox_path,
        sftp_inbox_path:  row.sftp_inbox_path,
        sftp_password,
        ssh_private_key,
      },
    });
  } catch (e) {
    console.error("[sdd-config GET]", e);
    return res.status(500).json({ error: "Erro ao carregar configuração SDD." });
  }
});

/* ─── PUT /admin/colegios/:id/sdd-config ──────────────────────────────────── */

router.put("/admin/colegios/:id/sdd-config", adminAuth, async (req, res) => {
  try {
    const schoolId = Number(req.params.id);
    if (!schoolId) return res.status(400).json({ error: "school_id inválido." });

    const parsed = EmissorConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos.", detalhes: parsed.error.flatten().fieldErrors });
    }

    const d = parsed.data;

    if (d.creditor_iban && !validateIban(d.creditor_iban)) {
      return res.status(400).json({ error: `IBAN do credor inválido: ${d.creditor_iban}` });
    }
    if (d.creditor_bic && !validateBic(d.creditor_bic)) {
      return res.status(400).json({ error: `BIC/SWIFT do credor inválido: ${d.creditor_bic}` });
    }

    /* Verificar se existem credenciais mascaradas — se sim, manter as existentes */
    let credsToEncrypt: SftpCreds = {};
    const maskChar = "••••••••";

    if (d.sftp_password !== maskChar || d.ssh_private_key !== maskChar) {
      /* Pelo menos um campo mudou — reler as existentes e sobrescrever */
      const existing = await pool.query(
        "SELECT creds_iv, creds_tag, creds_ct FROM sdd_emissor_configs WHERE school_id=$1",
        [schoolId]
      );
      if (existing.rows.length && existing.rows[0].creds_iv) {
        try {
          const plain = decryptAES({
            iv: existing.rows[0].creds_iv,
            tag: existing.rows[0].creds_tag,
            ciphertext: existing.rows[0].creds_ct,
          });
          credsToEncrypt = JSON.parse(plain);
        } catch { credsToEncrypt = {}; }
      }
      if (d.sftp_password   && d.sftp_password   !== maskChar) credsToEncrypt.sftp_password   = d.sftp_password;
      if (d.ssh_private_key && d.ssh_private_key !== maskChar) credsToEncrypt.ssh_private_key = d.ssh_private_key;
    }

    const encrypted = encryptAES(JSON.stringify(credsToEncrypt));

    await pool.query(
      `INSERT INTO sdd_emissor_configs
         (school_id, creditor_id, creditor_name, creditor_iban, creditor_bic,
          sequence_type, sftp_host, sftp_port, sftp_user,
          sftp_outbox_path, sftp_inbox_path,
          creds_iv, creds_tag, creds_ct, actualizado_em)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
       ON CONFLICT (school_id) DO UPDATE SET
         creditor_id       = EXCLUDED.creditor_id,
         creditor_name     = EXCLUDED.creditor_name,
         creditor_iban     = EXCLUDED.creditor_iban,
         creditor_bic      = EXCLUDED.creditor_bic,
         sequence_type     = EXCLUDED.sequence_type,
         sftp_host         = EXCLUDED.sftp_host,
         sftp_port         = EXCLUDED.sftp_port,
         sftp_user         = EXCLUDED.sftp_user,
         sftp_outbox_path  = EXCLUDED.sftp_outbox_path,
         sftp_inbox_path   = EXCLUDED.sftp_inbox_path,
         creds_iv          = EXCLUDED.creds_iv,
         creds_tag         = EXCLUDED.creds_tag,
         creds_ct          = EXCLUDED.creds_ct,
         actualizado_em    = NOW()`,
      [schoolId, d.creditor_id, d.creditor_name, d.creditor_iban, d.creditor_bic,
       d.sequence_type, d.sftp_host, d.sftp_port, d.sftp_user,
       d.sftp_outbox_path, d.sftp_inbox_path,
       encrypted.iv, encrypted.tag, encrypted.ciphertext]
    );

    return res.json({ success: true });
  } catch (e) {
    console.error("[sdd-config PUT]", e);
    return res.status(500).json({ error: "Erro ao guardar configuração SDD." });
  }
});

/* ─── GET /admin/colegios/:id/sdd/batches ─────────────────────────────────── */

router.get("/admin/colegios/:id/sdd/batches", adminAuth, async (req, res) => {
  try {
    const schoolId = Number(req.params.id);
    if (!schoolId) return res.status(400).json({ error: "school_id inválido." });

    const { rows } = await pool.query(
      `SELECT id, batch_ref, total_records, total_amount, status, created_at, submitted_at
       FROM dd_pain008_batches WHERE school_id=$1 ORDER BY created_at DESC LIMIT 50`,
      [schoolId]
    );
    return res.json({ batches: rows });
  } catch (e) {
    console.error("[sdd/batches GET]", e);
    return res.status(500).json({ error: "Erro ao carregar lotes SDD." });
  }
});

/* ─── POST /admin/colegios/:id/sdd/generate-batch ─────────────────────────── */

router.post("/admin/colegios/:id/sdd/generate-batch", adminAuth, async (req, res) => {
  try {
    const schoolId = Number(req.params.id);
    if (!schoolId) return res.status(400).json({ error: "school_id inválido." });

    const { collection_date, max_batch = 500 } = req.body as {
      collection_date?: string;
      max_batch?: number;
    };
    if (!collection_date) return res.status(400).json({ error: "collection_date obrigatório (YYYY-MM-DD)." });

    /* Buscar configuração do emissor */
    const cfgR = await pool.query(
      `SELECT creditor_id, creditor_name, creditor_iban, creditor_bic, sequence_type
       FROM sdd_emissor_configs WHERE school_id=$1`,
      [schoolId]
    );
    if (!cfgR.rows.length) {
      return res.status(400).json({ error: "Configuração SDD não encontrada. Configure o Emissor primeiro." });
    }
    const cfg = cfgR.rows[0];
    if (!cfg.creditor_iban) return res.status(400).json({ error: "IBAN do credor não configurado." });
    if (!cfg.creditor_bic)  return res.status(400).json({ error: "BIC do credor não configurado." });

    /* Buscar instruções PENDING para esta data */
    const instrR = await pool.query(
      `SELECT i.*, m.iban AS debtor_iban, m.bic AS debtor_bic,
              m.reference AS mandate_ref, m.created_at AS mandate_signed_date,
              m.frst_sent_at, m.pre_notif_sent_at,
              e.nome AS debtor_name
       FROM dd_instructions i
       JOIN dd_mandates m ON m.id=i.mandate_id
       JOIN encarregados e ON e.id=m.encarregado_id
       WHERE m.school_id=$1 AND i.status='PENDING'
         AND i.requested_collection_date=$2 AND m.status='ACTV'
       ORDER BY i.created_at LIMIT $3`,
      [schoolId, collection_date, max_batch]
    );

    if (!instrR.rows.length) {
      return res.status(404).json({
        error: `Nenhuma instrução PENDING encontrada para ${collection_date}.`,
        hint: "Verifique se existem mandatos activos com instruções agendadas para esta data.",
      });
    }

    const errors: string[] = [];
    const valid: any[]      = [];

    for (const instr of instrR.rows) {
      if (!validateIban(instr.debtor_iban)) {
        errors.push(`IBAN inválido: mandato ${instr.mandate_ref} (${instr.debtor_iban})`); continue;
      }
      if (!instr.debtor_bic || !validateBic(instr.debtor_bic)) {
        errors.push(`BIC inválido: mandato ${instr.mandate_ref}`); continue;
      }
      if (parseFloat(instr.amount) <= 0) {
        errors.push(`Valor inválido: mandato ${instr.mandate_ref}`); continue;
      }
      if (instr.sequence_type === "FRST" && !instr.pre_notif_sent_at) {
        errors.push(`FRST bloqueado (sem pré-notificação enviada): ${instr.mandate_ref}`); continue;
      }
      if (instr.sequence_type === "FRST" && instr.frst_sent_at) {
        errors.push(`FRST já enviado anteriormente: ${instr.mandate_ref}`); continue;
      }
      valid.push(instr);
    }

    if (!valid.length) {
      return res.status(400).json({ error: "Nenhuma instrução válida após validação.", validation_errors: errors });
    }

    const batchRef     = generateRef("SDD");
    const seqType      = cfg.sequence_type ?? "RCUR";
    const toDateStr    = (d: Date) => d.toISOString().slice(0, 10);
    const instructions: Pain008Instruction[] = valid.map(i => ({
      instruction_id:            i.instruction_id,
      end_to_end_id:             i.end_to_end_id,
      mandate_id_ref:            i.mandate_ref,
      mandate_signed_date:       toDateStr(new Date(i.mandate_signed_date)),
      sequence_type:             i.sequence_type ?? seqType,
      amount:                    parseFloat(i.amount),
      debtor_name:               i.debtor_name,
      debtor_iban:               i.debtor_iban,
      debtor_bic:                i.debtor_bic,
      requested_collection_date: collection_date,
    }));

    const xml         = buildPain008Xml(batchRef, cfg.creditor_id, cfg.creditor_name, cfg.creditor_iban, cfg.creditor_bic, seqType, instructions);
    const xmlErrors   = validatePain008Xml(xml);
    if (xmlErrors.length) {
      return res.status(422).json({ error: "XML inválido segundo o esquema pain.008.001.02.", xml_errors: xmlErrors });
    }

    const totalAmount = instructions.reduce((s, i) => s + i.amount, 0);

    /* Guardar batch */
    const batchR = await pool.query(
      `INSERT INTO dd_pain008_batches (batch_ref, school_id, total_records, total_amount, xml_content, status)
       VALUES ($1,$2,$3,$4,$5,'DRAFT') RETURNING id`,
      [batchRef, schoolId, instructions.length, totalAmount, xml]
    );
    const batchId = batchR.rows[0].id as number;

    /* Associar instruções ao batch */
    for (const instr of valid) {
      await pool.query(
        `UPDATE dd_instructions SET pain008_batch_id=$1 WHERE id=$2`,
        [batchId, instr.id]
      );
    }

    return res.status(201).json({
      ok: true,
      batch_id:          batchId,
      batch_ref:         batchRef,
      total_records:     instructions.length,
      total_amount:      totalAmount,
      validation_errors: errors,
      xml,
    });
  } catch (e: any) {
    console.error("[sdd/generate-batch]", e);
    return res.status(500).json({ error: e.message ?? "Erro ao gerar lote SDD." });
  }
});

/* ─── GET /admin/colegios/:id/sdd/batches/:bid/download ───────────────────── */

router.get("/admin/colegios/:id/sdd/batches/:bid/download", adminAuth, async (req, res) => {
  try {
    const schoolId = Number(req.params.id);
    const batchId  = Number(req.params.bid);
    if (!schoolId || !batchId) return res.status(400).json({ error: "Parâmetros inválidos." });

    const { rows } = await pool.query(
      `SELECT batch_ref, xml_content FROM dd_pain008_batches WHERE id=$1 AND school_id=$2`,
      [batchId, schoolId]
    );
    if (!rows.length) return res.status(404).json({ error: "Lote não encontrado." });
    if (!rows[0].xml_content) return res.status(404).json({ error: "XML não disponível para este lote." });

    const filename = `${rows[0].batch_ref}.xml`;
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(rows[0].xml_content);
  } catch (e) {
    console.error("[sdd/download]", e);
    return res.status(500).json({ error: "Erro ao descarregar XML." });
  }
});

/* ─── POST /admin/colegios/:id/sdd/batches/:bid/submit ────────────────────── */

router.post("/admin/colegios/:id/sdd/batches/:bid/submit", adminAuth, async (req, res) => {
  try {
    const schoolId = Number(req.params.id);
    const batchId  = Number(req.params.bid);
    if (!schoolId || !batchId) return res.status(400).json({ error: "Parâmetros inválidos." });

    /* Verificar que o batch existe e pertence à escola */
    const batchR = await pool.query(
      `SELECT batch_ref, xml_content, status FROM dd_pain008_batches WHERE id=$1 AND school_id=$2`,
      [batchId, schoolId]
    );
    if (!batchR.rows.length) return res.status(404).json({ error: "Lote não encontrado." });
    if (batchR.rows[0].status === "SUBMITTED") return res.status(400).json({ error: "Lote já submetido anteriormente." });
    if (!batchR.rows[0].xml_content) return res.status(400).json({ error: "XML em falta no lote." });

    /* Buscar configuração SFTP */
    const cfgR = await pool.query(
      `SELECT sftp_host, sftp_port, sftp_user, sftp_outbox_path, creds_iv, creds_tag, creds_ct
       FROM sdd_emissor_configs WHERE school_id=$1`,
      [schoolId]
    );
    if (!cfgR.rows.length) return res.status(400).json({ error: "Configuração SDD não encontrada." });

    const cfg = cfgR.rows[0];
    if (!cfg.sftp_host) return res.status(400).json({ error: "Host SFTP não configurado." });

    /* Decifrar credenciais */
    let creds: SftpCreds = {};
    if (cfg.creds_iv && cfg.creds_tag && cfg.creds_ct) {
      try {
        const plain = decryptAES({ iv: cfg.creds_iv, tag: cfg.creds_tag, ciphertext: cfg.creds_ct });
        creds = JSON.parse(plain);
      } catch { return res.status(500).json({ error: "Erro ao decifrar credenciais SFTP." }); }
    }

    const filename    = `${batchR.rows[0].batch_ref}.xml`;
    const remotePath  = `${cfg.sftp_outbox_path}/${filename}`.replace("//", "/");
    const started     = Date.now();

    /* Ligar ao SFTP e fazer upload */
    const conn = await sftpConnect(cfg.sftp_host, cfg.sftp_port, cfg.sftp_user, creds);
    try {
      await sftpPutFile(conn, remotePath, batchR.rows[0].xml_content);
    } finally {
      conn.end();
    }

    /* Marcar batch como SUBMITTED */
    await pool.query(
      `UPDATE dd_pain008_batches SET status='SUBMITTED', submitted_at=NOW() WHERE id=$1`,
      [batchId]
    );

    return res.json({
      success:      true,
      mensagem:     `Ficheiro ${filename} submetido com sucesso.`,
      remote_path:  remotePath,
      latencia_ms:  Date.now() - started,
    });
  } catch (e: any) {
    console.error("[sdd/submit]", e);
    return res.status(502).json({
      success: false,
      error:   `Falha na submissão SFTP: ${e.message}`,
      hint:    "Verifique o host, porta, utilizador e credenciais SFTP na aba Emissor.",
    });
  }
});

/* ─── POST /admin/colegios/:id/sdd/test-connection ────────────────────────── */

router.post("/admin/colegios/:id/sdd/test-connection", adminAuth, async (req, res) => {
  try {
    const schoolId = Number(req.params.id);
    if (!schoolId) return res.status(400).json({ error: "school_id inválido." });

    const cfgR = await pool.query(
      `SELECT sftp_host, sftp_port, sftp_user, sftp_outbox_path, sftp_inbox_path,
              creds_iv, creds_tag, creds_ct
       FROM sdd_emissor_configs WHERE school_id=$1`,
      [schoolId]
    );
    if (!cfgR.rows.length) return res.status(404).json({ error: "Configuração SDD não encontrada. Configure o Emissor primeiro." });

    const cfg = cfgR.rows[0];
    if (!cfg.sftp_host) return res.status(400).json({ error: "Host SFTP não configurado." });

    let creds: SftpCreds = {};
    if (cfg.creds_iv && cfg.creds_tag && cfg.creds_ct) {
      try {
        const plain = decryptAES({ iv: cfg.creds_iv, tag: cfg.creds_tag, ciphertext: cfg.creds_ct });
        creds = JSON.parse(plain);
      } catch { return res.status(500).json({ error: "Erro ao decifrar credenciais." }); }
    }

    const started = Date.now();

    /* Ligar, autenticar e verificar directorias */
    const conn = await sftpConnect(cfg.sftp_host, cfg.sftp_port, cfg.sftp_user, creds);
    let dirs: { outbox: boolean; inbox: boolean } = { outbox: false, inbox: false };
    try {
      dirs = await sftpTestPaths(conn, cfg.sftp_outbox_path, cfg.sftp_inbox_path);
    } finally {
      conn.end();
    }

    const warnings: string[] = [];
    if (!dirs.outbox) warnings.push(`Directório de envio (outbox) não encontrado: ${cfg.sftp_outbox_path}`);
    if (!dirs.inbox)  warnings.push(`Directório de recepção (inbox) não encontrado: ${cfg.sftp_inbox_path}`);

    return res.json({
      success:     true,
      mensagem:    `Autenticado no SFTP com sucesso em ${cfg.sftp_host}:${cfg.sftp_port}.`,
      host:        cfg.sftp_host,
      port:        cfg.sftp_port,
      outbox_ok:   dirs.outbox,
      inbox_ok:    dirs.inbox,
      warnings,
      latencia_ms: Date.now() - started,
    });
  } catch (e: any) {
    console.error("[sdd/test-connection]", e);
    return res.status(502).json({
      success: false,
      erro:    e.message ?? "Falha na ligação SFTP.",
      hint:    "Verifique sftp_host, sftp_port, utilizador e password/chave SSH.",
    });
  }
});

/* ─── GET /admin/sdd/engine-rules ─────────────────────────────────────────── */

router.get("/admin/sdd/engine-rules", adminAuth, async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM sdd_engine_rules WHERE id=1");
    return res.json({ rules: rows[0] ?? null });
  } catch (e) {
    console.error("[sdd/engine-rules GET]", e);
    return res.status(500).json({ error: "Erro ao carregar regras do motor SDD." });
  }
});

/* ─── PUT /admin/sdd/engine-rules ─────────────────────────────────────────── */

router.put("/admin/sdd/engine-rules", adminAuth, async (req, res) => {
  try {
    const b = req.body;
    const codigosJson = JSON.stringify(Array.isArray(b.codigos_rejeicao) ? b.codigos_rejeicao : []);

    const updated = await pool.query(`
      UPDATE sdd_engine_rules SET
        prenotif_activo           = $1,
        prenotif_horas_antes      = $2,
        prenotif_email            = $3,
        prenotif_sms              = $4,
        prenotif_push             = $5,
        exec_auto_transicao       = $6,
        exec_bloquear_canais      = $7,
        falha_max_consecutivas    = $8,
        falha_suspender           = $9,
        falha_reativar_manual     = $10,
        recon_auto_processar      = $11,
        recon_idempotency_horas   = $12,
        sucesso_marcar_pago       = $13,
        sucesso_gerar_recibo      = $14,
        sucesso_email_confirmacao = $15,
        falha_marcar_vencido      = $16,
        falha_aplicar_multa       = $17,
        falha_email_aviso         = $18,
        codigos_rejeicao          = $19::jsonb,
        actualizado_em            = NOW(),
        actualizado_por           = 'admin'
      WHERE id = 1
      RETURNING id
    `, [
      Boolean(b.prenotif_activo),
      Math.max(1, Math.min(72,  Number(b.prenotif_horas_antes) || 24)),
      Boolean(b.prenotif_email),
      Boolean(b.prenotif_sms),
      Boolean(b.prenotif_push),
      Boolean(b.exec_auto_transicao),
      Boolean(b.exec_bloquear_canais),
      Math.max(1, Math.min(10,  Number(b.falha_max_consecutivas) || 3)),
      Boolean(b.falha_suspender),
      Boolean(b.falha_reativar_manual),
      Boolean(b.recon_auto_processar),
      Math.max(1, Math.min(168, Number(b.recon_idempotency_horas) || 48)),
      Boolean(b.sucesso_marcar_pago),
      Boolean(b.sucesso_gerar_recibo),
      Boolean(b.sucesso_email_confirmacao),
      Boolean(b.falha_marcar_vencido),
      Boolean(b.falha_aplicar_multa),
      Boolean(b.falha_email_aviso),
      codigosJson,
    ]);

    if (!updated.rowCount) {
      return res.status(404).json({ error: "Registo de regras não encontrado (id=1)." });
    }

    console.log("[sdd/engine-rules] regras actualizadas pelo admin");
    return res.json({ ok: true });
  } catch (e) {
    console.error("[sdd/engine-rules PUT]", e);
    return res.status(500).json({ error: "Erro ao guardar regras do motor SDD." });
  }
});

export default router;
