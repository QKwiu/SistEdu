/**
 * domain.ts — Tipos de domínio partilhados (DRY: substitui definições dispersas)
 *
 * Convenção do projecto:
 *  - `interface`  → formas de objectos (entidades, props, contratos) — extensível com extends
 *  - `type`       → unions, intersecções, aliases de primitivos, tipos computados
 */

/* ══════════════════════════════════════════════════════════════
   STATUS / ESTADO — tipos literais e constante de referência
══════════════════════════════════════════════════════════════ */

/** Statuses tal como existem na base de dados (minúsculas — portal escola) */
export type PropinaStatusDB =
  | "pendente"
  | "pago"
  | "vencido"
  | "isento"
  | "contingencia"
  | "pago_manual_pendente"
  | "pago_manual";

/** Estados computados exibidos no portal do encarregado (maiúsculas) */
export type PropinaEstado =
  | "PENDENTE"
  | "PAGO"
  | "VENCIDO"
  | "ACTIVA"
  | "FUTURA"
  | "VENCIDA"
  | "CONTINGENCIA"
  | "PRE_PAGO"
  | "PAGO_ANULADO"
  | "ISENTO"
  | "PAGO_MANUAL_PENDENTE"
  | "PAGO_MANUAL";

/** Constante de referência — evita strings mágicas no código */
export const PROPINA_STATUS = {
  PENDENTE:             "pendente",
  PAGO:                 "pago",
  VENCIDO:              "vencido",
  ISENTO:               "isento",
  CONTINGENCIA:         "contingencia",
  PAGO_MANUAL_PENDENTE: "pago_manual_pendente",
  PAGO_MANUAL:          "pago_manual",
} as const satisfies Record<string, PropinaStatusDB>;

/* ══════════════════════════════════════════════════════════════
   ENTIDADES DE DOMÍNIO
══════════════════════════════════════════════════════════════ */

export interface Propina {
  id: number;
  student_id?: number;
  aluno_nome?: string;
  turma?: string;
  mes: string;
  ano: string;
  montante?: number;
  valor_base?: number;
  multa: number;
  desconto?: number;
  total?: number;
  /** Status na base de dados (lowercase). Para o display no portal escola. */
  status: PropinaStatusDB;
  /** Estado computado para display no portal encarregado (UPPERCASE). */
  estado?: PropinaEstado;
  data_vencimento: string;
  ref_numero?: string | null;
  ref_valor?: number | null;
  ref_estado?: string | null;
  ref_validade?: string | null;
  entidade?: string | null;
  referencia?: string | null;
  validade?: string | null;
  internal_reference?: string;
  pago_em?: string;
  baixa_manual?: boolean;
  baixa_manual_por?: string;
  baixa_manual_em?: string;
  baixa_manual_obs?: string;
  comprovante_url?: string;
  data_recebimento?: string;
  transaction_id?: string;
  metodo_pagamento?: string;
  pagamento_origem?: "manual" | "online";
  pagamento_id?: number | null;
  bolsa_atribuicao_id?: number | null;
  comprovativo_url?: string;
  comprovativo_data?: string;
  comprovativo_banco_origem?: string;
  comprovativo_ref_transf?: string;
  comprovativo_valor?: number;
  comprovativo_submetido_em?: string;
  motivo_rejeicao?: string;
}

export interface GeneratedRef {
  entidade: string;
  referencia: string;
  valor: number;
  validade: string;
  total_base?: number;
  total_multa?: number;
  total_emolumentos?: number;
  propinas?: { id: number; mes: string; ano: string; valor_base: number; multa: number; total: number }[];
  cobrancas?: { id: number; descricao: string; montante: string; quantidade: number; emolumento_nome?: string }[];
}

/** Resultado da endpoint POST /school/propinas/referencia (geração única ou em lote) */
export interface ReferenciaLoteResult {
  /** Uma ou mais referências geradas */
  referencias?: GeneratedRef[];
  total_geradas?: number;
  total_ja_existia?: number;
  total_erro?: number;
  /** Compatibilidade: quando a API retorna uma única ref directamente */
  entidade?: string;
  referencia?: string;
  valor?: number;
  validade?: string;
}

