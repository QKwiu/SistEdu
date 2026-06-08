/**
 * form-field.tsx — shared form Field component + inputCls (DRY: replaces identical definitions in dashboard.tsx and admin-dashboard.tsx)
 */

import React from "react";

interface FormFieldProps {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  /** Hint/description text shown below the field */
  hint?: string;
  /** Alias for hint (admin-dashboard uses `desc`) */
  desc?: string;
}

export function FormField({ label, children, required, hint, desc }: FormFieldProps) {
  const helpText = hint ?? desc;
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {helpText && <p className="text-xs text-slate-400 mt-1">{helpText}</p>}
    </div>
  );
}

/** Standard input class used across all form modals */
export const inputCls =
  "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white transition-all";

/** Standard select class (same as inputCls + appearance-none) */
export const selectCls = inputCls + " appearance-none";

/** Uppercase label style (used in admin-dashboard) */
export const labelCls =
  "block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1";
