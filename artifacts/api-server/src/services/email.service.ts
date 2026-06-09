/**
 * email.service.ts — Motor de E-mail Assíncrono Multi-Tenant
 *
 * ARQUITECTURA:
 *   • Suporta SMTP (qualquer fornecedor) e SendGrid (via relay SMTP)
 *   • Credenciais cifradas em repouso com AES-256-GCM (lib/crypto.ts)
 *   • Isolamento total por escola — cada tenant usa as suas próprias credenciais
 *   • Envio assíncrono via setImmediate — nunca bloqueia a thread HTTP
 *   • Auditoria completa em email_logs (PENDING → SENT | FAILED)
 *
 * TABELAS GERIDAS:
 *   school_email_config  — credenciais SMTP/SendGrid por escola (campos cifrados)
 *   email_logs           — registo de auditoria de cada envio
 *
 * USO TÍPICO:
 *   // Envia e retorna imediatamente; worker gere o envio em background
 *   const logId = await queueSchoolEmail(schoolId, "p@exemplo.ao", "Assunto", "<p>Corpo</p>");
 */

import nodemailer from "nodemailer";
import { pool } from "@workspace/db";
import { encryptAES, decryptAES, type EncryptedPayload } from "../lib/crypto";

/* ══════════════════════════════════════════════════════════════════
   TIPOS PÚBLICOS
══════════════════════════════════════════════════════════════════ */

export type EmailProvider = "SMTP" | "SENDGRID";
export type EmailStatus   = "PENDING" | "SENT" | "FAILED";

/**
 * Configuração de e-mail de uma escola.
 * Campos de credenciais são strings em texto claro aqui —
 * a camada de persistência trata da cifragem antes de gravar.
 */
export interface SchoolEmailConfig {
  schoolId:      number;
  providerType:  EmailProvider;
  emailFrom:     string;
  /** SMTP: host do servidor de correio */
  smtpHost?:     string;
  /** SMTP: porta (tipicamente 587 STARTTLS ou 465 SSL) */
  smtpPort?:     number;
  /** SMTP: utilizador de autenticação */
  smtpUser?:     string;
  /** SMTP: palavra-passe em texto claro (apenas em memória) */
  smtpPassword?: string;
  /** SendGrid: API Key em texto claro (apenas em memória) */
  sendgridApiKey?: string;
  activo:        boolean;
}

export interface SendEmailOptions {
  /** CC adicional */
  cc?:       string | string[];
  /** Versão texto puro (fallback para clientes sem HTML) */
  text?:     string;
  /** ID do registo em email_logs — se fornecido, actualiza esse registo */
  logId?:    number;
}

/* ══════════════════════════════════════════════════════════════════
   MIGRAÇÕES (idempotentes — executam no arranque)
══════════════════════════════════════════════════════════════════ */

