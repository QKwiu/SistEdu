# Documento Técnico — Kiwara Tech
> Plataforma SaaS de Gestão Escolar · Angola · Versão 1.0 · Maio 2026

---

## 1. ARQUITECTURA E STACK TÉCNICA

### Linguagem
**TypeScript** em toda a stack (frontend + backend), organizado num **monorepo pnpm** com dois artefactos principais: `kiwara-tech` (web) e `api-server`.

### Frontend

| Camada | Tecnologia | Justificação |
|---|---|---|
| Framework | **React 18 + Vite** | HMR instantâneo no Replit, build rápido com esbuild |
| Routing | **Wouter** | Mais leve que React Router; sem overhead desnecessário |
| Estado/Fetch | **TanStack Query** | Cache automático, re-fetch e sincronização de servidor |
| Estilos | **Tailwind CSS + Radix UI + shadcn/ui** | Componentes acessíveis sem CSS custom extensivo |
| Formulários | **react-hook-form + Zod** | Validação tipada e performática |
| Gráficos | **Recharts** | Dashboards financeiros e académicos |
| Ícones | **Lucide React** | Consistente e tree-shakeable |
| Animações | **Framer Motion** | Transições de ecrã e micro-interacções |
| Notificações | **Sonner** | Toasts não-bloqueantes |

### Backend

| Camada | Tecnologia | Justificação |
|---|---|---|
| Runtime | **Node.js + Express 5** | Suporte nativo no Replit sem configuração extra |
| Linguagem | **TypeScript** (compilado com esbuild) | Partilha tipos com o frontend |
| ORM | **Drizzle ORM** | Migrations versionadas, tipos gerados automaticamente |
| Logging | **Pino + pino-http** | Alta performance, JSON estruturado |
| Upload | **Multer** | Gestão de ficheiros (comprovativos, fotos infantil) |
| Autenticação | **Bearer Token custom** (32-byte hex, tabela `sessions`) | Simples, sem dependências OAuth externas |
| Passwords | **bcryptjs** | Hashing seguro |

### Base de Dados
**PostgreSQL** — gerido pelo Replit via variável `DATABASE_URL`. Schema multi-tenant com `school_id` em todas as tabelas operacionais. Migrations via **Drizzle Kit**.

### APIs Externas Integradas

| Sistema | Função |
|---|---|
| **GPO / EMIS** | Pagamentos digitais via Webframe (HMAC-SHA256) |
| **Multicaixa (MCX)** | Pagamento por referência (entidade + referência) |
| **Débito Directo** | Mandatos SOAP para cobranças recorrentes |
| **SMS REST** | Notificações automáticas (avisos, confirmações) |

### IA — Estado Actual e Recomendações Futuras

Actualmente **não existe nenhuma integração de IA**. Integrações recomendadas para fases futuras:

| Funcionalidade | API Recomendada | Caso de Uso |
|---|---|---|
| Geração de comunicados | **Anthropic Claude** (via Replit AI Integration) | Rascunho automático de mensagens para encarregados |
| Resumos financeiros | **OpenAI GPT-4o** | Narrativa automática dos relatórios mensais |
| Chatbot de suporte | **Gemini** | Responder dúvidas dos encarregados no portal |
| OCR de comprovativos | **Google Vision API** | Leitura automática de recibos de pagamento |

---

## 2. MATRIZ DE PERFIS E REGRAS DE ACESSO (RBAC)

O sistema tem **dois níveis**: Super Admin global (Kiwara) e utilizadores por escola (staff + encarregados). As permissões por módulo são: `pode_ler`, `pode_criar`, `pode_editar`, `pode_apagar`.

---

### 👑 Super Admin (Kiwara/Plataforma)
> Acesso via painel `/admin` separado com `adminAuth`

**PODE:**
- Criar, editar e bloquear contas de escolas
- Ver métricas globais de todas as escolas
- Activar/desactivar módulos por escola (Infantil, Débito Directo, etc.)
- Configurar preços e planos SaaS
- Aceder a logs globais do sistema

**NÃO PODE:**
- Aceder a dados académicos ou financeiros de alunos individuais (isolamento multi-tenant)

---

### 🏫 Administrador de Escola (`admin`)
> Acesso total ao painel da escola

**PODE:**
- Tudo dentro da sua escola
- Criar e gerir perfis de staff e papéis RBAC
- Configurar módulos, SMS, gateways de pagamento
- Ver todos os relatórios e auditorias
- Bloquear/desbloquear utilizadores

