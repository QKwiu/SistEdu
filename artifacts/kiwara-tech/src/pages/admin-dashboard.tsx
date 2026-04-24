import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, LayoutDashboard, Building2, LogOut, Plus, Trash2, ChevronRight,
  Upload, Landmark, Receipt, Users, GraduationCap, RefreshCw, CheckCircle2,
  AlertCircle, AlertTriangle, X, Download, TrendingUp, Banknote, School, FileSpreadsheet,
  Eye, EyeOff, Search, ArrowLeft, Menu, Calendar, Pencil, MoreHorizontal,
  FileText, Clock, CreditCard, History, Slash, BadgePercent, TableProperties, UserPlus,
  ArrowLeftRight, ShieldCheck, Filter, ChevronDown,
  SlidersHorizontal, Save, MessageSquare, Mail, Smartphone, Globe, Lock,
  Zap, BarChart3, CheckSquare, ToggleLeft, Send, ChevronLeft, ToggleRight, ListFilter,
} from "lucide-react";
import { StudentRegistrationForm } from "@/components/student-form";

const API = "/api";
const TOKEN_KEY = "kiwara_admin_token";

/* ─── Helpers ─── */
const fmt = (n: number | string) =>
  Number(n).toLocaleString("pt-AO", { minimumFractionDigits: 0 });

const fmtCur = (n: number | string) =>
  `${fmt(n)} AOA`;

function getToken() { return localStorage.getItem(TOKEN_KEY) ?? ""; }

async function api(path: string, opts: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts.headers },
  });
  return res;
}

/* ─── Types ─── */
interface Stats {
  total_colegios: number; total_alunos: number; total_propinas: number;
  propinas_pagas: number; propinas_vencidas: number; divida_total: number;
  total_encarregados: number; total_turmas: number;
}
const INSTITUTION_TYPES = [
  { value: "colegio_geral",    label: "Colégio / Escola de Ensino Geral",   portal: "encarregado" },
  { value: "centro_infantil",  label: "Centro Infantil / Creche",            portal: "encarregado" },
  { value: "centro_formacao",  label: "Centro de Formação",                  portal: "aluno"       },
  { value: "universidade",     label: "Universidade / Ensino Superior",      portal: "aluno"       },
  { value: "politecnico",      label: "Instituto Politécnico",               portal: "aluno"       },
] as const;

function derivePortalNomenclatura(institutionType: string): "encarregado" | "aluno" {
  return ["universidade","centro_formacao","politecnico"].includes(institutionType) ? "aluno" : "encarregado";
}

interface Colegio {
  id: number; school_id: string; name: string; nif?: string; phone?: string;
  email: string; iban?: string; created_at: string;
  total_alunos: number; total_turmas: number; usa_pacotes: boolean;
  commission_rate?: number;
  institution_type?: string;
  portal_nomenclatura?: string;
}
interface PacoteItem { nome: string; tipo: string; valor: number; }
interface PacoteEmolumento {
  id: number; school_id: number; nome: string;
  itens: PacoteItem[];
  valor: number;
  descricao?: string; activo: boolean; created_at: string;
}
interface ColegioDetail extends Colegio {
  turmas: { id: number; nome: string; ano: string; turno: string }[];
  emolumentos: Emolumento[];
  multa_regra: MultaRegra | null;
  pacotes: PacoteEmolumento[];
}
interface Emolumento {
  id: number; school_id: number; tipo: string; nome: string;
  montante: number; ano_lectivo: string;
}
interface Bracket { dia_inicio: number; dia_fim: number; percentagem: number; }
interface MultaRegra {
  id: number; school_id: number; dia_limite: number;
  aplica_automatico: boolean; tipo_calculo: "fixa" | "percentual"; valor: number;
  modelo: 1 | 2 | 3; percentagem: number; valor_fixo: number; brackets: Bracket[];
}
interface PropAjuste {
  id: number; propina_id: number; tipo: string;
  multa_anterior: number; multa_nova: number | null;
  valor_anterior: number; valor_novo: number | null;
  nova_data_vencimento: string | null; motivo: string; created_by: string; created_at: string;
}
interface AdminPropina {
  id: number; student_id: number; mes: string; ano: string;
  montante: number; multa: number; total: number; status: string;
  data_vencimento: string | null; aluno_nome: string; turma: string;
  entidade: string | null; ref_numero: string | null; ref_validade: string | null;
}

/* ─── Shared UI ─── */
const inputCls = "w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all";
const selectCls = inputCls;
const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1";

function Field({ label, children, required, desc }: { label: string; children: React.ReactNode; required?: boolean; desc?: string }) {
  return (
    <div>
      <label className={labelCls}>{label}{required && <span className="text-red-400 ml-0.5">*</span>}</label>
      {children}
      {desc && <p className="text-xs text-slate-400 mt-1">{desc}</p>}
    </div>
  );
}

function Modal({ title, onClose, children, wide, xl }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean; xl?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.18 }}
        className={`bg-white rounded-2xl shadow-2xl w-full ${xl ? "max-w-4xl" : wide ? "max-w-2xl" : "max-w-lg"} max-h-[90vh] flex flex-col`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0 bg-white rounded-t-2xl">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </motion.div>
    </div>
  );
}

function Badge({ text, color }: { text: string; color: "green" | "amber" | "red" | "blue" | "slate" }) {
  const cls = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    slate: "bg-slate-100 text-slate-600 border-slate-200",
  }[color];
  return <span className={`text-xs font-semibold border px-2 py-0.5 rounded-full ${cls}`}>{text}</span>;
}