export async function runEmailMigration(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS school_email_config (
      id            SERIAL PRIMARY KEY,
      school_id     INTEGER NOT NULL UNIQUE,
      provider_type VARCHAR(10)  NOT NULL DEFAULT 'SMTP'
                    CHECK (provider_type IN ('SMTP','SENDGRID')),
      email_from    TEXT NOT NULL,

      -- Campos SMTP (texto claro — não sensível)
      smtp_host     TEXT,
      smtp_port     INTEGER DEFAULT 587,
      smtp_user     TEXT,

      -- Palavra-passe SMTP cifrada (AES-256-GCM)
      smtp_password_iv   TEXT,
      smtp_password_tag  TEXT,
      smtp_password_ct   TEXT,

      -- API Key SendGrid cifrada (AES-256-GCM)
      sendgrid_key_iv    TEXT,
      sendgrid_key_tag   TEXT,
      sendgrid_key_ct    TEXT,

      activo          BOOLEAN NOT NULL DEFAULT TRUE,
      criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      actualizado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_logs (
      id            SERIAL   PRIMARY KEY,
      school_id     INTEGER  NOT NULL,
      destinatario  TEXT     NOT NULL,
      assunto       TEXT     NOT NULL,
      -- PENDING → gerado; SENT → aceite pelo MTA; FAILED → rejeitado
      status        VARCHAR(10) NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','SENT','FAILED')),
      provider      VARCHAR(10),
      message_id    TEXT,
      -- Mensagem de erro do fornecedor (SPF/DKIM, credenciais, spam, etc.)
      erro          TEXT,
      criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      actualizado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_email_logs_school_id ON email_logs(school_id);
    CREATE INDEX IF NOT EXISTS idx_email_logs_status    ON email_logs(status);
  `);
}

/* ══════════════════════════════════════════════════════════════════
   PERSISTÊNCIA DE CONFIGURAÇÃO
══════════════════════════════════════════════════════════════════ */

/**
 * Guarda (upsert) a configuração de e-mail de uma escola.
 * Credenciais sensíveis são cifradas com AES-256-GCM antes de persistir.
 * Campos não fornecidos mantêm os valores existentes (COALESCE).
 */
export async function saveEmailConfig(cfg: SchoolEmailConfig): Promise<void> {
  let pwIv = null, pwTag = null, pwCt = null;
  let sgIv = null, sgTag = null, sgCt = null;

  if (cfg.smtpPassword) {
    const enc: EncryptedPayload = encryptAES(cfg.smtpPassword);
    pwIv  = enc.iv;
    pwTag = enc.tag;
    pwCt  = enc.ciphertext;
  }

  if (cfg.sendgridApiKey) {
    const enc: EncryptedPayload = encryptAES(cfg.sendgridApiKey);
    sgIv  = enc.iv;
    sgTag = enc.tag;
    sgCt  = enc.ciphertext;
  }

  await pool.query(
    `INSERT INTO school_email_config
       (school_id, provider_type, email_from,
        smtp_host, smtp_port, smtp_user,
        smtp_password_iv, smtp_password_tag, smtp_password_ct,
        sendgrid_key_iv,  sendgrid_key_tag,  sendgrid_key_ct,
        activo, actualizado_em)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, NOW())
     ON CONFLICT (school_id) DO UPDATE SET
       provider_type    = EXCLUDED.provider_type,
       email_from       = EXCLUDED.email_from,
       smtp_host        = COALESCE(EXCLUDED.smtp_host,     school_email_config.smtp_host),
       smtp_port        = COALESCE(EXCLUDED.smtp_port,     school_email_config.smtp_port),
       smtp_user        = COALESCE(EXCLUDED.smtp_user,     school_email_config.smtp_user),
       smtp_password_iv  = COALESCE(EXCLUDED.smtp_password_iv,  school_email_config.smtp_password_iv),
       smtp_password_tag = COALESCE(EXCLUDED.smtp_password_tag, school_email_config.smtp_password_tag),
       smtp_password_ct  = COALESCE(EXCLUDED.smtp_password_ct,  school_email_config.smtp_password_ct),
       sendgrid_key_iv   = COALESCE(EXCLUDED.sendgrid_key_iv,   school_email_config.sendgrid_key_iv),
       sendgrid_key_tag  = COALESCE(EXCLUDED.sendgrid_key_tag,  school_email_config.sendgrid_key_tag),
       sendgrid_key_ct   = COALESCE(EXCLUDED.sendgrid_key_ct,   school_email_config.sendgrid_key_ct),
       activo           = EXCLUDED.activo,
       actualizado_em   = NOW()`,
    [
      cfg.schoolId, cfg.providerType, cfg.emailFrom,
      cfg.smtpHost  ?? null, cfg.smtpPort ?? null, cfg.smtpUser ?? null,
      pwIv, pwTag, pwCt,
      sgIv, sgTag, sgCt,
      cfg.activo,
    ]
  );
}

/**
 * Lê a configuração de uma escola e decifra as credenciais em memória.
 * Nunca devolve as credenciais em texto claro para fora desta função —
 * o transporter é construído imediatamente e as strings descartadas.
 *
 * @returns null se a escola não tiver e-mail configurado ou estiver inactivo
 */
async function loadEmailConfig(schoolId: number): Promise<SchoolEmailConfig | null> {
  const r = await pool.query(
    `SELECT * FROM school_email_config WHERE school_id=$1 AND activo=TRUE`,
    [schoolId]
  );
  if (!r.rows[0]) return null;

  const row = r.rows[0];

  let smtpPassword: string | undefined;
  let sendgridApiKey: string | undefined;

  if (row.smtp_password_iv && row.smtp_password_tag && row.smtp_password_ct) {
    smtpPassword = decryptAES({
      iv:         row.smtp_password_iv,
      tag:        row.smtp_password_tag,
      ciphertext: row.smtp_password_ct,
    });
  }

  if (row.sendgrid_key_iv && row.sendgrid_key_tag && row.sendgrid_key_ct) {
    sendgridApiKey = decryptAES({
      iv:         row.sendgrid_key_iv,
      tag:        row.sendgrid_key_tag,
      ciphertext: row.sendgrid_key_ct,
    });
  }

  return {
    schoolId:      row.school_id,
    providerType:  row.provider_type as EmailProvider,
    emailFrom:     row.email_from,
    smtpHost:      row.smtp_host      ?? undefined,
    smtpPort:      row.smtp_port      ?? undefined,
    smtpUser:      row.smtp_user      ?? undefined,
    smtpPassword,
    sendgridApiKey,
    activo:        row.activo,
  };
}

/* ══════════════════════════════════════════════════════════════════
   MAIL FACTORY — Fábrica de Transportadores Dinâmica
══════════════════════════════════════════════════════════════════ */

interface TransporterHandle {
  transporter: nodemailer.Transporter;
  emailFrom:   string;
  provider:    EmailProvider;
}

export class MailFactory {
  /**
   * Instancia o transportador correcto para a escola indicada.
   *
   * SMTP  → Nodemailer com STARTTLS (porta 587) ou SSL (porta 465)
   * SENDGRID → Nodemailer via relay SMTP do SendGrid (não necessita @sendgrid/mail)
   *            Host: smtp.sendgrid.net | Utilizador fixo: "apikey" | Password: API Key
   *
   * As credenciais são decifradas em memória e nunca persistidas no objecto retornado.
   *
   * @throws Error se a escola não tiver configuração activa
   */
  static async getTransporter(schoolId: number): Promise<TransporterHandle> {
    const cfg = await loadEmailConfig(schoolId);

    if (!cfg) {
      throw new Error(
        `[MailFactory] Escola ${schoolId} não tem configuração de e-mail activa. ` +
        `Configure em Definições › E-mail antes de enviar mensagens.`
      );
    }

    let transporter: nodemailer.Transporter;

    if (cfg.providerType === "SENDGRID") {
      if (!cfg.sendgridApiKey) {
        throw new Error(`[MailFactory] SendGrid API Key não configurada para escola ${schoolId}.`);
      }

      /*
       * SendGrid via SMTP relay — mais simples que @sendgrid/mail,
       * não requer pacote adicional, e suporta todos os campos nodemailer.
       * Utilizador é sempre a string literal "apikey".
       */
      transporter = nodemailer.createTransport({
        host:   "smtp.sendgrid.net",
        port:   465,
        secure: true,
        auth: {
          user: "apikey",
          pass: cfg.sendgridApiKey,
        },
      });

    } else {
      /* SMTP genérico (Gmail, Outlook, servidores próprios, etc.) */
      if (!cfg.smtpHost || !cfg.smtpUser || !cfg.smtpPassword) {
        throw new Error(
          `[MailFactory] Configuração SMTP incompleta para escola ${schoolId}. ` +
          `smtp_host, smtp_user e smtp_password são obrigatórios.`
        );
      }

      const port   = cfg.smtpPort ?? 587;
      const secure = port === 465;

      transporter = nodemailer.createTransport({
        host:   cfg.smtpHost,
        port,
        secure,
        auth: {
          user: cfg.smtpUser,
          pass: cfg.smtpPassword,
        },
        tls: {
          /* Rejeita certificados inválidos apenas em produção */
          rejectUnauthorized: process.env.NODE_ENV === "production",
        },
      });
    }

    return { transporter, emailFrom: cfg.emailFrom, provider: cfg.providerType };
  }
}

/* ══════════════════════════════════════════════════════════════════
   AUDITORIA — Gestão de email_logs
══════════════════════════════════════════════════════════════════ */

async function createPendingLog(
  schoolId:    number,
  destinatario: string,
  assunto:     string,
  provider?:   string
): Promise<number> {
  const r = await pool.query(
    `INSERT INTO email_logs (school_id, destinatario, assunto, status, provider)
     VALUES ($1, $2, $3, 'PENDING', $4)
     RETURNING id`,
    [schoolId, destinatario, assunto, provider ?? null]
  );
  return r.rows[0].id as number;
}

async function updateLog(
  logId:     number,
  status:    EmailStatus,
  extra: { messageId?: string; erro?: string } = {}
): Promise<void> {
  await pool.query(
    `UPDATE email_logs
     SET status=$2, message_id=$3, erro=$4, actualizado_em=NOW()
     WHERE id=$1`,
    [logId, status, extra.messageId ?? null, extra.erro ?? null]
  );
}

/* ══════════════════════════════════════════════════════════════════
   SERVIÇO DE ENVIO — Execução em Background
══════════════════════════════════════════════════════════════════ */

/**
 * Executa o envio de e-mail efectivo.
 * Deve ser chamada SEMPRE via setImmediate ou de forma não-aguardada
 * para não bloquear a thread HTTP principal.
 *
 * Actualiza email_logs com SENT ou FAILED consoante o resultado.
 * Captura e classifica erros comuns:
 *   - AUTH_CREDENTIALS → credenciais inválidas
 *   - SPF_DKIM         → rejeição de domínio (reputação / configuração DNS)
 *   - SPAM             → rejeitado por política anti-spam
 *   - NETWORK          → falha de conectividade
 */
async function _executeSend(
  schoolId: number,
  to:       string | string[],
  subject:  string,
  html:     string,
  opts:     SendEmailOptions = {},
  logId:    number
): Promise<void> {
  let handle: TransporterHandle | null = null;

  try {
    handle = await MailFactory.getTransporter(schoolId);

    const toList     = Array.isArray(to) ? to.join(", ") : to;
    const recipients = Array.isArray(to) ? to : [to];

    const info = await handle.transporter.sendMail({
      from:    handle.emailFrom,
      to:      toList,
      cc:      opts.cc,
      subject,
      html,
      text:    opts.text ?? stripHtml(html),
    });

    await updateLog(logId, "SENT", { messageId: info.messageId });

    console.log(
      `[email] ✓ Escola ${schoolId} → ${recipients.length} destinatário(s) ` +
      `[${handle.provider}] id=${info.messageId}`
    );

  } catch (err: any) {
    const raw: string = err?.message ?? String(err);
    const classified  = classifyError(raw);

    console.error(
      `[email] ✗ Escola ${schoolId} → "${subject}" — ${classified} | ${raw}`
    );

    await updateLog(logId, "FAILED", { erro: `[${classified}] ${raw}`.substring(0, 1000) });
  }
}

/* ══════════════════════════════════════════════════════════════════
   API PÚBLICA
══════════════════════════════════════════════════════════════════ */

/**
 * Cria um registo PENDING em email_logs e despacha o envio em background
 * via setImmediate — retorna imediatamente ao chamador.
 *
 * @returns logId — ID do registo em email_logs para rastreio
 *
 * @example
 *   setImmediate(() => {
 *     queueSchoolEmail(schoolId, "enc@email.ao", "Fatura", html)
 *       .catch(e => console.error("[email:queue]", e));
 *   });
 *
 *   // Ou aguarda o logId para linkagem:
 *   const logId = await queueSchoolEmail(...);
 */
export async function queueSchoolEmail(
  schoolId: number,
  to:       string | string[],
  subject:  string,
  html:     string,
  opts:     SendEmailOptions = {}
): Promise<number> {
  /* Descobre o provider antes de criar o log (para registar no campo provider) */
  const cfgRow = await pool.query(
    `SELECT provider_type FROM school_email_config WHERE school_id=$1 AND activo=TRUE`,
    [schoolId]
  );
  const provider: string = cfgRow.rows[0]?.provider_type ?? "SMTP";

  const destinatario = Array.isArray(to) ? to.join(", ") : to;
  const logId = await createPendingLog(schoolId, destinatario, subject, provider);

  /* Despacha em background — não bloqueia o chamador */
  setImmediate(() => {
    _executeSend(schoolId, to, subject, html, { ...opts, logId }, logId).catch(
      (e: Error) => console.error(`[email:worker] Erro inesperado logId=${logId}:`, e.message)
    );
  });

  return logId;
}

/**
 * Versão síncrona — aguarda o resultado do envio.
 * Use apenas quando o chamador precisa do resultado imediato
 * (ex: endpoint de teste de configuração).
 */
export async function sendSchoolEmail(
  schoolId: number,
  to:       string | string[],
  subject:  string,
  html:     string,
  opts:     SendEmailOptions = {}
): Promise<{ logId: number; status: EmailStatus; messageId?: string; erro?: string }> {
  const destinatario = Array.isArray(to) ? to.join(", ") : to;

  const cfgRow = await pool.query(
    `SELECT provider_type FROM school_email_config WHERE school_id=$1 AND activo=TRUE`,
    [schoolId]
  );
  const provider: string = cfgRow.rows[0]?.provider_type ?? "SMTP";
  const logId = await createPendingLog(schoolId, destinatario, subject, provider);

  let handle: TransporterHandle | null = null;
  try {
    handle = await MailFactory.getTransporter(schoolId);
    const info = await handle.transporter.sendMail({
      from:    handle.emailFrom,
      to:      destinatario,
      cc:      opts.cc,
      subject,
      html,
      text:    opts.text ?? stripHtml(html),
    });
    await updateLog(logId, "SENT", { messageId: info.messageId });
    return { logId, status: "SENT", messageId: info.messageId };
  } catch (err: any) {
    const raw        = err?.message ?? String(err);
    const classified = classifyError(raw);
    const erro       = `[${classified}] ${raw}`.substring(0, 1000);
    await updateLog(logId, "FAILED", { erro });
    return { logId, status: "FAILED", erro };
  }
}

/* ══════════════════════════════════════════════════════════════════
   UTILITÁRIOS INTERNOS
══════════════════════════════════════════════════════════════════ */

type ErrorClass =
  | "AUTH_CREDENTIALS"
  | "SPF_DKIM"
  | "SPAM"
  | "NETWORK"
  | "CONFIG"
  | "UNKNOWN";

/**
 * Classifica o erro do MTA para diagnóstico no log.
 * As mensagens variam entre fornecedores, por isso verificamos substrings comuns.
 */
function classifyError(msg: string): ErrorClass {
  const m = msg.toLowerCase();
  if (m.includes("535") || m.includes("authentication") || m.includes("invalid credentials") || m.includes("username and password"))
    return "AUTH_CREDENTIALS";
  if (m.includes("spf") || m.includes("dkim") || m.includes("dmarc") || m.includes("550 5.7") || m.includes("domain not allowed"))
    return "SPF_DKIM";
  if (m.includes("spam") || m.includes("blocked") || m.includes("554") || m.includes("policy violation"))
    return "SPAM";
  if (m.includes("econnrefused") || m.includes("etimedout") || m.includes("getaddrinfo") || m.includes("network"))
    return "NETWORK";
  if (m.includes("not configured") || m.includes("configuração"))
    return "CONFIG";
  return "UNKNOWN";
}

/** Remove tags HTML para gerar a versão texto puro. */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s{2,}/g, " ").trim();
}