**NÃO PODE:**
- Aceder a dados de outras escolas
- Alterar configurações da plataforma Kiwara

---

### 💰 Financeiro (`financeiro`)
> Módulos: Propinas, Emolumentos, Caixa, Reconciliação, Débito Directo

**PODE:**
- Criar e emitir propinas e emolumentos
- Registar pagamentos manuais e emitir faturas de caixa (`FC-YYYY-NNNNN`)
- Fazer reconciliação de pagamentos digitais
- Ver e exportar relatórios financeiros
- Gerir bolsas e descontos

**NÃO PODE:**
- Criar/editar perfis de staff ou permissões
- Aceder ao módulo de Ocorrências
- Enviar comunicados (apenas leitura)

---

### 🗂️ Operador (`operador`)
> Módulos: Alunos, Turmas, Ocorrências, Comunicar (leitura)

**PODE:**
- Registar e editar alunos e matrículas
- Gerir turmas e anos lectivos
- Registar ocorrências disciplinares
- Consultar (apenas leitura) propinas e pagamentos
- Ver comunicados publicados

**NÃO PODE:**
- Emitir faturas ou registar pagamentos
- Alterar configurações de pagamento
- Gerir acessos de outros utilizadores
- Ver relatórios financeiros detalhados

---

### 👶 Educador Infantil (perfil futuro)
> Módulo Infantil exclusivo

**PODE:**
- Gerir rotinas diárias dos alunos
- Publicar ementas semanais
- Carregar fotos para a galeria
- Publicar comunicados de aniversário

**NÃO PODE:**
- Aceder a qualquer módulo financeiro
- Ver dados de alunos fora das suas turmas

---

### 👨‍👩‍👧 Encarregado de Educação
> Acesso via portal separado (`/guardian`)

**PODE:**
- Ver facturas pendentes e pagas do seu educando
- Pagar via GPO ou referência Multicaixa
- Ler comunicados publicados pela escola
- Ver ocorrências do seu educando
- Consultar ementas e galeria (módulo infantil)
- Fazer compras na loja da escola

**NÃO PODE:**
- Ver dados de outros alunos
- Aceder ao painel administrativo da escola
- Editar qualquer informação

---

## 3. REQUISITOS FUNCIONAIS

### 🔐 Módulo de Autenticação
- Login com email + password (bcrypt)
- Sessões por Bearer Token (tabela `sessions`)
- MFA por TOTP (infraestrutura existente: `mfa_activado`)
- Bloqueio de conta por administrador (kill switch)
- Reset de password com auditoria

---

### 👨‍🎓 Módulo de Alunos
- Registo individual de alunos (nome, BI, data nascimento, turma, pacote)
- Importação em massa via CSV
- Perfil completo com histórico financeiro e académico
- Gestão de turmas, anos lectivos e matrículas
- Atribuição de pacotes de serviço (propinas + emolumentos)
- Upload de documentos (BI, fichas)

---

### 💳 Módulo de Propinas
- Geração de propinas mensais (individual ou em lote por turma)
- Geração de referências Multicaixa automáticas
- Registo de pagamento manual com comprovativo
- Cálculo automático de multas por atraso
- Bolsas de estudo (desconto percentual)
- Histórico completo de pagamentos por aluno

---

### 🧾 Módulo de Emolumentos
- Catálogo de serviços/taxas configurável (matrícula, certidão, etc.)
- Geração de cobranças pontuais
- Impressão de recibo por serviço

---

### 🏪 Módulo de Caixa (POS)
- Interface de ponto de venda para atendimento presencial
- Pesquisa rápida de aluno (por nome ou processo)
- Selecção de propinas/emolumentos pendentes
- Emissão de **Fatura de Caixa** com numeração sequencial `FC-YYYY-NNNNN`
- Atomicidade via `pg_advisory_xact_lock`
- Impressão térmica (80mm) e A4 em popup

---

### 🔄 Módulo de Reconciliação
- Matching automático de pagamentos digitais (GPO/EMIS, MCX)
- Registo de liquidações e split de valores
- Painel de pagamentos por conciliar vs. conciliados

---

### 📢 Módulo de Comunicar
- Composição de comunicados com suporte a templates
- Publicação no portal dos encarregados
- Envio de SMS (individual, por turma, ou broadcast geral)
- Histórico de comunicados publicados e logs de SMS
- **Separador Aniversário**: detecção automática de aniversariantes do dia + selecção manual de qualquer aluno

---

