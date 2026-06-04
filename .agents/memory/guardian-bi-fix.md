---
name: Guardian portal invalid columns in getGuardianFromToken
description: tabela encarregados tem colunas limitadas — dois bugs de coluna inválida causavam 500 em rotas autenticadas
---

## Regra
A tabela `encarregados` tem exactamente estas colunas: `id, nome, telefone, email, password, first_login, created_at`.

**NÃO existem** as colunas `bi` nem `escola_id`.

**Why:** A função `getGuardianFromToken` em `guardian.ts` teve dois bugs consecutivos:
1. `e.bi` — removido (causava 500 em todas as rotas guardian)
2. `e.escola_id` — removido (causava 500 especificamente em `change-password` e outras rotas autenticadas)

Ambos causavam `column X does not exist` no postgres com 500 sem JSON, o que o frontend interpretava como HTML.

**How to apply:** Qualquer query sobre `encarregados e` deve usar apenas as colunas acima. Para adicionar dados de escola, fazer JOIN via `encarregado_aluno ea → schools sc`.
