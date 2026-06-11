/**
 * email.ts — Rotas de gestão de e-mail por escola
 *
 * Endpoints:
 *   GET    /school/email-config          — lê config mascarada (sem credenciais)
 *   PUT    /school/email-config          — guarda/actualiza config com cifragem
 *   POST   /school/email-config/test     — envia e-mail de teste (síncrono)
 *   GET    /school/email-logs            — lista logs de auditoria (paginado)
 */

import { Router, type Request, type Response, type NextFunction } from "express";
import { z }         from "zod";
import { pool }      from "@workspace/db";
import {
  saveEmailConfig,
  sendSchoolEmail,
  type EmailProvider,
} from "../services/email.service";

const router = Router();

/* ── Middleware de autenticação de escola (reutiliza getSchoolFromToken) ── */
async function getSchoolFromToken(token: string) {
  const r = await pool.query(
    `SELECT s.id AS school_id, s.name FROM school_sessions ss
     JOIN schools s ON s.id = ss.school_id
     WHERE ss.token = $1 AND ss.expires_at > NOW()`,
    [token]
  );
  return r.rows[0] ?? null;
}

function schoolAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization ?? "";
  const token = auth.replace("Bearer ", "").trim();
  if (!token) return res.status(401).json({ error: "Token em falta." });
  req.schoolToken = token;
  next();
}

/* ══════════════════════════════════════════════════════════════════
   Schemas Zod
══════════════════════════════════════════════════════════════════ */

const EmailConfigSchema = z.object({
  provider_type:    z.enum(["SMTP", "SENDGRID"]),
  email_from:       z.string().email("email_from inválido."),
  smtp_host:        z.string().optional(),
  smtp_port:        z.number().int().min(1).max(65535).optional(),
  smtp_user:        z.string().optional(),
  /** Texto claro — cifrado antes de persistir */
  smtp_password:    z.string().optional(),
  /** Texto claro — cifrado antes de persistir */
  sendgrid_api_key: z.string().optional(),
  activo:           z.boolean().default(true),
}).superRefine((data, ctx) => {
  if (data.provider_type === "SMTP") {
    if (!data.smtp_host)
      ctx.addIssue({ code: "custom", path: ["smtp_host"],     message: "smtp_host é obrigatório para SMTP." });
    if (!data.smtp_user)
      ctx.addIssue({ code: "custom", path: ["smtp_user"],     message: "smtp_user é obrigatório para SMTP." });
    if (!data.smtp_password)
      ctx.addIssue({ code: "custom", path: ["smtp_password"], message: "smtp_password é obrigatório para SMTP." });
  }
  if (data.provider_type === "SENDGRID" && !data.sendgrid_api_key) {
    ctx.addIssue({ code: "custom", path: ["sendgrid_api_key"], message: "sendgrid_api_key é obrigatório para SendGrid." });
  }
});

const TestEmailSchema = z.object({
  to: z.string().email("Destinatário inválido."),
});

/* ══════════════════════════════════════════════════════════════════
   GET /school/email-config — lê configuração (sem expor credenciais)
══════════════════════════════════════════════════════════════════ */

router.get("/school/email-config", schoolAuth, async (req: Request, res: Response) => {
  const school = await getSchoolFromToken(req.schoolToken!);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const r = await pool.query(
    `SELECT
       provider_type,
       email_from,
       smtp_host,
       smtp_port,
       smtp_user,
       -- Indica se a password está configurada sem revelar o valor
       (smtp_password_ct IS NOT NULL) AS smtp_password_configurada,
       (sendgrid_key_ct  IS NOT NULL) AS sendgrid_key_configurada,
       activo,
       actualizado_em
     FROM school_email_config
     WHERE school_id = $1`,
    [school.school_id]
  );

  if (!r.rows[0]) return res.json(null);
  return res.json(r.rows[0]);
});

/* ══════════════════════════════════════════════════════════════════
   PUT /school/email-config — guarda / actualiza configuração
══════════════════════════════════════════════════════════════════ */

router.put("/school/email-config", schoolAuth, async (req: Request, res: Response) => {
  const school = await getSchoolFromToken(req.schoolToken!);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const parse = EmailConfigSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({
      error:    "Payload inválido.",
      detalhes: parse.error.flatten().fieldErrors,
    });
  }

  const d = parse.data;

  await saveEmailConfig({
    schoolId:      school.school_id,
    providerType:  d.provider_type as EmailProvider,
    emailFrom:     d.email_from,
    smtpHost:      d.smtp_host,
    smtpPort:      d.smtp_port,
    smtpUser:      d.smtp_user,
    smtpPassword:  d.smtp_password,
    sendgridApiKey: d.sendgrid_api_key,
    activo:        d.activo,
  });

  return res.json({ ok: true, message: "Configuração de e-mail guardada com sucesso." });
});

/* ══════════════════════════════════════════════════════════════════
   POST /school/email-config/test — envia e-mail de teste (síncrono)
══════════════════════════════════════════════════════════════════ */

router.post("/school/email-config/test", schoolAuth, async (req: Request, res: Response) => {
  const school = await getSchoolFromToken(req.schoolToken!);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const parse = TestEmailSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({
      error:    "Payload inválido.",
      detalhes: parse.error.flatten().fieldErrors,
    });
  }

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:auto">
      <h2 style="color:#1a56db">✓ Configuração de E-mail Activa</h2>
      <p>Este e-mail confirma que as suas credenciais de e-mail estão correctamente configuradas no <strong>Kiwara Tech</strong>.</p>
      <p style="color:#6b7280;font-size:12px">Escola: ${school.name} · ${new Date().toLocaleString("pt-AO")}</p>
    </div>`;

  const result = await sendSchoolEmail(
    school.school_id,
    parse.data.to,
    "✓ Teste de Configuração — Kiwara Tech",
    html
  );

  if (result.status === "SENT") {
    return res.json({
      ok:        true,
      message:   `E-mail de teste enviado para ${parse.data.to}.`,
      log_id:    result.logId,
      message_id: result.messageId,
    });
  }

  return res.status(502).json({
    ok:      false,
    error:   "Falha no envio. Verifique as credenciais e tente novamente.",
    detalhe: result.erro,
    log_id:  result.logId,
  });
});

/* ══════════════════════════════════════════════════════════════════
   GET /school/email-logs — lista logs de auditoria
══════════════════════════════════════════════════════════════════ */

router.get("/school/email-logs", schoolAuth, async (req: Request, res: Response) => {
  const school = await getSchoolFromToken(req.schoolToken!);
  if (!school) return res.status(401).json({ error: "Sessão inválida." });

  const page  = Math.max(1, parseInt(String(req.query.page  ?? "1"), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10)));
  const status = req.query.status;
  const offset = (page - 1) * limit;

  const conditions: string[] = ["school_id = $1"];
  const params: unknown[]    = [school.school_id];

  if (status && ["PENDING", "SENT", "FAILED"].includes(String(status).toUpperCase())) {
    conditions.push(`status = $${params.length + 1}`);
    params.push(String(status).toUpperCase());
  }

  const where = conditions.join(" AND ");

  const [countR, rowsR] = await Promise.all([
    pool.query(`SELECT COUNT(*) FROM email_logs WHERE ${where}`, params),
    pool.query(
      `SELECT id, destinatario, assunto, status, provider, message_id, erro, criado_em
       FROM email_logs WHERE ${where}
       ORDER BY criado_em DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    ),
  ]);

  return res.json({
    total: parseInt(countR.rows[0].count, 10),
    page,
    limit,
    logs:  rowsR.rows,
  });
});

export default router;
