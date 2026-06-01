---
name: Staff Portal
description: Portal separado para atendentes/tesoureiros em /staff — login, propinas, baixa manual, impressão de comprovativo.
---

## Architecture

- **Route**: `/staff` → `StaffPortal.tsx` (added to App.tsx)
- **Auth**: `staffAuth` middleware exported from `rbac.ts`; sessions stored in `staff_sessions` table
- **Backend endpoints** (all in `staff-portal.ts`):
  - `GET /school/staff/propinas` — lista propinas da escola do staff
  - `POST /school/staff/baixa-manual` — regista baixa manual (mesma lógica que admin, mas baixa_manual_por = staff nome+email)
- **Login endpoint** (in `rbac.ts`): `POST /school/rbac/staff/login` — retorna token + staff session info
- **Me endpoint**: `GET /school/rbac/staff/me` — info do staff autenticado
- **Logout**: `POST /school/rbac/staff/logout` — invalida token

## DB migration

`staff_sessions` table added to `runRBACMigration()` in `rbac.ts`:
```sql
CREATE TABLE IF NOT EXISTS staff_sessions (
  id SERIAL PRIMARY KEY,
  staff_id INTEGER NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Frontend localStorage keys
- `kiwara_staff_token`
- `kiwara_staff_session` (JSON: id, nome, email, school_id, school_name, school_nif, school_phone, role_nome)

## Success screen
After baixa manual succeeds, shows print receipt with format toggle (thermal 80mm / A4).
Print functions (`printCaixaFatura`, `printBaixaManualReceipt`) are inlined in StaffPortal.tsx.

**Why:** Staff users exist in staff_users table with bcrypt passwords but had no login portal. The admin creates staff via AccessManagement.tsx (Gestão de Acessos), then staff login at /staff.
