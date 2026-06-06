#!/usr/bin/env node
"use strict";

const PDFDocument = require('/home/runner/workspace/artifacts/api-server/node_modules/pdfkit');
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "relatorio-kiwara-tech.pdf");
const doc = new PDFDocument({ size: "A4", margin: 45, bufferPages: true });
doc.pipe(fs.createWriteStream(OUT));

/* ── Palette ── */
const C = {
  primary:  "#1E40AF",
  accent:   "#0EA5E9",
  green:    "#16A34A",
  amber:    "#D97706",
  red:      "#DC2626",
  slate900: "#0F172A",
  slate700: "#334155",
  slate500: "#64748B",
  slate200: "#E2E8F0",
  slate100: "#F1F5F9",
  white:    "#FFFFFF",
};

/* ── Fonts (built-in) ── */
const FONT  = "Helvetica";
const FONTB = "Helvetica-Bold";
const FONTI = "Helvetica-Oblique";

const PW = doc.page.width  - doc.options.margin * 2;  // usable width

/* ═══════════════════════════════════════
   Helpers
═══════════════════════════════════════ */
function pageBottom() { return doc.page.height - doc.options.margin - 30; }

function checkNewPage(needed = 60) {
  if (doc.y + needed > pageBottom()) {
    doc.addPage();
    return true;
  }
  return false;
}

function rule(color = C.slate200, y = null) {
  const yy = y ?? doc.y;
  doc.save().moveTo(doc.options.margin, yy).lineTo(doc.options.margin + PW, yy)
     .strokeColor(color).lineWidth(0.5).stroke().restore();
}

function h1(text) {
  checkNewPage(50);
  doc.font(FONTB).fontSize(20).fillColor(C.primary).text(text, { align: "left" });
  doc.moveDown(0.3);
  rule(C.primary);
  doc.moveDown(0.6);
}

function h2(text) {
  checkNewPage(40);
  doc.moveDown(0.4);
  doc.font(FONTB).fontSize(13).fillColor(C.slate900).text(text);
  doc.moveDown(0.3);
}

function h3(text) {
  checkNewPage(30);
  doc.moveDown(0.2);
  doc.font(FONTB).fontSize(10.5).fillColor(C.primary).text(text);
  doc.moveDown(0.15);
}

function body(text, opts = {}) {
  doc.font(FONT).fontSize(9.5).fillColor(C.slate700).text(text, opts);
}

function note(text) {
  doc.font(FONTI).fontSize(8.5).fillColor(C.slate500).text(text);
}

/* status badge drawn inline */
function statusBadge(label, color) {
  const x = doc.x;
  const y = doc.y;
  const pad = 4;
  doc.font(FONTB).fontSize(7.5);
  const tw = doc.widthOfString(label);
  const bw = tw + pad * 2 + 2;
  const bh = 11;
  doc.save()
     .roundedRect(x, y + 0.5, bw, bh, 3)
     .fillColor(color).fill()
     .fillColor(C.white).text(label, x + pad + 1, y + 2, { lineBreak: false })
     .restore();
  return bw + 4; // advance width
}

/* ── Table renderer ── */
function table(headers, rows, colWidths) {
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  const startX = doc.options.margin;
  const ROW_H  = 16;
  const CELL_PAD = 5;

  function drawRow(cells, isHeader, y) {
    let x = startX;
    cells.forEach((cell, i) => {
      const w = colWidths[i];
      if (isHeader) {
        doc.save().rect(x, y, w, ROW_H).fillColor(C.primary).fill().restore();
        doc.font(FONTB).fontSize(7.5).fillColor(C.white)
           .text(cell, x + CELL_PAD, y + 4, { width: w - CELL_PAD * 2, lineBreak: false });
      } else {
        doc.font(FONT).fontSize(8).fillColor(C.slate700)
           .text(cell, x + CELL_PAD, y + 3, { width: w - CELL_PAD * 2, lineBreak: false });
      }
      x += w;
    });
    if (!isHeader) {
      doc.save().moveTo(startX, y + ROW_H).lineTo(startX + totalW, y + ROW_H)
         .strokeColor(C.slate200).lineWidth(0.4).stroke().restore();
    }
  }

  /* header */
  checkNewPage(ROW_H + 4);
  drawRow(headers, true, doc.y);
  doc.y += ROW_H;

  /* rows */
  rows.forEach((row, ri) => {
    checkNewPage(ROW_H + 4);
    const bg = ri % 2 === 0 ? C.white : C.slate100;
    const y = doc.y;
    doc.save().rect(startX, y, totalW, ROW_H).fillColor(bg).fill().restore();
    drawRow(row, false, y);
    doc.y += ROW_H;
  });

  doc.moveDown(0.5);
}

