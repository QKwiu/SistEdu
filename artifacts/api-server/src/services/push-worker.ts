/**
 * push-worker.ts — Motor de Push Notifications para Comunicados
 *
 * ARQUITECTURA (sem dependências externas de fila):
 *   - O endpoint HTTP chama `triggerComunicadoPush()` via setImmediate()
 *     e responde ao cliente de imediato (não aguarda o envio).
 *   - Este módulo corre assincronamente no mesmo processo Node.js,
 *     ideal para o ambiente Replit sem Redis/BullMQ.
 *
 * FLUXO INTERNO:
 *   1. Resoluçao da Audiência  → guardian_ids afectados
 *   2. Procura de Tokens       → guardian_device_tokens (+ fcm_device_tokens legacy)
 *   3. Batching (500 tokens)   → Promise.allSettled por batch
 *   4. Limpeza de Órfãos       → DELETE tokens inválidos reportados pelo FCM
 */

import crypto from "crypto";
import { pool } from "@workspace/db";
import { getFcmConfig, getFcmAccessToken } from "../routes/fcm";

/* ── Tipos ─────────────────────────────────────────────────────── */

export type PushAudiencia =
  | "todos"
  | "encarregados"
  | "turma"
  | "especifico";

export interface TriggerPushParams {
  comunicadoId: number;
  schoolId:     number;
  titulo:       string;
  corpo:        string;
  audiencia?:   PushAudiencia;
  turmaId?:     number;
  encarregadoIds?: number[];
}

interface SendResult {
  sent:        number;
  failed:      number;
  cleaned:     number;
  totalTokens: number;
  batches:     number;
}

/* ── Constantes ────────────────────────────────────────────────── */

const BATCH_SIZE = 500;

/** Códigos FCM v1 que indicam token inválido/expirado → remover da BD */
const STALE_CODES = new Set([
  "UNREGISTERED",
  "INVALID_ARGUMENT",
]);

/** Substrings de mensagens de erro legacy que indicam token inválido */
const STALE_MSG_FRAGMENTS = [
  "registration-token-not-registered",
  "InvalidRegistration",
  "Requested entity was not found",
];

/* ── Resolução da Audiência ────────────────────────────────────── */

/**
 * Devolve todos os tokens FCM activos para os encarregados afectados.
 * Agrega guardian_device_tokens (novo) + fcm_device_tokens (legacy)
 * e deduplica via Set para evitar envios duplicados ao mesmo dispositivo.
 */
async function resolveTokens(
  schoolId:        number,
  audiencia:       PushAudiencia,
  turmaId?:        number,
  encarregadoIds?: number[]
): Promise<{ allTokens: string[]; tokenToTable: Map<string, "new" | "legacy"> }> {

  let newQ:    string;
  let legacyQ: string;
  let params:  unknown[];

  /* ── Passo A: Resolução da Audiência ── */
  if (audiencia === "turma" && turmaId) {
    /*
     * Encarregados com filhos na turma especificada.
     * JOIN: guardian_device_tokens → encarregado_aluno → students(turma_id)
     */
    newQ = `
      SELECT DISTINCT gdt.token_fcm AS token, 'new' AS src
      FROM   guardian_device_tokens gdt
      JOIN   encarregado_aluno ea ON ea.encarregado_id = gdt.guardian_id
      JOIN   students s           ON s.id = ea.aluno_id
      WHERE  gdt.school_id = $1
        AND  s.turma_id    = $2`;

    legacyQ = `
      SELECT DISTINCT t.token, 'legacy' AS src
      FROM   fcm_device_tokens t
      JOIN   encarregado_aluno ea ON ea.encarregado_id = t.user_id AND t.user_type = 'guardian'
      JOIN   students s           ON s.id = ea.aluno_id
      WHERE  t.school_id = $1
        AND  s.turma_id  = $2`;

    params = [schoolId, turmaId];

  } else if (audiencia === "especifico" && encarregadoIds?.length) {
    /*
     * Lista explícita de guardian_id — usado para mensagens dirigidas.
     */
    newQ = `
      SELECT DISTINCT token_fcm AS token, 'new' AS src
      FROM   guardian_device_tokens
      WHERE  school_id    = $1
        AND  guardian_id  = ANY($2::int[])`;

    legacyQ = `
      SELECT DISTINCT token, 'legacy' AS src
      FROM   fcm_device_tokens
      WHERE  school_id = $1
        AND  user_type = 'guardian'
        AND  user_id   = ANY($2::int[])`;

    params = [schoolId, encarregadoIds];

  } else {
    /* "todos" / "encarregados" — toda a escola */
    newQ = `
      SELECT DISTINCT token_fcm AS token, 'new' AS src
      FROM   guardian_device_tokens
      WHERE  school_id = $1`;

    legacyQ = `
      SELECT DISTINCT token, 'legacy' AS src
      FROM   fcm_device_tokens
      WHERE  school_id = $1
        AND  user_type = 'guardian'`;

    params = [schoolId];
  }

  /* ── Passo B: Procura de Tokens (ambas as tabelas em paralelo) ── */
  const [newRes, legacyRes] = await Promise.all([
    pool.query(newQ, params),
    pool.query(legacyQ, params),
  ]);

  /* Deduplicação: o mesmo token pode estar nas duas tabelas */
  const tokenToTable = new Map<string, "new" | "legacy">();
  for (const row of legacyRes.rows) {
    if (row.token) tokenToTable.set(row.token as string, "legacy");
  }
  /* new sobrepõe legacy — registos mais recentes têm prioridade de cleanup */
  for (const row of newRes.rows) {
    if (row.token) tokenToTable.set(row.token as string, "new");
  }

  return { allTokens: [...tokenToTable.keys()], tokenToTable };
}

