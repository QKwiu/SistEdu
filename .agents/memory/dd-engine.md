---
name: Débito Directo DD engine
description: Motor ISO 20022 (PAIN.008/002) para EMIS SDD Angola; gaps e decisões de arquitectura
---

## Estado do motor
Motor completo em `artifacts/api-server/src/routes/direct-debit.ts`:
- State machine: PENDING → ACTV → SUSP → CANC / EXPRD
- Sequências FRST/RCUR/FNAL/OOFF
- Dias úteis angolanos (feriados na tabela `feriados_angola`)
- Pré-notificação 5 dias antes via FCM + SMS
- Re-apresentação automática só para AM04 (fundos insuficientes), máx. 2 tentativas
- Gerador PAIN.008 (ISO 20022 XML)
- Reconciliação PAIN.002
- 4 jobs diários (09:00 pré-notif, 10:00 instrução, 14:00 reconc, 23:00 expiração)
- 7 tabelas: `dd_mandates`, `dd_instructions`, `dd_collections`, `dd_reconciliation_reports`, `dd_events`, `dd_prenotifications`, `feriados_angola`

## testConnectivity (DebitoDiretoDriver)
Suporta 3 modos via campo `protocol` na config EMIS:
- **SOAP**: envia envelope SOAP mínimo a `soap_url` (fallback `ws_url`) com Basic Auth se `auth_type=basic`
- **REST**: POST OAuth2 client_credentials a `oauth_url`; verifica `access_token` na resposta; fallback ping `rest_url`
- **AMBOS**: tenta SOAP primeiro, se falhar tenta REST
- **Backward compat**: sem `protocol` → HEAD a `ws_url` (comportamento antigo)

## Frontend escola — DDCancelamentosView (4 tabs)
Localização: `artifacts/kiwara-tech/src/pages/dashboard.tsx` — componente `DDCancelamentosView`
- **Mandatos**: lista `dd_mandates` via `GET /school/dd/mandates`; filtros ACTV/SUSP/CANC/EXPRD; acções Reactivar/Cancelar para mandatos SUSP
- **PAIN.008**: date picker + max_batch + gera XML via `POST /school/dd/pain008/generate` + download
- **PAIN.002**: textarea JSON + `POST /school/dd/pain002/process` + resultado com contagens
- **Reconciliação**: tabela de relatórios via `GET /school/dd/reconciliation`

## Frontend encarregado — estados novos
`DDSubscriptionCard` em `encarregado.tsx` trata: ACTV, SUSP (laranja), CANC/cancelled (vermelho), EXPRD (cinza), cancellation_requested (âmbar), active (violeta).
