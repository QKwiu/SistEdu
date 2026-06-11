/**
 * src/types/index.ts — Tipos partilhados do backend Kiwara Tech
 *
 * Directrizes de uso:
 *  1. Não alterar lógica de negócio — apenas tipos
 *  2. Manter compatibilidade com BD e contratos de API existentes
 *  3. Tipos financeiros (valores, IBANs, períodos) têm prioridade máxima
 *  4. Este ficheiro é o ponto central de importação para tipos partilhados
 *
 * Convenção:
 *  - `type` → branded primitives, unions, aliases computados
 *  - `interface` → formas de objectos, entidades, contratos de API
 */

/* ══════════════════════════════════════════════════════════════
   PRIMITIVOS FINANCEIROS — tipos com semântica explícita
══════════════════════════════════════════════════════════════ */

/** Valor monetário em Kwanza angolano (inteiro, sem decimais) */
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
   PERÍODO DE PROPINA — mês (1-12) + ano (YYYY)
══════════════════════════════════════════════════════════════ */

/** Período de propina. `mes` é 1-indexed (1=Janeiro … 12=Dezembro) */
export interface Periodo {
  mes: number; /** 1–12 */
  ano: number; /** ex: 2025 */
}

/** Período como string usada na BD: "mes/ano" ou "MM/YYYY" */
export type PeriodoStr = string;

/* ══════════════════════════════════════════════════════════════
   IDs DE ENTIDADES DA BD
══════════════════════════════════════════════════════════════ */

export type SchoolId    = number;
export type StudentId   = number;
export type GuardianId  = number;
export type PropinasId  = number;
export type StaffId     = number;
export type TurmaId     = number;
export type PacoteId    = number;

/* ══════════════════════════════════════════════════════════════
   STATUSES DA BASE DE DADOS — contratos imutáveis com a BD
══════════════════════════════════════════════════════════════ */

/** Status de propina como guardado na BD (minúsculas) */
export type PropinaStatusDB =
  | "pendente"
  | "pago"
  | "vencido"
  | "isento"
  | "contingencia"
  | "pago_manual_pendente"
  | "pago_manual";

/** Status de mandato Débito Directo */
export type DDMandatoStatus = "ACTV" | "SUSP" | "CANC" | "EXPRD";

/** Status de pagamento EMIS */
export type EMISStatus = "PENDING" | "PAID" | "FAILED" | "EXPIRED";

/** Status de log de SMS */
export type SMSStatus = "PENDING" | "SENT" | "FAILED" | "DELIVERED";

/** Status de log de e-mail */
export type EmailStatus = "PENDING" | "SENT" | "FAILED";

/* ══════════════════════════════════════════════════════════════
   SHAPES DE RESPOSTA DE API — contratos HTTP
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
  rows?: T[];
}

/** Referência de pagamento EMIS gerada */
export interface ReferenciaGerada {
  entidade:          EntidadeEMIS;
  referencia:        ReferenciaEMIS;
  valor:             Kwanza;
  validade:          string; /** ISO date */
  total_base?:       Kwanza;
  total_multa?:      Kwanza;
  total_emolumentos?: Kwanza;
}

/* ══════════════════════════════════════════════════════════════
   SESSÕES / AUTENTICAÇÃO
══════════════════════════════════════════════════════════════ */

/** Contexto da escola extraído do JWT de sessão */
export interface EscolaSession {
  school_id:   SchoolId;
  school_name: string;
  /** URL do logótipo, se configurado */
  logo_url?: string;
}

/** Contexto do encarregado extraído do JWT de sessão */
export interface EncarregadoSession {
  id:    GuardianId;
  nome:  string;
  email: string;
  telefone?: Telefone;
}

/** Contexto do staff extraído do JWT de sessão */
export interface StaffSession {
  id:        StaffId;
  school_id: SchoolId;
  email:     string;
  nome:      string;
  role_nome: string;
}

/* ══════════════════════════════════════════════════════════════
   UTILITÁRIOS
══════════════════════════════════════════════════════════════ */

/** Torna todas as propriedades de T opcionais em profundidade */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

/** Extrai o tipo dos elementos de um array */
export type ArrayElement<A> = A extends ReadonlyArray<infer E> ? E : never;

/** Resultado de operação que pode falhar */
export type Result<T, E = string> =
  | { ok: true;  value: T }
  | { ok: false; error: E };

/* ══════════════════════════════════════════════════════════════
   RE-EXPORTAÇÃO — express.d.ts continua separado (declaração global)
══════════════════════════════════════════════════════════════ */
// Nota: express.d.ts usa `declare global` e não pode ser re-exportado aqui.
// Importar tipos do Express directamente de "express" quando necessário.