/* status symbol */
function sym(s) {
  if (s === "ok")      return "OK";
  if (s === "warn")    return "PARCIAL";
  if (s === "bug")     return "BUG";
  if (s === "inc")     return "INCOMPLETO";
  if (s === "sep")     return "SEPARADO";
  return s;
}

function symColor(s) {
  if (s === "ok")   return "#16A34A";
  if (s === "warn") return "#D97706";
  if (s === "bug" || s === "inc" || s === "sep") return "#DC2626";
  return C.slate500;
}

/* ── Feature table (with status badge) ── */
function featureTable(items) {
  /* items: [{ n, name, status: "ok"|"warn"|"bug"|"inc"|"sep", note }] */
  const COL = [22, 190, 60, PW - 22 - 190 - 60];
  const startX = doc.options.margin;
  const ROW_H_BASE = 16;
  const CELL_PAD = 5;

  /* header */
  checkNewPage(20);
  const hy = doc.y;
  ["#", "Funcionalidade", "Estado", "Observação / Correcção"].forEach((h, i) => {
    const x = startX + COL.slice(0, i).reduce((a, b) => a + b, 0);
    doc.save().rect(x, hy, COL[i], 14).fillColor(C.primary).fill().restore();
    doc.font(FONTB).fontSize(7.5).fillColor(C.white)
       .text(h, x + CELL_PAD, hy + 3, { width: COL[i] - CELL_PAD * 2, lineBreak: false });
  });
  doc.y = hy + 14;
  doc.save().moveTo(startX, doc.y).lineTo(startX + PW, doc.y)
     .strokeColor(C.primary).lineWidth(0.8).stroke().restore();

  items.forEach((item, ri) => {
    const noteH = item.note
      ? Math.ceil(doc.font(FONTI).fontSize(7.5).heightOfString(item.note, { width: COL[3] - CELL_PAD * 2 }))
      : 0;
    const rowH = Math.max(ROW_H_BASE, noteH + 8);

    checkNewPage(rowH + 4);
    const y = doc.y;
    const bg = ri % 2 === 0 ? C.white : C.slate100;
    doc.save().rect(startX, y, PW, rowH).fillColor(bg).fill().restore();

    let x = startX;

    /* # */
    doc.font(FONTB).fontSize(7.5).fillColor(C.slate500)
       .text(String(item.n), x + CELL_PAD, y + (rowH - 9) / 2, { lineBreak: false });
    x += COL[0];

    /* name */
    doc.font(FONTB).fontSize(8).fillColor(C.slate900)
       .text(item.name, x + CELL_PAD, y + (rowH - 9) / 2, { width: COL[1] - CELL_PAD * 2, lineBreak: false });
    x += COL[1];

    /* badge */
    const label = sym(item.status);
    const bcolor = symColor(item.status);
    const tw = doc.font(FONTB).fontSize(7.5).widthOfString(label);
    const bw = tw + 10;
    const bh = 12;
    const bx = x + CELL_PAD;
    const by = y + (rowH - bh) / 2;
    doc.save().roundedRect(bx, by, bw, bh, 3).fillColor(bcolor).fill()
       .fillColor(C.white).font(FONTB).fontSize(7.5)
       .text(label, bx + 4, by + 2.5, { lineBreak: false }).restore();
    x += COL[2];

    /* note */
    if (item.note) {
      doc.font(FONTI).fontSize(7.5).fillColor(C.slate500)
         .text(item.note, x + CELL_PAD, y + 3, { width: COL[3] - CELL_PAD * 2 });
    }

    doc.y = y + rowH;
    doc.save().moveTo(startX, doc.y).lineTo(startX + PW, doc.y)
       .strokeColor(C.slate200).lineWidth(0.3).stroke().restore();
  });

  doc.moveDown(0.6);
}

