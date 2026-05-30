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
    const url = cfg?.ws_url as string;
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
