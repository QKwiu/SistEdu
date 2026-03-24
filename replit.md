# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.

---

## Kiwara Tech — Ecossistema Completo

### Visão Geral
Plataforma angolana de gestão escolar com 3 perfis de utilizador independentes, 9 rotas e arquitectura monorepo (React + Vite + Express + PostgreSQL). Todo o conteúdo em Português (Angola).

---

### Credenciais de Acesso (Desenvolvimento)

| Perfil | Credenciais |
|--------|-------------|
| Superadmin | `Superaadmin` / `Superaadmin` → `/admin` |
| Colégio (E2E) | `e2e@kiwara.test` / `TestPass123` → `/escolar` |
| Encarregado | Telefone `943612744` / PIN `1234` → `/encarregado` |

**Tokens em localStorage:**
- Superadmin: `kiwara_admin_token`
- Colégio: `kiwara_school_token`
- Encarregado: `kiwara_guardian_token`

---

### Mapa de Rotas e Funcionalidades

#### SITE PÚBLICO (Marketing)

| Rota | Página | Funcionalidades |
|------|--------|-----------------|
| `/` | Página Inicial | Hero animado, proposta de valor da Kiwara Tech, destaque de produtos, depoimentos, CTA para Kiwara Escolar |
| `/servicos` | Serviços | Catálogo completo de serviços: dev. software, consultoria, formação, produtos SaaS. Cada serviço com descrição e ícone |
| `/solucoes/escolar` | Solução Escolar (detalhe) | Página de produto aprofundada: arquitectura, funcionalidades módulo a módulo, casos de uso, comparação de planos |
| `/escolar` | Kiwara Escolar (landing SaaS) | Landing comercial: proposta de valor, preços por plano, lista de funcionalidades, FAQ, botão de registo |
| `/signup` | Registo do Colégio | Formulário de candidatura: nome do colégio, responsável, contacto, e-mail, password. Colégio fica pendente de aprovação |

---

#### PAINEL DO COLÉGIO — `/dashboard` *(protegido por login escolar)*

Destinado à secretaria/direcção do colégio.

| Separador | Funcionalidades |
|-----------|-----------------|
| **Alunos** | Listar, pesquisar, adicionar, editar e desactivar alunos (nome, BI, turma, data nasc., sexo, número de processo, estado). Ficha individual por aluno. |
| **Turmas** | Criar e gerir turmas por classe e turno (manhã/tarde). Associar alunos a turmas. |
| **Propinas** | Ver todas as propinas. Filtros: Todas / Pendentes / Vencidas / Pagas. Colunas: Propina + Multa + Total. Botão ⋯ por linha para ajustes. |
| **Ajustes de Propinas** | Modal de ajuste por propina: perdão de multa, ajuste de valor, reagendamento de data de vencimento, justificação (registo sem alteração). Histórico de ajustes. |
| **Ocorrências** | Registar incidentes disciplinares ou académicos por aluno (tipo, descrição, data). |
| **Comunicados** | Criar e publicar comunicados visíveis no portal do encarregado. |
| **Emolumentos** | Ver emolumentos gerados para os alunos. |
| **Perfil** | Dados do colégio, IBAN bancário para pagamentos, credenciais de acesso. |

---

#### PORTAL DO ENCARREGADO — `/encarregado`

Acesso por número de telemóvel + PIN. Primeiro login obriga a alterar o PIN.

| Secção | Funcionalidades |
|--------|-----------------|
| **Filhos** | Ver todos os educandos associados e respectivos colégios |
| **Propinas** | Consultar propinas por filho: estado (pendente/vencido/pago), montante base, multa aplicada, total a pagar |
| **Pagamentos** | IBAN do colégio e referência para transferência bancária |
| **Comunicados** | Ler comunicados publicados pelo colégio |
| **Ocorrências** | Consultar ocorrências disciplinares/académicas registadas pelo colégio |
| **Ajustes** | Ver histórico de ajustes feitos pela secretaria (perdões, reagendamentos, etc.) |

---

#### PAINEL ADMIN CENTRAL — `/admin/dashboard` *(superadmin Kiwara Tech)*

Controlo total sobre toda a plataforma.

| Secção | Funcionalidades |
|--------|-----------------|
| **Colégios** | Listar todos os colégios, aprovar/rejeitar candidaturas, aceder à ficha de cada colégio |
| **Ficha do Colégio** | Vista detalhada com sub-separadores: Emolumentos, Propinas, Alunos, Turmas, Ocorrências, Comunicados |
| **Emolumentos** | Criar emolumentos por tipo (propina, matrícula, seguro, transporte, uniforme, multas, etc.). Ao adicionar propina, obriga configurar o modelo de multa inline no mesmo formulário. Eliminar emolumentos. |
| **Modelo de Multa (inline)** | Aparece automaticamente ao escolher tipo "Propina" no formulário. 3 modelos seleccionáveis: Modelo 1 (% única), Modelo 2 (escalões progressivos por intervalos de dias), Modelo 3 (taxa fixa AOA). Preview em tempo real. Guardado em simultâneo com o emolumento. |
| **Painel de Multas** | Painel separado para editar o modelo de multa já configurado do colégio (independente do formulário de emolumentos). |
| **Propinas** | Ver todas as propinas do colégio. Filtros por estado. Colunas Propina / Multa / Total. Botões de ajuste: perdão, ajuste de valor, reagendamento, justificação. Histórico de ajustes. |
| **Alunos / Turmas** | CRUD completo de alunos e turmas do colégio seleccionado. |
| **Ocorrências** | Registar e gerir ocorrências por aluno. |
| **Comunicados** | Criar e gerir comunicados do colégio. |
| **Encarregados** | Ver todos os encarregados registados na plataforma. |