/* priority table */
function priorityTable(items) {
  const COL = [55, 230, PW - 55 - 230];
  const startX = doc.options.margin;
  const CELL_PAD = 5;

  checkNewPage(20);
  const hy = doc.y;
  ["Prioridade", "Item", "Acção Requerida"].forEach((h, i) => {
    const x = startX + COL.slice(0, i).reduce((a, b) => a + b, 0);
    doc.save().rect(x, hy, COL[i], 14).fillColor(C.primary).fill().restore();
    doc.font(FONTB).fontSize(7.5).fillColor(C.white)
       .text(h, x + CELL_PAD, hy + 3, { width: COL[i] - CELL_PAD * 2, lineBreak: false });
  });
  doc.y = hy + 14;

  items.forEach((item, ri) => {
    const noteH = Math.ceil(
      doc.font(FONT).fontSize(8).heightOfString(item.action, { width: COL[2] - CELL_PAD * 2 })
    );
    const rowH = Math.max(18, noteH + 8);
    checkNewPage(rowH + 4);
    const y = doc.y;
    const bg = ri % 2 === 0 ? C.white : C.slate100;
    doc.save().rect(startX, y, PW, rowH).fillColor(bg).fill().restore();

    /* priority badge */
    const pColor = item.prio === "Alta" ? "#DC2626" : item.prio === "Media" ? "#D97706" : "#64748B";
    const pLabel = `${item.prio}`;
    const ptw = doc.font(FONTB).fontSize(7.5).widthOfString(pLabel);
    const pbw = ptw + 10;
    const pbh = 12;
    const pbx = startX + CELL_PAD;
    const pby = y + (rowH - pbh) / 2;
    doc.save().roundedRect(pbx, pby, pbw, pbh, 3).fillColor(pColor).fill()
       .fillColor(C.white).font(FONTB).fontSize(7.5)
       .text(pLabel, pbx + 4, pby + 2.5, { lineBreak: false }).restore();

    /* item */
    let x = startX + COL[0];
    doc.font(FONTB).fontSize(8).fillColor(C.slate900)
       .text(item.item, x + CELL_PAD, y + (rowH - 9) / 2, { width: COL[1] - CELL_PAD * 2, lineBreak: false });
    x += COL[1];

    /* action */
    doc.font(FONT).fontSize(8).fillColor(C.slate700)
       .text(item.action, x + CELL_PAD, y + 3, { width: COL[2] - CELL_PAD * 2 });

    doc.y = y + rowH;
    doc.save().moveTo(startX, doc.y).lineTo(startX + PW, doc.y)
       .strokeColor(C.slate200).lineWidth(0.3).stroke().restore();
  });
  doc.moveDown(0.6);
}

/* ═══════════════════════════════════════
   COVER PAGE
═══════════════════════════════════════ */
doc.save()
   .rect(0, 0, doc.page.width, 200)
   .fillColor(C.primary).fill().restore();

doc.save()
   .rect(0, 200, doc.page.width, 4)
   .fillColor(C.accent).fill().restore();

doc.font(FONTB).fontSize(28).fillColor(C.white)
   .text("Kiwara Tech", doc.options.margin, 60, { align: "center" });

doc.font(FONT).fontSize(13).fillColor("#BFDBFE")
   .text("Relatório de Funcionalidades do Sistema", { align: "center" });