/* ── Envio FCM com tracking de tokens inválidos ────────────────── */

function isStaleToken(errorBody: { error?: { status?: string; details?: { errorCode?: string }[]; message?: string } }): boolean {
  const err = errorBody?.error;
  if (!err) return false;

  /* FCM v1: verifica status + detalhes */
  if (err.status && STALE_CODES.has(err.status)) return true;
  if (err.details?.some(d => d.errorCode && STALE_CODES.has(d.errorCode))) return true;

  /* Mensagens legacy */
  const msg = err.message ?? "";
  if (STALE_MSG_FRAGMENTS.some(f => msg.includes(f))) return true;

  return false;
}

/**
 * Envia um batch de tokens via FCM REST API v1.
 * Devolve os tokens marcados como inválidos pelo FCM para limpeza posterior.
 *
 * @param creds      - Credenciais do serviço Google (service account)
 * @param tokens     - Lista de tokens FCM (máx. BATCH_SIZE)
 * @param title      - Título da notificação
 * @param body       - Corpo da notificação
 * @param extraData  - Campos extra em `data` (e.g. comunicado_id)
 */
async function sendBatchAndCollectStale(
  creds:     { project_id: string; client_email: string; private_key: string },
  tokens:    string[],
  title:     string,
  body:      string,
  extraData: Record<string, string>
): Promise<{ sent: number; failed: number; staleTokens: string[] }> {

  const accessToken = await getFcmAccessToken(creds);
  const url = `https://fcm.googleapis.com/v1/projects/${creds.project_id}/messages:send`;

  let sent = 0;
  let failed = 0;
  const staleTokens: string[] = [];

  /* ── Passo C: Agrupamento / Batching ── */
  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (token) => {
        const resp = await fetch(url, {
          method:  "POST",
          headers: {
            Authorization:  `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title, body },
              data: extraData,
              webpush: {
                notification: { title, body, requireInteraction: false },
              },
            },
          }),
        });

        if (resp.ok) {
          return { token, ok: true };
        }

        const errBody = await resp.json().catch(() => ({})) as {
          error?: { status?: string; details?: { errorCode?: string }[]; message?: string };
        };

        /* ── Passo 4: Detecção de token órfão ── */
        return { token, ok: false, stale: isStaleToken(errBody), errBody };
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled") {
        if (r.value.ok) {
          sent++;
        } else {
          failed++;
          if (r.value.stale) staleTokens.push(r.value.token);
        }
      } else {
        /* Erro de rede — não sabemos se o token é inválido, não o removemos */
        failed++;
      }
    }
  }

  return { sent, failed, staleTokens };
}

/* ── Limpeza de Tokens Inválidos ───────────────────────────────── */

/**
 * Remove tokens reportados como inválidos pelo FCM.
 * Opera em ambas as tabelas para garantir consistência total do ledger.
 */
async function purgeStaleTokens(staleTokens: string[]): Promise<number> {
  if (staleTokens.length === 0) return 0;

  const [r1, r2] = await Promise.all([
    pool.query(
      `DELETE FROM guardian_device_tokens WHERE token_fcm = ANY($1::text[])`,
      [staleTokens]
    ),
    pool.query(
      `DELETE FROM fcm_device_tokens WHERE token = ANY($1::text[])`,
      [staleTokens]
    ),
  ]);

  const removed = (r1.rowCount ?? 0) + (r2.rowCount ?? 0);
  if (removed > 0) {
    console.log(`[push-worker] Tokens inválidos removidos: ${removed} (guardian_device_tokens: ${r1.rowCount}, fcm_device_tokens: ${r2.rowCount})`);
  }
  return removed;
}

/* ── Ponto de Entrada Público ──────────────────────────────────── */

/**
 * Dispara as push notifications para um comunicado publicado.
 *
 * Deve ser chamado de forma assíncrona (setImmediate / não-aguardado)
 * pelo endpoint HTTP para não bloquear a resposta ao cliente.
 *
 * @example
 *   setImmediate(() => {
 *     triggerComunicadoPush({ comunicadoId, schoolId, titulo, corpo, audiencia, turmaId })
 *       .catch(e => console.error("[push:trigger]", e));
 *   });
 */
export async function triggerComunicadoPush(params: TriggerPushParams): Promise<SendResult> {
  const {
    comunicadoId,
    schoolId,
    titulo,
    corpo,
    audiencia      = "todos",
    turmaId,
    encarregadoIds,
  } = params;

  console.log(`[push-worker] Início — comunicado #${comunicadoId}, escola ${schoolId}, audiência: ${audiencia}`);

  /* Carrega config FCM da escola */
  const config = await getFcmConfig();
  if (!config) {
    console.warn("[push-worker] FCM não configurado — nenhuma push enviada.");
    return { sent: 0, failed: 0, cleaned: 0, totalTokens: 0, batches: 0 };
  }

  const activeEnv = (config.active_env ?? "test") as "test" | "production";
  const creds     = config[activeEnv];

  if (!creds?.project_id || !creds?.client_email || !creds?.private_key) {
    console.warn(`[push-worker] Credenciais FCM do ambiente '${activeEnv}' incompletas.`);
    return { sent: 0, failed: 0, cleaned: 0, totalTokens: 0, batches: 0 };
  }

  /* Resolve tokens da audiência */
  const { allTokens } = await resolveTokens(schoolId, audiencia, turmaId, encarregadoIds);

  if (allTokens.length === 0) {
    console.log(`[push-worker] Nenhum dispositivo registado para audiência '${audiencia}'.`);
    return { sent: 0, failed: 0, cleaned: 0, totalTokens: 0, batches: 0 };
  }

  const totalBatches = Math.ceil(allTokens.length / BATCH_SIZE);
  console.log(`[push-worker] ${allTokens.length} tokens | ${totalBatches} batch(es) de ${BATCH_SIZE}`);

  /* Envia e recolhe tokens inválidos */
  const { sent, failed, staleTokens } = await sendBatchAndCollectStale(
    creds,
    allTokens,
    titulo,
    corpo,
    {
      comunicado_id: String(comunicadoId),
      escola_id:     String(schoolId),
      tipo:          "comunicado",
    }
  );

  /* Limpeza de tokens órfãos */
  const cleaned = await purgeStaleTokens(staleTokens);

  const result: SendResult = {
    sent,
    failed,
    cleaned,
    totalTokens: allTokens.length,
    batches:     totalBatches,
  };

  console.log(`[push-worker] Concluído — comunicado #${comunicadoId}:`, result);
  return result;
}
