---
name: GPO checkout tipos
description: Two distinct GPO checkout flows for guardian propina payments; how they differ in backend logic and frontend UI
---

## Flow 1 — ISOLADO (single propina)
- Endpoint: `POST /guardian/propinas/checkout-isolado`
- Eligible estados: ACTIVA, VENCIDA
- gpo_checkout_attempts.tipo = 'ISOLADO' (default)
- Webhook: matches by reference (emis_entity + emis_reference on the propina)
- Frontend: `ModalPagamentoIsolado` component opened via `isoladoPropina` state

## Flow 2 — ANTECIPADO (batch future months)
- Endpoint: `POST /guardian/propinas/antecipadas/checkout`
- Eligible estados: FUTURA only (no active EMIS ref — validated on backend)
- gpo_checkout_attempts.tipo = 'ANTECIPADO'
- Webhook: **early-exit before reference lookup**, matches by transaction_id in gpo_checkout_attempts where tipo='ANTECIPADO', marks propina_ids as pre_pago
- Frontend: `PagamentosAntecipadosView` in the "antecipados" menu with multi-select

## Webhook routing order
1. Check tipo='ANTECIPADO' first (by transaction_id lookup)
2. If not found, fall through to reference-based lookup (ISOLADO / standard)

**Why:** ANTECIPADO propinas have no EMIS reference, so the reference-based lookup would fail silently if checked first.

## DB additions
- `gpo_checkout_attempts.tipo` — VARCHAR, default 'ISOLADO', added via ALTER TABLE ADD COLUMN IF NOT EXISTS
- `aluno_creditos` table — stores credits when a PRE_PAGO is cancelled via `/propinas/:id/anular-prepago`

## Hourly job (school.ts)
The day-25 EMIS reference generation job explicitly skips propinas with status `pre_pago` or `pago_anulado` to avoid creating duplicate references for already-handled months.
