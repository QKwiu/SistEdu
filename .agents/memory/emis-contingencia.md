---
name: EMIS Contingência Plan
description: 6-layer EMIS contingency plan — health check, provisional refs, IBAN channel, comprovativo upload, school reconciliation, auto-restore.
---

## Architecture

**Backend:** `artifacts/api-server/src/routes/contingencia.ts` (all routes) + `emis.service.ts` (health/retry/restore functions)

**Frontend:** `encarregado.tsx` (guardian portal — IBAN banner + comprovativo modal) + `dashboard.tsx` (IBAN settings panel + Transferências subtab)

## 6 Layers

- **Camada 1** (preventive): daily at 08:00 on `dia_geracao_auto`, generates next-month propinas with EMIS refs via `requestEMISReferenceWithRetry`. Runs in `scheduleSchoolJobs` in `school.ts`.
- **Camada 2** (provisional refs): after 3 failed EMIS attempts, sets `status='contingencia'` and `referencia='PROV-[ANO]-[MES]-[ID]'`.
- **Camada 3** (IBAN channel): `GET /guardian/contingencia/status` returns `{emis_em_falha, iban_ativo, banco}`. `iban_ativo = emis_em_falha AND iban_visivel_em_contingencia`. Guardian portal shows IBAN banner + bank details on CONTINGENCIA cards.
- **Camada 4** (comprovativo): `POST /guardian/propinas/:id/comprovativo` accepts multipart form (data, valor, banco_origem, ref_transf + file). Sets status → `pago_manual_pendente`.
- **Camada 5** (reconciliation): `GET/POST /school/reconciliacao/manuais` — confirm (`pago_manual`) or reject (back to `contingencia`). Dashboard "Transferências" subtab with badge count for pending.
- **Camada 6** (auto-restore): health check every 15min. On EMIS restore (wasDown=true → isOk), calls `restoreEmisReferences` to replace PROV-* refs with official EMIS refs.

## New DB columns / tables

- `schools`: `banco_nome`, `banco_iban`, `banco_titular`, `banco_swift_bic`, `iban_visivel_em_contingencia`, `emis_em_falha`
- `propinas`: `comprovativo_url`, `comprovativo_data`, `comprovativo_banco_origem`, `comprovativo_ref_transf`, `comprovativo_valor`, `comprovativo_submetido_em`, `confirmado_por`, `confirmado_em`, `motivo_rejeicao`, `tentativas_emis`
- New tables: `emis_health_log`, `emis_reference_attempts`

## New propina statuses (DB → frontend display)

- `pago_manual_pendente` → `PAGO_MANUAL_PENDENTE` ("Aguarda confirmação" — sky badge, treated as isPaid)
- `pago_manual` → `PAGO_MANUAL` ("Pago (manual)" — emerald badge, shows "Ver Recibo")

**Why:** Auth functions (`schoolAuth`, `guardianAuth`, `getSchoolFromToken`, `getGuardianFromToken`) are NOT exported from their original files — duplicate them in `contingencia.ts`.
