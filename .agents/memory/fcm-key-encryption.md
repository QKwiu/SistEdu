---
name: FCM private_key encryption
description: Como a private_key FCM é cifrada em repouso na BD e decifrada nos pontos de uso.
---

## Regra
A `private_key` FCM é cifrada com `encodeSecret()` antes de ser guardada em `platform_config` (chave `fcm_config`), e decifrada com `decodeSecret()` imediatamente antes de ser usada para gerar o JWT OAuth2.

## Formato em BD
`private_key` é guardado como `"enc:<iv_hex>:<tag_hex>:<ct_hex>"` — a mesma APP_ENCRYPTION_KEY de `encryptAES`/`decryptAES`.

**Why:** A tabela `platform_config` é JSONB não cifrado; qualquer acesso à BD (dump, leak, query directa) expunha a chave privada RSA em plaintext.

## Como aplicar
- Cifrar: `PUT /admin/fcm-config` → `encryptFcmConfig(merged)` antes do INSERT/UPDATE (admin.ts)
- Decifrar para uso: `getFcmConfig()` em `fcm.ts` e `direct-debit.ts` chamam `decryptFcmConfigCreds()` que aplica `decodeSecret()` em cada ambiente (test/production/staging/dev)
- Decifrar para teste: `POST /admin/fcm-config/test` → `decryptFcmConfig(config)` antes de passar a `sendFcmBatch` (admin.ts)
- `GET /admin/fcm-config` devolve o valor cifrado masked ("***") — sem necessidade de decifrar
- `maskSecrets()` e `mergePreserveSecrets()` continuam a funcionar sem alteração (campo continua a chamar-se `private_key`)

## Retrocompatibilidade
`decodeSecret()` em `lib/crypto.ts`: se o valor não começar com `"enc:"`, é devolvido sem alterações → valores em plaintext existentes antes da migração continuam a funcionar.

## Helpers em lib/crypto.ts
- `encodeSecret(plaintext: string): string` — cifra e devolve `"enc:iv:tag:ct"`
- `decodeSecret(stored: string): string` — decifra se `enc:` ou devolve tal como está
