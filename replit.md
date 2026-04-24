# Overview
The project is a pnpm workspace monorepo using TypeScript, designed to build a comprehensive school management platform named "Kiwara Tech" for the Angolan market. It features three independent user profiles (Superadmin, School, Guardian), nine distinct routes, and a full-stack architecture. The platform aims to streamline school administration, communication, and financial management, specifically focusing on tuition fee processing with a flexible penalty system. The entire application content is in Portuguese (Angola).

Kiwara Tech's vision is to offer a complete ecosystem for educational institutions, providing software development, consulting, training, and SaaS products. Key capabilities include student and class management, tuition fee tracking with automated penalty calculation, incident reporting, and communication tools. The platform also provides a public marketing site, a commercial landing page for schools, and a registration flow for new schools.

# User Preferences
I want to follow an iterative development approach. I prefer detailed explanations for complex features or architectural decisions. I like clean, readable code and prefer functional programming paradigms where appropriate. Before making any major changes or implementing new features, please ask for confirmation. Do not make changes to the `lib/api-spec` folder. Do not make changes to the `orval.config.ts` file.

# System Architecture
The project utilizes a monorepo structure managed by pnpm workspaces. Each package handles its own dependencies. The core technology stack includes Node.js 24, TypeScript 5.9, Express 5 for the API, PostgreSQL with Drizzle ORM for the database, and Zod for validation. API codegen is handled by Orval from an OpenAPI specification, and `esbuild` is used for CJS bundling.

## Monorepo Structure
The monorepo is organized into `artifacts/` for deployable applications (e.g., `api-server`), `lib/` for shared libraries (e.g., `api-spec`, `api-client-react`, `api-zod`, `db`), and `scripts/` for utility scripts.

## TypeScript Configuration
Every package extends a shared `tsconfig.base.json` with `composite: true`. The root `tsconfig.json` lists all packages as project references, enabling cross-package type-checking and correct dependency resolution. Type-checking is performed from the root using `tsc --build --emitDeclarationOnly` to generate only `.d.ts` files, with actual JS bundling handled by `esbuild`.

## UI/UX and Feature Specifications

### Public Site (Marketing)
-   **Homepage (`/`)**: Animated hero, value proposition, product highlights, testimonials, CTA for Kiwara Escolar.
-   **Services (`/servicos`)**: Catalogue of services (software dev, consulting, training, SaaS products) with descriptions and icons.
-   **School Solution Detail (`/solucoes/escolar`)**: In-depth product page: architecture, module-by-module functionalities, use cases, plan comparison.
-   **Kiwara Escolar Landing (`/escolar`)**: Commercial landing page: value proposition, pricing by plan, feature list, FAQ, registration button.
-   **School Registration (`/signup`)**: Application form for schools (name, contact, email, password); schools are pending approval.

