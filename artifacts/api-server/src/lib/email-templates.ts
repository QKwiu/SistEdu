/**
 * email-templates.ts — Motor de Templates de E-mail
 *
 * Carrega os templates HTML do sistema de ficheiros e substitui
 * os placeholders {{chave}} pelos valores fornecidos.
 *
 * TEMPLATES DISPONÍVEIS:
 *   nova-fatura         → Notificação de fatura emitida
 *   pagamento-confirmado→ Recibo digital de pagamento
 *   atraso-pagamento    → Aviso de cobrança / mora
 *   comunicado-geral    → Circular / comunicado institucional
 *
 * USO:
 *   const html = await renderEmailTemplate("nova-fatura", {
 *     nome_encarregado: "Maria Silva",
 *     nome_aluno:       "João Silva",
 *     nome_escola:      "Colégio Santo António",
 *     valor_aoa:        "45.000",
 *     data_vencimento:  "30 de Junho de 2026",
 *     ...
 *   });
 */

import { readFile } from "node:fs/promises";
import { join }     from "node:path";

/* ── Tipos ────────────────────────────────────────────────────── */

export type TemplateName =
  | "nova-fatura"
  | "pagamento-confirmado"
  | "atraso-pagamento"
  | "comunicado-geral";

/** Mapa de placeholders → valores. Chaves sem as {{ }}. */
export type TemplateVars = Record<string, string | number | undefined | null>;

/* ── Caminhos ──────────────────────────────────────────────────── */

const TEMPLATES_DIR = join(__dirname, "..", "templates", "email");

/* ── Cache em memória (evita I/O repetido em produção) ─────────── */

const _cache = new Map<TemplateName, string>();

async function loadTemplate(name: TemplateName): Promise<string> {
  if (_cache.has(name)) return _cache.get(name)!;

  const filePath = join(TEMPLATES_DIR, `${name}.html`);
  const content  = await readFile(filePath, "utf-8");
  _cache.set(name, content);
  return content;
}

/* ── Motor de substituição ─────────────────────────────────────── */

/**
 * Substitui todos os placeholders `{{chave}}` no template HTML.
 *
 * Valores undefined/null são substituídos por string vazia.
 * Valores numéricos são convertidos para string.
 */
function applyVars(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    const val = vars[key];
    if (val === undefined || val === null) return "";
    return String(val);
  });
}

/* ── API pública ───────────────────────────────────────────────── */

/**
 * Carrega e renderiza um template de e-mail com os valores fornecidos.
 *
 * @param name — identificador do template
 * @param vars — mapa de placeholders e valores
 * @returns HTML pronto a enviar via nodemailer / sendSchoolEmail()
 */
export async function renderEmailTemplate(
  name: TemplateName,
  vars: TemplateVars
): Promise<string> {
  const raw = await loadTemplate(name);
  return applyVars(raw, vars);
}

/** Invalida o cache (útil em testes ou hot-reload de desenvolvimento) */
export function clearTemplateCache(): void {
  _cache.clear();
}

/* ── Helpers de conveniência por tipo de e-mail ────────────────── */

/** Placeholders obrigatórios partilhados por todos os templates */
export interface BaseSchoolVars {
  nome_escola:     string;
  nome_encarregado: string;
  nome_aluno:      string;
  morada_escola?:  string;
  contacto_escola?: string;
  email_escola?:   string;
  ano_letivo?:     string;
}

export interface NovaFaturaVars extends BaseSchoolVars {
  numero_fatura:   string;
  descricao_fatura: string;
  valor_aoa:       string;
  data_vencimento: string;
  entidade_atm?:   string;
  referencia_atm?: string;
  iban?:           string;
}

export interface PagamentoConfirmadoVars extends BaseSchoolVars {
  numero_fatura:    string;
  descricao_fatura: string;
  valor_aoa:        string;
  data_pagamento:   string;
  metodo_pagamento: string;
  url_recibo:       string;
}

export interface AtrasoPagamentoVars extends BaseSchoolVars {
  numero_fatura:         string;
  descricao_fatura:      string;
  valor_original:        string;
  valor_multa:           string;
  total_com_multa:       string;
  descricao_multa:       string;
  data_vencimento_original: string;
  dias_atraso:           string | number;
  url_pagamento:         string;
}

export interface ComunicadoGeralVars extends BaseSchoolVars {
  assunto_comunicado:  string;
  corpo_comunicado:    string;
  data_comunicado:     string;
  categoria_comunicado?: string;
  audiencia_comunicado?: string;
  nome_diretor?:       string;
  cargo_diretor?:      string;
}

/** Renderiza o template "Nova Fatura" com tipos seguros */
export const renderNovaFatura = (v: NovaFaturaVars) =>
  renderEmailTemplate("nova-fatura", v as unknown as TemplateVars);

/** Renderiza o template "Pagamento Confirmado" com tipos seguros */
export const renderPagamentoConfirmado = (v: PagamentoConfirmadoVars) =>
  renderEmailTemplate("pagamento-confirmado", v as unknown as TemplateVars);

/** Renderiza o template "Atraso de Pagamento" com tipos seguros */
export const renderAtrasoPagamento = (v: AtrasoPagamentoVars) =>
  renderEmailTemplate("atraso-pagamento", v as unknown as TemplateVars);

/** Renderiza o template "Comunicado Geral" com tipos seguros */
export const renderComunicadoGeral = (v: ComunicadoGeralVars) =>
  renderEmailTemplate("comunicado-geral", v as unknown as TemplateVars);
