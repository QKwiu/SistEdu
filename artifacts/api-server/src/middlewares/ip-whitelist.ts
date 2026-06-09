/**
 * ip-whitelist.ts — Camada de Rede: Whitelist de IPs regulamentares (EMIS / Bancos Angola)
 *
 * Rejeita imediatamente com HTTP 403 qualquer tráfego externo que não pertença
 * aos blocos CIDR autorizados pela EMIS/BNA:
 *   • 196.46.0.0/16  — BNA / EMIS Angola
 *   • 197.156.64.0/18 — Bancos comerciais angolanos
 *
 * Uso: aplique este middleware APENAS nas rotas de callback/webhook do banco
 * (ex: notificação de liquidação GPO, confirmação SDD).
 * NÃO aplique em rotas chamadas diretamente pelo frontend.
 *
 * Exemplo:
 *   router.post("/school/splitpay/callback/gpo", emisIpWhitelist, handleGpoCallback);
 */

import type { Request, Response, NextFunction } from "express";

/** Blocos CIDR autorizados pela EMIS / Bancos angolanos */
const EMIS_CIDR_RANGES: readonly { network: string; prefix: number }[] = [
  { network: "196.46.0.0",   prefix: 16 },  // BNA / EMIS Angola
  { network: "197.156.64.0", prefix: 18 },  // Bancos comerciais angolanos
];

/** Converte um endereço IPv4 (ex: "196.46.1.2") num inteiro sem sinal de 32 bits */
function ipv4ToUint32(ip: string): number {
  return ip
    .split(".")
    .reduce((acc, octet) => ((acc << 8) | parseInt(octet, 10)) >>> 0, 0);
}

/** Verifica se `ip` pertence ao bloco CIDR definido por `network/prefix` */
function isIpInCidr(ip: string, network: string, prefix: number): boolean {
  // Máscara de sub-rede: deslocar 0 bits mantém 0xFFFFFFFF para prefix=32
  const mask = prefix === 0 ? 0 : ((~0 << (32 - prefix)) >>> 0);
  return (ipv4ToUint32(ip) & mask) === (ipv4ToUint32(network) & mask);
}

/** Devolve true se o IP pertence a pelo menos um dos blocos EMIS autorizados */
function isEmisAuthorized(ip: string): boolean {
  return EMIS_CIDR_RANGES.some(({ network, prefix }) =>
    isIpInCidr(ip, network, prefix)
  );
}

/**
 * Middleware de whitelist EMIS.
 *
 * Em desenvolvimento/teste (NODE_ENV !== "production") o loopback é sempre permitido
 * para facilitar testes locais sem simular IPs bancários.
 */
export function emisIpWhitelist(req: Request, res: Response, next: NextFunction): void {
  // O Replit usa proxy reverso — req.ip já tem o IP real graças a `app.set("trust proxy", 1)`
  const rawIp = req.ip ?? req.socket.remoteAddress ?? "";
  // Remove prefixo IPv4-in-IPv6 (::ffff:) se presente
  const ip = rawIp.replace(/^::ffff:/, "");

  // Em dev/staging: loopback sempre autorizado (testes locais + Replit preview)
  if (process.env.NODE_ENV !== "production") {
    if (ip === "127.0.0.1" || ip === "::1" || ip === "") {
      return next();
    }
  }

  if (!isEmisAuthorized(ip)) {
    res.status(403).json({
      error: "Acesso proibido: origem de tráfego não pertence aos blocos EMIS/BNA autorizados.",
      code:  "IP_NOT_IN_EMIS_WHITELIST",
    });
    return;
  }

  next();
}