export interface PacoteItem {
  nome: string;
  valor: number;
  tipo?: "propina" | "emolumento" | "outro";
}

export interface EmolItem {
  key?: number;
  emolumento_id: number | null;
  emolumento_nome?: string;
  emolumento_tipo?: string;
  student_id: number | null;
  aluno_nome?: string;
  descricao: string;
  montante: number;
  quantidade: number;
}

export interface Comunicado {
  id: number;
  titulo: string;
  conteudo: string;
  prioridade: "normal" | "urgente" | "informativo";
  created_at: string;
  lido?: boolean;
}

export interface Aluno {
  id: number;
  nome: string;
  bilhete?: string;
  turma_id?: number;
  turma: string;
  turno?: string;
  nome_encarregado?: string;
  telefone_encarregado?: string;
  multa_total?: number;
  data_nascimento?: string;
  sexo?: "M" | "F" | "Outro";
  numero_processo?: string;
  estado?: "activo" | "inactivo" | "transferido" | "suspenso";
  propinas_pendentes: number;
  divida: number;
  pacote_id?: number | null;
  pacote_nome?: string | null;
  pacote_valor?: number | null;
}

export interface Turma {
  id: number;
  nome: string;
  ano: string;
  turno: "Manhã" | "Tarde" | "Noite" | string;
  total_alunos: number;
}

export interface Pacote {
  id: number;
  nome: string;
  valor: number;
  descricao?: string;
  itens?: PacoteItem[];
  activo: boolean;
}

export interface Bracket {
  dia_inicio: number;
  dia_fim: number;
  percentagem: number;
}

export interface MultaRegra {
  id: number;
  school_id: number;
  dia_limite: number;
  aplica_automatico: boolean;
  tipo_calculo: "fixa" | "percentual";
  valor: number;
  modelo: 1 | 2 | 3;
  percentagem: number;
  valor_fixo: number;
  dias_carencia: number;
  brackets: Bracket[];
}

/* ══════════════════════════════════════════════════════════════
   TIPOS COMPOSTOS — resultados de API e shapes de UI
══════════════════════════════════════════════════════════════ */

/** Resultado individual de geração de propina em lote */
export type PropinaDetalhe =
  | { ok: true;  aluno_id: number; aluno_nome: string; referencia?: string }
  | { ok: false; aluno_id: number; aluno_nome?: string; reason: "sem_montante" | "ja_existe" | "emis_falha" | string };

/** Resultado da endpoint POST /school/propinas/gerar-lote */
export interface GerarPropinaResult {
  total_geradas: number;
  total_skipped: number;
  total_alunos: number;
  periodos: number;
  total_referencias?: number;
  total_sms?: number;
  detalhes: PropinaDetalhe[];
}

/** Shape da situação financeira do aluno para impressão */
export interface SituacaoFinanceiraPropina {
  id: number;
  mes: string;
  ano: string;
  montante: number;
  multa: number;
  desconto?: number;
  status: PropinaStatusDB;
  pago_em?: string;
  data_vencimento?: string;
}

export interface SituacaoFinanceiraEmolumento {
  id: number;
  descricao: string;
  montante: number;
  status: string;
}

export interface SituacaoFinanceiraAluno {
  id: number;
  nome: string;
  turma?: string;
  numero_processo?: string;
  nome_encarregado?: string;
  telefone_encarregado?: string;
  pacote_nome?: string | null;
  pacote_valor?: number | null;
}

export interface SituacaoFinanceiraEscola {
  nome: string;
  logo_url?: string;
  nif?: string;
  morada?: string;
  phone?: string;
  telefone?: string;
}

export interface SituacaoFinanceiraBolsa {
  bolsa_nome?: string;
  nome?: string;
  bolsa_valor?: number;
  desconto?: number;
  tipo_desconto: "percentagem" | "fixo";
}

export interface SituacaoFinanceira {
  aluno: SituacaoFinanceiraAluno;
  escola: SituacaoFinanceiraEscola;
  propinas: SituacaoFinanceiraPropina[];
  emolumentos?: SituacaoFinanceiraEmolumento[];
  bolsa_activa?: SituacaoFinanceiraBolsa | null;
  multa_regra?: MultaRegra | null;
}
