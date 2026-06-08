/**
 * format.ts — shared formatting utilities (DRY: replaces inline fmt/fmtDate in dashboard, encarregado, admin-dashboard)
 */

/** Format a number with Angolan locale, with optional currency symbol */
export function fmtCurrency(val: number | string, symbol = "AOA"): string {
  const n = typeof val === "string" ? parseFloat(val) : val;
  return isNaN(n) ? `0 ${symbol}` : n.toLocaleString("pt-AO") + ` ${symbol}`;
}

/** Format a number without currency suffix (thousands separator only) */
export function fmtNumber(val: number | string): string {
  return Number(val).toLocaleString("pt-AO", { minimumFractionDigits: 0 });
}

/** Short date: "02 jan. 2024" */
export function fmtDate(d: string | Date): string {
  return new Date(d).toLocaleDateString("pt-AO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Long date: "02 janeiro 2024" */
export function fmtDateLong(d: string | Date): string {
  return new Date(d).toLocaleDateString("pt-AO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/** Month + year only: "janeiro 2024" */
export function fmtMonth(d: string | Date): string {
  return new Date(d).toLocaleDateString("pt-AO", {
    month: "long",
    year: "numeric",
  });
}
