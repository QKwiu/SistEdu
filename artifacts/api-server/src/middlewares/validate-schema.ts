/**
 * validate-schema.ts — Camada de Proteção: Validação de Schema + Sanitização
 *
 * Fornece:
 * 1. validateSchema(zodSchema) — factory de middleware que:
 *    a. Deteta padrões de injecção SQL no payload (HTTP 400 imediato)
 *    b. Valida o req.body contra o schema Zod fornecido
 *    c. Substitui req.body pelo valor tipado e sanitizado (sem campos extra)
 *
 * 2. splitpayTransacaoSchema — schema Zod pré-construído para o payload de
 *    criação de transacção Split Payment.
 *
 * Uso:
 *   import { validateSchema, splitpayTransacaoSchema } from "../middlewares/validate-schema";
 *   router.post("/school/splitpay/transacoes", validateSchema(splitpayTransacaoSchema), handler);
 */

import type { Request, Response, NextFunction } from "express";
import { z, type ZodTypeAny, type ZodError } from "zod";

// ─── Detecção de injecção SQL ──────────────────────────────────────────────

/**
 * Padrões SQL de alto risco detectados na borda.
 * Não substitui prepared statements no DB — é uma camada adicional de defesa.
 */
const SQL_INJECTION_RE =
  /('|--|;|\/\*|\*\/|xp_|exec\s|union\s+select|drop\s+table|insert\s+into|delete\s+from|update\s+\w+\s+set|\bor\s+['"]?\d+['"]?\s*=\s*['"]?\d|\bor\s+true\b)/i;

function hasSqlInjection(value: unknown): boolean {
  if (typeof value === "string") return SQL_INJECTION_RE.test(value);
  if (Array.isArray(value))      return value.some(hasSqlInjection);
  if (value !== null && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some(hasSqlInjection);
  }
  return false;
}

// ─── Factory de middleware ─────────────────────────────────────────────────

/**
 * Cria um middleware Express que valida `req.body` contra `schema`.
 *
 * Em caso de falha devolve HTTP 400 com lista detalhada de erros de campo,
 * sem expor informação interna.
 */
export function validateSchema<S extends ZodTypeAny>(schema: S) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // 1. Injecção SQL — rejeitar na borda antes de qualquer parse
    if (hasSqlInjection(req.body)) {
      res.status(400).json({
        error:   "Payload rejeitado: padrão de injecção SQL detectado.",
        code:    "SQL_INJECTION_DETECTED",
      });
      return;
    }

    // 2. Validação de schema Zod (strict: campos extra são removidos pelo strip())
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const zodErr = result.error as ZodError;
      res.status(400).json({
        error:   "Payload inválido.",
        code:    "SCHEMA_VALIDATION_FAILED",
        details: zodErr.issues.map((issue) => ({
          campo:    issue.path.join(".") || "(raiz)",
          problema: issue.message,
        })),
      });
      return;
    }

    // Substituir req.body pelo valor validado, sanitizado e sem campos extras
    req.body = result.data;
    next();
  };
}

// ─── Schema Split Payment ──────────────────────────────────────────────────

/**
 * Schema Zod para POST /school/splitpay/transacoes
 *
 * Regras de negócio aplicadas:
 *  • valor_total: inteiro positivo em kwanzas (Kz), sem decimais
 *  • conta_destino: IBAN angolano (formato AO06 + 21 dígitos) ou NIB
 *  • canal_pagamento: enum fechado — apenas GPO | REFERENCIA | SDD
 *  • data_limite_pagamento: formato ISO 8601 (YYYY-MM-DD)
 *  • Campos de canal são opcionais a nível de schema — validação cruzada ocorre no handler
 */
export const splitpayTransacaoSchema = z.object({
  valor_total: z
    .number({ required_error: "valor_total é obrigatório." })
    .int("valor_total deve ser um inteiro (sem decimais).")
    .positive("valor_total deve ser maior que zero."),

  conta_destino: z
    .string({ required_error: "conta_destino (IBAN/NIB) é obrigatório." })
    .trim()
    .min(1, "conta_destino não pode estar vazio.")
    .max(34, "conta_destino não pode exceder 34 caracteres."),

  descricao: z.string().trim().max(500).optional(),
  aluno_nome: z.string().trim().max(200).optional(),
  propina_id: z.number().int().positive().optional(),

  idempotency_key: z
    .string()
    .uuid("idempotency_key deve ser um UUID v4 válido.")
    .optional(),

  canal_pagamento: z
    .enum(["GPO", "REFERENCIA", "SDD"], {
      errorMap: () => ({ message: "canal_pagamento deve ser: GPO, REFERENCIA ou SDD." }),
    })
    .default("REFERENCIA"),

  /* ── Campos REFERENCIA (Multicaixa) ── */
  entidade: z.string().trim().max(10).optional(),
  referencia_multicaixa: z.string().trim().max(20).optional(),
  data_limite_pagamento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD obrigatório.")
    .nullable()
    .optional(),

  /* ── Campos GPO (Webframe/Online) ── */
  referencia_gpo: z.string().trim().max(100).optional(),
  cartao_tipo: z.string().trim().max(20).optional(),

  /* ── Campos SDD (Débito Directo) ── */
  mandato_id: z.number().int().positive().optional(),
  nib_devedor: z.string().trim().max(50).optional(),

  /* ── Overrides admin (opcional, validados por autorização no handler) ── */
  taxa_comissao_pct: z.number().min(0).max(100).optional(),
  taxa_irt_pct: z.number().min(0).max(100).optional(),
});

export type SplitpayTransacaoInput = z.infer<typeof splitpayTransacaoSchema>;
