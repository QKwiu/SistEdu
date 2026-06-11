---
name: Type safety correction guidelines
description: Rules for all TypeScript/security corrections in Kiwara Tech — what to change and what to preserve.
---

## Rules (confirmed by user — maximum priority)

1. **Never alter business logic** — corrections are types-only. Do not refactor, rename, or reorder logic during a type audit.

2. **Preserve DB and API contracts** — field names, status strings, and response shapes must match exactly what the DB stores and what the API returns. Do not rename `school_id` to `schoolId`, `mes` to `month`, etc.

3. **Financial types have maximum priority** — always type:
   - Monetary values as `Kwanza = number` (never `any` or `string`)
   - EMIS references as `ReferenciaEMIS = string`
   - EMIS entities as `EntidadeEMIS = string`
   - IBANs as `IBAN = string`
   - Periods as `Periodo { mes: number; ano: number }` or `PeriodoStr = string`

4. **Use the central type files** — always import from:
   - Frontend: `@/types` (barrel at `src/types/index.ts`) — re-exports domain.ts + financial primitives
   - Backend: `../types` or `./types` pointing to `src/types/index.ts`
   - Never import from `@/types/domain` directly in new code

**Why:** Centralising types prevents drift between frontend and backend contracts. Financial type aliases make monetary bugs visible at compile time.

**How to apply:**
- Before adding a new `number` for a money value, check if `Kwanza` applies.
- Before adding a new `string` for a reference, check if `ReferenciaEMIS` or `IBAN` applies.
- When creating a new shared type, add it to `src/types/index.ts` (both projects if needed).
- When fixing `req: any` or `res: any`, use Express `Request`/`Response`/`NextFunction` — never introduce new `any`.
