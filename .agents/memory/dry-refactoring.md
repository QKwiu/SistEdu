---
name: DRY refactoring — shared utilities
description: Shared files created to eliminate code duplication; import patterns and aliases for new code.
---

## Frontend shared files (artifacts/kiwara-tech/src/)

| Ficheiro | Exportações chave | Substitui |
|---|---|---|
| `lib/format.ts` | `fmtCurrency`, `fmtNumber`, `fmtDate`, `fmtDateLong`, `fmtMonth` | `fmt`, `fmtKz`, `fmtDate` inline em dashboard/encarregado/admin |
| `lib/print.ts` | `printHtml(html, title, css)`, `printDocument(opts)` | `window.open + document.write + window.print()` em 7 locais |
| `lib/api-client.ts` | `createApiClient(tokenKey)`, `apiGet/apiPost/apiPut/apiDelete` | fetch manual com headers em admin-dashboard e futuro código |
| `hooks/use-api-mutation.ts` | `useApiMutation(fn, opts)` → `{ mutate, saving, error }` | saving/setError/try/catch repetidos ~15 vezes |
| `hooks/use-search.ts` | `useSearch(data, keys)` → `{ search, setSearch, filtered }` | `.filter(s => s.nome.toLowerCase().includes(...))` em ~10 locais |
| `types/domain.ts` | `Propina`, `GeneratedRef`, `EmolItem`, `Comunicado`, `Aluno`, `Turma`, `MultaRegra` | Interfaces redefinidas em dashboard/encarregado/StaffPortal |
| `components/ui/form-field.tsx` | `FormField`, `inputCls`, `selectCls`, `labelCls` | `Field` e `inputCls` idênticos em dashboard.tsx e admin-dashboard.tsx |

## Backend shared files (artifacts/api-server/src/)

| Ficheiro | Exportações chave | Substitui |
|---|---|---|
| `middlewares/school-auth.ts` | `schoolAuth` (token extractor), `schoolAuthFull` (DB lookup), `getSchoolFromToken` | Duplicado em school.ts, splitpay.ts, reports.ts, infant.ts, etc. |
| `lib/fines-engine.ts` | `calcFine({ montante, dataVencimento, regra })` → `{ multa, daysOverdue, withinGrace }` | `applyFinesForSchool` (school.ts) e `calcMultaParaPropina` (reports.ts) |
| `lib/route-handler.ts` | `handle(asyncFn)` → RequestHandler com try/catch | `try { ... } catch (e) { res.status(500).json(...) }` em todos os handlers |

## Aliases usados nos ficheiros editados

- `dashboard.tsx`: `import { fmtCurrency as fmt, fmtDate } from "@/lib/format"` — `fmt(n)` produz "X AOA"
- `encarregado.tsx`: `import { fmtCurrency, fmtDate as fmtShort, fmtDateLong as fmtDate } from "@/lib/format"` + `const fmt = (v) => fmtCurrency(v, "Kz")` para manter sufixo "Kz"
- `admin-dashboard.tsx`: `import { fmtNumber as fmt, fmtCurrency as fmtCur }` + `const api = createApiClient(TOKEN_KEY)`

**Why:** `encarregado.tsx` usa "Kz" em vez de "AOA" — é escolha de UX, não mudar sem validar com o cliente.
**How to apply:** Para novo código em qualquer page, importar de `@/lib/format` e `@/components/ui/form-field` em vez de redefinir inline.
