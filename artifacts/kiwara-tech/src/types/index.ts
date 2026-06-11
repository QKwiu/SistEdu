/**
 * src/types/index.ts — Ponto central de tipos do frontend Kiwara Tech
 *
 * Directrizes de uso:
 *  1. Não alterar lógica de negócio — apenas tipos
 *  2. Manter compatibilidade com BD e contratos de API existentes
 *  3. Tipos financeiros (valores, IBANs, períodos) têm prioridade máxima
 *  4. Importar sempre de "@/types" em vez de "@/types/domain" directamente
 *
 * Estrutura:
 *  - domain.ts     → entidades de domínio e shapes de API (fonte da verdade)
 *  - index.ts      → barrel export + tipos financeiros utilitários adicionais
 */

/* ── Re-exporta todos os tipos de domínio ── */
export * from "./domain";

/* ══════════════════════════════════════════════════════════════
   PRIMITIVOS FINANCEIROS — tipos com semântica explícita
   (espelham o backend para type-safety ponta-a-ponta)
══════════════════════════════════════════════════════════════ */

/** Valor monetário em Kwanza (sem decimais) */
export type Kwanza = number;

/** Referência de pagamento EMIS (normalmente 9 dígitos) */
export type ReferenciaEMIS = string;

/** Entidade EMIS (normalmente 5 dígitos) */
export type EntidadeEMIS = string;

/** IBAN angolano — formato AO06 seguido de 21 dígitos */
export type IBAN = string;

/** Código BIC/SWIFT */
export type BIC = string;

/** Número de telefone angolano (+244 ou 9xx xxx xxx) */
export type Telefone = string;

/* ══════════════════════════════════════════════════════════════
   PERÍODO — mês (1-12) + ano (YYYY)
══════════════════════════════════════════════════════════════ */

/** Período de propina. `mes` é 1-indexed (1=Janeiro … 12=Dezembro) */
export interface Periodo {
  mes: number; /** 1–12 */
  ano: number; /** ex: 2025 */
}

/** Período representado como string: "MM/YYYY" */
export type PeriodoStr = string;

/* ══════════════════════════════════════════════════════════════
   SHAPES DE RESPOSTA DE API — contratos HTTP partilhados
══════════════════════════════════════════════════════════════ */

/** Resposta de erro padrão da API */
export interface ApiError {
  error: string;
  detalhes?: Record<string, string[]>;
  code?: string;
}

/** Resposta de sucesso genérica */
export interface ApiOk {
  ok: true;
  message?: string;
}

/** Resultado paginado genérico */
export interface PaginatedResult<T> {
  total: number;
  page: number;
  limit: number;
  items?: T[];
  logs?: T[];
  rows?: T[];
}

/* ══════════════════════════════════════════════════════════════
   UTILITÁRIOS DE TIPO
══════════════════════════════════════════════════════════════ */

/** Valor que pode ser nulo ou indefinido */
export type Maybe<T> = T | null | undefined;

/** Torna todas as propriedades de T opcionais em profundidade */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

/** Extrai o tipo dos elementos de um array */
export type ArrayElement<A> = A extends ReadonlyArray<infer E> ? E : never;

/** Resultado de operação que pode falhar (sem throw) */
export type Result<T, E = string> =
  | { ok: true;  value: T }
  | { ok: false; error: E };

/** Estado de um pedido assíncrono */
export type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error";   error: string };
