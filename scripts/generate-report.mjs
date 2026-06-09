/**
 * generate-report.mjs
 * Gera o relatório PDF de funcionalidades da plataforma Kiwara Tech.
 * Execução: node --experimental-vm-modules scripts/generate-report.mjs
 */

import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const PDFDocument = require("/home/runner/workspace/node_modules/.pnpm/pdfkit@0.18.0/node_modules/pdfkit");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "Kiwara_Tech_Funcionalidades.pdf");

// ── Paleta ────────────────────────────────────────────────────────────────────
const C = {
  primary:   "#1A56DB",   // azul primário
  dark:      "#0F2042",   // azul escuro (títulos)
  emerald:   "#059669",   // verde (implementado)
  amber:     "#D97706",   // âmbar (parcial)
  red:       "#DC2626",   // vermelho (pendente)
  slate:     "#475569",   // cinzento (texto normal)
  light:     "#F1F5F9",   // fundo secção
  border:    "#CBD5E1",   // linhas
  white:     "#FFFFFF",
  black:     "#0F172A",
};

// ── Status helpers ────────────────────────────────────────────────────────────
const STATUS = {
  ok:      { label: "Implementado",  color: C.emerald },
  partial: { label: "Parcial",       color: C.amber   },
  pending: { label: "Pendente",      color: C.red     },
  new:     { label: "Novo",          color: C.primary },
};

