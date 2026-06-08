/**
 * domain.ts — shared domain interfaces (DRY: replaces definitions scattered across dashboard, encarregado, StaffPortal)
 */

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
  status: string;
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
  estado?: "PENDENTE" | "PAGO" | "VENCIDO";
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
  sexo?: string;
  numero_processo?: string;
  estado?: string;
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
  turno: string;
  total_alunos: number;
}

export interface Pacote {
  id: number;
  nome: string;
  valor: number;
  descricao?: string;
  itens?: unknown[];
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
