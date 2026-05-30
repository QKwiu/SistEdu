---
name: Caixa POS feature
description: Feature de faturação presencial com numeração sequencial por escola.
---

Tabela: `caixa_faturas` com unique index em `(escola_id, numero_seq)`.

Formato de numeração: `FC-YYYY-NNNNN` (ex: FC-2026-00001) por escola.

**Numeração sequencial:** `FOR UPDATE` não funciona com `MAX()` em PostgreSQL.
Solução: `pg_advisory_xact_lock(school_id)` dentro da transação, depois `SELECT MAX(numero_seq)+1`.

**Why:** `SELECT MAX(...) FOR UPDATE` lança `ERROR: FOR UPDATE is not allowed with aggregate functions`.

**How to apply:** Sempre que precisar de contador sequencial por escola numa transação, usar advisory lock:
```sql
BEGIN;
SELECT pg_advisory_xact_lock($school_id);
SELECT COALESCE(MAX(numero_seq),0)+1 FROM caixa_faturas WHERE escola_id=$school_id;
INSERT ...;
COMMIT;
```

**Impressão:** Usa `window.open()` com HTML completo em popup. `window.print()` + `window.onafterprint = close`.
Dois formatos: thermal 80mm (monospace, 80mm width) e A4 (Arial, padding 40px).
Popups podem ser bloqueados — mostrar aviso ao utilizador se necessário.

**RBAC module key:** `caixa_fatura` (adicionado ao MODULES em AccessManagement.tsx).