// ── Dados do relatório ────────────────────────────────────────────────────────
const REPORT = [
  // ════════════════════════════════════════════════════════════════
  {
    profile: "GESTÃO DO COLÉGIO",
    subtitle: "Dashboard da escola — acesso por credenciais de director/secretaria",
    color: "#1A56DB",
    modules: [
      {
        name: "Módulo Académico",
        features: [
          { name: "Gestão de Turmas", status: "ok", notes: "Criar, listar, eliminar turmas; contagem de alunos por turma e turno." },
          { name: "Matrícula de Alunos", status: "ok", notes: "Registo completo com upload de documentos (BI, declaração de transferência). Geração automática de número de processo." },
          { name: "Atribuição de Turma e Pacote", status: "ok", notes: "Associação aluno ↔ turma e aluno ↔ pacote de emolumentos no registo ou por edição." },
          { name: "Ocorrências (Disciplina / Mérito)", status: "ok", notes: "Registo de ocorrências disciplinares e de mérito por aluno, com data e descrição." },
        ],
      },
      {
        name: "Módulo Financeiro",
        features: [
          { name: "Propinas — Emissão mensal", status: "ok", notes: "Geração individual ou em lote para toda a turma/escola. Controlo de mês e ano lectivo." },
          { name: "Propinas — Baixa Manual", status: "ok", notes: "Registo de pagamento manual com upload de comprovante. Suporte a canais: Numerário, GPO, TPA, Transferência." },
          { name: "Referências Multicaixa", status: "ok", notes: "Geração de referência 9 dígitos por propina ou combinada (vários meses). Exibição de entidade e referência." },
          { name: "Emolumentos (Taxas)", status: "ok", notes: "Criação de taxas personalizadas (seguro, material, uniforme, etc.) com valor e mês de aplicação." },
          { name: "Pacotes de Emolumentos", status: "ok", notes: "Agrupamento de propina + emolumentos num pacote mensal fixo por nível/turma." },
          { name: "Multas Automáticas", status: "ok", notes: "Três modelos: Valor Fixo, Percentagem sobre dívida, Escalões Progressivos. Aplicação automática após N dias de atraso." },
          { name: "Reconciliação de Pagamentos", status: "ok", notes: "Fluxo de caixa por canal (GPO, Numerário, TPA, Transferência). Exportação e balanço diário/mensal." },
          { name: "Motor Split Payment (EMIS)", status: "ok", notes: "Suporte a 3 canais: REFERENCIA (Multicaixa), GPO (online), SDD (Débito Directo). Cálculo automático: comissão plataforma + IRT + valor líquido comerciante. Verificação de integridade matemática." },
        ],
      },
      {
        name: "Módulo de Comunicação",
        features: [
          { name: "Comunicados — Portal", status: "ok", notes: "Publicação de comunicados visíveis no portal do encarregado. Prioridades: Normal, Alta, Urgente." },
          { name: "Comunicados — SMS", status: "ok", notes: "Envio por SMS a destinatários seleccionados (todos, por turma, devedores). Templates por evento." },
          { name: "Comunicados — Portal + SMS simultâneo", status: "ok", notes: "Canal combinado: publica no portal e envia SMS em simultâneo." },
          { name: "Histórico de SMS", status: "ok", notes: "Log de todos os SMS enviados com estado (enviado/falhou), evento e timestamp." },
          { name: "Configuração SMS por escola", status: "ok", notes: "Configuração de provedor (Africa's Talking, Twilio, personalizado), API key, nome remetente e eventos automáticos." },
        ],
      },
      {
        name: "Módulo de Segurança e Acessos (RBAC)",
        features: [
          { name: "Gestão de Roles (Perfis)", status: "ok", notes: "Criação de roles personalizadas com nome e permissões granulares por módulo." },
          { name: "Matriz de Permissões", status: "ok", notes: "4 acções por módulo: Ler, Criar, Editar, Eliminar. Módulos: Alunos, Financeiro, Comunicados, Configurações, Relatórios, Staff." },
          { name: "Gestão de Staff", status: "ok", notes: "Criação de utilizadores staff com atribuição de role, email e password. Activar/Desactivar." },
          { name: "Portal de Staff (StaffPortal)", status: "partial", notes: "Interface dedicada a professores e staff não-administrativo. Acesso implementado; funcionalidades em expansão (gestão de presenças e notas previstas)." },
        ],
      },
      {
        name: "Módulo de Relatórios e Analytics",
        features: [
          { name: "KPIs Financeiros", status: "ok", notes: "Receita Planeada vs. Realizada, taxa de cobrança, propinas em atraso por turma." },
          { name: "Análise de Inadimplência", status: "ok", notes: "Classificação de devedores por grau de atraso, funil de pagamento por canal." },
          { name: "Análise de Multas", status: "ok", notes: "Volume e valor de multas aplicadas por período. Distribuição por tipo de multa." },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  {
    profile: "PORTAL DO ENCARREGADO",
    subtitle: "Portal público — acesso por número de telefone + PIN/Palavra-passe",
    color: "#059669",
    modules: [
      {
        name: "Módulo Financeiro",
        features: [
          { name: "Consulta de Propinas", status: "ok", notes: "Listagem de propinas pagas e em dívida por educando, com valor, mês e estado." },
          { name: "Referências Multicaixa", status: "ok", notes: "Visualizar e copiar referência de pagamento por mês individual ou combinada (vários meses em atraso)." },
          { name: "Wizard de Checkout (3 passos)", status: "ok", notes: "Fluxo: Resumo da dívida → Escolha de método → Confirmação. Suporta GPO/MCX Express e Débito Directo." },
          { name: "Pagamento GPO / MCX Express", status: "ok", notes: "Redireccionamento seguro para gateway EMIS GPO para pagamento online com cartão." },
          { name: "Débito Directo (SDD)", status: "partial", notes: "Apresentação de instruções de adesão e banco parceiro. Automatização completa da instrução SDD ao banco depende de integração API bilateral com banco comercial angolano — a implementar." },
          { name: "Histórico de Pagamentos", status: "ok", notes: "Lista de todas as transacções confirmadas com data, canal, valor e link para comprovante." },
          { name: "Comprovante em PDF", status: "ok", notes: "Geração de recibo PDF por pagamento, com dados da escola, aluno e referência." },
        ],
      },
      {
        name: "Módulo Infantário (Infant Module)",
        features: [
          { name: "Rotinas Diárias", status: "ok", notes: "Visualização de horários e rotinas do dia (sono, refeições, actividades) por educando inscrito em creche/pré-escolar." },
          { name: "Ementas Semanais", status: "ok", notes: "Plano alimentar semanal: Pequeno-almoço, Almoço, Lanche. Alerta visual de alergénios detectados." },
          { name: "Galeria de Media", status: "ok", notes: "Fotos e vídeos de actividades escolares. Acesso filtrado pela turma do educando. Acesso seguro (autenticado)." },
        ],
      },
      {
        name: "Módulo de Comunicação",
        features: [
          { name: "Comunicados da Escola", status: "ok", notes: "Leitura de comunicados publicados pela escola, ordenados por prioridade e data." },
          { name: "Ocorrências do Educando", status: "ok", notes: "Consulta de ocorrências disciplinares ou de mérito registadas para cada filho/educando." },
        ],
      },
      {
        name: "Módulo de Notificações",
        features: [
          { name: "SMS Automático", status: "ok", notes: "Notificações SMS nos eventos: nova fatura, confirmação de pagamento, atraso, multa aplicada." },
          { name: "Push Notifications (FCM)", status: "partial", notes: "Backend FCM implementado com suporte a credenciais globais e por escola. Subscrição de token FCM no portal do encarregado por implementar (requer integração Service Worker + permissão de notificação no browser/app)." },
          { name: "Email", status: "partial", notes: "Campo de e-mail remetente configurável por escola. Envio efectivo de e-mail (SMTP/SendGrid) por integrar com o provider de email configurado." },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  {
    profile: "ADMIN — BACKOFFICE",
    subtitle: "Painel de super-administração — acesso restrito à equipa Kiwara Tech",
    color: "#7C3AED",
    modules: [
      {
        name: "Módulo de Gestão de Instituições",
        features: [
          { name: "Onboarding de Escolas", status: "ok", notes: "Criação de novos tenants com configurações completas: nome, tipo, morada, contacto, logo." },
          { name: "Configurações Financeiras por Escola", status: "ok", notes: "Ano lectivo, meses, propina base, limites de emolumentos, modelo de multas, frequência de cobrança." },
          { name: "Configurações Académicas", status: "ok", notes: "Número máximo de alunos, nomenclatura do portal (Escola / Universidade / Infantário), funcionalidades activadas." },
          { name: "Configurações de Pagamento (EMIS)", status: "ok", notes: "Métodos activos por escola: GPO, Multicaixa Referência, Débito Directo. Integração Split Payment." },
          { name: "Configurações de Comunicação — SMS", status: "ok", notes: "Activar/desactivar SMS por escola, fallback, provedor, API key, remetente e eventos automáticos." },
          { name: "Configurações de Comunicação — Push (novo)", status: "new", notes: "Config. push notifications por escola: activar/desactivar, fallback, provedor (FCM / Web Push / Custom), credenciais VAPID/FCM e eventos automáticos. Credenciais globais FCM usadas por defeito se campos em branco." },
          { name: "Gestão de IBAN / Dados Bancários", status: "ok", notes: "Actualização de IBAN do comerciante para liquidações Split Payment." },
          { name: "Emolumentos Globais por Escola", status: "ok", notes: "Criação e associação de emolumentos globais (partilhados entre escolas do mesmo grupo)." },
          { name: "Reset de Password de Escola", status: "ok", notes: "Redefinição de palavra-passe de acesso à conta da escola pelo admin." },
        ],
      },
      {
        name: "Módulo de Monitorização Global",
        features: [
          { name: "Dashboard de Estatísticas", status: "ok", notes: "KPIs globais: total de escolas, alunos, propinas emitidas, dívida acumulada na plataforma." },
          { name: "Relatórios Financeiros", status: "ok", notes: "Vista consolidada de receita por escola, canal e período." },
          { name: "Propinas em Atraso (Global)", status: "ok", notes: "Lista de todas as propinas vencidas em todas as escolas." },
          { name: "Histórico de Recebimentos Global", status: "ok", notes: "Registo de todos os pagamentos confirmados na plataforma." },
          { name: "Vista Global de Alunos", status: "ok", notes: "Listagem e pesquisa de alunos em todas as escolas." },
          { name: "Vista Global de Turmas", status: "ok", notes: "Listagem e pesquisa de turmas em todas as escolas." },
          { name: "Logs e Alertas", status: "ok", notes: "Registo de eventos críticos da plataforma: falhas de liquidação, erros do motor, etc." },
        ],
      },
      {
        name: "Módulo de Comunicação Global",
        features: [
          { name: "Gestão Global de SMS", status: "ok", notes: "Envio em massa de SMS a todas as escolas ou selecção manual. Histórico de envios globais." },
          { name: "Push Notifications FCM — Global", status: "ok", notes: "Configuração de credenciais FCM globais (Project ID, Service Account JSON). Envio de push de teste por token de dispositivo." },
          { name: "Comunicados por Escola", status: "ok", notes: "Composição, publicação e histórico de comunicados por escola a partir do backoffice." },
        ],
      },
      {
        name: "Módulo de Configurações Técnicas (EMIS)",
        features: [
          { name: "Config. GPO (Gateway de Pagamento Online)", status: "ok", notes: "URL do gateway, credenciais de merchant, ambiente (sandbox/produção), certificados TLS." },
          { name: "Config. Multicaixa Referência", status: "ok", notes: "Entidade, chave de criptografia, URL de notificação, configuração de referências." },
          { name: "Config. Débito Directo (SDD/EMIS)", status: "ok", notes: "Ambiente, protocolos, endpoints BNA, credenciais de credor, identidade BIC/NIF/NIB, datas de janela de submissão SPTR." },
          { name: "Parâmetros de Split Payment", status: "ok", notes: "Taxa de comissão plataforma, IRT, contas de trânsito, agenda de liquidação (imediato/diário/semanal), KYC de comerciantes." },
        ],
      },
      {
        name: "Módulo de Segurança da API (novo)",
        features: [
          { name: "IP Whitelist EMIS/BNA", status: "new", notes: "Middleware que bloqueia (HTTP 403) tráfego externo aos blocos CIDR angolanos: 196.46.0.0/16 e 197.156.64.0/18. Aplicar em rotas de callback bancário." },
          { name: "Idempotência DB-backed", status: "new", notes: "Middleware X-Idempotency-Key (UUID v4 obrigatório). Chaves cached 24 h na tabela idempotency_keys. Previne replay attacks e dupla submissão no motor de split." },
          { name: "Rate Limiting Financeiro", status: "new", notes: "Máximo 10 req/min por chave composta IP+token Bearer em rotas do Split Payment. Resposta HTTP 429 com mensagem localizada." },
          { name: "Criptografia AES-256-GCM", status: "new", notes: "Utilitário para cifrar dados sensíveis de comerciantes (chaves API, NIBs) antes de guardar na DB. IV de 96 bits por operação. Auth tag de 128 bits previne adulteração. Configurar APP_ENCRYPTION_KEY em Replit Secrets." },
          { name: "Validação de Schema (Zod + SQL injection)", status: "new", notes: "Factory de middleware: detecta padrões SQL maliciosos e valida payload com schema Zod (HTTP 400 com detalhe por campo). Aplicado em POST /school/splitpay/transacoes." },
          { name: "CORS Restritivo", status: "ok", notes: "Origens configuradas via ALLOWED_ORIGINS. Headers permitidos: Content-Type, Authorization, X-Webhook-Signature, X-Idempotency-Key. Wildcard '*' bloqueado." },
        ],
      },
      {
        name: "Módulo de Backups e Disaster Recovery",
        features: [
          { name: "Backup Automático PostgreSQL", status: "ok", notes: "Dump completo da base de dados via pg_dump com compressão. Agendado (activar com BACKUP_ENABLED=true)." },
          { name: "Armazenamento S3-compatible", status: "ok", notes: "Upload para bucket S3 (AWS ou Cloudflare R2). Configurar: BACKUP_S3_BUCKET, BACKUP_S3_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY." },
          { name: "Registo de Execuções", status: "ok", notes: "Tabela backup_runs com estado, tamanho, duração e mensagem de erro de cada execução." },
          { name: "Manual de Disaster Recovery", status: "ok", notes: "Documentação em ops/backup/DISASTER_RECOVERY.md com procedimentos de restore completo." },
        ],
      },
      {
        name: "Módulo de Gestão de Acessos Admin",
        features: [
          { name: "Utilizadores Administradores", status: "ok", notes: "Criação e gestão de contas de super-admin da plataforma." },
          { name: "Auditoria de Acções", status: "ok", notes: "Log de alterações a métodos de pagamento e configurações sensíveis de escolas." },
        ],
      },
    ],
  },
];

// ── Layout constants ─────────────────────────────────────────────────────────
const PAGE_W = 595.28;  // A4 largura em pontos
const PAGE_H = 841.89;  // A4 altura
const M      = 45;      // margem
const CW     = PAGE_W - M * 2;  // largura de conteúdo

// ── PDF builder ───────────────────────────────────────────────────────────────
const doc = new PDFDocument({
  size: "A4",
  margins: { top: M, bottom: M, left: M, right: M },
  info: {
    Title: "Kiwara Tech — Relatório de Funcionalidades",
    Author: "Kiwara Tech",
    Subject: "Estado da Plataforma de Gestão Escolar",
    Keywords: "kiwara, angola, escola, saas, funcionalidades",
    CreationDate: new Date(),
  },
});

const stream = fs.createWriteStream(OUT);
doc.pipe(stream);

let y = M;

// ── Helper: checa se precisa de nova página ───────────────────────────────────
function checkPage(need = 60) {
  if (y + need > PAGE_H - M) {
    doc.addPage();
    y = M;
    drawPageHeader();
  }
}

// ── Header de página (rodapé) ─────────────────────────────────────────────────
function drawPageHeader() {
  // rodapé
  doc
    .fontSize(7).fillColor(C.slate)
    .text(
      `Kiwara Tech — Relatório de Funcionalidades · ${new Date().toLocaleDateString("pt-AO", { day: "2-digit", month: "long", year: "numeric" })} · Confidencial`,
      M, PAGE_H - 28, { width: CW, align: "center" }
    );
}

// ── Capa ──────────────────────────────────────────────────────────────────────
// Fundo escuro da capa
doc.rect(0, 0, PAGE_W, PAGE_H).fill(C.dark);

// Faixa decorativa
doc.rect(0, PAGE_H * 0.55, PAGE_W, 4).fill(C.primary);

// Título
doc
  .font("Helvetica-Bold")
  .fontSize(32)
  .fillColor(C.white)
  .text("KIWARA TECH", M, 220, { width: CW, align: "center" });

doc
  .font("Helvetica")
  .fontSize(16)
  .fillColor("#93C5FD")
  .text("Plataforma de Gestão Escolar — Angola", M, 262, { width: CW, align: "center" });

doc
  .font("Helvetica-Bold")
  .fontSize(22)
  .fillColor(C.white)
  .text("Relatório de Funcionalidades", M, 320, { width: CW, align: "center" });

doc
  .font("Helvetica")
  .fontSize(13)
  .fillColor("#CBD5E1")
  .text("Estado actualizado da plataforma por perfil e módulo", M, 354, { width: CW, align: "center" });

// Data
const dataStr = new Date().toLocaleDateString("pt-AO", { day: "2-digit", month: "long", year: "numeric" });
doc
  .font("Helvetica")
  .fontSize(11)
  .fillColor("#94A3B8")
  .text(dataStr, M, 405, { width: CW, align: "center" });

// Legenda de estados
const legendY = 500;
doc
  .font("Helvetica-Bold")
  .fontSize(10)
  .fillColor("#CBD5E1")
  .text("LEGENDA DE ESTADOS:", M + 80, legendY);

const legends = [
  { ...STATUS.ok,      x: M + 80 },
  { ...STATUS.partial, x: M + 230 },
  { ...STATUS.pending, x: M + 370 },
  { ...STATUS.new,     x: M + 480 },
];
legends.forEach(({ label, color, x }) => {
  doc.roundedRect(x, legendY + 22, 10, 10, 2).fill(color);
  doc.font("Helvetica").fontSize(9).fillColor("#E2E8F0").text(label, x + 15, legendY + 23);
});

// Perfis na capa
const profileColors = ["#1A56DB", "#059669", "#7C3AED"];
const profileLabels = ["Gestão do Colégio", "Portal do Encarregado", "Admin — Backoffice"];
profileLabels.forEach((lbl, i) => {
  const px = M + 20 + i * 170;
  doc.roundedRect(px, legendY + 60, 150, 36, 6).fill(profileColors[i]);
  doc.font("Helvetica-Bold").fontSize(9).fillColor(C.white)
    .text(lbl, px, legendY + 73, { width: 150, align: "center" });
});

// Totals preview
const totalFeatures = REPORT.reduce((a, p) => a + p.modules.reduce((b, m) => b + m.features.length, 0), 0);
const totalModules  = REPORT.reduce((a, p) => a + p.modules.length, 0);
doc.font("Helvetica").fontSize(10).fillColor("#94A3B8")
  .text(`${totalFeatures} funcionalidades · ${totalModules} módulos · 3 perfis`, M, legendY + 110, { width: CW, align: "center" });

doc.addPage();
y = M;
drawPageHeader();

// ── Índice ────────────────────────────────────────────────────────────────────
doc.font("Helvetica-Bold").fontSize(16).fillColor(C.dark)
  .text("Índice", M, y);
y += 28;

doc.moveTo(M, y).lineTo(M + CW, y).strokeColor(C.border).lineWidth(0.5).stroke();
y += 12;

REPORT.forEach((profile, pi) => {
  checkPage(36);
  doc.font("Helvetica-Bold").fontSize(11).fillColor(profile.color)
    .text(`${pi + 1}.  ${profile.profile}`, M + 10, y);
  y += 18;

  profile.modules.forEach((mod, mi) => {
    checkPage(16);
    const modNum = `${pi + 1}.${mi + 1}`;
    doc.font("Helvetica").fontSize(9).fillColor(C.slate)
      .text(`${modNum}  ${mod.name}`, M + 28, y);
    y += 14;
  });
  y += 4;
});

// ── Conteúdo por perfil ───────────────────────────────────────────────────────
REPORT.forEach((profile, pi) => {
  doc.addPage();
  y = M;
  drawPageHeader();

  // Banner do perfil
  doc.rect(M, y, CW, 52).fill(profile.color);
  doc.font("Helvetica-Bold").fontSize(18).fillColor(C.white)
    .text(`${pi + 1}. ${profile.profile}`, M + 18, y + 10);
  doc.font("Helvetica").fontSize(9).fillColor("rgba(255,255,255,0.8)")
    .text(profile.subtitle, M + 18, y + 34);
  y += 66;

  // Sumário do perfil
  const totalF = profile.modules.reduce((a, m) => a + m.features.length, 0);
  const okF    = profile.modules.reduce((a, m) => a + m.features.filter(f => f.status === "ok").length, 0);
  const newF   = profile.modules.reduce((a, m) => a + m.features.filter(f => f.status === "new").length, 0);
  const partF  = profile.modules.reduce((a, m) => a + m.features.filter(f => f.status === "partial").length, 0);
  const pendF  = profile.modules.reduce((a, m) => a + m.features.filter(f => f.status === "pending").length, 0);

  checkPage(40);
  doc.rect(M, y, CW, 32).fill(C.light);
  const cols = [
    { label: `${profile.modules.length} Módulos`,           x: M + 10 },
    { label: `${totalF} Funcionalidades`,                   x: M + CW * 0.22 },
    { label: `${okF + newF} Implementadas`,                 x: M + CW * 0.44 },
    { label: `${partF} Parciais`,                           x: M + CW * 0.66 },
    { label: `${pendF} Pendentes`,                          x: M + CW * 0.82 },
  ];
  cols.forEach(({ label, x }) => {
    doc.font("Helvetica-Bold").fontSize(8).fillColor(C.slate)
      .text(label, x, y + 11, { width: CW * 0.22 });
  });
  y += 42;

  // Módulos e funcionalidades
  profile.modules.forEach((mod, mi) => {
    checkPage(50);

    // Cabeçalho do módulo
    doc.rect(M, y, CW, 26).fill("#EFF6FF");
    doc.font("Helvetica-Bold").fontSize(11).fillColor(profile.color)
      .text(`${pi + 1}.${mi + 1}  ${mod.name}`, M + 12, y + 7);
    doc.font("Helvetica").fontSize(8).fillColor(C.slate)
      .text(`${mod.features.length} funcionalidades`, M + CW - 90, y + 9);
    y += 30;

    // Cabeçalho da tabela
    doc.rect(M, y, CW, 18).fill(C.border);
    doc.font("Helvetica-Bold").fontSize(8).fillColor(C.dark)
      .text("Funcionalidade", M + 10, y + 5)
      .text("Estado", M + CW * 0.58, y + 5)
      .text("Notas / Regras de Implementação", M + CW * 0.69, y + 5);
    y += 18;

    // Linhas de funcionalidades
    mod.features.forEach((feat, fi) => {
      const st = STATUS[feat.status];
      // Estimar altura da linha baseado no comprimento das notas
      const notesWidth = CW * 0.31 - 8;
      const notesHeight = Math.max(32, Math.ceil(feat.notes.length / 48) * 12 + 8);
      const rowH = notesHeight;

      checkPage(rowH + 4);

      const rowBg = fi % 2 === 0 ? C.white : "#F8FAFC";
      doc.rect(M, y, CW, rowH).fill(rowBg);

      // Nome da funcionalidade
      doc.font("Helvetica").fontSize(8.5).fillColor(C.black)
        .text(feat.name, M + 10, y + 6, { width: CW * 0.55, lineGap: 1 });

      // Badge de estado
      const bx = M + CW * 0.58;
      const by = y + 5;
      doc.roundedRect(bx, by, 72, 14, 3).fill(st.color);
      doc.font("Helvetica-Bold").fontSize(7).fillColor(C.white)
        .text(st.label, bx, by + 3.5, { width: 72, align: "center" });

      // Notas
      doc.font("Helvetica").fontSize(7.5).fillColor(C.slate)
        .text(feat.notes, M + CW * 0.69, y + 5, {
          width: notesWidth,
          lineGap: 1,
        });

      // Linha divisória
      doc.moveTo(M, y + rowH).lineTo(M + CW, y + rowH)
        .strokeColor(C.border).lineWidth(0.3).stroke();

      y += rowH;
    });

    y += 14;
  });
});

// ── Secção de Pendências e Próximos Passos ─────────────────────────────────────
doc.addPage();
y = M;
drawPageHeader();

doc.rect(M, y, CW, 36).fill(C.amber);
doc.font("Helvetica-Bold").fontSize(16).fillColor(C.white)
  .text("Pendências e Próximos Passos", M + 18, y + 10);
y += 50;

const PENDING_ITEMS = [
  {
    area: "Portal do Encarregado — Push Notifications",
    items: [
      "Implementar registo de Service Worker (sw.js) no frontend Vite para receber push notifications via FCM.",
      "Adicionar lógica de pedido de permissão de notificação no browser ao encarregado no login.",
      "Endpoint POST /api/school/fcm/subscribe para guardar o token FCM do dispositivo do encarregado.",
      "Envio efectivo de push ao publicar comunicados (trigger no backend ao chamar comunicar/publicar).",
    ],
  },
  {
    area: "Portal do Encarregado — Email Transaccional",
    items: [
      "Integrar provider SMTP ou SendGrid com as credenciais configuradas por escola (email_sender).",
      "Templates de email para: nova fatura, pagamento confirmado, atraso de pagamento.",
      "Endpoint de teste de envio de email no backoffice admin (similar ao SMS test).",
    ],
  },
  {
    area: "Débito Directo SDD — Automação Bancária",
    items: [
      "Integração API bilateral com banco comercial angolano parceiro (endpoint SPTR/EMIS).",
      "Geração e submissão de ficheiro ISO 20022 XML para débitos SDD em lote.",
      "Gestão do ciclo de vida do mandato: pré-notificação D-1, débito D+0, retorno de falha.",
      "Reconciliação automática de débitos confirmados vs. rejeitados pelo banco.",
    ],
  },
  {
    area: "Staff Portal — Expansão de Funcionalidades",
    items: [
      "Registo e consulta de presenças por turma e por dia.",
      "Lançamento de notas e avaliações (módulo académico diferenciado do financeiro).",
      "Calendário de provas e eventos para staff e alunos.",
    ],
  },
  {
    area: "Segurança — Activação em Produção",
    items: [
      "Configurar APP_ENCRYPTION_KEY em Replit Secrets (mínimo 32 chars) antes de activar criptografia de dados sensíveis.",
      "Aplicar emisIpWhitelist nos endpoints de callback GPO e SDD quando integração bancária for activada.",
      "Configurar ALLOWED_ORIGINS em Replit Secrets com o domínio de produção para CORS restritivo.",
      "Activar backups automáticos: BACKUP_ENABLED=true + credenciais S3 em Secrets.",
    ],
  },
];

PENDING_ITEMS.forEach(({ area, items }) => {
  checkPage(60);

  doc.rect(M, y, CW, 22).fill("#FEF3C7");
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#92400E")
    .text(area, M + 10, y + 6);
  y += 26;

  items.forEach((item, i) => {
    checkPage(20);
    doc.roundedRect(M + 10, y + 4, 7, 7, 1).fill(C.amber);
    doc.font("Helvetica").fontSize(8.5).fillColor(C.black)
      .text(item, M + 24, y + 3, { width: CW - 28, lineGap: 1 });
    y += Math.max(18, Math.ceil(item.length / 90) * 12 + 6);
  });

  y += 10;
});

// ── Rodapé final ──────────────────────────────────────────────────────────────
checkPage(50);
doc.moveTo(M, y).lineTo(M + CW, y).strokeColor(C.border).lineWidth(0.5).stroke();
y += 14;
doc.font("Helvetica").fontSize(8).fillColor(C.slate)
  .text(
    "Documento gerado automaticamente pela plataforma Kiwara Tech. " +
    "Versão baseada no estado do código-fonte em " + dataStr + ". " +
    "Confidencial — uso interno.",
    M, y, { width: CW, align: "center", lineGap: 2 }
  );

// ── Finalizar ─────────────────────────────────────────────────────────────────
doc.end();
stream.on("finish", () => {
  console.log("PDF gerado:", OUT);
  console.log("Tamanho:", Math.round(fs.statSync(OUT).size / 1024), "KB");
});
stream.on("error", (e) => {
  console.error("Erro ao gerar PDF:", e);
  process.exit(1);
});
