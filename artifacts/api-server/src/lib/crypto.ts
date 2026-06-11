/**
 * crypto.ts — Camada de Criptografia: Gestão de Secrets + AES-256-GCM
 *
 * Fornece dois serviços:
 *
 * 1. getSecret(name) — lê variáveis de ambiente de forma segura a partir dos
 *    Replit Secrets (process.env). Lança um erro explícito se o secret não
 *    estiver configurado, prevenindo falhas silenciosas em produção.
 *
 * 2. encryptAES / decryptAES — criptografia simétrica AES-256-GCM para dados
 *    sensíveis dos comerciantes (chaves API, NIBs, credenciais).
 *    • IV aleatório de 96 bits por operação (o mais seguro para GCM)
 *    • Auth tag de 128 bits garante integridade + autenticidade (previne adulteração)
 *    • Chave derivada de APP_ENCRYPTION_KEY via SHA-256 (aceita qualquer comprimento)
 *
 * Configuração obrigatória em Replit Secrets:
 *   APP_ENCRYPTION_KEY = <string aleatória segura, mínimo 32 caracteres>
 *
 * Uso típico:
 *   const encrypted = encryptAES(merchant.api_key_plaintext);
 *   await db.save({ api_key_iv: encrypted.iv, api_key_tag: encrypted.tag, api_key_ct: encrypted.ciphertext });
 *
 *   const plaintext = decryptAES({ iv, tag, ciphertext }); // apenas em memória, nunca em log
 */

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

// ─── Constantes do algoritmo ────────────────────────────────────────────────
const ALGORITHM  = "aes-256-gcm" as const;
const IV_BYTES   = 12;   // 96 bits — recomendado pelo NIST SP 800-38D para GCM
const TAG_BYTES  = 16;   // 128 bits — comprimento máximo do auth tag GCM
const KEY_BYTES  = 32;   // 256 bits — exige SHA-256 da passphrase de entrada

// ─── Gestão de Secrets ───────────────────────────────────────────────────────

/**
 * Lê um secret da memória de runtime (process.env / Replit Secrets).
 *
 * @throws Error se a variável não estiver definida ou estiver vazia.
 *         Nunca usa um fallback — falhas explícitas são preferíveis a segurança silenciosa.
 */
export function getSecret(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[security] Secret '${name}' não está definido nas variáveis de ambiente. ` +
      `Configure-o em Replit Secrets antes de iniciar a aplicação.`
    );
  }
  return value;
}

/**
 * Lê um secret opcional. Devolve `undefined` se não estiver configurado.
 * Use apenas para funcionalidades opcionais (ex: integrações desactiváveis).
 */
export function getOptionalSecret(name: string): string | undefined {
  return process.env[name] || undefined;
}

// ─── Derivação de chave ───────────────────────────────────────────────────────

/**
 * Deriva uma chave de 32 bytes (256 bits) a partir de APP_ENCRYPTION_KEY
 * usando SHA-256. Aceita passphrase de qualquer comprimento.
 */
function deriveKey(): Buffer {
  const passphrase = getSecret("APP_ENCRYPTION_KEY");
  return createHash("sha256").update(passphrase, "utf8").digest();
}

// ─── Tipos públicos ───────────────────────────────────────────────────────────

/**
 * Payload cifrado — todos os campos em hexadecimal.
 * Seguro para guardar na base de dados.
 */
export interface EncryptedPayload {
  /** IV aleatório de 96 bits (hex, 24 chars) */
  iv:         string;
  /** GCM Auth Tag de 128 bits — garante integridade (hex, 32 chars) */
  tag:        string;
  /** Dados cifrados (hex) */
  ciphertext: string;
}

// ─── Encriptar ────────────────────────────────────────────────────────────────

/**
 * Cifra um texto com AES-256-GCM.
 *
 * Cada chamada gera um IV único — nunca reutiliza IV com a mesma chave.
 *
 * @param plaintext — string UTF-8 a cifrar (chaves API, NIBs, etc.)
 * @returns EncryptedPayload — { iv, tag, ciphertext } em hexadecimal
 */
export function encryptAES(plaintext: string): EncryptedPayload {
  const key    = deriveKey();
  const iv     = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });

  const cipherBuf = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return {
    iv:         iv.toString("hex"),
    tag:        cipher.getAuthTag().toString("hex"),
    ciphertext: cipherBuf.toString("hex"),
  };
}

// ─── Decriptar ────────────────────────────────────────────────────────────────

/**
 * Decifra um payload AES-256-GCM.
 *
 * A verificação do auth tag detecta qualquer adulteração dos dados cifrados.
 * Nunca guarde o resultado em logs — use apenas em memória durante a execução.
 *
 * @param payload — EncryptedPayload devolvido por encryptAES()
 * @returns string UTF-8 original
 * @throws Error se o auth tag não corresponder (dados adulterados)
 */
export function decryptAES(payload: EncryptedPayload): string {
  const key     = deriveKey();
  const iv      = Buffer.from(payload.iv, "hex");
  const tag     = Buffer.from(payload.tag, "hex");
  const ctBytes = Buffer.from(payload.ciphertext, "hex");

  if (iv.length !== IV_BYTES) {
    throw new Error("[crypto] IV inválido: comprimento incorreto.");
  }
  if (tag.length !== TAG_BYTES) {
    throw new Error("[crypto] Auth tag inválido: comprimento incorreto.");
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ctBytes), decipher.final()]).toString("utf8");
}

// ─── Cifra de secrets de configuração (formato portátil) ─────────────────────

const ENC_PREFIX = "enc:" as const;

/**
 * Cifra um secret de configuração (ex: private_key FCM) com AES-256-GCM
 * e devolve uma string portátil no formato "enc:<iv>:<tag>:<ciphertext>".
 *
 * O formato pode ser guardado directamente num campo TEXT/JSONB da BD.
 * Usa a mesma APP_ENCRYPTION_KEY do encryptAES().
 */
export function encodeSecret(plaintext: string): string {
  const { iv, tag, ciphertext } = encryptAES(plaintext);
  return `${ENC_PREFIX}${iv}:${tag}:${ciphertext}`;
}

/**
 * Decifra um valor produzido por encodeSecret().
 *
 * Retrocompatível: se o valor NÃO começar com "enc:" (ex: valor em texto claro
 * existente antes da migração), devolve-o sem alterações.
 *
 * @throws Error se o formato enc: estiver malformado ou o auth tag falhar.
 */
export function decodeSecret(stored: string): string {
  if (!stored.startsWith(ENC_PREFIX)) return stored;
  const rest = stored.slice(ENC_PREFIX.length);
  const parts = rest.split(":");
  if (parts.length !== 3) throw new Error("[crypto] decodeSecret: formato inválido.");
  const [iv, tag, ciphertext] = parts;
  return decryptAES({ iv, tag, ciphertext });
}

// ─── Comparação segura ────────────────────────────────────────────────────────

/**
 * Compara dois buffers/strings em tempo constante para prevenir timing attacks.
 * Use para validar HMACs, tokens ou assinaturas webhook.
 */
export function safeEqual(a: string | Buffer, b: string | Buffer): boolean {
  const bufA = Buffer.isBuffer(a) ? a : Buffer.from(a, "utf8");
  const bufB = Buffer.isBuffer(b) ? b : Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
