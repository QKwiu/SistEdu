---
name: Guardian portal e.bi column bug
description: tabela encarregados não tem coluna bi — causava 500 em todas as rotas guardian após login
---

## Regra
A tabela `encarregados` **não tem** coluna `bi`. As colunas existentes são: `id, nome, telefone, email, password, first_login, escola_id, created_at`.

**Why:** A função `getGuardianFromToken` em `guardian.ts` tinha `e.bi` no SELECT. O postgres lançava `column e.bi does not exist` e devolvia 500 em todas as rotas autenticadas do guardian (alunos, comunicados, débito directo, etc).

**How to apply:** Se houver referências a `e.bi` em guardian.ts ou qualquer query sobre `encarregados`, remover — a coluna não existe. Se for necessário guardar BI do encarregado, adicionar uma migration antes de a referenciar.
