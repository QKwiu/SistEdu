/**
 * PROPINAPLUS — Motor de Débito Directo
 * ======================================
 * Implementa as regras ISO 20022 PAIN.008 / PAIN.002 adaptadas ao
 * ecossistema bancário angolano (EMIS / BNA).
 *
 * Secções:
 *  1. Migração de base de dados
 *  2. Utilitários (dias úteis, feriados Angola)
 *  3. Máquina de estados do mandato
 *  4. Sequência de cobrança (FRST / RCUR / FNAL / OOFF)
 *  5. Janela de submissão
 *  6. Pré-notificação (FCM + SMS)
 *  7. Reapresentação automática
 *  8. Gerador PAIN.008
 *  9. Reconciliação PAIN.002
 * 10. Jobs diários
 * 11. Rotas REST (guardian · escola · admin)
 */

import { Router, type Request, type Response, type NextFunction } from "express";
import { toError } from "../lib/errors";
import crypto from "crypto";
import { decodeSecret } from "../lib/crypto.js";
import { pool } from "@workspace/db";
import { sendSMS } from "../services/sms.service";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// §1  MIGRAÇÃO DE BASE DE DADOS
// ─────────────────────────────────────────────────────────────────────────────

export async function runDirectDebitMigration(): Promise<void> {
  await pool.query(`
    -- Feriados nacionais angolanos (tabela permanente, recarregável)
    CREATE TABLE IF NOT EXISTS dd_angola_feriados (
      id    SERIAL PRIMARY KEY,
      data  DATE NOT NULL UNIQUE,
      nome  VARCHAR(100) NOT NULL
    );

    -- Mandatos de débito directo (substitui direct_debit_subscriptions, mantém compatibilidade)
    CREATE TABLE IF NOT EXISTS dd_mandates (
      id                   SERIAL PRIMARY KEY,
      reference            VARCHAR(35) UNIQUE NOT NULL,   -- MandateID para PAIN.008
      encarregado_id       INTEGER NOT NULL,
      school_id            INTEGER NOT NULL,
      status               VARCHAR(10) NOT NULL DEFAULT 'PENDING'
                             CHECK (status IN ('PENDING','ACTV','SUSP','CANC','EXPRD')),
      iban                 VARCHAR(34) NOT NULL,          -- AO06 + 21 dígitos
      bic                  VARCHAR(11),
      emolumentos          JSONB NOT NULL DEFAULT '["propina"]',
      debit_day            INTEGER NOT NULL DEFAULT 5 CHECK (debit_day BETWEEN 1 AND 28),
      email                VARCHAR(255),
      sequence_type        VARCHAR(4) NOT NULL DEFAULT 'RCUR'
                             CHECK (sequence_type IN ('FRST','RCUR','FNAL','OOFF')),
      frst_sent_at         TIMESTAMPTZ,                  -- data do primeiro FRST enviado
      last_collection_at   TIMESTAMPTZ,                  -- última cobrança com sucesso (para EXPRD)
      pre_notif_sent_at    TIMESTAMPTZ,                  -- pré-notificação obrigatória FRST
      pre_notif_days       INTEGER NOT NULL DEFAULT 14,  -- dias de antecedência (configurável)
      susp_at              TIMESTAMPTZ,                  -- quando entrou em SUSP
      susp_reason          VARCHAR(10),                  -- código de rejeição que causou SUSP
      canc_at              TIMESTAMPTZ,
      canc_reason          TEXT,
      exprd_at             TIMESTAMPTZ,
      created_at           TIMESTAMPTZ DEFAULT NOW(),
      updated_at           TIMESTAMPTZ DEFAULT NOW()
    );

    -- Instruções de cobrança (uma linha por tentativa de débito)
    CREATE TABLE IF NOT EXISTS dd_instructions (
      id                SERIAL PRIMARY KEY,
      mandate_id        INTEGER NOT NULL REFERENCES dd_mandates(id) ON DELETE CASCADE,
      instruction_id    VARCHAR(35) UNIQUE NOT NULL,     -- InstructionID único por ficheiro/credor
      end_to_end_id     VARCHAR(35) UNIQUE NOT NULL,     -- EndToEndID rastreável internamente
      sequence_type     VARCHAR(4) NOT NULL CHECK (sequence_type IN ('FRST','RCUR','FNAL','OOFF')),
      amount            NUMERIC(14,2) NOT NULL,
      currency          VARCHAR(3) NOT NULL DEFAULT 'AOA',
      requested_collection_date DATE NOT NULL,            -- data de débito solicitada
      submission_date   DATE,                            -- data de submissão ao banco
      pain008_batch_id  INTEGER,                        -- batch PAIN.008 que contém esta instrução
      status            VARCHAR(10) NOT NULL DEFAULT 'PENDING'
                          CHECK (status IN ('PENDING','SUBMITTED','ACSC','RJCT','RTRN')),
      rejection_code    VARCHAR(10),                     -- AC04, AC06, AM04, SL01, MS02, MD01, AG01…
      rejection_reason  TEXT,
      propina_id        INTEGER,                         -- propina associada
      reapresentacao_of INTEGER REFERENCES dd_instructions(id), -- original (se for reapresentação)
      reapresentacao_n  INTEGER NOT NULL DEFAULT 0,      -- 0=original, 1=1ª reap., 2=2ª reap.
      settled_at        TIMESTAMPTZ,
      created_at        TIMESTAMPTZ DEFAULT NOW()
    );

    -- Auditoria de transições de estado do mandato
    CREATE TABLE IF NOT EXISTS dd_audit_log (
      id              SERIAL PRIMARY KEY,
      mandate_id      INTEGER NOT NULL REFERENCES dd_mandates(id) ON DELETE CASCADE,
      estado_anterior VARCHAR(10),
      estado_novo     VARCHAR(10) NOT NULL,
      motivo          TEXT,
      origem          VARCHAR(20) NOT NULL DEFAULT 'sistema'
                        CHECK (origem IN ('sistema','utilizador','EMIS','admin','job')),
      instruction_id  INTEGER REFERENCES dd_instructions(id),
      timestamp       TIMESTAMPTZ DEFAULT NOW()
    );

    -- Registo de pré-notificações enviadas
    CREATE TABLE IF NOT EXISTS dd_pre_notifications (
      id            SERIAL PRIMARY KEY,
      mandate_id    INTEGER NOT NULL REFERENCES dd_mandates(id) ON DELETE CASCADE,
      canal         VARCHAR(10) NOT NULL CHECK (canal IN ('SMS','FCM','EMAIL')),
      estado_envio  VARCHAR(10) NOT NULL DEFAULT 'SENT' CHECK (estado_envio IN ('SENT','FAILED','CONFIRMED')),
      conteudo      TEXT,
      data_envio    TIMESTAMPTZ DEFAULT NOW(),
      provider_ref  TEXT
    );

    -- Batches PAIN.008 gerados
    CREATE TABLE IF NOT EXISTS dd_pain008_batches (
      id              SERIAL PRIMARY KEY,
      batch_ref       VARCHAR(35) UNIQUE NOT NULL,
      school_id       INTEGER NOT NULL,
      total_records   INTEGER NOT NULL DEFAULT 0,
      total_amount    NUMERIC(16,2) NOT NULL DEFAULT 0,
      xml_content     TEXT,
      status          VARCHAR(15) NOT NULL DEFAULT 'DRAFT'
                        CHECK (status IN ('DRAFT','SUBMITTED','PROCESSED','ERROR')),
      submitted_at    TIMESTAMPTZ,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    );

    -- Relatórios de reconciliação diária
    CREATE TABLE IF NOT EXISTS dd_reconciliation_reports (
      id              SERIAL PRIMARY KEY,
      report_date     DATE NOT NULL UNIQUE,
      school_id       INTEGER,
      total_enviado   INTEGER DEFAULT 0,
      total_aceite    INTEGER DEFAULT 0,
      total_rejeitado INTEGER DEFAULT 0,
      total_pendente  INTEGER DEFAULT 0,
      total_devolvido INTEGER DEFAULT 0,
      pain002_raw     TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    );

    -- Índices de performance
    CREATE INDEX IF NOT EXISTS idx_dd_mandates_encarregado  ON dd_mandates(encarregado_id);
    CREATE INDEX IF NOT EXISTS idx_dd_mandates_school       ON dd_mandates(school_id);
    CREATE INDEX IF NOT EXISTS idx_dd_mandates_status       ON dd_mandates(status);
    CREATE INDEX IF NOT EXISTS idx_dd_instructions_mandate  ON dd_instructions(mandate_id);
    CREATE INDEX IF NOT EXISTS idx_dd_instructions_status   ON dd_instructions(status);
    CREATE INDEX IF NOT EXISTS idx_dd_instructions_date     ON dd_instructions(requested_collection_date);
    CREATE INDEX IF NOT EXISTS idx_dd_audit_mandate         ON dd_audit_log(mandate_id);
  `);

  // Seed feriados angolanos (anos 2024-2026)
  await pool.query(`
    INSERT INTO dd_angola_feriados (data, nome) VALUES
      ('2024-01-01','Ano Novo'), ('2024-02-04','Dia da Libertação Nacional'),
      ('2024-03-08','Dia Internacional da Mulher'), ('2024-04-04','Dia da Paz e Reconciliação'),
      ('2024-04-05','Sexta-Feira Santa'), ('2024-05-01','Dia do Trabalhador'),
      ('2024-06-01','Dia da Criança'), ('2024-09-17','Dia do Herói Nacional'),
      ('2024-11-02','Dia dos Finados'), ('2024-11-11','Dia da Independência Nacional'),
      ('2024-12-25','Natal'),
      ('2025-01-01','Ano Novo'), ('2025-02-04','Dia da Libertação Nacional'),
      ('2025-03-08','Dia Internacional da Mulher'), ('2025-04-04','Dia da Paz e Reconciliação'),
      ('2025-04-18','Sexta-Feira Santa'), ('2025-05-01','Dia do Trabalhador'),
      ('2025-06-01','Dia da Criança'), ('2025-09-17','Dia do Herói Nacional'),
      ('2025-11-02','Dia dos Finados'), ('2025-11-11','Dia da Independência Nacional'),
      ('2025-12-25','Natal'),
      ('2026-01-01','Ano Novo'), ('2026-02-04','Dia da Libertação Nacional'),
      ('2026-03-08','Dia Internacional da Mulher'), ('2026-04-04','Dia da Paz e Reconciliação'),
      ('2026-04-03','Sexta-Feira Santa'), ('2026-05-01','Dia do Trabalhador'),
      ('2026-06-01','Dia da Criança'), ('2026-09-17','Dia do Herói Nacional'),
      ('2026-11-02','Dia dos Finados'), ('2026-11-11','Dia da Independência Nacional'),
      ('2026-12-25','Natal')
    ON CONFLICT (data) DO NOTHING
  `);

  console.log("[dd] migration + feriados ok");
}

