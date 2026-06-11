/**
 * emis.service.ts — Abstracção do motor EMIS/Multicaixa para geração de referências.
 *
 * Regras:
 *  - A referência é sempre solicitada à EMIS (real ou simulada).
 *  - A data de vencimento é o dia N do mês M+1 (configurável por escola, default: 10).
 *  - Se o dia N cair em fim-de-semana ou feriado angolano, avança para o próximo dia útil.
 *  - Uma única referência activa por propina — duplicados são bloqueados a nível de DB.
 */

import { pool } from "@workspace/db";
import { randomBytes } from "crypto";

/* ── Feriados Angola (tabela partilhada com direct-debit) ── */
async function getFeriados(anoMin: number, anoMax: number): Promise<Set<string>> {
  try {
    const r = await pool.query(
      `SELECT data FROM dd_angola_feriados WHERE EXTRACT(YEAR FROM data) BETWEEN $1 AND $2`,
      [anoMin, anoMax]
    );
    return new Set(r.rows.map((row: any) => new Date(row.data).toISOString().slice(0, 10)));
  } catch {
    return new Set();
  }
}

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function addDays(d: Date, n: number): Date {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + n);
  return nd;
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Avança para o próximo dia útil se cair em fim-de-semana ou feriado */
async function proximoDiaUtil(date: Date): Promise<Date> {
  const feriados = await getFeriados(date.getFullYear(), date.getFullYear() + 1);
  let d = new Date(date);
  while (isWeekend(d) || feriados.has(toISO(d))) {
    d = addDays(d, 1);
  }
  return d;
}

const MESES: Record<string, number> = {
  "Janeiro":1,"Fevereiro":2,"Março":3,"Abril":4,"Maio":5,"Junho":6,
  "Julho":7,"Agosto":8,"Setembro":9,"Outubro":10,"Novembro":11,"Dezembro":12,
};

/**
 * Calcula a data de vencimento da propina:
 * dia `diaVencimento` do mês seguinte ao mês da propina, ajustado para dia útil.
 */
export async function calcularDataVencimentoEMIS(
  mes: string,
  ano: string,
  diaVencimento: number,
): Promise<Date> {
  const mesNum = MESES[mes] ?? 1;
  const anoNum = Number(ano);

  let targetMes = mesNum + 1;
  let targetAno = anoNum;
  if (targetMes > 12) { targetMes = 1; targetAno++; }

  const targetDay = Math.min(diaVencimento, new Date(targetAno, targetMes, 0).getDate());
  const raw = new Date(targetAno, targetMes - 1, targetDay, 23, 59, 59, 999);
  return await proximoDiaUtil(raw);
}

/* ── Config EMIS por escola ── */
export interface EmisConfig {
  entidade:    string;  // ex: "00112"
  merchant_id: string;
  api_key:     string;
  api_url:     string;
  simulado:    boolean;
}

export async function getEmisConfig(school_id: number): Promise<EmisConfig> {
  try {
    const r = await pool.query(
      "SELECT config FROM emis_config WHERE school_id=$1",
      [school_id]
    );
    const cfg = r.rows[0]?.config ?? {};
    return {
      entidade:    cfg.entidade    ?? "00112",
      merchant_id: cfg.merchant_id ?? `MCX-${school_id}`,
      api_key:     cfg.api_key     ?? "",
      api_url:     cfg.api_url     ?? "",
      simulado:    !cfg.api_key,
    };
  } catch {
    return { entidade: "00112", merchant_id: `MCX-${school_id}`, api_key: "", api_url: "", simulado: true };
  }
}

/* ── Geração de referência numérica de 9 dígitos ── */
function gerarReferencia9Digitos(): string {
  return String(randomBytes(5).readUInt32BE(0) % 900000000 + 100000000);
}

/** Parâmetros para solicitar referência à EMIS */
export interface PedidoRefEMIS {
  school_id:    number;
  propina_id:   number;
  montante:     number;
  aluno_nome:   string;
  mes:          string;
  ano:          string;
  diaVencimento?: number; // default 10
}

export interface RespostaRefEMIS {
  entidade:  string;
  referencia: string;
  validade:   Date;
  simulado:   boolean;
}

/**
 * Solicita referência EMIS para uma propina.
 * Se as credenciais reais estiverem configuradas, chama a API.
 * Caso contrário, simula (ambiente de desenvolvimento / sem contrato EMIS activo).
 */
export async function requestEMISReference(params: PedidoRefEMIS): Promise<RespostaRefEMIS> {
  const cfg = await getEmisConfig(params.school_id);
  const diaVenc = params.diaVencimento ?? 10;
  const validade = await calcularDataVencimentoEMIS(params.mes, params.ano, diaVenc);

  if (!cfg.simulado && cfg.api_url) {
    /* ── Chamada à API EMIS real ── */
    try {
      const body = JSON.stringify({
        merchant_id: cfg.merchant_id,
        amount:      params.montante,
        currency:    "AOA",
        description: `Propina ${params.mes}/${params.ano} — ${params.aluno_nome}`,
        expiry_date: validade.toISOString().slice(0, 10),
        external_id: String(params.propina_id),
      });

      const resp = await fetch(`${cfg.api_url}/references`, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${cfg.api_key}`,
        },
        body,
        signal: AbortSignal.timeout(8000),
      });

      if (resp.ok) {
        const data: any = await resp.json();
        return {
          entidade:   data.entity   ?? cfg.entidade,
          referencia: data.reference ?? gerarReferencia9Digitos(),
          validade,
          simulado:   false,
        };
      }
    } catch (err) {
      console.error(`[EMIS] Falha na API, a usar simulação: ${err}`);
    }
  }

  /* ── Modo simulado ── */
  return {
    entidade:   cfg.entidade,
    referencia: gerarReferencia9Digitos(),
    validade,
    simulado:   true,
  };
}

/** Obtém o dia de vencimento configurado pela escola (default: 10) */
export async function getDiaVencimento(school_id: number): Promise<number> {
  try {
    const r = await pool.query(
      "SELECT settings FROM school_settings WHERE school_id=$1",
      [school_id]
    );
    const v = r.rows[0]?.settings?.propinas?.dia_vencimento;
    const n = Number(v);
    return (n >= 1 && n <= 28) ? n : 10;
  } catch {
    return 10;
  }
}

/** Obtém o dia de geração automática configurado pela escola (default: 20) */
export async function getDiaGeracaoAuto(school_id: number): Promise<number> {
  try {
    const r = await pool.query(
      "SELECT settings FROM school_settings WHERE school_id=$1",
      [school_id]
    );
    const v = r.rows[0]?.settings?.propinas?.dia_geracao_auto;
    const n = Number(v);
    return (n >= 1 && n <= 28) ? n : 20;
  } catch {
    return 20;
  }
}
