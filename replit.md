# Overview
Kiwara Tech is a pnpm monorepo TypeScript project building a comprehensive school management platform for the Angolan market. It supports Superadmin, School, and Guardian user profiles, offering modules for student and class management, tuition fee tracking with automated penalty calculation, incident reporting, and communication. The platform also includes a public marketing site, a commercial landing page for schools, and a registration process for new institutions. Its core purpose is to streamline school administration, communication, and financial processes, with a strong focus on tuition fee management and flexible penalty systems, entirely localized in Portuguese (Angola).

The vision is to establish a complete ecosystem for educational institutions, encompassing software development, consulting, training, and SaaS products, aiming to become a leading solution in the Angolan educational sector.

# User Preferences
I want to follow an iterative development approach. I prefer detailed explanations for complex features or architectural decisions. I like clean, readable code and prefer functional programming paradigms where appropriate. Before making any major changes or implementing new features, please ask for confirmation. Do not make changes to the `lib/api-spec` folder. Do not make changes to the `orval.config.ts` file.

# System Architecture
The project employs a pnpm monorepo structure, organizing code into `artifacts/` (deployable applications), `lib/` (shared libraries), and `scripts/` (utilities). The technology stack includes Node.js 24, TypeScript 5.9, Express 5 for the API, PostgreSQL with Drizzle ORM, and Zod for validation. API codegen is handled by Orval from an OpenAPI specification, and `esbuild` is used for CJS bundling. TypeScript configuration is managed centrally with `tsconfig.base.json` and project references for cross-package type-checking.

## UI/UX and Feature Specifications
The platform features three main interfaces:

1.  **Public Site (Marketing)**: Includes a homepage, services catalog, detailed school solution page, a commercial landing page for "Kiwara Escolar," and a school registration form for pending approval.
2.  **School Panel (`/dashboard`)**: A protected area for school administrators featuring:
    *   CRUD operations for students and classes.
    *   Comprehensive tuition fee management with status filters, adjustments (penalty forgiveness, value, rescheduling), and a detailed history.
    *   Financial reconciliation tools, including internal reference tracking, payment distribution, and manual payment processing (`Reconciliação Financeira`).
    *   Hybrid payment system supporting both manual and automatic online payments via webhooks, with idempotency.
    *   Incident reporting for students.
    *   A unified `Comunicar` module for sending messages via portal/SMS, managing published announcements, and configuring SMS provider settings with fallback options.
    *   Fee generation and school profile management.
3.  **Guardian Portal (`/encarregado`)**: A PIN-protected portal for guardians to view:
    *   Associated children and their schools.
    *   Tuition fees per child, including status and applied penalties.
    *   Payment information (school IBAN, transfer reference).
    *   School announcements and reported incidents.
    *   History of fee adjustments.
4.  **Central Admin Panel (`/admin/dashboard`)**: A Superadmin interface providing:
    *   Management of all registered schools, including approval/rejection and access to detailed school profiles.
    *   Centralized definition of fee types (emoluments) with inline penalty model configuration (single percentage, progressive tiers, fixed amount).
    *   A dedicated penalty panel for editing existing models.
    *   Bulk student import functionality with inline browser editing or CSV upload, including automatic creation of classes and guardians, and optional package linking.
    *   Optional fee packages (`usa_pacotes`) per school, with full CRUD for package management.
    *   Global management of incidents and announcements.
    *   Overview of all registered guardians.

## Business Logic
The core business logic centers on the tuition fee system and its flexible penalty models. Penalties are configured per emolument (tuition, transport, etc.) and can be fixed amounts, percentages, or daily interest. These are automatically applied based on overdue days and configured grace periods. The system supports a complete tuition fee lifecycle from emolument configuration and monthly fee generation to automatic penalty calculation, guardian payment, and school payment confirmation, with all adjustments being logged.

## SMS Notification System
A multi-tenant SMS notification system allows schools to configure providers (mock, Africa's Talking, Twilio, custom HTTP), manage templates, and send messages manually or automatically via events (`nova_fatura`, `pagamento_confirmado`, `multa_aplicada`, `atraso_pagamento`). It includes an SMS fallback mechanism for guardians without portal accounts.

## Multimodal Payment System
Payment methods are configurable per institution by Superadmin, allowing for reference-based payments, GPO/MCX integration, and direct debit. The system validates available methods for guardians.

## Direct Debit (Débito Direto) Module
A direct debit subscription lifecycle is implemented, including a 3-step adhesion wizard, persistence of subscriptions, and a guardian-initiated cancellation flow requiring admin approval. Subscriptions provide transparency with masked IBANs, debit days, and lists of emoluments.

## Emolumentos & Multas Module
Both global and school-local emoluments support individual fine rules, including activation, type (fixed/percentage), value, daily interest, and grace period. The billing engine dynamically reads these configurations.

## Bolsas de Estudo (Scholarship) Module
A full scholarship management system integrated across all three portals:
- **School Portal** (`Emolumentos → Bolsas` tab): CRUD for bolsa tipologias (percentage or fixed-amount discount, scoped to propina-only or all emoluments), list of active/revoked bolseiros with assign/revoke actions, and a stats dashboard (total bolseiros, types, discounted propinas, total discount value).
- **AlunoFichaSlideOver**: A dedicated "Bolsa de Estudo" section between Propinas and Encarregado sections — shows active bolsa with revoke button, or an assign-bolsa form with tipo/date/notes fields when none is active.
- **Guardian Portal**: Propina cards display original value (struck through), bolsa discount line, and net value when a scholarship discount exists.
- **Admin Panel** (`Colégio → Bolsas` tab): Read-only view of all bolsa tipologias and bolseiros for each school, with stats panel.
- **Discount engine**: Propina generation (`/school/propinas/gerar` and `/gerar-lote`) automatically detects an active bolsa and applies the discount before inserting — stored as `desconto` column on the `propinas` table.
- **DB tables**: `bolsa_tipos`, `bolsa_atribuicoes`; `propinas` altered with `desconto` + `bolsa_atribuicao_id`.

## Database Schema Highlights
The database schema includes tables for `schools`, `sessions`, `encarregados` (guardians), `students`, `turmas` (classes), `propinas` (tuition fees), `pagamentos` (payments), `ocorrencias` (incidents), `multa_regras` (penalty rules), `emolumentos` (fees), `sms_logs`, `comunicados` (announcements), `direct_debit_subscriptions`, `bolsa_tipos`, and `bolsa_atribuicoes`, among others, with appropriate enums for status and types.

# External Dependencies
-   **Monorepo Tool**: pnpm workspaces
-   **Runtime**: Node.js 24
-   **Language**: TypeScript 5.9
-   **API Framework**: Express 5
-   **Database**: PostgreSQL
-   **ORM**: Drizzle ORM
-   **Validation**: Zod, `drizzle-zod`
-   **API Codegen**: Orval
-   **Build Tool**: esbuild
-   **Development Server**: tsx
-   **Authentication (Hashing)**: bcrypt
-   **HTTP Client**: React Query
-   **CORS Management**: `cors` middleware