// ─────────────────────────────────────────────────────────────────────────────
// §2  UTILITÁRIOS — DIAS ÚTEIS & FERIADOS ANGOLA
// ─────────────────────────────────────────────────────────────────────────────

async function getHolidays(): Promise<Set<string>> {
  const r = await pool.query("SELECT data FROM dd_angola_feriados");
  return new Set(r.rows.map((row: any) => row.data.toISOString().slice(0, 10)));
}

function isWeekend(date: Date): boolean {
  const d = date.getDay();
  return d === 0 || d === 6;
}

async function isBusinessDay(date: Date): Promise<boolean> {
  if (isWeekend(date)) return false;
  const holidays = await getHolidays();
  return !holidays.has(date.toISOString().slice(0, 10));
}

async function addBusinessDays(start: Date, days: number): Promise<Date> {
  const holidays = await getHolidays();
  let count = 0;
  const cur = new Date(start);
  while (count < days) {
    cur.setDate(cur.getDate() + 1);
    if (!isWeekend(cur) && !holidays.has(cur.toISOString().slice(0, 10))) count++;
  }
  return cur;
}

async function subtractBusinessDays(start: Date, days: number): Promise<Date> {
  const holidays = await getHolidays();
  let count = 0;
  const cur = new Date(start);
  while (count < days) {
    cur.setDate(cur.getDate() - 1);
    if (!isWeekend(cur) && !holidays.has(cur.toISOString().slice(0, 10))) count++;
  }
  return cur;
}