doc.font(FONT).fontSize(9).fillColor("#93C5FD")
   .text("Análise por Perfil de Utilizador e Motor de Regras", { align: "center" });

doc.moveDown(1);
doc.font(FONTB).fontSize(9).fillColor("#DBEAFE")
   .text(`Gerado em: ${new Date().toLocaleDateString("pt-AO", {
     day: "2-digit", month: "long", year: "numeric"
   })}`, { align: "center" });

doc.y = 240;

/* Summary boxes */
const boxes = [
  { label: "Portal Encarregado/Aluno", count: "18 funcionalidades", color: C.accent },
  { label: "Administração Geral",       count: "22 funcionalidades", color: "#7C3AED" },
  { label: "Gestão do Colégio",         count: "31 funcionalidades", color: C.green },
  { label: "Motor de Regras",           count: "12 regras",          color: "#0F766E" },
];
const bw = (PW - 15) / 4;
boxes.forEach((b, i) => {
  const bx = doc.options.margin + i * (bw + 5);
  const by = doc.y;
  doc.save().roundedRect(bx, by, bw, 70, 6).fillColor(b.color).fill().restore();
  doc.font(FONTB).fontSize(8).fillColor(C.white)
     .text(b.label, bx + 6, by + 10, { width: bw - 12, align: "center" });
  doc.font(FONTB).fontSize(16).fillColor(C.white)
     .text(b.count, bx + 6, by + 30, { width: bw - 12, align: "center" });
});

doc.y += 90;

/* Legend */
const legends = [
  { color: C.green,  label: "OK — Implementado e funcional" },
  { color: C.amber,  label: "PARCIAL — Incompleto ou limitado" },
  { color: C.red,    label: "BUG — Erro lógico identificado e corrigido" },
  { color: C.red,    label: "INCOMPLETO — Infraestrutura existe mas falta integração" },
];
doc.font(FONTB).fontSize(9).fillColor(C.slate700).text("Legenda:", doc.options.margin, doc.y);
doc.moveDown(0.3);
legends.forEach(l => {
  const ly = doc.y;
  doc.save().circle(doc.options.margin + 5, ly + 4, 4).fillColor(l.color).fill().restore();
  doc.font(FONT).fontSize(8).fillColor(C.slate700)
     .text(l.label, doc.options.margin + 14, ly, { lineBreak: false });
  doc.moveDown(0.5);
});

doc.addPage();

/* ═══════════════════════════════════════
   1. PORTAL DO ENCARREGADO / ALUNO
═══════════════════════════════════════ */
h1("1. Portal do Encarregado / Aluno");
body("Ficheiros: encarregado.tsx (3 448 linhas)  ·  API: routes/guardian.ts (1 027 linhas)");
doc.moveDown(0.5);

