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

/* ════════════════════════════════════════════════════════════════
   CAMADA 1 + 2 — Health check, retry com backoff, referência provisória
   ════════════════════════════════════════════════════════════════ */

/**
 * Gera referência provisória interna para contingência.
 * Formato: PROV-[ANO]-[MES_NUM]-[ID_ALUNO]
 */
export function generateProvisionalRef(aluno_id: number, mes: string, ano: string): string {
  const MESES_NUM: Record<string, string> = {
    "Janeiro":"01","Fevereiro":"02","Março":"03","Abril":"04","Maio":"05","Junho":"06",
    "Julho":"07","Agosto":"08","Setembro":"09","Outubro":"10","Novembro":"11","Dezembro":"12",
  };
  const mesNum = MESES_NUM[mes] ?? "00";
  return `PROV-${ano}-${mesNum}-${aluno_id}`;
}

/**
 * Camada 1: verifica conectividade EMIS.
 * - Regista resultado em emis_health_log.
 * - Actualiza schools.emis_em_falha conforme resultado.
 * Retorna true se EMIS está acessível.
 */
export async function checkEmisHealth(school_id: number): Promise<boolean> {
  const cfg = await getEmisConfig(school_id);

  /* Em modo simulado (sem credenciais reais), considera sempre OK */
  if (cfg.simulado || !cfg.api_url) {
    await pool.query(
      `UPDATE schools SET emis_em_falha=FALSE WHERE id=$1`, [school_id]
    );
    return true;
  }

  let ok = false;
  let detalhe = "";
  try {
    const resp = await fetch(`${cfg.api_url}/health`, {
      method: "HEAD",
      headers: { "Authorization": `Bearer ${cfg.api_key}` },
      signal: AbortSignal.timeout(8000),
    });
    ok = resp.ok || resp.status < 500;
    detalhe = `HTTP ${resp.status}`;
  } catch (err: any) {
    detalhe = String(err.message ?? err).slice(0, 200);
  }

  /* Registar no log */
  await pool.query(
    `INSERT INTO emis_health_log (school_id, status, detalhe) VALUES ($1,$2,$3)`,
    [school_id, ok ? "ok" : "falha", detalhe]
  ).catch(() => {});

  /* Limpar log antigo (manter apenas 200 entradas por escola) */
  await pool.query(
    `DELETE FROM emis_health_log WHERE id IN (
       SELECT id FROM emis_health_log WHERE school_id=$1
       ORDER BY criado_em DESC OFFSET 200
     )`,
    [school_id]
  ).catch(() => {});

  /* Actualizar flag na escola */
  await pool.query(
    `UPDATE schools SET emis_em_falha=$1 WHERE id=$2`,
    [!ok, school_id]
  ).catch(() => {});

  return ok;
}

/**
 * Camada 1 + 2: Solicita referência EMIS com 3 tentativas e backoff exponencial.
 * Backoffs: 2 min → 5 min → 15 min.
 * Em caso de falha final: gera referência provisória PROV-* e define status='contingencia'.
 *
 * Retorna a referência (oficial ou provisória) e um flag `provisional`.
 */
export async function requestEMISReferenceWithRetry(
  params: PedidoRefEMIS & { aluno_id: number }
): Promise<RespostaRefEMIS & { provisional: boolean; provisional_ref?: string }> {
  const BACKOFFS_MS = [2 * 60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000];
  const MAX_TRIES = 3;

  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    try {
      const result = await requestEMISReference(params);
      /* Sucesso — marcar EMIS como ok */
      await pool.query(
        `INSERT INTO emis_health_log (school_id, status, tentativa, detalhe) VALUES ($1,'ok',$2,'requestEMISReferenceWithRetry')`,
        [params.school_id, attempt]
      ).catch(() => {});
      await pool.query(
        `UPDATE schools SET emis_em_falha=FALSE WHERE id=$1`, [params.school_id]
      ).catch(() => {});
      return { ...result, provisional: false };
    } catch (err) {
      console.warn(`[EMIS:retry] tentativa ${attempt}/${MAX_TRIES} falhou: ${err}`);
      await pool.query(
        `INSERT INTO emis_health_log (school_id, status, tentativa, detalhe) VALUES ($1,'falha',$2,$3)`,
        [params.school_id, attempt, String(err).slice(0, 200)]
      ).catch(() => {});

      if (attempt < MAX_TRIES) {
        await new Promise(r => setTimeout(r, BACKOFFS_MS[attempt - 1]));
      }
    }
  }

  /* Todas as tentativas falharam → Camada 2: referência provisória */
  console.error(`[EMIS:retry] todas ${MAX_TRIES} tentativas falharam para propina ${params.propina_id} — activando contingência`);

  const provRef = generateProvisionalRef(params.aluno_id, params.mes, params.ano);

  await pool.query(
    `UPDATE schools SET emis_em_falha=TRUE WHERE id=$1`, [params.school_id]
  ).catch(() => {});

  await pool.query(
    `UPDATE propinas SET status='contingencia', referencia=$1 WHERE id=$2`,
    [provRef, params.propina_id]
  ).catch(() => {});

  const validade = await calcularDataVencimentoEMIS(
    params.mes, params.ano, params.diaVencimento ?? 10
  );

  return {
    entidade:       "PROV",
    referencia:     provRef,
    validade,
    simulado:       false,
    provisional:    true,
    provisional_ref: provRef,
  };
}

/**
 * Camada 6: Ao restaurar EMIS, percorre todas as propinas em estado 'contingencia'
 * com referência PROV-* e solicita referência oficial à EMIS.
 * Propinas em 'pago_manual_pendente' mantêm estado (aguardam confirmação manual).
 */
export async function restoreEmisReferences(school_id: number): Promise<{ restored: number; failed: number }> {
  const pendentes = await pool.query(
    `SELECT p.id, p.mes, p.ano, p.montante, p.student_id,
            s.nome AS aluno_nome
     FROM propinas p
     JOIN students s ON s.id = p.student_id
     WHERE p.school_id=$1
       AND p.status='contingencia'
       AND (p.referencia LIKE 'PROV-%' OR p.referencia IS NULL)`,
    [school_id]
  );

  const diaVenc = await getDiaVencimento(school_id);
  let restored = 0, failed = 0;

  for (const row of pendentes.rows) {
    try {
      const result = await requestEMISReference({
        school_id,
        propina_id:  row.id,
        montante:    Number(row.montante),
        aluno_nome:  row.aluno_nome,
        mes:         row.mes,
        ano:         row.ano,
        diaVencimento: diaVenc,
      });

      await pool.query(
        `UPDATE propinas
         SET status='pendente', referencia=$1
         WHERE id=$2`,
        [result.referencia, row.id]
      );

      /* Registar nova referência em pagamentos */
      await pool.query(
        `INSERT INTO pagamentos (school_id, propina_id, entidade, referencia, valor, estado, validade)
         VALUES ($1,$2,$3,$4,$5,'PENDENTE',$6)
         ON CONFLICT DO NOTHING`,
        [school_id, row.id, result.entidade, result.referencia, Number(row.montante), result.validade]
      ).catch(() => {});

      restored++;
    } catch (err) {
      console.error(`[EMIS:restore] falha propina ${row.id}:`, err);
      failed++;
    }
  }

  console.log(`[EMIS:restore] escola=${school_id} restauradas=${restored} falhas=${failed}`);
  return { restored, failed };
}
