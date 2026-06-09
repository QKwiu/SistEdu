---
name: SDD ISO 20022 Admin Panel
description: Detalhes de implementação do painel de geração/submissão pain.008.001.02 e regras de tipagem ssh2.
---

## Regra ssh2 TypeScript
ssh2@1.17.0 não inclui declarações TypeScript separadas (@types/ssh2 não existe).
Importar sempre via require para evitar erros de tipagem:
```typescript
const { Client: Ssh2Client } = require("ssh2") as { Client: new () => any };
```
Todos os callbacks ssh2 precisam de tipo explícito `any`: `(err: any, sftp: any) => ...`

**Why:** tsc falha com TS7016 ao usar `import { Client } from "ssh2"` porque o módulo não tem declaration file reconhecido pelo compilador no ambiente Replit pnpm.

**How to apply:** Qualquer futuro uso de ssh2 neste projecto deve seguir este padrão de import.

## Tabela sdd_emissor_configs
```sql
school_id UNIQUE, creditor_id, creditor_name, creditor_iban, creditor_bic,
sequence_type ENUM('FRST','RCUR','FNAL','OOFF'),
sftp_host, sftp_port, sftp_user, sftp_outbox_path, sftp_inbox_path,
creds_iv, creds_tag, creds_ct  -- AES-256-GCM das credenciais SFTP/SSH
```
Credenciais guardadas como JSON cifrado: `{ sftp_password, ssh_private_key }`.

## Endpoints admin (sdd.ts)
- GET/PUT `/admin/colegios/:id/sdd-config`
- GET `/admin/colegios/:id/sdd/batches`
- POST `/admin/colegios/:id/sdd/generate-batch` — body: `{ collection_date, max_batch? }`
- GET `/admin/colegios/:id/sdd/batches/:bid/download` — envia XML como attachment
- POST `/admin/colegios/:id/sdd/batches/:bid/submit` — upload SFTP real com ssh2
- POST `/admin/colegios/:id/sdd/test-connection` — autentica SFTP + verifica outbox/inbox

## Frontend SddIso20022Panel
3 sub-tabs dentro de `SettingsView` tab "ISO 20022 SDD":
1. **emissor** — Creditor ID/Nome/IBAN/BIC + tipo sequência + creds SFTP (password/chave SSH PEM)
2. **lotes** — tabela dd_pain008_batches + botão gerar + download XML + submeter SFTP
3. **diagnostico** — botão testar SFTP + resultado latência + estado outbox/inbox

## Reutilização do motor DD existente
- `dd_pain008_batches` já existe em direct-debit.ts — sdd.ts não cria nova tabela
- `buildPain008Xml`, `validateIbanAngola`, `validateBic`, `escXml` não são exportados de direct-debit.ts — reimplementados em sdd.ts com assinatura ligeiramente diferente (seqType como argumento separado para o campo `<SeqTp>` no GrpHdr)
- A função `generateRef` também reimplementada localmente em sdd.ts
