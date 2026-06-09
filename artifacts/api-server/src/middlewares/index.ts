/**
 * middlewares/index.ts — Barrel de exportação dos middlewares de segurança
 *
 * Camadas disponíveis:
 *  • emisIpWhitelist      — Rede: bloqueia IPs fora dos blocos EMIS/BNA (HTTP 403)
 *  • idempotencyMiddleware — Integridade: idempotência DB-backed via X-Idempotency-Key
 *  • runIdempotencyMigration — Migração da tabela idempotency_keys (chamada no arranque)
 *  • validateSchema       — Sanitização + validação Zod (HTTP 400 em caso de falha)
 *  • splitpayTransacaoSchema — Schema Zod pré-construído para Split Payment
 *
 * Uso típico numa rota protegida:
 *
 *   import { emisIpWhitelist, idempotencyMiddleware, validateSchema }
 *     from "../middlewares";
 *   import { splitpayTransacaoSchema } from "../middlewares";
 *
 *   // Callback EMIS (apenas IPs bancários)
 *   router.post("/splitpay/callback/gpo", emisIpWhitelist, handleCallback);
 *
 *   // Criação de transacção (todas as camadas)
 *   router.post("/splitpay/transacoes",
 *     financialLimiter,
 *     schoolAuth,
 *     validateSchema(splitpayTransacaoSchema),
 *     idempotencyMiddleware,
 *     handleTransacao
 *   );
 */

export { emisIpWhitelist } from "./ip-whitelist";
export { idempotencyMiddleware, runIdempotencyMigration } from "./idempotency";
export { validateSchema, splitpayTransacaoSchema, type SplitpayTransacaoInput } from "./validate-schema";
