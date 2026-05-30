---
name: EMIS Payment Engine
description: Architecture decisions for the unified payment engine and admin EMIS config backoffice.
---

## Pattern
Strategy Pattern in `artifacts/api-server/src/services/payment-engine.ts`.  
`GpoDriver`, `MultiCaixaDriver`, `DebitoDiretoDriver` all implement `PaymentDriver`.  
`PaymentEngine.driver(channel)` selects by key: `"GPO_EMIS" | "MCX_REFERENCE" | "DIRECT_DEBIT"`.

## DB
`platform_config` table (key TEXT PK, value JSONB). Two rows: `emis_config` and `parametrizacao`.  
Migration runs at API startup (idempotent via ON CONFLICT DO NOTHING) inside `admin.ts`.

## Security
`maskSecrets()` replaces sensitive fields with `"***"` on all GET responses.  
`mergePreserveSecrets()` on PUT: if incoming value === `"***"`, keep existing DB value.  
Sensitive keys: `secret_key`, `api_key`, `ws_password`, `basic_pass`, `bearer_token`.

## Routes (all in admin.ts, protected by adminAuth)
- GET/PUT /admin/emis-config — EMIS credentials (gpo/mcx/debito_direto sections)
- POST /admin/emis-config/test/:service — connectivity ping via PaymentEngine
- GET/PUT /admin/parametrizacao — endpoints, ip_whitelist, auth
- POST /admin/parametrizacao/test-request — proxied HTTP test (REST/SOAP), 10s timeout
- POST /payments/gpo/initiate — GPO Webframe payload generator (HMAC-SHA256 checksum)

**Why:** admin is the only party that should see/set credentials. The `"***"` pattern avoids overwriting secrets when the frontend re-submits a form it cannot fully read.

## Frontend (admin-dashboard.tsx)
- `ConfiguracoesTecnicasView` — tabbed (GPO/MCX/DD), per-section save + connectivity test
- `ParametrizacaoView` — endpoints + IP whitelist + auth + integrated test tool
- `AdminView` type includes `"config_tecnicas" | "parametrizacao"`
- NAV entries use `Settings2` and `Network` icons