async function nextBusinessDay(date: Date): Promise<Date> {
  const holidays = await getHolidays();
  const cur = new Date(date);
  while (isWeekend(cur) || holidays.has(cur.toISOString().slice(0, 10))) {
    cur.setDate(cur.getDate() + 1);
  }
  return cur;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function generateRef(prefix: string): string {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// §3  MÁQUINA DE ESTADOS DO MANDATO
// ─────────────────────────────────────────────────────────────────────────────

type MandateStatus = "PENDING" | "ACTV" | "SUSP" | "CANC" | "EXPRD";
type AuditOrigin   = "sistema" | "utilizador" | "EMIS" | "admin" | "job";

async function transitionMandate(
  mandateId: number,
  newStatus: MandateStatus,
  reason: string,
  origem: AuditOrigin,
  instrId?: number
): Promise<void> {
  const cur = await pool.query("SELECT status FROM dd_mandates WHERE id=$1", [mandateId]);
  if (!cur.rows.length) throw new Error(`Mandato ${mandateId} não encontrado`);
  const oldStatus: MandateStatus = cur.rows[0].status;

  // Validar transições permitidas
  const allowed: Record<MandateStatus, MandateStatus[]> = {
    PENDING: ["ACTV", "CANC"],
    ACTV:    ["SUSP", "CANC", "EXPRD"],
    SUSP:    ["ACTV", "CANC"],
    CANC:    [],
    EXPRD:   [],
  };
  if (!allowed[oldStatus].includes(newStatus))
    throw new Error(`Transição inválida: ${oldStatus} → ${newStatus}`);

  const now = new Date();
  const extra: Record<string, any> = { updated_at: now };
  if (newStatus === "SUSP") { extra.susp_at = now; extra.susp_reason = reason; }
  if (newStatus === "CANC") { extra.canc_at = now; extra.canc_reason = reason; }
  if (newStatus === "EXPRD") extra.exprd_at = now;
  if (newStatus === "ACTV" && oldStatus === "PENDING") extra.activated_at = now;

  const setClauses = Object.keys(extra).map((k, i) => `${k}=$${i + 2}`).join(", ");
  const vals = [mandateId, ...Object.values(extra)];
  await pool.query(`UPDATE dd_mandates SET status='${newStatus}', ${setClauses} WHERE id=$1`, vals);

  // Auditoria
  await pool.query(
    `INSERT INTO dd_audit_log (mandate_id, estado_anterior, estado_novo, motivo, origem, instruction_id)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [mandateId, oldStatus, newStatus, reason, origem, instrId ?? null]
  );

  console.log(`[dd:state] mandato #${mandateId} ${oldStatus} → ${newStatus} (${origem}): ${reason}`);
}

// Processar rejeição: determinar transição de estado pelo código
async function processRejectionCode(
  mandateId: number,
  rejectionCode: string,
  instrId: number
): Promise<void> {
  const SUSP_CODES = ["AC06", "SL01", "MS02"];   // conta bloqueada, embargo, dados inválidos
  const CANC_CODES = ["AC04", "AG01", "MD01"];   // conta encerrada, proibido, mandato inválido

  if (SUSP_CODES.includes(rejectionCode)) {
    await transitionMandate(mandateId, "SUSP", `Rejeição automática: ${rejectionCode}`, "EMIS", instrId);
    await notifySchoolAdmin(mandateId, `Mandato suspenso por rejeição EMIS: ${rejectionCode}`);
  } else if (CANC_CODES.includes(rejectionCode)) {
    await transitionMandate(mandateId, "CANC", `Rejeição automática: ${rejectionCode}`, "EMIS", instrId);
    await notifySchoolAdmin(mandateId, `Mandato cancelado por rejeição EMIS: ${rejectionCode}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// §4  SEQUÊNCIA DE COBRANÇA
// ─────────────────────────────────────────────────────────────────────────────

async function determineNextSequence(mandateId: number): Promise<"FRST" | "RCUR" | "FNAL" | "OOFF"> {
  const r = await pool.query(
    `SELECT sequence_type, frst_sent_at FROM dd_mandates WHERE id=$1`,
    [mandateId]
  );
  if (!r.rows.length) throw new Error("Mandato não encontrado");
  const { sequence_type, frst_sent_at } = r.rows[0];

  // OOFF: cobrança única (nunca muda)
  if (sequence_type === "OOFF") return "OOFF";
  // FNAL: última cobrança programada
  if (sequence_type === "FNAL") return "FNAL";
  // FRST: apenas se nunca foi enviado antes
  if (!frst_sent_at) return "FRST";
  // Todos os outros: RCUR
  return "RCUR";
}

async function afterInstructionSent(instrId: number, sequence: string): Promise<void> {
  const r = await pool.query("SELECT mandate_id FROM dd_instructions WHERE id=$1", [instrId]);
  const { mandate_id } = r.rows[0];

  if (sequence === "FRST") {
    await pool.query(
      "UPDATE dd_mandates SET frst_sent_at=NOW(), sequence_type='RCUR', updated_at=NOW() WHERE id=$1",
      [mandate_id]
    );
  }
  // Após FNAL ou OOFF → CANC automático
  if (sequence === "FNAL" || sequence === "OOFF") {
    await transitionMandate(mandate_id, "CANC", `Sequência ${sequence} concluída`, "sistema", instrId);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// §5  JANELA DE SUBMISSÃO
// ─────────────────────────────────────────────────────────────────────────────

const CUTOFF_HOUR = 17; // 17:00 Angola time (UTC+1)

async function calculateSubmissionDate(
  collectionDate: Date,
  sequenceType: string
): Promise<{ submissionDate: Date; adiar: boolean }> {
  // FRST → D-2 dias úteis; RCUR/FNAL → D-1 dia útil
  const daysBeforeRequired = sequenceType === "FRST" ? 2 : 1;
  const submissionDate = await subtractBusinessDays(collectionDate, daysBeforeRequired);

  const nowAngola = new Date(Date.now() + 60 * 60 * 1000); // UTC+1
  const cutoff = new Date(submissionDate);
  cutoff.setHours(CUTOFF_HOUR, 0, 0, 0);

  const adiar = nowAngola > cutoff;
  return { submissionDate, adiar };
}

// ─────────────────────────────────────────────────────────────────────────────
// §6  PRÉ-NOTIFICAÇÃO (FCM + SMS)
// ─────────────────────────────────────────────────────────────────────────────

async function getFcmConfig() {
  const r = await pool.query("SELECT value FROM platform_config WHERE key='fcm_config'");
  const raw = r.rows[0]?.value ?? null;
  if (!raw) return null;
  return decryptFcmConfigCreds(raw);
}

function decryptFcmConfigCreds(config: Record<string, any>): Record<string, any> {
  const ENV_KEYS = ["test", "production", "staging", "dev"];
  const out = { ...config };
  for (const env of ENV_KEYS) {
    const creds = out[env];
    if (!creds || typeof creds !== "object") continue;
    const pk = creds.private_key as string | undefined;
    if (pk && typeof pk === "string" && pk !== "***") {
      try { out[env] = { ...creds, private_key: decodeSecret(pk) }; } catch { /* mantém original */ }
    }
  }
  return out;
}

async function sendFcmToGuardian(
  guardianId: number,
  schoolId: number,
  title: string,
  body: string
): Promise<void> {
  try {
    const cfg = await getFcmConfig();
    if (!cfg) return;
    const env = cfg.active_env ?? "test";
    const creds = cfg[env];
    if (!creds?.project_id || !creds?.private_key) return;

    const tokensR = await pool.query(
      "SELECT token FROM fcm_device_tokens WHERE user_type='guardian' AND user_id=$1 AND school_id=$2",
      [guardianId, schoolId]
    );
    if (!tokensR.rows.length) return;

    // Import getFcmAccessToken logic inline (to avoid circular dependency)
    const now = Math.floor(Date.now() / 1000);
    const hdr = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
    const pay = Buffer.from(JSON.stringify({
      iss: creds.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
    })).toString("base64url");
    const sigInput = `${hdr}.${pay}`;
    const sign = crypto.createSign("RSA-SHA256");
    sign.update(sigInput);
    const sig = sign.sign(creds.private_key.replace(/\\n/g, "\n")).toString("base64url");

    const oauthRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: `${sigInput}.${sig}`,
      }),
    });
    const oauthData = await oauthRes.json() as any;
    if (!oauthData.access_token) return;

    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${creds.project_id}/messages:send`;
    for (const { token } of tokensR.rows) {
      await fetch(fcmUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${oauthData.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: { token, notification: { title, body } } }),
      }).catch(() => {});
    }
  } catch (e) {
    console.error("[dd:fcm] erro:", e);
  }
}

async function sendPreNotification(mandateId: number): Promise<void> {
  const r = await pool.query(
    `SELECT m.*, e.nome, e.telefone, e.email AS enc_email,
            s.name AS escola_nome,
            pc.value AS dd_config
     FROM dd_mandates m
     JOIN encarregados e ON e.id = m.encarregado_id
     JOIN schools s ON s.id = m.school_id
     LEFT JOIN platform_config pc ON pc.key='parametrizacao'
     WHERE m.id=$1`,
    [mandateId]
  );
  if (!r.rows.length) throw new Error("Mandato não encontrado");
  const m = r.rows[0];

  const nextDebitDate = nextCollectionDate(m.debit_day);
  const dateStr = nextDebitDate.toLocaleDateString("pt-AO", { day: "2-digit", month: "long", year: "numeric" });

  const msg = `PropinaPlus - Débito Directo: A ${m.escola_nome} irá debitar a sua conta IBAN terminada em ${m.iban.slice(-4)} no valor a definir na data ${dateStr}. Ref. mandato: ${m.reference}. Em caso de dúvida contacte o secretariado.`;

  // Enviar SMS
  let smsResult = { success: false, messageId: undefined as string | undefined };
  if (m.telefone) {
    try {
      const smsConfig = { provider: "generic", api_url: "", api_key: "", sender_name: "PropinaPlus" };
      smsResult = await sendSMS(m.telefone, msg, smsConfig, m.school_id, "manual", `dd-prenotif-${mandateId}`);
    } catch (e) {
      console.error("[dd:pre-notif:sms]", e);
    }
    await pool.query(
      `INSERT INTO dd_pre_notifications (mandate_id, canal, estado_envio, conteudo, provider_ref)
       VALUES ($1,'SMS',$2,$3,$4)`,
      [mandateId, smsResult.success ? "SENT" : "FAILED", msg, smsResult.messageId ?? null]
    );
  }

  // Enviar FCM push
  await sendFcmToGuardian(
    m.encarregado_id, m.school_id,
    "📋 Aviso de Débito Directo",
    `O ${m.escola_nome} irá debitar a sua conta em ${dateStr}. Ref: ${m.reference}`
  );
  await pool.query(
    `INSERT INTO dd_pre_notifications (mandate_id, canal, estado_envio, conteudo)
     VALUES ($1,'FCM','SENT',$2)`,
    [mandateId, msg]
  );

  // Marcar pré-notificação no mandato
  await pool.query(
    "UPDATE dd_mandates SET pre_notif_sent_at=NOW(), updated_at=NOW() WHERE id=$1",
    [mandateId]
  );

  console.log(`[dd:pre-notif] mandato #${mandateId} notificado (SMS: ${smsResult.success})`);
}

function nextCollectionDate(debitDay: number): Date {
  const now = new Date();
  let d = new Date(now.getFullYear(), now.getMonth(), debitDay);
  if (d <= now) d = new Date(now.getFullYear(), now.getMonth() + 1, debitDay);
  return d;
}

// ─────────────────────────────────────────────────────────────────────────────
// §7  REAPRESENTAÇÃO AUTOMÁTICA
// ─────────────────────────────────────────────────────────────────────────────

const MAX_REAPRESENTACOES = 2;
const REAPRESENTACAO_MIN_DIAS_UTEIS = 5;

async function scheduleReapresentacao(originalInstrId: number): Promise<void> {
  const r = await pool.query(
    `SELECT i.*, m.status AS mandate_status, m.school_id
     FROM dd_instructions i
     JOIN dd_mandates m ON m.id = i.mandate_id
     WHERE i.id=$1`,
    [originalInstrId]
  );
  if (!r.rows.length) return;
  const instr = r.rows[0];

  // Só AM04 (fundos insuficientes) permite reapresentação
  if (instr.rejection_code !== "AM04") return;

  // Verificar número máximo de tentativas
  if (instr.reapresentacao_n >= MAX_REAPRESENTACOES) {
    // Esgotar tentativas → suspender e notificar
    await transitionMandate(instr.mandate_id, "SUSP",
      `Esgotadas ${MAX_REAPRESENTACOES} reapresentações (AM04)`, "sistema", originalInstrId);
    await notifySchoolAdmin(instr.mandate_id, `Mandato suspenso após ${MAX_REAPRESENTACOES} reapresentações falhadas (AM04).`);
    return;
  }

  // Calcular data de reapresentação: D + 5 dias úteis
  const newCollDate = await addBusinessDays(new Date(), REAPRESENTACAO_MIN_DIAS_UTEIS);

  // Gerar nova instrução com mesmo MandateID, novo InstructionID
  const newInstrId = generateRef("REAP");
  const newE2eId   = generateRef("E2E");

  await pool.query(
    `INSERT INTO dd_instructions
       (mandate_id, instruction_id, end_to_end_id, sequence_type, amount, currency,
        requested_collection_date, status, reapresentacao_of, reapresentacao_n, propina_id)
     VALUES ($1,$2,$3,$4,$5,'AOA',$6,'PENDING',$7,$8,$9)`,
    [
      instr.mandate_id, newInstrId, newE2eId,
      instr.sequence_type, instr.amount,
      toDateStr(newCollDate),
      originalInstrId,
      instr.reapresentacao_n + 1,
      instr.propina_id,
    ]
  );

  console.log(`[dd:reapresentacao] mandato #${instr.mandate_id} → nova instrução em ${toDateStr(newCollDate)} (tentativa ${instr.reapresentacao_n + 1}/${MAX_REAPRESENTACOES})`);
}

// ─────────────────────────────────────────────────────────────────────────────
// §8  GERADOR PAIN.008 (ISO 20022)
// ─────────────────────────────────────────────────────────────────────────────

function validateIbanAngola(iban: string): boolean {
  // Angola: AO06 + 21 dígitos numéricos = 25 caracteres total
  return /^AO06\d{21}$/.test(iban.replace(/\s/g, ""));
}

function validateBic(bic: string): boolean {
  return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic);
}

interface Pain008Instruction {
  instruction_id:          string;
  end_to_end_id:           string;
  mandate_id_ref:          string;
  mandate_signed_date:     string;
  sequence_type:           string;
  amount:                  number;
  debtor_name:             string;
  debtor_iban:             string;
  debtor_bic:              string;
  requested_collection_date: string;
}

function buildPain008Xml(
  batchRef: string,
  creditorId: string,
  creditorName: string,
  creditorIban: string,
  creditorBic: string,
  instructions: Pain008Instruction[]
): string {
  const now = new Date().toISOString().replace("Z", "+00:00");
  const totalAmount = instructions.reduce((s, i) => s + i.amount, 0).toFixed(2);

  const txBlocks = instructions.map(i => `
      <DrctDbtTxInf>
        <PmtId>
          <InstrId>${escXml(i.instruction_id)}</InstrId>
          <EndToEndId>${escXml(i.end_to_end_id)}</EndToEndId>
        </PmtId>
        <InstdAmt Ccy="${"AOA"}">${i.amount.toFixed(2)}</InstdAmt>
        <DrctDbtTx>
          <MndtRltdInf>
            <MndtId>${escXml(i.mandate_id_ref)}</MndtId>
            <DtOfSgntr>${escXml(i.mandate_signed_date)}</DtOfSgntr>
            <SeqTp>${escXml(i.sequence_type)}</SeqTp>
          </MndtRltdInf>
        </DrctDbtTx>
        <DbtrAgt>
          <FinInstnId>
            <BIC>${escXml(i.debtor_bic)}</BIC>
          </FinInstnId>
        </DbtrAgt>
        <Dbtr>
          <Nm>${escXml(i.debtor_name)}</Nm>
        </Dbtr>
        <DbtrAcct>
          <Id><IBAN>${escXml(i.debtor_iban.replace(/\s/g, ""))}</IBAN></Id>
        </DbtrAcct>
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
        <Id><OrgId><Othr><Id>${escXml(creditorId)}</Id></Othr></OrgId></Id>
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
      </PmtTpInf>
      <ReqdColltnDt>${escXml(instructions[0]?.requested_collection_date ?? "")}</ReqdColltnDt>
      <Cdtr>
        <Nm>${escXml(creditorName)}</Nm>
      </Cdtr>
      <CdtrAcct>
        <Id><IBAN>${escXml(creditorIban)}</IBAN></Id>
      </CdtrAcct>
      <CdtrAgt>
        <FinInstnId><BIC>${escXml(creditorBic)}</BIC></FinInstnId>
      </CdtrAgt>${txBlocks}
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;
}

function escXml(s: string): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ─────────────────────────────────────────────────────────────────────────────
// §9  RECONCILIAÇÃO PAIN.002
// ─────────────────────────────────────────────────────────────────────────────

interface Pain002Entry {
  end_to_end_id: string;
  status: "ACSC" | "RJCT" | "RTRN";
  rejection_code?: string;
  rejection_reason?: string;
}

async function processPain002(entries: Pain002Entry[], reportDate: string, schoolId: number): Promise<{
  aceite: number; rejeitado: number; devolvido: number; pendente: number; erros: string[];
}> {
  let aceite = 0, rejeitado = 0, devolvido = 0;
  const erros: string[] = [];

  for (const entry of entries) {
    try {
      const r = await pool.query(
        "SELECT * FROM dd_instructions WHERE end_to_end_id=$1",
        [entry.end_to_end_id]
      );
      if (!r.rows.length) {
        erros.push(`EndToEndID não encontrado: ${entry.end_to_end_id}`);
        continue;
      }
      const instr = r.rows[0];

      await pool.query(
        `UPDATE dd_instructions
         SET status=$1, rejection_code=$2, rejection_reason=$3, settled_at=CASE WHEN $1='ACSC' THEN NOW() ELSE NULL END
         WHERE id=$4`,
        [entry.status, entry.rejection_code ?? null, entry.rejection_reason ?? null, instr.id]
      );

      if (entry.status === "ACSC") {
        aceite++;
        // Actualizar mandato: última cobrança com sucesso
        await pool.query(
          "UPDATE dd_mandates SET last_collection_at=NOW(), updated_at=NOW() WHERE id=$1",
          [instr.mandate_id]
        );
        // Marcar propina como paga
        if (instr.propina_id) {
          await pool.query(
            "UPDATE propinas SET status='pago', pago_em=NOW(), payment_channel='DIRECT_DEBIT' WHERE id=$1 AND status!='pago'",
            [instr.propina_id]
          );
        }
        // Notificação de confirmação FCM + SMS ao encarregado
        const mR = await pool.query(
          "SELECT encarregado_id, school_id, reference FROM dd_mandates WHERE id=$1",
          [instr.mandate_id]
        );
        if (mR.rows.length) {
          const { encarregado_id, school_id, reference } = mR.rows[0];
          await sendFcmToGuardian(encarregado_id, school_id,
            "✅ Débito Directo Confirmado",
            `Pagamento processado com sucesso. Ref: ${reference}`
          );
          // SMS de confirmação
          const encR = await pool.query("SELECT telefone FROM encarregados WHERE id=$1", [encarregado_id]);
          if (encR.rows[0]?.telefone) {
            const smsConfig = { provider: "generic", api_url: "", api_key: "", sender_name: "PropinaPlus" };
            await sendSMS(
              encR.rows[0].telefone,
              `PropinaPlus: Débito Directo processado com sucesso. Valor: ${instr.amount} AOA. Ref: ${reference}.`,
              smsConfig, school_id, "pagamento_confirmado", `dd-acsc-${instr.id}`
            ).catch(() => {});
          }
        }
      } else if (entry.status === "RJCT") {
        rejeitado++;
        // Processar rejeição → máquina de estados
        if (entry.rejection_code) {
          await processRejectionCode(instr.mandate_id, entry.rejection_code, instr.id);
        }
        // AM04 (fundos insuficientes) → agendar reapresentação
        if (entry.rejection_code === "AM04") {
          await scheduleReapresentacao(instr.id);
        }
        // Notificar encarregado
        const mR = await pool.query(
          "SELECT encarregado_id, school_id, reference FROM dd_mandates WHERE id=$1",
          [instr.mandate_id]
        );
        if (mR.rows.length) {
          const { encarregado_id, school_id, reference } = mR.rows[0];
          await sendFcmToGuardian(encarregado_id, school_id,
            "❌ Débito Directo Rejeitado",
            `O débito foi rejeitado (${entry.rejection_code ?? ""}). Contacte o secretariado. Ref: ${reference}`
          );
          const encR = await pool.query("SELECT telefone FROM encarregados WHERE id=$1", [encarregado_id]);
          if (encR.rows[0]?.telefone) {
            const smsConfig = { provider: "generic", api_url: "", api_key: "", sender_name: "PropinaPlus" };
            await sendSMS(
              encR.rows[0].telefone,
              `PropinaPlus: O seu débito directo foi rejeitado (${entry.rejection_code ?? "sem código"}). Contacte o secretariado. Ref: ${reference}.`,
              smsConfig, school_id, "manual", `dd-rjct-${instr.id}`
            ).catch(() => {});
          }
        }
      } else if (entry.status === "RTRN") {
        devolvido++;
      }
    } catch (e: any) {
      erros.push(`Erro ao processar ${entry.end_to_end_id}: ${e.message}`);
    }
  }

  // Calcular pendentes: instruções SUBMITTED sem resposta
  const pendR = await pool.query(
    `SELECT COUNT(*) FROM dd_instructions i
     JOIN dd_mandates m ON m.id=i.mandate_id
     WHERE m.school_id=$1 AND i.status='SUBMITTED' AND i.submission_date <= (CURRENT_DATE - INTERVAL '1 day')`,
    [schoolId]
  );
  const pendente = parseInt(pendR.rows[0].count ?? "0");

  // Guardar relatório
  await pool.query(
    `INSERT INTO dd_reconciliation_reports
       (report_date, school_id, total_enviado, total_aceite, total_rejeitado, total_pendente, total_devolvido)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (report_date) DO UPDATE SET
       total_aceite=$4, total_rejeitado=$5, total_pendente=$6, total_devolvido=$7`,
    [reportDate, schoolId, aceite + rejeitado + devolvido, aceite, rejeitado, pendente, devolvido]
  );

  if (pendente > 0) {
    console.warn(`[dd:recon] ${pendente} instrução(ões) sem resposta PAIN.002 após D+1 — alertar admin`);
  }

  return { aceite, rejeitado, devolvido, pendente, erros };
}

// ─────────────────────────────────────────────────────────────────────────────
// §10  JOBS DIÁRIOS
// ─────────────────────────────────────────────────────────────────────────────

async function notifySchoolAdmin(mandateId: number, message: string): Promise<void> {
  const r = await pool.query(
    "SELECT school_id, reference FROM dd_mandates WHERE id=$1",
    [mandateId]
  );
  if (!r.rows.length) return;
  console.log(`[dd:admin-notify] escola #${r.rows[0].school_id} — mandato ${r.rows[0].reference}: ${message}`);
  // TODO: integrar com sistema de notificações internas da escola (ex: dashboard alert)
}

// Job 1: Expirar mandatos sem cobrança há 36 meses
async function jobExpireMandates(): Promise<void> {
  console.log("[dd:job] a verificar mandatos expirados (36 meses)...");
  const r = await pool.query(
    `SELECT id FROM dd_mandates
     WHERE status='ACTV'
       AND (last_collection_at IS NULL AND created_at < NOW() - INTERVAL '36 months'
            OR last_collection_at < NOW() - INTERVAL '36 months')`
  );
  for (const { id } of r.rows) {
    await transitionMandate(id, "EXPRD", "Sem cobrança nos últimos 36 meses", "job");
  }
  if (r.rows.length) console.log(`[dd:job] ${r.rows.length} mandato(s) expirado(s)`);
}

// Job 2: SUSP → CANC após 90 dias sem resolução
async function jobCancelSuspended(): Promise<void> {
  console.log("[dd:job] a verificar mandatos suspensos há >90 dias...");
  const r = await pool.query(
    `SELECT id FROM dd_mandates
     WHERE status='SUSP' AND susp_at < NOW() - INTERVAL '90 days'`
  );
  for (const { id } of r.rows) {
    await transitionMandate(id, "CANC", "Suspenso há mais de 90 dias sem resolução", "job");
  }
  if (r.rows.length) console.log(`[dd:job] ${r.rows.length} mandato(s) cancelado(s) por suspensão prolongada`);
}

// Job 3: Identificar instruções a submeter hoje
async function jobSubmissionWindow(): Promise<void> {
  const today = toDateStr(new Date());
  console.log(`[dd:job] a verificar submissões para ${today}...`);

  // Buscar instruções PENDING cuja data de submissão é hoje
  const r = await pool.query(
    `SELECT i.*, m.school_id, m.iban, m.bic, m.encarregado_id,
            e.nome AS debtor_name, m.reference AS mandate_ref, m.pre_notif_sent_at,
            m.pre_notif_days
     FROM dd_instructions i
     JOIN dd_mandates m ON m.id=i.mandate_id
     JOIN encarregados e ON e.id=m.encarregado_id
     WHERE i.status='PENDING' AND m.status='ACTV'`
  );

  const toSubmit = [];
  for (const instr of r.rows) {
    const { submissionDate, adiar } = await calculateSubmissionDate(
      new Date(instr.requested_collection_date), instr.sequence_type
    );
    if (toDateStr(submissionDate) === today && !adiar) {
      // Verificar pré-notificação obrigatória para FRST
      if (instr.sequence_type === "FRST" && !instr.pre_notif_sent_at) {
        console.warn(`[dd:job] FRST bloqueado: mandato #${instr.mandate_id} sem pré-notificação`);
        continue;
      }
      toSubmit.push(instr);
    }
  }

  if (toSubmit.length) {
    console.log(`[dd:job] ${toSubmit.length} instrução(ões) prontas para submissão em ${today}`);
    // Marcar como SUBMITTED
    for (const i of toSubmit) {
      await pool.query(
        "UPDATE dd_instructions SET status='SUBMITTED', submission_date=$1 WHERE id=$2",
        [today, i.id]
      );
    }
  }
}

// Job 4: Enviar pré-notificações necessárias
async function jobPreNotifications(): Promise<void> {
  console.log("[dd:job] a verificar pré-notificações pendentes...");
  const r = await pool.query(
    `SELECT m.id, m.debit_day, m.pre_notif_days
     FROM dd_mandates m
     WHERE m.status='ACTV' AND m.frst_sent_at IS NULL AND m.pre_notif_sent_at IS NULL`
  );

  for (const m of r.rows) {
    const nextDebit = nextCollectionDate(m.debit_day);
    const sendDate = await subtractBusinessDays(nextDebit, m.pre_notif_days ?? 14);
    const today = new Date();
    if (toDateStr(sendDate) <= toDateStr(today)) {
      await sendPreNotification(m.id).catch(e =>
        console.error(`[dd:job:pre-notif] mandato #${m.id}:`, e)
      );
    }
  }
}

// Agendador: correr jobs uma vez por dia às 06:00 Angola time
function scheduleJobs(): void {
  const runAllJobs = async () => {
    try {
      await jobExpireMandates();
      await jobCancelSuspended();
      await jobPreNotifications();
      await jobSubmissionWindow();
    } catch (e) {
      console.error("[dd:jobs] erro:", e);
    }
  };

  // Correr imediatamente ao iniciar (para recuperar de restart)
  setTimeout(runAllJobs, 5000);

  // Depois a cada 24h
  setInterval(runAllJobs, 24 * 60 * 60 * 1000);
  console.log("[dd:jobs] agendados");
}

// ─────────────────────────────────────────────────────────────────────────────
// §11  ROTAS REST
// ─────────────────────────────────────────────────────────────────────────────

/* ── Helpers de autenticação ── */
async function guardianFromToken(token: string) {
  const r = await pool.query(
    `SELECT e.id, e.nome, e.telefone, e.email, e.escola_id
     FROM encarregados e JOIN guardian_sessions gs ON gs.encarregado_id=e.id
     WHERE gs.token=$1 AND gs.expires_at>NOW()`,
    [token]
  );
  return r.rows[0] ?? null;
}
function guardianAuth(req: Request, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return res.status(401).json({ error: "Não autenticado." });
  req.guardianToken = h.slice(7);
  next();
}
async function schoolFromToken(token: string) {
  const r = await pool.query<{ id: number; name: string }>(
    `SELECT s.id, s.name FROM sessions sess JOIN schools s ON s.id=sess.school_id
     WHERE sess.token=$1 AND sess.expires_at>NOW() LIMIT 1`,
    [token]
  );
  return r.rows[0] ?? null;
}
function schoolAuth(req: Request, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return res.status(401).json({ error: "Não autenticado." });
  req.schoolToken = h.slice(7);
  next();
}
async function adminFromToken(token: string) {
  const r = await pool.query("SELECT id FROM admin_sessions WHERE token=$1 AND expires_at>NOW()", [token]);
  return r.rows[0] ?? null;
}
function adminAuth(req: Request, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return res.status(401).json({ error: "Não autenticado." });
  req.adminToken = h.slice(7);
  next();
}

/* ══════════════════════════════════════════════════════
   GUARDIAN — Portal do Encarregado
══════════════════════════════════════════════════════ */

// POST /dd/mandates — criar mandato (substitui /guardian/direct-debit/subscribe)
router.post("/dd/mandates", guardianAuth, async (req: Request, res: Response) => {
  try {
    const guardian = await guardianFromToken(req.guardianToken!);
    if (!guardian) return res.status(401).json({ error: "Sessão inválida." });

    const { iban, bic, emolumentos, debit_day, email, sequence_type = "RCUR" } = req.body;
    if (!iban?.trim()) return res.status(400).json({ error: "IBAN obrigatório." });
    if (!validateIbanAngola(iban.trim()))
      return res.status(400).json({ error: "IBAN inválido. Formato angolano: AO06 + 21 dígitos." });
    if (bic && !validateBic(bic.trim()))
      return res.status(400).json({ error: "BIC inválido." });
    if (!Array.isArray(emolumentos) || !emolumentos.length)
      return res.status(400).json({ error: "Seleccione pelo menos um emolumento." });
    if (!["RCUR", "OOFF", "FNAL"].includes(sequence_type))
      return res.status(400).json({ error: "sequence_type inválido. Use RCUR, OOFF ou FNAL." });

    const schoolR = await pool.query(
      `SELECT DISTINCT s.id FROM schools s
       JOIN students st ON st.school_id=s.id
       JOIN encarregado_aluno ea ON ea.aluno_id=st.id
       WHERE ea.encarregado_id=$1 LIMIT 1`,
      [guardian.id]
    );
    if (!schoolR.rows.length)
      return res.status(400).json({ error: "Nenhum educando associado." });
    const school_id = schoolR.rows[0].id;

    // Verificar se já existe mandato activo
    const existing = await pool.query(
      "SELECT id, status FROM dd_mandates WHERE encarregado_id=$1 AND school_id=$2 AND status NOT IN ('CANC','EXPRD') LIMIT 1",
      [guardian.id, school_id]
    );
    if (existing.rows.length)
      return res.status(409).json({ error: "Já possui um mandato activo.", status: existing.rows[0].status });

    // Verificar se escola permite débito directo
    const settingsR = await pool.query("SELECT settings FROM school_settings WHERE school_id=$1", [school_id]);
    const allowed = settingsR.rows[0]?.settings?.pagamento?.metodos_pagamento?.allow_direct_debit ?? false;
    if (!allowed) return res.status(403).json({ error: "Esta escola não tem débito directo activado." });

    const reference = generateRef("MND");
    const day = Math.min(28, Math.max(1, parseInt(debit_day) || 5));

    const r = await pool.query(
      `INSERT INTO dd_mandates
         (reference, encarregado_id, school_id, iban, bic, emolumentos, debit_day, email,
          sequence_type, status, pre_notif_days)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'PENDING',14) RETURNING *`,
      [reference, guardian.id, school_id, iban.trim().toUpperCase(),
       bic?.trim().toUpperCase() ?? null, JSON.stringify(emolumentos), day,
       email || guardian.email || null, sequence_type]
    );
    const mandate = r.rows[0];

    // Auditoria criação
    await pool.query(
      `INSERT INTO dd_audit_log (mandate_id, estado_anterior, estado_novo, motivo, origem)
       VALUES ($1,NULL,'PENDING','Mandato criado pelo encarregado','utilizador')`,
      [mandate.id]
    );

    // Activar automaticamente (PENDING → ACTV)
    await transitionMandate(mandate.id, "ACTV", "Activação automática após criação", "sistema");

    return res.status(201).json({ ok: true, mandate: { ...mandate, status: "ACTV" } });
  } catch (e: any) {
    console.error("[dd:mandates:create]", e);
    return res.status(500).json({ error: e.message });
  }
});

// GET /dd/mandates/mine — mandato actual do encarregado
router.get("/dd/mandates/mine", guardianAuth, async (req: Request, res: Response) => {
  const guardian = await guardianFromToken(req.guardianToken!);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });

  const schoolId = req.query.school_id ? Number(req.query.school_id) : null;
  const whereSchool = schoolId ? "AND m.school_id=$2" : "";
  const params: any[] = [guardian.id];
  if (schoolId) params.push(schoolId);

  const r = await pool.query(
    `SELECT m.*,
            (SELECT COUNT(*) FROM dd_instructions i WHERE i.mandate_id=m.id AND i.status='ACSC') AS cobranças_confirmadas,
            (SELECT json_agg(json_build_object('status',i.status,'amount',i.amount,'date',i.requested_collection_date,'rejection_code',i.rejection_code) ORDER BY i.created_at DESC)
             FROM dd_instructions i WHERE i.mandate_id=m.id LIMIT 5) AS ultimas_instrucoes
     FROM dd_mandates m
     WHERE m.encarregado_id=$1 ${whereSchool}
     ORDER BY m.created_at DESC LIMIT 1`,
    params
  );
  return res.json(r.rows[0] ?? null);
});

