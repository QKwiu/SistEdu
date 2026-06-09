/**
 * rate-limiters.ts — Limitadores de taxa por camada de risco
 *
 * Hierarquia de proteção:
 *  • apiLimiter        — 300 req/min global (todas as rotas /api)
 *  • loginRateLimiter  — 20 tentativas / 15 min por IP (previne brute-force)
 *  • pinResetLimiter   — 5 pedidos / hora por IP (previne enumeração de PINs)
 *  • financialLimiter  — 10 req/min por IP+token (rotas do motor financeiro/split)
 *
 * O `financialLimiter` é o mais restritivo: rotas financeiras têm custo
 * computacional e impacto direto em contas bancárias — 10 req/min é mais
 * que suficiente para fluxos legítimos e bloqueia ataques de saturação.
 */

import rateLimit from "express-rate-limit";
import type { Request } from "express";

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas tentativas de login. Aguarde 15 minutos." },
});

export const pinResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados pedidos de reset de PIN. Aguarde 1 hora." },
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados pedidos. Aguarde um momento." },
  skip: (req) => req.method === "OPTIONS",
});

/**
 * Limitador para rotas financeiras sensíveis (Split Payment, liquidações, etc.)
 *
 * Limites:
 *  • 10 transacções por minuto por chave composta (IP + token de autorização)
 *  • Janela deslizante de 60 segundos
 *
 * Chave composta IP+token: previne que um atacante com múltiplos tokens
 * a partir do mesmo IP contorne o limite baseado apenas no IP, e vice-versa.
 *
 * Uso:
 *   router.post("/school/splitpay/transacoes", financialLimiter, handler);
 */
export const financialLimiter = rateLimit({
  windowMs: 60 * 1000,           // janela de 1 minuto
  max: 10,                       // máximo de 10 requisições por janela
  standardHeaders: true,         // devolve RateLimit-* headers (RFC 6585)
  legacyHeaders: false,          // não usar X-RateLimit-* (legado)
  message: {
    error: "Limite de transacções excedido. Máximo: 10 por minuto. Aguarde antes de retomar.",
    code:  "FINANCIAL_RATE_LIMIT_EXCEEDED",
  },
  skip: (req) => req.method === "OPTIONS",

  // Chave composta: IP + primeiros 16 chars do token Bearer
  // keyGeneratorIpFallback: false — suprime o aviso IPv6 do express-rate-limit v8.5.x
  // (opção correcta conforme ERR_ERL_KEY_GEN_IPV6; req.ip é normalizado pelo proxy Replit)
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req: Request): string => {
    const ip    = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const token = (req.headers.authorization ?? "").replace("Bearer ", "").slice(0, 16);
    return `${ip}:${token}`;
  },
});