featureTable([
  { n:1,  name:"Autenticação",                              status:"ok",   note:"Login por telefone + password." },
  { n:2,  name:"Mudança de password obrigatória",           status:"ok",   note:"Forçada no primeiro login." },
  { n:3,  name:"Recuperação de PIN",                        status:"ok",   note:"Reset para '1234' via /guardian/recuperar-pin." },
  { n:4,  name:"Dashboard de Alunos",                       status:"ok",   note:"Dívida total, estado de propinas, logo da escola." },
  { n:5,  name:"Listagem de Propinas",                      status:"ok",   note:"Filtros por Pago / Pendente / Vencido." },
  { n:6,  name:"Pagamento por Referência Multicaixa",       status:"ok",   note:"Referência combinada multi-mês." },
  { n:7,  name:"Pagamento GPO / Multicaixa Express",        status:"warn", note:"URL hardcoded (gpo.emis.ao/checkout). Requer integração real com merchant ID e token EMIS do banco." },
  { n:8,  name:"Débito Direto (subscrição IBAN)",           status:"ok",   note:"Mandatos, pedido de cancelamento, datas de débito." },
  { n:9,  name:"Ocorrências",                               status:"ok",   note:"Lista de incidentes comportamentais registados." },
  { n:10, name:"Comunicados",                               status:"ok",   note:"Receber + marcar como lido." },
  { n:11, name:"Calendário de Provas",                      status:"ok",   note:"Eventos publicados pela escola com alerta." },
  { n:12, name:"Horário de Aulas",                          status:"warn", note:"Grelha semanal só aparece quando eventos têm hora_inicio_aula preenchida. Sem fallback elegante para lista plana." },
  { n:13, name:"Módulo Infantil — Rotinas Diárias",         status:"ok",   note:"Registo de actividades do dia." },
  { n:14, name:"Módulo Infantil — Ementas",                 status:"ok",   note:"Menu semanal." },
  { n:15, name:"Módulo Infantil — Galeria de Fotos",        status:"ok",   note:"Álbum de momentos." },
  { n:16, name:"Loja Escolar — Artigos e Carrinho",         status:"ok",   note:"Catálogo, filtros, carrinho de compras." },
  { n:17, name:"Loja Escolar — Checkout",                   status:"warn", note:"Checkout GPO usa URL simulada. Acompanhamento de entrega não disponível no portal." },
  { n:18, name:"Notificações Push (FCM)",                   status:"inc",  note:"Infra-estrutura backend completa (tabela fcm_device_tokens, envio via API FCM v1), mas o portal não regista o token do dispositivo após login." },
]);

/* ═══════════════════════════════════════
   2. ADMINISTRAÇÃO GERAL
═══════════════════════════════════════ */
h1("2. Administração Geral");
body("Ficheiros: admin-dashboard.tsx (10 485 linhas)  ·  API: routes/admin.ts (2 263 linhas)");
doc.moveDown(0.5);

featureTable([
  { n:1,  name:"Estatísticas Globais da Plataforma",        status:"ok",   note:"Alunos, receitas e dívidas de todos os colégios." },
  { n:2,  name:"Gestão de Colégios (CRUD)",                 status:"ok",   note:"Criar, editar, eliminar escolas." },
  { n:3,  name:"Reset de Password de Colégio",              status:"ok",   note:"" },
  { n:4,  name:"Activar/Desactivar Módulo Infantil",        status:"ok",   note:"Toggle por escola." },
  { n:5,  name:"Configuração de Métodos de Pagamento",      status:"ok",   note:"MCX, GPO, Numerário, Transferência por escola." },
  { n:6,  name:"Configuração Middleware EMIS",              status:"ok",   note:"URL, API key, prefixo de referência." },
  { n:7,  name:"Motor de Regras de Multa por Escola",       status:"ok",   note:"Percentagem, escalões, valor fixo, carência — ver secção 4." },
  { n:8,  name:"Emolumentos Globais (CRUD)",                status:"ok",   note:"Taxas partilhadas entre escolas." },
  { n:9,  name:"Emolumentos por Escola",                    status:"ok",   note:"Taxas locais, activo/inactivo." },
  { n:10, name:"Pacotes de Emolumentos",                    status:"ok",   note:"Agrupamentos de propina + taxas." },
  { n:11, name:"SplitPay — Comissão por Escola",            status:"ok",   note:"Taxa %, simulação de split escola/plataforma." },
  { n:12, name:"Relatórios Financeiros Globais",            status:"ok",   note:"Por escola e período." },
  { n:13, name:"Configuração EMIS Global",                  status:"warn", note:"Campos preenchidos manualmente. Teste de ping ao servidor EMIS é simulado, sem validação real de conectividade." },
  { n:14, name:"Débito Direto Global",                      status:"ok",   note:"Pedidos de cancelamento pendentes de todas as escolas." },
  { n:15, name:"Comunicados por Escola",                    status:"ok",   note:"Publicar e eliminar com segmentação por turma." },
  { n:16, name:"Bolsas de Estudo (read-only)",              status:"ok",   note:"Visualização por escola." },
  { n:17, name:"RBAC — Gestão de Utilizadores e Perfis",   status:"warn", note:"Existe como página standalone (/access-management) mas não integrada no sidebar do painel de administração." },
  { n:18, name:"Auditoria de Acessos RBAC",                 status:"ok",   note:"Log de alterações críticas por utilizador." },
  { n:19, name:"Parametrização Técnica",                    status:"ok",   note:"Protocolo, certificados digitais, credencial de credor DD." },
  { n:20, name:"SMS — Configuração de Templates",           status:"ok",   note:"Templates configuráveis por evento e por escola." },
  { n:21, name:"Importação de Alunos por CSV",              status:"ok",   note:"Upload de ficheiro CSV com validação e relatório de erros." },
  { n:22, name:"Ajuste Manual de Propinas",                 status:"ok",   note:"Desconto, valor, motivo — com log de auditoria." },
]);

