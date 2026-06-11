---
name: Propinas estado model
description: How DB statuses map to the 6 computed display states returned by GET /guardian/alunos/:id/propinas
---

## The 6 display states

| Estado     | Condition (DB)                                      | Colour  |
|------------|-----------------------------------------------------|---------|
| ACTIVA     | status=pendente AND active EMIS ref (PENDENTE)      | blue    |
| FUTURA     | status=pendente AND no active EMIS ref              | violet  |
| VENCIDA    | status=vencido                                      | red     |
| PRE_PAGO   | status=pre_pago                                     | emerald |
| PAGO       | status=pago OR pago_com_atraso                      | green   |
| PAGO_ANULADO | status=pago_anulado                               | orange  |

## Key rule
ACTIVA vs FUTURA is **computed at query time** via LEFT JOIN on pagamentos (estado='PENDENTE'). Neither is a stored DB status — both map to DB status `pendente`.

**Why:** EMIS references have a lifecycle (expire, get cancelled). Deriving from the join means the state auto-updates without a background job.

## Frontend filter mapping (encarregado.tsx)
- `PENDENTE` filter tab → shows ACTIVA + VENCIDA (actionable items)
- `VENCIDO` filter tab → shows VENCIDA only
- `PAGO` filter tab → shows PAGO + PAGO_ANULADO + PRE_PAGO
- FUTURA only visible in the "Pagamentos Antecipados" menu, never in the main propinas list

## Selectable in main list
Only ACTIVA and VENCIDA are `isSelectable`. FUTURA, PRE_PAGO, PAGO, PAGO_ANULADO are not.
