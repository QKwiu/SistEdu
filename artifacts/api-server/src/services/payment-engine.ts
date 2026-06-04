import crypto from "crypto";

/* ════════════════════════════════════════════════════════════════
   MOTOR DE PAGAMENTOS — Strategy Pattern
   Suporta três fluxos EMIS: GPO (Webframe), Referências MCX,
   Débito Direto.  Cada driver é agnóstico ao contexto — o
   PaymentEngine selecciona o driver correcto em runtime.
════════════════════════════════════════════════════════════════ */

export interface PaymentOrder {
  reference: string;
  amount: number;
  description?: string;
  student_name?: string;
  school_id: number;
}

export interface PaymentResult {
  ok: boolean;
  driver: string;
  payload?: Record<string, unknown>;
  error?: string;
}

export interface ConnectivityResult {
  ok: boolean;
  status?: number;
  message: string;
  latency_ms?: number;
}

export interface PaymentDriver {
  readonly name: string;
  initiate(order: PaymentOrder, config: Record<string, unknown>): Promise<PaymentResult>;
  testConnectivity(config: Record<string, unknown>): Promise<ConnectivityResult>;
}

/* ── Utilitário: ping HTTP ─────────────────────────────────────── */
async function pingUrl(url: string): Promise<ConnectivityResult> {
  const start = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8_000);
    const resp = await fetch(url, { method: "HEAD", signal: ctrl.signal });
    clearTimeout(timer);
    const ms = Date.now() - start;
    return {
      ok: resp.status < 500,
      status: resp.status,
      message: `HTTP ${resp.status}${resp.ok ? " — OK" : " — " + resp.statusText}`,
      latency_ms: ms,
    };
  } catch (err: unknown) {
    const ms = Date.now() - start;
    if ((err as { name?: string }).name === "AbortError")
      return { ok: false, message: "Timeout (8 s)", latency_ms: ms };
    return { ok: false, message: (err as Error).message ?? "Erro de rede", latency_ms: ms };
  }
}

/* ── GPO Webframe Driver ──────────────────────────────────────── */
export class GpoDriver implements PaymentDriver {
  readonly name = "GPO_EMIS";

