import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extrai a mensagem de um erro de forma type-safe.
 * Substitui o padrão `catch (err: any) { ... err.message }`.
 *
 * @example
 * try { ... } catch (err) { setError(errMsg(err)); }
 */
export function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return String(err);
}
