/**
 * errors.ts — Utilitários de gestão de erros type-safe
 *
 * Substitui o padrão `catch (e: any) { ... e.message }` por
 * narrowing correcto sem verbose repetido em cada handler.
 */

/**
 * Extrai a mensagem de um erro de forma type-safe.
 * @example
 *   } catch (e) { res.status(500).json({ error: errMsg(e) }); }
 */
export function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return String(err);
}

/**
 * Normaliza qualquer valor de catch para um objecto Error.
 * @example
 *   } catch (raw) {
 *     const e = toError(raw);
 *     if (e.message.includes("does not exist")) { ... }
 *   }
 */
export function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  return new Error(typeof err === "string" ? err : String(err));
}