  async initiate(order: PaymentOrder, cfg: Record<string, unknown>): Promise<PaymentResult> {
    const {
      merchant_id, terminal_id, secret_key,
      url_success, url_fail, api_url,
    } = cfg as Record<string, string>;

    if (!merchant_id || !terminal_id || !secret_key) {
      return {
        ok: false, driver: this.name,
        error: "Configuração GPO incompleta — merchantId, terminalId e Secret Key são obrigatórios.",
      };
    }

    /* merchantReference — identificador único gerado pelo sistema (para reconciliação) */
    const merchantReference = `GPO-${order.school_id}-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

    /* timestamp ISO 8601 — previne ataques de replay de transações */
    const timestamp = new Date().toISOString();

    const currency = "AOA";
    const amount_str = Number(order.amount).toFixed(2);

    /* HMAC-SHA256: merchantId + terminalId + merchantReference + amount + currency
       Conforme especificação EMIS GPO — a signature nunca é enviada ao browser */
    const raw = `${merchant_id}${terminal_id}${merchantReference}${amount_str}${currency}`;
    const signature = crypto.createHmac("sha256", secret_key).update(raw).digest("hex").toUpperCase();

    return {
      ok: true, driver: this.name,
      payload: {
        /* Campos de identidade do terminal */
        merchantId:        merchant_id,
        terminalId:        terminal_id,
        /* Campos gerados pelo backend */
        merchantReference,
        timestamp,
        /* Dados da transação */
        amount:            amount_str,
        currency,
        description:       order.description ?? `Propina — ${order.student_name ?? "Aluno"}`,
        /* Assinatura digital */
        signature,
        /* URLs de retorno */
        returnUrlSuccess:  url_success ?? "",
        returnUrlFail:     url_fail    ?? "",
        /* Endpoint Webframe */
        webframe_url:      api_url     ?? "",
      },
    };
  }

  async testConnectivity(cfg: Record<string, unknown>): Promise<ConnectivityResult> {
    const url = cfg?.api_url as string;
    if (!url) return { ok: false, message: "URL do Webframe GPO não configurada." };
    return pingUrl(url);
  }
}

/* ── Multicaixa Reference Driver ──────────────────────────────── */
export class MultiCaixaDriver implements PaymentDriver {
  readonly name = "MCX_REFERENCE";

  async initiate(order: PaymentOrder, cfg: Record<string, unknown>): Promise<PaymentResult> {
    const { entity_code, api_key, api_url, expiry_minutes } = cfg as Record<string, unknown>;

    if (!entity_code || !api_key) {
      return {
        ok: false, driver: this.name,
        error: "Configuração MCX incompleta — entity_code e api_key são obrigatórios.",
      };
    }

    return {
      ok: true, driver: this.name,
      payload: {
        entity_code, api_url: api_url ?? "",
        reference: order.reference,
        amount: order.amount,
        expiry_minutes: expiry_minutes ?? 1440,
        description: order.description ?? `Propina — ${order.student_name ?? "Aluno"}`,
      },
    };
  }

  async testConnectivity(cfg: Record<string, unknown>): Promise<ConnectivityResult> {
    const url = cfg?.api_url as string;
    if (!url) return { ok: false, message: "URL da API MCX não configurada." };
    return pingUrl(url);
  }
}

/* ── Débito Direto Driver ─────────────────────────────────────── */
export class DebitoDiretoDriver implements PaymentDriver {
  readonly name = "DIRECT_DEBIT";

  async initiate(order: PaymentOrder, cfg: Record<string, unknown>): Promise<PaymentResult> {
    const { ws_url, ws_username, mandate_creditor_id, mandate_creditor_name } = cfg as Record<string, string>;

    if (!ws_url || !ws_username) {
      return {
        ok: false, driver: this.name,
        error: "Configuração Débito Direto incompleta — ws_url e ws_username são obrigatórios.",
      };
    }

    return {
      ok: true, driver: this.name,
      payload: {
        ws_url, creditor_id: mandate_creditor_id ?? "", creditor_name: mandate_creditor_name ?? "",
        reference: order.reference, amount: order.amount,
        description: order.description ?? `Propina — ${order.student_name ?? "Aluno"}`,
      },
    };
  }

  async testConnectivity(cfg: Record<string, unknown>): Promise<ConnectivityResult> {
    const protocol  = String(cfg?.protocol  ?? "SOAP").toUpperCase();
    const authType  = String(cfg?.auth_type ?? "basic");
    const timeoutMs = Math.min(Number(cfg?.timeout ?? 30) * 1000, 15_000);
    const start     = Date.now();

    // ── SOAP ────────────────────────────────────────────────────────
    const trySOAP = async (): Promise<ConnectivityResult> => {
      const soapUrl = String(cfg?.soap_url ?? cfg?.ws_url ?? "");
      if (!soapUrl) return { ok: false, message: "URL SOAP não configurada (soap_url)." };

      const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header/><soapenv:Body/>
</soapenv:Envelope>`;

      const headers: Record<string, string> = {
        "Content-Type": "text/xml;charset=UTF-8",
        "SOAPAction": '""',
      };
      if (authType === "basic" || authType === "cert") {
        const user = String(cfg?.ws_username ?? "");
        const pass = String(cfg?.ws_password ?? "");
        if (user) headers["Authorization"] = `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
      }

      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), timeoutMs);
        const resp = await fetch(soapUrl, { method: "POST", headers, body: envelope, signal: ctrl.signal });
        clearTimeout(t);
        const ms = Date.now() - start;
        return {
          ok: resp.status < 500,
          status: resp.status,
          message: resp.status < 500
            ? `SOAP: HTTP ${resp.status} — servidor respondeu (${ms} ms)`
            : `SOAP: HTTP ${resp.status} — erro no servidor`,
          latency_ms: ms,
        };
      } catch (e: any) {
        return { ok: false, message: `SOAP: ${e.name === "AbortError" ? "timeout" : e.message}`, latency_ms: Date.now() - start };
      }
    };

    // ── REST / OAuth2 ────────────────────────────────────────────────
    const tryREST = async (): Promise<ConnectivityResult> => {
      const oauthUrl  = String(cfg?.oauth_url  ?? "");
      const restUrl   = String(cfg?.rest_url   ?? "");
      const clientId  = String(cfg?.client_id  ?? "");
      const clientSec = String(cfg?.client_secret ?? "");

      if (oauthUrl && clientId) {
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), timeoutMs);
          const resp = await fetch(oauthUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSec }),
            signal: ctrl.signal,
          });
          clearTimeout(t);
          const ms = Date.now() - start;
          if (resp.ok) {
            const data = await resp.json() as Record<string, unknown>;
            return data.access_token
              ? { ok: true, status: resp.status, message: `OAuth2: access_token obtido com sucesso (${ms} ms)`, latency_ms: ms }
              : { ok: false, status: resp.status, message: `OAuth2: resposta sem access_token (${ms} ms)`, latency_ms: ms };
          }
          return { ok: false, status: resp.status, message: `OAuth2: HTTP ${resp.status} (${ms} ms)`, latency_ms: ms };
        } catch (e: any) {
          return { ok: false, message: `OAuth2: ${e.name === "AbortError" ? "timeout" : e.message}`, latency_ms: Date.now() - start };
        }
      }
      if (restUrl) return pingUrl(restUrl);
      return { ok: false, message: "URL REST ou OAuth2 não configurada." };
    };

    if (protocol === "SOAP")  return trySOAP();
    if (protocol === "REST")  return tryREST();
    if (protocol === "AMBOS") {
      const soap = await trySOAP();
      if (soap.ok) return { ...soap, message: `SOAP+REST — ${soap.message}` };
      const rest = await tryREST();
      return rest.ok ? { ...rest, message: `SOAP+REST — SOAP falhou, REST OK: ${rest.message}` } : soap;
    }
    // backward compat: ws_url
    const url = String(cfg?.ws_url ?? "");
    if (!url) return { ok: false, message: "URL do Web Service DD não configurada." };
    return pingUrl(url);
  }
}

/* ── Driver registry ──────────────────────────────────────────── */
const REGISTRY: Record<string, PaymentDriver> = {
  GPO_EMIS:      new GpoDriver(),
  MCX_REFERENCE: new MultiCaixaDriver(),
  DIRECT_DEBIT:  new DebitoDiretoDriver(),
};

/* ── Factory / Engine ─────────────────────────────────────────── */
export class PaymentEngine {
  static driver(channel: string): PaymentDriver {
    const d = REGISTRY[channel];
    if (!d) throw new Error(`Driver de pagamento desconhecido: "${channel}".`);
    return d;
  }

  static async initiate(channel: string, order: PaymentOrder, cfg: Record<string, unknown>): Promise<PaymentResult> {
    return PaymentEngine.driver(channel).initiate(order, cfg);
  }

  static async testConnectivity(channel: string, cfg: Record<string, unknown>): Promise<ConnectivityResult> {
    return PaymentEngine.driver(channel).testConnectivity(cfg);
  }

  static channels(): string[] {
    return Object.keys(REGISTRY);
  }
}