### ⚠️ Módulo de Ocorrências
- Registo de incidentes disciplinares e méritos
- Categorias configuráveis (falta, suspensão, louvor)
- Visível para o encarregado no portal
- Auditoria de quem registou e quando

---

### 💸 Módulo de Débito Directo
- Criação e gestão de mandatos SEPA/local
- Processamento de cobranças recorrentes automáticas
- Gestão de falhas e re-tentativas

---

### 📊 Módulo de Relatórios
- Relatório de cobrança mensal (por turma, por pacote)
- Resumo financeiro global
- Alunos em atraso
- Performance de SMS
- Exportação (PDF/Excel)

---

### 👶 Módulo Infantil (Creche/Jardim)
- Registo de rotinas diárias (refeições, sonos, actividades)
- Ementa semanal
- Galeria de fotos da turma
- Comunicados de aniversário com foto

---

### 🛒 Loja da Escola
- Catálogo de produtos (fardamento, material)
- Visibilidade no portal dos encarregados
- Gestão de encomendas

---

### 🔑 Módulo de Gestão de Acessos
- Criação de papéis customizados com cor e nome
- Matriz de permissões granular (CRUD por módulo)
- Criação de utilizadores staff com papel atribuído
- Bloqueio/desbloqueio de utilizadores
- Log de auditoria de todas as acções RBAC

---

## 4. FLUXO DA APLICAÇÃO

### Jornada do Administrador de Escola

```
1. ACESSO
   └─ Navega para o URL da plataforma
   └─ Ecrã de login → email + password
   └─ Token gerado e guardado em localStorage
   └─ Redirecionado para o Dashboard

2. DASHBOARD (Início)
   └─ Vê KPIs: alunos activos, propinas cobradas,
      SMS enviados, comunicados publicados
   └─ Gráficos de cobrança mensal
   └─ Alertas de pagamentos em atraso

3. GESTÃO DE ALUNOS
   └─ Abre "Alunos" → lista paginada com pesquisa
   └─ "Novo Aluno" → preenche ficha → atribui turma + pacote
      ou
   └─ "Importar CSV" → carrega ficheiro → confirma mapeamento

4. CICLO FINANCEIRO MENSAL
   └─ "Propinas" → selecciona mês + turma
   └─ "Gerar em Lote" → sistema cria propinas para todos os alunos
   └─ Referências Multicaixa geradas automaticamente
   └─ Sistema envia SMS de aviso (se configurado)
   └─ Encarregados pagam via portal, GPO ou presencialmente

5. ATENDIMENTO PRESENCIAL (Caixa)
   └─ Abre "Caixa"
   └─ Pesquisa aluno → selecciona propinas/emolumentos pendentes
   └─ "Emitir Fatura" → FC-2026-00001 gerada
   └─ Impressão térmica ou A4

6. RECONCILIAÇÃO
   └─ Pagamentos digitais chegam ao sistema via webhook
   └─ "Reconciliação" → lista pagamentos por conciliar
   └─ Confirma matching com propinas correspondentes

7. COMUNICAÇÃO
   └─ "Comunicar" → separador "Compor"
   └─ Escreve mensagem → selecciona audiência (todos, turma)
   └─ Publica no portal e/ou envia SMS
   └─ Separador "Aniversário" → selecciona aniversariante
      (automático pelo sistema ou pesquisa manual)
   └─ Adiciona foto → publica comunicado de aniversário

8. RELATÓRIOS
   └─ "Relatórios" → escolhe período e filtros
   └─ Vê resumo de cobrança, alunos em atraso, SMS
   └─ Exporta para partilhar com direcção

9. GESTÃO DA EQUIPA
   └─ "Gestão de Acessos" → cria papel "Secretaria"
   └─ Define permissões: Alunos (ler+criar), Propinas (ler)
   └─ Cria utilizador → atribui papel → envia credenciais
```

---

### Jornada do Encarregado de Educação

```
1. ACESSO
   └─ Recebe link de convite por SMS/comunicado
   └─ Regista-se com número de processo do educando
   └─ Entra no portal /guardian

2. PORTAL
   └─ Vê facturas pendentes do educando
   └─ Clica "Pagar" → escolhe GPO (QR code) ou Referência MCX
   └─ Após pagamento, factura fica marcada como paga

3. ACOMPANHAMENTO
   └─ Lê comunicados da escola
   └─ Consulta ocorrências do educando
   └─ Vê ementa semanal e galeria (se creche)
```

---

*Documento gerado automaticamente com base na análise do código-fonte da Kiwara Tech · Maio 2026*