// POST /dd/mandates/:id/cancel-request — pedido de cancelamento
router.post("/dd/mandates/:id/cancel-request", guardianAuth, async (req: Request, res: Response) => {
  try {
    const guardian = await guardianFromToken(req.guardianToken!);
    if (!guardian) return res.status(401).json({ error: "Sessão inválida." });

    const r = await pool.query(
      "SELECT * FROM dd_mandates WHERE id=$1 AND encarregado_id=$2",
      [req.params.id, guardian.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Mandato não encontrado." });
    const m = r.rows[0];
    if (m.status === "CANC") return res.status(409).json({ error: "Mandato já cancelado." });

    // Marcar pedido de cancelamento na tabela legada + nova auditoria
    await pool.query(
      "UPDATE dd_mandates SET canc_reason=$1, updated_at=NOW() WHERE id=$2",
      [req.body.motivo ?? "Cancelamento solicitado pelo encarregado", m.id]
    );
    await pool.query(
      `INSERT INTO dd_audit_log (mandate_id, estado_anterior, estado_novo, motivo, origem)
       VALUES ($1,$2,'CANC_REQUESTED',$3,'utilizador')`,
      [m.id, m.status, req.body.motivo ?? "Cancelamento solicitado pelo encarregado"]
    );
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// GET /dd/mandates/:id/history — histórico de auditoria
router.get("/dd/mandates/:id/history", guardianAuth, async (req: Request, res: Response) => {
  const guardian = await guardianFromToken(req.guardianToken!);
  if (!guardian) return res.status(401).json({ error: "Sessão inválida." });

  const check = await pool.query(
    "SELECT id FROM dd_mandates WHERE id=$1 AND encarregado_id=$2", [req.params.id, guardian.id]
  );
  if (!check.rows.length) return res.status(404).json({ error: "Mandato não encontrado." });

  const audit = await pool.query(
    "SELECT * FROM dd_audit_log WHERE mandate_id=$1 ORDER BY timestamp DESC", [req.params.id]
  );
  const instrs = await pool.query(
    `SELECT instruction_id, sequence_type, amount, requested_collection_date, status, rejection_code, reapresentacao_n
     FROM dd_instructions WHERE mandate_id=$1 ORDER BY created_at DESC`,
    [req.params.id]
  );
  return res.json({ audit_log: audit.rows, instructions: instrs.rows });
});

/* ══════════════════════════════════════════════════════
   ESCOLA — Dashboard Gestor
══════════════════════════════════════════════════════ */

// GET /school/dd/mandates — lista mandatos da escola
router.get("/school/dd/mandates", schoolAuth, async (req: Request, res: Response) => {
  const school = await schoolFromToken(req.schoolToken!);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const { status, page = 1, per_page = 30 } = req.query;
  const whereStatus = status ? "AND m.status=$2" : "";
  const params: any[] = [school.id];
  if (status) params.push(status);
  const offset = (Number(page) - 1) * Number(per_page);
  params.push(Number(per_page), offset);
  const pIdx = params.length;

  const r = await pool.query(
    `SELECT m.*, e.nome AS encarregado_nome, e.telefone,
            (SELECT COUNT(*) FROM dd_instructions i WHERE i.mandate_id=m.id AND i.status='ACSC') AS cobranças_ok,
            (SELECT COUNT(*) FROM dd_instructions i WHERE i.mandate_id=m.id AND i.status='RJCT') AS cobranças_rejeitadas,
            (SELECT SUM(amount) FROM dd_instructions i WHERE i.mandate_id=m.id AND i.status='ACSC') AS total_cobrado
     FROM dd_mandates m
     JOIN encarregados e ON e.id=m.encarregado_id
     WHERE m.school_id=$1 ${whereStatus}
     ORDER BY m.created_at DESC
     LIMIT $${pIdx - 1} OFFSET $${pIdx}`,
    params
  );

  const countR = await pool.query(
    `SELECT COUNT(*) FROM dd_mandates m WHERE m.school_id=$1 ${whereStatus}`,
    status ? [school.id, status] : [school.id]
  );

  return res.json({ mandates: r.rows, total: parseInt(countR.rows[0].count), page: Number(page), per_page: Number(per_page) });
});

// PUT /school/dd/mandates/:id/transition — forçar transição manual
router.put("/school/dd/mandates/:id/transition", schoolAuth, async (req: Request, res: Response) => {
  try {
    const school = await schoolFromToken(req.schoolToken!);
    if (!school) return res.status(401).json({ error: "Sessão inválida." });

    const { new_status, motivo } = req.body;
    if (!new_status || !motivo) return res.status(400).json({ error: "new_status e motivo obrigatórios." });

    const check = await pool.query("SELECT id FROM dd_mandates WHERE id=$1 AND school_id=$2", [req.params.id, school.id]);
    if (!check.rows.length) return res.status(404).json({ error: "Mandato não encontrado." });

    await transitionMandate(Number(req.params.id), new_status as MandateStatus, motivo, "admin");
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

// POST /school/dd/pain008/generate — gerar PAIN.008 para um conjunto de instruções
router.post("/school/dd/pain008/generate", schoolAuth, async (req: Request, res: Response) => {
  try {
    const school = await schoolFromToken(req.schoolToken!);
    if (!school) return res.status(401).json({ error: "Sessão inválida." });

    const MAX_BATCH = req.body.max_batch ?? 500;
    const collection_date: string = req.body.collection_date;
    if (!collection_date) return res.status(400).json({ error: "collection_date obrigatório (YYYY-MM-DD)." });

    // Validar dia útil
    const colDate = new Date(collection_date + "T12:00:00Z");
    if (!(await isBusinessDay(colDate)))
      return res.status(400).json({ error: "A data de débito não pode ser fim de semana ou feriado angolano." });

    // Buscar credenciais DD da escola
    const settingsR = await pool.query("SELECT settings FROM school_settings WHERE school_id=$1", [school.id]);
    const ddCfg = settingsR.rows[0]?.settings?.pagamento?.direct_debit ?? {};
    const creditorId   = ddCfg.creditor_id ?? "";
    const creditorName = ddCfg.creditor_name ?? school.name;
    const creditorIban = ddCfg.creditor_iban ?? "";
    const creditorBic  = ddCfg.creditor_bic ?? "";

    if (!creditorIban) return res.status(400).json({ error: "IBAN do credor não configurado. Configure em Definições > Débito Directo." });

    // Buscar instruções PENDING para esta data
    const instrR = await pool.query(
      `SELECT i.*, m.iban AS debtor_iban, m.bic AS debtor_bic, m.reference AS mandate_ref,
              m.created_at AS mandate_signed_date, e.nome AS debtor_name, m.pre_notif_sent_at,
              m.frst_sent_at, m.sequence_type AS mandate_seq
       FROM dd_instructions i
       JOIN dd_mandates m ON m.id=i.mandate_id
       JOIN encarregados e ON e.id=m.encarregado_id
       WHERE m.school_id=$1 AND i.status='PENDING'
         AND i.requested_collection_date=$2
         AND m.status='ACTV'
       ORDER BY i.created_at LIMIT $3`,
      [school.id, collection_date, MAX_BATCH]
    );

    if (!instrR.rows.length)
      return res.status(404).json({ error: "Nenhuma instrução PENDING para esta data." });

    const errors: string[] = [];
    const valid: any[] = [];

    for (const instr of instrR.rows) {
      // Validações PAIN.008
      if (!validateIbanAngola(instr.debtor_iban)) { errors.push(`IBAN inválido: ${instr.mandate_ref}`); continue; }
      if (!instr.debtor_bic || !validateBic(instr.debtor_bic)) { errors.push(`BIC inválido: ${instr.mandate_ref}`); continue; }
      if (instr.amount <= 0) { errors.push(`Valor inválido: ${instr.mandate_ref}`); continue; }
      if (instr.sequence_type === "FRST" && !instr.pre_notif_sent_at) {
        errors.push(`FRST bloqueado (sem pré-notificação): ${instr.mandate_ref}`); continue;
      }
      if (instr.sequence_type === "FRST" && instr.frst_sent_at) {
        errors.push(`FRST já enviado anteriormente: ${instr.mandate_ref}`); continue;
      }
      valid.push(instr);
    }

    if (!valid.length) return res.status(400).json({ error: "Nenhuma instrução válida.", validation_errors: errors });

    const batchRef = generateRef("PAIN008");
    const instructions: Pain008Instruction[] = valid.map(i => ({
      instruction_id:            i.instruction_id,
      end_to_end_id:             i.end_to_end_id,
      mandate_id_ref:            i.mandate_ref,
      mandate_signed_date:       toDateStr(new Date(i.mandate_signed_date)),
      sequence_type:             i.sequence_type,
      amount:                    parseFloat(i.amount),
      debtor_name:               i.debtor_name,
      debtor_iban:               i.debtor_iban,
      debtor_bic:                i.debtor_bic,
      requested_collection_date: collection_date,
    }));

    const xml = buildPain008Xml(batchRef, creditorId, creditorName, creditorIban, creditorBic, instructions);
    const totalAmount = instructions.reduce((s, i) => s + i.amount, 0);

    // Guardar batch
    const batchR = await pool.query(
      `INSERT INTO dd_pain008_batches (batch_ref, school_id, total_records, total_amount, xml_content, status)
       VALUES ($1,$2,$3,$4,$5,'DRAFT') RETURNING id`,
      [batchRef, school.id, instructions.length, totalAmount, xml]
    );

    // Marcar instruções com batch_id + atualizar sequência FRST
    for (const instr of valid) {
      await pool.query(
        "UPDATE dd_instructions SET pain008_batch_id=$1, status='SUBMITTED', submission_date=CURRENT_DATE WHERE id=$2",
        [batchR.rows[0].id, instr.id]
      );
      await afterInstructionSent(instr.id, instr.sequence_type);
    }

    return res.json({
      ok: true, batch_id: batchR.rows[0].id, batch_ref: batchRef,
      total_records: instructions.length, total_amount: totalAmount,
      validation_errors: errors,
      xml, // cliente pode fazer download
    });
  } catch (e: any) {
    console.error("[dd:pain008:generate]", e);
    return res.status(500).json({ error: e.message });
  }
});

// POST /school/dd/pain002/process — processar ficheiro de resultado EMIS
router.post("/school/dd/pain002/process", schoolAuth, async (req: Request, res: Response) => {
  try {
    const school = await schoolFromToken(req.schoolToken!);
    if (!school) return res.status(401).json({ error: "Sessão inválida." });

    const { entries, report_date } = req.body as { entries: Pain002Entry[]; report_date: string };
    if (!Array.isArray(entries) || !entries.length)
      return res.status(400).json({ error: "entries obrigatório (array de resultados PAIN.002)." });
    if (!report_date)
      return res.status(400).json({ error: "report_date obrigatório (YYYY-MM-DD)." });

    const result = await processPain002(entries, report_date, school.id);
    return res.json({ ok: true, ...result });
  } catch (e: any) {
    console.error("[dd:pain002:process]", e);
    return res.status(500).json({ error: e.message });
  }
});

// GET /school/dd/reconciliation — relatórios de reconciliação
router.get("/school/dd/reconciliation", schoolAuth, async (req: Request, res: Response) => {
  const school = await schoolFromToken(req.schoolToken!);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const r = await pool.query(
    "SELECT * FROM dd_reconciliation_reports WHERE school_id=$1 ORDER BY report_date DESC LIMIT 30",
    [school.id]
  );
  return res.json(r.rows);
});

// GET /school/dd/stats — estatísticas gerais
router.get("/school/dd/stats", schoolAuth, async (req: Request, res: Response) => {
  const school = await schoolFromToken(req.schoolToken!);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const r = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status='ACTV')  AS activos,
       COUNT(*) FILTER (WHERE status='SUSP')  AS suspensos,
       COUNT(*) FILTER (WHERE status='CANC')  AS cancelados,
       COUNT(*) FILTER (WHERE status='EXPRD') AS expirados,
       COUNT(*) FILTER (WHERE status='PENDING') AS pendentes,
       (SELECT COALESCE(SUM(i.amount),0) FROM dd_instructions i
        JOIN dd_mandates m2 ON m2.id=i.mandate_id
        WHERE m2.school_id=$1 AND i.status='ACSC') AS total_cobrado_aoa,
       (SELECT COUNT(*) FROM dd_instructions i
        JOIN dd_mandates m2 ON m2.id=i.mandate_id
        WHERE m2.school_id=$1 AND i.status='RJCT') AS total_rejeitadas
     FROM dd_mandates WHERE school_id=$1`,
    [school.id]
  );
  return res.json(r.rows[0]);
});

// POST /school/dd/instructions — criar instrução manual para um mandato
router.post("/school/dd/instructions", schoolAuth, async (req: Request, res: Response) => {
  try {
    const school = await schoolFromToken(req.schoolToken!);
    if (!school) return res.status(401).json({ error: "Sessão inválida." });

    const { mandate_id, amount, collection_date, propina_id } = req.body;
    if (!mandate_id || !amount || !collection_date)
      return res.status(400).json({ error: "mandate_id, amount e collection_date obrigatórios." });

    // Validar mandato pertence à escola e está ACTV
    const mR = await pool.query(
      "SELECT * FROM dd_mandates WHERE id=$1 AND school_id=$2",
      [mandate_id, school.id]
    );
    if (!mR.rows.length) return res.status(404).json({ error: "Mandato não encontrado." });
    if (mR.rows[0].status !== "ACTV")
      return res.status(400).json({ error: `Mandato está ${mR.rows[0].status}. Só mandatos ACTV podem gerar cobranças.` });

    const colDate = new Date(collection_date + "T12:00:00Z");
    if (!(await isBusinessDay(colDate)))
      return res.status(400).json({ error: "A data de débito não pode ser fim de semana ou feriado angolano." });

    const sequence = await determineNextSequence(Number(mandate_id));
    const instrId  = generateRef("INSTR");
    const e2eId    = generateRef("E2E");

    const r = await pool.query(
      `INSERT INTO dd_instructions
         (mandate_id, instruction_id, end_to_end_id, sequence_type, amount, currency,
          requested_collection_date, propina_id, status)
       VALUES ($1,$2,$3,$4,$5,'AOA',$6,$7,'PENDING') RETURNING *`,
      [mandate_id, instrId, e2eId, sequence, amount, collection_date, propina_id ?? null]
    );
    return res.status(201).json({ ok: true, instruction: r.rows[0] });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// POST /school/dd/mandates/:id/send-prenotification — forçar envio de pré-notificação
router.post("/school/dd/mandates/:id/send-prenotification", schoolAuth, async (req: Request, res: Response) => {
  try {
    const school = await schoolFromToken(req.schoolToken!);
    if (!school) return res.status(401).json({ error: "Sessão inválida." });

    const check = await pool.query(
      "SELECT id FROM dd_mandates WHERE id=$1 AND school_id=$2", [req.params.id, school.id]
    );
    if (!check.rows.length) return res.status(404).json({ error: "Mandato não encontrado." });

    await sendPreNotification(Number(req.params.id));
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

/* ══════════════════════════════════════════════════════
   ADMIN — Plataforma PropinaPlus
══════════════════════════════════════════════════════ */

// GET /admin/dd/overview — visão global de mandatos
router.get("/admin/dd/overview", adminAuth, async (req: Request, res: Response) => {
  if (!await adminFromToken(req.adminToken!)) return res.status(401).json({ error: "Sessão inválida." });

  const r = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE status='ACTV')   AS total_activos,
      COUNT(*) FILTER (WHERE status='SUSP')   AS total_suspensos,
      COUNT(*) FILTER (WHERE status='CANC')   AS total_cancelados,
      COUNT(*) FILTER (WHERE status='EXPRD')  AS total_expirados,
      COUNT(DISTINCT school_id)               AS escolas_com_mandatos
    FROM dd_mandates
  `);
  const instrR = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE status='ACSC')      AS total_cobrados,
      COUNT(*) FILTER (WHERE status='RJCT')      AS total_rejeitados,
      COUNT(*) FILTER (WHERE status='SUBMITTED') AS total_pendentes,
      COALESCE(SUM(amount) FILTER (WHERE status='ACSC'),0) AS volume_total_aoa
    FROM dd_instructions
  `);
  return res.json({ mandates: r.rows[0], instructions: instrR.rows[0] });
});

// POST /admin/dd/jobs/run — executar jobs manualmente
router.post("/admin/dd/jobs/run", adminAuth, async (req: Request, res: Response) => {
  if (!await adminFromToken(req.adminToken!)) return res.status(401).json({ error: "Sessão inválida." });
  try {
    await jobExpireMandates();
    await jobCancelSuspended();
    await jobPreNotifications();
    await jobSubmissionWindow();
    return res.json({ ok: true, message: "Jobs executados com sucesso." });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// GET /admin/dd/feriados — listar feriados
router.get("/admin/dd/feriados", adminAuth, async (req: Request, res: Response) => {
  if (!await adminFromToken(req.adminToken!)) return res.status(401).json({ error: "Sessão inválida." });
  const r = await pool.query("SELECT * FROM dd_angola_feriados ORDER BY data");
  return res.json(r.rows);
});

// POST /admin/dd/feriados — adicionar feriado
router.post("/admin/dd/feriados", adminAuth, async (req: Request, res: Response) => {
  if (!await adminFromToken(req.adminToken!)) return res.status(401).json({ error: "Sessão inválida." });
  const { data, nome } = req.body;
  if (!data || !nome) return res.status(400).json({ error: "data e nome obrigatórios." });
  const r = await pool.query(
    "INSERT INTO dd_angola_feriados (data, nome) VALUES ($1,$2) ON CONFLICT (data) DO UPDATE SET nome=$2 RETURNING *",
    [data, nome]
  );
  return res.json(r.rows[0]);
});

// GET /admin/dd/batches — listar batches PAIN.008
router.get("/admin/dd/batches", adminAuth, async (req: Request, res: Response) => {
  if (!await adminFromToken(req.adminToken!)) return res.status(401).json({ error: "Sessão inválida." });
  const r = await pool.query(
    `SELECT b.*, s.name AS school_name
     FROM dd_pain008_batches b JOIN schools s ON s.id=b.school_id
     ORDER BY b.created_at DESC LIMIT 50`
  );
  return res.json(r.rows);
});

// POST /admin/dd/mandates/:id/transition — transição forçada pelo admin
router.post("/admin/dd/mandates/:id/transition", adminAuth, async (req: Request, res: Response) => {
  if (!await adminFromToken(req.adminToken!)) return res.status(401).json({ error: "Sessão inválida." });
  try {
    const { new_status, motivo } = req.body;
    await transitionMandate(Number(req.params.id), new_status as MandateStatus, motivo, "admin");
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

// Iniciar jobs ao carregar o router
scheduleJobs();

export default router;