/* ═══════════════════════════════════════
   3. GESTÃO DO COLÉGIO
═══════════════════════════════════════ */
h1("3. Gestão do Colégio (Dashboard)");
body("Ficheiros: dashboard.tsx (12 572 linhas)  ·  API: routes/school.ts (2 548 linhas)");
doc.moveDown(0.5);

featureTable([
  { n:1,  name:"Alunos — Listagem e Pesquisa",              status:"ok",   note:"Filtros por turma, pesquisa por nome/BI/processo." },
  { n:2,  name:"Alunos — Ficha Individual",                 status:"ok",   note:"BI, nº processo, encarregado, bolsa, propinas, pagamento." },
  { n:3,  name:"Alunos — Adicionar Individualmente",        status:"ok",   note:"Com auto-geração de nº processo configurável." },
  { n:4,  name:"Alunos — Importação CSV em Lote",           status:"ok",   note:"Template download + validação + relatório de inserção." },
  { n:5,  name:"Turmas — Criar e Eliminar",                 status:"ok",   note:"Por turno (Manhã/Tarde/Noite) e ano lectivo." },
  { n:6,  name:"Propinas — Gerar Individual",               status:"ok",   note:"Por aluno, mês, valor com pacote ou valor livre." },
  { n:7,  name:"Propinas — Gerar em Lote",                  status:"ok",   note:"Toda a escola ou turma específica, por período de meses." },
  { n:8,  name:"Propinas — Baixa Manual (POS)",             status:"ok",   note:"Dinheiro, TPA, Transferência — com recibo imprimível (A4/térmico)." },
  { n:9,  name:"Propinas — Gerar Referência Multicaixa",    status:"ok",   note:"Individual ou multi-mês combinado." },
  { n:10, name:"Propinas — Fatura / Proforma",              status:"ok",   note:"Impressão A4 e térmica com número sequencial." },
  { n:11, name:"Consulta Financeira de Aluno",              status:"ok",   note:"Situação financeira completa com impressão A4/térmica." },
  { n:12, name:"Bolsas de Estudo — Tipos",                  status:"ok",   note:"Percentagem ou valor fixo, abrangência configurável." },
  { n:13, name:"Bolsas de Estudo — Atribuição a Alunos",    status:"ok",   note:"Com critério de concessão e data de vigência." },
  { n:14, name:"Emolumentos Locais",                        status:"ok",   note:"Criar, activar/desactivar, com regra de multa própria." },
  { n:15, name:"Emolumentos Globais (read-only)",           status:"ok",   note:"Visualização das taxas globais da plataforma." },
  { n:16, name:"Pacotes de Emolumentos",                    status:"ok",   note:"Agrupamentos; activar/desactivar por escola." },
  { n:17, name:"Loja Escolar — Artigos (CRUD)",             status:"ok",   note:"Nome, preço, stock, visibilidade no portal." },
  { n:18, name:"Loja Escolar — Entregas",                   status:"ok",   note:"Acompanhamento e marcação de entrega por encomenda." },
  { n:19, name:"Reconciliação Financeira",                  status:"ok",   note:"Pagamentos por canal, conciliação com extracto bancário." },
  { n:20, name:"Relatórios — Receita Mensal",               status:"ok",   note:"Gráfico de barras por mês." },
  { n:21, name:"Relatórios — Funil de Pagamentos",          status:"ok",   note:"Conversão: geradas → pagas." },
  { n:22, name:"Relatórios — Inadimplência por Turma",      status:"ok",   note:"" },
  { n:23, name:"Relatórios — Multas e Bolseiros",           status:"ok",   note:"" },
  { n:24, name:"Relatórios — Exportação CSV",               status:"ok",   note:"Alunos, propinas (todas/pagas/vencidas/pendentes)." },
  { n:25, name:"Débito Direto — Mandatos",                  status:"ok",   note:"Aprovar e rejeitar pedidos de cancelamento." },
  { n:26, name:"Comunicados — Publicar",                    status:"ok",   note:"Segmentação por turma ou toda a escola." },
  { n:27, name:"Comunicados — Aniversários do Dia",         status:"ok",   note:"Alerta automático com opção de envio de SMS." },
  { n:28, name:"Ocorrências — Registar Incidentes",         status:"ok",   note:"Por aluno, com tipo e descrição." },
  { n:29, name:"Gestão de Acessos RBAC",                    status:"ok",   note:"Criar utilizadores de staff com perfis e permissões." },
  { n:30, name:"Calendário Escolar",                        status:"ok",   note:"Criar calendários, eventos, provas e horários de aulas." },
  { n:31, name:"Partilhar Portal",                          status:"ok",   note:"QR code e link directo do portal do encarregado/aluno." },
  { n:32, name:"SplitPay",                                  status:"inc",  note:"Vista SplitPayView implementada mas chave 'splitpay' removida do tipo DashView — não está acessível no NAV." },
  { n:33, name:"Módulo Infantil (lado escola)",             status:"inc",  note:"Backend /api/infant/ completo, mas chave 'modulo_infantil' removida do tipo DashView — não está no NAV." },
  { n:34, name:"Portal Staff (Caixa/Tesouraria)",           status:"sep",  note:"StaffPortal.tsx existe como página autónoma mas não tem entrada no NAV do dashboard da escola." },
]);