/* ─── Stats Overview ─── */
function StatsView({ stats }: { stats: Stats | null }) {
  if (!stats) return <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 animate-spin text-slate-300" /></div>;
  const cards = [
    { icon: <Building2 className="w-6 h-6 text-blue-500" />, label: "Colégios", value: stats.total_colegios, bg: "bg-blue-50" },
    { icon: <Users className="w-6 h-6 text-violet-500" />, label: "Alunos", value: fmt(stats.total_alunos), bg: "bg-violet-50" },
    { icon: <GraduationCap className="w-6 h-6 text-emerald-500" />, label: "Turmas", value: fmt(stats.total_turmas), bg: "bg-emerald-50" },
    { icon: <Receipt className="w-6 h-6 text-amber-500" />, label: "Propinas Vencidas", value: fmt(stats.propinas_vencidas), bg: "bg-amber-50" },
    { icon: <CheckCircle2 className="w-6 h-6 text-emerald-500" />, label: "Propinas Pagas", value: fmt(stats.propinas_pagas), bg: "bg-emerald-50" },
    { icon: <Banknote className="w-6 h-6 text-red-500" />, label: "Dívida Total", value: fmtCur(stats.divida_total), bg: "bg-red-50" },
    { icon: <Users className="w-6 h-6 text-indigo-500" />, label: "Encarregados", value: fmt(stats.total_encarregados), bg: "bg-indigo-50" },
    { icon: <TrendingUp className="w-6 h-6 text-primary" />, label: "Total Propinas", value: fmt(stats.total_propinas), bg: "bg-primary/8" },
  ];
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-5">Visão Geral da Plataforma</h2>
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {cards.map((c, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-white border border-slate-100 rounded-2xl p-4 sm:p-5 shadow-sm">
            <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl ${c.bg} flex items-center justify-center mb-3`}>{c.icon}</div>
            <div className="text-xl sm:text-2xl font-bold text-slate-900">{c.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{c.label}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ─── Create School Modal ─── */
const INIT_SETTINGS = {
  financeiro: {
    propinas: { frequencia: "mensal", vencimento_dia: 15, permite_pagamento_parcial: false, valor_padrao: 0 },
    multas: { tipo: "percentagem", valor: 5, tolerancia_dias: 5, progressiva: false, limite_percentagem: 20, aplica_automatico: true },
    emolumentos: { obrigatorios: false, tipos: ["Seguro Escolar", "Exame", "Material Didático"] },
    split_payment: { activo: false, comissao_percentagem: 0, conta_destino_escola: "", conta_destino_plataforma: "" },
  },
  pagamento: {
    middleware_url: "", middleware_api_key: "", referencia_prefixo: "",
    reconciliacao_tolerancia_percentagem: 1, reconciliacao_automatica: true,
    metodos_aceites: ["MCX_EXPRESS", "MULTICAIXA", "NUMERARIO", "TRANSFERENCIA"],
  },
  academico: {
    limite_alunos_por_turma: 40, permite_matricula_online: false,
    nomenclatura_turma: "Turma", anos_lectivos: ["2025/2026", "2026/2027"],
  },
  encarregados: {
    maximo_por_aluno: 2, comunicacao_activa: true,
    campos_obrigatorios: ["nome", "telefone", "bi"], permite_portal_encarregado: true,
  },
  comunicacao: {
    sms_activo: false, email_activo: false, whatsapp_activo: false,
    sms_provider: "", email_sender: "",
    eventos: { nova_fatura: true, atraso_pagamento: true, pagamento_confirmado: true, nova_ocorrencia: true },
  },
  dashboard: { mostrar_graficos: true, exportacao_activa: true, metricas_publicas: false, periodo_relatorio_dias: 30 },
  permissoes: {
    admin:      { pode_editar_propinas: true,  pode_eliminar_alunos: true,  ver_relatorios_financeiros: true  },
    financeiro: { pode_editar_propinas: true,  pode_eliminar_alunos: false, ver_relatorios_financeiros: true  },
    operador:   { pode_editar_propinas: false, pode_eliminar_alunos: false, ver_relatorios_financeiros: false },
  },
  tecnico: { timezone: "Africa/Luanda", moeda: "AOA", auditoria_activa: true, modo_manutencao: false },
};

function ModalCriarColegio({ onClose, onCreated }: { onClose: () => void; onCreated: (c: Colegio) => void }) {
  type CTab = "basico"|"financeiro"|"pagamento"|"academico"|"encarregados"|"comunicacao"|"dashboard"|"permissoes"|"tecnico";
  const CTABS: { id: CTab; label: string }[] = [
    { id: "basico",       label: "Básico"        },
    { id: "financeiro",   label: "Financeiro"    },
    { id: "pagamento",    label: "Pagamento"     },
    { id: "academico",    label: "Académico"     },
    { id: "encarregados", label: "Encarregados"  },
    { id: "comunicacao",  label: "Comunicação"   },
    { id: "dashboard",    label: "Dashboard"     },
    { id: "permissoes",   label: "Permissões"    },
    { id: "tecnico",      label: "Técnico"       },
  ];

  const [activeTab, setActiveTab] = useState<CTab>("basico");
  const [form, setForm] = useState({ name: "", nif: "", phone: "", email: "", password: "", iban: "", commission_rate: "0" });
  const [institutionType, setInstitutionType] = useState("colegio_geral");
  const [portalNomenclatura, setPortalNomenclatura] = useState<"encarregado"|"aluno">("encarregado");
  const [usaPacotes, setUsaPacotes] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState<any>(JSON.parse(JSON.stringify(INIT_SETTINGS)));

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }));
  const inp = "border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 w-full";
  const num = `${inp} w-28`;

  const setS = (path: string[], val: any) => setSettings((prev: any) => {
    const next = JSON.parse(JSON.stringify(prev));
    let cur = next;
    for (let i = 0; i < path.length - 1; i++) cur = cur[path[i]];
    cur[path[path.length - 1]] = val;
    return next;
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setSaving(true);
    try {
      const res = await api("/admin/colegios", {
        method: "POST",
        body: JSON.stringify({ ...form, commission_rate: Number(form.commission_rate || 0), usa_pacotes: usaPacotes, settings, institution_type: institutionType, portal_nomenclatura: portalNomenclatura }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao criar colégio.");
      onCreated({ ...data, total_alunos: 0, total_turmas: 0, usa_pacotes: !!data.usa_pacotes, institution_type: data.institution_type, portal_nomenclatura: data.portal_nomenclatura });
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const F = settings.financeiro;
  const PAG = settings.pagamento;
  const A = settings.academico;
  const E = settings.encarregados;
  const C = settings.comunicacao;
  const D = settings.dashboard;
  const PE = settings.permissoes;
  const T = settings.tecnico;

  const CToggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button type="button" onClick={() => onChange(!value)}
      className={`relative shrink-0 rounded-full transition-colors ${value ? "bg-primary" : "bg-slate-300"}`}
      style={{ height: 22, width: 40 }}>
      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? "translate-x-[18px]" : "translate-x-0.5"}`} />
    </button>
  );

  const Row = ({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-slate-50 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        {desc && <p className="text-xs text-slate-400 mt-0.5">{desc}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );

  const Sect = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-5">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">{title}</p>
      <div className="bg-slate-50 rounded-xl px-4 divide-y divide-slate-100">{children}</div>
    </div>
  );

  return (
    <Modal title="Criar Colégio" onClose={onClose} xl>
      <form onSubmit={submit} className="flex flex-col h-full">
        {/* Tab bar */}
        <div className="overflow-x-auto border-b border-slate-100 px-4 pt-3 shrink-0">
          <div className="flex gap-1 w-max pb-2">
            {CTABS.map(t => (
              <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === t.id ? "bg-primary text-white shadow-sm" : "text-slate-500 hover:bg-slate-100"
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── BÁSICO ── */}
          {activeTab === "basico" && (
            <div className="space-y-4">
              <Field label="Nome do colégio" required>
                <input className={inp} placeholder="ex: Colégio Nossa Senhora de Fátima" value={form.name} onChange={f("name")} required />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="NIF">
                  <input className={inp} placeholder="NIF da escola" value={form.nif} onChange={f("nif")} />
                </Field>
                <Field label="Telefone">
                  <input className={inp} placeholder="9xx xxx xxx" value={form.phone} onChange={f("phone")} />
                </Field>
              </div>
              <Field label="Email" required>
                <input type="email" className={inp} placeholder="secretaria@colegio.ao" value={form.email} onChange={f("email")} required />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Palavra-passe inicial">
                  <div className="relative">
                    <input type={showPass ? "text" : "password"} className={`${inp} pr-10`}
                      placeholder="Kiwara@2025 (padrão)" value={form.password} onChange={f("password")} />
                    <button type="button" onClick={() => setShowPass(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </Field>
                <Field label="Comissão da plataforma (%)">
                  <input type="number" min={0} max={100} step={0.1} className={inp} value={form.commission_rate} onChange={f("commission_rate")} />
                </Field>
              </div>
              <Field label="Tipo de Instituição *" desc="Determina o foco operacional e a nomenclatura padrão do portal.">
                <select className={inp} value={institutionType} onChange={e => {
                  const t = e.target.value;
                  setInstitutionType(t);
                  setPortalNomenclatura(derivePortalNomenclatura(t));
                }}>
                  {INSTITUTION_TYPES.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Nomenclatura do Portal do Utilizador Final *" desc="Define o nome visível no portal de acesso.">
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="portal_nom_modal" value="encarregado" checked={portalNomenclatura === "encarregado"} onChange={() => setPortalNomenclatura("encarregado")} className="accent-primary"/>
                    <span className="text-sm text-slate-700">Portal do Encarregado</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="portal_nom_modal" value="aluno" checked={portalNomenclatura === "aluno"} onChange={() => setPortalNomenclatura("aluno")} className="accent-primary"/>
                    <span className="text-sm text-slate-700">Portal do Aluno</span>
                  </label>
                </div>
              </Field>
              <Field label="IBAN (opcional)">
                <input className={inp} placeholder="AO06004400006729503010102" value={form.iban} onChange={f("iban")} />
              </Field>
              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                <CToggle value={usaPacotes} onChange={setUsaPacotes} />
                <div>
                  <p className="text-sm font-semibold text-slate-800">Pacotes de emolumentos</p>
                  <p className="text-xs text-slate-500 mt-0.5">Agrupa serviços (mensalidade, transporte, ATL…) num pacote com valor fixo por aluno.</p>
                </div>
              </div>
            </div>
          )}

          {/* ── FINANCEIRO ── */}
          {activeTab === "financeiro" && (
            <div>
              <Sect title="Propinas">
                <Row label="Frequência de cobrança">
                  <select className={inp} style={{width:160}} value={F.propinas.frequencia} onChange={e => setS(["financeiro","propinas","frequencia"], e.target.value)}>
                    <option value="mensal">Mensal</option>
                    <option value="trimestral">Trimestral</option>
                    <option value="semestral">Semestral</option>
                    <option value="anual">Anual</option>
                  </select>
                </Row>
                <Row label="Dia de vencimento" desc="Dia do mês em que a propina vence.">
                  <input type="number" min={1} max={31} className={num} value={F.propinas.vencimento_dia} onChange={e => setS(["financeiro","propinas","vencimento_dia"], Number(e.target.value))} />
                </Row>
                <Row label="Valor padrão (AOA)" desc="Valor base quando não há pacote definido.">
                  <input type="number" min={0} className={num} value={F.propinas.valor_padrao} onChange={e => setS(["financeiro","propinas","valor_padrao"], Number(e.target.value))} />
                </Row>
                <Row label="Permitir pagamento parcial">
                  <CToggle value={F.propinas.permite_pagamento_parcial} onChange={v => setS(["financeiro","propinas","permite_pagamento_parcial"], v)} />
                </Row>
              </Sect>
              <Sect title="Emolumentos">
                <Row label="Emolumentos obrigatórios">
                  <CToggle value={F.emolumentos.obrigatorios} onChange={v => setS(["financeiro","emolumentos","obrigatorios"], v)} />
                </Row>
                <Row label="Tipos disponíveis" desc="Separados por vírgula.">
                  <input className={inp} style={{width:260}} value={F.emolumentos.tipos.join(", ")} onChange={e => setS(["financeiro","emolumentos","tipos"], e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))} />
                </Row>
              </Sect>
              <Sect title="Split Payment">
                <Row label="Split activo" desc="Dividir pagamento entre escola e plataforma.">
                  <CToggle value={F.split_payment.activo} onChange={v => setS(["financeiro","split_payment","activo"], v)} />
                </Row>
                {F.split_payment.activo && <>
                  <Row label="Comissão (%)">
                    <input type="number" min={0} max={100} step={0.1} className={num} value={F.split_payment.comissao_percentagem} onChange={e => setS(["financeiro","split_payment","comissao_percentagem"], Number(e.target.value))} />
                  </Row>
                  <Row label="IBAN destino escola">
                    <input className={inp} style={{width:260}} value={F.split_payment.conta_destino_escola} onChange={e => setS(["financeiro","split_payment","conta_destino_escola"], e.target.value)} />
                  </Row>
                  <Row label="IBAN destino plataforma">
                    <input className={inp} style={{width:260}} value={F.split_payment.conta_destino_plataforma} onChange={e => setS(["financeiro","split_payment","conta_destino_plataforma"], e.target.value)} />
                  </Row>
                </>}
              </Sect>
            </div>
          )}

          {/* ── PAGAMENTO ── */}
          {activeTab === "pagamento" && (
            <div>
              <Sect title="Middleware EMIS / Multicaixa">
                <Row label="URL do middleware">
                  <input className={inp} style={{width:260}} placeholder="https://..." value={PAG.middleware_url} onChange={e => setS(["pagamento","middleware_url"], e.target.value)} />
                </Row>
                <Row label="API Key">
                  <input className={inp} style={{width:260}} placeholder="sk-..." type="password" value={PAG.middleware_api_key} onChange={e => setS(["pagamento","middleware_api_key"], e.target.value)} />
                </Row>
                <Row label="Prefixo de referência">
                  <input className={inp} style={{width:160}} placeholder="SCH" value={PAG.referencia_prefixo} onChange={e => setS(["pagamento","referencia_prefixo"], e.target.value)} />
                </Row>
              </Sect>
              <Sect title="Reconciliação">
                <Row label="Tolerância (%)" desc="Diferença percentual máxima tolerada.">
                  <input type="number" min={0} max={10} step={0.1} className={num} value={PAG.reconciliacao_tolerancia_percentagem} onChange={e => setS(["pagamento","reconciliacao_tolerancia_percentagem"], Number(e.target.value))} />
                </Row>
                <Row label="Reconciliação automática">
                  <CToggle value={PAG.reconciliacao_automatica} onChange={v => setS(["pagamento","reconciliacao_automatica"], v)} />
                </Row>
              </Sect>
              <Sect title="Métodos de pagamento aceites">
                {["MCX_EXPRESS","MULTICAIXA","NUMERARIO","TRANSFERENCIA","TPA"].map(m => (
                  <Row key={m} label={m.replace(/_/g," ")}>
                    <CToggle
                      value={PAG.metodos_aceites.includes(m)}
                      onChange={v => setS(["pagamento","metodos_aceites"], v ? [...PAG.metodos_aceites, m] : PAG.metodos_aceites.filter((x: string) => x !== m))}
                    />
                  </Row>
                ))}
              </Sect>
            </div>
          )}

          {/* ── ACADÉMICO ── */}
          {activeTab === "academico" && (
            <div>
              <Sect title="Turmas & Matrículas">
                <Row label="Limite de alunos por turma">
                  <input type="number" min={1} max={200} className={num} value={A.limite_alunos_por_turma} onChange={e => setS(["academico","limite_alunos_por_turma"], Number(e.target.value))} />
                </Row>
                <Row label="Matrícula online" desc="Permite matrículas via portal web.">
                  <CToggle value={A.permite_matricula_online} onChange={v => setS(["academico","permite_matricula_online"], v)} />
                </Row>
                <Row label="Nomenclatura das turmas" desc="Ex: Turma, Classe, Sala.">
                  <input className={inp} style={{width:160}} value={A.nomenclatura_turma} onChange={e => setS(["academico","nomenclatura_turma"], e.target.value)} />
                </Row>
              </Sect>
              <Sect title="Anos lectivos activos">
                <Row label="Anos lectivos" desc="Separados por vírgula.">
                  <input className={inp} style={{width:260}} value={A.anos_lectivos.join(", ")} onChange={e => setS(["academico","anos_lectivos"], e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))} />
                </Row>
              </Sect>
            </div>
          )}

          {/* ── ENCARREGADOS ── */}
          {activeTab === "encarregados" && (
            <div>
              <Sect title="Portal do Encarregado">
                <Row label="Portal activo" desc="Encarregados podem aceder ao portal.">
                  <CToggle value={E.permite_portal_encarregado} onChange={v => setS(["encarregados","permite_portal_encarregado"], v)} />
                </Row>
                <Row label="Comunicação activa" desc="Enviar notificações aos encarregados.">
                  <CToggle value={E.comunicacao_activa} onChange={v => setS(["encarregados","comunicacao_activa"], v)} />
                </Row>
                <Row label="Máximo de encarregados por aluno">
                  <input type="number" min={1} max={5} className={num} value={E.maximo_por_aluno} onChange={e => setS(["encarregados","maximo_por_aluno"], Number(e.target.value))} />
                </Row>
              </Sect>
              <Sect title="Campos obrigatórios do encarregado">
                {["nome","telefone","bi","email","morada"].map(campo => (
                  <Row key={campo} label={campo.charAt(0).toUpperCase() + campo.slice(1)}>
                    <CToggle
                      value={E.campos_obrigatorios.includes(campo)}
                      onChange={v => setS(["encarregados","campos_obrigatorios"], v ? [...E.campos_obrigatorios, campo] : E.campos_obrigatorios.filter((x: string) => x !== campo))}
                    />
                  </Row>
                ))}
              </Sect>
            </div>
          )}

          {/* ── COMUNICAÇÃO ── */}
          {activeTab === "comunicacao" && (
            <div>
              <Sect title="Canais de comunicação">
                <Row label="SMS activo">
                  <CToggle value={C.sms_activo} onChange={v => setS(["comunicacao","sms_activo"], v)} />
                </Row>
                {C.sms_activo && <Row label="Provedor SMS">
                  <input className={inp} style={{width:200}} placeholder="ex: Nexmo, Twilio" value={C.sms_provider} onChange={e => setS(["comunicacao","sms_provider"], e.target.value)} />
                </Row>}
                <Row label="Email activo">
                  <CToggle value={C.email_activo} onChange={v => setS(["comunicacao","email_activo"], v)} />
                </Row>
                {C.email_activo && <Row label="Email remetente">
                  <input className={inp} style={{width:240}} placeholder="noreply@colegio.ao" value={C.email_sender} onChange={e => setS(["comunicacao","email_sender"], e.target.value)} />
                </Row>}
                <Row label="WhatsApp activo">
                  <CToggle value={C.whatsapp_activo} onChange={v => setS(["comunicacao","whatsapp_activo"], v)} />
                </Row>
              </Sect>
              <Sect title="Eventos notificados">
                <Row label="Nova fatura">
                  <CToggle value={C.eventos.nova_fatura} onChange={v => setS(["comunicacao","eventos","nova_fatura"], v)} />
                </Row>
                <Row label="Atraso no pagamento">
                  <CToggle value={C.eventos.atraso_pagamento} onChange={v => setS(["comunicacao","eventos","atraso_pagamento"], v)} />
                </Row>
                <Row label="Pagamento confirmado">
                  <CToggle value={C.eventos.pagamento_confirmado} onChange={v => setS(["comunicacao","eventos","pagamento_confirmado"], v)} />
                </Row>
                <Row label="Nova ocorrência">
                  <CToggle value={C.eventos.nova_ocorrencia} onChange={v => setS(["comunicacao","eventos","nova_ocorrencia"], v)} />
                </Row>
              </Sect>
            </div>
          )}

          {/* ── DASHBOARD ── */}
          {activeTab === "dashboard" && (
            <div>
              <Sect title="Configuração do Dashboard">
                <Row label="Mostrar gráficos">
                  <CToggle value={D.mostrar_graficos} onChange={v => setS(["dashboard","mostrar_graficos"], v)} />
                </Row>
                <Row label="Exportação activa" desc="Permitir exportação de relatórios.">
                  <CToggle value={D.exportacao_activa} onChange={v => setS(["dashboard","exportacao_activa"], v)} />
                </Row>
                <Row label="Métricas públicas" desc="Disponibilizar métricas sem autenticação.">
                  <CToggle value={D.metricas_publicas} onChange={v => setS(["dashboard","metricas_publicas"], v)} />
                </Row>
                <Row label="Período de relatório (dias)" desc="Janela temporal padrão dos relatórios.">
                  <select className={inp} style={{width:160}} value={D.periodo_relatorio_dias} onChange={e => setS(["dashboard","periodo_relatorio_dias"], Number(e.target.value))}>
                    <option value={7}>7 dias</option>
                    <option value={14}>14 dias</option>
                    <option value={30}>30 dias</option>
                    <option value={60}>60 dias</option>
                    <option value={90}>90 dias</option>
                  </select>
                </Row>
              </Sect>
            </div>
          )}

          {/* ── PERMISSÕES ── */}
          {activeTab === "permissoes" && (
            <div>
              {(["admin","financeiro","operador"] as const).map(perfil => (
                <Sect key={perfil} title={`Perfil: ${perfil.charAt(0).toUpperCase() + perfil.slice(1)}`}>
                  <Row label="Pode editar propinas">
                    <CToggle value={PE[perfil].pode_editar_propinas} onChange={v => setS(["permissoes",perfil,"pode_editar_propinas"], v)} />
                  </Row>
                  <Row label="Pode eliminar alunos">
                    <CToggle value={PE[perfil].pode_eliminar_alunos} onChange={v => setS(["permissoes",perfil,"pode_eliminar_alunos"], v)} />
                  </Row>
                  <Row label="Ver relatórios financeiros">
                    <CToggle value={PE[perfil].ver_relatorios_financeiros} onChange={v => setS(["permissoes",perfil,"ver_relatorios_financeiros"], v)} />
                  </Row>
                </Sect>
              ))}
            </div>
          )}

          {/* ── TÉCNICO ── */}
          {activeTab === "tecnico" && (
            <div>
              <Sect title="Configuração Técnica">
                <Row label="Fuso horário">
                  <select className={inp} style={{width:200}} value={T.timezone} onChange={e => setS(["tecnico","timezone"], e.target.value)}>
                    <option value="Africa/Luanda">Africa/Luanda (WAT)</option>
                    <option value="UTC">UTC</option>
                    <option value="Europe/Lisbon">Europe/Lisbon</option>
                  </select>
                </Row>
                <Row label="Moeda">
                  <select className={inp} style={{width:120}} value={T.moeda} onChange={e => setS(["tecnico","moeda"], e.target.value)}>
                    <option value="AOA">AOA (Kwanza)</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </Row>
                <Row label="Auditoria activa" desc="Registar todas as acções dos utilizadores.">
                  <CToggle value={T.auditoria_activa} onChange={v => setS(["tecnico","auditoria_activa"], v)} />
                </Row>
                <Row label="Modo de manutenção" desc="Bloqueia acesso ao portal da escola.">
                  <CToggle value={T.modo_manutencao} onChange={v => setS(["tecnico","modo_manutencao"], v)} />
                </Row>
              </Sect>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-5 py-4 shrink-0 bg-white rounded-b-2xl">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-sm flex items-center gap-2 mb-3"><AlertCircle className="w-4 h-4 shrink-0"/>{error}</div>}
          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-1">
              {CTABS.map((t, i) => (
                <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
                  className={`w-2 h-2 rounded-full transition-colors ${activeTab === t.id ? "bg-primary" : "bg-slate-200"}`}
                  title={t.label} />
              ))}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={saving}
                className="px-5 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-2">
                {saving ? <><RefreshCw className="w-4 h-4 animate-spin" />A criar...</> : "Criar Colégio"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}

/* ─── Add Single Student Panel ─── */
type SchoolTurma = { id: number; nome: string; turno?: string };

function AddAlunoPanel({ schoolId, turmas, usaPacotes, pacotes, anoLectivo, onSuccess }: {
  schoolId: number; turmas: SchoolTurma[]; usaPacotes: boolean;
  pacotes: PacoteEmolumento[]; anoLectivo: string; onSuccess: () => void;
}) {
  const handleSubmit = async (fd: FormData) => {
    const token = localStorage.getItem("kiwara_admin_token") ?? "";
    const r = await fetch(`/api/admin/colegios/${schoolId}/alunos`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error ?? "Erro ao registar aluno.");
    onSuccess();
    return d.nome as string;
  };

  return (
    <StudentRegistrationForm
      turmas={turmas}
      anoLectivo={anoLectivo}
      usaPacotes={usaPacotes}
      pacotes={pacotes}
      onSubmitForm={handleSubmit}
    />
  );
}

/* ─── CSV Upload Panel ─── */
type CSVRow = {
  nome: string; bilhete: string; numero_processo: string;
  data_nascimento: string; sexo: string;
  turma_nome: string; turno: string;
  nome_encarregado: string; telefone_encarregado: string;
  pacote_nome: string;
};
const EMPTY_ROW = (): CSVRow => ({
  nome: "", bilhete: "", numero_processo: "", data_nascimento: "",
  sexo: "M", turma_nome: "", turno: "Manhã", nome_encarregado: "", telefone_encarregado: "",
  pacote_nome: "",
});
const CSV_HEADERS_LIST = ["nome","bilhete","numero_processo","data_nascimento","sexo","turma_nome","turno","nome_encarregado","telefone_encarregado","pacote_nome"];

function UploadAlunosPanel({ schoolId, anoLectivo, usaPacotes, pacotes }: {
  schoolId: number; anoLectivo: string;
  usaPacotes?: boolean; pacotes?: PacoteEmolumento[];
}) {
  const [mode, setMode] = useState<"manual"|"file">("manual");
  const [ano, setAno] = useState(anoLectivo);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ inserted: number; skipped: number; errors: string[]; encarregados_criados?: number } | null>(null);
  const [error, setError] = useState("");

  // Manual mode
  const [rows, setRows] = useState<CSVRow[]>([EMPTY_ROW()]);
  const updateRow = (i: number, field: keyof CSVRow, val: string) =>
    setRows(r => r.map((x, idx) => idx === i ? { ...x, [field]: val } : x));
  const addRow = () => setRows(r => [...r, EMPTY_ROW()]);
  const removeRow = (i: number) => setRows(r => r.filter((_, idx) => idx !== i));
  const validRows = rows.filter(r => r.nome.trim());

  // File mode
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<CSVRow[]>([]);
  const [fileName, setFileName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function parseCSV(text: string): CSVRow[] {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/[^a-z_]/g, ""));
    return lines.slice(1).map(line => {
      const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
      const obj: any = { ...EMPTY_ROW() };
      headers.forEach((h, i) => { if (vals[i] !== undefined) obj[h] = vals[i]; });
      return obj;
    }).filter(r => r.nome);
  }

  function handleFile(file: File) {
    if (!file.name.endsWith(".csv")) { setError("Apenas ficheiros CSV são suportados."); return; }
    setFileName(file.name); setError(""); setResult(null);
    const reader = new FileReader();
    reader.onload = e => setPreview(parseCSV(e.target?.result as string));
    reader.readAsText(file, "UTF-8");
  }

  const downloadTemplate = () => {
    const header = CSV_HEADERS_LIST.join(",");
    const example = "João Manuel Silva,009874321LA041,PROC-2025-001,2009-05-15,M,10ª Classe A,Manhã,António Silva,924000001";
    const blob = new Blob([header + "\n" + example], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "modelo_alunos.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = async (alunos: CSVRow[]) => {
    if (!alunos.length) return;
    setUploading(true); setResult(null); setError("");
    try {
      const res = await api(`/admin/colegios/${schoolId}/alunos/upload`, {
        method: "POST",
        body: JSON.stringify({ alunos, ano_lectivo: ano }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro no carregamento.");
      setResult(data);
      if (mode === "manual") setRows([EMPTY_ROW()]);
      if (mode === "file") { setPreview([]); setFileName(""); }
    } catch (err: any) { setError(err.message); }
    finally { setUploading(false); }
  };

  const cellCls = "bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 w-full";
  const selCls  = `${cellCls} cursor-pointer`;

  return (
    <div className="space-y-5">
      {/* Header controls */}
      <div className="flex flex-wrap items-end gap-4">
        <Field label="Ano lectivo">
          <input className={`${inputCls} w-32`} value={ano} onChange={e => setAno(e.target.value)} placeholder="2025/2026" />
        </Field>
        {/* Mode tabs */}
        <div className="flex bg-slate-100 rounded-xl p-1 gap-1 mb-0.5">
          <button onClick={() => { setMode("manual"); setError(""); setResult(null); }}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${mode==="manual" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            <TableProperties className="w-3.5 h-3.5" /> Preencher no browser
          </button>
          <button onClick={() => { setMode("file"); setError(""); setResult(null); }}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${mode==="file" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            <FileSpreadsheet className="w-3.5 h-3.5" /> Carregar ficheiro CSV
          </button>
        </div>
        {mode === "file" && (
          <button onClick={downloadTemplate}
            className="mb-0.5 flex items-center gap-1.5 text-xs text-primary hover:text-primary/70 font-medium">
            <Download className="w-3.5 h-3.5" /> Descarregar modelo CSV
          </button>
        )}
      </div>

      {/* ── MANUAL MODE ── */}
      {mode === "manual" && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">Preencha os dados de cada aluno directamente na tabela. Campos marcados com <span className="text-red-500">*</span> são obrigatórios.</p>

          {/* Scrollable inline table editor */}
          <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto shadow-sm">
            <table className="w-full text-xs min-w-[1100px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-2 py-2 text-left text-slate-500 font-semibold w-6">#</th>
                  <th className="px-2 py-2 text-left text-slate-500 font-semibold w-44">Nome completo <span className="text-red-500">*</span></th>
                  <th className="px-2 py-2 text-left text-slate-500 font-semibold w-32">Bilhete (BI)</th>
                  <th className="px-2 py-2 text-left text-slate-500 font-semibold w-28">Nº processo</th>
                  <th className="px-2 py-2 text-left text-slate-500 font-semibold w-28">Data nasc.</th>
                  <th className="px-2 py-2 text-left text-slate-500 font-semibold w-16">Sexo</th>
                  <th className="px-2 py-2 text-left text-slate-500 font-semibold w-32">Turma <span className="text-red-500">*</span></th>
                  <th className="px-2 py-2 text-left text-slate-500 font-semibold w-20">Turno</th>
                  <th className="px-2 py-2 text-left text-slate-500 font-semibold w-36">Nome encarregado</th>
                  <th className="px-2 py-2 text-left text-slate-500 font-semibold w-28">Telef. encarregado</th>
                  {usaPacotes && <th className="px-2 py-2 text-left text-slate-500 font-semibold w-36">Pacote</th>}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rows.map((row, i) => (
                  <tr key={i} className={row.nome.trim() ? "bg-white" : "bg-slate-50/50"}>
                    <td className="px-2 py-1.5 text-slate-400 text-center">{i+1}</td>
                    <td className="px-1 py-1">
                      <input className={cellCls} placeholder="ex: João Manuel Silva" value={row.nome}
                        onChange={e => updateRow(i, "nome", e.target.value)} />
                    </td>
                    <td className="px-1 py-1">
                      <input className={cellCls} placeholder="009874321LA041" value={row.bilhete}
                        onChange={e => updateRow(i, "bilhete", e.target.value)} />
                    </td>
                    <td className="px-1 py-1">
                      <input className={cellCls} placeholder="PROC-2025-001" value={row.numero_processo}
                        onChange={e => updateRow(i, "numero_processo", e.target.value)} />
                    </td>
                    <td className="px-1 py-1">
                      <input type="date" className={cellCls} value={row.data_nascimento}
                        onChange={e => updateRow(i, "data_nascimento", e.target.value)} />
                    </td>
                    <td className="px-1 py-1">
                      <select className={selCls} value={row.sexo} onChange={e => updateRow(i, "sexo", e.target.value)}>
                        <option value="M">M</option>
                        <option value="F">F</option>
                        <option value="Outro">Outro</option>
                      </select>
                    </td>
                    <td className="px-1 py-1">
                      <input className={cellCls} placeholder="10ª Classe A" value={row.turma_nome}
                        onChange={e => updateRow(i, "turma_nome", e.target.value)} />
                    </td>
                    <td className="px-1 py-1">
                      <select className={selCls} value={row.turno} onChange={e => updateRow(i, "turno", e.target.value)}>
                        <option>Manhã</option>
                        <option>Tarde</option>
                      </select>
                    </td>
                    <td className="px-1 py-1">
                      <input className={cellCls} placeholder="António Silva" value={row.nome_encarregado}
                        onChange={e => updateRow(i, "nome_encarregado", e.target.value)} />
                    </td>
                    <td className="px-1 py-1">
                      <input className={cellCls} placeholder="924000001" value={row.telefone_encarregado}
                        onChange={e => updateRow(i, "telefone_encarregado", e.target.value)} />
                    </td>
                    {usaPacotes && (
                      <td className="px-1 py-1">
                        <select className={selCls} value={row.pacote_nome}
                          onChange={e => updateRow(i, "pacote_nome", e.target.value)}>
                          <option value="">— sem pacote —</option>
                          {(pacotes || []).filter(p => p.activo).map(p => (
                            <option key={p.id} value={p.nome}>{p.nome}</option>
                          ))}
                        </select>
                      </td>
                    )}
                    <td className="px-1 py-1 text-center">
                      {rows.length > 1 && (
                        <button onClick={() => removeRow(i)} title="Remover linha"
                          className="p-1 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add row + info */}
          <div className="flex items-center justify-between">
            <button onClick={addRow}
              className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/70 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Adicionar linha
            </button>
            <span className="text-xs text-slate-400">
              {validRows.length} {validRows.length === 1 ? "aluno pronto" : "alunos prontos"} para importar
            </span>
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>}
          {result && <ImportResult result={result} />}

          <button onClick={() => doImport(validRows)} disabled={uploading || !validRows.length}
            className="w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {uploading
              ? <><RefreshCw className="w-4 h-4 animate-spin" />A importar...</>
              : <><Upload className="w-4 h-4" />Importar {validRows.length} {validRows.length === 1 ? "aluno" : "alunos"}</>}
          </button>
        </div>
      )}

      {/* ── FILE MODE ── */}
      {mode === "file" && (
        <div className="space-y-4">
          {!preview.length && (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${dragging ? "border-primary bg-primary/5" : "border-slate-200 hover:border-slate-300 bg-slate-50"}`}>
              <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="font-medium text-slate-600">Arraste o ficheiro CSV aqui</p>
              <p className="text-sm text-slate-400 mt-1">ou clique para seleccionar</p>
              <input ref={inputRef} type="file" accept=".csv" className="hidden"
                onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
            </div>
          )}

          {preview.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-semibold text-slate-700">{fileName}</span>
                  <Badge text={`${preview.length} alunos`} color="blue" />
                </div>
                <button onClick={() => { setPreview([]); setFileName(""); }}
                  className="text-sm text-slate-400 hover:text-red-500 transition-colors">Remover</button>
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full text-xs text-left min-w-[600px]">
                  <thead className="bg-slate-50 text-slate-500 font-semibold uppercase">
                    <tr>
                      {["Nome", "Bilhete", "Turma", "Turno", "Sexo", "Encarregado", "Telefone"].map(h => (
                        <th key={h} className="px-3 py-2">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {preview.slice(0, 8).map((r, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5 font-medium text-slate-900">{r.nome}</td>
                        <td className="px-3 py-1.5 text-slate-500 font-mono">{r.bilhete || "—"}</td>
                        <td className="px-3 py-1.5 text-slate-600">{r.turma_nome || "—"}</td>
                        <td className="px-3 py-1.5 text-slate-500">{r.turno || "—"}</td>
                        <td className="px-3 py-1.5 text-slate-500">{r.sexo || "—"}</td>
                        <td className="px-3 py-1.5 text-slate-500">{r.nome_encarregado || "—"}</td>
                        <td className="px-3 py-1.5 text-slate-500 font-mono">{r.telefone_encarregado || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 8 && (
                  <div className="px-3 py-2 text-xs text-slate-400 bg-slate-50 border-t border-slate-100">
                    + {preview.length - 8} mais registos...
                  </div>
                )}
              </div>
            </div>
          )}

          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>}
          {result && <ImportResult result={result} />}

          {preview.length > 0 && (
            <button onClick={() => doImport(preview)} disabled={uploading}
              className="w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {uploading
                ? <><RefreshCw className="w-4 h-4 animate-spin" />A importar...</>
                : <><Upload className="w-4 h-4" />Importar {preview.length} alunos</>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ImportResult({ result }: { result: { inserted: number; skipped: number; errors: string[]; encarregados_criados?: number } }) {
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
        <span className="font-semibold text-emerald-800">Importação concluída com sucesso</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
        <div className="bg-white rounded-lg px-3 py-2 border border-emerald-100">
          <p className="text-xs text-emerald-600 font-medium">Alunos criados</p>
          <p className="text-xl font-bold text-emerald-800">{result.inserted}</p>
        </div>
        <div className="bg-white rounded-lg px-3 py-2 border border-emerald-100">
          <p className="text-xs text-slate-500 font-medium">Já existentes</p>
          <p className="text-xl font-bold text-slate-600">{result.skipped}</p>
        </div>
        {(result.encarregados_criados ?? 0) > 0 && (
          <div className="bg-white rounded-lg px-3 py-2 border border-blue-100">
            <p className="text-xs text-blue-600 font-medium">Encarregados criados</p>
            <p className="text-xl font-bold text-blue-800">{result.encarregados_criados}</p>
          </div>
        )}
      </div>
      {result.errors.length > 0 && (
        <div className="mt-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          <p className="text-xs font-semibold text-red-700 mb-1">Erros ({result.errors.length}):</p>
          {result.errors.slice(0, 5).map((e, i) => <p key={i} className="text-xs text-red-600">• {e}</p>)}
        </div>
      )}
    </div>
  );
}

/* ─── Emolumento tipo helpers ─── */
const DESCRICAO_POR_TIPO: Record<string, string[]> = {
  propina: [
    "Propina Mensal",
    "Propina Mensal — 1.ª a 4.ª Classe",
    "Propina Mensal — 5.ª a 6.ª Classe",
    "Propina Mensal — 7.ª a 9.ª Classe",
    "Propina Mensal — 10.ª a 13.ª Classe",
  ],
  matricula: [
    "Matrícula Escolar",
    "Matrícula Escolar — 1.ª Classe",
    "Matrícula Escolar — Ensino Primário",
    "Matrícula Escolar — I Ciclo",
    "Matrícula Escolar — II Ciclo",
  ],
  confirmacao_matricula: [
    "Confirmação de Matrícula",
    "Renovação de Matrícula — Ensino Primário",
    "Renovação de Matrícula — I Ciclo",
    "Renovação de Matrícula — II Ciclo",
  ],
  seguro: [
    "Seguro Escolar Anual",
    "Seguro Escolar Semestral",
    "Seguro de Acidentes Pessoais",
  ],
  cartao_estudante: [
    "Cartão de Estudante",
    "Segunda Via de Cartão de Estudante",
    "Cartão de Acesso às Instalações",
  ],
  declaracao: [
    "Declaração de Frequência",
    "Declaração de Notas",
    "Declaração de Matrícula",
    "Declaração para Bolsa",
    "Declaração para Visto / Passaporte",
    "Declaração de Conclusão de Ano Lectivo",
  ],
  certificado: [
    "Certificado de Habilitações",
    "Certificado de Conclusão — Ensino Primário",
    "Certificado de Conclusão — I Ciclo",
    "Certificado de Conclusão — II Ciclo",
    "Certificado de Aproveitamento Escolar",
  ],
  emissao_notas: [
    "Emissão de Notas — Boletim Completo",
    "Emissão de Notas — Por Disciplina",
    "Histórico de Notas",
  ],
  segunda_via: [
    "Segunda Via de Notas",
    "Segunda Via de Matrícula",
    "Segunda Via de Certificado",
    "Segunda Via de Declaração",
    "Segunda Via de Diploma",
  ],
  pedido_especial: [
    "Transferência Escolar",
    "Equivalência de Disciplinas",
    "Reingresso Escolar",
    "Mudança de Curso / Área",
  ],
  transporte: [
    "Transporte Escolar — Ida e Volta",
    "Transporte Escolar — Só Ida",
    "Transporte Escolar — Só Volta",
    "Transporte Escolar — Percurso Especial",
  ],
  alimentacao: [
    "Refeição Escolar — Almoço",
    "Refeição Escolar — Almoço e Lanche",
    "ATL — Actividades de Tempos Livres",
    "Lanche Escolar",
  ],
  uniforme: [
    "Kit de Uniforme Completo",
    "Calças / Saia de Uniforme",
    "Camisa / Blusa de Uniforme",
    "Casaco de Uniforme",
    "Calçado Escolar",
  ],
  extracurricular: [
    "Actividades Extracurriculares — Desporto",
    "Actividades Extracurriculares — Arte e Cultura",
    "Clube de Informática",
    "Clube de Inglês",
    "Natação Escolar",
    "Banda Escolar / Música",
  ],
  multa_atraso: [
    "Multa por Atraso no Pagamento de Propina",
  ],
  multa_dano: [
    "Multa por Dano de Material Escolar",
    "Multa por Dano de Equipamento Informático",
    "Multa por Dano de Mobiliário",
    "Multa por Perda de Material da Escola",
  ],
};

const TIPO_GRUPOS = [
  {
    grupo: "Obrigatórios (fixos)",
    items: [
      { value: "propina", label: "Propina (mensalidade)" },
      { value: "matricula", label: "Matrícula (primeira inscrição)" },
      { value: "confirmacao_matricula", label: "Confirmação de matrícula (renovação anual)" },
      { value: "seguro", label: "Seguro escolar" },
      { value: "cartao_estudante", label: "Cartão de estudante" },
    ],
  },
  {
    grupo: "Académicos (por serviço)",
    items: [
      { value: "declaracao", label: "Declarações" },
      { value: "certificado", label: "Certificados" },
      { value: "emissao_notas", label: "Emissão de notas" },
      { value: "segunda_via", label: "Segunda via de documentos" },
      { value: "pedido_especial", label: "Pedidos especiais (transferência, equivalência)" },
    ],
  },
  {
    grupo: "Operacionais / Serviços",
    items: [
      { value: "transporte", label: "Transporte escolar" },
      { value: "alimentacao", label: "Alimentação" },
      { value: "uniforme", label: "Uniforme" },
      { value: "extracurricular", label: "Atividades extracurriculares" },
    ],
  },
  {
    grupo: "Punitivos (multas)",
    items: [
      { value: "multa_atraso", label: "Multa por atraso de propina" },
      { value: "multa_dano", label: "Multa por dano material" },
    ],
  },
];

function tipoLabel(v: string) {
  for (const g of TIPO_GRUPOS) {
    const found = g.items.find(i => i.value === v);
    if (found) return found.label;
  }
  return v;
}

/* ─── Regras de Multa Panel ─── */
const DEFAULT_BRACKETS: Bracket[] = [
  { dia_inicio: 11, dia_fim: 20, percentagem: 10 },
  { dia_inicio: 21, dia_fim: 30, percentagem: 20 },
];

function MultaRegrasPanel({ schoolId, initial, onSaved }: { schoolId: number; initial: MultaRegra | null; onSaved?: (r: MultaRegra) => void }) {
  const [modelo, setModelo] = useState<1|2|3>(initial?.modelo ?? 1);
  const [diaLimite, setDiaLimite] = useState(String(initial?.dia_limite ?? 10));
  const [aplica, setAplica] = useState(initial?.aplica_automatico ?? true);
  const [percentagem, setPercentagem] = useState(String(initial?.percentagem ?? ""));
  const [valorFixo, setValorFixo] = useState(String(initial?.valor_fixo ?? ""));
  const [brackets, setBrackets] = useState<Bracket[]>(
    initial?.brackets?.length ? initial.brackets : DEFAULT_BRACKETS
  );
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const addBracket = () => {
    const last = brackets[brackets.length - 1];
    setBrackets(b => [...b, { dia_inicio: last ? last.dia_fim + 1 : 1, dia_fim: last ? last.dia_fim + 10 : 10, percentagem: 0 }]);
  };
  const removeBracket = (i: number) => setBrackets(b => b.filter((_, idx) => idx !== i));
  const updateBracket = (i: number, field: keyof Bracket, val: string) =>
    setBrackets(b => b.map((br, idx) => idx === i ? { ...br, [field]: Number(val) } : br));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setSuccess(false); setSaving(true);
    try {
      const body: any = { modelo, dia_limite: Number(diaLimite), aplica_automatico: aplica };
      if (modelo === 1) body.percentagem = Number(percentagem);
      else if (modelo === 2) body.brackets = brackets;
      else if (modelo === 3) body.valor_fixo = Number(valorFixo);
      const res = await api(`/admin/colegios/${schoolId}/multa-regra`, { method: "PUT", body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao guardar.");
      setSuccess(true); setTimeout(() => setSuccess(false), 3000);
      if (onSaved) onSaved(data);
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const MODELO_CARDS = [
    { id: 1, label: "Modelo 1 — Multa única", desc: "Percentagem aplicada uma vez após o dia limite", icon: <BadgePercent className="w-4 h-4" /> },
    { id: 2, label: "Modelo 2 — Multa progressiva", desc: "Percentagem cresce com o tempo (escalões)", icon: <TrendingUp className="w-4 h-4" /> },
    { id: 3, label: "Modelo 3 — Taxa fixa", desc: "Valor fixo em AOA aplicado após o dia limite", icon: <Banknote className="w-4 h-4" /> },
  ] as const;

  const resumo = () => {
    const dia = diaLimite || "?";
    if (!aplica) return `Após o dia ${dia} de cada mês, as propinas são marcadas como atrasadas (sem multa automática).`;
    if (modelo === 1) return `Após o dia ${dia}, aplica uma multa de ${percentagem || 0}% sobre o montante da propina.`;
    if (modelo === 2) {
      const partes = brackets.map(b => `dias ${b.dia_inicio}–${b.dia_fim} → ${b.percentagem}%`).join("; ");
      return `Multa progressiva: ${partes || "sem escalões definidos"}.`;
    }
    return `Após o dia ${dia}, aplica uma taxa fixa de ${Number(valorFixo || 0).toLocaleString("pt-AO")} AOA por propina em atraso.`;
  };

  return (
    <div className="mt-8 bg-amber-50 border border-amber-200 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
        <h4 className="font-semibold text-amber-900">Regras de cálculo de multa</h4>
      </div>
      <p className="text-xs text-amber-700 mb-5">
        Configure como e quando as multas são aplicadas às propinas em atraso. A multa é automaticamente somada ao valor a pagar pelo encarregado.
      </p>
      <form onSubmit={submit} className="space-y-5">
        {/* Model selection */}
        <div>
          <p className={labelCls}>Seleccionar modelo de cálculo</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {MODELO_CARDS.map(m => (
              <button key={m.id} type="button"
                onClick={() => setModelo(m.id)}
                className={`text-left p-3 rounded-xl border-2 transition-all ${modelo === m.id
                  ? "border-amber-500 bg-amber-100/60"
                  : "border-slate-200 bg-white hover:border-amber-300"}`}>
                <div className={`flex items-center gap-1.5 font-semibold text-xs mb-1 ${modelo === m.id ? "text-amber-800" : "text-slate-700"}`}>
                  {m.icon}{m.label}
                </div>
                <p className="text-xs text-slate-500 leading-snug">{m.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Common: dia_limite + auto toggle */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Dia limite mensal">
            <input type="number" min="1" max="31" className={inputCls}
              placeholder="ex: 10" value={diaLimite} onChange={e => setDiaLimite(e.target.value)} required />
          </Field>
          <Field label="Aplicar automaticamente">
            <div className="flex items-center gap-3 h-[42px]">
              <button type="button" onClick={() => setAplica(a => !a)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${aplica ? "bg-amber-500" : "bg-slate-300"}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${aplica ? "translate-x-6" : "translate-x-1"}`} />
              </button>
              <span className="text-sm text-slate-600">{aplica ? "Sim — aplica automaticamente" : "Não — apenas sinalizar"}</span>
            </div>
          </Field>
        </div>

        {/* Model-specific fields */}
        {modelo === 1 && (
          <Field label="Percentagem da multa (%)">
            <input type="number" min="0" step="0.01" max="100" className={inputCls}
              placeholder="ex: 10" value={percentagem} onChange={e => setPercentagem(e.target.value)} required />
          </Field>
        )}

        {modelo === 2 && (
          <div>
            <p className={labelCls}>Escalões de multa progressiva</p>
            <div className="space-y-2">
              {brackets.map((b, i) => (
                <div key={i} className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-3">
                  <span className="text-xs text-slate-400 font-semibold shrink-0">Escalão {i + 1}</span>
                  <div className="flex items-center gap-2 flex-1 flex-wrap">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-500">Dia</span>
                      <input type="number" min="1" max="31" className="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-sm text-center"
                        value={b.dia_inicio} onChange={e => updateBracket(i, "dia_inicio", e.target.value)} />
                    </div>
                    <span className="text-slate-400 text-xs">até</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-500">Dia</span>
                      <input type="number" min="1" max="31" className="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-sm text-center"
                        value={b.dia_fim} onChange={e => updateBracket(i, "dia_fim", e.target.value)} />
                    </div>
                    <span className="text-slate-400">→</span>
                    <div className="flex items-center gap-1">
                      <input type="number" min="0" max="100" step="0.1" className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-sm text-center"
                        value={b.percentagem} onChange={e => updateBracket(i, "percentagem", e.target.value)} />
                      <span className="text-xs text-slate-500 font-semibold">%</span>
                    </div>
                  </div>
                  {brackets.length > 1 && (
                    <button type="button" onClick={() => removeBracket(i)}
                      className="p-1 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={addBracket}
              className="mt-2 text-xs text-amber-700 font-semibold flex items-center gap-1 hover:text-amber-900">
              <Plus className="w-3.5 h-3.5" /> Adicionar escalão
            </button>
          </div>
        )}

        {modelo === 3 && (
          <Field label="Valor fixo da multa (AOA)">
            <input type="number" min="0" step="0.01" className={inputCls}
              placeholder="ex: 5000" value={valorFixo} onChange={e => setValorFixo(e.target.value)} required />
          </Field>
        )}

        {/* Live preview */}
        <div className="bg-white border border-amber-200 rounded-xl px-4 py-3 text-sm text-slate-600">
          <span className="font-semibold text-slate-800">Resumo: </span>
          <span className="text-amber-800">{resumo()}</span>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>}
        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Regra guardada com sucesso.
          </div>
        )}
        <button type="submit" disabled={saving}
          className="px-5 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-semibold hover:bg-amber-700 transition-colors disabled:opacity-60 flex items-center gap-2">
          {saving ? <><RefreshCw className="w-4 h-4 animate-spin" />A guardar...</> : "Guardar regra de multa"}
        </button>
      </form>
    </div>
  );
}

/* ─── Modal de Ajuste de Propina ─── */
const TIPO_LABELS: Record<string, string> = {
  perdao: "❌ Perdão de multa",
  ajuste_valor: "✏️ Ajuste de valor",
  reagendamento: "📅 Reagendamento",
  justificacao: "📊 Justificação",
};

function ModalAjuste({ propina, onClose, onDone, prefix }: {
  propina: AdminPropina; onClose: () => void; onDone: (updated: AdminPropina) => void; prefix: string;
}) {
  const [tipo, setTipo] = useState<"perdao"|"ajuste_valor"|"reagendamento"|"justificacao">("perdao");
  const [motivo, setMotivo] = useState("");
  const [multaNova, setMultaNova] = useState(String(propina.multa));
  const [valorNovo, setValorNovo] = useState(String(propina.montante));
  const [novaData, setNovaData] = useState(propina.data_vencimento ? propina.data_vencimento.split("T")[0] : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [historico, setHistorico] = useState<PropAjuste[]>([]);
  const [histLoading, setHistLoading] = useState(true);

  useEffect(() => {
    api(`${prefix}/propinas/${propina.id}/ajustes`)
      .then(r => r.json()).then(setHistorico).catch(() => setHistorico([]))
      .finally(() => setHistLoading(false));
  }, [propina.id, prefix]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setSaving(true);
    try {
      const body: any = { tipo, motivo };
      if (tipo === "ajuste_valor") { body.multa_nova = Number(multaNova); body.valor_novo = Number(valorNovo); }
      if (tipo === "reagendamento") body.nova_data_vencimento = novaData;
      const res = await api(`${prefix}/propinas/${propina.id}/ajuste`, { method: "POST", body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao guardar.");
      onDone(data);
    } catch (err: any) { setError(err.message); setSaving(false); }
  };

  const TIPOS = ["perdao","ajuste_valor","reagendamento","justificacao"] as const;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900">Ajuste de Propina</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {propina.aluno_nome} · {propina.mes} {propina.ano}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400"><X className="w-5 h-5"/></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Current state */}
          <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-3 gap-3 text-center text-sm">
            <div>
              <p className="text-xs text-slate-400 mb-1">Propina</p>
              <p className="font-semibold text-slate-800">{fmt(propina.montante)} AOA</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Multa</p>
              <p className={`font-semibold ${propina.multa > 0 ? "text-red-600" : "text-slate-800"}`}>{fmt(propina.multa)} AOA</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Total</p>
              <p className="font-bold text-primary">{fmt(propina.total)} AOA</p>
            </div>
          </div>

          {/* Tipo tabs */}
          <div>
            <p className={labelCls}>Tipo de ajuste</p>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS.map(t => (
                <button key={t} type="button" onClick={() => setTipo(t)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all text-left ${
                    tipo === t ? "border-primary bg-primary/5 text-primary" : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}>
                  {TIPO_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {tipo === "ajuste_valor" && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Nova multa (AOA)">
                  <input type="number" min="0" step="0.01" className={inputCls}
                    value={multaNova} onChange={e => setMultaNova(e.target.value)} />
                </Field>
                <Field label="Novo montante (AOA)">
                  <input type="number" min="0" step="0.01" className={inputCls}
                    value={valorNovo} onChange={e => setValorNovo(e.target.value)} />
                </Field>
              </div>
            )}
            {tipo === "reagendamento" && (
              <Field label="Nova data de vencimento">
                <input type="date" className={inputCls} value={novaData} onChange={e => setNovaData(e.target.value)} required />
              </Field>
            )}
            <Field label="Motivo / Observação" required>
              <textarea className={`${inputCls} resize-none`} rows={3} placeholder="Descreva o motivo do ajuste..."
                value={motivo} onChange={e => setMotivo(e.target.value)} required />
            </Field>
            {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2 text-sm">{error}</div>}
            <button type="submit" disabled={saving}
              className="w-full px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <><RefreshCw className="w-4 h-4 animate-spin"/>A guardar...</> : "Confirmar ajuste"}
            </button>
          </form>

          {/* History */}
          {(histLoading || historico.length > 0) && (
            <div>
              <p className={`${labelCls} flex items-center gap-1`}><History className="w-3.5 h-3.5"/>Histórico de ajustes</p>
              {histLoading ? (
                <div className="flex justify-center py-4"><RefreshCw className="w-5 h-5 text-slate-300 animate-spin"/></div>
              ) : (
                <div className="space-y-2">
                  {historico.map(h => (
                    <div key={h.id} className="bg-slate-50 rounded-xl px-4 py-3 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-700">{TIPO_LABELS[h.tipo] ?? h.tipo}</span>
                        <span className="text-slate-400">{new Date(h.created_at).toLocaleDateString("pt-AO")}</span>
                      </div>
                      <p className="text-slate-500">{h.motivo}</p>
                      {h.multa_nova !== null && (
                        <p className="text-slate-400 mt-0.5">
                          Multa: {fmt(h.multa_anterior)} → {fmt(h.multa_nova)} AOA
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Propinas Admin Panel ─── */
function PropinasAdminPanel({ schoolId }: { schoolId: number }) {
  const [propinas, setPropinas] = useState<AdminPropina[]>([]);
  const [loading, setLoading] = useState(true);
  const [ajuste, setAjuste] = useState<AdminPropina | null>(null);
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterAluno, setFilterAluno] = useState("");
  const [openMenu, setOpenMenu] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await api(`/admin/colegios/${schoolId}/propinas`);
    const d = await r.json();
    setPropinas(Array.isArray(d) ? d : []);
    setLoading(false);
  }, [schoolId]);

  useEffect(() => { load(); }, [load]);

  const alunos = Array.from(new Map(propinas.map(p => [p.student_id, p.aluno_nome])).entries());

  const filtered = propinas
    .filter(p => filterStatus === "todos" || p.status === filterStatus)
    .filter(p => !filterAluno || String(p.student_id) === filterAluno);

  const statusBadge = (s: string) => {
    if (s === "pago") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle2 className="w-3 h-3"/>Pago</span>;
    if (s === "vencido") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200"><AlertCircle className="w-3 h-3"/>Vencido</span>;
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200"><Clock className="w-3 h-3"/>Pendente</span>;
  };

  if (loading) return <div className="flex justify-center py-16"><RefreshCw className="w-6 h-6 text-slate-300 animate-spin"/></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {[["todos","Todas"],["pendente","Pendentes"],["vencido","Vencidas"],["pago","Pagas"]].map(([k,l]) => (
            <button key={k} onClick={() => setFilterStatus(k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterStatus===k?"bg-white text-slate-900 shadow-sm":"text-slate-500 hover:text-slate-700"}`}>{l}</button>
          ))}
        </div>
        <select className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm bg-white focus:outline-none"
          value={filterAluno} onChange={e => setFilterAluno(e.target.value)}>
          <option value="">Todos os alunos</option>
          {alunos.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Banknote className="w-10 h-10 mx-auto mb-2 text-slate-200"/>
          <p className="text-sm">Nenhuma propina nesta categoria</p>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-2xl overflow-hidden overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[700px]">
            <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase border-b border-slate-100">
              <tr>
                <th className="px-5 py-3">Aluno</th>
                <th className="px-5 py-3">Período</th>
                <th className="px-5 py-3">Propina</th>
                <th className="px-5 py-3">Multa</th>
                <th className="px-5 py-3">Total</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/50">
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-900">{p.aluno_nome}</p>
                    <p className="text-xs text-slate-400">{p.turma}</p>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{p.mes} {p.ano}</td>
                  <td className="px-5 py-3 font-mono text-slate-700">{fmt(p.montante)} Kz</td>
                  <td className="px-5 py-3">
                    {Number(p.multa) > 0
                      ? <span className="font-mono text-red-600 font-semibold">+{fmt(p.multa)} Kz</span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-5 py-3 font-bold text-slate-900">{fmt(p.total)} Kz</td>
                  <td className="px-5 py-3">{statusBadge(p.status)}</td>
                  <td className="px-5 py-3 relative">
                    {p.status !== "pago" && (
                      <div className="relative">
                        <button onClick={() => setOpenMenu(openMenu === p.id ? null : p.id)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                          <MoreHorizontal className="w-4 h-4"/>
                        </button>
                        <AnimatePresence>
                          {openMenu === p.id && (
                            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                              className="absolute right-0 top-8 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 w-52">
                              {(["perdao","ajuste_valor","reagendamento","justificacao"] as const).map(t => (
                                <button key={t} onClick={() => { setAjuste(p); setOpenMenu(null); }}
                                  className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 text-slate-700">
                                  {TIPO_LABELS[t]}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ajuste && (
        <ModalAjuste
          propina={ajuste}
          prefix="/admin"
          onClose={() => setAjuste(null)}
          onDone={updated => {
            setPropinas(prev => prev.map(p => p.id === updated.id
              ? { ...p, multa: Number(updated.multa), montante: Number(updated.montante), total: Number(updated.montante) + Number(updated.multa), status: updated.status, data_vencimento: updated.data_vencimento }
              : p));
            setAjuste(null);
          }}
        />
      )}
    </div>
  );
}

/* ─── Emolumentos Panel ─── */
function EmolumentosPanel({ schoolId, initial, multaRegra, onUpdated }: {
  schoolId: number; initial: Emolumento[]; multaRegra: MultaRegra | null;
  onUpdated?: (list: Emolumento[]) => void;
}) {
  const [list, setList] = useState<Emolumento[]>(initial);
  const setListAndNotify = (updater: (prev: Emolumento[]) => Emolumento[]) => {
    setList(prev => {
      const next = updater(prev);
      onUpdated?.(next);
      return next;
    });
  };
  const [form, setForm] = useState({
    tipo: "propina",
    nome: DESCRICAO_POR_TIPO["propina"][0],
    montante: "",
    ano_lectivo: "2025/2026",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [currentMultaRegra, setCurrentMultaRegra] = useState<MultaRegra | null>(multaRegra);

  // Inline multa model state (shown when tipo=propina)
  const [multaModelo, setMultaModelo] = useState<1|2|3>(multaRegra?.modelo ?? 1);
  const [multaDia, setMultaDia] = useState(String(multaRegra?.dia_limite ?? 10));
  const [multaAplica, setMultaAplica] = useState(multaRegra?.aplica_automatico ?? true);
  const [multaPerc, setMultaPerc] = useState(String(multaRegra?.percentagem ?? ""));
  const [multaFixo, setMultaFixo] = useState(String(multaRegra?.valor_fixo ?? ""));
  const [multaBrackets, setMultaBrackets] = useState<Bracket[]>(
    multaRegra?.brackets?.length ? multaRegra.brackets : DEFAULT_BRACKETS
  );
  const [multaModeloSelecionado, setMultaModeloSelecionado] = useState<boolean>(!!multaRegra);

  const isPropina = form.tipo === "propina";

  const addBracket = () => {
    const last = multaBrackets[multaBrackets.length - 1];
    setMultaBrackets(b => [...b, { dia_inicio: last ? last.dia_fim + 1 : 1, dia_fim: last ? last.dia_fim + 10 : 10, percentagem: 0 }]);
  };
  const removeBracket = (i: number) => setMultaBrackets(b => b.filter((_, idx) => idx !== i));
  const updateBracket = (i: number, field: keyof Bracket, val: string) =>
    setMultaBrackets(b => b.map((br, idx) => idx === i ? { ...br, [field]: Number(val) } : br));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setSaving(true);
    if (isPropina && !multaModeloSelecionado) {
      setError("Seleccione o modelo de cobrança de multa antes de registar a propina.");
      setSaving(false);
      return;
    }
    try {
      // If propina: save multa_regra first (inline, same submit)
      if (isPropina) {
        const multaBody: any = { modelo: multaModelo, dia_limite: Number(multaDia), aplica_automatico: multaAplica };
        if (multaModelo === 1) multaBody.percentagem = Number(multaPerc);
        else if (multaModelo === 2) multaBody.brackets = multaBrackets;
        else multaBody.valor_fixo = Number(multaFixo);
        const mr = await api(`/admin/colegios/${schoolId}/multa-regra`, { method: "PUT", body: JSON.stringify(multaBody) });
        const mrData = await mr.json();
        if (!mr.ok) throw new Error(mrData.error ?? "Erro ao guardar regra de multa.");
        setCurrentMultaRegra(mrData);
      }
      // Save emolumento
      const res = await api(`/admin/colegios/${schoolId}/emolumentos`, {
        method: "POST", body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao guardar emolumento.");
      setListAndNotify(l => [data, ...l]);
      setForm(f => ({ ...f, nome: (DESCRICAO_POR_TIPO[f.tipo] ?? [])[0] ?? "", montante: "" }));
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const deleteEm = async (id: number) => {
    if (!confirm("Eliminar este emolumento?")) return;
    await api(`/admin/emolumentos/${id}`, { method: "DELETE" });
    setListAndNotify(l => l.filter(x => x.id !== id));
  };

  const MODELO_INLINE = [
    { id: 1 as const, label: "Modelo 1", sub: "Percentagem única", icon: <BadgePercent className="w-3.5 h-3.5" /> },
    { id: 2 as const, label: "Modelo 2", sub: "Progressiva (escalões)", icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { id: 3 as const, label: "Modelo 3", sub: "Taxa fixa (Kz)", icon: <Banknote className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Add form */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
        <h4 className="font-semibold text-slate-700 mb-4">Adicionar emolumento</h4>
        <form onSubmit={submit} className="space-y-4">
          {/* Base fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Tipo de emolumento" required>
              <select className={selectCls} value={form.tipo}
                onChange={e => {
                  const tipo = e.target.value;
                  const firstDesc = (DESCRICAO_POR_TIPO[tipo] ?? [])[0] ?? "";
                  setForm(f => ({ ...f, tipo, nome: firstDesc }));
                }}>
                {TIPO_GRUPOS.map(g => (
                  <optgroup key={g.grupo} label={g.grupo}>
                    {g.items.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>
            <Field label="Ano lectivo">
              <input className={inputCls} value={form.ano_lectivo}
                onChange={e => setForm(f => ({ ...f, ano_lectivo: e.target.value }))} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Descrição" required>
              <select className={selectCls} value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required>
                {(DESCRICAO_POR_TIPO[form.tipo] ?? []).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
                {!(DESCRICAO_POR_TIPO[form.tipo]?.length) && (
                  <option value="">— Seleccione um tipo de emolumento primeiro —</option>
                )}
              </select>
            </Field>
            <Field label="Montante base (AOA)" required>
              <input type="number" min="0" className={inputCls} placeholder="35000" value={form.montante}
                onChange={e => setForm(f => ({ ...f, montante: e.target.value }))} required />
            </Field>
          </div>

          {/* Inline multa model — shown only for propina */}
          <AnimatePresence>
          {isPropina && (
            <motion.div key="multa-inline-section"
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="border-2 border-amber-300 bg-amber-50 rounded-2xl p-4 space-y-4 overflow-hidden">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <p className="text-sm font-semibold text-amber-900">Modelo de cobrança de multa <span className="text-red-500">*</span></p>
                </div>
                <p className="text-xs text-amber-700 -mt-2">
                  A multa é automaticamente adicionada à propina: <strong>Propina + Multa = Total pago pelo encarregado.</strong>
                  Seleccione como a multa por atraso será calculada para este colégio.
                </p>

                {/* 3 model cards */}
                <div className="grid grid-cols-3 gap-2">
                  {MODELO_INLINE.map(m => (
                    <button key={m.id} type="button"
                      onClick={() => { setMultaModelo(m.id); setMultaModeloSelecionado(true); }}
                      className={`p-2.5 rounded-xl border-2 text-left transition-all ${
                        multaModeloSelecionado && multaModelo === m.id
                          ? "border-amber-500 bg-white shadow-sm"
                          : "border-slate-200 bg-white hover:border-amber-300"
                      }`}>
                      <div className={`flex items-center gap-1 text-xs font-semibold mb-0.5 ${multaModeloSelecionado && multaModelo === m.id ? "text-amber-800" : "text-slate-600"}`}>
                        {m.icon}{m.label}
                      </div>
                      <p className="text-xs text-slate-400 leading-tight">{m.sub}</p>
                    </button>
                  ))}
                </div>

                {/* Model-specific fields */}
                {multaModeloSelecionado && (
                  <div className="space-y-3 bg-white rounded-xl p-3 border border-amber-200">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Dia limite mensal">
                        <input type="number" min="1" max="31" className={inputCls}
                          placeholder="ex: 10" value={multaDia}
                          onChange={e => setMultaDia(e.target.value)} required />
                      </Field>
                      <Field label="Aplicar automaticamente">
                        <div className="flex items-center gap-2 h-[42px]">
                          <button type="button" onClick={() => setMultaAplica(a => !a)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${multaAplica ? "bg-amber-500" : "bg-slate-300"}`}>
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${multaAplica ? "translate-x-4" : "translate-x-1"}`} />
                          </button>
                          <span className="text-xs text-slate-600">{multaAplica ? "Sim" : "Não"}</span>
                        </div>
                      </Field>
                    </div>

                    {multaModelo === 1 && (
                      <Field label="Percentagem da multa (%)">
                        <input type="number" min="0" max="100" step="0.1" className={inputCls}
                          placeholder="ex: 10" value={multaPerc}
                          onChange={e => setMultaPerc(e.target.value)} required={isPropina && multaModelo === 1} />
                      </Field>
                    )}

                    {multaModelo === 2 && (
                      <div>
                        <p className={labelCls}>Escalões progressivos</p>
                        <div className="space-y-1.5">
                          {multaBrackets.map((b, i) => (
                            <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2 text-xs">
                              <span className="text-slate-400 shrink-0">Escalão {i+1}</span>
                              <span className="text-slate-400">Dia</span>
                              <input type="number" min="1" max="31" className="w-14 px-2 py-1 border border-slate-200 rounded-lg text-center text-xs"
                                value={b.dia_inicio} onChange={e => updateBracket(i,"dia_inicio",e.target.value)} />
                              <span className="text-slate-400">–</span>
                              <input type="number" min="1" max="31" className="w-14 px-2 py-1 border border-slate-200 rounded-lg text-center text-xs"
                                value={b.dia_fim} onChange={e => updateBracket(i,"dia_fim",e.target.value)} />
                              <span className="text-slate-400">→</span>
                              <input type="number" min="0" max="100" className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-center text-xs"
                                value={b.percentagem} onChange={e => updateBracket(i,"percentagem",e.target.value)} />
                              <span className="text-slate-400">%</span>
                              {multaBrackets.length > 1 && (
                                <button type="button" onClick={() => removeBracket(i)} className="ml-auto text-slate-300 hover:text-red-400">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        <button type="button" onClick={addBracket}
                          className="mt-1.5 text-xs text-amber-700 font-semibold flex items-center gap-1 hover:text-amber-900">
                          <Plus className="w-3 h-3" />Adicionar escalão
                        </button>
                      </div>
                    )}

                    {multaModelo === 3 && (
                      <Field label="Valor fixo da multa (AOA)">
                        <input type="number" min="0" step="0.01" className={inputCls}
                          placeholder="ex: 5000" value={multaFixo}
                          onChange={e => setMultaFixo(e.target.value)} required={isPropina && multaModelo === 3} />
                      </Field>
                    )}

                    {/* Preview */}
                    <div className="bg-amber-50 rounded-lg px-3 py-2 text-xs text-amber-800">
                      <strong>Resumo: </strong>
                      {!multaAplica
                        ? `Após o dia ${multaDia||"?"}, propinas marcadas como atrasadas (sem multa automática).`
                        : multaModelo === 1
                        ? `Após o dia ${multaDia||"?"}, aplica ${multaPerc||0}% de multa sobre o montante.`
                        : multaModelo === 2
                        ? `Multa progressiva: ${multaBrackets.map(b=>`dias ${b.dia_inicio}–${b.dia_fim}→${b.percentagem}%`).join("; ")}.`
                        : `Após o dia ${multaDia||"?"}, taxa fixa de ${Number(multaFixo||0).toLocaleString("pt-AO")} AOA.`}
                    </div>
                  </div>
                )}

                {!multaModeloSelecionado && (
                  <p className="text-xs text-amber-700 italic">↑ Seleccione um dos modelos acima para continuar.</p>
                )}
            </motion.div>
          )}
          </AnimatePresence>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>}
          <button type="submit" disabled={saving || (isPropina && !multaModeloSelecionado)}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 ${
              isPropina && !multaModeloSelecionado
                ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                : "bg-primary text-white hover:bg-primary/90 disabled:opacity-60"
            }`}>
            {saving ? <><RefreshCw className="w-4 h-4 animate-spin" />A guardar...</> : <><Plus className="w-4 h-4" />Adicionar emolumento</>}
          </button>
        </form>
      </div>

      {/* List */}
      {list.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Receipt className="w-10 h-10 mx-auto mb-2 text-slate-200" />
          <p className="text-sm">Nenhum emolumento registado</p>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-2xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[500px]">
            <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase border-b border-slate-100">
              <tr>
                <th className="px-5 py-3">Tipo</th>
                <th className="px-5 py-3">Descrição</th>
                <th className="px-5 py-3">Montante</th>
                <th className="px-5 py-3">Ano Lectivo</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {list.map(em => (
                <tr key={em.id} className="hover:bg-slate-50/50">
                  <td className="px-5 py-3">
                    <Badge text={tipoLabel(em.tipo)} color={
                      ["propina","confirmacao_matricula"].includes(em.tipo) ? "green" :
                      ["matricula","cartao_estudante"].includes(em.tipo) ? "blue" :
                      ["multa_atraso","multa_dano"].includes(em.tipo) ? "red" :
                      ["declaracao","certificado","emissao_notas","segunda_via","pedido_especial"].includes(em.tipo) ? "blue" :
                      ["transporte","alimentacao","uniforme","extracurricular"].includes(em.tipo) ? "slate" :
                      "amber"
                    } />
                  </td>
                  <td className="px-5 py-3 font-medium text-slate-900">{em.nome}</td>
                  <td className="px-5 py-3 font-mono text-slate-700">{fmtCur(em.montante)}</td>
                  <td className="px-5 py-3 text-slate-500">{em.ano_lectivo}</td>
                  <td className="px-5 py-3">
                    <button onClick={() => deleteEm(em.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Regras de multa — painel separado para editar após configuração inicial */}
      <MultaRegrasPanel
        schoolId={schoolId}
        initial={currentMultaRegra}
        onSaved={regra => setCurrentMultaRegra(regra)}
      />
    </div>
  );
}

/* ─── IBAN Panel ─── */
function IBANPanel({ schoolId, currentIban, onUpdated }: { schoolId: number; currentIban?: string; onUpdated: (iban: string) => void }) {
  const [iban, setIban] = useState(currentIban ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setSaved(false); setSaving(true);
    try {
      const res = await api(`/admin/colegios/${schoolId}/iban`, {
        method: "PUT", body: JSON.stringify({ iban }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro.");
      onUpdated(data.iban);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="max-w-lg">
      <p className="text-sm text-slate-500 mb-5">
        O IBAN é usado para receber transferências bancárias dos encarregados.
        Será exibido nas referências de pagamento e documentos oficiais.
      </p>
      <form onSubmit={submit} className="space-y-4">
        <Field label="IBAN do colégio" required>
          <div className="relative">
            <Landmark className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className={`${inputCls} pl-10 font-mono`}
              placeholder="AO06004400006729503010102"
              value={iban}
              onChange={e => setIban(e.target.value.toUpperCase())}
              required
            />
          </div>
        </Field>
        <p className="text-xs text-slate-400">Formato: AO06 + 21 dígitos (ex: AO06004400006729503010102)</p>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>}
        {saved && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> IBAN actualizado com sucesso.
          </div>
        )}
        <button type="submit" disabled={saving}
          className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-2">
          {saving ? <><RefreshCw className="w-4 h-4 animate-spin" />A guardar...</> : <><Landmark className="w-4 h-4" />Guardar IBAN</>}
        </button>
      </form>
    </div>
  );
}

/* ─── Pacotes de Emolumentos Panel ─── */
const ITEM_TIPOS: { value: string; label: string; color: string }[] = [
  { value: "propina",         label: "Propina Mensal",             color: "bg-blue-50 text-blue-700 border-blue-100" },
  { value: "transporte",      label: "Transporte",                 color: "bg-amber-50 text-amber-700 border-amber-100" },
  { value: "atl",             label: "ATL",                        color: "bg-purple-50 text-purple-700 border-purple-100" },
  { value: "alimentacao",     label: "Alimentação",                color: "bg-green-50 text-green-700 border-green-100" },
  { value: "seguro",          label: "Seguro Escolar",             color: "bg-rose-50 text-rose-700 border-rose-100" },
  { value: "uniforme",        label: "Uniforme",                   color: "bg-cyan-50 text-cyan-700 border-cyan-100" },
  { value: "extracurricular", label: "Actividades Extracurriculares", color: "bg-orange-50 text-orange-700 border-orange-100" },
  { value: "outro",           label: "Outro",                      color: "bg-slate-50 text-slate-600 border-slate-200" },
];
const pacItemLabel = (t: string) => ITEM_TIPOS.find(x => x.value === t)?.label ?? t;
const pacItemColor = (t: string) => ITEM_TIPOS.find(x => x.value === t)?.color ?? "bg-slate-50 text-slate-600 border-slate-200";
const fmtKz = (v: number) => Number(v).toLocaleString("pt-AO") + " Kz";

type PacoteItemForm = { emolId: string; nome: string; tipo: string; valor: string; };
const BLANK_ITEM = (): PacoteItemForm => ({ emolId: "", nome: "", tipo: "propina", valor: "" });

const emolToItemTipo = (t: string) => {
  const MAP: Record<string, string> = {
    propina: "propina", transporte: "transporte", alimentacao: "alimentacao",
    uniforme: "uniforme", extracurricular: "extracurricular", seguro: "seguro",
    atl: "atl", matricula: "outro",
  };
  return MAP[t] ?? "outro";
};

function PacotesPanel({ schoolId, initial, onUpdated, emolumentos = [] }: {
  schoolId: number;
  initial: PacoteEmolumento[];
  onUpdated: (pacotes: PacoteEmolumento[]) => void;
  emolumentos?: Emolumento[];
}) {
  const [pacotes, setPacotes] = useState(initial);
  const [editId, setEditId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [itens, setItens] = useState<PacoteItemForm[]>([BLANK_ITEM()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const totalCalc = itens.reduce((s, i) => s + (Number(i.valor) || 0), 0);

  const makeItemFromTipo = (tipo: string): PacoteItemForm => {
    const em = emolumentos.find(e => emolToItemTipo(e.tipo) === tipo);
    return {
      emolId: em ? String(em.id) : "",
      nome: em ? em.nome : (pacItemLabel(tipo)),
      tipo,
      valor: em ? String(em.montante) : "",
    };
  };

  const resetForm = () => {
    setNome(""); setDescricao("");
    setItens([makeItemFromTipo("propina")]);
    setError("");
  };
  const startCreate = () => { resetForm(); setCreating(true); setEditId(null); };
  const startEdit = (p: PacoteEmolumento) => {
    setNome(p.nome);
    setDescricao(p.descricao || "");
    setItens(
      Array.isArray(p.itens) && p.itens.length > 0
        ? p.itens.map(i => {
            const em = emolumentos.find(e => e.nome === i.nome);
            return { emolId: em ? String(em.id) : "", nome: i.nome, tipo: i.tipo, valor: String(i.valor) };
          })
        : [makeItemFromTipo("propina")]
    );
    setEditId(p.id); setCreating(false); setError("");
  };
  const cancel = () => { setCreating(false); setEditId(null); resetForm(); };

  const addItem = () => setItens(prev => [...prev, makeItemFromTipo("propina")]);
  const removeItem = (idx: number) => setItens(prev => prev.filter((_, i) => i !== idx));

  const selectTipo = (idx: number, tipo: string) =>
    setItens(prev => prev.map((it, i) => i === idx ? makeItemFromTipo(tipo) : it));

  const updateItemValor = (idx: number, valor: string) =>
    setItens(prev => prev.map((it, i) => i === idx ? { ...it, valor } : it));

  const buildPayload = () => ({
    nome: nome.trim(),
    descricao: descricao.trim() || undefined,
    itens: itens.map(i => ({ nome: i.nome.trim(), tipo: i.tipo, valor: Number(i.valor) || 0 })),
  });

  const validate = () => {
    if (!nome.trim()) { setError("O nome do pacote é obrigatório."); return false; }
    if (itens.length === 0) { setError("Adicione pelo menos um item ao pacote."); return false; }
    for (const it of itens) {
      if (!it.nome.trim()) { setError("Todos os itens precisam de um nome."); return false; }
      if (!it.valor || Number(it.valor) <= 0) { setError("Todos os itens precisam de um valor maior que zero."); return false; }
    }
    return true;
  };

  const saveCreate = async () => {
    if (!validate()) return;
    setSaving(true); setError("");
    try {
      const r = await api(`/admin/colegios/${schoolId}/pacotes`, { method: "POST", body: JSON.stringify(buildPayload()) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Erro ao criar pacote.");
      const next = [...pacotes, d];
      setPacotes(next); onUpdated(next); setCreating(false); resetForm();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const saveEdit = async () => {
    if (!validate()) return;
    setSaving(true); setError("");
    try {
      const r = await api(`/admin/pacotes/${editId}`, { method: "PUT", body: JSON.stringify({ ...buildPayload(), activo: true }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Erro ao actualizar pacote.");
      const next = pacotes.map(p => p.id === editId ? d : p);
      setPacotes(next); onUpdated(next); setEditId(null); resetForm();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const toggleActivo = async (p: PacoteEmolumento) => {
    const r = await api(`/admin/pacotes/${p.id}`, {
      method: "PUT", body: JSON.stringify({ nome: p.nome, itens: p.itens, descricao: p.descricao, activo: !p.activo }),
    });
    if (r.ok) { const d = await r.json(); const next = pacotes.map(x => x.id === p.id ? d : x); setPacotes(next); onUpdated(next); }
  };

  const deletePacote = async (id: number) => {
    if (!confirm("Tem a certeza que quer eliminar este pacote?")) return;
    await api(`/admin/pacotes/${id}`, { method: "DELETE" });
    const next = pacotes.filter(p => p.id !== id);
    setPacotes(next); onUpdated(next);
  };

  const formJSX = (onSave: () => void) => (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-5">
      <h4 className="font-semibold text-slate-800">{editId ? "Editar pacote" : "Novo pacote de emolumentos"}</h4>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nome do pacote" required>
          <input className={inputCls} placeholder="ex: Pacote 1.ª Classe Completo"
            value={nome} onChange={e => setNome(e.target.value)} />
        </Field>
        <Field label="Descrição (opcional)">
          <input className={inputCls} placeholder="Notas adicionais sobre o pacote"
            value={descricao} onChange={e => setDescricao(e.target.value)} />
        </Field>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">Itens do pacote <span className="text-red-500">*</span></p>
          <button onClick={addItem}
            className="flex items-center gap-1 text-xs text-primary font-medium border border-primary/30 bg-primary/5 rounded-lg px-3 py-1.5 hover:bg-primary/10 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Adicionar item
          </button>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200">
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 w-[55%]">Tipo de Emolumento</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500">Valor (Kz)</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {itens.map((it, idx) => {
                const hasRegisto = !!it.emolId;
                return (
                  <tr key={idx}>
                    <td className="px-2 py-2">
                      <select className={`${inputCls} text-sm py-1.5`}
                        value={it.tipo} onChange={e => selectTipo(idx, e.target.value)}>
                        {ITEM_TIPOS.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                      {hasRegisto && (
                        <p className="text-xs text-emerald-600 mt-0.5 px-1">✓ {it.nome}</p>
                      )}
                      {!hasRegisto && (
                        <p className="text-xs text-amber-600 mt-0.5 px-1">Sem registo — introduza o valor manualmente</p>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number" min="0" required={!hasRegisto}
                        className={`${inputCls} text-sm py-1.5 text-right ${hasRegisto ? "border-emerald-300 bg-emerald-50 focus:border-emerald-400" : "border-amber-300 bg-amber-50 focus:border-amber-400"}`}
                        placeholder={hasRegisto ? "" : "Obrigatório"}
                        value={it.valor}
                        onChange={e => updateItemValor(idx, e.target.value)}
                      />
                    </td>
                    <td className="px-1 py-2 text-center">
                      {itens.length > 1 && (
                        <button onClick={() => removeItem(idx)} className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalCalc > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-emerald-600 font-medium">Fórmula de cálculo</p>
              <p className="text-xs text-emerald-700 mt-0.5 font-mono">
                {itens.filter(i => Number(i.valor) > 0).map(i => fmtKz(Number(i.valor))).join(" + ")}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-emerald-600">Total mensal</p>
              <p className="text-xl font-bold text-emerald-700">{fmtKz(totalCalc)}</p>
            </div>
          </div>
        )}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-sm">{error}</div>}
      <div className="flex gap-3">
        <button onClick={cancel} className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">Cancelar</button>
        <button onClick={onSave} disabled={saving}
          className="px-5 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-60 flex items-center gap-2">
          {saving ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />A guardar...</> : <><CheckCircle2 className="w-3.5 h-3.5" />Guardar</>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-slate-500">
          Defina pacotes de emolumentos por escola. Cada pacote é composto por itens individuais
          (propina, transporte, ATL, etc.) — o total mensal é calculado automaticamente pela soma dos itens.
        </p>
        {!creating && editId === null && (
          <button onClick={startCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors shrink-0">
            <Plus className="w-4 h-4" /> Novo pacote
          </button>
        )}
      </div>

      {creating && formJSX(saveCreate)}

      {pacotes.length === 0 && !creating && (
        <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
          <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-medium text-slate-500">Nenhum pacote definido</p>
          <p className="text-sm text-slate-400 mt-1">Clique em "Novo pacote" para começar.</p>
        </div>
      )}

      <div className="space-y-3">
        {pacotes.map(p => (
          <div key={p.id} className={`border rounded-xl overflow-hidden transition-all ${p.activo ? "bg-white border-slate-200" : "bg-slate-50 border-slate-100 opacity-60"}`}>
            {editId === p.id ? (
              <div className="p-4">{formJSX(saveEdit)}</div>
            ) : (
              <div>
                <div className="flex items-start gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900">{p.nome}</span>
                      {!p.activo && <span className="text-xs bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full">Inactivo</span>}
                    </div>
                    {p.descricao && <p className="text-xs text-slate-400 mt-1">{p.descricao}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xl font-bold text-slate-900">{fmtKz(p.valor)}</p>
                    <p className="text-xs text-slate-400">total / mês</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleActivo(p)} title={p.activo ? "Desactivar" : "Activar"}
                      className={`p-2 rounded-lg transition-colors ${p.activo ? "text-emerald-600 hover:bg-emerald-50" : "text-slate-400 hover:bg-slate-100"}`}>
                      {p.activo ? <CheckCircle2 className="w-4 h-4" /> : <Slash className="w-4 h-4" />}
                    </button>
                    <button onClick={() => startEdit(p)} className="p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => deletePacote(p.id)} className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {Array.isArray(p.itens) && p.itens.length > 0 && (
                  <div className="border-t border-slate-100 bg-slate-50/60">
                    <div className="px-4 pt-2 pb-3 space-y-1.5">
                      {p.itens.map((it, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs border px-2 py-0.5 rounded-full ${pacItemColor(it.tipo)}`}>{pacItemLabel(it.tipo)}</span>
                            <span className="text-slate-600">{it.nome}</span>
                          </div>
                          <span className="font-mono text-slate-700">{fmtKz(it.valor)}</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200 mt-1">
                        <span className="text-xs text-slate-500 font-mono">
                          {p.itens.map(i => fmtKz(i.valor)).join(" + ")} =
                        </span>
                        <span className="text-sm font-bold text-emerald-700">{fmtKz(p.valor)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Reconciliação Admin Panel ─── */
function ReconciliacaoAdminPanel({ schoolId, commissionRate: initialRate }: { schoolId: number; commissionRate?: number }) {
  const [data, setData] = useState<{ propinas: any[]; stats: any; school: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const [recModal, setRecModal] = useState<{ ref: string; total: number } | null>(null);
  const [recValor, setRecValor] = useState("");
  const [recMetodo, setRecMetodo] = useState("EMIS");
  const [recResult, setRecResult] = useState<any>(null);
  const [recError, setRecError] = useState("");
  const [commRate, setCommRate] = useState(initialRate ?? 0);
  const [savingComm, setSavingComm] = useState(false);
  const [commInput, setCommInput] = useState(String(initialRate ?? 0));
  const [recSubTab, setRecSubTab] = useState<"faturas" | "multas">("faturas");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = filterStatus ? `?status=${filterStatus}` : "";
      const r = await api(`/admin/colegios/${schoolId}/reconciliacao${qs}`);
      if (r.ok) { const d = await r.json(); setData(d); setCommRate(Number(d.school?.commission_rate ?? 0)); setCommInput(String(Number(d.school?.commission_rate ?? 0))); }
    } finally { setLoading(false); }
  }, [schoolId, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const saveComm = async () => {
    setSavingComm(true);
    try {
      const r = await api(`/admin/colegios/${schoolId}/comissao`, {
        method: "PUT",
        body: JSON.stringify({ commission_rate: Number(commInput) }),
      });
      if (r.ok) { const d = await r.json(); setCommRate(d.commission_rate); }
    } finally { setSavingComm(false); }
  };

  const handleReconciliar = async () => {
    if (!recModal || !recValor) return;
    setReconciling(true); setRecError(""); setRecResult(null);
    try {
      const r = await api("/admin/reconciliacao/reconciliar", {
        method: "POST",
        body: JSON.stringify({ internal_reference: recModal.ref, valor_pago: Number(recValor), metodo: recMetodo }),
      });
      const d = await r.json();
      if (!r.ok) { setRecError(d.error ?? "Erro."); return; }
      setRecResult(d); load();
    } finally { setReconciling(false); }
  };

  const filtered = (data?.propinas ?? []).filter((p: any) => {
    if (search && !p.aluno_nome?.toLowerCase().includes(search.toLowerCase()) &&
        !p.internal_reference?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const statusBadge = (s: string) => {
    if (s === "pago")    return <span className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">Paga</span>;
    if (s === "vencido") return <span className="px-2.5 py-1 text-xs font-semibold bg-red-50 text-red-700 rounded-full border border-red-200">Vencida</span>;
    return                      <span className="px-2.5 py-1 text-xs font-semibold bg-amber-50 text-amber-700 rounded-full border border-amber-200">Pendente</span>;
  };

  const stats = data?.stats;

  const alunosMultas = (() => {
    const map = new Map<string, { nome: string; turma: string; multa: number; count: number }>();
    for (const p of (data?.propinas ?? [])) {
      if (p.status === "pago" || Number(p.multa) <= 0) continue;
      const key = String(p.aluno_nome);
      const existing = map.get(key);
      if (existing) { existing.multa += Number(p.multa); existing.count++; }
      else map.set(key, { nome: p.aluno_nome, turma: p.turma ?? "", multa: Number(p.multa), count: 1 });
    }
    return Array.from(map.values()).sort((a, b) => b.multa - a.multa);
  })();

  return (
    <div className="space-y-6">
      {/* Sub-tab selector */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        <button onClick={() => setRecSubTab("faturas")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${recSubTab==="faturas"?"bg-white text-slate-900 shadow-sm":"text-slate-500 hover:text-slate-700"}`}>
          <Receipt className="w-3.5 h-3.5"/> Faturas
        </button>
        <button onClick={() => setRecSubTab("multas")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${recSubTab==="multas"?"bg-white text-slate-900 shadow-sm":"text-slate-500 hover:text-slate-700"}`}>
          <AlertTriangle className="w-3.5 h-3.5 text-red-500"/> Alunos com Multas
          {alunosMultas.length > 0 && <span className="ml-1 bg-red-100 text-red-700 text-xs px-1.5 py-0.5 rounded-full font-bold">{alunosMultas.length}</span>}
        </button>
      </div>

      {/* Alunos com Multas sub-tab */}
      {recSubTab === "multas" && (
        <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500"/>
            <h3 className="font-semibold text-slate-900 text-sm">Alunos com Multas em Aberto</h3>
            <span className="ml-auto text-xs text-slate-400">{alunosMultas.length} aluno(s)</span>
          </div>
          {alunosMultas.length === 0 ? (
            <div className="py-14 text-center text-slate-400">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-300"/>
              <p className="font-semibold">Sem multas em aberto</p>
              <p className="text-sm mt-0.5">Nenhum aluno tem multas por regularizar neste colégio.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Aluno</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Turma</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Propinas c/ Multa</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Multa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {alunosMultas.map((a, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 font-medium text-slate-900">{a.nome}</td>
                      <td className="px-5 py-3 text-slate-500 text-xs">{a.turma}</td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">{a.count}</span>
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-red-700">{fmtCur(a.multa)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-red-50 border-t border-red-100">
                    <td colSpan={3} className="px-5 py-3 text-sm font-semibold text-red-700">Total em multas</td>
                    <td className="px-5 py-3 text-right font-bold text-red-800">{fmtCur(alunosMultas.reduce((s, a) => s + a.multa, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Commission config */}
      {recSubTab === "faturas" && <div className="bg-white border border-slate-100 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <ArrowLeftRight className="w-4 h-4 text-primary"/>
          <h3 className="font-semibold text-slate-900">Configuração de Comissão (Split Payment)</h3>
        </div>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-40">
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Taxa de comissão da plataforma (%)</label>
            <input type="number" min={0} max={100} step={0.5} value={commInput}
              onChange={e => setCommInput(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"/>
          </div>
          <button onClick={saveComm} disabled={savingComm}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors whitespace-nowrap">
            {savingComm ? <RefreshCw className="w-4 h-4 animate-spin"/> : <CheckCircle2 className="w-4 h-4"/>}
            Guardar
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2">Taxa actual: <strong className="text-primary">{commRate}%</strong> — aplicada automaticamente em todos os pagamentos reconciliados.</p>
      </div>}

      {/* Stats */}
      {recSubTab === "faturas" && stats && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: "Pendentes",      value: stats.pendentes,       color: "text-amber-700 bg-amber-50 border-amber-200",   icon: <Clock className="w-4 h-4"/> },
            { label: "Vencidas",       value: stats.vencidas,        color: "text-red-700 bg-red-50 border-red-200",         icon: <AlertCircle className="w-4 h-4"/> },
            { label: "Pagas",          value: stats.pagas,           color: "text-emerald-700 bg-emerald-50 border-emerald-200", icon: <CheckCircle2 className="w-4 h-4"/> },
            { label: "Receita Total",  value: fmtCur(stats.receita_total), color: "text-primary bg-primary/5 border-primary/20", icon: <Banknote className="w-4 h-4"/> },
          ].map(c => (
            <div key={c.label} className={`border rounded-xl p-4 flex items-center gap-3 ${c.color}`}>
              {c.icon}
              <div>
                <p className="text-xs font-medium opacity-70">{c.label}</p>
                <p className="text-base font-bold">{c.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Split distribution summary */}
      {recSubTab === "faturas" && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Landmark className="w-4 h-4 text-blue-600"/>
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Receita do Colégio</p>
            </div>
            <p className="text-2xl font-bold text-blue-800">{fmtCur(stats.receita_escola)}</p>
            <p className="text-xs text-blue-600 mt-0.5">Após dedução de comissão</p>
          </div>
          <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Receipt className="w-4 h-4 text-violet-600"/>
              <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Comissão Kiwara</p>
            </div>
            <p className="text-2xl font-bold text-violet-800">{fmtCur(stats.comissao_plataforma)}</p>
            <p className="text-xs text-violet-600 mt-0.5">Taxa: {commRate}%</p>
          </div>
        </div>
      )}

      {/* Filters */}
      {recSubTab === "faturas" && <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar aluno ou referência…"
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"/>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
          {(["", "pendente", "vencido", "pago"] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterStatus===s?"bg-white text-slate-900 shadow-sm":"text-slate-500 hover:text-slate-700"}`}>
              {s === "" ? "Todas" : s === "pendente" ? "Pendentes" : s === "vencido" ? "Vencidas" : "Pagas"}
            </button>
          ))}
        </div>
        <button onClick={load} className="p-2.5 border border-slate-200 bg-white rounded-xl hover:bg-slate-50 text-slate-500 transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}/>
        </button>
      </div>}

      {/* Table */}
      {recSubTab === "faturas" && <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Aluno</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Referência Interna</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Período</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Split Escola</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Comissão</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
                <th className="px-4 py-3"/>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-10 text-center text-slate-400"><RefreshCw className="w-5 h-5 animate-spin inline"/></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="py-10 text-center text-slate-400 text-sm">Sem registos.</td></tr>
              ) : filtered.map((p: any) => (
                <>
                  <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{p.aluno_nome}</p>
                      <p className="text-xs text-slate-400">{p.turma}</p>
                    </td>
                    <td className="px-4 py-3">
                      {p.internal_reference
                        ? <span className="font-mono text-xs text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">{p.internal_reference}</span>
                        : <span className="text-slate-400 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{p.mes}/{p.ano}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{fmtCur(p.total_fatura)}</td>
                    <td className="px-4 py-3 text-right text-blue-700 font-medium">{p.status==="pago"?fmtCur(p.split_escola):"—"}</td>
                    <td className="px-4 py-3 text-right text-violet-700 font-medium">{p.status==="pago"?fmtCur(p.split_plataforma):"—"}</td>
                    <td className="px-4 py-3 text-center">{statusBadge(p.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {p.status !== "pago" && p.internal_reference && (
                          <button onClick={() => { setRecModal({ ref: p.internal_reference, total: p.total_fatura }); setRecValor(String(Math.round(p.total_fatura))); setRecResult(null); setRecError(""); }}
                            className="px-2.5 py-1.5 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap">
                            Reconciliar
                          </button>
                        )}
                        <button onClick={() => setExpandedId(expandedId===p.id?null:p.id)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors">
                          <ChevronDown className={`w-4 h-4 transition-transform ${expandedId===p.id?"rotate-180":""}`}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === p.id && (
                    <tr key={`${p.id}-d`} className="bg-slate-50 border-b border-slate-100">
                      <td colSpan={8} className="px-6 py-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div><p className="text-slate-400 uppercase font-semibold tracking-wide">Montante</p><p className="font-semibold mt-0.5">{fmtCur(p.montante)}</p></div>
                          <div><p className="text-slate-400 uppercase font-semibold tracking-wide">Multa</p><p className="font-semibold text-red-700 mt-0.5">{fmtCur(p.multa)}</p></div>
                          <div><p className="text-slate-400 uppercase font-semibold tracking-wide">Vencimento</p><p className="font-semibold mt-0.5">{p.data_vencimento ? new Date(p.data_vencimento).toLocaleDateString("pt-AO") : "—"}</p></div>
                          {p.pago_em && <div><p className="text-slate-400 uppercase font-semibold tracking-wide">Pago em</p><p className="font-semibold text-emerald-700 mt-0.5">{new Date(p.pago_em).toLocaleDateString("pt-AO")}</p></div>}
                          {p.metodo_pagamento && <div><p className="text-slate-400 uppercase font-semibold tracking-wide">Método</p><p className="font-semibold mt-0.5">{p.metodo_pagamento}</p></div>}
                          {p.pagamento_origem === "online" && <div><p className="text-slate-400 uppercase font-semibold tracking-wide">Origem</p><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 mt-0.5">Online / EMIS</span></div>}
                          {p.transaction_id && (
                            <div className="col-span-2 sm:col-span-4">
                              <p className="text-slate-400 uppercase font-semibold tracking-wide">Transaction ID</p>
                              <p className="font-mono text-xs font-semibold text-blue-800 mt-0.5 break-all bg-blue-50 rounded-lg px-2 py-1 inline-block">{p.transaction_id}</p>
                            </div>
                          )}
                          {p.baixa_manual && (
                            <div className="col-span-2">
                              <p className="text-slate-400 uppercase font-semibold tracking-wide">Baixa Manual por</p>
                              <p className="font-semibold mt-0.5">{p.baixa_manual_por ?? "—"}</p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>}

      {/* Reconciliation modal */}
      <AnimatePresence>
        {recModal && (
          <motion.div key="rec-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
            onClick={e => { if (e.target===e.currentTarget) { setRecModal(null); setRecResult(null); } }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <ShieldCheck className="w-5 h-5"/>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Reconciliar Pagamento</h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{recModal.ref}</p>
                </div>
                <button onClick={() => { setRecModal(null); setRecResult(null); }} className="ml-auto text-slate-400 hover:text-slate-700"><X className="w-5 h-5"/></button>
              </div>
              {recResult ? (
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                    <p className="text-emerald-800 font-semibold flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/> Reconciliação efectuada!</p>
                    <p className="text-xs text-emerald-700 mt-1">Ref: <span className="font-mono">{recResult.payment_ref}</span></p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                      <p className="text-blue-600 font-semibold uppercase mb-1">Colégio</p>
                      <p className="text-blue-900 font-bold text-lg">{fmtCur(recResult.split?.escola ?? 0)}</p>
                    </div>
                    <div className="bg-violet-50 border border-violet-100 rounded-xl p-3">
                      <p className="text-violet-600 font-semibold uppercase mb-1">Plataforma</p>
                      <p className="text-violet-900 font-bold text-lg">{fmtCur(recResult.split?.plataforma ?? 0)}</p>
                    </div>
                  </div>
                  <button onClick={() => { setRecModal(null); setRecResult(null); }}
                    className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">Fechar</button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Total da fatura</p>
                    <p className="text-2xl font-bold text-slate-900">{fmtCur(recModal.total)}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Método</label>
                    <select value={recMetodo} onChange={e => setRecMetodo(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option>EMIS</option><option>Appy Pay</option><option>Transferência</option><option>Numerário</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Valor recebido (AOA)</label>
                    <input type="number" value={recValor} onChange={e => setRecValor(e.target.value)} min={1}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"/>
                  </div>
                  {recError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{recError}</p>}
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setRecModal(null)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">Cancelar</button>
                    <button onClick={handleReconciliar} disabled={reconciling}
                      className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                      {reconciling ? <RefreshCw className="w-4 h-4 animate-spin"/> : <ShieldCheck className="w-4 h-4"/>}
                      {reconciling ? "A processar…" : "Confirmar"}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Alunos com Multas Admin Component ─── */
function AlunosComMultasAdmin({ schoolId }: { schoolId: number }) {
  const [alunos, setAlunos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api(`/admin/colegios/${schoolId}/alunos?multas=1`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setAlunos(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [schoolId]);

  if (loading) return <div className="py-12 text-center"><RefreshCw className="w-5 h-5 animate-spin text-slate-400 mx-auto"/></div>;

  if (alunos.length === 0) return (
    <div className="py-14 text-center text-slate-400">
      <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-300"/>
      <p className="font-semibold">Sem multas em aberto</p>
      <p className="text-sm mt-0.5">Nenhum aluno tem multas por regularizar neste colégio.</p>
    </div>
  );

  const totalMultas = alunos.reduce((s: number, a: any) => s + Number(a.multa_total), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
        <AlertTriangle className="w-4 h-4 text-red-500"/>
        <span><strong className="text-red-700 font-semibold">{alunos.length}</strong> aluno(s) com multas em aberto</span>
        <span className="ml-auto font-semibold text-red-700">Total: {fmtCur(totalMultas)}</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Aluno</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Turma</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Propinas Pendentes</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Com Multa</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Multa</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Dívida Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {alunos.map((a: any) => (
              <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{a.nome}</p>
                  {a.numero_processo && <p className="text-xs font-mono text-slate-400">{a.numero_processo}</p>}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">{a.turma}{a.turno ? ` · ${a.turno}` : ""}</td>
                <td className="px-4 py-3 text-right">
                  <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">{a.propinas_pendentes}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">{a.propinas_com_multa}</span>
                </td>
                <td className="px-4 py-3 text-right font-bold text-red-700">{fmtCur(Number(a.multa_total))}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-700">{fmtCur(Number(a.divida))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-red-50 border-t border-red-100">
              <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-red-700">Total geral</td>
              <td className="px-4 py-3 text-right font-bold text-red-800">{fmtCur(totalMultas)}</td>
              <td className="px-4 py-3 text-right font-bold text-slate-700">{fmtCur(alunos.reduce((s: number, a: any) => s + Number(a.divida), 0))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/* ─── School Detail View ─── */
/* ─── AlunosListAdminPanel: Lista de alunos com atribuição de pacote inline ─── */
function AlunosListAdminPanel({ schoolId, pacotes }: { schoolId: number; pacotes: PacoteEmolumento[] }) {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : {};

  interface AdminAluno {
    id: number; nome: string; bilhete?: string; numero_processo?: string; estado?: string;
    turma: string; turno?: string; propinas_pendentes: number; divida: number; multa_total: number;
    pacote_id?: number | null; pacote_nome?: string | null; pacote_valor?: number | null;
  }

  const [alunos, setAlunos] = useState<AdminAluno[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/admin/colegios/${schoolId}/alunos`, { headers });
      if (r.ok) setAlunos(await r.json());
    } finally { setLoading(false); }
  }, [schoolId]);

  useEffect(() => { load(); }, [load]);

  const handleAssign = async (studentId: number, pacoteId: number | null) => {
    setSaving(studentId); setError(null);
    try {
      const r = await fetch(`${API}/admin/colegios/${schoolId}/alunos/${studentId}/pacote`, {
        method: "PUT", headers,
        body: JSON.stringify({ pacote_id: pacoteId }),
      });
      if (!r.ok) { const d = await r.json(); setError(d.error ?? "Erro ao atribuir pacote."); return; }
      setAlunos(prev => prev.map(a => a.id === studentId
        ? { ...a, pacote_id: pacoteId, pacote_nome: pacotes.find(p => p.id === pacoteId)?.nome ?? null }
        : a));
    } finally { setSaving(null); }
  };

  const filtered = alunos.filter(a =>
    a.nome.toLowerCase().includes(search.toLowerCase()) ||
    a.turma.toLowerCase().includes(search.toLowerCase())
  );

  const semPacote = alunos.filter(a => !a.pacote_id).length;

  if (loading) return <div className="flex items-center justify-center py-12"><RefreshCw className="w-5 h-5 animate-spin text-primary"/></div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4 items-start sm:items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">Lista de Alunos</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Atribua ou altere o pacote de propinas de cada aluno. {semPacote > 0 && (
              <span className="text-amber-600 font-medium">{semPacote} aluno(s) sem pacote atribuído.</span>
            )}
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-3 py-1.5 bg-white">
          <RefreshCw className="w-3.5 h-3.5"/> Actualizar
        </button>
      </div>

      {error && <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</div>}

      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar aluno ou turma..."
          className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"/>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-10 text-slate-400"><Users className="w-10 h-10 mx-auto mb-2 opacity-40"/><p>Sem alunos encontrados</p></div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase border-b border-slate-100">
              <tr>
                <th className="px-4 py-3">Aluno</th>
                <th className="px-4 py-3">Turma</th>
                <th className="px-4 py-3">Propinas</th>
                <th className="px-4 py-3 min-w-[200px]">Pacote de Propinas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtered.map(a => {
                const isSaving = saving === a.id;
                return (
                  <tr key={a.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{a.nome}</div>
                      {a.numero_processo && <div className="text-xs text-slate-400 font-mono">{a.numero_processo}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-700">{a.turma}</div>
                      {a.turno && <div className="text-xs text-slate-400">{a.turno}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {Number(a.propinas_pendentes) > 0
                        ? <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">{a.propinas_pendentes} pendente(s)</span>
                        : <span className="text-xs text-emerald-600">Em dia</span>}
                    </td>
                    <td className="px-4 py-3">
                      {pacotes.length === 0 ? (
                        <span className="text-xs text-slate-400 italic">Nenhum pacote configurado</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <select
                            value={a.pacote_id ?? ""}
                            disabled={isSaving}
                            onChange={e => handleAssign(a.id, e.target.value ? Number(e.target.value) : null)}
                            className={`text-xs border rounded-lg px-2.5 py-1.5 pr-7 appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors ${
                              a.pacote_id
                                ? "border-emerald-300 text-emerald-800 bg-emerald-50"
                                : "border-amber-300 text-amber-700 bg-amber-50"
                            } ${isSaving ? "opacity-50 cursor-wait" : "cursor-pointer hover:border-slate-400 bg-white"}`}
                          >
                            <option value="">— sem pacote —</option>
                            {pacotes.filter(p => p.activo).map(p => (
                              <option key={p.id} value={p.id}>{p.nome} ({fmt(p.valor)} Kz)</option>
                            ))}
                          </select>
                          {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary shrink-0"/>}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   GeralView — Edição de dados básicos + configuração rápida
══════════════════════════════════════════════════════════════════ */
type GeralViewProps = {
  school: ColegioDetail;
  onUpdated: (patch: Partial<ColegioDetail>) => void;
  onTogglePacotes: () => void;
  togglingPacotes: boolean;
};

function GeralView({ school, onUpdated, onTogglePacotes, togglingPacotes }: GeralViewProps) {
  const inp = "border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 w-full";
  const num = `${inp} w-28`;

  /* ── basic info form ── */
  const [basic, setBasic] = useState({
    name: school.name,
    nif: school.nif || "",
    phone: school.phone || "",
    email: school.email,
    commission_rate: String(school.commission_rate ?? 0),
    institution_type: school.institution_type || "colegio_geral",
    portal_nomenclatura: (school.portal_nomenclatura || "encarregado") as "encarregado" | "aluno",
  });
  const [savingBasic, setSavingBasic] = useState(false);
  const [savedBasic, setSavedBasic] = useState(false);
  const [errBasic, setErrBasic] = useState("");

  const saveBasic = async () => {
    setSavingBasic(true); setErrBasic("");
    try {
      const r = await api(`/admin/colegios/${school.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...basic, commission_rate: Number(basic.commission_rate) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Erro ao guardar.");
      onUpdated({ name: d.school.name, nif: d.school.nif, phone: d.school.phone, email: d.school.email, commission_rate: Number(d.school.commission_rate), institution_type: d.school.institution_type, portal_nomenclatura: d.school.portal_nomenclatura });
      setSavedBasic(true); setTimeout(() => setSavedBasic(false), 2500);
    } catch (e: any) { setErrBasic(e.message); }
    finally { setSavingBasic(false); }
  };

  /* ── financial quick-settings ── */
  const [fin, setFin] = useState<any>(null);
  const [loadingFin, setLoadingFin] = useState(true);
  const [savingFin, setSavingFin] = useState(false);
  const [savedFin, setSavedFin] = useState(false);
  const [errFin, setErrFin] = useState("");

  useEffect(() => {
    api(`/admin/colegios/${school.id}/settings`)
      .then(r => r.json())
      .then(d => { setFin(d.settings); setLoadingFin(false); });
  }, [school.id]);

  const setF = (path: string[], val: any) => setFin((prev: any) => {
    const next = JSON.parse(JSON.stringify(prev));
    let cur = next;
    for (let i = 0; i < path.length - 1; i++) cur = cur[path[i]];
    cur[path[path.length - 1]] = val;
    return next;
  });

  const saveFin = async () => {
    setSavingFin(true); setErrFin("");
    try {
      const r = await api(`/admin/colegios/${school.id}/settings`, {
        method: "PUT",
        body: JSON.stringify({ settings: { financeiro: fin?.financeiro, academico: fin?.academico } }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Erro ao guardar.");
      setFin(d.settings);
      setSavedFin(true); setTimeout(() => setSavedFin(false), 2500);
    } catch (e: any) { setErrFin(e.message); }
    finally { setSavingFin(false); }
  };

  /* ── password reset ── */
  const [newPass, setNewPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [savingPass, setSavingPass] = useState(false);
  const [savedPass, setSavedPass] = useState(false);
  const [errPass, setErrPass] = useState("");

  const savePass = async () => {
    if (newPass.length < 6) { setErrPass("Mínimo 6 caracteres."); return; }
    setSavingPass(true); setErrPass("");
    try {
      const r = await api(`/admin/colegios/${school.id}/reset-password`, {
        method: "PUT",
        body: JSON.stringify({ new_password: newPass }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Erro ao redefinir.");
      setNewPass(""); setSavedPass(true); setTimeout(() => setSavedPass(false), 2500);
    } catch (e: any) { setErrPass(e.message); }
    finally { setSavingPass(false); }
  };

  const F = fin?.financeiro ?? {};
  const A = fin?.academico ?? {};

  const SaveBtn = ({ saving, saved, onClick }: { saving: boolean; saved: boolean; onClick: () => void }) => (
    <button onClick={onClick} disabled={saving}
      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-60 ${
        saved ? "bg-emerald-500 text-white" : "bg-primary text-white hover:bg-primary/90"
      }`}>
      {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin"/> : saved ? <CheckCircle2 className="w-3.5 h-3.5"/> : <Save className="w-3.5 h-3.5"/>}
      {saved ? "Guardado!" : saving ? "A guardar..." : "Guardar"}
    </button>
  );

  return (
    <div className="space-y-5">

      {/* ── Informações Básicas ── */}
      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-4 h-4 text-primary"/>
            <h3 className="font-semibold text-slate-800">Informações Básicas</h3>
          </div>
          <SaveBtn saving={savingBasic} saved={savedBasic} onClick={saveBasic}/>
        </div>
        <div className="p-5 space-y-4">
          {errBasic && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0"/>{errBasic}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Nome do colégio *</label>
              <input className={inp} value={basic.name} onChange={e => setBasic(p => ({ ...p, name: e.target.value }))} placeholder="Nome do colégio"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">NIF</label>
              <input className={inp} value={basic.nif} onChange={e => setBasic(p => ({ ...p, nif: e.target.value }))} placeholder="NIF da escola"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Telefone</label>
              <input className={inp} value={basic.phone} onChange={e => setBasic(p => ({ ...p, phone: e.target.value }))} placeholder="9xx xxx xxx"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Email</label>
              <input type="email" className={inp} value={basic.email} onChange={e => setBasic(p => ({ ...p, email: e.target.value }))} placeholder="secretaria@colegio.ao"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Comissão da plataforma (%)</label>
              <input type="number" min={0} max={100} step={0.1} className={num} value={basic.commission_rate} onChange={e => setBasic(p => ({ ...p, commission_rate: e.target.value }))}/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">ID da escola</label>
              <input className={inp} value={school.school_id} readOnly disabled style={{ opacity: 0.6, cursor: "not-allowed" }}/>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Tipo de Instituição</label>
              <select className={inp} value={basic.institution_type} onChange={e => {
                const t = e.target.value;
                setBasic(p => ({ ...p, institution_type: t, portal_nomenclatura: derivePortalNomenclatura(t) }));
              }}>
                {INSTITUTION_TYPES.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Nomenclatura do Portal</label>
              <div className="flex gap-5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name={`pn_${school.id}`} value="encarregado" checked={basic.portal_nomenclatura === "encarregado"} onChange={() => setBasic(p => ({ ...p, portal_nomenclatura: "encarregado" }))} className="accent-primary"/>
                  <span className="text-sm text-slate-700">Portal do Encarregado</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name={`pn_${school.id}`} value="aluno" checked={basic.portal_nomenclatura === "aluno"} onChange={() => setBasic(p => ({ ...p, portal_nomenclatura: "aluno" }))} className="accent-primary"/>
                  <span className="text-sm text-slate-700">Portal do Aluno</span>
                </label>
              </div>
            </div>
          </div>
          {/* Turmas info */}
          {school.turmas.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Turmas registadas</p>
              <div className="flex flex-wrap gap-2">
                {school.turmas.map(t => (
                  <span key={t.id} className="text-sm bg-slate-100 text-slate-700 px-3 py-1 rounded-lg">
                    {t.nome} <span className="text-slate-400">({t.turno})</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
            {[
              { label: "Alunos", value: school.total_alunos },
              { label: "Turmas", value: school.total_turmas },
            ].map(item => (
              <div key={item.label} className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-slate-900">{item.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Configuração Financeira Rápida ── */}
      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <Banknote className="w-4 h-4 text-primary"/>
            <div>
              <h3 className="font-semibold text-slate-800">Configuração Financeira</h3>
              <p className="text-xs text-slate-400">Regras financeiras aplicadas a este colégio. Para configuração avançada vá a <strong>Configurações</strong>.</p>
            </div>
          </div>
          <SaveBtn saving={savingFin} saved={savedFin} onClick={saveFin}/>
        </div>
        {loadingFin ? (
          <div className="py-10 text-center"><RefreshCw className="w-5 h-5 animate-spin text-primary mx-auto mb-2"/><p className="text-xs text-slate-400">A carregar…</p></div>
        ) : (
          <div className="px-5 divide-y divide-slate-50">
            {errFin && <div className="py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0"/>{errFin}</div>}
            <SettingRow label="Dia de vencimento das propinas" desc="Dia do mês em que a propina vence (1–31).">
              <input type="number" min={1} max={31} className={num} value={F.propinas?.vencimento_dia ?? 15} onChange={e => setF(["financeiro","propinas","vencimento_dia"], Number(e.target.value))}/>
            </SettingRow>
            <SettingRow label="Frequência de cobrança" desc="Com que periodicidade são geradas as propinas.">
              <select className={inp} style={{width:160}} value={F.propinas?.frequencia ?? "mensal"} onChange={e => setF(["financeiro","propinas","frequencia"], e.target.value)}>
                <option value="mensal">Mensal</option>
                <option value="trimestral">Trimestral</option>
                <option value="semestral">Semestral</option>
                <option value="anual">Anual</option>
              </select>
            </SettingRow>
            <SettingRow label="Valor padrão das propinas (AOA)" desc="Valor base quando não há pacote definido.">
              <input type="number" min={0} className={num} value={F.propinas?.valor_padrao ?? 0} onChange={e => setF(["financeiro","propinas","valor_padrao"], Number(e.target.value))}/>
            </SettingRow>
            <SettingRow label="Permitir pagamento parcial" desc="Aceitar pagamentos abaixo do total da fatura.">
              <Toggle value={!!F.propinas?.permite_pagamento_parcial} onChange={v => setF(["financeiro","propinas","permite_pagamento_parcial"], v)}/>
            </SettingRow>
            <SettingRow label="Tipo de multa por atraso">
              <select className={inp} style={{width:180}} value={F.multas?.tipo ?? "percentagem"} onChange={e => setF(["financeiro","multas","tipo"], e.target.value)}>
                <option value="percentagem">Percentagem (%)</option>
                <option value="fixo">Valor fixo (AOA)</option>
              </select>
            </SettingRow>
            <SettingRow label={F.multas?.tipo === "fixo" ? "Valor da multa (AOA)" : "Percentagem da multa (%)"}>
              <input type="number" min={0} className={num} value={F.multas?.valor ?? 5} onChange={e => setF(["financeiro","multas","valor"], Number(e.target.value))}/>
            </SettingRow>
            <SettingRow label="Tolerância antes de multa (dias)" desc="Dias após vencimento antes de aplicar multa.">
              <input type="number" min={0} max={30} className={num} value={F.multas?.tolerancia_dias ?? 5} onChange={e => setF(["financeiro","multas","tolerancia_dias"], Number(e.target.value))}/>
            </SettingRow>
            <SettingRow label="Multa automática" desc="Aplicar multa sem intervenção manual.">
              <Toggle value={!!F.multas?.aplica_automatico} onChange={v => setF(["financeiro","multas","aplica_automatico"], v)}/>
            </SettingRow>
            <SettingRow label="Limite de alunos por turma">
              <input type="number" min={1} max={200} className={num} value={A.limite_alunos_por_turma ?? 40} onChange={e => setF(["academico","limite_alunos_por_turma"], Number(e.target.value))}/>
            </SettingRow>
            <SettingRow label="Portal do encarregado activo" desc="Permite que os encarregados acedam ao portal de pagamentos.">
              <Toggle value={!!(fin?.encarregados?.permite_portal_encarregado)} onChange={v => setF(["encarregados","permite_portal_encarregado"], v)}/>
            </SettingRow>
          </div>
        )}
      </div>

      {/* ── Funcionalidades ── */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5">
        <h3 className="font-semibold text-slate-800 mb-4">Funcionalidades</h3>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-800">Pacotes de emolumentos</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Agrupa serviços (mensalidade, transporte, ATL…) num pacote com valor fixo por aluno.
              {school.usa_pacotes && " A aba «Pacotes» fica disponível."}
            </p>
          </div>
          <button onClick={onTogglePacotes} disabled={togglingPacotes}
            className={`relative shrink-0 rounded-full transition-colors disabled:opacity-60 ${school.usa_pacotes ? "bg-primary" : "bg-slate-300"}`}
            style={{ height: 24, width: 44 }}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${school.usa_pacotes ? "translate-x-[20px]" : "translate-x-0.5"}`} />
          </button>
        </div>
      </div>

      {/* ── Redefinir palavra-passe ── */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5">
        <h3 className="font-semibold text-slate-800 mb-1">Redefinir Palavra-passe</h3>
        <p className="text-sm text-slate-500 mb-4">Define uma nova palavra-passe de acesso para este colégio.</p>
        {errPass && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-sm flex items-center gap-2 mb-3"><AlertCircle className="w-4 h-4 shrink-0"/>{errPass}</div>}
        <div className="flex gap-3 items-center">
          <div className="relative flex-1 max-w-xs">
            <input type={showPass ? "text" : "password"} className={`${inp} pr-10`}
              placeholder="Nova palavra-passe (min. 6 caracteres)" value={newPass} onChange={e => setNewPass(e.target.value)}/>
            <button type="button" onClick={() => setShowPass(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showPass ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
            </button>
          </div>
          <SaveBtn saving={savingPass} saved={savedPass} onClick={savePass}/>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SettingsView — Motor de Regras Configurável por Tenant
══════════════════════════════════════════════════════════════════ */
function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button onClick={() => !disabled && onChange(!value)} disabled={disabled}
      className={`relative shrink-0 rounded-full transition-colors disabled:opacity-50 ${value ? "bg-primary" : "bg-slate-300"}`}
      style={{ height: 24, width: 44 }}>
      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? "translate-x-[20px]" : "translate-x-0.5"}`} />
    </button>
  );
}

function SettingRow({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 border-b border-slate-100 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        {desc && <p className="text-xs text-slate-400 mt-0.5">{desc}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SectionCard({ title, icon, children, onSave, saving, saved }: {
  title: string; icon: React.ReactNode; children: React.ReactNode;
  onSave: () => void; saving: boolean; saved: boolean;
}) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2.5">
          <span className="text-primary">{icon}</span>
          <h3 className="font-semibold text-slate-800">{title}</h3>
        </div>
        <button onClick={onSave} disabled={saving}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-60 ${
            saved ? "bg-emerald-500 text-white" : "bg-primary text-white hover:bg-primary/90"
          }`}>
          {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin"/> : saved ? <CheckCircle2 className="w-3.5 h-3.5"/> : <Save className="w-3.5 h-3.5"/>}
          {saved ? "Guardado!" : saving ? "A guardar..." : "Guardar"}
        </button>
      </div>
      <div className="px-5 divide-y divide-slate-50">{children}</div>
    </div>
  );
}

function SettingsView({ schoolId }: { schoolId: number }) {
  type STab = "financeiro"|"pagamento"|"academico"|"encarregados"|"comunicacao"|"dashboard"|"permissoes"|"tecnico";
  const STABS: { id: STab; label: string; icon: React.ReactNode }[] = [
    { id: "financeiro",   label: "Financeiro",    icon: <Banknote className="w-4 h-4"/> },
    { id: "pagamento",    label: "Pagamento",     icon: <CreditCard className="w-4 h-4"/> },
    { id: "academico",    label: "Académico",     icon: <GraduationCap className="w-4 h-4"/> },
    { id: "encarregados", label: "Encarregados",  icon: <Users className="w-4 h-4"/> },
    { id: "comunicacao",  label: "Comunicação",   icon: <MessageSquare className="w-4 h-4"/> },
    { id: "dashboard",    label: "Dashboard",     icon: <BarChart3 className="w-4 h-4"/> },
    { id: "permissoes",   label: "Permissões",    icon: <Lock className="w-4 h-4"/> },
    { id: "tecnico",      label: "Técnico",       icon: <Globe className="w-4 h-4"/> },
  ];

  const [tab, setTab] = useState<STab>("financeiro");
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedTab, setSavedTab] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    api(`/admin/colegios/${schoolId}/settings`)
      .then(r => r.json())
      .then(d => { setSettings(d.settings); setLoading(false); });
  }, [schoolId]);

  const set = (path: string[], val: any) => {
    setSettings((prev: any) => {
      const next = JSON.parse(JSON.stringify(prev));
      let cur = next;
      for (let i = 0; i < path.length - 1; i++) { cur = cur[path[i]]; }
      cur[path[path.length - 1]] = val;
      return next;
    });
  };

  const saveSection = async (sectionKey: STab) => {
    setSaving(sectionKey); setError("");
    try {
      const r = await api(`/admin/colegios/${schoolId}/settings`, {
        method: "PUT",
        body: JSON.stringify({ settings: { [sectionKey]: settings[sectionKey] } }),
      });
      const d = await r.json();
      if (r.ok) { setSettings(d.settings); setSavedTab(sectionKey); setTimeout(() => setSavedTab(null), 2500); }
      else setError(d.error ?? "Erro ao guardar.");
    } finally { setSaving(null); }
  };

  const inp = "border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 w-full";
  const num = `${inp} w-28`;

  if (loading) return (
    <div className="py-16 text-center"><RefreshCw className="w-6 h-6 animate-spin text-primary mx-auto mb-2"/><p className="text-sm text-slate-400">A carregar configurações…</p></div>
  );
  if (!settings) return null;

  const F = settings.financeiro ?? {};
  const P = settings.pagamento ?? {};
  const A = settings.academico ?? {};
  const E = settings.encarregados ?? {};
  const C = settings.comunicacao ?? {};
  const D = settings.dashboard ?? {};
  const PE = settings.permissoes ?? {};
  const T = settings.tecnico ?? {};

  const isSaving = (t: STab) => saving === t;
  const isSaved  = (t: STab) => savedTab === t;

  return (
    <div className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0"/>{error}
        </div>
      )}

      {/* Sub-tabs */}
      <div className="overflow-x-auto -mx-0">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-max">
          {STABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                tab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── FINANCEIRO ── */}
      {tab === "financeiro" && (
        <div className="space-y-5">
          <SectionCard title="Propinas" icon={<Banknote className="w-4 h-4"/>} onSave={() => saveSection("financeiro")} saving={isSaving("financeiro")} saved={isSaved("financeiro")}>
            <SettingRow label="Frequência de cobrança" desc="Com que periodicidade são geradas as propinas.">
              <select className={inp} value={F.propinas?.frequencia ?? "mensal"} onChange={e => set(["financeiro","propinas","frequencia"], e.target.value)} style={{width:160}}>
                <option value="mensal">Mensal</option>
                <option value="trimestral">Trimestral</option>
                <option value="semestral">Semestral</option>
                <option value="anual">Anual</option>
              </select>
            </SettingRow>
            <SettingRow label="Dia de vencimento" desc="Dia do mês em que a propina vence.">
              <input type="number" min={1} max={31} className={num} value={F.propinas?.vencimento_dia ?? 15} onChange={e => set(["financeiro","propinas","vencimento_dia"], Number(e.target.value))}/>
            </SettingRow>
            <SettingRow label="Valor padrão (AOA)" desc="Valor base a usar quando não há pacote definido.">
              <input type="number" min={0} className={num} value={F.propinas?.valor_padrao ?? 0} onChange={e => set(["financeiro","propinas","valor_padrao"], Number(e.target.value))}/>
            </SettingRow>
            <SettingRow label="Permitir pagamento parcial" desc="Aceitar pagamentos abaixo do total da fatura.">
              <Toggle value={!!F.propinas?.permite_pagamento_parcial} onChange={v => set(["financeiro","propinas","permite_pagamento_parcial"], v)}/>
            </SettingRow>
          </SectionCard>

          <SectionCard title="Emolumentos" icon={<Receipt className="w-4 h-4"/>} onSave={() => saveSection("financeiro")} saving={isSaving("financeiro")} saved={isSaved("financeiro")}>
            <SettingRow label="Emolumentos obrigatórios" desc="Todos os alunos devem ter emolumentos associados.">
              <Toggle value={!!F.emolumentos?.obrigatorios} onChange={v => set(["financeiro","emolumentos","obrigatorios"], v)}/>
            </SettingRow>
            <SettingRow label="Tipos de emolumento disponíveis" desc="Lista separada por vírgulas dos tipos de emolumento.">
              <input className={inp} style={{width:260}} value={(F.emolumentos?.tipos ?? []).join(", ")}
                onChange={e => set(["financeiro","emolumentos","tipos"], e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))}/>
            </SettingRow>
          </SectionCard>

          <SectionCard title="Split Payment" icon={<ArrowLeftRight className="w-4 h-4"/>} onSave={() => saveSection("financeiro")} saving={isSaving("financeiro")} saved={isSaved("financeiro")}>
            <SettingRow label="Split activo" desc="Dividir automaticamente o pagamento entre escola e plataforma.">
              <Toggle value={!!F.split_payment?.activo} onChange={v => set(["financeiro","split_payment","activo"], v)}/>
            </SettingRow>
            <SettingRow label="Comissão da plataforma (%)" desc="Percentagem retida pela plataforma em cada pagamento.">
              <input type="number" min={0} max={100} step={0.5} className={num} value={F.split_payment?.comissao_percentagem ?? 0} onChange={e => set(["financeiro","split_payment","comissao_percentagem"], Number(e.target.value))} disabled={!F.split_payment?.activo}/>
            </SettingRow>
            <SettingRow label="IBAN da escola" desc="Conta de destino para a parte da escola.">
              <input className={inp} style={{width:260}} value={F.split_payment?.conta_destino_escola ?? ""} placeholder="AO06.0044.0000.0000.0000.0000.0" onChange={e => set(["financeiro","split_payment","conta_destino_escola"], e.target.value)} disabled={!F.split_payment?.activo}/>
            </SettingRow>
            <SettingRow label="IBAN da plataforma" desc="Conta de destino para a comissão da plataforma.">
              <input className={inp} style={{width:260}} value={F.split_payment?.conta_destino_plataforma ?? ""} placeholder="AO06.0044.0000.0000.0000.0000.0" onChange={e => set(["financeiro","split_payment","conta_destino_plataforma"], e.target.value)} disabled={!F.split_payment?.activo}/>
            </SettingRow>
          </SectionCard>
        </div>
      )}

      {/* ── PAGAMENTO ── */}
      {tab === "pagamento" && (
        <div className="space-y-4">
          <SectionCard title="Integração & Reconciliação" icon={<Zap className="w-4 h-4"/>} onSave={() => saveSection("pagamento")} saving={isSaving("pagamento")} saved={isSaved("pagamento")}>
            <SettingRow label="URL do middleware EMIS" desc="Endpoint do gateway de pagamentos a integrar.">
              <input className={inp} style={{width:280}} value={P.middleware_url ?? ""} placeholder="https://emis.gateway.ao/api" onChange={e => set(["pagamento","middleware_url"], e.target.value)}/>
            </SettingRow>
            <SettingRow label="API Key do middleware" desc="Chave de autenticação para o gateway. Guardada de forma segura.">
              <input type="password" className={inp} style={{width:200}} value={P.middleware_api_key ?? ""} placeholder="••••••••" onChange={e => set(["pagamento","middleware_api_key"], e.target.value)}/>
            </SettingRow>
            <SettingRow label="Prefixo de referência" desc="Prefixo personalizado para as referências internas (ex: ESC01).">
              <input className={inp} style={{width:140}} value={P.referencia_prefixo ?? ""} placeholder="ESC01" maxLength={8} onChange={e => set(["pagamento","referencia_prefixo"], e.target.value)}/>
            </SettingRow>
            <SettingRow label="Tolerância de reconciliação (%)" desc="Diferença máxima aceite entre valor pago e fatura.">
              <input type="number" min={0} max={10} step={0.5} className={num} value={P.reconciliacao_tolerancia_percentagem ?? 1} onChange={e => set(["pagamento","reconciliacao_tolerancia_percentagem"], Number(e.target.value))}/>
            </SettingRow>
            <SettingRow label="Reconciliação automática" desc="Atualizar estado da fatura automaticamente ao receber webhook.">
              <Toggle value={!!P.reconciliacao_automatica} onChange={v => set(["pagamento","reconciliacao_automatica"], v)}/>
            </SettingRow>
            <SettingRow label="Métodos de pagamento aceites">
              <div className="flex flex-wrap gap-2">
                {["MCX_EXPRESS","MULTICAIXA","NUMERARIO","TRANSFERENCIA","TPA"].map(m => {
                  const active = (P.metodos_aceites ?? []).includes(m);
                  return (
                    <button key={m} onClick={() => {
                      const cur = P.metodos_aceites ?? [];
                      set(["pagamento","metodos_aceites"], active ? cur.filter((x: string) => x !== m) : [...cur, m]);
                    }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${active ? "bg-primary text-white border-primary" : "bg-white text-slate-600 border-slate-200 hover:border-primary/40"}`}>
                      {m.replace("_"," ")}
                    </button>
                  );
                })}
              </div>
            </SettingRow>
          </SectionCard>

          {/* Modalidades no Portal do Encarregado */}
          <SectionCard title="Modalidades disponíveis no Portal do Encarregado" icon={<ShieldCheck className="w-4 h-4"/>} onSave={() => saveSection("pagamento")} saving={isSaving("pagamento")} saved={isSaved("pagamento")}>
            <div className="px-1 py-2">
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5"/>
                Apenas o Superadmin pode alterar estas permissões. Cada escola tem configuração independente e isolada.
              </p>
            </div>
            <SettingRow label="Referência Bancária (Multicaixa/ATM)" desc="Permitir que o encarregado gere referências de pagamento para pagar via ATM, MB Way ou internet banking.">
              <Toggle value={!!P.metodos_pagamento?.allow_reference} onChange={v => set(["pagamento","metodos_pagamento","allow_reference"], v)}/>
            </SettingRow>
            <SettingRow label="GPO / Multicaixa Express" desc="Pagamento online em tempo real via Multicaixa Express (requer integração com middleware EMIS ativo).">
              <Toggle value={!!P.metodos_pagamento?.allow_gpo_mcx} onChange={v => set(["pagamento","metodos_pagamento","allow_gpo_mcx"], v)}/>
            </SettingRow>
            <SettingRow label="Débito Direto" desc="Permite que o encarregado adira ao débito direto para pagamento automático das propinas.">
              <Toggle value={!!P.metodos_pagamento?.allow_direct_debit} onChange={v => set(["pagamento","metodos_pagamento","allow_direct_debit"], v)}/>
            </SettingRow>
            {P.metodos_pagamento?.allow_direct_debit && (
              <>
                <SettingRow label="Banco parceiro (Débito Direto)" desc="Nome do banco ou instituição que processa os débitos.">
                  <input className={inp} style={{width:220}} value={P.direct_debit?.banco_parceiro ?? ""} placeholder="ex: BAI, BFA, BIC" onChange={e => set(["pagamento","direct_debit","banco_parceiro"], e.target.value)}/>
                </SettingRow>
                <SettingRow label="Instruções ao encarregado" desc="Texto explicativo exibido ao encarregado ao aderir ao débito direto.">
                  <input className={inp} style={{width:280}} value={P.direct_debit?.instrucoes ?? ""} placeholder="Para aderir, indique o seu IBAN…" onChange={e => set(["pagamento","direct_debit","instrucoes"], e.target.value)}/>
                </SettingRow>
              </>
            )}
          </SectionCard>
        </div>
      )}

      {/* ── ACADÉMICO ── */}
      {tab === "academico" && (
        <SectionCard title="Parâmetros Académicos" icon={<GraduationCap className="w-4 h-4"/>} onSave={() => saveSection("academico")} saving={isSaving("academico")} saved={isSaved("academico")}>
          <SettingRow label="Limite de alunos por turma" desc="Número máximo de alunos que uma turma pode ter.">
            <input type="number" min={1} max={200} className={num} value={A.limite_alunos_por_turma ?? 40} onChange={e => set(["academico","limite_alunos_por_turma"], Number(e.target.value))}/>
          </SettingRow>
          <SettingRow label="Matrícula online" desc="Permitir que os encarregados façam matrícula pelo portal.">
            <Toggle value={!!A.permite_matricula_online} onChange={v => set(["academico","permite_matricula_online"], v)}/>
          </SettingRow>
          <SettingRow label="Nomenclatura de turma" desc="Como as turmas são denominadas neste colégio.">
            <input className={inp} style={{width:160}} value={A.nomenclatura_turma ?? "Turma"} placeholder="ex: Turma, Classe, Sala" onChange={e => set(["academico","nomenclatura_turma"], e.target.value)}/>
          </SettingRow>
          <SettingRow label="Anos lectivos disponíveis" desc="Lista separada por vírgulas dos anos lectivos activos.">
            <input className={inp} style={{width:260}} value={(A.anos_lectivos ?? []).join(", ")}
              onChange={e => set(["academico","anos_lectivos"], e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))}/>
          </SettingRow>
        </SectionCard>
      )}

      {/* ── ENCARREGADOS ── */}
      {tab === "encarregados" && (
        <SectionCard title="Configuração de Encarregados" icon={<Users className="w-4 h-4"/>} onSave={() => saveSection("encarregados")} saving={isSaving("encarregados")} saved={isSaved("encarregados")}>
          <SettingRow label="Máximo de encarregados por aluno" desc="Número máximo de encarregados associados a cada aluno.">
            <input type="number" min={1} max={10} className={num} value={E.maximo_por_aluno ?? 2} onChange={e => set(["encarregados","maximo_por_aluno"], Number(e.target.value))}/>
          </SettingRow>
          <SettingRow label="Comunicação activa com encarregados" desc="Enviar notificações automáticas aos encarregados.">
            <Toggle value={!!E.comunicacao_activa} onChange={v => set(["encarregados","comunicacao_activa"], v)}/>
          </SettingRow>
          <SettingRow label="Campos obrigatórios" desc="Dados exigidos no registo do encarregado (separados por vírgulas).">
            <input className={inp} style={{width:260}} value={(E.campos_obrigatorios ?? []).join(", ")}
              onChange={e => set(["encarregados","campos_obrigatorios"], e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))}/>
          </SettingRow>
          <SettingRow label="Portal do Encarregado activo" desc="Permitir acesso ao portal de consulta via PIN.">
            <Toggle value={!!E.permite_portal_encarregado} onChange={v => set(["encarregados","permite_portal_encarregado"], v)}/>
          </SettingRow>
        </SectionCard>
      )}

      {/* ── COMUNICAÇÃO ── */}
      {tab === "comunicacao" && (
        <div className="space-y-5">
          <SectionCard title="Canais de Comunicação" icon={<MessageSquare className="w-4 h-4"/>} onSave={() => saveSection("comunicacao")} saving={isSaving("comunicacao")} saved={isSaved("comunicacao")}>
            <SettingRow label="SMS activo" desc="Enviar notificações por mensagem SMS.">
              <Toggle value={!!C.sms_activo} onChange={v => set(["comunicacao","sms_activo"], v)}/>
            </SettingRow>
            <SettingRow label="Provider SMS" desc="Fornecedor do serviço de SMS.">
              <input className={inp} style={{width:200}} value={C.sms_provider ?? ""} placeholder="ex: Africell, Unitel" onChange={e => set(["comunicacao","sms_provider"], e.target.value)} disabled={!C.sms_activo}/>
            </SettingRow>
            <SettingRow label="Email activo" desc="Enviar notificações por correio electrónico.">
              <Toggle value={!!C.email_activo} onChange={v => set(["comunicacao","email_activo"], v)}/>
            </SettingRow>
            <SettingRow label="Remetente de Email" desc="Endereço de email de envio das notificações.">
              <input className={inp} style={{width:220}} value={C.email_sender ?? ""} placeholder="noreply@escola.ao" onChange={e => set(["comunicacao","email_sender"], e.target.value)} disabled={!C.email_activo}/>
            </SettingRow>
            <SettingRow label="WhatsApp activo" desc="Enviar notificações via WhatsApp Business API.">
              <Toggle value={!!C.whatsapp_activo} onChange={v => set(["comunicacao","whatsapp_activo"], v)}/>
            </SettingRow>
          </SectionCard>

          <SectionCard title="Eventos de Notificação" icon={<Zap className="w-4 h-4"/>} onSave={() => saveSection("comunicacao")} saving={isSaving("comunicacao")} saved={isSaved("comunicacao")}>
            {([
              ["nova_fatura",         "Nova fatura gerada",     "Notificar encarregado quando uma nova propina é criada."],
              ["atraso_pagamento",    "Atraso no pagamento",    "Notificar quando a propina entra em mora."],
              ["pagamento_confirmado","Pagamento confirmado",   "Notificar quando o pagamento é processado com sucesso."],
              ["nova_ocorrencia",     "Nova ocorrência",        "Notificar quando uma ocorrência é registada para o aluno."],
            ] as [string, string, string][]).map(([key, label, desc]) => (
              <SettingRow key={key} label={label} desc={desc}>
                <Toggle value={!!C.eventos?.[key]} onChange={v => set(["comunicacao","eventos",key], v)}/>
              </SettingRow>
            ))}
          </SectionCard>
        </div>
      )}

      {/* ── DASHBOARD ── */}
      {tab === "dashboard" && (
        <SectionCard title="Dashboard & Exportação" icon={<BarChart3 className="w-4 h-4"/>} onSave={() => saveSection("dashboard")} saving={isSaving("dashboard")} saved={isSaved("dashboard")}>
          <SettingRow label="Mostrar gráficos" desc="Exibir visualizações gráficas no painel do colégio.">
            <Toggle value={!!D.mostrar_graficos} onChange={v => set(["dashboard","mostrar_graficos"], v)}/>
          </SettingRow>
          <SettingRow label="Exportação activa" desc="Permitir exportar relatórios financeiros e listas de alunos.">
            <Toggle value={!!D.exportacao_activa} onChange={v => set(["dashboard","exportacao_activa"], v)}/>
          </SettingRow>
          <SettingRow label="Métricas públicas" desc="Partilhar métricas anonimizadas com a plataforma para benchmarking.">
            <Toggle value={!!D.metricas_publicas} onChange={v => set(["dashboard","metricas_publicas"], v)}/>
          </SettingRow>
          <SettingRow label="Período de relatório (dias)" desc="Janela temporal padrão para os relatórios do dashboard.">
            <select className={inp} style={{width:160}} value={D.periodo_relatorio_dias ?? 30} onChange={e => set(["dashboard","periodo_relatorio_dias"], Number(e.target.value))}>
              <option value={7}>Últimos 7 dias</option>
              <option value={30}>Últimos 30 dias</option>
              <option value={90}>Últimos 90 dias</option>
              <option value={365}>Último ano</option>
            </select>
          </SettingRow>
        </SectionCard>
      )}

      {/* ── PERMISSÕES ── */}
      {tab === "permissoes" && (
        <div className="space-y-5">
          {(["admin","financeiro","operador"] as const).map(perfil => {
            const P2 = PE[perfil] ?? {};
            const labels: Record<string, string> = {
              pode_editar_propinas: "Editar propinas",
              pode_deletar_alunos: "Eliminar alunos",
              pode_ver_financeiro: "Ver módulo financeiro",
            };
            const labelPerfil: Record<string, string> = {
              admin: "Administrador",
              financeiro: "Financeiro",
              operador: "Operador",
            };
            return (
              <SectionCard key={perfil} title={`Perfil: ${labelPerfil[perfil]}`} icon={<Lock className="w-4 h-4"/>}
                onSave={() => saveSection("permissoes")} saving={isSaving("permissoes")} saved={isSaved("permissoes")}>
                {Object.entries(labels).map(([key, lbl]) => (
                  <SettingRow key={key} label={lbl}>
                    <Toggle
                      value={!!P2[key]}
                      onChange={v => set(["permissoes", perfil, key], v)}
                      disabled={perfil === "admin" && key === "pode_ver_financeiro"}
                    />
                  </SettingRow>
                ))}
              </SectionCard>
            );
          })}
        </div>
      )}

      {/* ── TÉCNICO ── */}
      {tab === "tecnico" && (
        <SectionCard title="Parâmetros Técnicos" icon={<Globe className="w-4 h-4"/>} onSave={() => saveSection("tecnico")} saving={isSaving("tecnico")} saved={isSaved("tecnico")}>
          <SettingRow label="Fuso horário" desc="Timezone utilizado para datas e notificações.">
            <select className={inp} style={{width:200}} value={T.timezone ?? "Africa/Luanda"} onChange={e => set(["tecnico","timezone"], e.target.value)}>
              <option value="Africa/Luanda">Africa/Luanda (WAT, UTC+1)</option>
              <option value="UTC">UTC</option>
              <option value="Europe/Lisbon">Europe/Lisbon</option>
            </select>
          </SettingRow>
          <SettingRow label="Moeda" desc="Moeda utilizada no módulo financeiro.">
            <select className={inp} style={{width:160}} value={T.moeda ?? "AOA"} onChange={e => set(["tecnico","moeda"], e.target.value)}>
              <option value="AOA">AOA — Kwanza Angolano</option>
              <option value="USD">USD — Dólar Americano</option>
              <option value="EUR">EUR — Euro</option>
            </select>
          </SettingRow>
          <SettingRow label="Logs activos" desc="Registar acções dos utilizadores para auditoria.">
            <Toggle value={!!T.logs_activos} onChange={v => set(["tecnico","logs_activos"], v)}/>
          </SettingRow>
          <SettingRow label="Modo de manutenção" desc="Suspender temporariamente o acesso ao colégio na plataforma.">
            <Toggle value={!!T.manutencao_activa} onChange={v => set(["tecnico","manutencao_activa"], v)}/>
          </SettingRow>
          {T.manutencao_activa && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 text-sm text-amber-800 my-2">
              <AlertTriangle className="w-4 h-4 shrink-0"/> Modo de manutenção activo — o colégio não consegue aceder à plataforma.
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ComunicadosPanel — Gerir comunicados por Escola (Admin)
══════════════════════════════════════════════════════════════════ */
interface AdminComunicado {
  id: number; titulo: string; conteudo: string;
  prioridade: string; created_at: string; total_lidos: number;
}

function ComunicadosPanel({ schoolId }: { schoolId: number }) {
  const [comunicados, setComunicados] = useState<AdminComunicado[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [prioridade, setPrioridade] = useState<"normal" | "informativo" | "urgente">("normal");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api(`/admin/colegios/${schoolId}/comunicados`);
      if (r.ok) setComunicados(await r.json());
    } finally { setLoading(false); }
  }, [schoolId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!titulo.trim() || !conteudo.trim()) {
      setFormError("Título e conteúdo são obrigatórios.");
      return;
    }
    setSaving(true); setFormError("");
    try {
      const r = await api(`/admin/colegios/${schoolId}/comunicados`, {
        method: "POST",
        body: JSON.stringify({ titulo, conteudo, prioridade }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? "Erro"); }
      setTitulo(""); setConteudo(""); setPrioridade("normal"); setShowForm(false);
      await load();
    } catch (e: any) { setFormError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    setDeleting(id);
    try {
      await api(`/admin/comunicados/${id}`, { method: "DELETE" });
      setComunicados(prev => prev.filter(c => c.id !== id));
    } finally { setDeleting(null); }
  };

  const prioColor = (p: string) =>
    p === "urgente" ? "bg-red-100 text-red-700" :
    p === "informativo" ? "bg-blue-100 text-blue-700" :
    "bg-slate-100 text-slate-600";
  const prioLabel = (p: string) =>
    p === "urgente" ? "Urgente" : p === "informativo" ? "Informativo" : "Normal";

  return (
    <div className="space-y-4">
      {/* Header action */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-slate-400"/>
          <p className="text-sm text-slate-500">{comunicados.length} comunicado{comunicados.length !== 1 ? "s" : ""} publicado{comunicados.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => { setShowForm(v => !v); setFormError(""); }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4"/>
          Novo Comunicado
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
          <h4 className="font-semibold text-slate-800 text-sm">Novo Comunicado</h4>
          {formError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>
          )}
          <input value={titulo} onChange={e => setTitulo(e.target.value)}
            placeholder="Título do comunicado"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"/>
          <textarea value={conteudo} onChange={e => setConteudo(e.target.value)}
            placeholder="Conteúdo da mensagem para os encarregados..."
            rows={4}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"/>
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-slate-600">Prioridade:</label>
            {(["normal", "informativo", "urgente"] as const).map(p => (
              <button key={p} onClick={() => setPrioridade(p)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${prioridade === p ? prioColor(p) + " ring-2 ring-offset-1 ring-current" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                {prioLabel(p)}
              </button>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleCreate} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin"/> : <Send className="w-3.5 h-3.5"/>}
              {saving ? "A publicar..." : "Publicar"}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <RefreshCw className="w-5 h-5 animate-spin text-primary"/>
          </div>
        ) : comunicados.length === 0 ? (
          <div className="py-12 text-center">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-200"/>
            <p className="text-slate-400 text-sm font-medium">Sem comunicados publicados</p>
            <p className="text-slate-300 text-xs mt-1">Crie um comunicado para os encarregados desta escola.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {comunicados.map(c => (
              <div key={c.id} className="p-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-800 text-sm">{c.titulo}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${prioColor(c.prioridade)}`}>
                        {prioLabel(c.prioridade)}
                      </span>
                    </div>
                    <button onClick={() => handleDelete(c.id)} disabled={deleting === c.id}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50">
                      {deleting === c.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin"/> : <Trash2 className="w-3.5 h-3.5"/>}
                    </button>
                  </div>
                  <p className="text-slate-600 text-sm leading-relaxed mb-2">{c.conteudo}</p>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3"/>
                      {new Date(c.created_at).toLocaleDateString("pt-AO", { day: "2-digit", month: "long", year: "numeric" })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3"/>
                      {c.total_lidos} {c.total_lidos === 1 ? "leitura" : "leituras"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/*══════════════════════════════════════════════════════════════════
   DDManagementPanel — Painel de Débito Direto por Escola (Admin)
══════════════════════════════════════════════════════════════════ */
interface DDSub {
  id: number; status: string; iban: string; debit_day: number;
  emolumentos: string[]; email: string | null;
  created_at: string; cancellation_requested_at: string | null;
  cancelled_at: string | null;
  encarregado_nome?: string; encarregado_telefone?: string;
}

function DDManagementPanel({ schoolId }: { schoolId: number }) {
  const [subs, setSubs] = useState<DDSub[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api(`/admin/colegios/${schoolId}/direct-debit/subscriptions`);
      if (r.ok) setSubs(await r.json());
    } finally { setLoading(false); }
  }, [schoolId]);

  useEffect(() => { load(); }, [load]);

  const approveCancellation = async (subId: number) => {
    setApproving(subId); setError("");
    try {
      const r = await api(`/admin/direct-debit/subscriptions/${subId}/approve-cancellation`, { method: "PUT" });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? "Erro"); }
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setApproving(null); }
  };

  const maskIban = (iban: string) => iban.slice(0, 8) + " **** **** " + iban.slice(-4);

  const pending = subs.filter(s => s.status === "cancellation_requested");
  const displayed = filter === "pending" ? pending : subs;

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Subscrições Activas", value: subs.filter(s=>s.status==="active").length, color: "text-violet-700", bg: "bg-violet-50" },
          { label: "Pendentes de Cancelamento", value: pending.length, color: "text-amber-700", bg: "bg-amber-50" },
          { label: "Canceladas", value: subs.filter(s=>s.status==="cancelled").length, color: "text-slate-600", bg: "bg-slate-50" },
        ].map(c => (
          <div key={c.label} className={`${c.bg} rounded-2xl p-4 text-center border border-white`}>
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-xs text-slate-500 mt-0.5 leading-tight">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Pending cancellations — prominent alert */}
      {pending.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5"/>
          <div className="flex-1">
            <p className="font-semibold text-amber-900 text-sm">
              {pending.length} pedido{pending.length > 1 ? "s" : ""} de cancelamento pendente{pending.length > 1 ? "s" : ""}
            </p>
            <p className="text-amber-700 text-xs mt-0.5">
              Verifique se há facturas em trânsito antes de aprovar. O cancelamento é definitivo e o encarregado pode readerir mais tarde.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0"/>
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Filter tabs */}
      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
        <div className="flex border-b border-slate-100">
          {([
            { key: "pending" as const, label: `Aprovações Pendentes (${pending.length})` },
            { key: "all" as const, label: `Todas as Subscrições (${subs.length})` },
          ]).map(t => (
            <button key={t.key} onClick={() => setFilter(t.key)}
              className={`flex-1 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${filter === t.key ? "border-primary text-primary bg-primary/5" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <RefreshCw className="w-5 h-5 animate-spin text-primary"/>
          </div>
        ) : displayed.length === 0 ? (
          <div className="py-10 text-center">
            <ArrowLeftRight className="w-8 h-8 mx-auto mb-2 text-slate-200"/>
            <p className="text-slate-400 text-sm">{filter === "pending" ? "Sem aprovações pendentes" : "Nenhuma subscrição encontrada"}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {displayed.map(sub => {
              const isPending = sub.status === "cancellation_requested";
              const isActive = sub.status === "active";
              const isCancelled = sub.status === "cancelled";

              return (
                <div key={sub.id} className="p-4 flex items-start gap-4">
                  <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${isActive?"bg-violet-500":isPending?"bg-amber-500":"bg-slate-300"}`}/>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        {sub.encarregado_nome && (
                          <p className="font-semibold text-slate-800 text-sm">{sub.encarregado_nome}</p>
                        )}
                        {sub.encarregado_telefone && (
                          <p className="text-xs text-slate-400">+244 {sub.encarregado_telefone}</p>
                        )}
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 ${
                        isActive ? "bg-violet-100 text-violet-700" :
                        isPending ? "bg-amber-100 text-amber-700" :
                        "bg-slate-100 text-slate-500"
                      }`}>
                        {isActive ? "Activo" : isPending ? "Cancelamento Pendente" : "Cancelado"}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span><span className="font-medium text-slate-700">IBAN:</span> {maskIban(sub.iban)}</span>
                      <span><span className="font-medium text-slate-700">Dia débito:</span> {sub.debit_day}</span>
                      <span className="col-span-2">
                        <span className="font-medium text-slate-700">Serviços:</span> {(sub.emolumentos ?? []).join(", ")}
                      </span>
                      {isPending && sub.cancellation_requested_at && (
                        <span className="col-span-2 text-amber-600">
                          <span className="font-medium">Pedido em:</span> {new Date(sub.cancellation_requested_at).toLocaleDateString("pt-AO", {day:"2-digit",month:"long",year:"numeric"})}
                        </span>
                      )}
                      {isCancelled && sub.cancelled_at && (
                        <span className="col-span-2 text-slate-400">
                          Cancelado em {new Date(sub.cancelled_at).toLocaleDateString("pt-AO", {day:"2-digit",month:"long",year:"numeric"})}
                        </span>
                      )}
                    </div>
                    {isPending && (
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => approveCancellation(sub.id)}
                          disabled={approving === sub.id}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white text-xs font-semibold transition-colors">
                          {approving === sub.id ? <RefreshCw className="w-3 h-3 animate-spin"/> : <X className="w-3 h-3"/>}
                          Aprovar Cancelamento
                        </button>
                        <button
                          onClick={() => {
                            setSubs(prev => prev.map(s => s.id === sub.id ? {...s, status:"active", cancellation_requested_at:null} : s));
                          }}
                          className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors">
                          Recusar (Manter DD)
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ColegioDetail({ school, onBack }: { school: ColegioDetail; onBack: () => void }) {
  const [tab, setTab] = useState<"geral" | "alunos" | "emolumentos" | "propinas" | "pacotes" | "iban" | "reconciliacao" | "configuracoes" | "debito_direto" | "comunicados">("geral");
  const [alunoSubTab, setAlunoSubTab] = useState<"individual" | "massa" | "multas" | "lista">("individual");
  const [currentSchool, setCurrentSchool] = useState(school);
  const [togglingPacotes, setTogglingPacotes] = useState(false);
  const [pendingDDCount, setPendingDDCount] = useState(0);

  useEffect(() => {
    api(`/admin/colegios/${school.id}/direct-debit/subscriptions`).then(async r => {
      if (r.ok) {
        const subs: { status: string }[] = await r.json();
        setPendingDDCount(subs.filter(s => s.status === "cancellation_requested").length);
      }
    }).catch(() => {});
  }, [school.id]);

  const toggleUsaPacotes = async () => {
    setTogglingPacotes(true);
    try {
      const r = await api(`/admin/colegios/${currentSchool.id}/configuracao`, {
        method: "PUT", body: JSON.stringify({ usa_pacotes: !currentSchool.usa_pacotes }),
      });
      const d = await r.json();
      if (r.ok) setCurrentSchool(s => ({ ...s, usa_pacotes: d.usa_pacotes }));
    } finally { setTogglingPacotes(false); }
  };

  const TABS = [
    { id: "geral" as const, label: "Visão Geral", icon: <Building2 className="w-4 h-4" /> },
    { id: "alunos" as const, label: "Alunos", icon: <Users className="w-4 h-4" /> },
    { id: "emolumentos" as const, label: "Emolumentos", icon: <Receipt className="w-4 h-4" /> },
    ...(currentSchool.usa_pacotes ? [{ id: "pacotes" as const, label: "Pacotes", icon: <BadgePercent className="w-4 h-4" /> }] : []),
    { id: "propinas" as const, label: "Propinas", icon: <CreditCard className="w-4 h-4" /> },
    { id: "reconciliacao" as const, label: "Reconciliação", icon: <ShieldCheck className="w-4 h-4" /> },
    { id: "iban" as const, label: "IBAN", icon: <Landmark className="w-4 h-4" /> },
    { id: "debito_direto" as const, label: "Débito Direto", icon: <ArrowLeftRight className="w-4 h-4" />, badge: pendingDDCount > 0 ? pendingDDCount : undefined },
    { id: "comunicados" as const, label: "Comunicados", icon: <MessageSquare className="w-4 h-4" /> },
    { id: "configuracoes" as const, label: "Configurações", icon: <SlidersHorizontal className="w-4 h-4" /> },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-start gap-3 mb-5">
        <button onClick={onBack}
          className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors shrink-0 mt-0.5">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">{currentSchool.name}</h2>
          <p className="text-sm text-slate-500 truncate">{currentSchool.email} · {currentSchool.school_id}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
              <Users className="w-3.5 h-3.5" />{currentSchool.total_alunos} alunos
            </span>
            <span className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
              <School className="w-3.5 h-3.5" />{currentSchool.total_turmas} turmas
            </span>
          </div>
        </div>
      </div>

      {/* Tabs — scrollable on mobile */}
      <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 mb-5">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-max sm:w-fit">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                tab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}>
              {t.icon}{t.label}
              {"badge" in t && t.badge ? (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white leading-none">
                  {t.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === "geral" && (
        <GeralView
          school={currentSchool}
          onUpdated={patch => setCurrentSchool(s => ({ ...s, ...patch }))}
          onTogglePacotes={toggleUsaPacotes}
          togglingPacotes={togglingPacotes}
        />
      )}
      {tab === "alunos" && (
        <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
          {/* Sub-tab bar */}
          <div className="flex flex-wrap border-b border-slate-100 overflow-x-auto">
            <button
              onClick={() => setAlunoSubTab("lista")}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${alunoSubTab === "lista" ? "border-primary text-primary bg-primary/5" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
              <Users className="w-4 h-4" /> Lista de Alunos
            </button>
            <button
              onClick={() => setAlunoSubTab("individual")}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${alunoSubTab === "individual" ? "border-primary text-primary bg-primary/5" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
              <UserPlus className="w-4 h-4" /> Adicionar Aluno
            </button>
            <button
              onClick={() => setAlunoSubTab("massa")}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${alunoSubTab === "massa" ? "border-primary text-primary bg-primary/5" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
              <Upload className="w-4 h-4" /> Importar em Massa
            </button>
            <button
              onClick={() => setAlunoSubTab("multas")}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${alunoSubTab === "multas" ? "border-red-500 text-red-600 bg-red-50" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
              <AlertTriangle className="w-4 h-4" /> Com Multas
            </button>
          </div>

          <div className="p-6">
            {alunoSubTab === "lista" && (
              <AlunosListAdminPanel
                schoolId={currentSchool.id}
                pacotes={currentSchool.pacotes ?? []}
              />
            )}
            {alunoSubTab === "individual" && (
              <>
                <h3 className="font-semibold text-slate-900 mb-1">Registar novo aluno</h3>
                <p className="text-sm text-slate-500 mb-5">
                  Preencha os dados do aluno. Turma e encarregado são criados automaticamente se não existirem.
                  {currentSchool.usa_pacotes && " Pode atribuir um pacote de emolumentos."}
                </p>
                <AddAlunoPanel
                  schoolId={currentSchool.id}
                  turmas={currentSchool.turmas ?? []}
                  usaPacotes={currentSchool.usa_pacotes}
                  pacotes={currentSchool.pacotes ?? []}
                  anoLectivo="2025/2026"
                  onSuccess={() => setCurrentSchool(s => ({ ...s, total_alunos: s.total_alunos + 1 }))}
                />
              </>
            )}
            {alunoSubTab === "massa" && (
              <>
                <h3 className="font-semibold text-slate-900 mb-1">Importar base de dados de alunos</h3>
                <p className="text-sm text-slate-500 mb-5">
                  Preencha directamente no browser ou carregue um ficheiro CSV. Turmas e encarregados são criados automaticamente.
                  {currentSchool.usa_pacotes && " Pode atribuir um pacote de emolumentos a cada aluno."}
                </p>
                <UploadAlunosPanel
                  schoolId={currentSchool.id}
                  anoLectivo="2025/2026"
                  usaPacotes={currentSchool.usa_pacotes}
                  pacotes={currentSchool.pacotes}
                />
              </>
            )}
            {alunoSubTab === "multas" && (
              <AlunosComMultasAdmin schoolId={currentSchool.id} />
            )}
          </div>
        </div>
      )}
      {tab === "pacotes" && (
        <div className="bg-white border border-slate-100 rounded-2xl p-6">
          <h3 className="font-semibold text-slate-900 mb-1">Pacotes de emolumentos</h3>
          <PacotesPanel
            schoolId={currentSchool.id}
            initial={currentSchool.pacotes}
            onUpdated={pacotes => setCurrentSchool(s => ({ ...s, pacotes }))}
            emolumentos={currentSchool.emolumentos}
          />
        </div>
      )}
      {tab === "emolumentos" && (
        <div className="space-y-0">
          <div className="bg-white border border-slate-100 rounded-2xl p-4 sm:p-6">
            <h3 className="font-semibold text-slate-900 mb-1">Emolumentos do colégio</h3>
            <p className="text-sm text-slate-500 mb-5">Defina os tipos e valores de propinas, matrículas e outros encargos.</p>
            <EmolumentosPanel
              schoolId={currentSchool.id}
              initial={currentSchool.emolumentos}
              multaRegra={currentSchool.multa_regra}
              onUpdated={emolumentos => setCurrentSchool(s => ({ ...s, emolumentos }))}
            />
          </div>
        </div>
      )}
      {tab === "propinas" && (
        <div className="bg-white border border-slate-100 rounded-2xl p-4 sm:p-6">
          <h3 className="font-semibold text-slate-900 mb-1">Propinas do colégio</h3>
          <p className="text-sm text-slate-500 mb-5">
            Consulte e ajuste propinas de todos os alunos. Use as acções (⋯) para perdão, ajuste de valor, reagendamento ou registo de justificação.
          </p>
          <PropinasAdminPanel schoolId={currentSchool.id} />
        </div>
      )}
      {tab === "reconciliacao" && (
        <div className="bg-white border border-slate-100 rounded-2xl p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-primary"/>
            <h3 className="font-semibold text-slate-900">Reconciliação Financeira</h3>
          </div>
          <p className="text-sm text-slate-500 mb-6">
            Consulte referências internas, reconcilie pagamentos recebidos e acompanhe a distribuição de receitas entre colégio e plataforma.
          </p>
          <ReconciliacaoAdminPanel schoolId={currentSchool.id} commissionRate={currentSchool.commission_rate} />
        </div>
      )}
      {tab === "iban" && (
        <div className="bg-white border border-slate-100 rounded-2xl p-6">
          <h3 className="font-semibold text-slate-900 mb-1">Conta bancária</h3>
          <IBANPanel
            schoolId={currentSchool.id}
            currentIban={currentSchool.iban}
            onUpdated={iban => setCurrentSchool(s => ({ ...s, iban }))}
          />
        </div>
      )}

      {tab === "debito_direto" && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <ArrowLeftRight className="w-5 h-5 text-primary"/>
            <div>
              <h3 className="font-semibold text-slate-900">Débito Direto</h3>
              <p className="text-xs text-slate-500 mt-0.5">Gerencie subscrições e aprove pedidos de cancelamento dos encarregados.</p>
            </div>
          </div>
          <DDManagementPanel schoolId={currentSchool.id} />
        </div>
      )}

      {tab === "comunicados" && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5 text-primary"/>
            <div>
              <h3 className="font-semibold text-slate-900">Comunicados</h3>
              <p className="text-xs text-slate-500 mt-0.5">Publique avisos e mensagens visíveis para os encarregados desta escola no portal.</p>
            </div>
          </div>
          <ComunicadosPanel schoolId={currentSchool.id} />
        </div>
      )}

      {tab === "configuracoes" && (
        <SettingsView schoolId={currentSchool.id} />
      )}
    </div>
  );
}

/* ─── Schools List ─── */
function ColegiosView({ onSelect }: { onSelect: (id: number) => void }) {
  const [colegios, setColegios] = useState<Colegio[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api("/admin/colegios");
      if (res.ok) setColegios(await res.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const del = async (id: number, name: string) => {
    if (!confirm(`Eliminar "${name}"? Esta acção é irreversível.`)) return;
    await api(`/admin/colegios/${id}`, { method: "DELETE" });
    setColegios(c => c.filter(x => x.id !== id));
  };

  const filtered = colegios.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-5 gap-3">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Colégios ({colegios.length})</h2>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors w-full sm:w-auto justify-center">
          <Plus className="w-4 h-4" /> Criar Colégio
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Pesquisar por nome ou email..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <RefreshCw className="w-6 h-6 animate-spin text-slate-300" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Building2 className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-semibold">
            {search ? "Nenhum colégio encontrado" : "Nenhum colégio registado"}
          </p>
          {!search && (
            <button onClick={() => setShowModal(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold mx-auto hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" /> Criar primeiro colégio
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:gap-4">
          {filtered.map(c => (
            <div key={c.id}
              className="bg-white border border-slate-100 rounded-2xl p-4 sm:p-5 hover:border-slate-200 hover:shadow-sm transition-all">
              <div className="flex items-center gap-3 sm:gap-5">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="font-semibold text-slate-900 truncate">{c.name}</span>
                    {c.iban && <Badge text="IBAN" color="green" />}
                  </div>
                  <p className="text-sm text-slate-500 truncate">{c.email}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                    <span>{c.total_alunos} alunos</span>
                    <span>·</span>
                    <span>{c.total_turmas} turmas</span>
                    {c.nif && <><span>·</span><span>NIF: {c.nif}</span></>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => onSelect(c.id)}
                    className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors">
                    <Eye className="w-4 h-4" />
                    <span className="hidden sm:inline">Gerir</span>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>
                  <button onClick={() => del(c.id, c.name)}
                    className="p-2 rounded-xl hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <ModalCriarColegio
            onClose={() => setShowModal(false)}
            onCreated={c => { setColegios(l => [c, ...l]); setShowModal(false); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   AdminSMSView — Global SMS Management
═══════════════════════════════════════════════════════════ */
const ADMIN_SMS_EVENTS = [
  { key: "nova_fatura",          label: "Nova Fatura",          icon: "📄" },
  { key: "pagamento_confirmado", label: "Pagamento Confirmado", icon: "✅" },
  { key: "atraso_pagamento",     label: "Atraso de Pagamento",  icon: "⏰" },
  { key: "multa_aplicada",       label: "Multa Aplicada",       icon: "⚠️" },
];

const ADMIN_DEFAULT_TEMPLATES: Record<string, string> = {
  nova_fatura:          "Prezado(a) {nome_encarregado}, a propina de {mes} no valor de {valor} Kz está disponível. {reference_info}",
  pagamento_confirmado: "Pagamento confirmado para {nome_aluno}. Valor: {valor} Kz. Obrigado.",
  atraso_pagamento:     "A propina de {mes} encontra-se em atraso. Evite multa. {reference_info}",
  multa_aplicada:       "Foi aplicada uma multa de {valor_multa} Kz à propina de {mes}.",
};

type AdminTemplateVarDef = { key: string; label: string; sample: string; events: string[] };
const ADMIN_TEMPLATE_VARS: AdminTemplateVarDef[] = [
  { key: "{nome_encarregado}", label: "Nome do Encarregado",         sample: "Maria Antónia", events: ["nova_fatura","pagamento_confirmado","atraso_pagamento","multa_aplicada"] },
  { key: "{nome_aluno}",       label: "Nome do Aluno",               sample: "João Silva",    events: ["nova_fatura","pagamento_confirmado","atraso_pagamento","multa_aplicada"] },
  { key: "{mes}",              label: "Mês da Propina",              sample: "Março 2025",    events: ["nova_fatura","atraso_pagamento","multa_aplicada"] },
  { key: "{valor}",            label: "Valor da Propina (Kz)",       sample: "15.000",        events: ["nova_fatura","pagamento_confirmado"] },
  { key: "{valor_multa}",      label: "Valor da Multa (Kz)",         sample: "1.500",         events: ["multa_aplicada"] },
  { key: "{reference_info}",   label: "Referência inteligente (EMIS → 'Ref: XXXX' | interna → 'Aceda ao Portal do Aluno para pagar.')", sample: "Ref: REF-00123456", events: ["nova_fatura","atraso_pagamento"] },
];

const ADMIN_SAMPLE: Record<string, string> = {
  "{nome_encarregado}": "Maria Antónia",
  "{nome_aluno}":       "João Silva",
  "{mes}":              "Março 2025",
  "{valor}":            "15.000",
  "{valor_multa}":      "1.500",
  "{reference_info}":   "Ref: REF-00123456",
};

function adminPreviewTemplate(tpl: string): string {
  return Object.entries(ADMIN_SAMPLE).reduce((t, [k, v]) => t.replaceAll(k, v), tpl);
}

function AdminSMSView() {
  const [activeTab, setActiveTab] = useState<"provider" | "templates" | "logs" | "enviar">("provider");

  // Provider config
  const [providerConfig, setProviderConfig] = useState({ provider: "mock", api_url: "", api_key: "", sender_name: "KiwaraEsc" });
  const [savingProvider, setSavingProvider] = useState(false);
  const [savedProvider, setSavedProvider] = useState(false);

  // Logs
  const [logs, setLogs] = useState<any[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsStats, setLogsStats] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterEvento, setFilterEvento] = useState("");

  // Global templates
  const [globalTemplates, setGlobalTemplates] = useState<Record<string, string>>({ ...ADMIN_DEFAULT_TEMPLATES });
  const [savingTemplates, setSavingTemplates] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState(false);
  const [editingAdminTemplate, setEditingAdminTemplate] = useState<string | null>(null);

  // Bulk send
  const [schools, setSchools] = useState<any[]>([]);
  const [selectedSchools, setSelectedSchools] = useState<number[]>([]);
  const [sendTodos, setSendTodos] = useState(false);
  const [bulkMsg, setBulkMsg] = useState("");
  const [bulkTemplate, setBulkTemplate] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<any>(null);

  const getToken = () => localStorage.getItem(TOKEN_KEY) ?? "";
  const apiAdmin = (path: string, opts?: RequestInit) =>
    fetch(`${API}${path}`, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}`, ...(opts?.headers ?? {}) } });

  const fetchProvider = () => {
    apiAdmin("/admin/sms/provider").then(r => r.ok ? r.json() : null).then(d => d && setProviderConfig(d));
  };

  const fetchStats = () => {
    apiAdmin("/admin/sms/stats").then(r => r.ok ? r.json() : null).then(d => d && setLogsStats(d));
  };

  const fetchSchools = () => {
    apiAdmin("/admin/colegios").then(r => r.ok ? r.json() : null).then(d => d && setSchools(d.colegios ?? d ?? []));
  };

  const fetchLogs = (page: number) => {
    setLogsLoading(true);
    setLogsPage(page);
    const qs = new URLSearchParams({ page: String(page), limit: "30", ...(filterStatus ? { status: filterStatus } : {}), ...(filterEvento ? { evento: filterEvento } : {}) });
    apiAdmin(`/admin/sms/logs?${qs}`)
      .then(r => r.json())
      .then(d => { setLogs(d.logs ?? []); setLogsTotal(d.total ?? 0); })
      .finally(() => setLogsLoading(false));
  };

  const fetchGlobalTemplates = () => {
    apiAdmin("/admin/sms/templates").then(r => r.ok ? r.json() : null).then(d => d && setGlobalTemplates(d));
  };

  const saveProvider = async () => {
    setSavingProvider(true);
    await apiAdmin("/admin/sms/provider", { method: "PUT", body: JSON.stringify(providerConfig) });
    setSavingProvider(false);
    setSavedProvider(true);
    setTimeout(() => setSavedProvider(false), 2500);
  };

  const saveGlobalTemplates = async () => {
    setSavingTemplates(true);
    await apiAdmin("/admin/sms/templates", { method: "PUT", body: JSON.stringify(globalTemplates) });
    setSavingTemplates(false);
    setSavedTemplates(true);
    setTimeout(() => setSavedTemplates(false), 2500);
  };

  useEffect(() => {
    fetchProvider();
    fetchStats();
    fetchSchools();
    fetchGlobalTemplates();
  }, []);

  useEffect(() => {
    if (activeTab === "logs") fetchLogs(1);
  }, [activeTab, filterStatus, filterEvento]);

  const handleBulkSend = async () => {
    if (!bulkMsg.trim()) return;
    setSending(true);
    setSendResult(null);
    const body = sendTodos
      ? { mensagem: bulkMsg, todos: true }
      : { mensagem: bulkMsg, school_ids: selectedSchools };
    const r = await apiAdmin("/admin/sms/send", { method: "POST", body: JSON.stringify(body) });
    const d = await r.json();
    setSendResult(d);
    setSending(false);
    setBulkMsg("");
    setSelectedSchools([]);
    setSendTodos(false);
    fetchStats();
  };

  const totalPages = Math.ceil(logsTotal / 30);

  const statusBadge = (s: string) => s === "sent"
    ? <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Enviado</span>
    : <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Falhou</span>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-primary"/> Gestão Global de SMS
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">Configure o provedor, monitorize envios e comunique com todos os colégios.</p>
        </div>
        {logsStats && (
          <div className="flex gap-3">
            <div className="text-center px-4 py-2 bg-slate-100 rounded-xl">
              <div className="text-lg font-bold text-slate-800">{logsStats.total ?? 0}</div>
              <div className="text-xs text-slate-500">Total</div>
            </div>
            <div className="text-center px-4 py-2 bg-emerald-50 rounded-xl">
              <div className="text-lg font-bold text-emerald-700">{logsStats.sent ?? 0}</div>
              <div className="text-xs text-emerald-600">Enviados</div>
            </div>
            <div className="text-center px-4 py-2 bg-red-50 rounded-xl">
              <div className="text-lg font-bold text-red-700">{logsStats.failed ?? 0}</div>
              <div className="text-xs text-red-600">Falhas</div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit flex-wrap">
        {(["provider","templates","enviar","logs"] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === t ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
            {t === "provider" ? "Provedor" : t === "templates" ? "Templates" : t === "enviar" ? "Enviar em Massa" : "Monitorização"}
          </button>
        ))}
      </div>

      {/* Provider Tab */}
      {activeTab === "provider" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
          <h3 className="font-semibold text-slate-900">Configuração Global do Provedor SMS</h3>
          <p className="text-sm text-slate-500">Esta configuração é usada como padrão. Cada colégio pode sobrepor com as suas próprias credenciais.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Provedor</label>
              <select value={providerConfig.provider} onChange={e => setProviderConfig(prev => ({ ...prev, provider: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                <option value="mock">Simulação (Mock)</option>
                <option value="africastalking">Africa's Talking</option>
                <option value="twilio">Twilio</option>
                <option value="custom">Personalizado</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nome do Remetente</label>
              <input value={providerConfig.sender_name} onChange={e => setProviderConfig(prev => ({ ...prev, sender_name: e.target.value }))} maxLength={11}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="KiwaraEsc"/>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">URL do Endpoint do Provedor</label>
              <input value={providerConfig.api_url} onChange={e => setProviderConfig(prev => ({ ...prev, api_url: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="https://api.provedor.com/sms/send"/>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">API Key / Token</label>
              <input value={providerConfig.api_key} onChange={e => setProviderConfig(prev => ({ ...prev, api_key: e.target.value }))} type="password"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="••••••••••••••••"/>
            </div>
          </div>
          <div className="pt-2 flex justify-end">
            <button onClick={saveProvider} disabled={savingProvider}
              className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors">
              {savingProvider ? <RefreshCw className="w-4 h-4 animate-spin"/> : savedProvider ? <CheckCircle2 className="w-4 h-4"/> : <Save className="w-4 h-4"/>}
              {savedProvider ? "Guardado!" : "Guardar"}
            </button>
          </div>
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === "templates" && (
        <div className="space-y-5">
          {/* Info banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
            <MessageSquare className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0"/>
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">Templates globais da plataforma</p>
              <p>Estes templates são usados como padrão para todos os colégios. Cada colégio pode personalizar os seus próprios templates nas configurações de Comunicação, que têm prioridade sobre estes.</p>
              <p className="mt-1 text-blue-600">Ordem de prioridade: <strong>Template do colégio</strong> → Template global (este) → Padrão do sistema</p>
            </div>
          </div>

          {/* Event template editors */}
          {ADMIN_SMS_EVENTS.map(ev => {
            const tpl     = globalTemplates[ev.key] ?? ADMIN_DEFAULT_TEMPLATES[ev.key] ?? "";
            const isEdit  = editingAdminTemplate === ev.key;
            const preview = adminPreviewTemplate(tpl);
            const evVars  = ADMIN_TEMPLATE_VARS.filter(v => v.events.includes(ev.key));

            return (
              <div key={ev.key} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{ev.icon}</span>
                    <span className="font-semibold text-slate-900 text-sm">{ev.label}</span>
                    {globalTemplates[ev.key] && globalTemplates[ev.key] !== ADMIN_DEFAULT_TEMPLATES[ev.key] && (
                      <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Personalizado</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {globalTemplates[ev.key] !== ADMIN_DEFAULT_TEMPLATES[ev.key] && (
                      <button onClick={() => setGlobalTemplates(prev => ({ ...prev, [ev.key]: ADMIN_DEFAULT_TEMPLATES[ev.key] }))}
                        className="text-xs text-slate-500 hover:text-slate-700 hover:underline">↩ Padrão</button>
                    )}
                    <button onClick={() => setEditingAdminTemplate(isEdit ? null : ev.key)}
                      className="text-xs text-primary hover:underline font-medium">
                      {isEdit ? "Fechar" : "Editar"}
                    </button>
                  </div>
                </div>

                {/* Preview when not editing */}
                {!isEdit && (
                  <div className="px-5 py-3">
                    <p className="text-xs text-slate-500 mb-1">Pré-visualização:</p>
                    <p className="text-sm text-slate-700">{preview}</p>
                    <p className="text-xs text-slate-400 mt-1">{preview.length} caracteres · {Math.ceil(preview.length / 160)} SMS</p>
                  </div>
                )}

                {/* Editor when open */}
                {isEdit && (
                  <div className="p-5 space-y-4 bg-slate-50">
                    <textarea
                      value={tpl}
                      onChange={e => setGlobalTemplates(prev => ({ ...prev, [ev.key]: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none font-mono"/>

                    {/* Variable chips */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-600">Variáveis disponíveis — clique para inserir:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {evVars.map(v => (
                          <button key={v.key}
                            onClick={() => setGlobalTemplates(prev => ({ ...prev, [ev.key]: (prev[ev.key] ?? "") + v.key }))}
                            className="text-xs bg-white border border-slate-300 text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors font-mono">
                            {v.key}
                          </button>
                        ))}
                      </div>
                      <div className="space-y-1">
                        {evVars.map(v => (
                          <p key={v.key} className="text-xs text-slate-500">
                            <span className="font-mono font-semibold text-slate-700">{v.key}</span> — {v.label}
                          </p>
                        ))}
                      </div>
                    </div>

                    {/* Live preview */}
                    <div className="bg-white rounded-xl border border-slate-200 p-3">
                      <p className="text-xs font-semibold text-slate-500 mb-1.5">Pré-visualização (dados de exemplo):</p>
                      <p className="text-sm text-slate-700 leading-relaxed">{preview}</p>
                      <p className="text-xs text-slate-400 mt-1">{preview.length} caracteres · {Math.ceil(preview.length / 160)} SMS</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex justify-end">
            <button onClick={saveGlobalTemplates} disabled={savingTemplates}
              className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors">
              {savingTemplates ? <RefreshCw className="w-4 h-4 animate-spin"/> : savedTemplates ? <CheckCircle2 className="w-4 h-4"/> : <Save className="w-4 h-4"/>}
              {savedTemplates ? "Guardado!" : "Guardar Templates Globais"}
            </button>
          </div>
        </div>
      )}

      {/* Bulk Send Tab */}
      {activeTab === "enviar" && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <h3 className="font-semibold text-slate-900">Mensagem</h3>

            {/* Template Picker */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Usar template global</p>
              <div className="flex flex-wrap gap-2">
                {ADMIN_SMS_EVENTS.filter(ev => ev.key !== "manual").map(ev => (
                  <button key={ev.key}
                    onClick={() => {
                      setBulkMsg(globalTemplates[ev.key] ?? ADMIN_DEFAULT_TEMPLATES[ev.key] ?? "");
                      setBulkTemplate(ev.key);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      bulkTemplate === ev.key
                        ? "bg-primary text-white border-primary shadow-sm"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:border-primary/40 hover:bg-primary/5"
                    }`}>
                    {ev.label}
                  </button>
                ))}
                {bulkTemplate && (
                  <button onClick={() => { setBulkMsg(""); setBulkTemplate(""); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 transition-all">
                    Limpar
                  </button>
                )}
              </div>
              {bulkTemplate && (
                <p className="text-xs text-slate-400">Template carregado — pode editar o texto abaixo antes de enviar. As variáveis {"{..."} serão substituídas automaticamente por cada colégio.</p>
              )}
            </div>

            <textarea value={bulkMsg} onChange={e => { setBulkMsg(e.target.value); setBulkTemplate(""); }} rows={4}
              placeholder="Escreva a mensagem ou selecione um template acima..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"/>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Colégios Destinatários</h3>
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input type="checkbox" checked={sendTodos} onChange={e => { setSendTodos(e.target.checked); setSelectedSchools([]); }} className="rounded"/>
                Todos os colégios
              </label>
            </div>
            {!sendTodos && (
              <div className="max-h-52 overflow-y-auto space-y-1">
                {schools.map((sc: any) => (
                  <label key={sc.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${selectedSchools.includes(sc.id) ? "bg-primary/5 border border-primary/20" : "hover:bg-slate-50"}`}>
                    <input type="checkbox" checked={selectedSchools.includes(sc.id)}
                      onChange={e => setSelectedSchools(prev => e.target.checked ? [...prev, sc.id] : prev.filter(id => id !== sc.id))}
                      className="rounded text-primary"/>
                    <span className="text-sm text-slate-800">{sc.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {sendResult && (
            <div className={`rounded-xl p-4 flex items-center gap-3 ${sendResult.failed > 0 ? "bg-yellow-50 border border-yellow-200" : "bg-emerald-50 border border-emerald-200"}`}>
              <CheckCircle2 className={`w-5 h-5 ${sendResult.failed > 0 ? "text-yellow-600" : "text-emerald-600"}`}/>
              <p className="text-sm font-medium">
                {sendResult.sent} enviado(s) · {sendResult.failed} falha(s) · {sendResult.total} total
              </p>
            </div>
          )}

          <div className="flex justify-end">
            <button onClick={handleBulkSend} disabled={sending || !bulkMsg.trim() || (!sendTodos && !selectedSchools.length)}
              className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {sending ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}
              {sending ? "A enviar..." : sendTodos ? "Enviar para todos os colégios" : `Enviar para ${selectedSchools.length} colégio(s)`}
            </button>
          </div>
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === "logs" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none">
              <option value="">Todos os estados</option>
              <option value="sent">Enviado</option>
              <option value="failed">Falhou</option>
            </select>
            <select value={filterEvento} onChange={e => setFilterEvento(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none">
              <option value="">Todos os eventos</option>
              {ADMIN_SMS_EVENTS.map(e => <option key={e.key} value={e.key}>{e.label}</option>)}
            </select>
            <button onClick={() => fetchLogs(1)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">
              <RefreshCw className="w-3.5 h-3.5"/> Actualizar
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Logs de SMS ({logsTotal})</h3>
            </div>
            {logsLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-5 h-5 animate-spin text-primary"/>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30"/>
                <p className="text-sm">Nenhum SMS encontrado.</p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-slate-100">
                  {logs.map((log: any) => (
                    <div key={log.id} className="px-5 py-3 flex items-start gap-4">
                      <div className="mt-0.5">{statusBadge(log.status)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className="text-xs font-semibold text-slate-700">{log.school_name ?? `Colégio #${log.school_id}`}</span>
                          <span className="text-xs text-slate-500">{log.telefone}</span>
                          {log.evento && <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{ADMIN_SMS_EVENTS.find(e => e.key === log.evento)?.label ?? log.evento}</span>}
                        </div>
                        <p className="text-sm text-slate-600 line-clamp-2">{log.mensagem}</p>
                      </div>
                      <span className="text-xs text-slate-400 whitespace-nowrap">
                        {new Date(log.data_envio).toLocaleString("pt-AO", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}
                      </span>
                    </div>
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
                    <button onClick={() => fetchLogs(logsPage - 1)} disabled={logsPage <= 1}
                      className="flex items-center gap-1 text-sm text-slate-600 disabled:opacity-40 hover:text-primary">
                      <ChevronLeft className="w-4 h-4"/> Anterior
                    </button>
                    <span className="text-xs text-slate-500">{logsPage} / {totalPages}</span>
                    <button onClick={() => fetchLogs(logsPage + 1)} disabled={logsPage >= totalPages}
                      className="flex items-center gap-1 text-sm text-slate-600 disabled:opacity-40 hover:text-primary">
                      Seguinte <ChevronRight className="w-4 h-4"/>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Top schools mini chart */}
          {logsStats?.top_schools?.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
              <h3 className="font-semibold text-slate-900 text-sm">Top Colégios (por SMS enviados)</h3>
              {logsStats.top_schools.map((s: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-4 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm text-slate-700 truncate">{s.name}</span>
                      <span className="text-xs font-semibold text-slate-600">{s.total}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, (s.total / (logsStats.top_schools[0]?.total || 1)) * 100)}%` }}/>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Main Dashboard ─── */
type AdminView = "stats" | "colegios" | "sms";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const [view, setView] = useState<AdminView>("stats");
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | null>(null);
  const [schoolDetail, setSchoolDetail] = useState<ColegioDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) { setLocation("/admin"); return; }
    api("/admin/stats").then(r => {
      if (r.status === 401) { localStorage.removeItem(TOKEN_KEY); setLocation("/admin"); }
      else r.json().then(setStats);
    });
  }, []);

  useEffect(() => {
    if (!selectedSchoolId) { setSchoolDetail(null); return; }
    setLoadingDetail(true);
    api(`/admin/colegios/${selectedSchoolId}`)
      .then(r => r.json())
      .then(setSchoolDetail)
      .finally(() => setLoadingDetail(false));
  }, [selectedSchoolId]);

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setLocation("/admin");
  };

  const NAV = [
    { id: "stats" as const, label: "Visão Geral", icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: "colegios" as const, label: "Colégios", icon: <Building2 className="w-5 h-5" /> },
    { id: "sms" as const, label: "SMS & Comunicação", icon: <Smartphone className="w-5 h-5" /> },
  ];

  const navigate = (id: AdminView) => {
    setView(id);
    setSelectedSchoolId(null);
    setSidebarOpen(false);
  };

  const currentLabel = selectedSchoolId
    ? schoolDetail?.name ?? "Colégio"
    : NAV.find(n => n.id === view)?.label ?? "";

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Top Header ── */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white shadow-lg">
        <div className="flex items-center h-14 px-4 gap-3">
          {/* Mobile hamburger (hidden on desktop) */}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors shrink-0 md:hidden"
            aria-label="Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Branding */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <div>
              <span className="font-bold text-sm">Kiwara Tech</span>
              <span className="text-slate-400 text-xs ml-1.5 hidden md:inline">— Administração Central</span>
            </div>
          </div>

          {/* Breadcrumb / page title */}
          <div className="flex-1 flex items-center gap-2 min-w-0 ml-2">
            <span className="text-slate-400 text-xs hidden sm:block">›</span>
            <span className="text-sm font-medium text-slate-200 truncate">{currentLabel}</span>
          </div>

          {/* Logout */}
          <button onClick={logout}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0">
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      {/* ── Desktop Sidebar (md+, permanent) ── */}
      <aside className="hidden md:flex fixed top-14 left-0 h-[calc(100vh-3.5rem)] w-64 bg-slate-900 text-white flex-col shadow-lg z-20">
        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map(n => (
            <button key={n.id}
              onClick={() => navigate(n.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                view === n.id && !selectedSchoolId
                  ? "bg-white/10 text-white"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}>
              {n.icon}{n.label}
            </button>
          ))}
        </nav>

        {/* Stats mini */}
        {stats && (
          <div className="px-4 py-3 border-t border-white/10 space-y-2">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Colégios</span>
              <span className="text-slate-300 font-semibold">{stats.total_colegios}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Alunos</span>
              <span className="text-slate-300 font-semibold">{fmt(stats.total_alunos)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Dívida total</span>
              <span className="text-slate-300 font-semibold">{fmtCur(stats.divida_total)}</span>
            </div>
          </div>
        )}

        {/* Logout */}
        <div className="p-3 border-t border-white/10">
          <button onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
            <LogOut className="w-4 h-4" /> Terminar sessão
          </button>
        </div>
      </aside>

      {/* ── Mobile Sidebar Drawer ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
            />

            {/* Drawer */}
            <motion.aside
              key="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.22, ease: "easeInOut" }}
              className="fixed top-0 left-0 z-50 h-full w-72 bg-slate-900 text-white flex flex-col shadow-2xl md:hidden"
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-bold text-sm leading-tight">Kiwara Tech</div>
                    <div className="text-xs text-slate-400">Administração Central</div>
                  </div>
                </div>
                <button onClick={() => setSidebarOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Nav */}
              <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                {NAV.map(n => (
                  <button key={n.id}
                    onClick={() => navigate(n.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      view === n.id && !selectedSchoolId
                        ? "bg-white/10 text-white"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    }`}>
                    {n.icon}{n.label}
                  </button>
                ))}
              </nav>

              {/* Stats mini */}
              {stats && (
                <div className="px-4 py-3 border-t border-white/10 space-y-2">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Colégios</span>
                    <span className="text-slate-300 font-semibold">{stats.total_colegios}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Alunos</span>
                    <span className="text-slate-300 font-semibold">{fmt(stats.total_alunos)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Dívida total</span>
                    <span className="text-slate-300 font-semibold">{fmtCur(stats.divida_total)}</span>
                  </div>
                </div>
              )}

              {/* Logout */}
              <div className="p-3 border-t border-white/10">
                <button onClick={logout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
                  <LogOut className="w-4 h-4" /> Terminar sessão
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main Content ── */}
      <main className="w-full md:ml-64">
        {selectedSchoolId ? (
          loadingDetail ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="w-6 h-6 animate-spin text-slate-300" />
            </div>
          ) : schoolDetail ? (
            <ColegioDetail school={schoolDetail} onBack={() => setSelectedSchoolId(null)} />
          ) : null
        ) : (
          <>
            {view === "stats" && <StatsView stats={stats} />}
            {view === "colegios" && (
              <ColegiosView onSelect={id => { setSelectedSchoolId(id); setView("colegios"); }} />
            )}
            {view === "sms" && <AdminSMSView />}
          </>
        )}
      </main>
    </div>
  );
}
