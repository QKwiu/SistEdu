# PROMPT — Redesign: Módulo "Propinas & Faturas" · PropinaPlus

## Contexto
Estás a trabalhar no projecto **PropinaPlus** — plataforma B2B de gestão de pagamentos escolares para Angola.
O módulo **Propinas & Faturas** é o painel principal do gestor do colégio para criar e gerir cobranças.
O objectivo central deste módulo é: **gerar referências EMIS/Multicaixa para pagamento via portal OU registar baixas manuais de pagamentos presenciais.**

---

## O que fazer

Substitui a página/componente actual de `Propinas & Faturas` pela implementação descrita abaixo.
Mantém a stack existente (React + Vite + Tailwind / CSS existente). Não alteres rotas, autenticação nem lógica de backend.

---

## 1. INTENT BANNER (topo da página)

Banner azul de destaque logo abaixo do header, com:
- **Título:** `Criar e gerir cobranças de propinas`
- **Subtítulo:** `Gere referências EMIS para pagamento via portal, ou registe baixas manuais para pagamentos presenciais.`
- **2 botões à direita:**
  - `Gerar em Massa` (outline/secundário)
  - `Nova Propina / Referência` (primário branco)

---

## 2. KPI STRIP (4 cards horizontais)

Calculados a partir dos dados reais da listagem filtrada:

| Card | Valor | Cor |
|---|---|---|
| Total Emitido | soma de todas as propinas | neutro |
| Pagas | soma das pagas | verde |
| Pendentes | soma das pendentes | amarelo |
| Vencidas | soma das vencidas | vermelho |

---

## 3. TOOLBAR (filtros + tabs)

**Tabs de estado** (pill group):
`Todas` · `Pendentes` · `Vencidas` · `Pagas`

**Filtros dropdown:**
- Todos os alunos
- Todas as turmas
- Mês/Ano (ex: Janeiro 2027)
- Todos os métodos (EMIS · Manual · Portal)

**Botão direito:** `Exportar`

---

## 4. TABELA DE PROPINAS

Colunas:

| Coluna | Conteúdo |
|---|---|
| **Aluno** | Nome + ID interno (`#ALU-XXXX`) em fonte menor |
| **Turma** | Badge pill (ex: `11ª A`) |
| **Período** | Texto mês/ano (ex: `Janeiro 2027`) |
| **Total** | Valor em Kz com fonte monospace |
| **Estado & Método** | Badge de estado + tag de método separados (ver abaixo) |
| **Referência EMIS** | Código formatado se existir; `— sem referência` se não existir |
| **Acções** | Ícones contextuais por estado (ver abaixo) |

### Badges de estado
- `Pendente` → fundo amarelo claro, texto âmbar
- `Pago` → fundo verde claro, texto verde
- `Vencida` → fundo vermelho claro, texto vermelho

### Tags de método (secundária ao estado)
- `EMIS` → azul
- `Manual` → cinzento
- `Portal` → verde

### Acções por linha (contextuais ao estado)

**Pendente sem referência:**
- 🔗 Gerar referência EMIS
- ✓ Registar baixa manual
- 👁 Ver detalhes
- 🖨 Imprimir

**Pendente com referência:**
- 👁 Ver detalhes
- 🖨 Imprimir
- ↻ Renovar referência (se próximo do vencimento)

**Pago:**
- 👁 Ver detalhes
- 🖨 Imprimir recibo

**Vencida:**
- ✓ Registar baixa manual
- ↻ Renovar referência EMIS
- 👁 Ver detalhes
- ✕ Cancelar propina

Todos os botões de acção devem ter `tooltip` com descrição da acção.

---

## 5. PAINEL LATERAL — "Gerar Referência EMIS"

Abre como **drawer deslizante pela direita** (não modal/popup) ao clicar em "Gerar referência EMIS" ou "Nova Propina / Referência".

Conteúdo do drawer:

**Secção: Propina seleccionada**
- Nome do aluno, turma, período, valor (destacado, maior)

**Secção: Canal de pagamento** (toggle de 3 opções)
- 🏦 Referência EMIS
- 🌐 Portal Online
- ✋ Baixa Manual

**Secção: Configurar referência** (visível quando "Referência EMIS" seleccionado)
- Campo `Entidade EMIS` — preenchido automaticamente, readonly
- Campo `Data de validade` — date picker, default: último dia do mês da propina
- Campo `Descrição para o encarregado` — opcional, texto livre

**Preview da referência** (caixa destacada)
- Mostra o código gerado formatado: `XXX XXX XXX`
- Entidade, valor e validade

**Footer do drawer:**
- `Cancelar` (secundário)
- `Confirmar & Enviar ao Encarregado` (primário)

---

## 6. LINGUAGEM E CONSISTÊNCIA

Adopta estas denominações em toda a interface. Não mistures variantes:

| Usar | Não usar |
|---|---|
| `Referência EMIS` | "Referência", "Ref.", "Código" |
| `Registar Baixa Manual` | "Marcar como pago", "Baixa" |
| `Encarregado de Educação` | "Responsável", "Pai", "Guardian" |
| `Propina` | "Mensalidade", "Fee", "Fatura" (excepto quando é literalmente uma fatura fiscal) |
| `Período` | "Mês", "Data" |
| `Vencida` | "Em atraso", "Overdue" |

---

## 7. REGRAS DE NEGÓCIO A RESPEITAR

- Uma propina **só pode ter uma referência EMIS activa** por vez. Se já existe referência válida, o botão muda para "Renovar Referência".
- Propinas com estado `Pago` **não permitem** gerar nova referência nem registar baixa.
- A baixa manual **requer** campo obrigatório: data do pagamento + comprovativo (texto livre ou upload).
- Referências vencidas devem mostrar badge `Vencida` na coluna de estado, mas manter o código visível para auditoria.
- O valor da referência EMIS deve ser **exactamente igual** ao valor da propina — sem taxas adicionais no frontend.

---

## 8. O QUE NÃO ALTERAR

- Sidebar de navegação (estrutura e rotas)
- Autenticação e sessão do utilizador
- API calls existentes — apenas adapta o componente de apresentação
- Tema de cores global (dark sidebar + light content)

---

## Entregável esperado

Componente(s) React actualizados em substituição da view actual de `Propinas & Faturas`, com:
- Listagem funcional com dados mock se necessário
- Drawer de geração de referência funcional (estado local)
- Filtros e tabs com filtragem client-side
- Sem regressões nas outras rotas