/* ═══════════════════════════════════════
   4. MOTOR DE REGRAS
═══════════════════════════════════════ */
h1("4. Motor de Regras (multa_regras)");
body("Implementado em: routes/school.ts · função applyFinesForSchool()");
doc.moveDown(0.3);
note("As correcções de alta prioridade (carência, flag aplica_automatico e escalões) foram implementadas nesta versão do sistema.");
doc.moveDown(0.5);

featureTable([
  { n:1,  name:"Modelo 1 — Percentagem Fixa",               status:"ok",   note:"% aplicada após o dia_limite (dia do mês) ou em meses anteriores." },
  { n:2,  name:"Modelo 2 — Escalões (Brackets)",            status:"ok",   note:"CORRIGIDO: usa agora dias decorridos desde data_vencimento (daysOverdue), não dia-do-mês." },
  { n:3,  name:"Modelo 3 — Valor Fixo (AOA)",               status:"ok",   note:"Valor fixo aplicado após dia_limite." },
  { n:4,  name:"Dia de Vencimento Configurável",             status:"ok",   note:"Campo dia_limite configurável por escola." },
  { n:5,  name:"Período de Carência (dias_carencia)",        status:"ok",   note:"CORRIGIDO: a função agora verifica daysOverdue > diasCarencia antes de aplicar qualquer multa." },
  { n:6,  name:"Flag aplica_automatico",                     status:"ok",   note:"Verificado correctamente — multas só aplicadas quando o flag está activo." },
  { n:7,  name:"Trigger Automático no Portal",               status:"ok",   note:"Multas calculadas quando o encarregado acede ao portal." },
  { n:8,  name:"Aplicação em Lote",                         status:"ok",   note:"Via endpoint POST /school/relatorios/multas-aplicar." },
  { n:9,  name:"SMS de Notificação de Multa",               status:"ok",   note:"sendEventSMS('multa_aplicada') e 'atraso_pagamento' disparados automaticamente." },
  { n:10, name:"Ajuste Manual de Multa",                    status:"ok",   note:"Escola e admin podem ajustar valor, desconto e motivo." },
  { n:11, name:"Frequência de Propinas",                    status:"ok",   note:"Mensal, Trimestral ou Anual." },
  { n:12, name:"Regra de Multa por Emolumento",             status:"ok",   note:"Cada emolumento pode ter regra de multa independente da propina." },
]);

