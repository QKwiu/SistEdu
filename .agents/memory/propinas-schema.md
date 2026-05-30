---
name: Propinas schema quirks
description: A tabela propinas usa school_id, não escola_id. Tem colunas de baixa manual e pagamento.
---

A tabela `propinas` usa `school_id` (não `escola_id` que não existe).

Colunas relevantes para baixa de pagamento:
- `status` TEXT — 'pendente' | 'pago' | 'vencido'
- `pago_em` TIMESTAMP
- `metodo_pagamento` TEXT
- `pagamento_origem` TEXT (default 'manual')
- `baixa_manual` BOOLEAN
- `baixa_manual_por` TEXT
- `baixa_manual_em` TIMESTAMP
- `baixa_manual_obs` TEXT

**Why:** Causou erro 500 na rota caixa/aluno-propinas por usar `p.escola_id` em vez de `p.school_id`.

**How to apply:** Ao escrever qualquer query sobre propinas, usar sempre `school_id`.
