/**
 * idempotency.ts — Camada de Integridade: Idempotência Rígida via DB
 *
 * Protege rotas financeiras contra ataques de Replay e dupla submissão:
 *   1. Exige o header `X-Idempotency-Key` com um UUID v4 válido.
 *   2. Verifica na tabela `idempotency_keys` se a chave já foi processada.
 *      → Se existir: devolve a resposta cacheada (sem reexecutar o motor de split).
 *      → Se não existir: regista a chave e chama o handler original.
 *
 * A resposta é capturada via override de `res.json()` e guardada de forma
 * não-bloqueante após o envio, mantendo a latência da rota principal intacta.
 *
 * Uso:
 *   router.post("/school/splitpay/transacoes", idempotencyMiddleware, handler);
 */

import type { Request, Response, NextFunction } from "express";
import { pool } from "@workspace/db";

/** Padrão UUID v4 canónico — versão 4, variante RFC 4122 */
const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Migração idempotente — cria a tabela `idempotency_keys` se não existir.
 * Chame uma vez durante o arranque da aplicação.
 */
export async function runIdempotencyMigration(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      key         TEXT        PRIMARY KEY,
      status_code INTEGER     NOT NULL DEFAULT 200,
      body        JSONB,
      created_at  TIMESTAMP   NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_idem_created_at
      ON idempotency_keys (created_at);
  `);

  // Limpeza preventiva: remove chaves com mais de 24 h para evitar crescimento da tabela.
  // Seguro porque transacções reprocessadas após 24 h devem ser tratadas como novas.
  pool
    .query(`DELETE FROM idempotency_keys WHERE created_at < NOW() - INTERVAL '24 hours'`)
    .catch(() => { /* não bloqueia o arranque */ });
}

/**
 * Middleware de idempotência para rotas financeiras (POST).
 *
 * Fluxo:
 *   [Req] → valida UUID v4 → pesquisa no DB
 *              ├─ encontrada → devolve resposta cacheada (sem executar handler)
 *              └─ nova → passa para o handler → captura resposta → guarda no DB
 */
export function idempotencyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // 1. Verificar presença do header
  const key = req.headers["x-idempotency-key"] as string | undefined;

  if (!key) {
    res.status(400).json({
      error: "Header X-Idempotency-Key obrigatório para esta rota financeira.",
      code:  "MISSING_IDEMPOTENCY_KEY",
    });
    return;
  }

  // 2. Validar formato UUID v4
  if (!UUID_V4_RE.test(key)) {
    res.status(400).json({
      error: "X-Idempotency-Key deve ser um UUID v4 válido (ex: '550e8400-e29b-41d4-a716-446655440000').",
      code:  "INVALID_IDEMPOTENCY_KEY_FORMAT",
    });
    return;
  }

  // 3. Consultar DB de forma assíncrona
  pool
    .query("SELECT status_code, body FROM idempotency_keys WHERE key=$1", [key])
    .then((result) => {
      if (result.rows.length > 0) {
        // Chave já processada → devolver resposta cacheada (previne replay attack)
        const { status_code, body } = result.rows[0];
        res.set("X-Idempotency-Replayed", "true");
        res.status(status_code).json(body);
        return;
      }

      // Chave nova → interceptar res.json para capturar e guardar a resposta
      const originalJson = res.json.bind(res) as typeof res.json;
      res.json = function (body: unknown) {
        // Guardar de forma não-bloqueante (fire-and-forget)
        pool
          .query(
            `INSERT INTO idempotency_keys (key, status_code, body)
             VALUES ($1, $2, $3::jsonb)
             ON CONFLICT (key) DO NOTHING`,
            [key, res.statusCode || 200, JSON.stringify(body)]
          )
          .catch(() => { /* melhor esforço — não afeta a resposta ao cliente */ });

        return originalJson(body);
      };

      next();
    })
    .catch(() => {
      // Falha na infraestrutura de idempotência → deixar passar (degradação graciosa)
      // O handler subjacente tem a sua própria verificação de unicidade via UNIQUE na DB.
      next();
    });
}