/* ═══════════════════════════════════════
   5. RESUMO DE CORRECÇÕES
═══════════════════════════════════════ */
h1("5. Resumo das Correcções Prioritárias");
doc.moveDown(0.2);

priorityTable([
  {
    prio: "Alta",
    item: "Motor de Regras — dias_carencia ignorado",
    action: "CORRIGIDO: adicionado daysOverdue > diasCarencia antes do cálculo da multa em applyFinesForSchool().",
  },
  {
    prio: "Alta",
    item: "Motor de Regras — Escalões (Modelo 2) com dia do mês em vez de dias de atraso",
    action: "CORRIGIDO: cálculo refactored para usar Math.floor((now - vencimento) / 86400000) em vez de getDate().",
  },
  {
    prio: "Alta",
    item: "Motor de Regras — flag aplica_automatico verificado",
    action: "Confirmado: regra.aplica_automatico é verificado na linha 206 de school.ts. Sem alteração necessária.",
  },
  {
    prio: "Media",
    item: "SplitPay não acessível no NAV do dashboard",
    action: "Adicionar 'splitpay' ao tipo DashView e criar entrada no array NAV com o ícone adequado.",
  },
  {
    prio: "Media",
    item: "Módulo Infantil (escola) não acessível no NAV",
    action: "Adicionar 'modulo_infantil' ao tipo DashView e criar entrada condicional no NAV (só quando moduloInfantil = true).",
  },
  {
    prio: "Media",
    item: "FCM — token do dispositivo não registado",
    action: "Chamar POST /api/fcm/register-token após login bem-sucedido em encarregado.tsx.",
  },
  {
    prio: "Baixa",
    item: "GPO checkout URL simulada",
    action: "Substituir URL hardcoded por credenciais reais EMIS quando o banco disponibilizar o merchant ID.",
  },
  {
    prio: "Baixa",
    item: "RBAC Admin não integrado no sidebar",
    action: "Adicionar vista AdminRBACView ao sidebar da Administração Geral como item de menu.",
  },
  {
    prio: "Baixa",
    item: "Horário de Aulas sem fallback de grelha",
    action: "Mostrar grelha vazia com mensagem quando não há hora_inicio_aula definida.",
  },
]);

/* ═══════════════════════════════════════
   PAGE NUMBERS
═══════════════════════════════════════ */
const range = doc.bufferedPageRange();
for (let i = 0; i < range.count; i++) {
  doc.switchToPage(range.start + i);
  const pageNum = i + 1;
  const total   = range.count;
  doc.save()
     .rect(0, doc.page.height - 28, doc.page.width, 28)
     .fillColor(C.slate100).fill().restore();
  doc.font(FONT).fontSize(7.5).fillColor(C.slate500)
     .text(
       `Kiwara Tech — Relatório de Funcionalidades  ·  Gerado em ${new Date().toLocaleDateString("pt-AO")}`,
       doc.options.margin, doc.page.height - 18,
       { align: "left", lineBreak: false }
     );
  doc.font(FONTB).fontSize(7.5).fillColor(C.slate700)
     .text(
       `Página ${pageNum} / ${total}`,
       doc.options.margin, doc.page.height - 18,
       { align: "right", lineBreak: false, width: PW }
     );
}

doc.end();
console.log("PDF gerado:", OUT);