---

### Lógica de Negócio Central

**Sistema de Multas (3 modelos por colégio):**
- **Modelo 1** — Percentagem única: `multa = montante × percentagem / 100`
- **Modelo 2** — Escalões progressivos: % diferente por intervalo de dias de atraso (brackets em JSONB)
- **Modelo 3** — Taxa fixa: `multa = valor_fixo` (AOA)
- A multa é aplicada automaticamente na consulta das propinas com base nos dias de atraso e no modelo configurado
- Obrigatório configurar o modelo antes de registar o primeiro emolumento de tipo "propina"

**Fluxo de propinas:**
1. Admin configura emolumento (tipo + montante + modelo de multa) → `emolumentos` + `multa_regras`
2. Secretaria gera propinas mensais por turma → `propinas` (status: pendente)
3. Sistema calcula multa automaticamente ao carregar (compara data actual com data_vencimento + dia_limite)
4. Encarregado consulta total = propina + multa, efectua transferência bancária
5. Secretaria confirma pagamento → status: pago
6. Qualquer ajuste (perdão, reagendamento, etc.) fica registado em `propina_ajustes`

---

## Kiwara Escolar — Database Schema

| Table | Key columns |
|-------|-------------|
| `schools` | id, school_id, name, nif, phone, email, password_hash |
| `sessions` | school_id → schools, token, expires_at |
| `encarregados` | nome, telefone, email, password (bcrypt), first_login |
| `guardian_sessions` | encarregado_id → encarregados, token, expires_at |
| `encarregado_aluno` | encarregado_id → encarregados, aluno_id → students |
| `turmas` | school_id, nome, ano, turno |
| `students` | school_id, turma_id, nome, bilhete, data_nascimento, sexo, numero_processo, estado |
| `matriculas` | student_id, turma_id, ano_lectivo, data_matricula, estado |
| `propinas` | school_id, student_id, mes, ano, montante, multa, status, data_vencimento |
| `pagamentos` | propina_id (UNIQUE), entidade, referencia, valor, estado, validade |
| `ocorrencias` | student_id, tipo, descricao, registado_por, data_ocorrencia |
| `multa_regras` | school_id (UNIQUE), modelo (1=única/2=progressiva/3=fixa), dia_limite, aplica_automatico, percentagem, valor_fixo, brackets (JSONB) |
| `propina_ajustes` | propina_id, tipo (perdao/ajuste_valor/reagendamento/justificacao), multa_anterior, multa_nova, valor_anterior, valor_novo, nova_data_vencimento, motivo, created_by |

### students.estado values: activo | inactivo | transferido | concluido
### students.sexo values: M | F | Outro
### propinas.status values: pendente | pago | vencido
### pagamentos.estado values: PENDENTE | PAGO

## Seed Data (escola: Colégio Kiwara - Sede, id=1)

| Guardian | Telefone | Password |
|----------|----------|----------|
| João Silva | 921000001 | 1234 |
| Maria Fernandes | 922000002 | 1234 |
| Encarregado1_HQ (original) | 943612744 | 1234 |

| Aluno | Turma | Guardian |
|-------|-------|----------|
| Carlos Silva | 8ª Classe A (Manhã) | João Silva |
| Ana Silva | 8ª Classe A (Manhã) | João Silva |
| Mateus Gomes | 8ª Classe A (Manhã) | João Silva |
| Pedro Fernandes | 10ª Classe B (Tarde) | Maria Fernandes |
| Luana Fernandes | 10ª Classe B (Tarde) | Maria Fernandes |

Propinas de Março 2026: Carlos Silva=PAGO, Mateus Gomes=PAGO, Ana Silva=PENDENTE, Pedro Fernandes=VENCIDO (multa 5000 AOA), Luana Fernandes=PENDENTE.

## API Routes

- `POST /api/auth/login` / `POST /api/auth/signup` — school auth
- `GET/POST /api/school/turmas`, `DELETE /api/school/turmas/:id`
- `GET/POST /api/school/alunos` (includes data_nascimento, sexo, numero_processo, estado, turno), `DELETE /api/school/alunos/:id`
- `GET /api/school/propinas`, `POST /api/school/propinas/gerar`, `POST /api/school/propinas/referencia`
- `GET /api/school/propinas/:id/ajustes`, `POST /api/school/propinas/:id/ajuste`
- `POST /api/guardian/login`, `POST /api/guardian/change-password`, `GET /api/guardian/me`
- `GET /api/guardian/alunos`, `GET /api/guardian/alunos/:id/propinas`, `GET /api/guardian/alunos/:id/ocorrencias`
- `POST /api/guardian/pagamentos/gerar`
- `GET/POST/DELETE /api/ocorrencias` (school backoffice)
- `GET/PUT /api/admin/colegios/:id/multa-regra` (3 models: 1=única%, 2=progressiva escalões, 3=fixa Kz)
- `GET /api/admin/colegios/:id/propinas`, `GET /api/admin/propinas/:id/ajustes`, `POST /api/admin/propinas/:id/ajuste`