### School Panel (`/dashboard`) - Protected
-   **Students**: CRUD operations for students (name, ID, class, DOB, gender, process number, status). Individual student profiles.
-   **Classes**: Create and manage classes by grade and shift. Associate students with classes.
-   **Tuition Fees**: View all tuition fees. Filters: All / Pending / Overdue / Paid. Columns: Fee + Penalty + Total. Adjustments via modal.
-   **Reconciliação Financeira**: View internal references (format `SCH-CODE-studentId-YYYY-MM-DD-guardianId-propinaId`), reconciliation stats, split payment distribution (school vs platform), and process payments manually (EMIS, Appy Pay, Transferência, Numerário).
-   **Pagamentos Híbridos**: Hybrid payment system supporting both manual (baixa manual) and automatic online payments (MCX Express / EMIS). Webhook endpoint `POST /payments/webhook` for automatic reconciliation. Idempotency via `transaction_id`. Online payments cannot be edited manually. DB columns: `transaction_id` (unique), `metodo_pagamento`, `pagamento_origem` (manual/online). Payment method filter in PropinasView. Transaction ID shown in detail modal.
-   **Tuition Fee Adjustments**: Modal for adjustments: penalty forgiveness, value adjustment, rescheduling due date, justification. History of adjustments.
-   **Incidents**: Register disciplinary or academic incidents per student (type, description, date).
-   **Comunicar** (unified module, formerly "Comunicação" + "Comunicados"):
    -   **Compor tab**: Unified composer with canal selector (Portal / SMS / Portal+SMS), título+prioridade (portal), conteúdo/mensagem, audience filter (Todos/Por Turma/Devedores + individual search with guardian list), and publish/send button. Uses `POST /school/comunicar/publicar`.
    -   **Publicados tab**: List of portal comunicados with read count and delete.
    -   **Config. SMS tab**: SMS provider settings (mock/Africa's Talking/Twilio/custom), SMS active toggle, SMS Fallback toggle (auto-send to guardians without portal account on portal publish), events, and template editor.
    -   **Histórico tab**: SMS send logs with pagination.
    -   SMS Fallback: when publishing to portal-only and fallback is enabled, automatically sends SMS to guardians without portal accounts.
-   **Fees (Emoluments)**: View generated fees for students.
-   **Profile**: School details, bank IBAN for payments, access credentials.

### Guardian Portal (`/encarregado`) - PIN Protected
-   **Children**: View associated children and their schools.
-   **Tuition Fees**: Consult tuition fees per child: status (pending/overdue/paid), base amount, applied penalty, total due.
-   **Payments**: School IBAN and bank transfer reference.
-   **Announcements**: Read announcements from the school.
-   **Incidents**: Consult disciplinary/academic incidents reported by the school.
-   **Adjustments**: View history of fee adjustments made by school administration.

### Central Admin Panel (`/admin/dashboard`) - Superadmin
-   **Schools**: List all schools, approve/reject applications, access individual school profiles.
-   **School Profile**: Detailed view with sub-tabs: Fees, Tuition Fees, Students, Classes, Incidents, Announcements.
-   **Fees (Emoluments)**: Create fee types (tuition, enrollment, insurance, transport, uniform, penalties). Tuition fee creation requires inline penalty model configuration.
-   **Penalty Model (Inline)**: Appears when "Tuition Fee" type is selected. Three models:
    1.  **Model 1**: Single percentage.
    2.  **Model 2**: Progressive tiers based on delay days (JSONB brackets).
    3.  **Model 3**: Fixed AOA amount.
    Real-time preview and simultaneous saving with the fee.
-   **Penalty Panel**: Separate panel to edit existing penalty models.
-   **Tuition Fees**: View all school tuition fees. Filters by status. Adjustment options (forgiveness, value adjustment, rescheduling, justification). Adjustment history.
-   **Students / Classes**: Full CRUD for students and classes of the selected school.
-   **Bulk Student Import** (`UploadAlunosPanel`): Two modes — "Preencher no browser" (inline table editor with all CSV columns, including optional Pacote column when usa_pacotes=true) and "Carregar ficheiro CSV" (file upload). Both call `POST /admin/colegios/:id/alunos/upload`. API auto-creates turmas, encarregados (default PIN 1234, first_login=true), links them via encarregado_aluno, and optionally links matriculas to packages. CSV format: `nome,bilhete,numero_processo,data_nascimento,sexo,turma_nome,turno,nome_encarregado,telefone_encarregado,pacote_nome`.
-   **Fee Packages** (`usa_pacotes`): Optional feature per school. Enabled via toggle in school creation modal or in Visão Geral tab. When enabled: "Pacotes" tab appears with full CRUD for packages (`PacotesPanel`). Each package has nome, componentes (comma-separated), valor (total Kz per student/month), descricao, activo flag. Packages linked to students via `matriculas.pacote_id`. Import editor shows Pacote dropdown when school uses packages.
-   **Incidents**: Register and manage incidents per student.
-   **Announcements**: Create and manage school announcements.
-   **Guardians**: View all registered guardians on the platform.

## Business Logic
The core business logic revolves around the tuition fee system and its flexible penalty models.
-   **Penalty System**: Three models per school (single percentage, progressive tiers, fixed amount). Penalties are automatically applied based on overdue days and configured model. A penalty model must be configured before registering the first "tuition fee" type emolument.
-   **Tuition Fee Flow**:
    1.  Admin configures emolument (type, amount, penalty model).
    2.  School administration generates monthly tuition fees per class (status: pending).
    3.  System calculates penalties automatically upon view (compares current date with due date + grace period).
    4.  Guardian consults total (fee + penalty) and makes bank transfer.
    5.  School administration confirms payment (status: paid).
    6.  All adjustments (forgiveness, rescheduling) are logged.

## SMS Notification System
A full multi-tenant SMS notification system is implemented:
- **Service**: `artifacts/api-server/src/services/sms.service.ts` — provider-agnostic SMS sending with mock mode, `sendSMS()`, `sendBulkSMS()`, `sendEventSMS()`
- **Routes**: `artifacts/api-server/src/routes/sms.ts` — school and admin SMS endpoints
- **Events**: Automatic triggers on `nova_fatura` (propina created), `pagamento_confirmado` (payment webhook), `multa_aplicada` (fine applied), `atraso_pagamento` (overdue)
- **DB Table**: `sms_logs (id, school_id, telefone, mensagem, status, evento, idempotency_key, provider_ref, data_envio)`
- **Config**: Per-school SMS config stored in `school_settings.comunicacao` (sms_activo, sms_provider, sms_api_url, sms_api_key, sms_sender_name, eventos, sms_templates)
- **School UI**: "Comunicação" tab in school dashboard with config, template editor, manual send, logs
- **Admin UI**: "SMS & Comunicação" section with global provider config, bulk send to all/selected schools, monitoring
- **Providers**: mock (default), Africa's Talking, Twilio, custom HTTP endpoint

## Multimodal Payment System
Payment methods are configurable per institution by Superadmin via `school_settings.pagamento`:
- `metodos_pagamento`: `{allow_reference, allow_gpo_mcx, allow_direct_debit}` (all booleans)
- `direct_debit`: `{banco_parceiro, instrucoes}` for the DD bank configuration
- Admin endpoint: `GET/PUT /admin/colegios/:id/payment-methods` with full audit log in `payment_method_audit_log`
- Guardian endpoint: `GET /guardian/payments/available-methods` returns active methods for the guardian's school
- Method validation in `POST /guardian/pagamentos/gerar` rejects disabled methods (403)

## Direct Debit (Débito Direto) Module
Full DD subscription lifecycle implemented:
- **Adhesion (one-time)**: 3-step wizard: (1) emolument selection + IBAN + debit day, (2) transparency schedule/detail, (3) T&C acceptance + email for contract delivery
- **Emolumentos**: propina, transporte, refeição, atividades extracurriculares
- **Subscription persistence**: `direct_debit_subscriptions` table; one active subscription per guardian/school; re-adhesion allowed after cancellation
- **Cancellation flow**: Guardian submits cancel request → status becomes `cancellation_requested` → Admin approves via `PUT /admin/direct-debit/subscriptions/:id/approve-cancellation` → status becomes `cancelled`
- **Transparency**: Subscription card shows masked IBAN, debit day, emoluments list, next 4 monthly debit dates

## Database Schema Highlights
Key tables include `schools`, `sessions`, `encarregados`, `guardian_sessions`, `encarregado_aluno`, `turmas`, `students`, `matriculas`, `propinas`, `pagamentos`, `ocorrencias`, `multa_regras`, `propina_ajustes`, `sms_logs`, `comunicados`, `comunicados_lidos`, `payment_method_audit_log`, and `direct_debit_subscriptions`. Enum values are defined for `students.estado`, `students.sexo`, `propinas.status`, and `pagamentos.estado`.

# External Dependencies
-   **Monorepo Tool**: pnpm workspaces
-   **Node.js**: Version 24
-   **TypeScript**: Version 5.9
-   **API Framework**: Express 5
-   **Database**: PostgreSQL
-   **ORM**: Drizzle ORM
-   **Validation**: Zod (`zod/v4`), `drizzle-zod`
-   **API Codegen**: Orval (from OpenAPI spec)
-   **Build Tool**: esbuild
-   **Development Server**: tsx
-   **Frontend (Implied)**: React + Vite (mentioned in the "Kiwara Tech — Ecossistema Completo" section)
-   **Authentication**: bcrypt for password hashing (implied by `password_hash`)
-   **HTTP Client**: React Query (for generated API client hooks)
-   **CORS Management**: `cors` middleware