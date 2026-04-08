import { pool } from "@workspace/db";

export interface SMSConfig {
  provider: string;
  api_url?: string;
  api_key?: string;
  sender_name?: string;
}

export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export type SMSEvent =
  | "nova_fatura"
  | "pagamento_confirmado"
  | "atraso_pagamento"
  | "multa_aplicada"
  | "manual";

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("244") && cleaned.length === 12) return `+${cleaned}`;
  if (cleaned.length === 9) return `+244${cleaned}`;
  return `+${cleaned}`;
}

function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, "");
  return cleaned.length >= 9;
}

export async function sendSMS(
  to: string,
  message: string,
  config: SMSConfig,
  schoolId: number,
  evento: SMSEvent = "manual",
  idempotencyKey?: string
): Promise<SMSResult> {
  if (!isValidPhone(to)) {
    await logSMS(schoolId, to, message, "failed", evento, null, "Número inválido");
    return { success: false, error: "Número inválido" };
  }

  const normalized = normalizePhone(to);

  if (idempotencyKey) {
    const existing = await pool.query(
      "SELECT id FROM sms_logs WHERE idempotency_key=$1",
      [idempotencyKey]
    );
    if (existing.rows.length > 0) {
      return { success: true, messageId: `dup:${existing.rows[0].id}` };
    }
  }

  let result: SMSResult;

  if (!config.api_url || config.provider === "mock") {
    console.log(`[SMS MOCK] To:${normalized} Evento:${evento} | ${message}`);
    result = { success: true, messageId: `mock-${Date.now()}` };
  } else {
    try {
      const resp = await fetch(config.api_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.api_key ?? ""}`,
        },
        body: JSON.stringify({
          to: normalized,
          message,
          from: config.sender_name || "KiwaraEsc",
        }),
      });
      const data: any = await resp.json().catch(() => ({}));
      if (resp.ok) {
        result = {
          success: true,
          messageId: data.messageId ?? data.id ?? `${Date.now()}`,
        };
      } else {
        result = { success: false, error: data.error ?? `HTTP ${resp.status}` };
      }
    } catch (e: any) {
      result = { success: false, error: e.message };
    }
  }

  await logSMS(
    schoolId,
    normalized,
    message,
    result.success ? "sent" : "failed",
    evento,
    idempotencyKey ?? null,
    result.messageId ?? result.error ?? null
  );

  return result;
}

async function logSMS(
  schoolId: number,
  telefone: string,
  mensagem: string,
  status: string,
  evento: string,
  idempotencyKey: string | null,
  providerRef: string | null
) {
  await pool.query(
    `INSERT INTO sms_logs (school_id, telefone, mensagem, status, evento, idempotency_key, provider_ref)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (idempotency_key) DO NOTHING`,
    [schoolId, telefone, mensagem, status, evento, idempotencyKey, providerRef]
  );
}

export async function sendBulkSMS(
  recipients: { phone: string; name?: string }[],
  messageTemplate: string,
  config: SMSConfig,
  schoolId: number
): Promise<{ sent: number; failed: number; total: number }> {
  let sent = 0,
    failed = 0;
  for (const r of recipients) {
    const msg = messageTemplate.replace(/\{nome\}/g, r.name ?? "Encarregado");
    const res = await sendSMS(r.phone, msg, config, schoolId, "manual");
    if (res.success) sent++;
    else failed++;
  }
  return { sent, failed, total: recipients.length };
}

export const DEFAULT_TEMPLATES: Record<SMSEvent, string> = {
  nova_fatura:
    "Prezado(a) {nome_encarregado}, a propina de {mes} no valor de {valor} Kz está disponível. {reference_info}",
  pagamento_confirmado:
    "Pagamento confirmado para {nome_aluno}. Valor: {valor} Kz. Obrigado.",
  atraso_pagamento:
    "A propina de {mes} encontra-se em atraso. Evite multa. {reference_info}",
  multa_aplicada:
    "Foi aplicada uma multa de {valor_multa} Kz à propina de {mes}.",
  manual: "{mensagem}",
};

/** Variables available in templates with human-readable descriptions */
export const TEMPLATE_VARIABLES = [
  { key: "{nome_encarregado}", label: "Nome do Encarregado",   events: ["nova_fatura", "pagamento_confirmado", "atraso_pagamento", "multa_aplicada"] },
  { key: "{nome_aluno}",       label: "Nome do Aluno",         events: ["nova_fatura", "pagamento_confirmado", "atraso_pagamento", "multa_aplicada"] },
  { key: "{mes}",              label: "Mês da Propina",        events: ["nova_fatura", "atraso_pagamento", "multa_aplicada"] },
  { key: "{valor}",            label: "Valor da Propina (Kz)", events: ["nova_fatura", "pagamento_confirmado"] },
  { key: "{valor_multa}",      label: "Valor da Multa (Kz)",   events: ["multa_aplicada"] },
  { key: "{reference_info}",   label: "Referência (inteligente): mostra 'Ref: XXXX' para ref. EMIS ou redireciona para o Portal do Aluno se for referência interna", events: ["nova_fatura", "atraso_pagamento"] },
] as const;

export interface SMSEventPayload {
  telefone: string;
  nome_encarregado?: string;
  nome_aluno?: string;
  mes?: string;
  valor?: number | string;
  valor_multa?: number | string;
  reference?: string;
  is_emis_reference?: boolean;
}

/** Fetch global platform templates (admin-configurable fallback) */
async function getGlobalTemplates(): Promise<Record<string, string>> {
  try {
    const r = await pool.query(
      "SELECT value FROM platform_settings WHERE key='sms_templates' LIMIT 1"
    );
    return (r.rows[0]?.value as Record<string, string>) ?? {};
  } catch {
    return {};
  }
}

/** Resolve template with priority: school custom → platform global → hardcoded default */
export function resolveTemplate(
  event: SMSEvent,
  schoolTemplates: Record<string, string>,
  globalTemplates: Record<string, string>
): string {
  return schoolTemplates[event] ?? globalTemplates[event] ?? DEFAULT_TEMPLATES[event] ?? "";
}

/** Interpolate SMS template variables */
export function interpolateTemplate(template: string, payload: SMSEventPayload): string {
  const refInfo = payload.is_emis_reference
    ? `Ref: ${payload.reference}`
    : "Aceda ao Portal do Aluno para pagar.";

  return template
    .replace(/\{nome_encarregado\}/g, payload.nome_encarregado ?? "Encarregado")
    .replace(/\{nome_aluno\}/g,       payload.nome_aluno ?? "Aluno")
    .replace(/\{mes\}/g,              payload.mes ?? "")
    .replace(/\{valor\}/g,            String(payload.valor ?? ""))
    .replace(/\{valor_multa\}/g,      String(payload.valor_multa ?? ""))
    .replace(/\{reference\}/g,        payload.reference ?? "")
    .replace(/\{reference_info\}/g,   refInfo);
}

export async function sendEventSMS(
  event: SMSEvent,
  schoolId: number,
  payload: SMSEventPayload
): Promise<void> {
  try {
    const settingsRow = await pool.query(
      "SELECT settings FROM school_settings WHERE school_id=$1",
      [schoolId]
    );
    if (!settingsRow.rows.length) return;

    const settings = settingsRow.rows[0].settings ?? {};
    const comm = settings.comunicacao ?? {};

    if (!comm.sms_activo) return;

    const eventos = comm.eventos ?? {};
    if (event !== "manual" && !eventos[event]) return;

    const schoolTemplates: Record<string, string> = comm.sms_templates ?? {};
    const globalTemplates = await getGlobalTemplates();

    const config: SMSConfig = {
      provider: comm.sms_provider || "mock",
      api_url: comm.sms_api_url,
      api_key: comm.sms_api_key,
      sender_name: comm.sms_sender_name || "KiwaraEsc",
    };

    const template = resolveTemplate(event, schoolTemplates, globalTemplates);
    const message  = interpolateTemplate(template, payload);

    const idempotencyKey =
      event !== "manual"
        ? `${event}-${schoolId}-${payload.telefone}-${payload.mes ?? ""}-${payload.reference ?? Date.now()}`
        : undefined;

    await sendSMS(payload.telefone, message, config, schoolId, event, idempotencyKey);
  } catch (err) {
    console.error(`[SMS] sendEventSMS error (${event} school:${schoolId}):`, err);
  }
}
