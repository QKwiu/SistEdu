/**
 * fines-engine.ts — single source of truth for fine (multa) calculation logic.
 * (DRY: replaces duplicate logic in applyFinesForSchool (school.ts) and calcMultaParaPropina (reports.ts))
 *
 * Supports three models:
 *   Model 1 — Fixed percentage: applied after dia_limite (day-of-month) or in previous months
 *   Model 2 — Escalões (brackets): matched by DAYS OVERDUE (not day-of-month)
 *   Model 3 — Fixed value (AOA): applied after dia_limite or in previous months
 */

export interface FinesRegra {
  modelo: number;
  percentagem: number;
  valor_fixo: number;
  dia_limite: number;
  dias_carencia: number;
  aplica_automatico?: boolean;
  brackets?: Array<{ dia_inicio: number; dia_fim: number; percentagem: number }>;
}

export interface CalcFineParams {
  montante: number;
  dataVencimento: Date;
  regra: FinesRegra | null;
  /** Pass current date for testability; defaults to new Date() */
  now?: Date;
}

export interface CalcFineResult {
  multa: number;
  daysOverdue: number;
  withinGrace: boolean;
  modelo: number | null;
}

/**
 * Calculate the fine amount for a single propina.
 * Pure function — no side effects, no DB calls.
 */
export function calcFine({ montante, dataVencimento, regra, now: _now }: CalcFineParams): CalcFineResult {
  const now = _now ?? new Date();
  const today = now.getDate();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth();

  const daysOverdue = Math.max(
    0,
    Math.floor((now.getTime() - dataVencimento.getTime()) / (1000 * 60 * 60 * 24))
  );

  const isPreviousMonth =
    dataVencimento.getFullYear() < thisYear ||
    (dataVencimento.getFullYear() === thisYear && dataVencimento.getMonth() < thisMonth);

  if (!regra) return { multa: 0, daysOverdue, withinGrace: false, modelo: null };

  const diasCarencia = Number(regra.dias_carencia ?? 0);
  if (daysOverdue <= diasCarencia) {
    return { multa: 0, daysOverdue, withinGrace: true, modelo: Number(regra.modelo) };
  }

  const modelo = Number(regra.modelo ?? 1);
  let multa = 0;

  if (modelo === 1) {
    if (isPreviousMonth || today > Number(regra.dia_limite)) {
      multa = montante * (Number(regra.percentagem) / 100);
    }
  } else if (modelo === 2) {
    const brackets = Array.isArray(regra.brackets) ? regra.brackets : [];
    if (brackets.length > 0) {
      let matched = false;
      for (const b of brackets) {
        if (daysOverdue >= Number(b.dia_inicio) && daysOverdue <= Number(b.dia_fim)) {
          multa = montante * (Number(b.percentagem) / 100);
          matched = true;
          break;
        }
      }
      if (!matched && daysOverdue > Number(brackets[brackets.length - 1].dia_fim)) {
        multa = montante * (Number(brackets[brackets.length - 1].percentagem) / 100);
      }
    }
  } else if (modelo === 3) {
    if (isPreviousMonth || today > Number(regra.dia_limite)) {
      multa = Number(regra.valor_fixo);
    }
  }

  return { multa, daysOverdue, withinGrace: false, modelo };
}
