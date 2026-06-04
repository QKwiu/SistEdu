import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import {
  LayoutDashboard, Users, FileText, Settings, LogOut,
  Bell, Search, Plus, TrendingUp, AlertCircle, CheckCircle2,
  Clock, BarChart3, GraduationCap, Banknote, Share2, Copy,
  AlertTriangle, RefreshCw, Trash2, Calendar, BookOpen, X, Menu,
  ChevronDown, ChevronUp, User, School, CreditCard, MoreHorizontal, History,
  UserPlus, FileSpreadsheet, Download, Upload,
  ArrowLeftRight, ShieldCheck, Receipt, Landmark, Filter,
  Paperclip, FileCheck, CalendarDays, MessageSquare, ExternalLink, BadgeCheck,
  Eye, FileImage, Link as LinkIcon, Smartphone, Send, ToggleLeft, ToggleRight,
  ChevronLeft, ChevronRight, ListFilter,
  Megaphone, CheckCheck, XCircle, Info,
  Pencil, Lock, Save, EyeOff, Package, Globe, ShieldOff, BadgePercent, Tag,
  Zap, Printer, Building2, Hash, MessageCircle, ArrowRight, PlayCircle,
  ShoppingCart, Truck, Store,
  Baby, UtensilsCrossed, Image as ImageIcon, Film, Soup,
  LayoutGrid, List,
} from "lucide-react";
import { Button, Card } from "@/components/ui-elements";
import { useAuth } from "@/lib/auth";
import { StudentRegistrationForm } from "@/components/student-form";
import ReportsDashboard from "./ReportsDashboard";
import AccessManagement from "./AccessManagement";

const API = "/api";
const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const TURNOS = ["Manhã","Tarde","Noite"];

/* ─── Interfaces ─── */
interface Turma { id: number; nome: string; ano: string; turno: string; total_alunos: number; }
interface Pacote { id: number; nome: string; valor: number; descricao?: string; itens?: any[]; activo: boolean; }
interface Aluno {
  id: number; nome: string; bilhete?: string; turma_id?: number; turma: string; turno?: string;
  nome_encarregado?: string; telefone_encarregado?: string;
  multa_total?: number;
  data_nascimento?: string; sexo?: string; numero_processo?: string; estado?: string;
  propinas_pendentes: number; divida: number;
  pacote_id?: number | null; pacote_nome?: string | null; pacote_valor?: number | null;
}
interface Propina {
  id: number; student_id: number; aluno_nome: string; turma: string;
  mes: string; ano: string; montante: number; multa: number; status: string;
  data_vencimento: string; ref_numero?: string; ref_valor?: number;
  ref_estado?: string; ref_validade?: string; entidade?: string;
  internal_reference?: string;
  pago_em?: string;
  baixa_manual?: boolean; baixa_manual_por?: string; baixa_manual_em?: string;
  baixa_manual_obs?: string; comprovante_url?: string; data_recebimento?: string;
  transaction_id?: string; metodo_pagamento?: string;
  pagamento_origem?: "manual" | "online";
}
interface GeneratedRef { entidade: string; referencia: string; valor: number; validade: string; total_base?: number; total_multa?: number; total_emolumentos?: number; }
interface EmolItem { key: number; emolumento_id: number | null; emolumento_nome: string; emolumento_tipo: string; student_id: number | null; aluno_nome: string; descricao: string; montante: number; quantidade: number; }

type DashView = "inicio" | "alunos" | "propinas" | "ocorrencias" | "reconciliacao" | "comunicar" | "debito_direto" | "emolumentos" | "relatorios" | "gestao_acessos" | "avaliacoes" | "modulo_infantil" | "caixa" | "partilhar_portal";

/* ─── Store Interfaces ─── */
interface StoreItemDB { id: number; school_id: number; nome: string; descricao?: string; preco: number; stock: number | null; visivel_portal: boolean; ativo: boolean; categoria?: string; }
interface StoreOrderDB { id: number; guardian_nome?: string; student_nome?: string; estado: string; total: number; voucher_code: string; referencia?: string; created_at: string; items: { item_nome: string; quantidade: number; preco_unit: number }[]; }


interface RecPropina {
  id: number; student_id: number; aluno_nome: string; turma: string;
  mes: string; ano: string; montante: number; multa: number; status: string;
  internal_reference?: string; data_vencimento: string; pago_em?: string;
  total_fatura: number; split_escola: number; split_plataforma: number;
  ref_multicaixa?: string; entidade?: string;
  baixa_manual?: boolean; baixa_manual_por?: string; baixa_manual_em?: string;
  baixa_manual_obs?: string; comprovante_url?: string; data_recebimento?: string;
}
interface RecStats {
  pendentes: string; vencidas: string; pagas: string;
  divida_total: string; receita_total: string; receita_escola: string; comissao_plataforma: string;
}
interface FechoCanal {
  canal: string; total_transacoes: number; total_liquidado: number; ultima_transacao?: string;
}
interface FechoTotais {
  total_transacoes: number; total_liquidado: number; manuais: number; automaticos: number;
}
interface FechoData {
  canais: FechoCanal[]; totais: FechoTotais; chart: Record<string, any>[];
  demo_mode: boolean; periodo: string; date_from: string;
}
type PayChannel = "GPO_EMIS" | "DIRECT_DEBIT" | "BANK_TRANSFER" | "POS_TPA" | "CASH" | "";
const CANAL_META: Record<string, { label: string; color: string; bg: string; border: string; icon: string }> = {
  GPO_EMIS:      { label: "GPO / EMIS",       color: "#f97316", bg: "bg-orange-50",  border: "border-orange-200", icon: "🌐" },
  DIRECT_DEBIT:  { label: "Débito Direto",     color: "#3b82f6", bg: "bg-blue-50",    border: "border-blue-200",   icon: "🏦" },
  BANK_TRANSFER: { label: "Transferência",     color: "#8b5cf6", bg: "bg-violet-50",  border: "border-violet-200", icon: "↗️" },
  POS_TPA:       { label: "TPA",               color: "#6366f1", bg: "bg-indigo-50",  border: "border-indigo-200", icon: "💳" },
  CASH:          { label: "Numerário",          color: "#10b981", bg: "bg-emerald-50", border: "border-emerald-200",icon: "💵" },
};

/* ─── Helpers ─── */
function fmt(val: number | string) {
  const n = typeof val === "string" ? parseFloat(val) : val;
  return isNaN(n) ? "0 AOA" : n.toLocaleString("pt-AO") + " AOA";
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("pt-AO", { day: "2-digit", month: "short", year: "numeric" });
}
function lastDayOfMonth(mes: string, ano: string) {
  const mIdx = MESES.findIndex(m => m === mes);
  if (mIdx === -1) return "";
  return new Date(Number(ano), mIdx + 1, 0).toLocaleDateString("pt-AO", { day: "2-digit", month: "short", year: "numeric" });
}
function anoLectivo() {
  const y = new Date().getFullYear();
  return `${y}/${y + 1}`;
}

/* ─── TIPO badge (for occurrences) ─── */
const TIPO_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  "Comportamento Inadequado": { bg:"bg-red-50", text:"text-red-700", border:"border-red-200", dot:"bg-red-500" },
  "Medida Disciplinar":       { bg:"bg-orange-50", text:"text-orange-700", border:"border-orange-200", dot:"bg-orange-500" },
  "Ausência Injustificada":   { bg:"bg-amber-50", text:"text-amber-700", border:"border-amber-200", dot:"bg-amber-500" },
  "Atraso Repetido":          { bg:"bg-yellow-50", text:"text-yellow-700", border:"border-yellow-200", dot:"bg-yellow-500" },
  "Incidente Académico":      { bg:"bg-purple-50", text:"text-purple-700", border:"border-purple-200", dot:"bg-purple-500" },
  "Elogio / Mérito":          { bg:"bg-emerald-50", text:"text-emerald-700", border:"border-emerald-200", dot:"bg-emerald-500" },
  "Comunicação aos Pais":     { bg:"bg-blue-50", text:"text-blue-700", border:"border-blue-200", dot:"bg-blue-500" },
  "Outro":                    { bg:"bg-slate-50", text:"text-slate-700", border:"border-slate-200", dot:"bg-slate-400" },
};
const TIPOS_OC = Object.keys(TIPO_COLORS);

/* ─── Modal wrapper ─── */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"/>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h3 className="font-bold text-slate-900 text-lg">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X className="w-4 h-4"/>
          </button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </motion.div>
    </div>
  );
}

function Field({ label, children, required, hint }: { label: string; children: React.ReactNode; required?: boolean; hint?: string }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}
const inputCls = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white";
const selectCls = inputCls + " appearance-none";

/* ─── Feedback banner ─── */
function Feedback({ error, success }: { error?: string; success?: string }) {
  return (
    <AnimatePresence>
      {error && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0"/>
          <p className="text-red-700 text-sm">{error}</p>
        </motion.div>
      )}
      {success && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 flex items-center gap-2 mb-4">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0"/>
          <p className="text-emerald-800 text-sm font-medium">{success}</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── Modal: Criar Turma ─── */
function ModalCriarTurma({ token, onClose, onCreated }: { token: string; onClose: () => void; onCreated: (t: Turma) => void }) {
  const [form, setForm] = useState({ nome: "", ano: anoLectivo(), turno: "Manhã" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    setSaving(true);
    try {
      const res = await fetch(`${API}/school/turmas`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao criar turma.");
      onCreated({ ...data, total_alunos: 0 });
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit} className="p-6 space-y-4">
      <Field label="Nome da turma" required>
        <input className={inputCls} placeholder="ex: 10ª A, Turma Azul, Pré-Escolar B"
          value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}/>
      </Field>
      <Field label="Ano lectivo" required>
        <input className={inputCls} placeholder="ex: 2025/2026"
          value={form.ano} onChange={e => setForm(f => ({ ...f, ano: e.target.value }))}/>
      </Field>
      <Field label="Turno">
        <select className={selectCls} value={form.turno} onChange={e => setForm(f => ({ ...f, turno: e.target.value }))}>
          {TURNOS.map(t => <option key={t}>{t}</option>)}
        </select>
      </Field>
      <Feedback error={error}/>
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
        <Button type="submit" disabled={saving} className="flex-1">
          {saving ? <><RefreshCw className="w-4 h-4 animate-spin mr-2"/>A criar...</> : "Criar Turma"}
        </Button>
      </div>
    </form>
  );
}

const ANO_LECTIVO_ATUAL = (() => {
  const now = new Date();
  const y = now.getFullYear();
  return now.getMonth() >= 8 ? `${y}/${y+1}` : `${y-1}/${y}`;
})();

/* ─── Modal: Adicionar Aluno ─── */
function ModalAdicionarAluno({ token, turmas, onClose, onCreated }: { token: string; turmas: Turma[]; onClose: () => void; onCreated: (a: Aluno) => void }) {
  const [form, setForm] = useState({
    nome: "", bilhete: "", turma_id: "", nome_encarregado: "", telefone_encarregado: "",
    data_nascimento: "", sexo: "", numero_processo: "", estado: "activo", ano_lectivo: ANO_LECTIVO_ATUAL,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    setSaving(true);
    try {
      const res = await fetch(`${API}/school/alunos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          turma_id: form.turma_id ? Number(form.turma_id) : null,
          data_nascimento: form.data_nascimento || null,
          sexo: form.sexo || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao adicionar aluno.");
      const turma = turmas.find(t => t.id === Number(form.turma_id));
      onCreated({ ...data, turma: turma?.nome ?? "Sem turma", propinas_pendentes: 0, divida: 0 });
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <form onSubmit={submit} className="p-6 space-y-4">
      {/* Dados do aluno */}
      <Field label="Nome completo" required>
        <input className={inputCls} placeholder="Nome do aluno" value={form.nome} onChange={f("nome")}/>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Bilhete de identidade">
          <input className={inputCls} placeholder="ex: 009874321LA041" value={form.bilhete} onChange={f("bilhete")}/>
        </Field>
        <Field label="Número de processo">
          <input className={inputCls} placeholder="ex: PROC-2025-001" value={form.numero_processo} onChange={f("numero_processo")}/>
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Field label="Data de nascimento">
          <input type="date" className={inputCls} value={form.data_nascimento} onChange={f("data_nascimento")}/>
        </Field>
        <Field label="Sexo">
          <select className={selectCls} value={form.sexo} onChange={f("sexo")}>
            <option value="">Não especificado</option>
            <option value="M">Masculino</option>
            <option value="F">Feminino</option>
          </select>
        </Field>
        <Field label="Estado">
          <select className={selectCls} value={form.estado} onChange={f("estado")}>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
            <option value="transferido">Transferido</option>
            <option value="concluido">Concluído</option>
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Turma">
          <select className={selectCls} value={form.turma_id} onChange={f("turma_id")}>
            <option value="">Sem turma</option>
            {turmas.map(t => <option key={t.id} value={t.id}>{t.nome} ({t.turno})</option>)}
          </select>
        </Field>
        <Field label="Ano lectivo">
          <input className={inputCls} placeholder="ex: 2025/2026" value={form.ano_lectivo} onChange={f("ano_lectivo")}/>
        </Field>
      </div>
      {/* Encarregado */}
      <div className="border-t border-slate-100 pt-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Encarregado de educação</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nome">
            <input className={inputCls} placeholder="Nome do encarregado" value={form.nome_encarregado} onChange={f("nome_encarregado")}/>
          </Field>
          <Field label="Telefone">
            <input className={inputCls} placeholder="9xx xxx xxx" value={form.telefone_encarregado} onChange={f("telefone_encarregado")}/>
          </Field>
        </div>
      </div>
      <Feedback error={error}/>
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
        <Button type="submit" disabled={saving} className="flex-1">
          {saving ? <><RefreshCw className="w-4 h-4 animate-spin mr-2"/>A guardar...</> : "Adicionar Aluno"}
        </Button>
      </div>
    </form>
  );
}

/* ─── Modal: Gerar Propina ─── */
function ModalGerarPropina({ token, alunos, onClose, onCreated }: { token: string; alunos: Aluno[]; onClose: () => void; onCreated: () => void }) {
  const anoAtual = String(new Date().getFullYear());
  const [form, setForm] = useState({ student_id: "", ano: anoAtual, montante: "" });
  const [meses, setMeses] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const toggleMes = (m: string) => setMeses(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setSuccess("");
    if (!form.student_id) return setError("Selecione um aluno.");
    if (!meses.length) return setError("Selecione pelo menos um mês.");
    if (!form.montante || isNaN(Number(form.montante))) return setError("Insira o valor mensal.");
    setSaving(true);
    try {
      const res = await fetch(`${API}/school/propinas/gerar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: Number(form.student_id), meses, ano: form.ano, montante: Number(form.montante) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao gerar propinas.");
      setSuccess(`${data.total} propina(s) gerada(s) com sucesso!`);
      setMeses([]);
      setForm(f => ({ ...f, student_id: "" }));
      onCreated();
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit} className="p-6 space-y-4">
      <Field label="Aluno" required>
        <select className={selectCls} value={form.student_id} onChange={e => {
          const sid = e.target.value;
          const aluno = alunos.find(a => String(a.id) === sid);
          setForm(f => ({
            ...f,
            student_id: sid,
            montante: aluno?.pacote_valor ? String(aluno.pacote_valor) : "",
          }));
        }}>
          <option value="">Selecionar aluno...</option>
          {alunos.map(a => <option key={a.id} value={a.id}>{a.nome} — {a.turma}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Ano" required>
          <input className={inputCls} value={form.ano} onChange={e => setForm(f => ({ ...f, ano: e.target.value }))} placeholder="2026"/>
        </Field>
        <Field label="Valor mensal (AOA)" required>
          <input className={inputCls} type="number" min="0" value={form.montante}
            onChange={e => setForm(f => ({ ...f, montante: e.target.value }))}
            placeholder={form.student_id && !form.montante ? "Sem pacote — insira o valor" : "ex: 35000"}/>
        </Field>
      </div>
      <Field label="Meses" required>
        <div className="grid grid-cols-4 gap-1.5 mt-1">
          {MESES.map(m => {
            const sel = meses.includes(m);
            return (
              <button type="button" key={m} onClick={() => toggleMes(m)}
                className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${sel ? "bg-primary text-white border-primary" : "bg-slate-50 text-slate-600 border-slate-200 hover:border-primary/40"}`}>
                {m.slice(0, 3)}
              </button>
            );
          })}
        </div>
        {meses.length > 0 && <p className="text-xs text-primary mt-1.5 font-medium">{meses.length} mês/meses seleccionado(s)</p>}
      </Field>
      <Feedback error={error} success={success}/>
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose} className="flex-1">Fechar</Button>
        <Button type="submit" disabled={saving} className="flex-1">
          {saving ? <><RefreshCw className="w-4 h-4 animate-spin mr-2"/>A gerar...</> : "Gerar Propinas"}
        </Button>
      </div>
    </form>
  );
}

/* ─── Modal: Gerar Propinas em Lote ─── */
function ModalGerarLote({ token, onClose, onCreated }: { token: string; onClose: () => void; onCreated: () => void }) {
  const anoAtual = String(new Date().getFullYear());
  const [modo, setModo] = useState<"unico"|"intervalo">("intervalo");
  const [mesInicio, setMesInicio] = useState("Janeiro");
  const [anoInicio, setAnoInicio] = useState(anoAtual);
  const [mesFim, setMesFim] = useState("Dezembro");
  const [anoFim, setAnoFim] = useState(anoAtual);
  const [fallback, setFallback] = useState("");
  const [autoRef, setAutoRef] = useState(true);
  const [autoSMS, setAutoSMS] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<null | { total_geradas: number; total_skipped: number; total_alunos: number; periodos: number; total_referencias?: number; total_sms?: number; detalhes: any[] }>(null);

  const periodoPreview = (() => {
    const mS = MESES.indexOf(mesInicio);
    const mE = modo === "unico" ? mS : MESES.indexOf(mesFim);
    const yS = Number(anoInicio);
    const yE = modo === "unico" ? yS : Number(anoFim);
    if (mS === -1 || mE === -1 || isNaN(yS) || isNaN(yE)) return 0;
    if (yS > yE || (yS === yE && mS > mE)) return 0;
    return (yE - yS) * 12 + (mE - mS) + 1;
  })();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    setSaving(true);
    try {
      const body: any = {
        mes_inicio: mesInicio, ano_inicio: anoInicio,
        mes_fim: modo === "unico" ? mesInicio : mesFim,
        ano_fim: modo === "unico" ? anoInicio : anoFim,
        auto_referencia: autoRef,
        auto_sms: autoSMS,
      };
      if (fallback && !isNaN(Number(fallback))) body.montante_fallback = Number(fallback);
      const res = await fetch(`${API}/school/propinas/gerar-lote`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao gerar propinas.");
      setResult(data);
      onCreated();
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  if (result) {
    const stats = [
      { label: "Alunos processados", value: result.total_alunos, color: "text-slate-900" },
      { label: "Meses gerados", value: result.periodos, color: "text-slate-900" },
      { label: "Propinas criadas", value: result.total_geradas, color: "text-emerald-700" },
      ...(result.total_referencias != null ? [{ label: "Referências criadas", value: result.total_referencias, color: "text-blue-700" }] : []),
      ...(result.total_sms != null && result.total_sms > 0 ? [{ label: "SMS enviados", value: result.total_sms, color: "text-violet-700" }] : []),
    ];
    return (
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 shrink-0"/>
          <div>
            <p className="font-bold text-emerald-800">Lote gerado com sucesso!</p>
            <p className="text-sm text-emerald-600">{result.total_geradas} propina(s) criada(s) · {result.total_skipped} ignorada(s) (já existentes)</p>
          </div>
        </div>
        <div className={`grid gap-3 ${stats.length > 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-3"}`}>
          {stats.map(s => (
            <div key={s.label} className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
        {result.detalhes.some((d: any) => d.reason === "sem_montante") && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-xs font-semibold text-amber-700 mb-1">Alunos sem valor definido (ignorados):</p>
            <ul className="text-xs text-amber-600 space-y-0.5">
              {result.detalhes.filter((d: any) => d.reason === "sem_montante").map((d: any) => (
                <li key={d.student_id}>• {d.nome}</li>
              ))}
            </ul>
            <p className="text-xs text-amber-600 mt-1.5">Configure um pacote de propinas para estes alunos ou use o valor de fallback.</p>
          </div>
        )}
        <div className="max-h-48 overflow-y-auto space-y-1.5">
          {result.detalhes.filter((d: any) => !d.reason).map((d: any) => (
            <div key={d.student_id} className="flex items-center justify-between text-sm py-1.5 px-3 bg-slate-50 rounded-lg">
              <span className="font-medium text-slate-700">{d.nome}</span>
              <div className="flex items-center gap-2">
                {d.pacote_nome && <span className="text-xs text-slate-400">{d.pacote_nome}</span>}
                <span className="text-xs font-semibold text-emerald-600">{d.criados} × {Number(d.montante).toLocaleString("pt-AO")} AOA</span>
              </div>
            </div>
          ))}
        </div>
        <Button className="w-full" onClick={onClose}>Fechar</Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="p-6 space-y-5">
      {/* Mode toggle */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {(["unico","intervalo"] as const).map(m => (
          <button type="button" key={m} onClick={() => setModo(m)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${modo===m?"bg-white text-slate-900 shadow-sm":"text-slate-500 hover:text-slate-700"}`}>
            {m === "unico" ? "Período único" : "Intervalo de meses"}
          </button>
        ))}
      </div>

      {/* Period selection */}
      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{modo === "unico" ? "Período" : "Início"}</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mês" required>
              <select className={selectCls} value={mesInicio} onChange={e => setMesInicio(e.target.value)}>
                {MESES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Ano" required>
              <input className={inputCls} value={anoInicio} onChange={e => setAnoInicio(e.target.value)} placeholder="2026"/>
            </Field>
          </div>
        </div>
        {modo === "intervalo" && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Fim</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mês" required>
                <select className={selectCls} value={mesFim} onChange={e => setMesFim(e.target.value)}>
                  {MESES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
              <Field label="Ano" required>
                <input className={inputCls} value={anoFim} onChange={e => setAnoFim(e.target.value)} placeholder="2026"/>
              </Field>
            </div>
          </div>
        )}
      </div>

      {/* Fallback amount */}
      <Field label="Valor de fallback (AOA)" hint="Aplicado a alunos sem pacote de propinas definido">
        <input className={inputCls} type="number" min="0" value={fallback}
          onChange={e => setFallback(e.target.value)} placeholder="ex: 25000 (opcional)"/>
      </Field>

      {/* Automações */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Automações</p>
        <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${autoRef?"bg-primary/5 border-primary/30":"bg-slate-50 border-slate-200"}`}>
          <input type="checkbox" checked={autoRef} onChange={e => setAutoRef(e.target.checked)} className="mt-0.5 rounded text-primary"/>
          <div>
            <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5 text-primary"/> Gerar referências Multicaixa</p>
            <p className="text-xs text-slate-500 mt-0.5">Cria uma referência EMIS para cada propina gerada, pronta para pagamento.</p>
          </div>
        </label>
        <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${autoSMS?"bg-emerald-50 border-emerald-200":"bg-slate-50 border-slate-200"}`}>
          <input type="checkbox" checked={autoSMS} onChange={e => setAutoSMS(e.target.checked)} className="mt-0.5 rounded text-primary"/>
          <div>
            <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5 text-emerald-600"/> Notificar encarregados por SMS</p>
            <p className="text-xs text-slate-500 mt-0.5">Envia SMS com o valor e referência a cada encarregado (requer SMS activo nas Configurações).</p>
          </div>
        </label>
      </div>

      {/* Preview */}
      {periodoPreview > 0 && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
          <Calendar className="w-4 h-4 shrink-0"/>
          <span>Serão geradas propinas para <strong>{periodoPreview} mês{periodoPreview>1?"es":""}</strong> para todos os alunos activos{autoRef?" + referências EMIS":""}{autoSMS?" + SMS":""}.
          </span>
        </div>
      )}

      <Feedback error={error} success=""/>
      <div className="flex gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
        <Button type="submit" disabled={saving || periodoPreview === 0} className="flex-1 gap-2">
          {saving ? <><RefreshCw className="w-4 h-4 animate-spin"/>A processar...</> : <><Users className="w-4 h-4"/>Gerar em Lote</>}
        </Button>
      </div>
    </form>
  );
}

/* ─── Modal: Gerar Referência ─── */
function ModalGerarReferencia({ token, propinas, alunos, onClose, onDone }: {
  token: string; propinas: Propina[]; alunos: Aluno[];
  onClose: () => void; onDone: () => void;
}) {
  const [filterAluno, setFilterAluno] = useState("");
  const [filterMes, setFilterMes] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<GeneratedRef | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  // Emolumentos state
  const [emolumentos, setEmolumentos] = useState<any[]>([]);
  const [emolItems, setEmolItems] = useState<EmolItem[]>([]);
  const [showEmolSection, setShowEmolSection] = useState(false);
  const [emolForm, setEmolForm] = useState({ emolumento_id: "", student_id: "", quantidade: "1" });
  const [emolKey, setEmolKey] = useState(0);

  useEffect(() => {
    fetch(`${API}/school/emolumentos`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((data: any[]) => { if (Array.isArray(data)) setEmolumentos(data.filter(e => e.activo !== false)); })
      .catch(() => {});
  }, [token]);

  const pending = propinas.filter(p => p.status === "pendente" || p.status === "vencido");

  const availableMeses = Array.from(
    new Map(pending.map(p => [`${p.ano}-${String(MESES.indexOf(p.mes)).padStart(2,"0")}`, `${p.mes} ${p.ano}`])).entries()
  ).sort((a, b) => a[0].localeCompare(b[0])).map(e => ({ key: e[0], label: e[1] }));

  const filtered = pending
    .filter(p => !filterAluno || String(p.student_id) === filterAluno)
    .filter(p => !filterMes || `${p.ano}-${String(MESES.indexOf(p.mes)).padStart(2,"0")}` === filterMes);

  const toggleId = (id: number) => setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const selectAll = () => setSelectedIds(new Set(filtered.map(p => p.id)));
  const clearAll  = () => setSelectedIds(new Set());
  const allSelected = filtered.length > 0 && filtered.every(p => selectedIds.has(p.id));

  const propinaTotal = [...selectedIds].reduce((sum, id) => {
    const p = pending.find(x => x.id === id);
    return sum + (p ? Number(p.montante) + Number(p.multa) : 0);
  }, 0);

  const emolTotal = emolItems.reduce((s, i) => s + i.montante * i.quantidade, 0);
  const grandTotal = propinaTotal + emolTotal;

  const addEmolItem = () => {
    if (!emolForm.emolumento_id) return;
    const em = emolumentos.find(e => String(e.id) === emolForm.emolumento_id);
    if (!em) return;
    const aluno = alunos.find(a => String(a.id) === emolForm.student_id);
    const qty = Math.max(1, Number(emolForm.quantidade) || 1);
    setEmolItems(prev => [...prev, {
      key: emolKey,
      emolumento_id: em.id,
      emolumento_nome: em.nome,
      emolumento_tipo: em.tipo,
      student_id: aluno?.id ?? null,
      aluno_nome: aluno?.nome ?? "Geral",
      descricao: em.nome,
      montante: Number(em.montante),
      quantidade: qty,
    }]);
    setEmolKey(k => k + 1);
    setEmolForm({ emolumento_id: "", student_id: "", quantidade: "1" });
  };

  const removeEmolItem = (key: number) => setEmolItems(prev => prev.filter(i => i.key !== key));

  const submit = async () => {
    if (!selectedIds.size && !emolItems.length)
      return setError("Selecione pelo menos uma propina ou adicione um emolumento.");
    setError(""); setSaving(true);
    try {
      const res = await fetch(`${API}/school/propinas/referencia`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          propina_ids: [...selectedIds],
          emolumento_items: emolItems.map(i => ({
            emolumento_id: i.emolumento_id,
            student_id: i.student_id,
            descricao: i.descricao,
            montante: i.montante,
            quantidade: i.quantidade,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao gerar referência.");
      setResult(data);
      onDone();
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  /* ── Result screen ── */
  if (result) {
    const hasBreakdown = (result.total_multa ?? 0) > 0 || (result.total_emolumentos ?? 0) > 0;
    return (
      <div className="p-6 space-y-5">
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3"/>
          <p className="font-bold text-emerald-900 text-lg mb-1">Referência Gerada</p>
          <p className="text-emerald-700 text-sm">Multicaixa válida até {fmtDate(result.validade)}</p>
        </div>

        {hasBreakdown && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm space-y-1.5">
            {(result.total_base ?? 0) > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Propinas (base)</span>
                <span className="font-semibold">{fmt(result.total_base ?? 0)} Kz</span>
              </div>
            )}
            {(result.total_multa ?? 0) > 0 && (
              <div className="flex justify-between text-red-600">
                <span className="flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5"/>Multa por atraso</span>
                <span className="font-semibold">+ {fmt(result.total_multa ?? 0)} Kz</span>
              </div>
            )}
            {(result.total_emolumentos ?? 0) > 0 && (
              <div className="flex justify-between text-indigo-600">
                <span className="flex items-center gap-1"><Receipt className="w-3.5 h-3.5"/>Emolumentos</span>
                <span className="font-semibold">+ {fmt(result.total_emolumentos ?? 0)} Kz</span>
              </div>
            )}
            <div className="flex justify-between text-slate-900 font-bold border-t border-slate-200 pt-1.5 mt-1">
              <span>Total da Referência</span>
              <span>{fmt(result.valor)} Kz</span>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {[
            { label: "Entidade",    value: result.entidade },
            { label: "Referência",  value: result.referencia },
            { label: "Valor Total", value: fmt(result.valor) + " Kz" },
            { label: "Válida até",  value: fmtDate(result.validade) },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
              <span className="text-sm text-slate-500">{row.label}</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 font-mono">{row.value}</span>
                <button onClick={() => copy(row.value, row.label)} className="text-slate-300 hover:text-primary transition-colors">
                  {copied === row.label ? <CheckCircle2 className="w-4 h-4 text-emerald-500"/> : <Copy className="w-4 h-4"/>}
                </button>
              </div>
            </div>
          ))}
        </div>
        <Button onClick={onClose} className="w-full">Fechar</Button>
      </div>
    );
  }

  /* ── Selection screen ── */
  return (
    <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">

      {/* ── Section 1: Propinas ── */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <Banknote className="w-3.5 h-3.5"/>Propinas Pendentes
        </p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <select className={selectCls} value={filterAluno}
            onChange={e => { setFilterAluno(e.target.value); setSelectedIds(new Set()); }}>
            <option value="">Todos os alunos</option>
            {alunos.filter(a => pending.some(p => p.student_id === a.id)).map(a => (
              <option key={a.id} value={a.id}>{a.nome}</option>
            ))}
          </select>
          <select className={selectCls} value={filterMes}
            onChange={e => { setFilterMes(e.target.value); setSelectedIds(new Set()); }}>
            <option value="">Todos os meses</option>
            {availableMeses.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </div>

        {pending.length === 0 ? (
          <div className="py-6 text-center bg-slate-50 rounded-xl">
            <CheckCircle2 className="w-8 h-8 text-emerald-300 mx-auto mb-1.5"/>
            <p className="text-slate-500 text-sm font-medium">Sem propinas pendentes</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-slate-400">{filtered.length} propina(s) visível(eis)</p>
              <button type="button" onClick={allSelected ? clearAll : selectAll}
                className="text-xs font-semibold text-primary hover:underline">
                {allSelected ? "Desseleccionar todos" : "Seleccionar todos"}
              </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {filtered.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Nenhuma propina corresponde aos filtros.</p>
              ) : filtered.map(p => {
                const sel = selectedIds.has(p.id);
                return (
                  <button type="button" key={p.id} onClick={() => toggleId(p.id)}
                    className={`w-full text-left rounded-xl border p-3 flex items-center gap-3 transition-all ${sel ? "border-primary bg-primary/5" : "border-slate-200 hover:border-slate-300 bg-white"}`}>
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${sel ? "bg-primary border-primary" : "border-slate-300"}`}>
                      {sel && <CheckCircle2 className="w-3 h-3 text-white"/>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{p.aluno_nome}</p>
                      <p className="text-xs text-slate-500">{p.mes} {p.ano} — {p.turma}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-bold text-slate-900 block">{fmt(Number(p.montante) + Number(p.multa))} Kz</span>
                      {p.status === "vencido" && <span className="text-xs text-red-500 font-medium">Vencida</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Section 2: Emolumentos Adicionais ── */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <button type="button"
          onClick={() => setShowEmolSection(s => !s)}
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5 text-indigo-500"/>
            Emolumentos Adicionais
            {emolItems.length > 0 && (
              <span className="ml-1 bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{emolItems.length}</span>
            )}
          </span>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showEmolSection ? "rotate-180" : ""}`}/>
        </button>

        {showEmolSection && (
          <div className="p-4 space-y-3 bg-white">
            {/* Add emolumento form */}
            <div className="grid grid-cols-1 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Tipo de Emolumento *</label>
                <select value={emolForm.emolumento_id}
                  onChange={e => setEmolForm(f => ({ ...f, emolumento_id: e.target.value }))}
                  className={selectCls}>
                  <option value="">Seleccionar emolumento…</option>
                  {emolumentos.map(em => (
                    <option key={em.id} value={em.id}>
                      {em.nome} — {fmt(Number(em.montante))} Kz {em.is_global ? "(Global)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Aluno (opcional)</label>
                  <select value={emolForm.student_id}
                    onChange={e => setEmolForm(f => ({ ...f, student_id: e.target.value }))}
                    className={selectCls}>
                    <option value="">Geral / Todos</option>
                    {alunos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Quantidade</label>
                  <input type="number" min="1" value={emolForm.quantidade}
                    onChange={e => setEmolForm(f => ({ ...f, quantidade: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
                </div>
              </div>
              <button type="button" onClick={addEmolItem}
                disabled={!emolForm.emolumento_id}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors">
                <Plus className="w-4 h-4"/> Adicionar à Referência
              </button>
            </div>

            {/* Added items list */}
            {emolItems.length > 0 && (
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Itens adicionados</p>
                {emolItems.map(item => (
                  <div key={item.key} className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{item.emolumento_nome}</p>
                      <p className="text-xs text-slate-500">{item.aluno_nome} · {item.quantidade}× · {fmt(item.montante * item.quantidade)} Kz</p>
                    </div>
                    <button type="button" onClick={() => removeEmolItem(item.key)}
                      className="text-slate-400 hover:text-red-500 p-1 transition-colors shrink-0">
                      <X className="w-4 h-4"/>
                    </button>
                  </div>
                ))}
                <div className="flex justify-between items-center text-sm font-bold text-indigo-700 pt-1">
                  <span>Subtotal emolumentos</span>
                  <span>{fmt(emolTotal)} Kz</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Grand total bar ── */}
      {(selectedIds.size > 0 || emolItems.length > 0) && (
        <div className="bg-slate-900 rounded-xl px-4 py-3 space-y-1.5">
          {selectedIds.size > 0 && emolItems.length > 0 && (
            <div className="flex justify-between text-slate-400 text-xs">
              <span>{selectedIds.size} propina(s)</span>
              <span>{fmt(propinaTotal)} Kz</span>
            </div>
          )}
          {emolItems.length > 0 && selectedIds.size > 0 && (
            <div className="flex justify-between text-slate-400 text-xs">
              <span>{emolItems.length} emolumento(s)</span>
              <span>{fmt(emolTotal)} Kz</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-bold text-lg">{fmt(grandTotal)} Kz</p>
              <p className="text-slate-400 text-xs">
                {[selectedIds.size > 0 && `${selectedIds.size} propina(s)`, emolItems.length > 0 && `${emolItems.length} emolumento(s)`].filter(Boolean).join(" + ")}
              </p>
            </div>
            <button onClick={() => { setSelectedIds(new Set()); setEmolItems([]); }}
              className="text-slate-400 hover:text-white p-1"><X className="w-4 h-4"/></button>
          </div>
        </div>
      )}

      {/* Fine notice */}
      {[...selectedIds].some(id => pending.find(p => p.id === id)?.status === "vencido") && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-start gap-2 text-amber-800 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600"/>
          <span>As propinas vencidas incluídas terão a multa por atraso calculada automaticamente e incorporada no total.</span>
        </div>
      )}

      <Feedback error={error}/>
      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
        <Button onClick={submit} disabled={saving || (!selectedIds.size && !emolItems.length)} className="flex-1">
          {saving ? <><RefreshCw className="w-4 h-4 animate-spin mr-2"/>A gerar...</> : "Gerar Referência"}
        </Button>
      </div>
    </div>
  );
}

/* ─── OcorrenciasView ─── */
function OcorrenciasView({ token, schoolName }: { token: string | null; schoolName: string }) {
  const [students, setStudents] = useState<Aluno[]>([]);
  const [ocorrencias, setOcorrencias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filterStudent, setFilterStudent] = useState<number | "">("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    student_id: "" as number | "", tipo: TIPOS_OC[0], descricao: "",
    registado_por: schoolName, data_ocorrencia: new Date().toISOString().slice(0, 10),
  });

  const headers: Record<string, string> = token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    try {
      const [sRes, oRes] = await Promise.all([
        fetch(`${API}/ocorrencias/alunos`, { headers }),
        fetch(`${API}/ocorrencias${filterStudent ? `?student_id=${filterStudent}` : ""}`, { headers }),
      ]);
      if (sRes.ok) setStudents(await sRes.json());
      if (oRes.ok) setOcorrencias(await oRes.json());
    } catch {}
    setLoading(false);
  }, [token, filterStudent]);

  useEffect(() => { load(); }, [load]);

  const filteredStudents = students.filter(s => s.nome.toLowerCase().includes(search.toLowerCase()));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setSuccess("");
    if (!form.student_id) return setError("Selecione um aluno.");
    if (!form.descricao.trim()) return setError("A descrição é obrigatória.");
    if (!token) return setError("Sessão inválida.");
    setSaving(true);
    try {
      const res = await fetch(`${API}/ocorrencias`, { method: "POST", headers, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao registar.");
      setSuccess("Ocorrência registada com sucesso!");
      setForm(f => ({ ...f, student_id: "", descricao: "", tipo: TIPOS_OC[0] }));
      setShowForm(false);
      load();
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!token || !confirm("Tem a certeza?")) return;
    setDeleting(id);
    try { await fetch(`${API}/ocorrencias/${id}`, { method: "DELETE", headers }); setOcorrencias(prev => prev.filter(o => o.id !== id)); } catch {}
    setDeleting(null);
  };

  if (!token) return (
    <div className="p-8 flex-1 flex items-center justify-center">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-amber-500"/>
        </div>
        <h3 className="font-bold text-slate-900 text-lg mb-2">Sessão sem token de API</h3>
        <p className="text-slate-500 text-sm">Por favor, termine a sessão e faça login novamente.</p>
      </div>
    </div>
  );

  return (
    <div className="p-6 lg:p-8 flex-1 overflow-y-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div><h2 className="text-2xl font-bold text-slate-900">Ocorrências</h2><p className="text-slate-500 text-sm mt-0.5">Registe e consulte ocorrências por aluno</p></div>
        <Button onClick={() => setShowForm(true)} className="flex items-center gap-2"><Plus className="w-4 h-4"/> Registar Ocorrência</Button>
      </div>
      <Feedback error={error} success={success}/>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Filtrar por aluno</p>
            <div className="relative mb-3">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar..."
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"/>
            </div>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              <button onClick={() => setFilterStudent("")}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${filterStudent === "" ? "bg-primary/10 text-primary font-semibold" : "hover:bg-slate-50 text-slate-700"}`}>
                Todos ({ocorrencias.length})
              </button>
              {filteredStudents.map(s => {
                const count = ocorrencias.filter(o => o.aluno_nome === s.nome).length;
                return (
                  <button key={s.id} onClick={() => setFilterStudent(s.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${filterStudent === s.id ? "bg-primary/10 text-primary font-semibold" : "hover:bg-slate-50 text-slate-700"}`}>
                    <span className="truncate mr-2">{s.nome}</span>
                    {count > 0 && <span className="shrink-0 text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">{count}</span>}
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
        <div className="lg:col-span-2">
          {loading ? <div className="flex items-center justify-center py-16"><RefreshCw className="w-5 h-5 animate-spin text-primary"/></div>
            : ocorrencias.length === 0 ? (
              <Card className="p-12 text-center"><BookOpen className="w-12 h-12 text-slate-200 mx-auto mb-3"/><p className="font-semibold text-slate-500">Sem ocorrências registadas</p></Card>
            ) : (
              <div className="space-y-3">
                {ocorrencias.map((o, i) => {
                  const c = TIPO_COLORS[o.tipo] ?? TIPO_COLORS["Outro"];
                  return (
                    <motion.div key={o.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                      <Card className="p-5">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${c.bg} ${c.text} ${c.border}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}/>{o.tipo}
                            </span>
                            {o.aluno_nome && <span className="flex items-center gap-1 text-xs text-slate-500"><User className="w-3 h-3"/> {o.aluno_nome}</span>}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="flex items-center gap-1 text-xs text-slate-400"><Calendar className="w-3 h-3"/> {fmtDate(o.data_ocorrencia)}</span>
                            <button onClick={() => handleDelete(o.id)} disabled={deleting === o.id}
                              className="ml-2 p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors">
                              {deleting === o.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin"/> : <Trash2 className="w-3.5 h-3.5"/>}
                            </button>
                          </div>
                        </div>
                        <p className="text-slate-800 text-sm leading-relaxed">{o.descricao}</p>
                        <p className="text-slate-400 text-xs mt-2">Registado por: {o.registado_por}</p>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
        </div>
      </div>
      <AnimatePresence>
        {showForm && (
          <Modal title="Registar Ocorrência" onClose={() => setShowForm(false)}>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <Field label="Aluno" required>
                <select className={selectCls} value={form.student_id} onChange={e => setForm(f => ({ ...f, student_id: Number(e.target.value) || "" }))}>
                  <option value="">Selecionar aluno...</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.nome} — {s.turma}</option>)}
                </select>
              </Field>
              <Field label="Tipo" required>
                <select className={selectCls} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                  {TIPOS_OC.map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Data">
                  <input type="date" className={inputCls} value={form.data_ocorrencia}
                    onChange={e => setForm(f => ({ ...f, data_ocorrencia: e.target.value }))} max={new Date().toISOString().slice(0,10)}/>
                </Field>
                <Field label="Registado por">
                  <input className={inputCls} value={form.registado_por} onChange={e => setForm(f => ({ ...f, registado_por: e.target.value }))}/>
                </Field>
              </div>
              <Field label="Descrição" required>
                <textarea className={inputCls + " resize-none"} rows={4} value={form.descricao}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descreva a ocorrência..."/>
              </Field>
              <Feedback error={error}/>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="flex-1">Cancelar</Button>
                <Button type="submit" disabled={saving} className="flex-1">
                  {saving ? <><RefreshCw className="w-4 h-4 animate-spin mr-2"/>A guardar...</> : "Registar"}
                </Button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Modal: Fatura/Proforma de Propina ─── */
interface FaturaData {
  propina: { id: number; mes: string; ano: string; montante: number; multa: number; desconto: number; status: string; data_vencimento?: string; internal_reference?: string; created_at?: string; pago_em?: string; metodo_pagamento?: string; };
  aluno: { nome: string; numero_processo?: string; turma: string; nome_encarregado?: string; };
  escola: { nome: string; nif?: string; phone?: string; institution_type: string; iban?: string; logo_url?: string; };
  referencia: { entidade: string; numero: string; valor: number; validade?: string } | null;
  descricao: string;
  numero_fatura: string;
}

function ModalFatura({ token, propinaId, onClose }: { token: string; propinaId: number; onClose: () => void }) {
  const [data, setData] = useState<FaturaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`${API}/school/propinas/${propinaId}/fatura`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : r.json().then((e: any) => Promise.reject(e.error)))
      .then(setData)
      .catch((e: any) => setErr(String(e)))
      .finally(() => setLoading(false));
  }, [propinaId, token]);

  const handlePrint = () => window.print();

  if (loading) return (
    <div className="p-12 flex flex-col items-center gap-3 text-slate-400">
      <RefreshCw className="w-6 h-6 animate-spin text-primary"/>
      <p className="text-sm">A carregar fatura…</p>
    </div>
  );
  if (err || !data) return (
    <div className="p-10 text-center text-red-600 text-sm">{err || "Não foi possível carregar a fatura."}</div>
  );

  const { propina, aluno, escola, referencia, descricao, numero_fatura } = data;
  const total = Number(propina.montante) + Number(propina.multa);
  const statusColor = propina.status === "pago" ? "text-emerald-700 bg-emerald-50 border-emerald-200"
    : propina.status === "vencido" ? "text-red-700 bg-red-50 border-red-200"
    : "text-amber-700 bg-amber-50 border-amber-200";
  const statusLabel = propina.status === "pago" ? "Liquidada" : propina.status === "vencido" ? "Vencida" : "Pendente";

  return (
    <div className="p-6 space-y-5 print:p-4">
      {/* Invoice document */}
      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white print:border-0 print:rounded-none">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-6 py-5 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-4 h-4 opacity-70"/>
              <span className="text-xs opacity-70 uppercase tracking-widest">{escola.institution_type}</span>
            </div>
            <h2 className="font-bold text-xl">{escola.nome}</h2>
            {escola.nif && <p className="text-xs opacity-60 mt-0.5">NIF: {escola.nif}</p>}
            {escola.phone && <p className="text-xs opacity-60">{escola.phone}</p>}
          </div>
          <div className="text-right">
            <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${statusColor} mb-2`}>
              {propina.status === "pago" ? <CheckCircle2 className="w-3 h-3"/> : propina.status === "vencido" ? <AlertCircle className="w-3 h-3"/> : <Clock className="w-3 h-3"/>}
              {statusLabel}
            </div>
            <p className="text-slate-300 text-xs font-mono">Fatura Proforma</p>
            <p className="text-white font-bold text-lg font-mono">{numero_fatura}</p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Student + dates row */}
          <div className="grid grid-cols-2 gap-5">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Facturado a</p>
              <p className="font-bold text-slate-900">{aluno.nome}</p>
              {aluno.numero_processo && (
                <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><Hash className="w-3 h-3"/> Proc: {aluno.numero_processo}</p>
              )}
              <p className="text-xs text-slate-500 mt-0.5">Turma: {aluno.turma}</p>
              {aluno.nome_encarregado && <p className="text-xs text-slate-400 mt-1">Enc: {aluno.nome_encarregado}</p>}
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Datas</p>
              {propina.created_at && (
                <p className="text-xs text-slate-600">Emissão: <span className="font-medium">{new Date(propina.created_at).toLocaleDateString("pt-AO")}</span></p>
              )}
              {propina.data_vencimento && (
                <p className="text-xs text-slate-600">Vencimento: <span className="font-medium">{new Date(propina.data_vencimento).toLocaleDateString("pt-AO")}</span></p>
              )}
              {propina.pago_em && (
                <p className="text-xs text-emerald-600">Pago em: <span className="font-medium">{new Date(propina.pago_em).toLocaleDateString("pt-AO")}</span></p>
              )}
            </div>
          </div>

          {/* Line items */}
          <div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-y border-slate-100">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Descrição</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Valor</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-50">
                  <td className="px-3 py-2.5 text-slate-800 font-medium">{descricao}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-800">{Number(propina.montante).toLocaleString("pt-AO")} Kz</td>
                </tr>
                {Number(propina.desconto) > 0 && (
                  <tr className="border-b border-slate-50">
                    <td className="px-3 py-2.5 text-emerald-700 text-xs">Desconto (bolsa de estudo)</td>
                    <td className="px-3 py-2.5 text-right font-mono text-emerald-700 text-sm">−{Number(propina.desconto).toLocaleString("pt-AO")} Kz</td>
                  </tr>
                )}
                {Number(propina.multa) > 0 && (
                  <tr className="border-b border-slate-50">
                    <td className="px-3 py-2.5 text-red-700 text-xs">Multa por atraso</td>
                    <td className="px-3 py-2.5 text-right font-mono text-red-700 text-sm">+{Number(propina.multa).toLocaleString("pt-AO")} Kz</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 text-white">
                  <td className="px-3 py-3 font-bold text-sm">Total a pagar</td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-base">{total.toLocaleString("pt-AO")} Kz</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Payment reference */}
          {referencia ? (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5"/> Referência de Pagamento (Multicaixa / ATM)
              </p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xs text-blue-600 font-medium">Entidade</p>
                  <p className="font-mono font-bold text-blue-900 text-lg">{referencia.entidade}</p>
                </div>
                <div>
                  <p className="text-xs text-blue-600 font-medium">Referência</p>
                  <p className="font-mono font-bold text-blue-900 text-lg">{referencia.numero}</p>
                </div>
                <div>
                  <p className="text-xs text-blue-600 font-medium">Montante</p>
                  <p className="font-mono font-bold text-blue-900 text-lg">{Number(referencia.valor).toLocaleString("pt-AO")} Kz</p>
                </div>
              </div>
              {referencia.validade && (
                <p className="text-xs text-blue-600 mt-2 text-center">Válido até: {new Date(referencia.validade).toLocaleDateString("pt-AO")}</p>
              )}
            </div>
          ) : propina.internal_reference && propina.status !== "pago" ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-3">
              <Hash className="w-4 h-4 text-slate-400 shrink-0"/>
              <div>
                <p className="text-xs font-semibold text-slate-600">Referência interna</p>
                <p className="font-mono text-xs text-slate-500">{propina.internal_reference}</p>
                <p className="text-xs text-slate-400 mt-0.5">Gere uma referência bancária para pagamento via Multicaixa.</p>
              </div>
            </div>
          ) : null}

          {/* IBAN for bank transfer */}
          {escola.iban && (
            <div className="text-xs text-slate-500 text-center border-t border-slate-100 pt-3">
              Transferência bancária: IBAN <span className="font-mono font-semibold text-slate-700">{escola.iban}</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 print:hidden">
        <Button variant="outline" onClick={onClose} className="flex-1">Fechar</Button>
        <Button onClick={handlePrint} className="flex-1 gap-2">
          <Printer className="w-4 h-4"/> Imprimir / PDF
        </Button>
      </div>
    </div>
  );
}

/* ─── Views ─── */
function InicioView({ token, alunos, propinas, turmas, onOpenCriarTurma, onOpenAdicionarAluno, onOpenGerarPropina, onOpenGerarRef, onOpenGerarLote, schoolId, schoolName }: {
  token: string | null; alunos: Aluno[]; propinas: Propina[]; turmas: Turma[];
  onOpenCriarTurma: () => void; onOpenAdicionarAluno: () => void;
  onOpenGerarPropina: () => void; onOpenGerarRef: () => void; onOpenGerarLote: () => void;
  schoolId: string; schoolName: string;
}) {
  const { session: iSession } = useAuth();
  const portalNomInicio = iSession?.portalNomenclatura ?? "encarregado";
  const portalLabelInicio = portalNomInicio === "aluno" ? "Portal do Aluno" : "Portal do Encarregado";
  const totalDivida = alunos.reduce((s, a) => s + Number(a.divida), 0);
  const propPendentes = propinas.filter(p => p.status === "pendente").length;
  const pago = propinas.filter(p => p.status === "pago").reduce((s, p) => s + Number(p.montante), 0);
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}${import.meta.env.BASE_URL}encarregado?escola=${schoolId}`;
  const copy = () => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const isEmpty = alunos.length === 0 && turmas.length === 0;

  return (
    <div className="p-6 lg:p-8 flex-1 overflow-y-auto">
      {isEmpty ? (
        /* Onboarding */
        <>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-primary to-accent rounded-3xl p-8 text-white mb-8 relative overflow-hidden">
            <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-10"><GraduationCap className="w-40 h-40"/></div>
            <div className="relative">
              <div className="flex items-center gap-2 text-white/70 text-sm font-medium mb-3">
                <CheckCircle2 className="w-4 h-4"/> Conta criada com sucesso
              </div>
              <h2 className="text-3xl font-display font-extrabold mb-2">Bem-vindo, {schoolName}!</h2>
              <p className="text-white/80">Configure o seu colégio seguindo os passos abaixo.</p>
            </div>
          </motion.div>
          <div className="grid sm:grid-cols-3 gap-5 mb-8">
            {[
              { icon: <School className="w-6 h-6 text-primary"/>, title: "Criar turmas", desc: "Organize os alunos por turmas e turnos.", action: "Criar Turma", onClick: onOpenCriarTurma },
              { icon: <Users className="w-6 h-6 text-primary"/>, title: "Adicionar alunos", desc: "Registe os alunos e associe-os a turmas.", action: "Adicionar Aluno", onClick: onOpenAdicionarAluno },
              { icon: <Banknote className="w-6 h-6 text-primary"/>, title: "Gerar propinas", desc: "Gere propinas e crie referências Multicaixa.", action: "Gerar Referência", onClick: onOpenGerarPropina },
            ].map((step, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.1 }}>
                <Card className="p-6 h-full flex flex-col hover:border-primary/30 transition-colors group"><div className="cursor-pointer" onClick={step.onClick}>
                  <div className="w-12 h-12 rounded-xl bg-primary/8 flex items-center justify-center mb-5 group-hover:bg-primary/15 transition-colors">{step.icon}</div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-400 mb-2">Passo {i + 1}</p>
                    <h4 className="font-bold text-slate-900 mb-2">{step.title}</h4>
                    <p className="text-sm text-slate-500 leading-relaxed mb-5">{step.desc}</p>
                  </div>
                  </div>
                  <Button size="sm" onClick={step.onClick} className="w-full mt-auto">{step.action}</Button>
                </Card>
              </motion.div>
            ))}
          </div>
        </>
      ) : (
        /* Populated */
        <>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Início</h2>
              <p className="text-slate-500 text-sm">Resumo geral do colégio</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" className="bg-white gap-2" onClick={onOpenGerarPropina}><FileText className="w-4 h-4"/> Gerar Propina</Button>
              <Button variant="outline" size="sm" className="bg-white gap-2" onClick={onOpenGerarLote}><Users className="w-4 h-4"/> Gerar em Lote</Button>
              <Button size="sm" className="gap-2" onClick={onOpenGerarRef}><CreditCard className="w-4 h-4"/> Gerar Referência</Button>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-5 mb-8">
            {[
              { label: "Total de Alunos", value: alunos.length, sub: `${turmas.length} turma(s)`, icon: <Users className="text-blue-500"/>, bg: "bg-blue-50" },
              { label: "Propinas Pendentes", value: propPendentes, sub: `${fmt(totalDivida)} em dívida`, icon: <AlertCircle className="text-amber-500"/>, bg: "bg-amber-50" },
              { label: "Total Recebido", value: fmt(pago), sub: `${propinas.filter(p=>p.status==="pago").length} propinas pagas`, icon: <TrendingUp className="text-emerald-500"/>, bg: "bg-emerald-50" },
            ].map((stat, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                <Card className="p-6 flex items-start gap-4">
                  <div className={`p-4 rounded-xl ${stat.bg}`}>{stat.icon}</div>
                  <div><p className="text-sm font-medium text-slate-500 mb-1">{stat.label}</p>
                    <h3 className="text-2xl font-bold text-slate-900 mb-0.5">{stat.value}</h3>
                    <p className="text-xs text-slate-400">{stat.sub}</p>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
          {propinas.length > 0 && (
            <Card className="p-0 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-900">Propinas recentes</h3>
                <Button size="sm" variant="outline" onClick={onOpenGerarRef} className="gap-2 bg-white"><CreditCard className="w-4 h-4"/> Gerar Referência</Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase border-b border-slate-100">
                    <tr><th className="px-5 py-3">Aluno</th><th className="px-5 py-3">Turma</th><th className="px-5 py-3">Mês/Ano</th><th className="px-5 py-3">Valor</th><th className="px-5 py-3">Estado</th><th className="px-5 py-3">Referência</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {propinas.slice(0,8).map((p, i) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="px-5 py-3 font-medium text-slate-900">{p.aluno_nome}</td>
                        <td className="px-5 py-3 text-slate-500">{p.turma}</td>
                        <td className="px-5 py-3 text-slate-600">{p.mes} {p.ano}</td>
                        <td className="px-5 py-3 font-medium">{fmt(Number(p.montante)+Number(p.multa))}</td>
                        <td className="px-5 py-3">
                          {p.status === "pago"
                            ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle2 className="w-3 h-3"/> Pago</span>
                            : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200"><Clock className="w-3 h-3"/> Pendente</span>
                          }
                        </td>
                        <td className="px-5 py-3 font-mono text-xs text-slate-500">{p.ref_numero ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
      {/* Guardian portal card */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-8">
        <Card className="p-6 border-primary/20 bg-gradient-to-r from-primary/3 to-accent/3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 shadow-md shadow-primary/20">
              <GraduationCap className="w-6 h-6 text-white"/>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-slate-900 mb-1">{portalLabelInicio}</h4>
              <p className="text-sm text-slate-500 mb-3">Partilhe este link com os utilizadores do portal.</p>
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 max-w-sm">
                <span className="text-xs text-slate-500 font-mono truncate flex-1">{link}</span>
                <button onClick={copy} className="shrink-0 text-primary hover:text-primary/70 transition-colors">
                  {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500"/> : <Copy className="w-4 h-4"/>}
                </button>
              </div>
            </div>
            <Link href="/encarregado"><Button variant="outline" size="sm" className="shrink-0 bg-white gap-2"><Share2 className="w-4 h-4"/> Ver Portal</Button></Link>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

/* ─── School: Add Single Student Panel ─── */
function SchoolAddAlunoPanel({ token, turmas, onSuccess, onCreateTurma }: {
  token: string | null; turmas: Turma[]; onSuccess: () => void; onCreateTurma?: () => void;
}) {
  const anoLectivo = `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;
  const [nextNumeroProcesso, setNextNumeroProcesso] = useState<string | undefined>(undefined);
  const [schoolUsaPacotes, setSchoolUsaPacotes] = useState(false);
  const [schoolModuloInfantil, setSchoolModuloInfantil] = useState(false);
  const [schoolPacotes, setSchoolPacotes] = useState<import("../components/student-form").FormPacote[]>([]);
  const [schoolEmolumentos, setSchoolEmolumentos] = useState<import("../components/student-form").FormEmolumento[]>([]);

  const fetchNext = useCallback(() => {
    if (!token) return;
    fetch(`${API}/school/alunos/next-numero-processo`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.next) setNextNumeroProcesso(d.next); })
      .catch(() => {});
  }, [token]);

  useEffect(() => { fetchNext(); }, [fetchNext]);

  useEffect(() => {
    if (!token) return;
    const hdrs = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${API}/school/profile`, { headers: hdrs }).then(r => r.ok ? r.json() : { usa_pacotes: false }),
      fetch(`${API}/school/pacotes`, { headers: hdrs }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/school/emolumentos`, { headers: hdrs }).then(r => r.ok ? r.json() : []),
    ]).then(([prof, pkts, ems]: [any, any[], any[]]) => {
      const active = pkts.filter((p: any) => p.activo);
      setSchoolUsaPacotes(prof.usa_pacotes === true);
      fetch(`${API}/school/infant/status`, { headers: hdrs })
        .then(r => r.ok ? r.json() : { modulo_infantil: false })
        .then(d => setSchoolModuloInfantil(d.modulo_infantil === true))
        .catch(() => {});
      setSchoolPacotes(active);
      setSchoolEmolumentos((ems as any[]).filter(e => !e.is_global && e.tipo === "propina"));
    }).catch(() => {});
  }, [token]);

  const handleSubmit = async (fd: FormData) => {
    const r = await fetch(`${API}/school/alunos`, {
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
      usaPacotes={schoolUsaPacotes}
      pacotes={schoolPacotes}
      emolumentos={schoolEmolumentos}
      nextNumeroProcesso={nextNumeroProcesso}
      onSubmitForm={handleSubmit}
      onCreateTurma={onCreateTurma}
      onRegisterSuccess={fetchNext}
    />
  );
}

/* ─── School: CSV Bulk Import Panel ─── */
type SchoolCSVRow = {
  nome: string; bilhete: string; numero_processo: string;
  data_nascimento: string; sexo: string;
  turma_nome: string; turno: string;
  nome_encarregado: string; telefone_encarregado: string;
  pacote_nome: string;
};
const SCHOOL_EMPTY_ROW = (): SchoolCSVRow => ({
  nome: "", bilhete: "", numero_processo: "", data_nascimento: "",
  sexo: "M", turma_nome: "", turno: "Manhã",
  nome_encarregado: "", telefone_encarregado: "", pacote_nome: "",
});
const SCHOOL_CSV_HEADERS = ["nome","bilhete","numero_processo","data_nascimento","sexo","turma_nome","turno","nome_encarregado","telefone_encarregado","pacote_nome"];

function SchoolUploadAlunosPanel({ token, onSuccess }: {
  token: string | null; onSuccess: () => void;
}) {
  const anoLectivo = new Date().getFullYear() + "/" + (new Date().getFullYear() + 1);
  const [mode, setMode] = useState<"manual"|"file">("manual");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ inserted: number; skipped: number; total: number; errors: string[]; encarregados_criados?: number } | null>(null);
  const [error, setError] = useState("");

  const [rows, setRows] = useState<SchoolCSVRow[]>([SCHOOL_EMPTY_ROW()]);
  const updateRow = (i: number, field: keyof SchoolCSVRow, val: string) =>
    setRows(r => r.map((x, idx) => idx === i ? { ...x, [field]: val } : x));
  const addRow = () => setRows(r => [...r, SCHOOL_EMPTY_ROW()]);
  const removeRow = (i: number) => setRows(r => r.filter((_, idx) => idx !== i));
  const validRows = rows.filter(r => r.nome.trim());

  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<SchoolCSVRow[]>([]);
  const [fileName, setFileName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function parseCSV(text: string): SchoolCSVRow[] {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/[^a-z_]/g, ""));
    return lines.slice(1).map(line => {
      const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
      const obj: any = { ...SCHOOL_EMPTY_ROW() };
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
    const header = SCHOOL_CSV_HEADERS.join(",");
    const example = "João Manuel Silva,009874321LA041,PROC-2025-001,2009-05-15,M,10ª Classe A,Manhã,António Silva,924000001,";
    const blob = new Blob([header + "\n" + example], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "modelo_alunos.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = async (alunos: SchoolCSVRow[]) => {
    if (!alunos.length) return;
    setUploading(true); setResult(null); setError("");
    try {
      const r = await fetch(`${API}/school/alunos/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ alunos, ano_lectivo: anoLectivo }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Erro no carregamento.");
      setResult(data);
      if (mode === "manual") setRows([SCHOOL_EMPTY_ROW()]);
      if (mode === "file") { setPreview([]); setFileName(""); }
      onSuccess();
    } catch (err: any) { setError(err.message); }
    finally { setUploading(false); }
  };

  const cellCls = "bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 w-full";
  const selCls  = `${cellCls} cursor-pointer`;

  return (
    <div className="space-y-5">
      {/* Mode toggle */}
      <div className="flex gap-2">
        <button onClick={() => { setMode("manual"); setPreview([]); setFileName(""); setResult(null); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${mode==="manual"?"bg-primary text-white border-primary":"bg-white text-slate-600 border-slate-200 hover:border-primary/50"}`}>
          <UserPlus className="w-4 h-4"/> Inserção manual
        </button>
        <button onClick={() => { setMode("file"); setRows([SCHOOL_EMPTY_ROW()]); setResult(null); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${mode==="file"?"bg-primary text-white border-primary":"bg-white text-slate-600 border-slate-200 hover:border-primary/50"}`}>
          <FileSpreadsheet className="w-4 h-4"/> Carregar ficheiro CSV
        </button>
        <button onClick={downloadTemplate}
          className="ml-auto flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 text-slate-500 hover:bg-slate-50">
          <Download className="w-3.5 h-3.5"/> Descarregar modelo CSV
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0"/>{error}
        </div>
      )}
      {result && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${result.errors.length ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-emerald-50 border-emerald-200 text-emerald-800"}`}>
          <p className="font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4"/> Importação concluída
          </p>
          <p className="mt-1">{result.inserted} aluno(s) inserido(s) · {result.skipped} ignorado(s) de {result.total}
            {result.encarregados_criados ? ` · ${result.encarregados_criados} encarregado(s) criado(s)` : ""}
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 text-xs space-y-0.5 list-disc list-inside">
              {result.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
              {result.errors.length > 5 && <li>…e mais {result.errors.length - 5} erro(s)</li>}
            </ul>
          )}
        </div>
      )}

      {/* Manual table */}
      {mode === "manual" && (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-xs border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wide">
                {["Nome *","BI","Nº Processo","Nascimento","Sexo","Turma","Turno","Encarregado","Telefone",""].map((h, i) => (
                  <th key={i} className="px-2.5 py-2.5 text-left font-semibold border-b border-slate-200 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50/50">
                  <td className="px-2 py-1.5 min-w-[160px]"><input className={cellCls} placeholder="Nome completo" value={row.nome} onChange={e => updateRow(i,"nome",e.target.value)}/></td>
                  <td className="px-2 py-1.5 min-w-[120px]"><input className={cellCls} placeholder="BI" value={row.bilhete} onChange={e => updateRow(i,"bilhete",e.target.value)}/></td>
                  <td className="px-2 py-1.5 min-w-[110px]"><input className={cellCls} placeholder="Processo" value={row.numero_processo} onChange={e => updateRow(i,"numero_processo",e.target.value)}/></td>
                  <td className="px-2 py-1.5 min-w-[120px]"><input type="date" className={cellCls} value={row.data_nascimento} onChange={e => updateRow(i,"data_nascimento",e.target.value)}/></td>
                  <td className="px-2 py-1.5 min-w-[80px]">
                    <select className={selCls} value={row.sexo} onChange={e => updateRow(i,"sexo",e.target.value)}>
                      <option value="M">M</option><option value="F">F</option>
                    </select>
                  </td>
                  <td className="px-2 py-1.5 min-w-[120px]"><input className={cellCls} placeholder="ex: 9ª A" value={row.turma_nome} onChange={e => updateRow(i,"turma_nome",e.target.value)}/></td>
                  <td className="px-2 py-1.5 min-w-[90px]">
                    <select className={selCls} value={row.turno} onChange={e => updateRow(i,"turno",e.target.value)}>
                      <option>Manhã</option><option>Tarde</option><option>Noite</option>
                    </select>
                  </td>
                  <td className="px-2 py-1.5 min-w-[140px]"><input className={cellCls} placeholder="Encarregado" value={row.nome_encarregado} onChange={e => updateRow(i,"nome_encarregado",e.target.value)}/></td>
                  <td className="px-2 py-1.5 min-w-[110px]"><input className={cellCls} placeholder="9XX XXX XXX" value={row.telefone_encarregado} onChange={e => updateRow(i,"telefone_encarregado",e.target.value)}/></td>
                  <td className="px-2 py-1.5">
                    {rows.length > 1 && <button onClick={() => removeRow(i)} className="text-slate-300 hover:text-red-500 transition-colors"><X className="w-4 h-4"/></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2 border-t border-slate-200 flex items-center justify-between">
            <button onClick={addRow} className="flex items-center gap-1.5 text-xs text-primary font-medium hover:underline">
              <Plus className="w-3.5 h-3.5"/> Adicionar linha
            </button>
            <span className="text-xs text-slate-400">{validRows.length} aluno(s) válido(s)</span>
          </div>
        </div>
      )}

      {/* File drop zone */}
      {mode === "file" && (
        <div>
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${dragging ? "border-primary bg-primary/5" : "border-slate-200 hover:border-primary/40"}`}>
            <Upload className="w-8 h-8 text-slate-300 mx-auto mb-3"/>
            <p className="font-medium text-slate-600">Arraste o ficheiro CSV aqui</p>
            <p className="text-sm text-slate-400 mt-1">ou clique para seleccionar</p>
            {fileName && <p className="mt-2 text-sm font-medium text-primary">{fileName} — {preview.length} aluno(s) encontrado(s)</p>}
            <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>
          {preview.length > 0 && (
            <div className="mt-3 rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Pré-visualização ({preview.length} registos)</p>
              </div>
              <div className="overflow-x-auto max-h-52">
                <table className="w-full text-xs min-w-[600px]">
                  <thead><tr className="text-slate-400 uppercase text-[10px]">{["Nome","BI","Turma","Turno","Encarregado","Tel."].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.slice(0, 8).map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-3 py-1.5 font-medium">{r.nome}</td>
                        <td className="px-3 py-1.5 text-slate-500">{r.bilhete || "—"}</td>
                        <td className="px-3 py-1.5">{r.turma_nome || "—"}</td>
                        <td className="px-3 py-1.5">{r.turno}</td>
                        <td className="px-3 py-1.5">{r.nome_encarregado || "—"}</td>
                        <td className="px-3 py-1.5">{r.telefone_encarregado || "—"}</td>
                      </tr>
                    ))}
                    {preview.length > 8 && <tr><td colSpan={6} className="px-3 py-2 text-slate-400 text-center">…e mais {preview.length - 8} registo(s)</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end border-t border-slate-100 pt-4">
        <Button
          disabled={uploading || (mode === "manual" ? validRows.length === 0 : preview.length === 0)}
          onClick={() => doImport(mode === "manual" ? validRows : preview)}
          className="gap-2">
          {uploading ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Upload className="w-4 h-4"/>}
          {uploading ? "A importar…" : `Importar ${mode === "manual" ? validRows.length : preview.length} aluno(s)`}
        </Button>
      </div>
    </div>
  );
}

/* ─── Bolsas interfaces ─── */
interface BolsaTipo {
  id: number; nome: string; descricao?: string;
  tipo_desconto: 'percentagem' | 'fixo'; valor: number;
  abrangencia: 'propina' | 'tudo'; activo: boolean; total_activos: number;
}
interface BolsaAtribuicao {
  id: number; student_id: number; aluno_nome?: string; turma?: string;
  bolsa_tipo_id: number; bolsa_nome: string;
  tipo_desconto: 'percentagem' | 'fixo'; bolsa_valor: number;
  abrangencia: 'propina' | 'tudo'; bolsa_descricao?: string;
  data_inicio: string; data_fim?: string;
  estado: 'activa' | 'revogada' | 'expirada'; notas?: string;
}

/* ─── AlunoFichaSlideOver (portal da escola) ─── */
interface FichaPropina { id: number; mes: string; ano: string; montante: number; multa: number; status: string; desconto?: number; }
interface AlunoFichaData {
  id: number; nome: string; bilhete?: string; numero_processo?: string;
  data_nascimento?: string; sexo?: string; estado?: string;
  turma_id?: number | null; turma_nome?: string; turno?: string;
  nome_encarregado?: string; telefone_encarregado?: string;
  encarregado?: { id: number; nome: string; telefone: string; email?: string; first_login: boolean } | null;
  turmas?: { id: number; nome: string; turno?: string }[];
  pacote_id?: number | null;
  emolumento_propina_id?: number | null;
  school_usa_pacotes?: boolean;
}

function AlunoFichaSlideOver({
  token, alunoId, onClose, onSaved,
}: { token: string | null; alunoId: number; onClose: () => void; onSaved?: (patch: Partial<Aluno>) => void }) {
  const [ficha, setFicha] = useState<AlunoFichaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  const [nome, setNome] = useState("");
  const [bilhete, setBilhete] = useState("");
  const [numProcesso, setNumProcesso] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [sexo, setSexo] = useState("");
  const [estado, setEstado] = useState("activo");
  const [turmaId, setTurmaId] = useState<number | "">(""); 
  const [nomeEnc, setNomeEnc] = useState("");
  const [telEnc, setTelEnc] = useState("");
  const [emailEnc, setEmailEnc] = useState("");
  const [novaPassword, setNovaPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  const [pacoteId, setPacoteId] = useState<number | "">("");
  const [emolumentoPropinaId, setEmolumentoPropinaId] = useState<number | "">("");
  const [fichaPackets, setFichaPackets] = useState<Pacote[]>([]);
  const [fichaEmolumentos, setFichaEmolumentos] = useState<Emolumento[]>([]);

  const [fichaPropinaList, setFichaPropinaList] = useState<FichaPropina[]>([]);
  const [showGerarForm, setShowGerarForm] = useState(false);
  const [gerarAno, setGerarAno] = useState(String(new Date().getFullYear()));
  const [gerarMontante, setGerarMontante] = useState("");
  const [gerarMeses, setGerarMeses] = useState<string[]>([]);
  const [gerarSaving, setGerarSaving] = useState(false);
  const [gerarError, setGerarError] = useState("");
  const [gerarSuccess, setGerarSuccess] = useState("");

  // Bolsa de estudo state
  const [bolsaHistory, setBolsaHistory] = useState<BolsaAtribuicao[]>([]);
  const [bolsaTipos, setBolsaTipos] = useState<BolsaTipo[]>([]);
  const [showBolsaForm, setShowBolsaForm] = useState(false);
  const [bolsaAtribTipo, setBolsaAtribTipo] = useState("");
  const [bolsaAtribInicio, setBolsaAtribInicio] = useState(new Date().toISOString().slice(0, 10));
  const [bolsaAtribFim, setBolsaAtribFim] = useState("");
  const [bolsaAtribNotas, setBolsaAtribNotas] = useState("");
  const [bolsaSaving, setBolsaSaving] = useState(false);
  const [bolsaError, setBolsaError] = useState("");

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const inp = "border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 w-full";

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/school/alunos/${alunoId}`, { headers }).then(r => r.json()),
      fetch(`${API}/school/pacotes`, { headers }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/school/emolumentos`, { headers }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/school/propinas?student_id=${alunoId}`, { headers }).then(r => r.ok ? r.json() : []),
    fetch(`${API}/school/alunos/${alunoId}/bolsa`, { headers }).then(r => r.ok ? r.json() : []),
    fetch(`${API}/school/bolsas/tipos`, { headers }).then(r => r.ok ? r.json() : []),
    ]).then(([d, pkts, ems, props, bolsas, tipos]: [AlunoFichaData, Pacote[], Emolumento[], FichaPropina[], BolsaAtribuicao[], BolsaTipo[]]) => {
      setFicha(d);
      setNome(d.nome || "");
      setBilhete(d.bilhete || "");
      setNumProcesso(d.numero_processo || "");
      setDataNascimento(d.data_nascimento?.slice(0, 10) || "");
      setSexo(d.sexo || "");
      setEstado(d.estado || "activo");
      setTurmaId(d.turma_id ?? "");
      setNomeEnc(d.encarregado?.nome || d.nome_encarregado || "");
      setTelEnc(d.encarregado?.telefone || d.telefone_encarregado || "");
      setEmailEnc(d.encarregado?.email || "");
      setPacoteId(d.pacote_id ?? "");
      setEmolumentoPropinaId(d.emolumento_propina_id ?? "");
      const activePkts = (pkts as Pacote[]).filter(p => p.activo);
      const localEms = (ems as Emolumento[]).filter(e => !e.is_global);
      setFichaPackets(activePkts);
      setFichaEmolumentos(localEms);
      setFichaPropinaList(props as FichaPropina[]);
      setBolsaHistory(bolsas as BolsaAtribuicao[]);
      setBolsaTipos((tipos as BolsaTipo[]).filter(t => t.activo));
      // Default amount: pacote value → assigned emolumento → first propina emolumento → blank
      const selectedPacote = activePkts.find(p => p.id === d.pacote_id);
      if (selectedPacote) {
        setGerarMontante(String(selectedPacote.valor));
      } else {
        const assignedEm = localEms.find(e => e.id === d.emolumento_propina_id);
        const propinaEm = assignedEm ?? localEms.find(e => e.tipo === "propina");
        if (propinaEm) setGerarMontante(String(propinaEm.montante));
      }
    }).finally(() => setLoading(false));
  }, [alunoId]);

  useEffect(() => {
    if (pacoteId !== "") {
      const p = fichaPackets.find(pk => pk.id === pacoteId);
      if (p) setGerarMontante(String(p.valor));
    }
  }, [pacoteId, fichaPackets]);

  useEffect(() => {
    if (fichaPackets.length === 0 && emolumentoPropinaId !== "") {
      const em = fichaEmolumentos.find(e => e.id === emolumentoPropinaId);
      if (em) setGerarMontante(String(em.montante));
    }
  }, [emolumentoPropinaId, fichaEmolumentos, fichaPackets]);

  const save = async () => {
    if (!nome.trim()) { setErr("Nome do aluno é obrigatório."); return; }
    setSaving(true); setErr(""); setSaved(false);
    try {
      const r = await fetch(`${API}/school/alunos/${alunoId}`, {
        method: "PUT", headers,
        body: JSON.stringify({
          nome: nome.trim(), bilhete: bilhete.trim(), numero_processo: numProcesso.trim(),
          data_nascimento: dataNascimento || null, sexo: sexo || null, estado,
          turma_id: turmaId || null,
          nome_encarregado: nomeEnc.trim(), telefone_encarregado: telEnc.trim(),
          encarregado_email: emailEnc.trim() || null,
          nova_password: novaPassword.trim() || null,
          emolumento_propina_id: emolumentoPropinaId || null,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Erro ao guardar.");

      const newPacoteId = pacoteId === "" ? null : pacoteId;
      if (newPacoteId !== (ficha?.pacote_id ?? null)) {
        await fetch(`${API}/school/alunos/${alunoId}/pacote`, {
          method: "PUT", headers,
          body: JSON.stringify({ pacote_id: newPacoteId }),
        });
      }

      setSaved(true);
      onSaved?.({ id: alunoId, nome: d.nome, bilhete: d.bilhete, numero_processo: d.numero_processo,
        data_nascimento: d.data_nascimento, sexo: d.sexo, estado: d.estado,
        nome_encarregado: d.nome_encarregado, telefone_encarregado: d.telefone_encarregado,
        turma_id: d.turma_id, turma: d.turma_nome, turno: d.turno,
        pacote_id: newPacoteId });
      setTimeout(() => { setSaved(false); onClose(); }, 1200);
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const gerarPropinas = async (e: React.FormEvent) => {
    e.preventDefault();
    setGerarError(""); setGerarSuccess("");
    if (!gerarMeses.length) { setGerarError("Selecione pelo menos um mês."); return; }
    if (!gerarMontante || isNaN(Number(gerarMontante))) { setGerarError("Insira o valor mensal."); return; }
    setGerarSaving(true);
    try {
      const res = await fetch(`${API}/school/propinas/gerar`, {
        method: "POST", headers,
        body: JSON.stringify({ student_id: alunoId, meses: gerarMeses, ano: gerarAno, montante: Number(gerarMontante) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao gerar propinas.");
      setGerarSuccess(`${data.total} propina(s) gerada(s) com sucesso!`);
      setGerarMeses([]);
      const newItems: FichaPropina[] = (data.created ?? []).map((p: any) => ({
        id: p.id, mes: p.mes, ano: p.ano, montante: Number(p.montante), multa: Number(p.multa ?? 0), status: p.status,
      }));
      setFichaPropinaList(prev => [...newItems, ...prev]);
    } catch (err: any) { setGerarError(err.message); }
    finally { setGerarSaving(false); }
  };

  const propinaStatusBadge = (s: string) => {
    if (s === "pago") return <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-semibold shrink-0">Paga</span>;
    if (s === "vencido") return <span className="text-xs px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded-full font-semibold shrink-0">Vencida</span>;
    return <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-semibold shrink-0">Pendente</span>;
  };

  const Lbl = ({ children }: { children: React.ReactNode }) => (
    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{children}</label>
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm"/>
      <div className="relative w-full max-w-lg bg-white shadow-2xl flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-5 h-5 text-primary"/>
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">{loading ? "A carregar…" : ficha?.nome}</h2>
              <p className="text-xs text-slate-400">Ficha do Aluno</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors">
            <X className="w-5 h-5"/>
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center"><RefreshCw className="w-6 h-6 animate-spin text-primary"/></div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2">{err}</div>}

            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <User className="w-3.5 h-3.5"/> Dados do Aluno
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Lbl>Nome completo *</Lbl>
                  <input className={inp} value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do aluno"/>
                </div>
                <div>
                  <Lbl>Nº do BI / Bilhete</Lbl>
                  <input className={inp} value={bilhete} onChange={e => setBilhete(e.target.value)} placeholder="000000000LA000"/>
                </div>
                <div>
                  <Lbl>Nº de Processo</Lbl>
                  <input className={inp} value={numProcesso} onChange={e => setNumProcesso(e.target.value)} placeholder="Nº processo"/>
                </div>
                <div>
                  <Lbl>Data de Nascimento</Lbl>
                  <input type="date" className={inp} value={dataNascimento} onChange={e => setDataNascimento(e.target.value)}/>
                </div>
                <div>
                  <Lbl>Sexo</Lbl>
                  <select className={inp} value={sexo} onChange={e => setSexo(e.target.value)}>
                    <option value="">— não definido —</option>
                    <option value="M">Masculino</option>
                    <option value="F">Feminino</option>
                  </select>
                </div>
                <div>
                  <Lbl>Turma</Lbl>
                  <select className={inp} value={turmaId} onChange={e => setTurmaId(e.target.value ? Number(e.target.value) : "")}>
                    <option value="">— sem turma —</option>
                    {(ficha?.turmas ?? []).map(t => (
                      <option key={t.id} value={t.id}>{t.nome}{t.turno ? ` (${t.turno})` : ""}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Lbl>Estado</Lbl>
                  <select className={inp} value={estado} onChange={e => setEstado(e.target.value)}>
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                    <option value="transferido">Transferido</option>
                    <option value="desistente">Desistente</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ─── Plano de Pagamento ─── */}
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Receipt className="w-3.5 h-3.5"/> Plano de Pagamento
              </h3>
              {ficha?.school_usa_pacotes ? (
                <div className="space-y-3">
                  <div>
                    <Lbl>Pacote de emolumentos</Lbl>
                    <select className={inp} value={pacoteId}
                      onChange={e => setPacoteId(e.target.value ? Number(e.target.value) : "")}>
                      <option value="">— sem pacote atribuído —</option>
                      {fichaPackets.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.nome}{p.valor ? ` — ${Number(p.valor).toLocaleString("pt-AO")} Kz` : ""}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-400 mt-1">
                      O pacote agrupa os emolumentos aplicáveis a este aluno (propina, seguro, etc.).
                    </p>
                  </div>
                  {pacoteId !== "" && (() => {
                    const p = fichaPackets.find(pk => pk.id === pacoteId);
                    return p ? (
                      <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 text-sm text-slate-700">
                        <p className="font-semibold text-primary mb-1">{p.nome}</p>
                        {p.descricao && <p className="text-xs text-slate-500 mb-1">{p.descricao}</p>}
                        <p className="text-xs font-mono font-bold">{Number(p.valor).toLocaleString("pt-AO")} Kz / mês</p>
                      </div>
                    ) : null;
                  })()}
                </div>
              ) : fichaEmolumentos.length > 0 ? (
                <div className="space-y-3">
                  <div>
                    <Lbl>Propina atribuída a este aluno</Lbl>
                    <select className={inp} value={emolumentoPropinaId}
                      onChange={e => setEmolumentoPropinaId(e.target.value ? Number(e.target.value) : "")}>
                      <option value="">— não definido —</option>
                      {fichaEmolumentos.map(em => (
                        <option key={em.id} value={em.id}>
                          {em.nome} — {Number(em.montante).toLocaleString("pt-AO")} Kz
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-400 mt-1">
                      Seleccione a propina/emolumento aplicável a este aluno. Será usado ao gerar propinas.
                    </p>
                  </div>
                  {emolumentoPropinaId !== "" && (() => {
                    const em = fichaEmolumentos.find(e => e.id === emolumentoPropinaId);
                    return em ? (
                      <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 text-sm text-slate-700">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border mr-2 ${TIPO_COLOR_SCH[em.tipo] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                              {tipoLabelSch(em.tipo)}
                            </span>
                            <span className="font-semibold text-primary">{em.nome}</span>
                          </div>
                          <span className="text-xs font-mono font-bold text-slate-900">{Number(em.montante).toLocaleString("pt-AO")} Kz / mês</span>
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-500 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-slate-400"/>
                  Nenhum pacote ou emolumento configurado. Configure-os nas secções «Emolumentos» e «Pacotes».
                </div>
              )}
            </div>

            {/* ─── Propinas ─── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5"/> Propinas
                </h3>
                <button type="button" onClick={() => { setShowGerarForm(v => !v); setGerarError(""); setGerarSuccess(""); }}
                  className="text-xs flex items-center gap-1 text-primary font-semibold hover:text-primary/80 transition-colors">
                  <Plus className="w-3 h-3"/>{showGerarForm ? "Fechar" : "Gerar propinas"}
                </button>
              </div>

              {showGerarForm && (
                <form onSubmit={gerarPropinas} className="mb-4 bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-primary">Nova propina para {ficha?.nome?.split(" ")[0]}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Lbl>Ano</Lbl>
                      <input className={inp} value={gerarAno} onChange={e => setGerarAno(e.target.value)} placeholder="2026"/>
                    </div>
                    <div>
                      <Lbl>Valor mensal (AOA)</Lbl>
                      <input type="number" min="0" step="0.01" className={inp} value={gerarMontante}
                        onChange={e => setGerarMontante(e.target.value)} placeholder="ex: 35000"/>
                    </div>
                  </div>
                  <div>
                    <Lbl>Meses</Lbl>
                    <div className="grid grid-cols-4 gap-1.5 mt-1">
                      {MESES.map(m => {
                        const sel = gerarMeses.includes(m);
                        return (
                          <button type="button" key={m} onClick={() => setGerarMeses(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])}
                            className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${sel ? "bg-primary text-white border-primary" : "bg-white text-slate-600 border-slate-200 hover:border-primary/40"}`}>
                            {m.slice(0, 3)}
                          </button>
                        );
                      })}
                    </div>
                    {gerarMeses.length > 0 && <p className="text-xs text-primary mt-1.5 font-medium">{gerarMeses.length} mês/meses seleccionado(s)</p>}
                  </div>
                  {gerarError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{gerarError}</p>}
                  {gerarSuccess && <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{gerarSuccess}</p>}
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => setShowGerarForm(false)}
                      className="flex-1 py-2 text-xs text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">Fechar</button>
                    <button type="submit" disabled={gerarSaving}
                      className="flex-1 py-2 text-xs font-semibold bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-1 transition-colors">
                      {gerarSaving ? <><RefreshCw className="w-3 h-3 animate-spin"/>A gerar…</> : "Gerar Propinas"}
                    </button>
                  </div>
                </form>
              )}

              {fichaPropinaList.length > 0 ? (
                <div className="space-y-1.5">
                  {fichaPropinaList.slice(0, 8).map(p => (
                    <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800">{p.mes} {p.ano}</p>
                        {Number(p.multa) > 0 && (
                          <p className="text-xs text-red-500">+{fmt(p.multa)} multa</p>
                        )}
                        {Number(p.desconto) > 0 && (
                          <p className="text-xs text-emerald-600 flex items-center gap-1"><GraduationCap className="w-3 h-3"/>Bolsa: -{fmt(p.desconto)}</p>
                        )}
                      </div>
                      <p className="text-sm font-mono font-semibold text-slate-900 shrink-0">{fmt(Number(p.montante) + Number(p.multa))}</p>
                      {propinaStatusBadge(p.status)}
                    </div>
                  ))}
                  {fichaPropinaList.length > 8 && (
                    <p className="text-xs text-center text-slate-400 pt-1">+{fichaPropinaList.length - 8} propinas anteriores</p>
                  )}
                </div>
              ) : (
                <div className="text-center py-5 text-slate-400">
                  <p className="text-sm">Nenhuma propina registada para este aluno.</p>
                  <p className="text-xs mt-1">Use o botão «Gerar propinas» acima para criar.</p>
                </div>
              )}
            </div>

            {/* ─── Bolsa de Estudo ─── */}
            {(() => {
              const activeBolsa = bolsaHistory.find(b => b.estado === 'activa');
              const reloadBolsa = () => {
                Promise.all([
                  fetch(`${API}/school/alunos/${alunoId}/bolsa`, { headers }).then(r => r.ok ? r.json() : []),
                  fetch(`${API}/school/bolsas/tipos`, { headers }).then(r => r.ok ? r.json() : []),
                ]).then(([bolsas, tipos]) => {
                  setBolsaHistory(bolsas as BolsaAtribuicao[]);
                  setBolsaTipos((tipos as BolsaTipo[]).filter(t => t.activo));
                });
              };
              const atribuirBolsaFicha = async (e: React.FormEvent) => {
                e.preventDefault();
                if (!bolsaAtribTipo) { setBolsaError("Seleccione uma tipologia."); return; }
                setBolsaSaving(true); setBolsaError("");
                try {
                  const res = await fetch(`${API}/school/bolsas/atribuicoes`, {
                    method: "POST", headers,
                    body: JSON.stringify({ student_id: alunoId, bolsa_tipo_id: Number(bolsaAtribTipo), data_inicio: bolsaAtribInicio, data_fim: bolsaAtribFim || null, notas: bolsaAtribNotas.trim() || null }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error ?? "Erro ao atribuir bolsa.");
                  setShowBolsaForm(false); setBolsaAtribTipo(""); setBolsaAtribFim(""); setBolsaAtribNotas("");
                  reloadBolsa();
                } catch (err: any) { setBolsaError(err.message); }
                finally { setBolsaSaving(false); }
              };
              const revogarBolsaFicha = async () => {
                if (!activeBolsa) return;
                if (!confirm("Revogar esta bolsa de estudo?")) return;
                await fetch(`${API}/school/bolsas/atribuicoes/${activeBolsa.id}`, {
                  method: "PUT", headers,
                  body: JSON.stringify({ estado: 'revogada', motivo_revogacao: 'Revogada manualmente' }),
                });
                reloadBolsa();
              };
              return (
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <GraduationCap className="w-3.5 h-3.5"/> Bolsa de Estudo
                  </h3>
                  {activeBolsa ? (
                    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <GraduationCap className="w-4 h-4 text-primary shrink-0"/>
                            <p className="font-semibold text-primary text-sm truncate">{activeBolsa.bolsa_nome}</p>
                          </div>
                          <p className="text-xs text-slate-600">
                            {activeBolsa.tipo_desconto === 'percentagem' ? `${activeBolsa.bolsa_valor}% de desconto` : `${fmt(activeBolsa.bolsa_valor)} de desconto`}
                            {' · '}{activeBolsa.abrangencia === 'propina' ? 'Propina mensal' : 'Todos emolumentos'}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            Desde {new Date(activeBolsa.data_inicio).toLocaleDateString('pt-AO')}
                            {activeBolsa.data_fim ? ` até ${new Date(activeBolsa.data_fim).toLocaleDateString('pt-AO')}` : ''}
                          </p>
                          {activeBolsa.notas && <p className="text-xs text-slate-400 mt-1 italic">{activeBolsa.notas}</p>}
                        </div>
                        <button onClick={revogarBolsaFicha} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors shrink-0" title="Revogar bolsa">
                          <XCircle className="w-4 h-4"/>
                        </button>
                      </div>
                    </div>
                  ) : bolsaTipos.length === 0 ? (
                    <div className="text-center py-4 text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                      <GraduationCap className="w-5 h-5 mx-auto mb-1 opacity-40"/>
                      <p className="text-xs">Nenhuma tipologia de bolsa configurada.</p>
                      <p className="text-xs text-slate-300 mt-0.5">Configure em Emolumentos → Bolsas.</p>
                    </div>
                  ) : !showBolsaForm ? (
                    <div className="text-center py-4 text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                      <GraduationCap className="w-5 h-5 mx-auto mb-1 opacity-40"/>
                      <p className="text-xs">Nenhuma bolsa atribuída.</p>
                      <button onClick={() => setShowBolsaForm(true)} className="mt-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
                        + Atribuir bolsa
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={atribuirBolsaFicha} className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-3">
                      <p className="text-xs font-semibold text-primary">Atribuir bolsa de estudo</p>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Tipologia</label>
                        <select className={inp} value={bolsaAtribTipo} onChange={e => setBolsaAtribTipo(e.target.value)}>
                          <option value="">Seleccionar tipologia...</option>
                          {bolsaTipos.map(t => (
                            <option key={t.id} value={t.id}>
                              {t.nome} — {t.tipo_desconto === 'percentagem' ? `${t.valor}%` : fmt(t.valor)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Início</label>
                          <input type="date" className={inp} value={bolsaAtribInicio} onChange={e => setBolsaAtribInicio(e.target.value)}/>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Fim (opcional)</label>
                          <input type="date" className={inp} value={bolsaAtribFim} onChange={e => setBolsaAtribFim(e.target.value)}/>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Notas (opcional)</label>
                        <input className={inp} value={bolsaAtribNotas} onChange={e => setBolsaAtribNotas(e.target.value)} placeholder="Critério de concessão..."/>
                      </div>
                      {bolsaError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{bolsaError}</p>}
                      <div className="flex gap-2">
                        <button type="button" onClick={() => { setShowBolsaForm(false); setBolsaError(""); }} className="flex-1 py-2 text-xs text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50">Cancelar</button>
                        <button type="submit" disabled={bolsaSaving} className="flex-1 py-2 text-xs font-semibold bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-60">
                          {bolsaSaving ? "A atribuir..." : "Atribuir Bolsa"}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              );
            })()}

            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Users className="w-3.5 h-3.5"/> Dados do Encarregado de Educação
              </h3>
              {ficha?.encarregado ? (
                <div className="mb-3 flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0"/>
                  Encarregado com acesso ao portal. Login: <strong className="font-mono">{ficha.encarregado.telefone}</strong>
                  {ficha.encarregado.first_login && <span className="ml-1 text-amber-600">(nunca fez login)</span>}
                </div>
              ) : (
                <div className="mb-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0"/>
                  Sem encarregado associado. Ao guardar com nome e telefone, será criado acesso ao portal.
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Lbl>Nome do encarregado</Lbl>
                  <input className={inp} value={nomeEnc} onChange={e => setNomeEnc(e.target.value)} placeholder="Nome completo"/>
                </div>
                <div>
                  <Lbl>Telefone (login portal)</Lbl>
                  <input className={inp} value={telEnc} onChange={e => setTelEnc(e.target.value)} placeholder="9XX XXX XXX"/>
                </div>
                <div>
                  <Lbl>Email (opcional)</Lbl>
                  <input type="email" className={inp} value={emailEnc} onChange={e => setEmailEnc(e.target.value)} placeholder="email@exemplo.ao"/>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5"/> Acesso ao Portal do Encarregado
              </h3>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <Lbl>Nova palavra-passe (deixar em branco para não alterar)</Lbl>
                <div className="relative mt-1">
                  <input type={showPass ? "text" : "password"} className={inp}
                    value={novaPassword} onChange={e => setNovaPassword(e.target.value)}
                    placeholder={ficha?.encarregado ? "Deixar em branco = sem alteração" : "Padrão: 1234"}/>
                  <button type="button" onClick={() => setShowPass(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPass ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  {ficha?.encarregado
                    ? "O encarregado usa o nº de telefone como utilizador e a senha definida aqui."
                    : "Se não definir senha, será criada com a senha padrão «1234» a alterar no primeiro acesso."}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="shrink-0 px-6 py-4 border-t border-slate-100 bg-white flex items-center justify-between gap-3">
          <button onClick={onClose} className="px-4 py-2.5 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button onClick={save} disabled={saving || loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin"/> : saved ? <CheckCircle2 className="w-4 h-4"/> : <Save className="w-4 h-4"/>}
            {saved ? "Guardado!" : "Guardar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AlunosView({ token, alunos, turmas, pacotes, onOpenAdicionarAluno, onOpenCriarTurma, onDeleteAluno, onDeleteTurma, onRefresh }: {
  token: string | null; alunos: Aluno[]; turmas: Turma[]; pacotes: Pacote[];
  onOpenAdicionarAluno: () => void; onOpenCriarTurma: () => void;
  onDeleteAluno: (id: number) => void; onDeleteTurma: (id: number) => void;
  onRefresh: () => void;
}) {
  const [tab, setTab] = useState<"alunos"|"turmas">("alunos");
  const [regTab, setRegTab] = useState<"manual"|"csv">("manual");
  const [search, setSearch] = useState("");
  const [soMultas, setSoMultas] = useState(false);
  const [assigningPacote, setAssigningPacote] = useState<number | null>(null);
  const [fichaAlunoId, setFichaAlunoId] = useState<number | null>(null);

  const handleAssignPacote = async (alunoId: number, pacoteId: number | null) => {
    if (!token) return;
    setAssigningPacote(alunoId);
    try {
      await fetch(`${API}/school/alunos/${alunoId}/pacote`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ pacote_id: pacoteId }),
      });
      await onRefresh();
    } finally {
      setAssigningPacote(null);
    }
  };

  const alunosComMulta = alunos.filter(a => Number(a.multa_total) > 0);
  const filteredAlunos = alunos
    .filter(a => !soMultas || Number(a.multa_total) > 0)
    .filter(a => a.nome.toLowerCase().includes(search.toLowerCase()) || a.turma.toLowerCase().includes(search.toLowerCase()));
  const filteredTurmas = turmas.filter(t => t.nome.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 lg:p-8 flex-1 overflow-y-auto">
      {fichaAlunoId !== null && (
        <AlunoFichaSlideOver
          token={token}
          alunoId={fichaAlunoId}
          onClose={() => setFichaAlunoId(null)}
          onSaved={() => { setFichaAlunoId(null); onRefresh(); }}
        />
      )}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div><h2 className="text-2xl font-bold text-slate-900">Alunos & Turmas</h2></div>
        <Button variant="outline" className="bg-white gap-2" onClick={onOpenCriarTurma}><School className="w-4 h-4"/> Criar Turma</Button>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex flex-wrap gap-2 mb-5 items-center">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {(["alunos","turmas"] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setSoMultas(false); setSearch(""); }}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab===t && !soMultas ?"bg-white text-slate-900 shadow-sm":"text-slate-500 hover:text-slate-700"}`}>
              {t === "alunos" ? `Alunos (${alunos.length})` : `Turmas (${turmas.length})`}
            </button>
          ))}
        </div>
        {alunosComMulta.length > 0 && (
          <button onClick={() => { setTab("alunos"); setSoMultas(s => !s); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${soMultas ? "bg-red-600 text-white border-red-600" : "bg-white text-red-600 border-red-200 hover:bg-red-50"}`}>
            <AlertTriangle className="w-3.5 h-3.5"/>
            Com Multas ({alunosComMulta.length})
          </button>
        )}
      </div>

      {/* ── Turmas tab ── */}
      {tab === "turmas" && (
        <>
          <div className="relative mb-5">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar turma..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"/>
          </div>
          {filteredTurmas.length === 0 ? (
            <Card className="p-12 text-center"><School className="w-12 h-12 text-slate-200 mx-auto mb-3"/><p className="font-semibold text-slate-500">Sem turmas encontradas</p><Button className="mt-4" onClick={onOpenCriarTurma}><Plus className="w-4 h-4 mr-2"/> Criar Turma</Button></Card>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTurmas.map(t => (
                <Card key={t.id} className="p-5 flex flex-col gap-3 hover:border-slate-300 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center"><School className="w-5 h-5 text-primary"/></div>
                    <button onClick={() => { if(confirm(`Eliminar turma ${t.nome}?`)) onDeleteTurma(t.id); }}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4"/></button>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">{t.nome}</h4>
                    <p className="text-sm text-slate-500">{t.turno} · {t.ano}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 border-t border-slate-100 pt-3">
                    <Users className="w-3.5 h-3.5"/>
                    <span>{t.total_alunos} aluno(s)</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Alunos tab: list + registration form ── */}
      {tab === "alunos" && (
        <div className="space-y-6">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar aluno ou turma..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"/>
          </div>

          {/* Student list */}
          {filteredAlunos.length === 0 ? (
            <Card className="p-10 text-center">
              <Users className="w-12 h-12 text-slate-200 mx-auto mb-3"/>
              <p className="font-semibold text-slate-500">Sem alunos encontrados</p>
              <p className="text-sm text-slate-400 mt-1">Registe o primeiro aluno usando o formulário abaixo.</p>
            </Card>
          ) : (
            <Card className="p-0 overflow-hidden overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[800px]">
                <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3">Nome</th>
                    <th className="px-5 py-3">Processo / BI</th>
                    <th className="px-5 py-3">Turma</th>
                    <th className="px-5 py-3">Nascimento</th>
                    <th className="px-5 py-3">Estado</th>
                    <th className="px-5 py-3">Pacote de Propinas</th>
                    <th className="px-5 py-3">Propinas</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredAlunos.map(a => {
                    const estadoCls: Record<string,string> = {
                      activo:"text-emerald-700 bg-emerald-50 border-emerald-200",
                      inactivo:"text-slate-600 bg-slate-100 border-slate-200",
                      transferido:"text-blue-700 bg-blue-50 border-blue-200",
                      concluido:"text-violet-700 bg-violet-50 border-violet-200",
                    };
                    const estadoLabel: Record<string,string> = {
                      activo:"Activo", inactivo:"Inactivo", transferido:"Transferido", concluido:"Concluído",
                    };
                    const sexoLabel: Record<string,string> = { M:"♂", F:"♀" };
                    const isSaving = assigningPacote === a.id;
                    return (
                      <tr key={a.id} className="hover:bg-slate-50/50">
                        <td className="px-5 py-3">
                          <div className="font-medium text-slate-900">{a.nome}</div>
                          <div className="text-xs text-slate-400">{a.nome_encarregado ? `Enc: ${a.nome_encarregado}` : ""}</div>
                        </td>
                        <td className="px-5 py-3">
                          {a.numero_processo && <div className="font-mono text-xs text-slate-600">{a.numero_processo}</div>}
                          {a.bilhete && <div className="font-mono text-xs text-slate-400">{a.bilhete}</div>}
                          {!a.numero_processo && !a.bilhete && <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-5 py-3">
                          <div className="text-slate-700">{a.turma}</div>
                          {a.turno && <div className="text-xs text-slate-400">{a.turno}</div>}
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-500">
                          {a.data_nascimento
                            ? new Date(a.data_nascimento).toLocaleDateString("pt-AO", { day:"2-digit", month:"short", year:"numeric" })
                            : "—"}
                          {a.sexo && <span className="ml-1.5 text-slate-400">{sexoLabel[a.sexo] ?? ""}</span>}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-xs font-semibold border px-2 py-0.5 rounded-full ${estadoCls[a.estado ?? "activo"] ?? estadoCls.activo}`}>
                            {estadoLabel[a.estado ?? "activo"] ?? a.estado}
                          </span>
                        </td>
                        <td className="px-5 py-3 min-w-[180px]">
                          {pacotes.length === 0 ? (
                            <span className="text-xs text-slate-400 italic">Sem pacotes</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <select
                                value={a.pacote_id ?? ""}
                                disabled={isSaving}
                                onChange={e => handleAssignPacote(a.id, e.target.value ? Number(e.target.value) : null)}
                                className={`text-xs border rounded-lg px-2 py-1 pr-6 appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors ${
                                  a.pacote_id
                                    ? "border-emerald-300 text-emerald-800 bg-emerald-50"
                                    : "border-amber-300 text-amber-700 bg-amber-50"
                                } ${isSaving ? "opacity-50 cursor-wait" : "cursor-pointer hover:border-slate-400"}`}
                              >
                                <option value="">— sem pacote —</option>
                                {pacotes.filter(p => p.activo).map(p => (
                                  <option key={p.id} value={p.id}>{p.nome}</option>
                                ))}
                              </select>
                              {isSaving && <RefreshCw className="w-3 h-3 animate-spin text-primary shrink-0"/>}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-col gap-1">
                            {Number(a.propinas_pendentes) > 0
                              ? <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full w-fit">{a.propinas_pendentes} pendente(s)</span>
                              : <span className="text-xs text-emerald-600">Em dia</span>}
                            {Number(a.multa_total) > 0 && (
                              <span className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full w-fit flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3"/>Multa: {fmt(Number(a.multa_total))} Kz
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setFichaAlunoId(a.id)}
                              title="Editar ficha do aluno"
                              className="p-1.5 rounded-lg hover:bg-primary/10 text-slate-400 hover:text-primary transition-colors">
                              <Pencil className="w-4 h-4"/>
                            </button>
                            <button onClick={() => { if(confirm(`Eliminar ${a.nome}?`)) onDeleteAluno(a.id); }}
                              title="Eliminar aluno"
                              className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors">
                              <Trash2 className="w-4 h-4"/>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}

          {/* ── Registration form section ── */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-slate-200"/>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Registar Novo Aluno</span>
              <div className="h-px flex-1 bg-slate-200"/>
            </div>
            <div className="flex gap-1 mb-5 bg-slate-100 p-1 rounded-xl w-fit">
              <button onClick={() => setRegTab("manual")}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${regTab==="manual"?"bg-white text-slate-900 shadow-sm":"text-slate-500 hover:text-slate-700"}`}>
                <UserPlus className="w-4 h-4"/> Adicionar manualmente
              </button>
              <button onClick={() => setRegTab("csv")}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${regTab==="csv"?"bg-white text-slate-900 shadow-sm":"text-slate-500 hover:text-slate-700"}`}>
                <FileSpreadsheet className="w-4 h-4"/> Importar via CSV
              </button>
            </div>
            <Card className="p-6">
              {regTab === "manual" ? (
                <>
                  <div className="mb-5">
                    <h3 className="font-bold text-slate-900 text-lg">Registar Aluno</h3>
                    <p className="text-sm text-slate-500 mt-0.5">Preencha os dados abaixo para registar um novo aluno neste colégio.</p>
                  </div>
                  <SchoolAddAlunoPanel token={token} turmas={turmas} onSuccess={onRefresh} onCreateTurma={onOpenCriarTurma} />
                </>
              ) : (
                <>
                  <div className="mb-5">
                    <h3 className="font-bold text-slate-900 text-lg">Importação em Massa</h3>
                    <p className="text-sm text-slate-500 mt-0.5">Preencha directamente no browser ou carregue um ficheiro CSV. Turmas e encarregados são criados automaticamente.</p>
                  </div>
                  <SchoolUploadAlunosPanel token={token} onSuccess={onRefresh} />
                </>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

const AJUSTE_TIPO_LABELS: Record<string, string> = {
  perdao: "❌ Perdão de multa",
  ajuste_valor: "✏️ Correcção de valor",
  reagendamento: "📅 Reagendamento",
  justificacao: "📊 Justificação",
};

interface PropAjusteS {
  id: number; propina_id: number; tipo: string;
  multa_anterior: number; multa_nova: number | null;
  valor_anterior: number; valor_novo: number | null;
  nova_data_vencimento: string | null; motivo: string; created_by: string; created_at: string;
}

function ModalAjusteSchool({ propina, token, onClose, onDone, initialTipo }: {
  propina: Propina; token: string | null; onClose: () => void; onDone: (updated: Propina) => void;
  initialTipo?: "perdao"|"ajuste_valor"|"reagendamento"|"justificacao";
}) {
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const [tipo, setTipo] = useState<"perdao"|"ajuste_valor"|"reagendamento"|"justificacao">(initialTipo ?? "perdao");
  const [motivo, setMotivo] = useState("");
  const [multaNova, setMultaNova] = useState(String(propina.multa));
  const [valorNovo, setValorNovo] = useState(String(propina.montante));
  const [novaData, setNovaData] = useState(propina.data_vencimento ? propina.data_vencimento.split("T")[0] : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [historico, setHistorico] = useState<PropAjusteS[]>([]);
  const [histLoading, setHistLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/school/propinas/${propina.id}/ajustes`, { headers })
      .then(r => r.json()).then(setHistorico).catch(() => setHistorico([]))
      .finally(() => setHistLoading(false));
  }, [propina.id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setSaving(true);
    try {
      const body: any = { tipo, motivo };
      if (tipo === "ajuste_valor") { body.multa_nova = Number(multaNova); body.valor_novo = Number(valorNovo); }
      if (tipo === "reagendamento") body.nova_data_vencimento = novaData;
      const res = await fetch(`${API}/school/propinas/${propina.id}/ajuste`, { method: "POST", headers, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao guardar.");
      onDone({ ...propina, multa: Number(data.multa), montante: Number(data.montante), status: data.status, data_vencimento: data.data_vencimento });
    } catch (err: any) { setError(err.message); setSaving(false); }
  };

  const TIPOS = ["perdao","ajuste_valor","reagendamento","justificacao"] as const;
  const inputCls = "w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20";

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-start justify-between p-5 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900">Ajuste de Propina</h3>
            <p className="text-sm text-slate-500 mt-0.5">{propina.aluno_nome} · {propina.mes} {propina.ano}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400"><X className="w-5 h-5"/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-3 gap-3 text-center text-sm">
            <div><p className="text-xs text-slate-400 mb-1">Propina</p><p className="font-semibold">{fmt(propina.montante)} Kz</p></div>
            <div><p className="text-xs text-slate-400 mb-1">Multa</p><p className={`font-semibold ${propina.multa > 0 ? "text-red-600" : "text-slate-800"}`}>{fmt(propina.multa)} Kz</p></div>
            <div><p className="text-xs text-slate-400 mb-1">Total</p><p className="font-bold text-primary">{fmt(Number(propina.montante)+Number(propina.multa))} Kz</p></div>
          </div>
          <div>
            <p className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Tipo de ajuste</p>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS.map(t => (
                <button key={t} type="button" onClick={() => setTipo(t)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all text-left ${
                    tipo === t ? "border-primary bg-primary/5 text-primary" : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}>
                  {AJUSTE_TIPO_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
          <form onSubmit={submit} className="space-y-4">
            {tipo === "ajuste_valor" && (
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Nova multa (AOA)</label>
                  <input type="number" min="0" step="0.01" className={inputCls} value={multaNova} onChange={e => setMultaNova(e.target.value)} /></div>
                <div><label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Novo montante (AOA)</label>
                  <input type="number" min="0" step="0.01" className={inputCls} value={valorNovo} onChange={e => setValorNovo(e.target.value)} /></div>
              </div>
            )}
            {tipo === "reagendamento" && (
              <div><label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Nova data de vencimento</label>
                <input type="date" className={inputCls} value={novaData} onChange={e => setNovaData(e.target.value)} required /></div>
            )}
            <div><label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Motivo / Observação *</label>
              <textarea className={`${inputCls} resize-none`} rows={3} placeholder="Descreva o motivo do ajuste..."
                value={motivo} onChange={e => setMotivo(e.target.value)} required /></div>
            {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2 text-sm">{error}</div>}
            <button type="submit" disabled={saving}
              className="w-full px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <><RefreshCw className="w-4 h-4 animate-spin"/>A guardar...</> : "Confirmar ajuste"}
            </button>
          </form>
          {(histLoading || historico.length > 0) && (
            <div>
              <p className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <History className="w-3.5 h-3.5"/>Histórico de ajustes
              </p>
              {histLoading ? <div className="flex justify-center py-4"><RefreshCw className="w-5 h-5 text-slate-300 animate-spin"/></div> : (
                <div className="space-y-2">
                  {historico.map(h => (
                    <div key={h.id} className="bg-slate-50 rounded-xl px-4 py-3 text-xs">
                      <div className="flex justify-between mb-1">
                        <span className="font-semibold text-slate-700">{AJUSTE_TIPO_LABELS[h.tipo] ?? h.tipo}</span>
                        <span className="text-slate-400">{new Date(h.created_at).toLocaleDateString("pt-AO")}</span>
                      </div>
                      <p className="text-slate-500">{h.motivo}</p>
                      {h.multa_nova !== null && <p className="text-slate-400 mt-0.5">Multa: {fmt(h.multa_anterior)} → {fmt(h.multa_nova)} AOA</p>}
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

function PropinasView({ token, propinas: initialPropinas, alunos, turmas, onOpenGerarPropina, onOpenGerarRef, onOpenGerarLote }: {
  token: string | null; propinas: Propina[]; alunos: Aluno[]; turmas: Turma[];
  onOpenGerarPropina: () => void; onOpenGerarRef: () => void; onOpenGerarLote: () => void;
}) {
  const [propinas, setPropinas] = useState<Propina[]>(initialPropinas);
  const [filterStatus, setFilterStatus] = useState<"todos"|"pendente"|"vencido"|"pago">("todos");
  const [filterAluno, setFilterAluno] = useState("");
  const [filterTurma, setFilterTurma] = useState("");
  const [filterMes, setFilterMes] = useState("");
  const [filterAno, setFilterAno] = useState("");
  const [filterMetodo, setFilterMetodo] = useState("");
  const [detalhePropina, setDetalhePropina] = useState<Propina | null>(null);
  const [faturaPropinaId, setFaturaPropinaId] = useState<number | null>(null);
  const [ajuste, setAjuste] = useState<Propina | null>(null);
  const [ajusteInitialTipo, setAjusteInitialTipo] = useState<"perdao"|"ajuste_valor"|"reagendamento"|"justificacao">("perdao");
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  /* Baixa Manual state */
  const [bmPropina, setBmPropina] = useState<Propina | null>(null);
  const [bmValor, setBmValor] = useState("");
  const [bmMetodo, setBmMetodo] = useState("Numerário");
  const [bmData, setBmData] = useState("");
  const [bmObs, setBmObs] = useState("");
  const [bmFile, setBmFile] = useState<File | null>(null);
  const [bmSaving, setBmSaving] = useState(false);
  const [bmResult, setBmResult] = useState<any>(null);
  const [bmError, setBmError] = useState("");
  const [bmPrintMode, setBmPrintMode] = useState<"thermal" | "a4">("thermal");

  const openBaixa = (p: Propina) => {
    setBmPropina(p);
    setBmValor(String(Math.round(Number(p.montante) + Number(p.multa))));
    setBmData(new Date().toISOString().slice(0, 10));
    setBmMetodo("Numerário"); setBmObs(""); setBmFile(null); setBmResult(null); setBmError("");
  };

  const handleBaixaManual = async () => {
    if (!bmPropina || !token) return;
    if (!bmFile) { setBmError("Seleccione o comprovante de pagamento."); return; }
    if (!bmValor || Number(bmValor) <= 0) { setBmError("Introduza o valor pago."); return; }
    if (!bmData) { setBmError("Introduza a data de recebimento."); return; }
    setBmSaving(true); setBmError(""); setBmResult(null);
    try {
      const fd = new FormData();
      fd.append("propina_id", String(bmPropina.id));
      fd.append("valor_pago", bmValor);
      fd.append("metodo", bmMetodo);
      fd.append("data_recebimento", bmData);
      fd.append("observacoes", bmObs);
      fd.append("comprovante", bmFile);
      const r = await fetch(`${API}/school/reconciliacao/baixa-manual`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const d = await r.json();
      if (!r.ok) { setBmError(d.error ?? "Erro ao registar pagamento."); return; }
      setBmResult(d);
      setPropinas(prev => prev.map(p => p.id === bmPropina.id
        ? { ...p, status: d.status, multa: p.multa, montante: p.montante }
        : p
      ));
    } catch { setBmError("Erro de ligação."); }
    finally { setBmSaving(false); }
  };

  const openAjuste = (p: Propina, t: "perdao"|"ajuste_valor"|"reagendamento"|"justificacao") => {
    setAjusteInitialTipo(t);
    setAjuste(p);
    setOpenMenu(null);
  };

  const filtered = propinas
    .filter(p => filterStatus === "todos" || p.status === filterStatus)
    .filter(p => !filterAluno || String(p.student_id) === filterAluno)
    .filter(p => !filterTurma || p.turma === filterTurma)
    .filter(p => !filterMes || p.mes.toLowerCase() === filterMes.toLowerCase())
    .filter(p => !filterAno || String(p.ano) === filterAno)
    .filter(p => {
      if (!filterMetodo) return true;
      if (filterMetodo === "online") return p.pagamento_origem === "online";
      if (filterMetodo === "manual") return p.pagamento_origem !== "online";
      return (p.metodo_pagamento ?? "").toUpperCase() === filterMetodo;
    });

  const hasActiveFilters = !!(filterAluno || filterTurma || filterMes || filterAno || filterMetodo);
  const clearFilters = () => { setFilterAluno(""); setFilterTurma(""); setFilterMes(""); setFilterAno(""); setFilterMetodo(""); };

  return (
    <div className="p-6 lg:p-8 flex-1 overflow-y-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div><h2 className="text-2xl font-bold text-slate-900">Propinas & Faturas</h2></div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" className="bg-white gap-2" onClick={onOpenGerarPropina}><FileText className="w-4 h-4"/> Nova Propina</Button>
          <Button variant="outline" className="bg-white gap-2" onClick={onOpenGerarLote}><Users className="w-4 h-4"/> Gerar em Massa</Button>
          <Button className="gap-2" onClick={onOpenGerarRef}><CreditCard className="w-4 h-4"/> Gerar Referência</Button>
        </div>
      </div>
      <div className="space-y-3 mb-5">
        {/* Status tabs */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            {[{k:"todos",l:"Todas"},{k:"pendente",l:"Pendentes"},{k:"vencido",l:"Vencidas"},{k:"pago",l:"Pagas"}].map(({k,l}) => (
              <button key={k} onClick={() => setFilterStatus(k as any)}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${filterStatus===k?"bg-white text-slate-900 shadow-sm":"text-slate-500 hover:text-slate-700"}`}>{l}</button>
            ))}
          </div>
          {hasActiveFilters && (
            <button onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
              <X className="w-3 h-3"/> Limpar filtros
            </button>
          )}
        </div>
        {/* Detail filters */}
        <div className="flex flex-wrap gap-2">
          <select className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 min-w-[160px]"
            value={filterAluno} onChange={e => setFilterAluno(e.target.value)}>
            <option value="">Todos os alunos</option>
            {alunos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
          <select className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 min-w-[140px]"
            value={filterTurma} onChange={e => setFilterTurma(e.target.value)}>
            <option value="">Todas as turmas</option>
            {turmas.map(t => <option key={t.id} value={t.nome}>{t.nome}</option>)}
          </select>
          <select className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 min-w-[130px]"
            value={filterMes} onChange={e => setFilterMes(e.target.value)}>
            <option value="">Todos os meses</option>
            {MESES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <input type="number" placeholder="Ano (ex: 2026)" min="2020" max="2099"
            value={filterAno} onChange={e => setFilterAno(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 w-36"/>
          <select className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 min-w-[170px]"
            value={filterMetodo} onChange={e => setFilterMetodo(e.target.value)}>
            <option value="">Todos os métodos</option>
            <option value="manual">Manual</option>
            <option value="online">Online (todos)</option>
            <option value="MCX_EXPRESS">MCX Express</option>
            <option value="MULTICAIXA">Multicaixa</option>
            <option value="TPA">TPA</option>
          </select>
        </div>
        {/* Active filter summary */}
        {hasActiveFilters && (
          <p className="text-xs text-slate-500">
            A mostrar <span className="font-semibold text-slate-700">{filtered.length}</span> de <span className="font-semibold text-slate-700">{propinas.length}</span> propinas
          </p>
        )}
      </div>
      {filtered.length === 0 ? (
        <Card className="p-12 text-center"><Banknote className="w-12 h-12 text-slate-200 mx-auto mb-3"/><p className="font-semibold text-slate-500">Sem propinas nesta categoria</p><Button className="mt-4" onClick={onOpenGerarPropina}><Plus className="w-4 h-4 mr-2"/> Gerar Propina</Button></Card>
      ) : (
        <Card className="p-0 overflow-hidden overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[700px]">
            <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase border-b border-slate-100">
              <tr>
                <th className="px-5 py-3">Aluno</th><th className="px-5 py-3">Turma</th><th className="px-5 py-3">Período</th>
                <th className="px-5 py-3">Propina</th><th className="px-5 py-3">Multa</th><th className="px-5 py-3">Total</th>
                <th className="px-5 py-3">Estado</th><th className="px-5 py-3">Referência</th><th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/50">
                  <td className="px-5 py-3 font-medium text-slate-900">{p.aluno_nome}</td>
                  <td className="px-5 py-3 text-slate-500">{p.turma}</td>
                  <td className="px-5 py-3 text-slate-600">{p.mes} {p.ano}</td>
                  <td className="px-5 py-3 font-mono text-slate-700">{fmt(p.montante)} Kz</td>
                  <td className="px-5 py-3">
                    {Number(p.multa) > 0
                      ? <span className="font-mono text-red-600 font-semibold text-xs">+{fmt(p.multa)} Kz</span>
                      : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-5 py-3 font-bold text-slate-900">{fmt(Number(p.montante)+Number(p.multa))} Kz</td>
                  <td className="px-5 py-3">
                    <div className="flex flex-col gap-1">
                      {p.status === "pago"
                        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle2 className="w-3 h-3"/> Pago</span>
                        : p.status === "vencido"
                        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200"><AlertCircle className="w-3 h-3"/> Vencido</span>
                        : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200"><Clock className="w-3 h-3"/> Pendente</span>
                      }
                      {p.pagamento_origem === "online"
                        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-300 tracking-wide uppercase">
                            <Zap className="w-2.5 h-2.5"/> GPO / EMIS
                          </span>
                        : p.status === "pago"
                        ? <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-50 text-slate-500 border border-slate-200">
                            <ShieldCheck className="w-2.5 h-2.5"/> Manual
                          </span>
                        : null
                      }
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs">
                    {p.ref_numero
                      ? <span className="font-mono text-slate-700">{p.entidade} / {p.ref_numero}</span>
                      : p.internal_reference
                      ? <span className="font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{p.internal_reference}</span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {/* Fatura icon */}
                      <button
                        title="Ver fatura"
                        onClick={() => setFaturaPropinaId(p.id)}
                        className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors">
                        <Receipt className="w-4 h-4"/>
                      </button>
                      {/* Lupa — detail view for all propinas */}
                      <button
                        title="Ver detalhe do pagamento"
                        onClick={() => setDetalhePropina(p)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-primary transition-colors">
                        <Eye className="w-4 h-4"/>
                      </button>
                      {p.status !== "pago" && p.pagamento_origem !== "online" && (
                        <>
                          {/* Baixa Manual quick button — blocked for online payments */}
                          <button onClick={() => { openBaixa(p); setOpenMenu(null); }}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors whitespace-nowrap">
                            <FileCheck className="w-3 h-3"/> Baixa Manual
                          </button>
                          {/* More actions menu */}
                          <div className="relative">
                            <button onClick={() => setOpenMenu(openMenu === p.id ? null : p.id)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                              <MoreHorizontal className="w-4 h-4"/>
                            </button>
                            <AnimatePresence>
                              {openMenu === p.id && (
                                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                  className="absolute right-0 top-8 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 w-56">
                                  {(["perdao","ajuste_valor","reagendamento","justificacao"] as const).map(t => (
                                    <button key={t} onClick={() => openAjuste(p, t)}
                                      className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 text-slate-700">
                                      {AJUSTE_TIPO_LABELS[t]}
                                    </button>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {ajuste && (
        <ModalAjusteSchool
          propina={ajuste} token={token}
          initialTipo={ajusteInitialTipo}
          onClose={() => setAjuste(null)}
          onDone={updated => {
            setPropinas(prev => prev.map(pp => pp.id === updated.id ? updated : pp));
            setAjuste(null);
          }}
        />
      )}

      {/* ── Modal Fatura Individual ── */}
      <AnimatePresence>
        {faturaPropinaId !== null && token && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setFaturaPropinaId(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
                <h3 className="font-bold text-slate-900 flex items-center gap-2"><Receipt className="w-4 h-4 text-primary"/> Fatura Proforma</h3>
                <button onClick={() => setFaturaPropinaId(null)} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400"><X className="w-5 h-5"/></button>
              </div>
              <div className="overflow-y-auto flex-1">
                <ModalFatura token={token} propinaId={faturaPropinaId} onClose={() => setFaturaPropinaId(null)}/>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Detalhe Pagamento Modal ── */}
      {detalhePropina && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDetalhePropina(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Detalhe da Propina</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  {detalhePropina.aluno_nome} · {detalhePropina.turma} · {detalhePropina.mes} {detalhePropina.ano}
                </p>
              </div>
              <button onClick={() => setDetalhePropina(null)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400"><X className="w-5 h-5"/></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Status + origin badges */}
              <div className="flex items-center gap-2 flex-wrap">
                {detalhePropina.status === "pago"
                  ? <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle2 className="w-4 h-4"/> Paga</span>
                  : detalhePropina.status === "vencido"
                  ? <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-red-50 text-red-700 border border-red-200"><AlertCircle className="w-4 h-4"/> Vencida</span>
                  : <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-amber-50 text-amber-700 border border-amber-200"><Clock className="w-4 h-4"/> Pendente</span>}
                {detalhePropina.pagamento_origem === "online"
                  ? <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                      <Landmark className="w-3.5 h-3.5"/> {detalhePropina.metodo_pagamento ?? "Online"}
                    </span>
                  : detalhePropina.status === "pago"
                  ? <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-slate-50 text-slate-600 border border-slate-200">
                      <ShieldCheck className="w-3.5 h-3.5"/> Baixa Manual
                    </span>
                  : null
                }
              </div>

              {/* Financial grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-400 uppercase font-semibold tracking-wide mb-1">Propina</p>
                  <p className="font-bold text-slate-900">{fmt(Number(detalhePropina.montante))} Kz</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-400 uppercase font-semibold tracking-wide mb-1">Multa</p>
                  <p className={`font-bold ${Number(detalhePropina.multa) > 0 ? "text-red-600" : "text-slate-400"}`}>
                    {Number(detalhePropina.multa) > 0 ? `+${fmt(Number(detalhePropina.multa))} Kz` : "—"}
                  </p>
                </div>
                <div className="bg-primary/5 rounded-xl p-3 border border-primary/20">
                  <p className="text-xs text-primary/70 uppercase font-semibold tracking-wide mb-1">Total</p>
                  <p className="font-bold text-primary">{fmt(Number(detalhePropina.montante) + Number(detalhePropina.multa))} Kz</p>
                </div>
              </div>

              {/* Reference */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                <p className="text-xs text-slate-400 uppercase font-semibold tracking-wide">Referência</p>
                {detalhePropina.ref_numero
                  ? <p className="font-mono text-slate-800 font-semibold">{detalhePropina.entidade} / {detalhePropina.ref_numero}</p>
                  : detalhePropina.internal_reference
                  ? <p className="font-mono text-slate-600">{detalhePropina.internal_reference}</p>
                  : <p className="text-slate-400 text-sm italic">Sem referência gerada</p>}
                <div className="flex gap-4 mt-2 pt-2 border-t border-slate-200">
                  <div>
                    <p className="text-xs text-slate-400 uppercase font-semibold tracking-wide">Vencimento</p>
                    <p className="text-sm font-medium text-slate-700 mt-0.5">
                      {detalhePropina.data_vencimento
                        ? new Date(detalhePropina.data_vencimento).toLocaleDateString("pt-AO", { day:"2-digit", month:"long", year:"numeric" })
                        : "—"}
                    </p>
                  </div>
                  {detalhePropina.pago_em && (
                    <div>
                      <p className="text-xs text-slate-400 uppercase font-semibold tracking-wide">Pago em</p>
                      <p className="text-sm font-semibold text-emerald-700 mt-0.5">
                        {new Date(detalhePropina.pago_em).toLocaleDateString("pt-AO", { day:"2-digit", month:"long", year:"numeric" })}
                      </p>
                    </div>
                  )}
                  {detalhePropina.data_recebimento && (
                    <div>
                      <p className="text-xs text-slate-400 uppercase font-semibold tracking-wide">Data Recebimento</p>
                      <p className="text-sm font-semibold text-emerald-700 mt-0.5">
                        {new Date(detalhePropina.data_recebimento).toLocaleDateString("pt-AO", { day:"2-digit", month:"long", year:"numeric" })}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Online payment info */}
              {detalhePropina.pagamento_origem === "online" && (
                <div className="border border-blue-200 bg-blue-50/50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-blue-600"/>
                    <p className="text-sm font-semibold text-blue-800">Pagamento Online Automático</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-slate-400 uppercase font-semibold tracking-wide">Método</p>
                      <p className="font-medium text-slate-800 mt-0.5">{detalhePropina.metodo_pagamento ?? "—"}</p>
                    </div>
                    {detalhePropina.transaction_id && (
                      <div className="col-span-2">
                        <p className="text-xs text-slate-400 uppercase font-semibold tracking-wide">Transaction ID</p>
                        <p className="font-mono text-xs font-semibold text-blue-800 mt-0.5 break-all bg-blue-100 rounded-lg px-2 py-1">{detalhePropina.transaction_id}</p>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-blue-600/70 mt-1">Este pagamento foi processado automaticamente via EMIS. Não pode ser alterado manualmente.</p>
                </div>
              )}

              {/* Baixa Manual section */}
              {detalhePropina.baixa_manual && (
                <div className="border border-emerald-200 bg-emerald-50/50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <BadgeCheck className="w-4 h-4 text-emerald-600"/>
                    <p className="text-sm font-semibold text-emerald-800">Baixa Manual Registada</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {detalhePropina.baixa_manual_por && (
                      <div>
                        <p className="text-xs text-slate-400 uppercase font-semibold tracking-wide">Registado por</p>
                        <p className="font-medium text-slate-800 mt-0.5">{detalhePropina.baixa_manual_por}</p>
                      </div>
                    )}
                    {detalhePropina.baixa_manual_em && (
                      <div>
                        <p className="text-xs text-slate-400 uppercase font-semibold tracking-wide">Registado em</p>
                        <p className="font-medium text-slate-800 mt-0.5">
                          {new Date(detalhePropina.baixa_manual_em).toLocaleDateString("pt-AO", { day:"2-digit", month:"long", year:"numeric", hour:"2-digit", minute:"2-digit" })}
                        </p>
                      </div>
                    )}
                    {detalhePropina.baixa_manual_obs && (
                      <div className="col-span-2">
                        <p className="text-xs text-slate-400 uppercase font-semibold tracking-wide">Observações</p>
                        <p className="text-slate-700 mt-0.5 italic">{detalhePropina.baixa_manual_obs}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Comprovante */}
              {detalhePropina.comprovante_url && (() => {
                const url = detalhePropina.comprovante_url!;
                const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(url);
                return (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-400 uppercase font-semibold tracking-wide flex items-center gap-1.5">
                      <FileImage className="w-3.5 h-3.5"/> Comprovante de Pagamento
                    </p>
                    {isImage ? (
                      <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                        <img src={url} alt="Comprovante" className="w-full max-h-72 object-contain bg-slate-100"/>
                        <div className="p-2 flex justify-end border-t border-slate-100">
                          <a href={url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                            <ExternalLink className="w-3 h-3"/> Abrir em ecrã completo
                          </a>
                        </div>
                      </div>
                    ) : (
                      <a href={url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-sm text-primary font-medium">
                        <LinkIcon className="w-4 h-4 shrink-0"/>
                        <span className="truncate">Ver comprovante</span>
                        <ExternalLink className="w-3.5 h-3.5 ml-auto shrink-0"/>
                      </a>
                    )}
                  </div>
                );
              })()}

              {/* No payment info yet */}
              {detalhePropina.status !== "pago" && !detalhePropina.baixa_manual && !detalhePropina.comprovante_url && (
                <div className="py-4 text-center text-slate-400">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-40"/>
                  <p className="text-sm">Propina ainda não paga. Não há comprovante disponível.</p>
                </div>
              )}
            </div>

            <div className="px-5 pb-5">
              <Button className="w-full" onClick={() => setDetalhePropina(null)}>Fechar</Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Baixa Manual Modal (inline in PropinasView) */}
      {bmPropina && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-start justify-between p-5 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900">Baixa Manual de Pagamento</h3>
                <p className="text-sm text-slate-500 mt-0.5">{bmPropina.aluno_nome} · {bmPropina.mes} {bmPropina.ano}</p>
              </div>
              <button onClick={() => setBmPropina(null)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400"><X className="w-5 h-5"/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {bmResult ? (
                <div className="space-y-5">
                  <div className="text-center pt-2">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                      <CheckCircle2 className="w-9 h-9 text-emerald-600"/>
                    </div>
                    <p className="text-lg font-bold text-slate-900">Pagamento Registado com Sucesso!</p>
                    <p className="text-sm text-slate-500 mt-1">Ref.: <span className="font-mono font-semibold text-slate-700">{bmResult.payment_ref}</span></p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-slate-500">Aluno</span><span className="font-semibold truncate max-w-[60%]">{bmPropina?.aluno_nome}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Período</span><span className="font-semibold">{bmPropina?.mes} {bmPropina?.ano}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Valor Pago</span><span className="font-bold text-emerald-700">{fmt(bmResult.valor_pago ?? 0)} Kz</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Método</span><span className="font-semibold">{bmMetodo}</span></div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Formato de Impressão</p>
                    <div className="flex gap-2">
                      {(["thermal","a4"] as const).map(m => (
                        <button key={m} onClick={() => setBmPrintMode(m)}
                          className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${bmPrintMode === m ? "bg-primary/10 border-primary text-primary" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                          {m === "thermal" ? "🧾 Talão 80mm" : "📄 Folha A4"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setBmPropina(null)}
                      className="flex-1 px-5 py-2.5 border border-slate-200 bg-white text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
                      Fechar
                    </button>
                    <button onClick={() => bmPropina && printBaixaManualReceipt(bmResult, bmPropina, bmMetodo, bmResult.baixa_manual_por ?? "", bmPrintMode)}
                      className="flex-1 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
                      <Printer className="w-4 h-4"/> Imprimir Comprovativo
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-3 gap-3 text-center text-sm">
                    <div><p className="text-xs text-slate-400 mb-1">Propina</p><p className="font-semibold">{fmt(bmPropina.montante)} Kz</p></div>
                    <div><p className="text-xs text-slate-400 mb-1">Multa</p><p className={`font-semibold ${bmPropina.multa > 0 ? "text-red-600" : "text-slate-800"}`}>{fmt(bmPropina.multa)} Kz</p></div>
                    <div><p className="text-xs text-slate-400 mb-1">Total</p><p className="font-bold text-primary">{fmt(Number(bmPropina.montante)+Number(bmPropina.multa))} Kz</p></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Valor Pago (AOA) *</label>
                      <input type="number" min="0" step="0.01"
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                        value={bmValor} onChange={e => setBmValor(e.target.value)} placeholder="0.00"/>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Método *</label>
                      <select className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                        value={bmMetodo} onChange={e => setBmMetodo(e.target.value)}>
                        {["Numerário","Transferência Bancária","Multicaixa Express","Cheque","Outro"].map(m => <option key={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Data de Recebimento *</label>
                    <input type="date"
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                      value={bmData} onChange={e => setBmData(e.target.value)}/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Comprovante de Pagamento *</label>
                    <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-5 cursor-pointer transition-colors ${bmFile ? "border-emerald-400 bg-emerald-50" : "border-slate-200 hover:border-primary/40 bg-slate-50"}`}>
                      <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => setBmFile(e.target.files?.[0] ?? null)}/>
                      {bmFile ? <><FileCheck className="w-6 h-6 text-emerald-600"/><span className="text-xs text-emerald-700 font-semibold">{bmFile.name}</span></> : <><Upload className="w-6 h-6 text-slate-300"/><span className="text-xs text-slate-500">Clique para carregar ficheiro (PDF, imagem)</span></>}
                    </label>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Observações</label>
                    <textarea rows={2}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                      placeholder="Notas adicionais sobre o pagamento..."
                      value={bmObs} onChange={e => setBmObs(e.target.value)}/>
                  </div>
                  {Number(bmValor) > 0 && Number(bmValor) < (Number(bmPropina.montante) + Number(bmPropina.multa)) && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-2 text-amber-700 text-xs">
                      <AlertTriangle className="w-4 h-4 shrink-0"/>
                      <span>O valor inserido ({fmt(Number(bmValor))} Kz) é inferior ao total ({fmt(Number(bmPropina.montante)+Number(bmPropina.multa))} Kz). Será registado como pagamento parcial.</span>
                    </div>
                  )}
                  {bmError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2 text-sm">{bmError}</div>}
                  <button onClick={handleBaixaManual} disabled={bmSaving}
                    className="w-full px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                    {bmSaving ? <><RefreshCw className="w-4 h-4 animate-spin"/>A registar...</> : <><FileCheck className="w-4 h-4"/>Confirmar Baixa Manual</>}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

/* ─── Reconciliação View (School) ─── */
function ReconciliacaoView({ token }: { token: string | null }) {
  const [propinas, setPropinas] = useState<RecPropina[]>([]);
  const [stats, setStats] = useState<RecStats | null>(null);
  const [commissionRate, setCommissionRate] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");
  const [reconciling, setReconciling] = useState(false);
  const [baixaModal, setBaixaModal] = useState<RecPropina | null>(null);
  const [bmValor, setBmValor] = useState("");
  const [bmMetodo, setBmMetodo] = useState("Cash");
  const [bmData, setBmData] = useState("");
  const [bmObs, setBmObs] = useState("");
  const [bmFile, setBmFile] = useState<File | null>(null);
  const [bmResult, setBmResult] = useState<any>(null);
  const [bmError, setBmError] = useState("");
  const [bmPrintMode, setBmPrintMode] = useState<"thermal" | "a4">("thermal");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [recSubTab, setRecSubTab] = useState<"faturas" | "multas" | "fecho_caixa">("faturas");

  /* ── Fecho de Caixa state ── */
  /* helper: compute inicio/fim from a named period (relative to today)
     "ano_lectivo" = Angolan academic year (Sep 1 of previous/current year) */
  const datesFromPeriodo = (p: string): { inicio: string; fim: string } => {
    const fim = new Date();
    let inicio: Date;
    switch (p) {
      case "semanal":      inicio = new Date(fim.getTime() - 6   * 86_400_000); break;
      case "trimestral":   inicio = new Date(fim.getTime() - 89  * 86_400_000); break;
      case "semestral":    inicio = new Date(fim.getTime() - 179 * 86_400_000); break;
      case "anual":        inicio = new Date(fim.getFullYear(), 0, 1);          break;
      case "ano_lectivo": {
        /* Academic year starts Sep 1. If current month < September, it started last year */
        const anoLectivo = fim.getMonth() >= 8 ? fim.getFullYear() : fim.getFullYear() - 1;
        inicio = new Date(anoLectivo, 8, 1); /* Sep 1 */
        break;
      }
      default: inicio = new Date(fim); break;
    }
    return { inicio: inicio.toISOString().slice(0, 10), fim: fim.toISOString().slice(0, 10) };
  };

  const [periodo, setPeriodo] = useState<""|"diario"|"semanal"|"trimestral"|"semestral"|"anual"|"ano_lectivo">("ano_lectivo");
  const [dateInicio, setDateInicio] = useState<string>(() => datesFromPeriodo("ano_lectivo").inicio);
  const [dateFim, setDateFim]     = useState<string>(() => new Date().toISOString().slice(0, 10));
  const applyPeriodo = (p: "diario"|"semanal"|"trimestral"|"semestral"|"anual"|"ano_lectivo") => {
    setPeriodo(p);
    const { inicio, fim } = datesFromPeriodo(p);
    setDateInicio(inicio);
    setDateFim(fim);
  };
  const [filterCanal, setFilterCanal] = useState<PayChannel>("");
  const [fechoData, setFechoData] = useState<FechoData | null>(null);
  const [fechoLoading, setFechoLoading] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [demoToggeling, setDemoToggling] = useState(false);
  const [livePayments, setLivePayments] = useState<{ canal: string; aluno_nome: string; valor: number; pago_em: string; is_demo?: boolean }[]>([]);
  const [flashCanais, setFlashCanais] = useState<Set<string>>(new Set());
  const sseRef = useRef<EventSource | null>(null);

  const authHeader = (): HeadersInit => token ? { Authorization: `Bearer ${token}` } : {};

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filterStatus) qs.set("status", filterStatus);
      /* Pass the same date range used by Fecho de Caixa so that receita_total
         in the stats KPIs reflects exactly the same payments scope */
      qs.set("data_from", dateInicio);
      qs.set("data_to", dateFim);
      const r = await fetch(`${API}/school/reconciliacao?${qs}`, { headers: authHeader() });
      if (r.ok) {
        const d = await r.json();
        setPropinas(d.propinas ?? []);
        setStats(d.stats ?? null);
        setCommissionRate(Number(d.commission_rate ?? 0));
      }
    } finally { setLoading(false); }
  }, [token, filterStatus, dateInicio, dateFim]);

  useEffect(() => { load(); }, [load]);

  /* ── Fecho de Caixa load ── */
  const loadFecho = useCallback(async () => {
    if (!token) return;
    setFechoLoading(true);
    try {
      const qs = new URLSearchParams({ data_from: dateInicio, data_to: dateFim });
      if (filterCanal) qs.set("metodo", filterCanal);
      const r = await fetch(`${API}/school/reconciliacao/fecho-caixa?${qs}`, { headers: authHeader() });
      if (r.ok) {
        const d: FechoData = await r.json();
        setFechoData(d);
        setDemoMode(d.demo_mode);
      }
    } finally { setFechoLoading(false); }
  }, [token, dateInicio, dateFim, filterCanal]);

  useEffect(() => {
    if (recSubTab === "fecho_caixa") loadFecho();
  }, [loadFecho, recSubTab]);

  /* ── SSE connection for real-time payments ── */
  useEffect(() => {
    if (!token) return;
    const es = new EventSource(`${API}/school/reconciliacao/stream?token=${token}`);
    sseRef.current = es;
    es.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.type === "payment") {
          setLivePayments(prev => [data, ...prev].slice(0, 20));
          setFlashCanais(prev => {
            const s = new Set(prev); s.add(data.canal);
            setTimeout(() => setFlashCanais(p => { const ns = new Set(p); ns.delete(data.canal); return ns; }), 1200);
            return s;
          });
          setFechoData(prev => {
            if (!prev) return prev;
            const canal = data.canal;
            const existing = prev.canais.find(c => c.canal === canal);
            const newCanais = existing
              ? prev.canais.map(c => c.canal === canal
                  ? { ...c, total_transacoes: c.total_transacoes + 1, total_liquidado: Number(c.total_liquidado) + Number(data.valor) }
                  : c)
              : [...prev.canais, { canal, total_transacoes: 1, total_liquidado: Number(data.valor) }];
            return {
              ...prev,
              canais: newCanais,
              totais: { ...prev.totais, total_transacoes: prev.totais.total_transacoes + 1, total_liquidado: Number(prev.totais.total_liquidado) + Number(data.valor) },
            };
          });
        }
      } catch {}
    };
    return () => { es.close(); sseRef.current = null; };
  }, [token]);

  const toggleDemo = async () => {
    if (!token) return;
    setDemoToggling(true);
    try {
      const r = await fetch(`${API}/school/reconciliacao/demo-toggle`, { method: "POST", headers: authHeader() as Record<string, string> });
      if (r.ok) { const d = await r.json(); setDemoMode(d.demo_mode); }
    } finally { setDemoToggling(false); }
  };

  const handleBaixaManual = async () => {
    if (!baixaModal) return;
    if (bmMetodo !== "Cash" && !bmFile) { setBmError("Seleccione o comprovante de pagamento."); return; }
    if (!bmValor || Number(bmValor) <= 0) { setBmError("Introduza o valor pago."); return; }
    if (!bmData) { setBmError("Introduza a data de recebimento."); return; }
    setReconciling(true); setBmError(""); setBmResult(null);
    try {
      const fd = new FormData();
      fd.append("propina_id", String(baixaModal.id));
      fd.append("valor_pago", bmValor);
      fd.append("metodo", bmMetodo);
      fd.append("data_recebimento", bmData);
      fd.append("observacoes", bmObs);
      if (bmFile) fd.append("comprovante", bmFile);
      const r = await fetch(`${API}/school/reconciliacao/baixa-manual`, {
        method: "POST",
        headers: authHeader() as any,
        body: fd,
      });
      const d = await r.json();
      if (!r.ok) { setBmError(d.error ?? "Erro ao registar pagamento."); return; }
      setBmResult(d);
      load();
    } catch { setBmError("Erro de ligação."); }
    finally { setReconciling(false); }
  };

  const filtered = propinas.filter(p => {
    if (search && !p.aluno_nome.toLowerCase().includes(search.toLowerCase()) &&
        !p.internal_reference?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const statusBadge = (s: string) => {
    if (s === "pago")     return <span className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">Paga</span>;
    if (s === "vencido")  return <span className="px-2.5 py-1 text-xs font-semibold bg-red-50 text-red-700 rounded-full border border-red-200">Vencida</span>;
    return                       <span className="px-2.5 py-1 text-xs font-semibold bg-amber-50 text-amber-700 rounded-full border border-amber-200">Pendente</span>;
  };

  const alunosMultas = (() => {
    const map = new Map<string, { nome: string; turma: string; multa: number; count: number }>();
    for (const p of propinas) {
      if (p.status === "pago" || Number(p.multa) <= 0) continue;
      const key = String(p.aluno_nome);
      const existing = map.get(key);
      if (existing) { existing.multa += Number(p.multa); existing.count++; }
      else map.set(key, { nome: p.aluno_nome, turma: p.turma ?? "", multa: Number(p.multa), count: 1 });
    }
    return Array.from(map.values()).sort((a, b) => b.multa - a.multa);
  })();

  return (
    <motion.div key="reconciliacao" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
      className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6">

      {/* Page title + sub-tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary"/> Reconciliação Financeira
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Consulte o estado de reconciliação das faturas, referências internas e distribuição de receitas.
          </p>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 self-start sm:self-auto flex-wrap">
          <button onClick={() => setRecSubTab("faturas")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${recSubTab==="faturas"?"bg-white text-slate-900 shadow-sm":"text-slate-500 hover:text-slate-700"}`}>
            <Receipt className="w-3.5 h-3.5"/> Faturas
          </button>
          <button onClick={() => setRecSubTab("multas")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${recSubTab==="multas"?"bg-white text-slate-900 shadow-sm":"text-slate-500 hover:text-slate-700"}`}>
            <AlertTriangle className="w-3.5 h-3.5 text-red-500"/> Multas
            {alunosMultas.length > 0 && <span className="ml-1 bg-red-100 text-red-700 text-xs px-1.5 py-0.5 rounded-full font-bold">{alunosMultas.length}</span>}
          </button>
          <button onClick={() => setRecSubTab("fecho_caixa")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${recSubTab==="fecho_caixa"?"bg-white text-slate-900 shadow-sm":"text-slate-500 hover:text-slate-700"}`}>
            <Banknote className="w-3.5 h-3.5 text-emerald-600"/> Fecho de Caixa
            {demoMode && <span className="ml-1 bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold animate-pulse">DEMO</span>}
          </button>
        </div>
      </div>

      {recSubTab === "multas" && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500"/>
            <h3 className="font-semibold text-slate-900 text-sm">Alunos com Multas em Aberto</h3>
            <span className="ml-auto text-xs text-slate-400">{alunosMultas.length} aluno(s)</span>
          </div>
          {alunosMultas.length === 0 ? (
            <div className="py-14 text-center text-slate-400">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-300"/>
              <p className="font-semibold">Sem multas em aberto</p>
              <p className="text-sm">Nenhum aluno tem multas por regularizar.</p>
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
                      <td className="px-5 py-3 text-right font-bold text-red-700">{fmt(a.multa)} Kz</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-red-50 border-t border-red-100">
                    <td colSpan={3} className="px-5 py-3 text-sm font-semibold text-red-700">Total em multas</td>
                    <td className="px-5 py-3 text-right font-bold text-red-800">{fmt(alunosMultas.reduce((s, a) => s + a.multa, 0))} Kz</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ FECHO DE CAIXA ══════════════ */}
      {recSubTab === "fecho_caixa" && (
        <div className="space-y-6">
          {/* Controls row */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              {/* Period selector */}
              <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                {(["diario","semanal","trimestral","semestral","anual","ano_lectivo"] as const).map(p => (
                  <button key={p} onClick={() => applyPeriodo(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${periodo===p?"bg-white text-slate-900 shadow-sm":"text-slate-500 hover:text-slate-700"}`}>
                    {p === "diario" ? "Diário" : p === "semanal" ? "Semanal" : p === "trimestral" ? "Trimestral" : p === "semestral" ? "Semestral" : p === "anual" ? "Anual" : "Ano Lectivo"}
                  </button>
                ))}
              </div>
              {/* Demo mode + refresh */}
              <div className="flex items-center gap-2">
                <button onClick={toggleDemo} disabled={demoToggeling}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${demoMode ? "bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"}`}>
                  {demoMode ? <><Zap className="w-3.5 h-3.5 animate-pulse"/> Parar Demo</> : <><PlayCircle className="w-3.5 h-3.5"/> Modo Demo</>}
                </button>
                <button onClick={loadFecho} className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-500 transition-colors">
                  <RefreshCw className={`w-4 h-4 ${fechoLoading ? "animate-spin" : ""}`}/>
                </button>
              </div>
            </div>
            {/* Date range picker — both inputs independently editable */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <CalendarDays className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                <input
                  type="date"
                  value={dateInicio}
                  max={dateFim}
                  onChange={e => { setDateInicio(e.target.value); setPeriodo(""); }}
                  className="pl-8 pr-3 py-1.5 text-xs font-medium border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                />
              </div>
              <span className="text-slate-300 font-light select-none">→</span>
              <div className="relative">
                <CalendarDays className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                <input
                  type="date"
                  value={dateFim}
                  min={dateInicio}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={e => { setDateFim(e.target.value); setPeriodo(""); }}
                  className="pl-8 pr-3 py-1.5 text-xs font-medium border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Payment method chips */}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setFilterCanal("")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${filterCanal===""?"bg-slate-900 text-white border-slate-900":"bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`}>
              Todos os canais
            </button>
            {(["GPO_EMIS","DIRECT_DEBIT","BANK_TRANSFER","POS_TPA","CASH"] as const).map(c => {
              const m = CANAL_META[c];
              const isActive = filterCanal === c;
              const isFlashing = flashCanais.has(c);
              return (
                <button key={c} onClick={() => setFilterCanal(prev => prev === c ? "" : c)}
                  style={isActive ? { backgroundColor: m.color, borderColor: m.color, color: "white" } : isFlashing ? { boxShadow: `0 0 0 3px ${m.color}55` } : undefined}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${isFlashing ? "ring-2 ring-offset-1 scale-105" : ""} ${isActive ? "" : `${m.bg} ${m.border} text-slate-700 hover:scale-105`}`}>
                  <span>{m.icon}</span>{m.label}
                  {isFlashing && <span className="w-2 h-2 rounded-full bg-current animate-ping ml-0.5"/>}
                </button>
              );
            })}
          </div>

          {/* KPI cards */}
          {fechoLoading && !fechoData ? (
            <div className="py-16 text-center text-slate-400"><RefreshCw className="w-6 h-6 animate-spin inline"/></div>
          ) : fechoData ? (
            <>
              {/* Total liquidado banner */}
              <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-2xl p-5 text-white flex items-center justify-between">
                <div>
                  <p className="text-emerald-100 text-sm font-medium">Total Liquidado · {new Date(dateInicio + "T12:00:00").toLocaleDateString("pt-AO", { day:"2-digit", month:"short" })} – {new Date(dateFim + "T12:00:00").toLocaleDateString("pt-AO", { day:"2-digit", month:"short", year:"numeric" })}</p>
                  <p className="text-3xl font-bold mt-1">{fmt(fechoData.totais.total_liquidado)}</p>
                  <div className="flex items-center gap-3 mt-2 text-emerald-100 text-xs">
                    <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5"/> {fechoData.totais.total_transacoes} transações</span>
                    <span>·</span>
                    <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5"/> {fechoData.totais.automaticos} automáticas</span>
                    <span>·</span>
                    <span className="flex items-center gap-1"><BadgeCheck className="w-3.5 h-3.5"/> {fechoData.totais.manuais} manuais</span>
                  </div>
                </div>
                <div className="shrink-0 w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-white"/>
                </div>
              </div>

              {/* Per-channel cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                {(["GPO_EMIS","DIRECT_DEBIT","BANK_TRANSFER","POS_TPA","CASH"] as const).map(canal => {
                  const m = CANAL_META[canal];
                  const data = fechoData.canais.find(c => c.canal === canal);
                  const isFlashing = flashCanais.has(canal);
                  return (
                    <div key={canal}
                      className={`${m.bg} border ${m.border} rounded-xl p-4 transition-all ${isFlashing ? "scale-105 shadow-lg ring-2" : ""}`}
                      style={isFlashing ? { ringColor: m.color } : undefined}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-lg">{m.icon}</span>
                        {data ? (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3"/> Liquidado
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200">Sem mov.</span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-slate-600 mb-1">{m.label}</p>
                      <p className="text-lg font-bold text-slate-900">{data ? fmt(data.total_liquidado) : "0 AOA"}</p>
                      <p className="text-xs text-slate-500 mt-1">{data?.total_transacoes ?? 0} transação(ões)</p>
                      {isFlashing && <p className="text-xs font-semibold mt-1 animate-pulse" style={{ color: m.color }}>● Pagamento recebido</p>}
                    </div>
                  );
                })}
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {/* Bar chart */}
                <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary"/> Evolução por Canal
                  </p>
                  {fechoData.chart.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-sm">Sem dados para o período seleccionado.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={fechoData.chart} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                        <XAxis dataKey="dia" tick={{ fontSize: 10 }} stroke="#cbd5e1"/>
                        <YAxis tick={{ fontSize: 10 }} stroke="#cbd5e1" tickFormatter={v => `${(v/1000).toFixed(0)}K`}/>
                        <ReTooltip formatter={(v: number) => [`${Number(v).toLocaleString("pt-AO")} AOA`]} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 11 }}/>
                        <Legend wrapperStyle={{ fontSize: 10 }} formatter={(v) => CANAL_META[v]?.label ?? v}/>
                        {(["GPO_EMIS","DIRECT_DEBIT","BANK_TRANSFER","POS_TPA","CASH"] as const).map(c => (
                          <Bar key={c} dataKey={c} fill={CANAL_META[c].color} radius={[3,3,0,0]} maxBarSize={24}/>
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Pie chart */}
                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <ArrowLeftRight className="w-4 h-4 text-primary"/> Distribuição
                  </p>
                  {fechoData.canais.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-sm">Sem dados.</div>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                          <Pie
                            data={fechoData.canais.map(c => ({ ...c, total_liquidado: Number(c.total_liquidado) }))}
                            dataKey="total_liquidado"
                            nameKey="canal"
                            cx="50%" cy="50%"
                            outerRadius={68} innerRadius={32}
                            paddingAngle={2}
                          >
                            {fechoData.canais.map(c => (
                              <Cell key={c.canal} fill={CANAL_META[c.canal]?.color ?? "#94a3b8"}/>
                            ))}
                          </Pie>
                          <ReTooltip
                            formatter={(v: number, name: string) => [
                              `${Number(v).toLocaleString("pt-AO")} AOA`,
                              CANAL_META[name]?.label ?? name,
                            ]}
                            contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 11 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-1.5 mt-2">
                        {fechoData.canais.map(c => {
                          const total = Number(fechoData.totais.total_liquidado) || 1;
                          const pct = Math.round((Number(c.total_liquidado) / total) * 100);
                          const m = CANAL_META[c.canal];
                          return (
                            <div key={c.canal} className="flex items-center gap-2 text-xs">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: m?.color ?? "#94a3b8" }}/>
                              <span className="text-slate-600 flex-1">{m?.label ?? c.canal}</span>
                              <span className="font-semibold text-slate-900">{pct}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Live payments feed */}
              {livePayments.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"/>
                    <p className="text-sm font-semibold text-slate-900">Pagamentos em Tempo Real</p>
                    <span className="ml-auto text-xs text-slate-400">{livePayments.length} recentes</span>
                  </div>
                  <div className="divide-y divide-slate-50 max-h-60 overflow-y-auto">
                    {livePayments.map((p, i) => {
                      const m = CANAL_META[p.canal];
                      return (
                        <div key={i} className="flex items-center gap-3 px-5 py-2.5">
                          <span className="text-base">{m?.icon ?? "💰"}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{p.aluno_nome}</p>
                            <p className="text-xs text-slate-400">{m?.label ?? p.canal}{p.is_demo ? " · Demo" : ""}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-emerald-700">{fmt(p.valor)}</p>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">✓ Liquidado</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Demo mode info box */}
              {demoMode && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 flex items-center gap-3">
                  <Zap className="w-4 h-4 text-amber-600 shrink-0 animate-pulse"/>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-800">Modo Demonstração activo</p>
                    <p className="text-xs text-amber-600">A simular pagamentos fictícios de todos os 5 canais em tempo real. Os dados não são reais.</p>
                  </div>
                  <button onClick={toggleDemo} disabled={demoToggeling}
                    className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 transition-colors">
                    Parar
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="py-16 text-center text-slate-400 text-sm">Clique em actualizar para carregar o fecho de caixa.</div>
          )}
        </div>
      )}
      {/* ═══════════════════════════════════════════ */}

      {/* Stats cards */}
      {recSubTab === "faturas" && stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Faturas Pendentes", value: stats.pendentes, icon: <Clock className="w-5 h-5"/>, color: "text-amber-600 bg-amber-50 border-amber-200" },
            { label: "Faturas Vencidas",  value: stats.vencidas,  icon: <AlertCircle className="w-5 h-5"/>, color: "text-red-600 bg-red-50 border-red-200" },
            { label: "Faturas Pagas",     value: stats.pagas,     icon: <CheckCircle2 className="w-5 h-5"/>, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
            { label: `Receita Total (${dateInicio.slice(0,7)} → ${dateFim.slice(0,7)})`, value: fmt(stats.receita_total), icon: <Banknote className="w-5 h-5"/>, color: "text-primary bg-primary/5 border-primary/20" },
          ].map(c => (
            <div key={c.label} className={`border rounded-xl p-4 flex items-center gap-3 ${c.color}`}>
              <div className="shrink-0">{c.icon}</div>
              <div>
                <p className="text-xs font-medium opacity-70">{c.label}</p>
                <p className="text-lg font-bold">{c.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Split summary */}
      {recSubTab === "faturas" && stats && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <ArrowLeftRight className="w-4 h-4 text-primary"/>
            <h3 className="font-semibold text-slate-900 text-sm">Distribuição de Receitas (Split Payment)</h3>
            <span className="ml-auto text-xs text-slate-400">Taxa de comissão: {commissionRate}%</span>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Landmark className="w-4 h-4 text-blue-600"/>
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Conta do Colégio</p>
            </div>
            <p className="text-2xl font-bold text-blue-800">{fmt(stats.receita_escola)}</p>
            <p className="text-xs text-blue-600 mt-1">Receita líquida após comissão</p>
          </div>
        </div>
      )}


      {/* Baixa Manual modal */}
      <AnimatePresence>
        {baixaModal && (
          <motion.div key="bm-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget && !reconciling) { setBaixaModal(null); setBmResult(null); } }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">

              {/* Header */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <FileCheck className="w-5 h-5"/>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900">Baixa Manual de Propina</h3>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{baixaModal.aluno_nome} — {baixaModal.mes}/{baixaModal.ano}</p>
                </div>
                {!reconciling && <button onClick={() => { setBaixaModal(null); setBmResult(null); }} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5"/></button>}
              </div>

              {bmResult ? (
                <div className="space-y-4">
                  <div className="text-center py-2">
                    <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                      <CheckCircle2 className="w-8 h-8 text-emerald-600"/>
                    </div>
                    <p className="text-base font-bold text-slate-900">Pagamento Registado com Sucesso!</p>
                    <p className="text-xs text-slate-500 mt-1">Ref.: <span className="font-mono font-semibold text-slate-700">{bmResult.payment_ref}</span></p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-slate-500">Aluno</span><span className="font-semibold truncate max-w-[60%]">{baixaModal?.aluno_nome}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Período</span><span className="font-semibold">{baixaModal?.mes}/{baixaModal?.ano}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Valor Pago</span><span className="font-bold text-emerald-700">{fmt(bmResult.valor_pago ?? 0)} Kz</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Método</span><span className="font-semibold">{bmMetodo}</span></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                      <p className="text-blue-600 font-semibold uppercase tracking-wide mb-1">Receita Colégio</p>
                      <p className="text-blue-900 font-bold text-lg">{fmt(bmResult.split?.escola ?? 0)}</p>
                    </div>
                    <div className="bg-violet-50 border border-violet-100 rounded-xl p-3">
                      <p className="text-violet-600 font-semibold uppercase tracking-wide mb-1">Comissão ({bmResult.split?.comissao_rate ?? 0}%)</p>
                      <p className="text-violet-900 font-bold text-lg">{fmt(bmResult.split?.plataforma ?? 0)}</p>
                    </div>
                  </div>
                  {bmResult.comprovante_url && (
                    <a href={bmResult.comprovante_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 transition-colors">
                      <Paperclip className="w-4 h-4"/> Ver comprovante enviado
                      <ExternalLink className="w-3.5 h-3.5 ml-auto"/>
                    </a>
                  )}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Formato de Impressão</p>
                    <div className="flex gap-2">
                      {(["thermal","a4"] as const).map(m => (
                        <button key={m} onClick={() => setBmPrintMode(m)}
                          className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${bmPrintMode === m ? "bg-primary/10 border-primary text-primary" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                          {m === "thermal" ? "🧾 Talão 80mm" : "📄 Folha A4"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => { setBaixaModal(null); setBmResult(null); }} className="flex-1">Fechar</Button>
                    <Button onClick={() => baixaModal && printBaixaManualReceipt(bmResult, baixaModal, bmMetodo, bmResult.baixa_manual_por ?? "", bmPrintMode)}
                      className="flex-1 gap-2 bg-primary hover:bg-primary/90 text-white">
                      <Printer className="w-4 h-4"/> Imprimir Comprovativo
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Invoice summary */}
                  <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500 uppercase font-semibold tracking-wide">Total da fatura</p>
                      <p className="text-2xl font-bold text-slate-900 mt-0.5">{fmt(baixaModal.total_fatura)}</p>
                      {Number(baixaModal.multa) > 0 && (
                        <p className="text-xs text-red-600 mt-0.5">Inclui multa de {fmt(baixaModal.multa)}</p>
                      )}
                    </div>
                    {baixaModal.internal_reference && (
                      <span className="font-mono text-xs bg-white border border-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg">{baixaModal.internal_reference}</span>
                    )}
                  </div>

                  {/* Value received */}
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block flex items-center gap-1">
                      <Banknote className="w-3.5 h-3.5"/> Valor recebido (AOA) <span className="text-red-500">*</span>
                    </label>
                    <input type="number" value={bmValor} onChange={e => setBmValor(e.target.value)} min={1}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40"/>
                  </div>

                  {/* Payment method */}
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block flex items-center gap-1">
                      <CreditCard className="w-3.5 h-3.5"/> Método de pagamento
                    </label>
                    <select value={bmMetodo} onChange={e => { setBmMetodo(e.target.value); setBmFile(null); }}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40">
                      {["Cash","Transferência Bancária","TPA"].map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>

                  {/* Receipt date */}
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block flex items-center gap-1">
                      <CalendarDays className="w-3.5 h-3.5"/> Data de recebimento <span className="text-red-500">*</span>
                    </label>
                    <input type="date" value={bmData} onChange={e => setBmData(e.target.value)}
                      max={new Date().toISOString().slice(0,10)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40"/>
                  </div>

                  {/* Comprovante upload — not required for Cash */}
                  {bmMetodo !== "Cash" && (
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block flex items-center gap-1">
                      <Paperclip className="w-3.5 h-3.5"/> Comprovante de pagamento <span className="text-red-500">*</span>
                    </label>
                    <label className={`flex items-center gap-3 border-2 border-dashed rounded-xl px-4 py-3 cursor-pointer transition-colors ${bmFile ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:border-emerald-300 hover:bg-emerald-50/50"}`}>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) setBmFile(f); }}/>
                      {bmFile ? (
                        <>
                          <FileCheck className="w-4 h-4 text-emerald-600 shrink-0"/>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-emerald-800 truncate">{bmFile.name}</p>
                            <p className="text-xs text-emerald-600">{(bmFile.size / 1024).toFixed(0)} KB</p>
                          </div>
                          <button type="button" onClick={e => { e.preventDefault(); setBmFile(null); }}
                            className="text-emerald-500 hover:text-red-500"><X className="w-3.5 h-3.5"/></button>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 text-slate-400 shrink-0"/>
                          <div>
                            <p className="text-xs font-medium text-slate-600">Clique para seleccionar ficheiro</p>
                            <p className="text-xs text-slate-400">PDF, JPG, PNG — até 5 MB</p>
                          </div>
                        </>
                      )}
                    </label>
                  </div>)}

                  {/* Observations */}
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5"/> Observações (opcional)
                    </label>
                    <textarea value={bmObs} onChange={e => setBmObs(e.target.value)} rows={2}
                      placeholder="Ex: Pago pelo encarregado no dia …"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400/40"/>
                  </div>

                  {bmValor && Number(bmValor) > 0 && Number(bmValor) < baixaModal.total_fatura && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0"/>
                      Valor inferior ao total da fatura ({fmt(baixaModal.total_fatura)}). A propina ficará como <strong>pendente</strong>.
                    </p>
                  )}

                  {bmError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{bmError}</p>}

                  <div className="flex gap-3 pt-1">
                    <Button variant="ghost" onClick={() => setBaixaModal(null)} className="flex-1" disabled={reconciling}>Cancelar</Button>
                    <Button onClick={handleBaixaManual} disabled={reconciling} className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                      {reconciling ? <RefreshCw className="w-4 h-4 animate-spin"/> : <FileCheck className="w-4 h-4"/>}
                      {reconciling ? "A registar…" : "Registar Baixa"}
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ComunicacaoView — SMS Notifications (School)
═══════════════════════════════════════════════════════════ */
const SMS_EVENTS = [
  { key: "nova_fatura",        label: "Nova Fatura",           desc: "Enviado ao criar propinas" },
  { key: "pagamento_confirmado", label: "Pagamento Confirmado", desc: "Enviado após webhook de pagamento" },
  { key: "atraso_pagamento",   label: "Atraso de Pagamento",   desc: "Enviado ao aplicar vencido" },
  { key: "multa_aplicada",     label: "Multa Aplicada",        desc: "Enviado ao calcular multa" },
] as const;

type SmsEventKey = typeof SMS_EVENTS[number]["key"];

const DEFAULT_TEMPLATES: Record<SmsEventKey, string> = {
  nova_fatura:          "Prezado(a) {nome_encarregado}, a propina de {mes} no valor de {valor} Kz está disponível. {reference_info}",
  pagamento_confirmado: "Pagamento confirmado para {nome_aluno}. Valor: {valor} Kz. Obrigado.",
  atraso_pagamento:     "A propina de {mes} encontra-se em atraso. Evite multa. {reference_info}",
  multa_aplicada:       "Foi aplicada uma multa de {valor_multa} Kz à propina de {mes}.",
};

type TemplateVarDef = { key: string; label: string; sample: string; events: SmsEventKey[] };
const TEMPLATE_VARS: TemplateVarDef[] = [
  { key: "{nome_encarregado}", label: "Nome do Encarregado",         sample: "Maria Antónia",    events: ["nova_fatura","pagamento_confirmado","atraso_pagamento","multa_aplicada"] },
  { key: "{nome_aluno}",       label: "Nome do Aluno",               sample: "João Silva",       events: ["nova_fatura","pagamento_confirmado","atraso_pagamento","multa_aplicada"] },
  { key: "{mes}",              label: "Mês da Propina",              sample: "Março 2025",       events: ["nova_fatura","atraso_pagamento","multa_aplicada"] },
  { key: "{valor}",            label: "Valor da Propina (Kz)",       sample: "15.000",           events: ["nova_fatura","pagamento_confirmado"] },
  { key: "{valor_multa}",      label: "Valor da Multa (Kz)",         sample: "1.500",            events: ["multa_aplicada"] },
  {
    key: "{reference_info}",
    label: "Referência inteligente",
    sample: "Ref: REF-00123456",
    events: ["nova_fatura","atraso_pagamento"],
  },
];

const SAMPLE_PAYLOAD: Record<string, string> = {
  "{nome_encarregado}": "Maria Antónia",
  "{nome_aluno}":       "João Silva",
  "{mes}":              "Março 2025",
  "{valor}":            "15.000",
  "{valor_multa}":      "1.500",
  "{reference_info}":   "Ref: REF-00123456",
};

function previewTemplate(tpl: string): string {
  return Object.entries(SAMPLE_PAYLOAD).reduce((t, [k, v]) => t.replaceAll(k, v), tpl);
}

/* ═══════════════════════════════════════════════════════════════
   CaixaView — POS / Faturação Presencial
   ═══════════════════════════════════════════════════════════════ */

function printCaixaFatura(fatura: any, escola: any, aluno: any, mode: "thermal" | "a4") {
  const fmt = (v: number) => Number(v).toLocaleString("pt-AO");
  const dataHora = new Date(fatura.created_at);
  const dataStr = dataHora.toLocaleDateString("pt-AO");
  const horaStr = dataHora.toLocaleTimeString("pt-AO", { hour: "2-digit", minute: "2-digit" });
  const metodoLabel = fatura.metodo_pagamento === "CASH" ? "Numerário" : "POS / TPA";

  const html = mode === "thermal" ? `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8"/>
<title>${fatura.numero_fatura}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Courier New',monospace;font-size:11px;width:80mm;padding:6px;color:#000;background:#fff}
  .c{text-align:center} .b{font-weight:bold} .lg{font-size:13px}
  hr{border:none;border-top:1px dashed #000;margin:5px 0}
  .row{display:flex;justify-content:space-between;gap:4px}
  .row span:last-child{white-space:nowrap;font-weight:bold}
</style></head><body>
<div class="c b lg">${escola?.nome ?? ""}</div>
${escola?.nif ? `<div class="c">NIF: ${escola.nif}</div>` : ""}
${escola?.phone ? `<div class="c">${escola.phone}</div>` : ""}
<hr/>
<div class="c b">FATURA DE CAIXA</div>
<div class="c b" style="font-size:13px">${fatura.numero_fatura}</div>
<div class="c">${dataStr} ${horaStr}</div>
<hr/>
<div><span class="b">Aluno: </span>${fatura.aluno_nome}</div>
${fatura.aluno_numero_processo ? `<div>Proc: ${fatura.aluno_numero_processo}</div>` : ""}
${fatura.aluno_turma ? `<div>Turma: ${fatura.aluno_turma}</div>` : ""}
<hr/>
<div class="row"><span>${fatura.descricao}</span><span>${fmt(fatura.montante)} Kz</span></div>
<hr/>
<div class="row lg b"><span>TOTAL</span><span>${fmt(fatura.montante)} Kz</span></div>
<div class="c" style="margin-top:3px">${metodoLabel}</div>
<hr/>
<div class="c">Operador: ${fatura.operador_nome}</div>
<div class="c b" style="margin-top:4px">★ LIQUIDADO ★</div>
<div class="c" style="margin-top:6px">Obrigado!</div>
<script>window.onload=function(){window.print();window.onafterprint=function(){window.close();}}</script>
</body></html>` : `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8"/>
<title>${fatura.numero_fatura}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;font-size:13px;margin:0;padding:40px;color:#111}
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1e293b;padding-bottom:18px;margin-bottom:24px}
  .school-name{font-size:22px;font-weight:700;margin-bottom:4px}
  .tag{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b}
  .inv-num{font-size:22px;font-weight:700;font-family:'Courier New',monospace;text-align:right}
  .bill-to{margin-bottom:24px}
  .bill-to p{margin:2px 0}
  table{width:100%;border-collapse:collapse;margin-bottom:24px}
  th{background:#f1f5f9;padding:9px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#64748b}
  td{padding:11px 12px;border-bottom:1px solid #e2e8f0}
  .total-row td{font-weight:700;font-size:16px;background:#f8fafc}
  .mono{font-family:'Courier New',monospace}
  .ftr{display:flex;justify-content:space-between;font-size:12px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:14px}
  .paid{color:#16a34a;font-weight:700;font-size:15px}
  @media print{@page{margin:20mm}body{padding:0}}
</style></head><body>
<div class="hdr">
  <div>
    <div class="school-name">${escola?.nome ?? ""}</div>
    ${escola?.nif ? `<div style="color:#64748b;font-size:12px">NIF: ${escola.nif}</div>` : ""}
    ${escola?.phone ? `<div style="color:#64748b;font-size:12px">${escola.phone}</div>` : ""}
  </div>
  <div style="text-align:right">
    <div class="tag">Fatura de Caixa</div>
    <div class="inv-num">${fatura.numero_fatura}</div>
    <div style="color:#64748b;font-size:12px">${dataStr}</div>
  </div>
</div>
<div class="bill-to">
  <div class="tag" style="margin-bottom:6px">Facturado a</div>
  <p style="font-size:18px;font-weight:700">${fatura.aluno_nome}</p>
  ${fatura.aluno_turma ? `<p style="color:#64748b">Turma: ${fatura.aluno_turma}</p>` : ""}
  ${fatura.aluno_numero_processo ? `<p style="color:#64748b">Proc: ${fatura.aluno_numero_processo}</p>` : ""}
</div>
<table>
  <thead><tr><th>Descrição</th><th style="text-align:right">Valor (Kz)</th></tr></thead>
  <tbody>
    <tr><td>${fatura.descricao}</td><td class="mono" style="text-align:right;font-weight:600">${fmt(fatura.montante)}</td></tr>
  </tbody>
  <tfoot>
    <tr class="total-row"><td style="text-align:right">TOTAL</td><td class="mono" style="text-align:right">${fmt(fatura.montante)} Kz</td></tr>
  </tfoot>
</table>
<div class="ftr">
  <div>
    <p><b>Meio de Pagamento:</b> ${metodoLabel}</p>
    <p><b>Operador:</b> ${fatura.operador_nome}</p>
    <p>${dataStr} ${horaStr}</p>
  </div>
  <div style="text-align:right"><div class="paid">LIQUIDADO</div></div>
</div>
<script>window.onload=function(){window.print();window.onafterprint=function(){window.close();}}</script>
</body></html>`;

  const w = window.open("", "_blank", mode === "thermal" ? "width=340,height=500" : "width=800,height=600");
  if (!w) { alert("Permita popups para imprimir a fatura."); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
}

function printBaixaManualReceipt(
  result: any,
  propina: { aluno_nome: string; mes: string; ano: number | string; turma?: string; student_id?: number },
  metodo: string,
  operador: string,
  mode: "thermal" | "a4"
) {
  const escola = result.escola ?? {};
  const alunoNome = result.propina?.aluno_nome ?? propina.aluno_nome ?? "";
  const alunoProcesso = result.propina?.aluno_processo ?? "";
  const mes = result.propina?.mes ?? propina.mes ?? "";
  const ano = result.propina?.ano ?? propina.ano ?? "";
  const fatura = {
    numero_fatura: result.payment_ref ?? "MAN-?",
    created_at: new Date().toISOString(),
    aluno_nome: alunoNome,
    aluno_numero_processo: alunoProcesso,
    aluno_turma: (propina as any).turma ?? "",
    descricao: `Propina de ${mes}/${ano}`,
    montante: result.valor_pago ?? 0,
    metodo_pagamento: (metodo === "Numerário" || metodo === "Cash") ? "CASH" : "POS_TPA",
    operador_nome: operador || result.baixa_manual_por || "Operador",
  };
  printCaixaFatura(fatura, escola, null, mode);
}

function CaixaView({ token }: { token: string }) {
  const authH = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [faturas, setFaturas]   = useState<any[]>([]);
  const [totais, setTotais]     = useState({ qtd_hoje: 0, volume_hoje: 0, qtd_total: 0, volume_total: 0 });
  const [emolumentos, setEmolumentos] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  /* ── Modal state ── */
  const [modal, setModal] = useState(false);
  const [step, setStep]   = useState<1 | 2 | 3>(1);

  /* Step 1 — student */
  const [search, setSearch]         = useState("");
  const [searching, setSearching]   = useState(false);
  const [results, setResults]       = useState<any[]>([]);
  const [student, setStudent]       = useState<any>(null);

  /* Step 2 — item */
  const [itemTipo, setItemTipo]           = useState<"propina" | "emolumento" | "livre">("propina");
  const [propinas, setPropinas]           = useState<any[]>([]);
  const [selPropina, setSelPropina]       = useState<any>(null);
  const [selEmolumento, setSelEmolumento] = useState<any>(null);
  const [livreDesc, setLivreDesc]         = useState("");
  const [livreMont, setLivreMont]         = useState("");

  /* Step 3 — payment */
  const [metodo, setMetodo]     = useState<"CASH" | "POS_TPA">("CASH");
  const [operador, setOperador] = useState("");
  const [printMode, setPrintMode] = useState<"thermal" | "a4">("thermal");

  /* Emit */
  const [emitting, setEmitting]     = useState(false);
  const [lastFatura, setLastFatura] = useState<any>(null);

  /* ── Load list ── */
  const loadFaturas = useCallback(() => {
    setLoadingList(true);
    fetch(`${API}/school/caixa/faturas`, { headers: authH })
      .then(r => r.ok ? r.json() : { faturas: [], totais: {} })
      .then(d => { setFaturas(d.faturas ?? []); setTotais(d.totais ?? {}); })
      .finally(() => setLoadingList(false));
  }, [authH]);

  useEffect(() => {
    loadFaturas();
    fetch(`${API}/school/caixa/emolumentos`, { headers: authH })
      .then(r => r.ok ? r.json() : []).then(setEmolumentos);
  }, [authH]);

  /* ── Student search ── */
  useEffect(() => {
    if (!search.trim() || search.length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      setSearching(true);
      fetch(`${API}/school/caixa/alunos-search?q=${encodeURIComponent(search)}&limit=8`, { headers: authH })
        .then(r => r.ok ? r.json() : []).then(setResults)
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [search, authH]);

  const pickStudent = async (s: any) => {
    setStudent(s); setResults([]); setSearch(s.nome);
    setSelPropina(null); setPropinas([]);
    const r = await fetch(`${API}/school/caixa/aluno-propinas/${s.id}`, { headers: authH });
    if (r.ok) setPropinas(await r.json());
  };

  /* ── Open modal fresh ── */
  const openModal = () => {
    setModal(true); setStep(1);
    setSearch(""); setResults([]); setStudent(null);
    setItemTipo("propina"); setSelPropina(null); setSelEmolumento(null);
    setLivreDesc(""); setLivreMont("");
    setMetodo("CASH"); setOperador(""); setPrintMode("thermal");
  };

  /* ── Derived: description + amount ── */
  const getDescricao = () => {
    if (itemTipo === "propina" && selPropina)
      return `Propina — ${selPropina.mes} ${selPropina.ano}`;
    if (itemTipo === "emolumento" && selEmolumento)
      return selEmolumento.nome;
    return livreDesc;
  };
  const getMontante = () => {
    if (itemTipo === "propina" && selPropina)
      return Number(selPropina.montante) + Number(selPropina.multa ?? 0);
    if (itemTipo === "emolumento" && selEmolumento)
      return Number(selEmolumento.montante);
    return Number(livreMont) || 0;
  };

  const canAdvanceStep2 = itemTipo === "propina" ? !!selPropina
    : itemTipo === "emolumento" ? !!selEmolumento
    : (livreDesc.trim().length > 0 && Number(livreMont) > 0);

  /* ── Emit ── */
  const handleEmitir = async () => {
    setEmitting(true);
    try {
      const r = await fetch(`${API}/school/caixa/emitir`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authH },
        body: JSON.stringify({
          student_id:      student.id,
          propina_id:      itemTipo === "propina" && selPropina ? selPropina.id : null,
          emolumento_id:   itemTipo === "emolumento" && selEmolumento ? selEmolumento.id : null,
          descricao:       getDescricao(),
          montante:        getMontante(),
          metodo_pagamento: metodo,
          operador_nome:   operador.trim() || "Administrador",
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Erro ao emitir fatura.");
      setLastFatura(d);
      setModal(false);
      loadFaturas();
      setTimeout(() => printCaixaFatura(d.fatura, d.escola, d.aluno, printMode), 300);
    } catch (e: any) {
      alert(e.message ?? "Erro ao emitir fatura.");
    } finally {
      setEmitting(false);
    }
  };

  const fmt = (v: number) => Number(v).toLocaleString("pt-AO");
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("pt-AO", { day: "2-digit", month: "short", year: "numeric" });

  /* ─────────────────────────── RENDER ─────────────────────────── */
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Receipt className="w-6 h-6 text-primary"/>
            Caixa — Faturação Presencial
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">Emissão imediata de faturas no atendimento presencial</p>
        </div>
        <button onClick={openModal}
          className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 shadow-sm transition-colors whitespace-nowrap">
          <Plus className="w-5 h-5"/> Emitir Fatura de Caixa
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Faturas Hoje",   value: String(totais.qtd_hoje),                  unit: "" },
          { label: "Volume Hoje",    value: fmt(totais.volume_hoje),                   unit: "Kz" },
          { label: "Total Faturas",  value: String(totais.qtd_total),                  unit: "" },
          { label: "Volume Total",   value: fmt(totais.volume_total),                  unit: "Kz" },
        ].map(({ label, value, unit }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500 font-medium">{label}</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5 font-mono">
              {value}<span className="text-sm font-normal text-slate-400 ml-1">{unit}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Invoice list */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Faturas Emitidas</h3>
          <button onClick={loadFaturas}
            className="text-xs text-primary hover:underline flex items-center gap-1">
            <RefreshCw className={`w-3 h-3 ${loadingList ? "animate-spin" : ""}`}/> Actualizar
          </button>
        </div>

        {loadingList ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="w-5 h-5 animate-spin text-primary"/>
          </div>
        ) : faturas.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Receipt className="w-10 h-10 mx-auto mb-3 opacity-30"/>
            <p className="text-sm font-medium">Nenhuma fatura de caixa emitida.</p>
            <p className="text-xs mt-1">Clique em "Emitir Fatura de Caixa" para começar.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {["Nº Fatura","Data","Aluno","Descrição","Valor (Kz)","Método","Operador",""].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {faturas.map((f: any) => (
                  <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-primary whitespace-nowrap">{f.numero_fatura}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(f.created_at)}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 max-w-[140px] truncate">{f.aluno_nome}</td>
                    <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">{f.descricao}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900 whitespace-nowrap">{fmt(f.montante)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${f.metodo_pagamento === "CASH" ? "bg-emerald-100 text-emerald-700" : "bg-indigo-100 text-indigo-700"}`}>
                        {f.metodo_pagamento === "CASH" ? "💵 Numerário" : "💳 POS/TPA"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{f.operador_nome}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => printCaixaFatura(f, null, null, "thermal")}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors"
                        title="Reimprimir talão">
                        <Printer className="w-4 h-4"/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─────────────────── MODAL ─────────────────── */}
      <AnimatePresence>
        {modal && (
          <motion.div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) setModal(false); }}>
            <motion.div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>

              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-primary"/> Emitir Fatura de Caixa
                </h3>
                <button onClick={() => setModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                  <X className="w-5 h-5"/>
                </button>
              </div>

              {/* Steps indicator */}
              <div className="px-6 pt-5">
                <div className="flex items-center">
                  {[
                    { n: 1, label: "Aluno" },
                    { n: 2, label: "Serviço" },
                    { n: 3, label: "Pagamento" },
                  ].map(({ n, label }, i) => (
                    <React.Fragment key={n}>
                      <div className={`flex items-center gap-1.5 ${step >= n ? "text-primary" : "text-slate-400"}`}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${step > n ? "bg-primary border-primary text-white" : step === n ? "bg-primary/10 border-primary text-primary" : "bg-slate-50 border-slate-200 text-slate-400"}`}>
                          {step > n ? <CheckCircle2 className="w-4 h-4"/> : n}
                        </div>
                        <span className="text-xs font-semibold hidden sm:block">{label}</span>
                      </div>
                      {i < 2 && <div className={`flex-1 h-0.5 mx-2 rounded-full transition-all ${step > n ? "bg-primary" : "bg-slate-200"}`}/>}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <div className="p-6 space-y-5">

                {/* ── STEP 1: Student search ── */}
                {step === 1 && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                        Pesquisar Aluno *
                      </label>
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                        <input
                          value={search}
                          onChange={e => { setSearch(e.target.value); setStudent(null); }}
                          placeholder="Nome ou nº de processo…"
                          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"/>
                        {searching && <RefreshCw className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin"/>}
                      </div>
                      {results.length > 0 && !student && (
                        <div className="mt-1.5 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                          {results.map((s: any) => (
                            <button key={s.id} onClick={() => pickStudent(s)}
                              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-primary/5 transition-colors text-left border-b border-slate-50 last:border-0">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                                {s.nome?.split(" ").map((w: string) => w[0]).slice(0,2).join("").toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-800 truncate">{s.nome}</p>
                                <p className="text-xs text-slate-400">{s.turma ?? "Sem turma"}{s.numero_processo ? ` · Proc: ${s.numero_processo}` : ""}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {student && (
                      <div className="flex items-center gap-3 p-3.5 bg-primary/5 rounded-xl border border-primary/20">
                        <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {student.nome?.split(" ").map((w: string) => w[0]).slice(0,2).join("").toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-900 truncate">{student.nome}</p>
                          <p className="text-xs text-slate-500">{student.turma ?? "Sem turma"}{student.numero_processo ? ` · Proc: ${student.numero_processo}` : ""}</p>
                        </div>
                        <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0"/>
                      </div>
                    )}
                  </div>
                )}

                {/* ── STEP 2: Service selection ── */}
                {step === 2 && (
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Tipo de Serviço</p>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { k: "propina"    as const, icon: "📋", label: "Propina" },
                          { k: "emolumento" as const, icon: "🏷️", label: "Emolumento" },
                          { k: "livre"      as const, icon: "✏️", label: "Livre" },
                        ].map(({ k, icon, label }) => (
                          <button key={k}
                            onClick={() => { setItemTipo(k); setSelPropina(null); setSelEmolumento(null); }}
                            className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all ${itemTipo === k ? "bg-primary/10 border-primary text-primary" : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}>
                            <span className="text-xl">{icon}</span>
                            <span className="text-xs font-bold">{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {itemTipo === "propina" && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Propinas Pendentes</p>
                        {propinas.length === 0 ? (
                          <div className="text-center py-8 bg-slate-50 rounded-xl text-slate-400">
                            <p className="text-sm">Nenhuma propina pendente para este aluno.</p>
                          </div>
                        ) : (
                          propinas.map((p: any) => {
                            const total = Number(p.montante) + Number(p.multa ?? 0);
                            const sel = selPropina?.id === p.id;
                            return (
                              <button key={p.id} onClick={() => setSelPropina(p)}
                                className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${sel ? "bg-primary/5 border-primary" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}>
                                <div className="text-left">
                                  <p className="text-sm font-semibold text-slate-800">{p.mes} {p.ano}</p>
                                  <p className={`text-xs mt-0.5 ${p.status === "vencido" ? "text-red-500" : "text-slate-400"}`}>
                                    {p.status === "vencido" ? "⚠ Vencida" : "Pendente"}
                                  </p>
                                </div>
                                <div className="text-right flex items-center gap-2">
                                  <div>
                                    <p className="font-mono font-bold text-slate-900">{Number(p.montante).toLocaleString("pt-AO")} Kz</p>
                                    {Number(p.multa) > 0 && (
                                      <p className="text-xs text-red-500">+{Number(p.multa).toLocaleString("pt-AO")} multa</p>
                                    )}
                                  </div>
                                  {sel && <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0"/>}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}

                    {itemTipo === "emolumento" && (
                      <div>
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Seleccionar Emolumento</p>
                        <select
                          value={selEmolumento?.id ?? ""}
                          onChange={e => setSelEmolumento(emolumentos.find((em: any) => em.id === Number(e.target.value)) ?? null)}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                          <option value="">Seleccionar emolumento…</option>
                          {emolumentos.map((em: any) => (
                            <option key={em.id} value={em.id}>
                              {em.nome} — {Number(em.montante).toLocaleString("pt-AO")} Kz
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {itemTipo === "livre" && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Descrição *</label>
                          <input value={livreDesc} onChange={e => setLivreDesc(e.target.value)}
                            placeholder="Ex: Certificado de habilitações"
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"/>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Montante (Kz) *</label>
                          <input type="number" min="0" value={livreMont} onChange={e => setLivreMont(e.target.value)}
                            placeholder="0"
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"/>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── STEP 3: Payment + confirm ── */}
                {step === 3 && (
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Meio de Pagamento</p>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { k: "CASH"    as const, icon: "💵", label: "Numerário",  desc: "Pagamento em dinheiro" },
                          { k: "POS_TPA" as const, icon: "💳", label: "POS / TPA",  desc: "Cartão multibanco" },
                        ].map(({ k, icon, label, desc }) => (
                          <button key={k} onClick={() => setMetodo(k)}
                            className={`flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 text-center transition-all ${metodo === k ? "bg-primary/10 border-primary text-primary" : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}>
                            <span className="text-2xl">{icon}</span>
                            <span className="text-sm font-bold">{label}</span>
                            <span className="text-xs text-slate-400">{desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Operador de Caixa</label>
                      <input value={operador} onChange={e => setOperador(e.target.value)}
                        placeholder="Nome do operador (opcional)"
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"/>
                    </div>

                    {/* Summary */}
                    <div className="bg-slate-50 rounded-xl p-4 space-y-2.5 border border-slate-200">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Resumo da Fatura</p>
                      <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-500">Aluno</span>
                          <span className="font-semibold text-slate-800 text-right truncate">{student?.nome}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-500 flex-shrink-0">Serviço</span>
                          <span className="font-semibold text-slate-800 text-right">{getDescricao()}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-500">Método</span>
                          <span className="font-semibold">{metodo === "CASH" ? "💵 Numerário" : "💳 POS/TPA"}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                          <span className="font-bold text-slate-900">Total</span>
                          <span className="font-bold text-2xl text-primary font-mono">
                            {getMontante().toLocaleString("pt-AO")} Kz
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Formato de impressão</p>
                      <div className="flex gap-2">
                        {([
                          { k: "thermal" as const, label: "🧾 Talão 80mm" },
                          { k: "a4"      as const, label: "📄 A4" },
                        ]).map(({ k, label }) => (
                          <button key={k} onClick={() => setPrintMode(k)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${printMode === k ? "bg-primary/10 border-primary text-primary" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Navigation buttons */}
                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                  {step > 1 ? (
                    <button onClick={() => setStep(s => (s - 1) as 1 | 2 | 3)}
                      className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 font-medium">
                      <ChevronLeft className="w-4 h-4"/> Anterior
                    </button>
                  ) : <div/>}

                  {step < 3 ? (
                    <button
                      onClick={() => setStep(s => (s + 1) as 1 | 2 | 3)}
                      disabled={step === 1 ? !student : !canAdvanceStep2}
                      className="flex items-center gap-2 bg-primary text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      Próximo <ChevronRight className="w-4 h-4"/>
                    </button>
                  ) : (
                    <button onClick={handleEmitir} disabled={emitting || getMontante() <= 0}
                      className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm">
                      {emitting
                        ? <><RefreshCw className="w-4 h-4 animate-spin"/> A processar…</>
                        : <><Printer className="w-4 h-4"/> Confirmar e Imprimir</>}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success toast after emit */}
      <AnimatePresence>
        {lastFatura && (
          <motion.div
            className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 max-w-sm"
            initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}>
            <CheckCircle2 className="w-5 h-5 flex-shrink-0"/>
            <div className="min-w-0">
              <p className="font-bold text-sm">Fatura emitida!</p>
              <p className="text-xs opacity-80 font-mono">{lastFatura.fatura?.numero_fatura}</p>
            </div>
            <button onClick={() => setLastFatura(null)} className="ml-2 opacity-70 hover:opacity-100">
              <X className="w-4 h-4"/>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ComunicarView — unified communication hub (portal + SMS)
   ═══════════════════════════════════════════════════════════════ */
function ComunicarView({ token, moduloInfantil = false }: { token: string; moduloInfantil?: boolean }) {
  const authH = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  type ComunicarTab = "compor" | "publicados" | "historico" | "aniversario" | "push";
  const [tab, setTab] = useState<ComunicarTab>("compor");

  // ── Compor ──
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [prioridade, setPrioridade] = useState<"normal" | "alta" | "urgente">("normal");
  const [canal, setCanal] = useState<"portal" | "sms" | "ambos">("portal");
  const [pickedTemplate, setPickedTemplate] = useState("");
  const [audienciaModo, setAudienciaModo] = useState<"todos" | "turma" | "devedores">("todos");
  const [audienciaTurmaId, setAudienciaTurmaId] = useState<number | null>(null);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [audiencia, setAudiencia] = useState<{ registados: any[]; nao_registados: any[] }>({ registados: [], nao_registados: [] });
  const [loadingAudiencia, setLoadingAudiencia] = useState(false);
  const [encSearch, setEncSearch] = useState("");
  const [selectedPhones, setSelectedPhones] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ comunicado_id?: number; sms_sent?: number; sms_failed?: number } | null>(null);

  // ── Publicados ──
  const [comunicados, setComunicados] = useState<any[]>([]);
  const [loadingComuns, setLoadingComuns] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // ── Templates (global + escola) ──
  const [templates, setTemplates] = useState<Record<string, string>>({ ...DEFAULT_TEMPLATES });

  // ── Histórico ──
  const [logs, setLogs] = useState<any[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [logsLoading, setLogsLoading] = useState(false);
  const [stats, setStats] = useState<{ sent: number; failed: number } | null>(null);

  // ── Push Notifications ──
  const [pushTitulo, setPushTitulo] = useState("");
  const [pushMensagem, setPushMensagem] = useState("");
  const [pushAudiencia, setPushAudiencia] = useState<"todos" | "encarregados" | "professores" | "turma" | "especifico">("todos");
  const [pushTurmaId, setPushTurmaId] = useState<number | null>(null);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{ ok: boolean; sent?: number; failed?: number; total_devices?: number; environment?: string; message?: string; error?: string } | null>(null);
  const [pushStats, setPushStats] = useState<{ total: number; guardians: number; staff: number } | null>(null);
  const [pushGuardianIds, setPushGuardianIds] = useState<number[]>([]);
  const [pushGuardianSearch, setPushGuardianSearch] = useState("");
  const [pushAllGuardians, setPushAllGuardians] = useState<any[]>([]);
  const [pushLoadingGuardians, setPushLoadingGuardians] = useState(false);
  const [pushPickedTemplate, setPushPickedTemplate] = useState("");

  // ── Aniversário ──
  const [aniversariantesHoje, setAniversariantesHoje] = useState<any[]>([]);
  const [loadingAniv, setLoadingAniv] = useState(false);
  const [anivStudentId, setAnivStudentId] = useState<number | null>(null);
  const [anivStudentNome, setAnivStudentNome] = useState("");
  const [anivFotoPreview, setAnivFotoPreview] = useState<string | null>(null);
  const [anivFotoData, setAnivFotoData] = useState<string | null>(null);
  const [anivTitulo, setAnivTitulo] = useState("");
  const [anivMensagem, setAnivMensagem] = useState("");
  const [anivPublishing, setAnivPublishing] = useState(false);
  const [anivResult, setAnivResult] = useState(false);
  const [anivManualSearch, setAnivManualSearch] = useState("");
  const [anivManualResults, setAnivManualResults] = useState<any[]>([]);
  const [anivManualSearching, setAnivManualSearching] = useState(false);

  // ── Effects ──
  useEffect(() => {
    loadGlobalTemplates();
    loadComunicados();
    fetchStats();
    fetch(`${API}/school/turmas`, { headers: authH })
      .then(r => r.json()).then(d => setTurmas(Array.isArray(d) ? d : [])).catch(() => {});
  }, [token]);

  useEffect(() => { loadAudiencia(); }, [audienciaModo, audienciaTurmaId]);
  useEffect(() => { if (tab === "historico") fetchLogs(1); }, [tab]);
  useEffect(() => {
    if (tab === "push") {
      fetch(`${API}/school/comunicar/fcm-stats`, { headers: authH })
        .then(r => r.ok ? r.json() : null).then(d => d && setPushStats(d)).catch(() => {});
      setPushLoadingGuardians(true);
      fetch(`${API}/school/comunicar/audiencia?modo=todos`, { headers: authH })
        .then(r => r.ok ? r.json() : { registados: [] })
        .then(d => setPushAllGuardians((d.registados || []).filter((g: any) => g.id !== null)))
        .catch(() => {})
        .finally(() => setPushLoadingGuardians(false));
    }
  }, [tab]);

  const handlePush = async () => {
    if (!pushTitulo.trim() || !pushMensagem.trim()) return;
    setPushing(true); setPushResult(null);
    try {
      const r = await fetch(`${API}/school/comunicar/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authH },
        body: JSON.stringify({
          titulo: pushTitulo.trim(),
          mensagem: pushMensagem.trim(),
          audiencia: pushAudiencia,
          turma_id: pushTurmaId,
          encarregado_ids: pushAudiencia === "especifico" ? pushGuardianIds : undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setPushResult(d);
      if (d.ok && d.sent > 0) { setPushTitulo(""); setPushMensagem(""); setPushPickedTemplate(""); }
    } catch (e: any) { setPushResult({ ok: false, error: e.message ?? "Erro ao enviar." }); }
    finally { setPushing(false); }
  };

  useEffect(() => {
    if (tab === "aniversario" && moduloInfantil) {
      setLoadingAniv(true);
      fetch(`${API}/school/comunicar/aniversarios-hoje`, { headers: authH })
        .then(r => r.ok ? r.json() : [])
        .then(d => setAniversariantesHoje(d))
        .finally(() => setLoadingAniv(false));
    }
  }, [tab, moduloInfantil]);

  useEffect(() => {
    if (!anivManualSearch.trim() || anivManualSearch.length < 2) { setAnivManualResults([]); return; }
    const t = setTimeout(() => {
      setAnivManualSearching(true);
      fetch(`${API}/school/caixa/alunos-search?q=${encodeURIComponent(anivManualSearch)}&limit=8`, { headers: authH })
        .then(r => r.ok ? r.json() : []).then(setAnivManualResults)
        .finally(() => setAnivManualSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [anivManualSearch, authH]);

  const loadGlobalTemplates = () =>
    fetch(`${API}/school/comunicar/templates`, { headers: authH })
      .then(r => r.ok ? r.json() : DEFAULT_TEMPLATES)
      .then(d => setTemplates({ ...DEFAULT_TEMPLATES, ...d }))
      .catch(() => {});

  const loadAudiencia = () => {
    setLoadingAudiencia(true);
    let url = `${API}/school/comunicar/audiencia?modo=${audienciaModo}`;
    if (audienciaModo === "turma" && audienciaTurmaId) url += `&turma_id=${audienciaTurmaId}`;
    fetch(url, { headers: authH })
      .then(r => r.ok ? r.json() : { registados: [], nao_registados: [] })
      .then(d => setAudiencia(d)).finally(() => setLoadingAudiencia(false));
  };

  const loadComunicados = () => {
    setLoadingComuns(true);
    fetch(`${API}/school/comunicados`, { headers: authH })
      .then(r => r.ok ? r.json() : []).then(d => setComunicados(d)).finally(() => setLoadingComuns(false));
  };

  const fetchStats = () =>
    fetch(`${API}/school/sms/stats`, { headers: authH }).then(r => r.ok ? r.json() : null).then(d => d && setStats(d));

  const fetchLogs = (page: number) => {
    setLogsLoading(true); setLogsPage(page);
    fetch(`${API}/school/sms/logs?page=${page}&limit=20`, { headers: authH })
      .then(r => r.json()).then(d => { setLogs(d.logs ?? []); setLogsTotal(d.total ?? 0); })
      .finally(() => setLogsLoading(false));
  };

  const allEncs = useMemo(() => [
    ...audiencia.registados.map(e => ({ ...e, tem_portal: true })),
    ...audiencia.nao_registados.map(e => ({ ...e, tem_portal: false })),
  ].filter(e => e.telefone), [audiencia]);

  const filteredEncs = useMemo(() => encSearch.trim()
    ? allEncs.filter(e =>
        e.nome?.toLowerCase().includes(encSearch.toLowerCase()) ||
        e.telefone?.includes(encSearch) ||
        e.alunos?.some((a: string) => a?.toLowerCase().includes(encSearch.toLowerCase())))
    : allEncs, [allEncs, encSearch]);

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) setSelectedPhones(filteredEncs.map(e => e.telefone)); else setSelectedPhones([]);
  };
  const togglePhone = (phone: string) => {
    setSelectedPhones(prev => prev.includes(phone) ? prev.filter(p => p !== phone) : [...prev, phone]);
    setSelectAll(false);
  };

  const handlePublish = async () => {
    if (!conteudo.trim()) return;
    if ((canal === "portal" || canal === "ambos") && !titulo.trim()) { alert("Preencha o título para publicar no portal."); return; }
    if ((canal === "sms" || canal === "ambos") && selectedPhones.length === 0) { alert("Selecione pelo menos um destinatário para enviar SMS."); return; }
    setPublishing(true); setPublishResult(null);
    try {
      const r = await fetch(`${API}/school/comunicar/publicar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authH },
        body: JSON.stringify({ titulo: titulo.trim() || undefined, conteudo: conteudo.trim(), prioridade, canal, phones: canal !== "portal" ? selectedPhones : undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setPublishResult(d); setTitulo(""); setConteudo(""); setPrioridade("normal");
      setCanal("portal"); setSelectedPhones([]); setSelectAll(false); setPickedTemplate("");
      if (d.comunicado_id) loadComunicados();
      fetchStats();
    } catch (e: any) { alert(e.message ?? "Erro ao publicar."); } finally { setPublishing(false); }
  };

  const handleAnivFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert("A foto não pode exceder 2MB."); return; }
    const reader = new FileReader();
    reader.onload = () => { const d = reader.result as string; setAnivFotoPreview(d); setAnivFotoData(d); };
    reader.readAsDataURL(file);
  };

  const selectAnivStudent = (a: any) => {
    const age = a.data_nascimento
      ? new Date().getFullYear() - new Date(a.data_nascimento).getFullYear()
      : null;
    setAnivStudentId(a.id); setAnivStudentNome(a.nome);
    setAnivManualSearch(""); setAnivManualResults([]);
    setAnivTitulo(`🎂 Parabéns, ${a.nome.split(" ")[0]}!`);
    setAnivMensagem(`🎂 Feliz Aniversário, ${a.nome}! 🎉\n\nA nossa escola deseja-te um dia repleto de alegria e muitas felicidades.${age ? ` Que os teus ${age} anos sejam cheios de conquistas e sorrisos!` : " Que o teu dia especial seja cheio de conquistas e sorrisos!"} 🌟`);
  };

  const handlePublishAniversario = async () => {
    if (!anivTitulo.trim() || !anivMensagem.trim()) return;
    setAnivPublishing(true); setAnivResult(false);
    try {
      const r = await fetch(`${API}/school/comunicar/aniversario`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authH },
        body: JSON.stringify({ titulo: anivTitulo.trim(), conteudo: anivMensagem.trim(), foto_base64: anivFotoData, student_id: anivStudentId }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      setAnivResult(true);
      setAnivFotoPreview(null); setAnivFotoData(null);
      setAnivTitulo(""); setAnivMensagem(""); setAnivStudentId(null); setAnivStudentNome("");
      loadComunicados();
    } catch (e: any) { alert(e.message ?? "Erro ao publicar."); } finally { setAnivPublishing(false); }
  };

  const handleDelete = async (id: number) => {
    setDeleteId(id);
    try {
      await fetch(`${API}/school/comunicados/${id}`, { method: "DELETE", headers: authH });
      setComunicados(prev => prev.filter(c => c.id !== id));
    } catch { alert("Erro ao eliminar."); } finally { setDeleteId(null); }
  };

  const prioridadeBadge = (p: string) => {
    const cls: Record<string, string> = { urgente: "bg-red-100 text-red-700 border-red-200", alta: "bg-amber-100 text-amber-700 border-amber-200", normal: "bg-slate-100 text-slate-600 border-slate-200" };
    const lbl: Record<string, string> = { urgente: "Urgente", alta: "Alta", normal: "Normal" };
    return <span className={`px-2 py-0.5 rounded text-xs font-medium border ${cls[p] ?? cls.normal}`}>{lbl[p] ?? p}</span>;
  };
  const statusBadge = (s: string) => s === "sent"
    ? <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Enviado</span>
    : <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Falhou</span>;
  const eventLabel = (e: string) => SMS_EVENTS.find(ev => ev.key === e)?.label ?? e;
  const totalLogPages = Math.ceil(logsTotal / 20);

  const CANAL_OPTIONS = [
    { key: "portal" as const, icon: <Megaphone className="w-4 h-4"/>, label: "Portal", desc: "Visível no portal do encarregado" },
    { key: "sms" as const, icon: <Smartphone className="w-4 h-4"/>, label: "SMS", desc: "Enviado por mensagem SMS" },
    { key: "ambos" as const, icon: <Send className="w-4 h-4"/>, label: "Portal + SMS", desc: "Portal e SMS simultâneo" },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-primary"/> Comunicar
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">Portal, SMS e histórico de comunicações</p>
        </div>
        <div className="flex gap-2">
          {stats && (
            <div className="text-center px-3 py-1.5 bg-emerald-50 rounded-xl border border-emerald-100">
              <div className="text-base font-bold text-emerald-700">{stats.sent}</div>
              <div className="text-[10px] text-emerald-600">SMS Enviados</div>
            </div>
          )}
          <div className="text-center px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-base font-bold text-slate-700">{comunicados.length}</div>
            <div className="text-[10px] text-slate-500">Comunicados</div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit flex-wrap">
        {([
          { k: "compor" as ComunicarTab, label: "Compor" },
          { k: "publicados" as ComunicarTab, label: `Publicados${comunicados.length ? ` (${comunicados.length})` : ""}` },
          { k: "historico" as ComunicarTab, label: "Histórico" },
          ...(moduloInfantil ? [{ k: "aniversario" as ComunicarTab, label: "🎂 Aniversário" }] : []),
          { k: "push" as ComunicarTab, label: "🔔 Push" },
        ]).map(({ k, label }) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === k ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── COMPOR ── */}
      {tab === "compor" && (
        <div className="space-y-5">
          {/* Canal */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Canal de envio</p>
            <div className="grid grid-cols-3 gap-3">
              {CANAL_OPTIONS.map(({ key, icon, label, desc }) => (
                <button key={key} onClick={() => setCanal(key)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all ${canal === key ? "bg-primary/10 border-primary text-primary" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                  {icon}
                  <span className="text-sm font-semibold">{label}</span>
                  <span className="text-[10px] text-slate-400 leading-tight">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Composer */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <h3 className="font-semibold text-slate-900">Mensagem</h3>
            {(canal === "sms" || canal === "ambos") && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Usar template SMS</p>
                <div className="flex flex-wrap gap-2">
                  {SMS_EVENTS.map(ev => (
                    <button key={ev.key}
                      onClick={() => { setConteudo(templates[ev.key] ?? DEFAULT_TEMPLATES[ev.key] ?? ""); setPickedTemplate(ev.key); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${pickedTemplate === ev.key ? "bg-primary text-white border-primary" : "bg-slate-50 text-slate-700 border-slate-200 hover:border-primary/40"}`}>
                      {ev.label}
                    </button>
                  ))}
                  {pickedTemplate && (
                    <button onClick={() => { setConteudo(""); setPickedTemplate(""); }}
                      className="px-3 py-1.5 rounded-lg text-xs border border-slate-200 text-slate-400 hover:text-red-500">Limpar</button>
                  )}
                </div>
              </div>
            )}
            {(canal === "portal" || canal === "ambos") && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Título *</label>
                <input value={titulo} onChange={e => setTitulo(e.target.value)}
                  placeholder="Ex: Reunião de encarregados — 30 de Abril"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"/>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {canal === "sms" ? "Mensagem SMS *" : canal === "portal" ? "Conteúdo *" : "Conteúdo / Mensagem SMS *"}
              </label>
              <textarea value={conteudo} onChange={e => { setConteudo(e.target.value); setPickedTemplate(""); }} rows={4}
                placeholder={canal === "sms" ? "Texto da mensagem SMS…" : "Escreva o comunicado para os encarregados…"}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"/>
              {(canal === "sms" || canal === "ambos") && (
                <p className="text-xs text-slate-400 mt-1">{conteudo.length} car. · {Math.ceil(Math.max(1, conteudo.length) / 160)} SMS</p>
              )}
            </div>
            {(canal === "portal" || canal === "ambos") && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Prioridade</label>
                <div className="flex gap-2">
                  {(["normal", "alta", "urgente"] as const).map(p => (
                    <button key={p} onClick={() => setPrioridade(p)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border capitalize transition-all ${
                        prioridade === p
                          ? p === "urgente" ? "bg-red-600 border-red-600 text-white" : p === "alta" ? "bg-amber-500 border-amber-500 text-white" : "bg-primary border-primary text-white"
                          : "border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}>
                      {p === "normal" ? "Normal" : p === "alta" ? "Alta" : "Urgente"}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Audiência — only for SMS/ambos */}
          {(canal === "sms" || canal === "ambos") && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
              <h3 className="font-semibold text-slate-900">Audiência</h3>
              <div className="flex flex-wrap gap-2 items-center">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide w-full">Filtro rápido</p>
                {([{ k: "todos" as const, label: "Todos" }, { k: "devedores" as const, label: "Devedores" }]).map(({ k, label }) => (
                  <button key={k} onClick={() => { setAudienciaModo(k); setAudienciaTurmaId(null); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${audienciaModo === k ? "bg-primary text-white border-primary" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                    {label}
                  </button>
                ))}
                <select
                  value={audienciaModo === "turma" ? (audienciaTurmaId ?? "") : ""}
                  onChange={e => { if (e.target.value) { setAudienciaModo("turma"); setAudienciaTurmaId(Number(e.target.value)); } }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${audienciaModo === "turma" ? "bg-primary text-white border-primary" : "border-slate-200 text-slate-600"}`}>
                  <option value="">Por Turma…</option>
                  {turmas.map((t: any) => <option key={t.id} value={t.id}>{t.nome}{t.turno ? ` — ${t.turno}` : ""}</option>)}
                </select>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    {loadingAudiencia ? "A carregar…" : `${allEncs.length} encarregados (${audiencia.registados.length} portal · ${audiencia.nao_registados.length} só SMS)`}
                  </p>
                  <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={selectAll} onChange={e => handleSelectAll(e.target.checked)} className="rounded"/>
                    Todos ({filteredEncs.length})
                  </label>
                </div>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                  <input value={encSearch} onChange={e => setEncSearch(e.target.value)}
                    placeholder="Pesquisar por nome, telefone ou aluno…"
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"/>
                </div>
                {loadingAudiencia ? (
                  <div className="flex justify-center py-8"><RefreshCw className="w-5 h-5 animate-spin text-primary"/></div>
                ) : filteredEncs.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30"/>
                    <p className="text-sm">Nenhum encarregado neste segmento.</p>
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-100">
                    {filteredEncs.map((enc, i) => {
                      const sel = selectedPhones.includes(enc.telefone);
                      return (
                        <label key={`${enc.telefone}-${i}`}
                          className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${sel ? "bg-primary/5 border-l-2 border-primary" : "hover:bg-slate-50 border-l-2 border-transparent"}`}>
                          <input type="checkbox" checked={sel} onChange={() => togglePhone(enc.telefone)} className="rounded text-primary"/>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium text-slate-800 truncate">{enc.nome ?? "Sem nome"}</p>
                              {enc.tem_portal
                                ? <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">Portal</span>
                                : <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">Só SMS</span>
                              }
                            </div>
                            <p className="text-xs text-slate-400 truncate">{enc.telefone}{enc.alunos?.length ? ` · ${(enc.alunos as string[]).filter(Boolean).join(", ")}` : ""}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
                {selectedPhones.length > 0 && (
                  <p className="text-xs text-primary font-medium">{selectedPhones.length} seleccionado(s)</p>
                )}
              </div>
            </div>
          )}

          {publishResult && (
            <div className="rounded-xl p-4 flex items-center gap-3 bg-emerald-50 border border-emerald-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0"/>
              <p className="text-sm font-medium text-emerald-800">
                {publishResult.comunicado_id ? "Comunicado publicado no portal. " : ""}
                {(publishResult.sms_sent ?? 0) > 0 ? `${publishResult.sms_sent} SMS enviado(s).` : ""}
                {(publishResult.sms_failed ?? 0) > 0 ? ` ${publishResult.sms_failed} falha(s).` : ""}
              </p>
            </div>
          )}
          <div className="flex justify-end">
            <button onClick={handlePublish} disabled={publishing || !conteudo.trim()}
              className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {publishing ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}
              {publishing ? "A processar…" : canal === "portal" ? "Publicar no Portal" : canal === "sms" ? `Enviar SMS (${selectedPhones.length})` : `Publicar + Enviar SMS (${selectedPhones.length})`}
            </button>
          </div>
        </div>
      )}

      {/* ── PUBLICADOS ── */}
      {tab === "publicados" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{comunicados.length} comunicado(s) publicado(s) no portal dos encarregados</p>
            <button onClick={() => setTab("compor")}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4"/> Novo
            </button>
          </div>
          {loadingComuns ? (
            <div className="flex justify-center py-20"><RefreshCw className="w-5 h-5 animate-spin text-primary"/></div>
          ) : comunicados.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-slate-400 gap-2">
              <Megaphone className="w-8 h-8 opacity-40"/>
              <p className="text-sm">Nenhum comunicado publicado ainda.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {comunicados.map((c: any) => (
                <div key={c.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {prioridadeBadge(c.prioridade)}
                        <span className="text-xs text-slate-400">{new Date(c.created_at).toLocaleDateString("pt-AO", { day: "2-digit", month: "short", year: "numeric" })}</span>
                        <span className="text-xs text-slate-400 flex items-center gap-1"><CheckCheck className="w-3.5 h-3.5"/>{c.total_lidos} lido(s)</span>
                      </div>
                              <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-slate-900 text-sm">{c.titulo}</h3>
                        {c.tipo === "aniversario" && <span className="text-[10px] bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded-full font-medium border border-pink-200">🎂 Aniversário</span>}
                      </div>
                      {c.foto_base64 && (
                        <img src={c.foto_base64} alt="Foto do aniversário" className="mt-2 w-full max-h-40 object-cover rounded-xl border border-slate-200"/>
                      )}
                      <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{c.conteudo}</p>
                    </div>
                    <button onClick={() => handleDelete(c.id)} disabled={deleteId === c.id}
                      className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40">
                      <Trash2 className="w-4 h-4"/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── HISTÓRICO ── */}
      {tab === "historico" && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Histórico de SMS ({logsTotal})</h3>
            <button onClick={() => fetchLogs(logsPage)} className="text-xs text-primary hover:underline flex items-center gap-1">
              <RefreshCw className="w-3 h-3"/> Actualizar
            </button>
          </div>
          {logsLoading ? (
            <div className="flex justify-center py-12"><RefreshCw className="w-5 h-5 animate-spin text-primary"/></div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30"/>
              <p className="text-sm">Nenhum SMS enviado ainda.</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-slate-100">
                {logs.map((log: any) => (
                  <div key={log.id} className="px-5 py-3 flex items-start gap-4">
                    <div className="mt-0.5">{statusBadge(log.status)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium text-slate-700">{log.telefone}</span>
                        {log.evento && <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{eventLabel(log.evento)}</span>}
                      </div>
                      <p className="text-sm text-slate-600 line-clamp-2">{log.mensagem}</p>
                    </div>
                    <span className="text-xs text-slate-400 whitespace-nowrap">
                      {new Date(log.data_envio).toLocaleString("pt-AO", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
              {totalLogPages > 1 && (
                <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
                  <button onClick={() => fetchLogs(logsPage - 1)} disabled={logsPage <= 1}
                    className="flex items-center gap-1 text-sm text-slate-600 disabled:opacity-40 hover:text-primary">
                    <ChevronLeft className="w-4 h-4"/> Anterior
                  </button>
                  <span className="text-xs text-slate-500">{logsPage} / {totalLogPages}</span>
                  <button onClick={() => fetchLogs(logsPage + 1)} disabled={logsPage >= totalLogPages}
                    className="flex items-center gap-1 text-sm text-slate-600 disabled:opacity-40 hover:text-primary">
                    Próximo <ChevronRight className="w-4 h-4"/>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── ANIVERSÁRIO ── */}
      {tab === "aniversario" && moduloInfantil && (
        <div className="space-y-5">
          {/* Aniversariantes do dia */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                🎂 Aniversariantes Hoje
              </h3>
              <span className="text-xs bg-pink-100 text-pink-700 px-2.5 py-1 rounded-full font-medium">
                {new Date().toLocaleDateString("pt-AO", { day: "2-digit", month: "long" })}
              </span>
            </div>
            {loadingAniv ? (
              <div className="flex justify-center py-8"><RefreshCw className="w-5 h-5 animate-spin text-pink-400"/></div>
            ) : aniversariantesHoje.length === 0 ? (
              <div className="text-center py-6 text-slate-400">
                <div className="text-3xl mb-2">🎈</div>
                <p className="text-sm">Nenhum aniversariante hoje.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {aniversariantesHoje.map((a: any) => {
                  const sel = anivStudentId === a.id;
                  const age = new Date().getFullYear() - new Date(a.data_nascimento).getFullYear();
                  return (
                    <button key={a.id} onClick={() => selectAnivStudent(a)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${sel ? "bg-pink-50 border-pink-300 shadow-sm" : "border-slate-200 hover:border-pink-200 hover:bg-pink-50/40"}`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-2xl flex-shrink-0 ${sel ? "bg-pink-200" : "bg-slate-100"}`}>
                        🎂
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{a.nome}</p>
                        <p className="text-xs text-slate-500">{age} anos · {new Date(a.data_nascimento).toLocaleDateString("pt-AO", { day: "2-digit", month: "long", year: "numeric" })}</p>
                      </div>
                      {sel && <CheckCircle2 className="w-5 h-5 text-pink-500 flex-shrink-0"/>}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Selecção manual ── */}
            <div className="border-t border-slate-100 pt-4 space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5"/> Selecionar outro aniversariante
              </p>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                <input
                  value={anivManualSearch}
                  onChange={e => setAnivManualSearch(e.target.value)}
                  placeholder="Pesquisar aluno por nome…"
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-300 transition-all"/>
                {anivManualSearching && (
                  <RefreshCw className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin"/>
                )}
              </div>
              {anivManualResults.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  {anivManualResults.map((s: any) => (
                    <button key={s.id} onClick={() => selectAnivStudent(s)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-pink-50 transition-colors text-left border-b border-slate-50 last:border-0">
                      <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center text-sm flex-shrink-0">
                        🎂
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate">{s.nome}</p>
                        <p className="text-xs text-slate-400">{s.turma ?? "Sem turma"}{s.numero_processo ? ` · Proc: ${s.numero_processo}` : ""}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {anivStudentId && anivStudentNome && (
                <div className="flex items-center gap-2.5 p-2.5 bg-pink-50 rounded-xl border border-pink-200">
                  <span className="text-lg flex-shrink-0">🎂</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-pink-600 font-semibold">Aniversariante seleccionado</p>
                    <p className="text-sm font-bold text-pink-800 truncate">{anivStudentNome}</p>
                  </div>
                  <button onClick={() => { setAnivStudentId(null); setAnivStudentNome(""); setAnivTitulo(""); setAnivMensagem(""); }}
                    className="p-1 rounded-lg text-pink-400 hover:text-pink-600 hover:bg-pink-100 flex-shrink-0">
                    <X className="w-4 h-4"/>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Foto */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <h3 className="font-semibold text-slate-900">Foto do Aniversário <span className="text-xs font-normal text-slate-400">(opcional)</span></h3>
            {anivFotoPreview ? (
              <div className="relative">
                <img src={anivFotoPreview} alt="Pré-visualização" className="w-full max-h-52 object-cover rounded-xl border border-slate-200"/>
                <button onClick={() => { setAnivFotoPreview(null); setAnivFotoData(null); }}
                  className="absolute top-2 right-2 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center hover:bg-red-50 transition-colors">
                  <X className="w-4 h-4 text-red-500"/>
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center gap-3 p-8 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-pink-300 hover:bg-pink-50/20 transition-all">
                <ImageIcon className="w-8 h-8 text-slate-300"/>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-700">Clique para adicionar foto</p>
                  <p className="text-xs text-slate-400 mt-0.5">PNG, JPG ou WEBP · máx. 2MB</p>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handleAnivFotoChange}/>
              </label>
            )}
          </div>

          {/* Mensagem */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <h3 className="font-semibold text-slate-900">Mensagem de Aniversário</h3>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Título *</label>
              <input value={anivTitulo} onChange={e => setAnivTitulo(e.target.value)}
                placeholder="Ex: 🎂 Parabéns, Maria!"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-200 transition-all"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Mensagem *</label>
              <textarea value={anivMensagem} onChange={e => setAnivMensagem(e.target.value)} rows={5}
                placeholder="Escreva a mensagem de aniversário para os encarregados…"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-200 resize-none transition-all"/>
              <p className="text-xs text-slate-400 mt-1">Será publicado no portal dos encarregados de educação.</p>
            </div>
          </div>

          {anivResult && (
            <div className="rounded-xl p-4 flex items-center gap-3 bg-emerald-50 border border-emerald-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0"/>
              <p className="text-sm font-medium text-emerald-800">Comunicado de aniversário publicado com sucesso no portal! 🎉</p>
            </div>
          )}

          <div className="flex justify-end">
            <button onClick={handlePublishAniversario}
              disabled={anivPublishing || !anivMensagem.trim() || !anivTitulo.trim()}
              className="flex items-center gap-2 bg-pink-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-pink-600 disabled:opacity-50 transition-colors">
              {anivPublishing ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}
              {anivPublishing ? "A publicar…" : "Publicar Aniversário 🎂"}
            </button>
          </div>
        </div>
      )}

      {/* ── PUSH NOTIFICATIONS ── */}
      {tab === "push" && (
        <div className="space-y-5">
          {/* Stats */}
          {pushStats && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-center gap-6">
              <div className="text-center">
                <p className="text-xl font-bold text-indigo-700">{pushStats.total}</p>
                <p className="text-xs text-indigo-500">Dispositivos</p>
              </div>
              <div className="w-px h-10 bg-indigo-200"/>
              <div className="text-center">
                <p className="text-lg font-bold text-indigo-700">{pushStats.guardians}</p>
                <p className="text-xs text-indigo-500">Encarregados</p>
              </div>
              <div className="w-px h-10 bg-indigo-200"/>
              <div className="text-center">
                <p className="text-lg font-bold text-indigo-700">{pushStats.staff}</p>
                <p className="text-xs text-indigo-500">Funcionários</p>
              </div>
              {pushStats.total === 0 && (
                <p className="text-xs text-indigo-600 ml-2">Nenhum dispositivo registado. Os utilizadores precisam de activar notificações na aplicação móvel.</p>
              )}
            </div>
          )}

          {/* Templates */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Usar Template</p>
            <div className="flex flex-wrap gap-2">
              {([
                { key: "nova_fatura",          label: "Nova Fatura",          titulo: "Nova Propina Disponível",    mensagem: "A propina de {mes} no valor de {valor} Kz está disponível. {reference_info}" },
                { key: "pagamento_confirmado", label: "Pagamento Confirmado", titulo: "Pagamento Confirmado ✓",     mensagem: "Pagamento de {nome_aluno} no valor de {valor} Kz recebido com sucesso. Obrigado." },
                { key: "atraso_pagamento",     label: "Atraso de Pagamento",  titulo: "⚠️ Propina em Atraso",      mensagem: "A propina de {mes} está em atraso. Regularize para evitar multa." },
                { key: "multa_aplicada",       label: "Multa Aplicada",       titulo: "Multa Aplicada",             mensagem: "Foi aplicada uma multa de {valor_multa} Kz à propina de {mes}." },
              ]).map(tpl => (
                <button key={tpl.key}
                  onClick={() => { setPushTitulo(tpl.titulo); setPushMensagem(tpl.mensagem); setPushPickedTemplate(tpl.key); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${pushPickedTemplate === tpl.key ? "bg-primary text-white border-primary" : "bg-slate-50 text-slate-700 border-slate-200 hover:border-primary/40"}`}>
                  {tpl.label}
                </button>
              ))}
              {pushPickedTemplate && (
                <button onClick={() => { setPushTitulo(""); setPushMensagem(""); setPushPickedTemplate(""); }}
                  className="px-3 py-1.5 rounded-lg text-xs border border-slate-200 text-slate-400 hover:text-red-500">Limpar</button>
              )}
            </div>
          </div>

          {/* Composer */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2"><Zap className="w-4 h-4 text-amber-500"/> Compor Push Notification</h3>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Título *</label>
              <input value={pushTitulo} onChange={e => setPushTitulo(e.target.value)}
                placeholder="Ex: Reunião de Encarregados — Amanhã às 15h"
                maxLength={65}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"/>
              <p className="text-xs text-slate-400 mt-1 text-right">{pushTitulo.length}/65</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Mensagem *</label>
              <textarea value={pushMensagem} onChange={e => setPushMensagem(e.target.value)} rows={3}
                placeholder="Escreva o corpo da notificação push…"
                maxLength={200}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"/>
              <p className="text-xs text-slate-400 mt-1 text-right">{pushMensagem.length}/200</p>
            </div>
          </div>

          {/* Audience */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Destinatários</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {([
                { k: "todos" as const,       label: "Toda a Escola" },
                { k: "encarregados" as const, label: "Encarregados" },
                { k: "professores" as const,  label: "Funcionários" },
                { k: "turma" as const,        label: "Por Turma" },
                { k: "especifico" as const,   label: "Específico(s)" },
              ]).map(({ k, label }) => (
                <button key={k} onClick={() => { setPushAudiencia(k); setPushTurmaId(null); setPushGuardianIds([]); setPushGuardianSearch(""); }}
                  className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${pushAudiencia === k ? "bg-primary/10 border-primary text-primary" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                  {label}
                </button>
              ))}
            </div>

            {pushAudiencia === "turma" && (
              <select value={pushTurmaId ?? ""} onChange={e => setPushTurmaId(Number(e.target.value) || null)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                <option value="">Selecionar turma…</option>
                {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            )}

            {pushAudiencia === "especifico" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">Seleccione um ou mais encarregados</p>
                  {pushGuardianIds.length > 0 && (
                    <button onClick={() => setPushGuardianIds([])} className="text-xs text-slate-400 hover:text-red-500">Limpar ({pushGuardianIds.length})</button>
                  )}
                </div>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                  <input value={pushGuardianSearch} onChange={e => setPushGuardianSearch(e.target.value)}
                    placeholder="Pesquisar por nome ou aluno…"
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"/>
                </div>
                {pushLoadingGuardians ? (
                  <div className="flex justify-center py-6"><RefreshCw className="w-4 h-4 animate-spin text-primary"/></div>
                ) : (
                  <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-100 divide-y divide-slate-50">
                    {(pushGuardianSearch.trim()
                      ? pushAllGuardians.filter(g =>
                          g.nome?.toLowerCase().includes(pushGuardianSearch.toLowerCase()) ||
                          g.alunos?.some((a: string) => a?.toLowerCase().includes(pushGuardianSearch.toLowerCase())))
                      : pushAllGuardians
                    ).map((g: any) => {
                      const sel = pushGuardianIds.includes(g.id);
                      return (
                        <label key={g.id}
                          className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${sel ? "bg-primary/5 border-l-2 border-primary" : "hover:bg-slate-50 border-l-2 border-transparent"}`}>
                          <input type="checkbox" checked={sel}
                            onChange={() => setPushGuardianIds(prev => sel ? prev.filter(x => x !== g.id) : [...prev, g.id])}
                            className="rounded text-primary"/>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{g.nome ?? "Sem nome"}</p>
                            {g.alunos?.length > 0 && (
                              <p className="text-xs text-slate-400 truncate">{(g.alunos as string[]).filter(Boolean).join(", ")}</p>
                            )}
                          </div>
                        </label>
                      );
                    })}
                    {pushAllGuardians.length === 0 && !pushLoadingGuardians && (
                      <p className="text-xs text-slate-400 text-center py-6">Nenhum encarregado com portal activo.</p>
                    )}
                  </div>
                )}
                {pushGuardianIds.length > 0 && (
                  <p className="text-xs text-primary font-medium">{pushGuardianIds.length} encarregado(s) seleccionado(s)</p>
                )}
              </div>
            )}
          </div>

          {/* Result */}
          {pushResult && (
            <div className={`rounded-2xl p-4 flex items-start gap-3 ${pushResult.ok && (pushResult.sent ?? 0) > 0 ? "bg-emerald-50 border border-emerald-200" : pushResult.ok ? "bg-amber-50 border border-amber-200" : "bg-red-50 border border-red-200"}`}>
              {pushResult.ok && (pushResult.sent ?? 0) > 0
                ? <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5"/>
                : <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5"/>}
              <div>
                {pushResult.ok
                  ? <p className="text-sm font-medium text-slate-800">{pushResult.message ?? `Push enviada: ${pushResult.sent} entregues, ${pushResult.failed ?? 0} falharam (de ${pushResult.total_devices} dispositivos). Ambiente: ${pushResult.environment}.`}</p>
                  : <p className="text-sm font-medium text-red-800">{pushResult.error ?? "Erro ao enviar notificações."}</p>}
              </div>
            </div>
          )}

          {/* Send button */}
          <div className="flex justify-end">
            <button onClick={handlePush}
              disabled={pushing || !pushTitulo.trim() || !pushMensagem.trim() || (pushAudiencia === "turma" && !pushTurmaId) || (pushAudiencia === "especifico" && pushGuardianIds.length === 0)}
              className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {pushing ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Zap className="w-4 h-4"/>}
              {pushing ? "A disparar…" : pushAudiencia === "especifico" ? `Disparar para ${pushGuardianIds.length} encarregado(s)` : "Disparar Comunicado Push"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ComunicacaoView — DEPRECATED (kept for reference, not used)
   ═══════════════════════════════════════════════════════════════ */
function ComunicacaoView({ token }: { token: string }) {
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"config" | "enviar" | "logs">("config");

  // Settings fields
  const [smsActivo, setSmsActivo] = useState(false);
  const [provider, setProvider] = useState("mock");
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [senderName, setSenderName] = useState("KiwaraEsc");
  const [eventos, setEventos] = useState<Record<string, boolean>>({
    nova_fatura: true, pagamento_confirmado: true, atraso_pagamento: true, multa_aplicada: true,
  });
  const [templates, setTemplates] = useState<Record<string, string>>({ ...DEFAULT_TEMPLATES });
  const [editingTemplate, setEditingTemplate] = useState<SmsEventKey | null>(null);

  // Encarregados for manual send
  const [encarregados, setEncarregados] = useState<{ registados: any[]; nao_registados: any[] }>({ registados: [], nao_registados: [] });
  const [encLoading, setEncLoading] = useState(false);
  const [encSearch, setEncSearch] = useState("");
  const [selectedPhones, setSelectedPhones] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [sendMsg, setSendMsg] = useState("");
  const [pickedTemplate, setPickedTemplate] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number } | null>(null);

  // Logs
  const [logs, setLogs] = useState<any[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [logsLoading, setLogsLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);

  const authH = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch(`${API}/school/settings`, { headers: authH })
      .then(r => r.json())
      .then(data => {
        setSettings(data);
        const comm = data?.comunicacao ?? {};
        setSmsActivo(comm.sms_activo ?? false);
        setProvider(comm.sms_provider ?? "mock");
        setApiUrl(comm.sms_api_url ?? "");
        setApiKey(comm.sms_api_key ?? "");
        setSenderName(comm.sms_sender_name ?? "KiwaraEsc");
        setEventos(comm.eventos ?? { nova_fatura: true, pagamento_confirmado: true, atraso_pagamento: true, multa_aplicada: true });
        setTemplates({ ...DEFAULT_TEMPLATES, ...(comm.sms_templates ?? {}) });
      });
    fetchStats();
  }, [token]);

  useEffect(() => {
    if (activeTab === "logs") fetchLogs(1);
    if (activeTab === "enviar") fetchEncarregados();
  }, [activeTab]);

  const fetchStats = () => {
    fetch(`${API}/school/sms/stats`, { headers: authH })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setStats(d));
  };

  const fetchEncarregados = () => {
    setEncLoading(true);
    fetch(`${API}/school/sms/encarregados`, { headers: authH })
      .then(r => r.ok ? r.json() : { registados: [], nao_registados: [] })
      .then(d => setEncarregados(d))
      .finally(() => setEncLoading(false));
  };

  const fetchLogs = (page: number) => {
    setLogsLoading(true);
    setLogsPage(page);
    fetch(`${API}/school/sms/logs?page=${page}&limit=20`, { headers: authH })
      .then(r => r.json())
      .then(d => { setLogs(d.logs ?? []); setLogsTotal(d.total ?? 0); })
      .finally(() => setLogsLoading(false));
  };

  const saveConfig = async () => {
    if (!settings) return;
    setSaving(true);
    const patch = {
      ...settings,
      comunicacao: {
        ...(settings.comunicacao ?? {}),
        sms_activo: smsActivo,
        sms_provider: provider,
        sms_api_url: apiUrl,
        sms_api_key: apiKey,
        sms_sender_name: senderName,
        eventos,
        sms_templates: templates,
      },
    };
    await fetch(`${API}/school/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authH },
      body: JSON.stringify(patch),
    });
    setSettings(patch);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  // All encarregados (registados + não-registados) merged for UI
  const allEncs = [
    ...encarregados.registados.map(e => ({ ...e, tipo: "registado" as const })),
    ...encarregados.nao_registados.map(e => ({ ...e, tipo: "nao_registado" as const })),
  ].filter(e => e.telefone);

  const filteredEncs = encSearch.trim()
    ? allEncs.filter(e =>
        e.nome?.toLowerCase().includes(encSearch.toLowerCase()) ||
        e.telefone?.includes(encSearch) ||
        e.alunos?.some((a: string) => a.toLowerCase().includes(encSearch.toLowerCase()))
      )
    : allEncs;

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) setSelectedPhones(filteredEncs.map(e => e.telefone));
    else setSelectedPhones([]);
  };

  const togglePhone = (phone: string) => {
    setSelectedPhones(prev =>
      prev.includes(phone) ? prev.filter(p => p !== phone) : [...prev, phone]
    );
    setSelectAll(false);
  };

  const handleSend = async () => {
    if (!sendMsg.trim() || !selectedPhones.length) return;
    setSending(true);
    setSendResult(null);
    const recipients = allEncs
      .filter(e => selectedPhones.includes(e.telefone))
      .map(e => ({ phone: e.telefone, name: e.nome ?? "" }));

    const r = await fetch(`${API}/school/sms/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authH },
      body: JSON.stringify({ mensagem: sendMsg, recipients }),
    });
    const d = await r.json();
    setSendResult(d);
    setSending(false);
    setSendMsg("");
    setSelectedPhones([]);
    setSelectAll(false);
    fetchStats();
  };

  const totalPages = Math.ceil(logsTotal / 20);

  const statusBadge = (s: string) => s === "sent"
    ? <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Enviado</span>
    : <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Falhou</span>;

  const eventLabel = (e: string) => SMS_EVENTS.find(ev => ev.key === e)?.label ?? e;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-primary"/> Comunicação & Notificações SMS
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">Notifique encarregados automaticamente sobre propinas, pagamentos e multas.</p>
        </div>
        {stats && (
          <div className="flex gap-3">
            <div className="text-center px-4 py-2 bg-emerald-50 rounded-xl border border-emerald-100">
              <div className="text-lg font-bold text-emerald-700">{stats.sent}</div>
              <div className="text-xs text-emerald-600">Enviados</div>
            </div>
            <div className="text-center px-4 py-2 bg-red-50 rounded-xl border border-red-100">
              <div className="text-lg font-bold text-red-700">{stats.failed}</div>
              <div className="text-xs text-red-600">Falhas</div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {(["config","enviar","logs"] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === t ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
            {t === "config" ? "Configuração" : t === "enviar" ? "Enviar SMS" : "Histórico"}
          </button>
        ))}
      </div>

      {/* Config Tab */}
      {activeTab === "config" && (
        <div className="space-y-5">
          {/* Main Toggle */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-900">Notificações SMS</p>
                <p className="text-sm text-slate-500">Activar envio automático de SMS para encarregados</p>
              </div>
              <button onClick={() => setSmsActivo(v => !v)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${smsActivo ? "bg-primary text-white" : "bg-slate-100 text-slate-600"}`}>
                {smsActivo ? <ToggleRight className="w-5 h-5"/> : <ToggleLeft className="w-5 h-5"/>}
                {smsActivo ? "Activado" : "Desactivado"}
              </button>
            </div>
          </div>

          {/* Provider Config */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <h3 className="font-semibold text-slate-900">Configuração do Provedor</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Provedor</label>
                <select value={provider} onChange={e => setProvider(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                  <option value="mock">Simulação (Mock)</option>
                  <option value="africastalking">Africa's Talking</option>
                  <option value="twilio">Twilio</option>
                  <option value="custom">Personalizado</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nome do Remetente</label>
                <input value={senderName} onChange={e => setSenderName(e.target.value)} maxLength={11}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="KiwaraEsc"/>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">URL do Endpoint (API do Provedor)</label>
                <input value={apiUrl} onChange={e => setApiUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="https://api.provedor.com/sms/send"/>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">API Key / Token de Autenticação</label>
                <input value={apiKey} onChange={e => setApiKey(e.target.value)} type="password"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="••••••••••••••••"/>
              </div>
            </div>
          </div>

          {/* Events */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <h3 className="font-semibold text-slate-900">Eventos Activos</h3>
            <div className="space-y-3">
              {SMS_EVENTS.map(ev => (
                <div key={ev.key} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{ev.label}</p>
                    <p className="text-xs text-slate-500">{ev.desc}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setEditingTemplate(editingTemplate === ev.key ? null : ev.key)}
                      className="text-xs text-primary hover:underline">
                      {editingTemplate === ev.key ? "Fechar" : "Editar template"}
                    </button>
                    <button onClick={() => setEventos(prev => ({ ...prev, [ev.key]: !prev[ev.key] }))}
                      className={`w-10 h-5 rounded-full transition-colors relative ${eventos[ev.key] ? "bg-primary" : "bg-slate-300"}`}>
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${eventos[ev.key] ? "translate-x-5" : ""}`}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Template Editor */}
          {editingTemplate && (() => {
            const evVars = TEMPLATE_VARS.filter(v => v.events.includes(editingTemplate));
            const preview = previewTemplate(templates[editingTemplate] ?? "");
            return (
              <div className="bg-blue-50 rounded-2xl border border-blue-200 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-blue-900 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4"/>
                    Template: {SMS_EVENTS.find(e => e.key === editingTemplate)?.label}
                  </h3>
                  <button onClick={() => setTemplates(prev => ({ ...prev, [editingTemplate]: DEFAULT_TEMPLATES[editingTemplate] }))}
                    className="text-xs text-blue-600 hover:underline font-medium">↩ Repor padrão</button>
                </div>

                {/* Editor */}
                <textarea
                  value={templates[editingTemplate]}
                  onChange={e => setTemplates(prev => ({ ...prev, [editingTemplate!]: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-blue-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none font-mono"/>

                {/* Variable chips */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-blue-800">Variáveis disponíveis — clique para inserir:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {evVars.map(v => (
                      <button key={v.key}
                        onClick={() => setTemplates(prev => ({ ...prev, [editingTemplate!]: (prev[editingTemplate!] ?? "") + v.key }))}
                        className="text-xs bg-white border border-blue-300 text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-100 transition-colors font-mono">
                        {v.key}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-1">
                    {evVars.map(v => (
                      <p key={v.key} className="text-xs text-blue-600">
                        <span className="font-mono font-semibold">{v.key}</span> — {v.label}
                        {v.key === "{reference_info}" && (
                          <span className="ml-1 text-blue-500 italic">
                            (ref. EMIS → "Ref: {v.sample}"; ref. interna → "Aceda ao Portal do Aluno para pagar.")
                          </span>
                        )}
                      </p>
                    ))}
                  </div>
                </div>

                {/* Live preview */}
                <div className="bg-white rounded-xl border border-blue-200 p-3">
                  <p className="text-xs font-semibold text-slate-500 mb-1.5">Pré-visualização (dados de exemplo):</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{preview}</p>
                  <p className="text-xs text-slate-400 mt-1">{preview.length} caracteres · {Math.ceil(preview.length / 160)} SMS</p>
                </div>
              </div>
            );
          })()}

          <div className="flex justify-end">
            <button onClick={saveConfig} disabled={saving}
              className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin"/> : saved ? <CheckCircle2 className="w-4 h-4"/> : <Send className="w-4 h-4"/>}
              {saved ? "Guardado!" : "Guardar Configurações"}
            </button>
          </div>
        </div>
      )}

      {/* Send SMS Tab */}
      {activeTab === "enviar" && (
        <div className="space-y-5">
          {/* Message Composer */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <h3 className="font-semibold text-slate-900">Mensagem</h3>

            {/* Template Picker */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Usar template</p>
              <div className="flex flex-wrap gap-2">
                {SMS_EVENTS.map(ev => (
                  <button key={ev.key}
                    onClick={() => {
                      setSendMsg(templates[ev.key] ?? DEFAULT_TEMPLATES[ev.key] ?? "");
                      setPickedTemplate(ev.key);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      pickedTemplate === ev.key
                        ? "bg-primary text-white border-primary shadow-sm"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:border-primary/40 hover:bg-primary/5"
                    }`}>
                    {ev.label}
                  </button>
                ))}
                {pickedTemplate && (
                  <button onClick={() => { setSendMsg(""); setPickedTemplate(""); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 transition-all">
                    Limpar
                  </button>
                )}
              </div>
              {pickedTemplate && (
                <p className="text-xs text-slate-400">Template carregado — pode editar o texto abaixo antes de enviar. As variáveis {"{..."} serão substituídas automaticamente.</p>
              )}
            </div>

            <textarea value={sendMsg} onChange={e => { setSendMsg(e.target.value); setPickedTemplate(""); }} rows={4}
              placeholder="Escreva a mensagem ou selecione um template acima..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"/>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{sendMsg.length} caracteres</span>
              <span>{Math.ceil(Math.max(1, sendMsg.length) / 160)} SMS</span>
            </div>
          </div>

          {/* Recipients — Encarregados */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900">Destinatários — Encarregados</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {encarregados.registados.length} registados no portal · {encarregados.nao_registados.length} sem conta portal
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input type="checkbox" checked={selectAll}
                  onChange={e => handleSelectAll(e.target.checked)} className="rounded"/>
                Seleccionar todos ({filteredEncs.length})
              </label>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input value={encSearch} onChange={e => setEncSearch(e.target.value)}
                placeholder="Pesquisar por nome, telefone ou aluno..."
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"/>
            </div>

            {encLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-5 h-5 animate-spin text-primary"/>
              </div>
            ) : filteredEncs.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-30"/>
                <p className="text-sm">Nenhum encarregado encontrado.</p>
                <p className="text-xs mt-1">Certifique-se que os alunos têm encarregados associados.</p>
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-1 rounded-lg border border-slate-100">
                {filteredEncs.map((enc, i) => {
                  const isSelected = selectedPhones.includes(enc.telefone);
                  return (
                    <label key={`${enc.telefone}-${i}`}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${isSelected ? "bg-primary/5 border-l-2 border-primary" : "hover:bg-slate-50 border-l-2 border-transparent"}`}>
                      <input type="checkbox" checked={isSelected}
                        onChange={() => togglePhone(enc.telefone)}
                        className="rounded text-primary"/>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-slate-800 truncate">{enc.nome ?? "Sem nome"}</p>
                          {enc.tipo === "registado" && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap">Portal</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-slate-500">{enc.telefone}</span>
                          {enc.alunos?.length > 0 && (
                            <span className="text-xs text-slate-400 truncate">· {(enc.alunos as string[]).join(", ")}</span>
                          )}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            {selectedPhones.length > 0 && (
              <p className="text-xs text-primary font-medium">{selectedPhones.length} encarregado(s) seleccionado(s)</p>
            )}
          </div>

          {sendResult && (
            <div className={`rounded-xl p-4 flex items-center gap-3 ${sendResult.failed > 0 ? "bg-yellow-50 border border-yellow-200" : "bg-emerald-50 border border-emerald-200"}`}>
              <CheckCircle2 className={`w-5 h-5 ${sendResult.failed > 0 ? "text-yellow-600" : "text-emerald-600"}`}/>
              <p className="text-sm font-medium">
                {sendResult.sent} enviado(s) com sucesso · {sendResult.failed} falha(s)
              </p>
            </div>
          )}

          <div className="flex justify-end">
            <button onClick={handleSend} disabled={sending || !sendMsg.trim() || !selectedPhones.length}
              className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {sending ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}
              {sending ? "A enviar..." : `Enviar para ${selectedPhones.length} encarregado(s)`}
            </button>
          </div>
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === "logs" && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Histórico de SMS ({logsTotal})</h3>
            <button onClick={() => fetchLogs(logsPage)} className="text-xs text-primary hover:underline flex items-center gap-1">
              <RefreshCw className="w-3 h-3"/> Actualizar
            </button>
          </div>
          {logsLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-5 h-5 animate-spin text-primary"/>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30"/>
              <p className="text-sm">Nenhum SMS enviado ainda.</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-slate-100">
                {logs.map((log: any) => (
                  <div key={log.id} className="px-5 py-3 flex items-start gap-4">
                    <div className="mt-0.5">{statusBadge(log.status)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium text-slate-700">{log.telefone}</span>
                        {log.evento && <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{eventLabel(log.evento)}</span>}
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
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ComunicadosEscolaView — comunicados management for school portal
   ═══════════════════════════════════════════════════════════════ */
interface Comunicado {
  id: number; titulo: string; conteudo: string; prioridade: string;
  created_at: string; total_lidos: number;
}

function ComunicadosEscolaView({ token }: { token: string }) {
  const [list, setList] = useState<Comunicado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ titulo: "", conteudo: "", prioridade: "normal" });
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/school/comunicados`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error("Erro ao carregar comunicados");
      setList(await r.json());
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.titulo.trim() || !form.conteudo.trim()) return;
    setSaving(true);
    try {
      const r = await fetch(`${API}/school/comunicados`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error); }
      setForm({ titulo: "", conteudo: "", prioridade: "normal" });
      setShowForm(false);
      load();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    setDeleteId(id);
    try {
      await fetch(`${API}/school/comunicados/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setList(prev => prev.filter(c => c.id !== id));
    } catch { alert("Erro ao eliminar comunicado."); }
    finally { setDeleteId(null); }
  };

  const prioridadeBadge = (p: string) => {
    const map: Record<string, string> = {
      urgente: "bg-red-100 text-red-700 border-red-200",
      alta: "bg-amber-100 text-amber-700 border-amber-200",
      normal: "bg-slate-100 text-slate-600 border-slate-200",
    };
    const label: Record<string, string> = { urgente: "Urgente", alta: "Alta", normal: "Normal" };
    return <span className={`px-2 py-0.5 rounded text-xs font-medium border ${map[p] ?? map.normal}`}>{label[p] ?? p}</span>;
  };

  return (
    <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex-1 p-6 max-w-3xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Megaphone className="w-5 h-5 text-primary"/> Comunicados</h1>
          <p className="text-sm text-slate-500 mt-0.5">Mensagens publicadas para os encarregados</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4"/> Novo Comunicado
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Novo Comunicado</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Título *</label>
              <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Ex: Reunião de encarregados"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Conteúdo *</label>
              <textarea value={form.conteudo} onChange={e => setForm(f => ({ ...f, conteudo: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                rows={4} placeholder="Escreva o comunicado aqui…"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Prioridade</label>
              <select value={form.prioridade} onChange={e => setForm(f => ({ ...f, prioridade: e.target.value }))}
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={handleCreate} disabled={saving}
                className="px-5 py-2 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors">
                {saving ? "A guardar…" : "Publicar"}
              </button>
              <button onClick={() => setShowForm(false)} className="px-5 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2"/> A carregar…
        </div>
      ) : error ? (
        <div className="flex flex-col items-center py-20 text-red-500 gap-2"><AlertCircle className="w-6 h-6"/><p className="text-sm">{error}</p></div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-slate-400 gap-2">
          <Megaphone className="w-8 h-8 opacity-40"/>
          <p className="text-sm">Nenhum comunicado publicado.</p>
          <p className="text-xs">Crie um comunicado para os encarregados verem no portal.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map(c => (
            <div key={c.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {prioridadeBadge(c.prioridade)}
                    <span className="text-xs text-slate-400">{new Date(c.created_at).toLocaleDateString("pt-AO", { day: "2-digit", month: "short", year: "numeric" })}</span>
                    <span className="text-xs text-slate-400 flex items-center gap-1"><CheckCheck className="w-3.5 h-3.5"/>{c.total_lidos} lido(s)</span>
                  </div>
                  <h3 className="font-semibold text-slate-900 text-sm">{c.titulo}</h3>
                  <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{c.conteudo}</p>
                </div>
                <button onClick={() => handleDelete(c.id)} disabled={deleteId === c.id}
                  className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40">
                  <Trash2 className="w-4 h-4"/>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DDCancelamentosView — Motor de Débito Directo (School Portal)
   ═══════════════════════════════════════════════════════════════ */
interface DDSub {
  id: number; encarregado_id: number; encarregado_nome: string; encarregado_telefone: string;
  status: string; created_at: string; cancelled_at?: string; cancellation_requested_at?: string;
}
interface DDMandate {
  id: number; reference: string; encarregado_nome: string; telefone: string;
  status: string; iban: string; debit_day: number; created_at: string;
  susp_reason?: string; canc_reason?: string; last_collection_at?: string;
  cobranças_ok: number; cobranças_rejeitadas: number; total_cobrado: number;
}
interface DDStats { activos: string; suspensos: string; cancelados: string; expirados: string; pendentes: string; total_cobrado_aoa: string; total_rejeitadas: string; }
interface DDReconReport { id: number; report_date: string; total_enviado: number; total_aceite: number; total_rejeitado: number; total_pendente: number; total_devolvido: number; }

const DD_STATUS_MAP: Record<string, { label: string; cls: string }> = {
  ACTV:    { label: "Activo",          cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  SUSP:    { label: "Suspenso",        cls: "bg-amber-100 text-amber-700 border-amber-200" },
  CANC:    { label: "Cancelado",       cls: "bg-red-100 text-red-600 border-red-200" },
  EXPRD:   { label: "Expirado",        cls: "bg-slate-100 text-slate-400 border-slate-200" },
  PENDING: { label: "Pendente",        cls: "bg-blue-100 text-blue-600 border-blue-200" },
  active:  { label: "Activo",          cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  cancellation_requested: { label: "Canc. Pedido", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  cancelled: { label: "Cancelado",     cls: "bg-slate-100 text-slate-500 border-slate-200" },
};
function DDStatusBadge({ s }: { s: string }) {
  const cfg = DD_STATUS_MAP[s] ?? { label: s, cls: "bg-slate-100 text-slate-500 border-slate-200" };
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${cfg.cls}`}>{cfg.label}</span>;
}

function DDCancelamentosView({ token }: { token: string }) {
  const [ddTab, setDdTab]       = useState<"mandatos"|"pain008"|"pain002"|"reconciliacao">("mandatos");
  const [mandates, setMandates] = useState<DDMandate[]>([]);
  const [stats, setStats]       = useState<DDStats | null>(null);
  const [loadingM, setLoadingM] = useState(true);
  const [filterS, setFilterS]   = useState("todos");

  // PAIN.008
  const [p8Date, setP8Date]         = useState(() => { const d = new Date(); d.setDate(d.getDate() + 2); return d.toISOString().slice(0,10); });
  const [p8MaxBatch, setP8MaxBatch] = useState("500");
  const [p8Loading, setP8Loading]   = useState(false);
  const [p8Result, setP8Result]     = useState<any>(null);

  // PAIN.002
  const [p2Json, setP2Json]       = useState("");
  const [p2Date, setP2Date]       = useState(() => new Date().toISOString().slice(0,10));
  const [p2Loading, setP2Loading] = useState(false);
  const [p2Result, setP2Result]   = useState<any>(null);

  // Reconciliação
  const [recon, setRecon]         = useState<DDReconReport[]>([]);
  const [reconLoading, setReconLoading] = useState(false);

  const loadMandates = useCallback(async () => {
    setLoadingM(true);
    try {
      const [mR, sR] = await Promise.all([
        fetch(`${API}/school/dd/mandates?per_page=100`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/school/dd/stats`,                  { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (mR.ok) { const d = await mR.json(); setMandates(d.mandates ?? []); }
      if (sR.ok) setStats(await sR.json());
    } catch { /* ignore */ }
    finally { setLoadingM(false); }
  }, [token]);

  const loadRecon = useCallback(async () => {
    setReconLoading(true);
    try {
      const r = await fetch(`${API}/school/dd/reconciliation`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setRecon(await r.json());
    } catch { /* ignore */ }
    finally { setReconLoading(false); }
  }, [token]);

  useEffect(() => { loadMandates(); }, [loadMandates]);
  useEffect(() => { if (ddTab === "reconciliacao") loadRecon(); }, [ddTab, loadRecon]);

  const genPain008 = async () => {
    setP8Loading(true); setP8Result(null);
    try {
      const r = await fetch(`${API}/school/dd/pain008/generate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ collection_date: p8Date, max_batch: Number(p8MaxBatch) }),
      });
      setP8Result(await r.json());
    } catch (e: any) { setP8Result({ error: e.message }); }
    finally { setP8Loading(false); }
  };

  const processPain002 = async () => {
    setP2Loading(true); setP2Result(null);
    try {
      let entries: any[];
      try { entries = JSON.parse(p2Json); } catch { setP2Result({ error: "JSON inválido. Verifique o formato." }); setP2Loading(false); return; }
      const r = await fetch(`${API}/school/dd/pain002/process`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ entries, report_date: p2Date }),
      });
      setP2Result(await r.json());
    } catch (e: any) { setP2Result({ error: e.message }); }
    finally { setP2Loading(false); loadMandates(); }
  };

  const transitionMandate = async (id: number, newStatus: string, motivo: string) => {
    await fetch(`${API}/school/dd/mandates/${id}/transition`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ new_status: newStatus, motivo }),
    });
    loadMandates();
  };

  const filtered = filterS === "todos" ? mandates : mandates.filter(m => m.status === filterS);

  const SUB_TABS = [
    { key: "mandatos",      label: "Mandatos",     icon: <ArrowLeftRight className="w-3.5 h-3.5"/> },
    { key: "pain008",       label: "PAIN.008",     icon: <FileText className="w-3.5 h-3.5"/> },
    { key: "pain002",       label: "PAIN.002",     icon: <FileCheck className="w-3.5 h-3.5"/> },
    { key: "reconciliacao", label: "Reconciliação",icon: <BarChart3 className="w-3.5 h-3.5"/> },
  ] as const;

  return (
    <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex-1 p-6 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-primary"/> Débito Directo — EMIS SDD
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Motor ISO 20022 · PAIN.008 / PAIN.002</p>
        </div>
        <button onClick={loadMandates} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
          <RefreshCw className={`w-4 h-4 ${loadingM ? "animate-spin" : ""}`}/>
        </button>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: "Activos",    val: stats.activos,    cls: "text-emerald-600" },
            { label: "Suspensos",  val: stats.suspensos,  cls: "text-amber-600" },
            { label: "Cancelados", val: stats.cancelados, cls: "text-red-500" },
            { label: "Total cobrado", val: `${Number(stats.total_cobrado_aoa ?? 0).toLocaleString("pt-AO")} AOA`, cls: "text-blue-600" },
          ].map(s => (
            <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
              <p className="text-xs text-slate-400 mb-0.5">{s.label}</p>
              <p className={`text-lg font-bold ${s.cls}`}>{s.val}</p>
            </div>
          ))}
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-5 border-b border-slate-200">
        {SUB_TABS.map(t => (
          <button key={t.key} onClick={() => setDdTab(t.key as any)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border-b-2 transition-all -mb-px ${
              ddTab === t.key ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: MANDATOS ── */}
      {ddTab === "mandatos" && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {["todos","ACTV","SUSP","CANC","EXPRD"].map(f => (
              <button key={f} onClick={() => setFilterS(f)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${filterS === f ? "bg-primary text-white border-primary" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                {f === "todos" ? "Todos" : f}
              </button>
            ))}
          </div>

          {loadingM ? (
            <div className="flex items-center justify-center py-20 text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2"/> A carregar…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-slate-400 gap-2">
              <ArrowLeftRight className="w-8 h-8 opacity-30"/>
              <p className="text-sm">Nenhum mandato encontrado.</p>
              <p className="text-xs">Os encarregados aderem no portal do encarregado.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(m => (
                <div key={m.id} className={`bg-white border rounded-2xl p-4 shadow-sm ${m.status === "SUSP" ? "border-amber-200" : m.status === "CANC" ? "border-red-100" : "border-slate-200"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <DDStatusBadge s={m.status}/>
                        <span className="font-mono text-xs text-slate-400">{m.reference}</span>
                        <span className="text-xs text-slate-400">{new Date(m.created_at).toLocaleDateString("pt-AO",{day:"2-digit",month:"short",year:"numeric"})}</span>
                      </div>
                      <p className="font-semibold text-slate-900 text-sm">{m.encarregado_nome}</p>
                      <p className="text-xs text-slate-500">{m.telefone}</p>
                      <div className="flex gap-4 mt-2 text-xs text-slate-400">
                        <span>IBAN: <span className="font-mono text-slate-600">···{m.iban?.slice(-4)}</span></span>
                        <span>Dia {m.debit_day}</span>
                        <span className="text-emerald-600 font-medium">{m.cobranças_ok ?? 0} cobranças OK</span>
                        {Number(m.total_cobrado) > 0 && <span className="text-emerald-600">{Number(m.total_cobrado).toLocaleString("pt-AO")} AOA</span>}
                        {Number(m.cobranças_rejeitadas) > 0 && <span className="text-red-500">{m.cobranças_rejeitadas} rejeit.</span>}
                      </div>
                      {m.susp_reason && <p className="text-xs text-amber-600 mt-1">Suspenso: {m.susp_reason}</p>}
                      {m.canc_reason && <p className="text-xs text-red-500 mt-1">Motivo: {m.canc_reason}</p>}
                    </div>
                    {m.status === "SUSP" && (
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        <button onClick={() => transitionMandate(m.id, "ACTV", "Reactivado pelo colégio")}
                          className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-medium hover:bg-emerald-600 transition-colors">
                          Reactivar
                        </button>
                        <button onClick={() => transitionMandate(m.id, "CANC", "Cancelado pelo colégio")}
                          className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 transition-colors">
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: PAIN.008 ── */}
      {ddTab === "pain008" && (
        <div className="space-y-5">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-800 leading-relaxed">
            <p className="font-bold mb-1 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5"/> Gerador PAIN.008 — ISO 20022</p>
            Gera o ficheiro XML de inicialização de débito directo para submeter à EMIS. Valida automaticamente IBANs angolanos, BICs, pré-notificações obrigatórias e janela de submissão.
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Data de Débito <span className="text-red-500">*</span></label>
                <input type="date" value={p8Date} onChange={e => setP8Date(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"/>
                <p className="text-xs text-slate-400 mt-1">Deve ser dia útil (sem fins de semana ou feriados angolanos)</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Máximo por batch</label>
                <input type="number" min={1} max={500} value={p8MaxBatch} onChange={e => setP8MaxBatch(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"/>
                <p className="text-xs text-slate-400 mt-1">Máximo 500 instruções por ficheiro PAIN.008</p>
              </div>
            </div>

            <button onClick={genPain008} disabled={p8Loading || !p8Date}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50 shadow-sm">
              {p8Loading ? <RefreshCw className="w-4 h-4 animate-spin"/> : <FileText className="w-4 h-4"/>}
              {p8Loading ? "A gerar ficheiro..." : "Gerar PAIN.008"}
            </button>

            {p8Result && (
              <div className={`border rounded-xl p-4 ${p8Result.error ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"}`}>
                {p8Result.error ? (
                  <p className="text-xs text-red-700 font-semibold">{p8Result.error}</p>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600"/>
                      <p className="text-sm font-bold text-emerald-800">PAIN.008 gerado com sucesso</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-xs mb-3">
                      <div><p className="text-slate-500">Registos</p><p className="font-bold text-slate-800">{p8Result.total_records}</p></div>
                      <div><p className="text-slate-500">Total</p><p className="font-bold text-slate-800">{Number(p8Result.total_amount ?? 0).toLocaleString("pt-AO")} AOA</p></div>
                      <div><p className="text-slate-500">Batch Ref.</p><p className="font-mono text-slate-600 text-[10px]">{p8Result.batch_ref}</p></div>
                    </div>
                    {p8Result.validation_errors?.length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mb-3">
                        <p className="text-xs font-semibold text-amber-700 mb-1">Avisos de validação ({p8Result.validation_errors.length}):</p>
                        {p8Result.validation_errors.slice(0,5).map((e: string, i: number) => (
                          <p key={i} className="text-xs text-amber-600">• {e}</p>
                        ))}
                      </div>
                    )}
                    <button onClick={() => {
                      const blob = new Blob([p8Result.xml ?? ""], { type: "application/xml" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a"); a.href = url; a.download = `${p8Result.batch_ref}.xml`; a.click();
                      URL.revokeObjectURL(url);
                    }} className="flex items-center gap-2 px-4 py-2 bg-white border border-emerald-300 text-emerald-700 rounded-xl text-xs font-semibold hover:bg-emerald-50 transition-colors">
                      <Download className="w-3.5 h-3.5"/> Descarregar XML
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: PAIN.002 ── */}
      {ddTab === "pain002" && (
        <div className="space-y-5">
          <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 text-xs text-violet-800 leading-relaxed">
            <p className="font-bold mb-1 flex items-center gap-1.5"><FileCheck className="w-3.5 h-3.5"/> Reconciliação PAIN.002 — Resultado EMIS</p>
            Cole abaixo o array JSON com os resultados da EMIS (ACSC = aceite, RJCT = rejeitado, RTRN = devolvido). O motor actualiza automaticamente o estado dos mandatos, propinas e dispara notificações.
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Data do Relatório</label>
              <input type="date" value={p2Date} onChange={e => setP2Date(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Entradas PAIN.002 <span className="text-slate-400 font-normal">(array JSON)</span>
              </label>
              <textarea value={p2Json} onChange={e => setP2Json(e.target.value)} rows={8}
                placeholder={`[\n  { "end_to_end_id": "E2E-...", "status": "ACSC" },\n  { "end_to_end_id": "E2E-...", "status": "RJCT", "rejection_code": "AM04", "rejection_reason": "Fundos insuficientes" }\n]`}
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-violet-300 resize-y"/>
              <p className="text-xs text-slate-400 mt-1">Campos: end_to_end_id, status (ACSC/RJCT/RTRN), rejection_code (opcional), rejection_reason (opcional)</p>
            </div>

            <button onClick={processPain002} disabled={p2Loading || !p2Json.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50 shadow-sm">
              {p2Loading ? <RefreshCw className="w-4 h-4 animate-spin"/> : <CheckCheck className="w-4 h-4"/>}
              {p2Loading ? "A processar..." : "Processar PAIN.002"}
            </button>

            {p2Result && (
              <div className={`border rounded-xl p-4 ${p2Result.error ? "bg-red-50 border-red-200" : "bg-violet-50 border-violet-200"}`}>
                {p2Result.error ? (
                  <p className="text-xs text-red-700 font-semibold">{p2Result.error}</p>
                ) : (
                  <>
                    <p className="text-sm font-bold text-violet-800 mb-3 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-violet-600"/> Reconciliação concluída</p>
                    <div className="grid grid-cols-4 gap-3 text-xs">
                      <div className="text-center"><p className="text-emerald-600 font-bold text-lg">{p2Result.aceite}</p><p className="text-slate-500">ACSC</p></div>
                      <div className="text-center"><p className="text-red-500 font-bold text-lg">{p2Result.rejeitado}</p><p className="text-slate-500">RJCT</p></div>
                      <div className="text-center"><p className="text-amber-500 font-bold text-lg">{p2Result.devolvido}</p><p className="text-slate-500">RTRN</p></div>
                      <div className="text-center"><p className="text-slate-500 font-bold text-lg">{p2Result.pendente}</p><p className="text-slate-500">Pendente</p></div>
                    </div>
                    {p2Result.erros?.length > 0 && (
                      <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-2">
                        <p className="text-xs font-semibold text-amber-700 mb-1">Erros ({p2Result.erros.length}):</p>
                        {p2Result.erros.slice(0,5).map((e: string, i: number) => <p key={i} className="text-xs text-amber-600">• {e}</p>)}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: RECONCILIAÇÃO ── */}
      {ddTab === "reconciliacao" && (
        <div className="space-y-4">
          {reconLoading ? (
            <div className="flex items-center justify-center py-20 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin mr-2"/> A carregar…</div>
          ) : recon.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-slate-400 gap-2">
              <BarChart3 className="w-8 h-8 opacity-30"/>
              <p className="text-sm">Nenhum relatório de reconciliação disponível.</p>
              <p className="text-xs">Os relatórios são gerados automaticamente após processamento PAIN.002.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {["Data","Enviado","Aceite","Rejeitado","Devolvido","Pendente"].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-semibold text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recon.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800">{new Date(r.report_date).toLocaleDateString("pt-AO",{day:"2-digit",month:"short",year:"numeric"})}</td>
                      <td className="px-4 py-3 text-slate-600">{r.total_enviado}</td>
                      <td className="px-4 py-3 text-emerald-600 font-semibold">{r.total_aceite}</td>
                      <td className="px-4 py-3 text-red-500 font-semibold">{r.total_rejeitado}</td>
                      <td className="px-4 py-3 text-amber-500">{r.total_devolvido}</td>
                      <td className="px-4 py-3 text-slate-400">{r.total_pendente}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   Emolumentos — helpers & view
   ───────────────────────────────────────────── */
interface Emolumento {
  id: number; school_id: number | null; tipo: string; nome: string;
  montante: number; ano_lectivo: string; created_at: string;
  activo: boolean; is_global: boolean;
}
interface Bracket { dia_inicio: number; dia_fim: number; percentagem: number; }
interface MultaRegra {
  id?: number; school_id?: number; modelo: 1 | 2 | 3;
  dia_limite: number; aplica_automatico: boolean;
  percentagem: number; valor_fixo: number; brackets: Bracket[];
}
const DEFAULT_BRACKETS: Bracket[] = [
  { dia_inicio: 1, dia_fim: 10, percentagem: 5 },
  { dia_inicio: 11, dia_fim: 20, percentagem: 10 },
  { dia_inicio: 21, dia_fim: 31, percentagem: 15 },
];

const TIPO_GRUPOS_SCH = [
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
      { value: "folha_prova", label: "Folha de prova" },
      { value: "exame", label: "Exame" },
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
  {
    grupo: "Outros",
    items: [
      { value: "outro", label: "Outro (personalizado)" },
    ],
  },
];

const DESCRICAO_POR_TIPO_SCH: Record<string, string[]> = {
  propina: ["Propina Mensal", "Propina Mensal — 1.ª a 4.ª Classe", "Propina Mensal — 5.ª a 9.ª Classe", "Propina Mensal — 10.ª a 13.ª Classe"],
  matricula: ["Matrícula Escolar", "Matrícula Escolar — Ensino Primário", "Matrícula Escolar — I Ciclo", "Matrícula Escolar — II Ciclo"],
  confirmacao_matricula: ["Confirmação de Matrícula", "Renovação de Matrícula — Ensino Primário", "Renovação de Matrícula — I Ciclo", "Renovação de Matrícula — II Ciclo"],
  seguro: ["Seguro Escolar Anual", "Seguro Escolar Semestral", "Seguro de Acidentes Pessoais"],
  cartao_estudante: ["Cartão de Estudante", "Segunda Via de Cartão de Estudante"],
  declaracao: ["Declaração de Frequência", "Declaração de Notas", "Declaração de Matrícula", "Declaração para Bolsa", "Declaração de Conclusão de Ano Lectivo"],
  certificado: ["Certificado de Habilitações", "Certificado de Conclusão — Ensino Primário", "Certificado de Conclusão — I Ciclo", "Certificado de Conclusão — II Ciclo"],
  emissao_notas: ["Emissão de Notas — Boletim Completo", "Histórico de Notas"],
  segunda_via: ["Segunda Via de Notas", "Segunda Via de Matrícula", "Segunda Via de Certificado", "Segunda Via de Diploma"],
  pedido_especial: ["Transferência Escolar", "Equivalência de Disciplinas", "Reingresso Escolar"],
  folha_prova: ["Folha de Prova Exame", "Folha de Prova Teste"],
  exame: ["Taxa de Exame Nacional", "Taxa de Exame Interno", "Taxa de Exame de Recurso"],
  transporte: ["Transporte Escolar — Ida e Volta", "Transporte Escolar — Só Ida", "Transporte Escolar — Só Volta"],
  alimentacao: ["Refeição Escolar — Almoço", "Lanche Escolar", "ATL — Actividades de Tempos Livres"],
  uniforme: ["Kit de Uniforme Completo", "Calças / Saia de Uniforme", "Camisa / Blusa de Uniforme"],
  extracurricular: ["Actividades Extracurriculares — Desporto", "Actividades Extracurriculares — Arte e Cultura", "Clube de Informática", "Natação Escolar"],
  multa_atraso: ["Multa por Atraso no Pagamento de Propina"],
  multa_dano: ["Multa por Dano de Material Escolar", "Multa por Dano de Equipamento Informático", "Multa por Perda de Material da Escola"],
  outro: [],
};

function tipoLabelSch(v: string) {
  for (const g of TIPO_GRUPOS_SCH) {
    const found = g.items.find(i => i.value === v);
    if (found) return found.label;
  }
  return v;
}

const TIPO_COLOR_SCH: Record<string, string> = {
  propina: "bg-blue-100 text-blue-700 border-blue-200",
  matricula: "bg-violet-100 text-violet-700 border-violet-200",
  confirmacao_matricula: "bg-purple-100 text-purple-700 border-purple-200",
  seguro: "bg-cyan-100 text-cyan-700 border-cyan-200",
  cartao_estudante: "bg-teal-100 text-teal-700 border-teal-200",
  declaracao: "bg-amber-100 text-amber-700 border-amber-200",
  certificado: "bg-orange-100 text-orange-700 border-orange-200",
  emissao_notas: "bg-yellow-100 text-yellow-700 border-yellow-200",
  segunda_via: "bg-lime-100 text-lime-700 border-lime-200",
  pedido_especial: "bg-indigo-100 text-indigo-700 border-indigo-200",
  folha_prova: "bg-pink-100 text-pink-700 border-pink-200",
  exame: "bg-rose-100 text-rose-700 border-rose-200",
  transporte: "bg-sky-100 text-sky-700 border-sky-200",
  alimentacao: "bg-green-100 text-green-700 border-green-200",
  uniforme: "bg-emerald-100 text-emerald-700 border-emerald-200",
  extracurricular: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
  multa_atraso: "bg-red-100 text-red-700 border-red-200",
  multa_dano: "bg-red-100 text-red-700 border-red-200",
  outro: "bg-slate-100 text-slate-600 border-slate-200",
};

/* ─── School Emolumentos sub-tab: local list with toggle & CRUD ─── */
/* ─── School MultaRegras panel (mirrors admin MultaRegrasPanel) ─── */
function SchoolMultaRegrasPanel({ token, initial, onSaved }: {
  token: string; initial: MultaRegra | null; onSaved?: (r: MultaRegra) => void;
}) {
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
  const hdrs = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  useEffect(() => {
    if (!initial) return;
    setModelo(initial.modelo ?? 1);
    setDiaLimite(String(initial.dia_limite ?? 10));
    setAplica(initial.aplica_automatico ?? true);
    setPercentagem(String(initial.percentagem ?? ""));
    setValorFixo(String(initial.valor_fixo ?? ""));
    setBrackets(initial.brackets?.length ? initial.brackets : DEFAULT_BRACKETS);
  }, [initial]);

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
      const body: Record<string, unknown> = { modelo, dia_limite: Number(diaLimite), aplica_automatico: aplica };
      if (modelo === 1) body.percentagem = Number(percentagem);
      else if (modelo === 2) body.brackets = brackets;
      else body.valor_fixo = Number(valorFixo);
      const res = await fetch(`${API}/school/multa-regra`, { method: "PUT", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao guardar.");
      setSuccess(true); setTimeout(() => setSuccess(false), 3000);
      if (onSaved) onSaved(data);
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const MODELO_CARDS = [
    { id: 1 as const, label: "Modelo 1 — Multa única", desc: "Percentagem aplicada uma vez após o dia limite", icon: <BadgePercent className="w-4 h-4" /> },
    { id: 2 as const, label: "Modelo 2 — Multa progressiva", desc: "Percentagem cresce com o tempo (escalões)", icon: <TrendingUp className="w-4 h-4" /> },
    { id: 3 as const, label: "Modelo 3 — Taxa fixa", desc: "Valor fixo em AOA aplicado após o dia limite", icon: <Banknote className="w-4 h-4" /> },
  ];

  const iCls = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20";

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
        <div>
          <p className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Seleccionar modelo de cálculo</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {MODELO_CARDS.map(m => (
              <button key={m.id} type="button" onClick={() => setModelo(m.id)}
                className={`text-left p-3 rounded-xl border-2 transition-all ${modelo === m.id ? "border-amber-500 bg-amber-100/60" : "border-slate-200 bg-white hover:border-amber-300"}`}>
                <div className={`flex items-center gap-1.5 font-semibold text-xs mb-1 ${modelo === m.id ? "text-amber-800" : "text-slate-700"}`}>
                  {m.icon}{m.label}
                </div>
                <p className="text-xs text-slate-500 leading-snug">{m.desc}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Dia limite mensal">
            <input type="number" min="1" max="31" className={iCls}
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
        {modelo === 1 && (
          <Field label="Percentagem da multa (%)">
            <input type="number" min="0" step="0.01" max="100" className={iCls}
              placeholder="ex: 10" value={percentagem} onChange={e => setPercentagem(e.target.value)} required />
          </Field>
        )}
        {modelo === 2 && (
          <div>
            <p className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Escalões de multa progressiva</p>
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
            <input type="number" min="0" step="0.01" className={iCls}
              placeholder="ex: 5000" value={valorFixo} onChange={e => setValorFixo(e.target.value)} required />
          </Field>
        )}
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

function LocalEmolumentosTab({ token }: { token: string }) {
  const [list, setList] = useState<Emolumento[]>([]);
  const [multaRegra, setMultaRegra] = useState<MultaRegra | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    tipo: "propina",
    nome: DESCRICAO_POR_TIPO_SCH["propina"][0] ?? "",
    montante: "",
    ano_lectivo: anoLectivo(),
  });

  // Inline multa model state (only for propina)
  const [multaModelo, setMultaModelo] = useState<1|2|3>(1);
  const [multaDia, setMultaDia] = useState("10");
  const [multaAplica, setMultaAplica] = useState(true);
  const [multaPerc, setMultaPerc] = useState("");
  const [multaFixo, setMultaFixo] = useState("");
  const [multaBrackets, setMultaBrackets] = useState<Bracket[]>(DEFAULT_BRACKETS);
  const [multaModeloSelecionado, setMultaModeloSelecionado] = useState(false);

  const isPropina = form.tipo === "propina";
  const hdrs = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [emRes, mrRes] = await Promise.all([
        fetch(`${API}/school/emolumentos`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/school/multa-regra`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (emRes.ok) {
        const all: Emolumento[] = await emRes.json();
        setList(all.filter(e => !e.is_global));
      }
      if (mrRes.ok) {
        const mr: MultaRegra | null = await mrRes.json();
        setMultaRegra(mr);
        if (mr) {
          setMultaModelo(mr.modelo ?? 1);
          setMultaDia(String(mr.dia_limite ?? 10));
          setMultaAplica(mr.aplica_automatico ?? true);
          setMultaPerc(String(mr.percentagem ?? ""));
          setMultaFixo(String(mr.valor_fixo ?? ""));
          setMultaBrackets(mr.brackets?.length ? mr.brackets : DEFAULT_BRACKETS);
          setMultaModeloSelecionado(true);
        }
      }
    } catch {}
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const addInlineBracket = () => {
    const last = multaBrackets[multaBrackets.length - 1];
    setMultaBrackets(b => [...b, { dia_inicio: last ? last.dia_fim + 1 : 1, dia_fim: last ? last.dia_fim + 10 : 10, percentagem: 0 }]);
  };
  const removeInlineBracket = (i: number) => setMultaBrackets(b => b.filter((_, idx) => idx !== i));
  const updateInlineBracket = (i: number, field: keyof Bracket, val: string) =>
    setMultaBrackets(b => b.map((br, idx) => idx === i ? { ...br, [field]: Number(val) } : br));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setSaving(true);
    if (isPropina && !multaModeloSelecionado) {
      setError("Seleccione o modelo de cobrança de multa antes de registar a propina.");
      setSaving(false); return;
    }
    try {
      if (isPropina) {
        const multaBody: Record<string, unknown> = {
          modelo: multaModelo, dia_limite: Number(multaDia), aplica_automatico: multaAplica,
        };
        if (multaModelo === 1) multaBody.percentagem = Number(multaPerc);
        else if (multaModelo === 2) multaBody.brackets = multaBrackets;
        else multaBody.valor_fixo = Number(multaFixo);
        const mr = await fetch(`${API}/school/multa-regra`, { method: "PUT", headers: hdrs, body: JSON.stringify(multaBody) });
        const mrData = await mr.json();
        if (!mr.ok) throw new Error(mrData.error ?? "Erro ao guardar regra de multa.");
        setMultaRegra(mrData);
      }
      const res = await fetch(`${API}/school/emolumentos`, {
        method: "POST", headers: hdrs,
        body: JSON.stringify({ tipo: form.tipo, nome: form.nome, montante: Number(form.montante), ano_lectivo: form.ano_lectivo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao guardar emolumento.");
      setList(l => [data, ...l]);
      setForm(f => ({ ...f, nome: (DESCRICAO_POR_TIPO_SCH[f.tipo] ?? [])[0] ?? "", montante: "" }));
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const deleteEm = async (id: number) => {
    if (!confirm("Eliminar este emolumento?")) return;
    await fetch(`${API}/school/emolumentos/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    setList(l => l.filter(x => x.id !== id));
  };

  const MODELO_INLINE = [
    { id: 1 as const, label: "Modelo 1", sub: "Percentagem única", icon: <BadgePercent className="w-3.5 h-3.5" /> },
    { id: 2 as const, label: "Modelo 2", sub: "Progressiva (escalões)", icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { id: 3 as const, label: "Modelo 3", sub: "Taxa fixa (Kz)", icon: <Banknote className="w-3.5 h-3.5" /> },
  ];

  const iCls = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20";

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-slate-400">
      <RefreshCw className="w-5 h-5 animate-spin mr-2" /> A carregar…
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ─── Add form (always visible) ─── */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
        <h4 className="font-semibold text-slate-700 mb-4">Adicionar emolumento</h4>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Tipo de emolumento" required>
              <select className={iCls} value={form.tipo}
                onChange={e => {
                  const tipo = e.target.value;
                  setForm(f => ({ ...f, tipo, nome: (DESCRICAO_POR_TIPO_SCH[tipo] ?? [])[0] ?? "" }));
                }}>
                {TIPO_GRUPOS_SCH.map(g => (
                  <optgroup key={g.grupo} label={g.grupo}>
                    {g.items.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </optgroup>
                ))}
              </select>
            </Field>
            <Field label="Ano lectivo">
              <input className={iCls} value={form.ano_lectivo}
                onChange={e => setForm(f => ({ ...f, ano_lectivo: e.target.value }))} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Descrição" required>
              {(DESCRICAO_POR_TIPO_SCH[form.tipo] ?? []).length > 0 ? (
                <select className={iCls} value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required>
                  {DESCRICAO_POR_TIPO_SCH[form.tipo].map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              ) : (
                <input className={iCls} placeholder="Descrição do emolumento" value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required />
              )}
            </Field>
            <Field label="Montante base (AOA)" required>
              <input type="number" min="0" className={iCls} placeholder="ex: 35000" value={form.montante}
                onChange={e => setForm(f => ({ ...f, montante: e.target.value }))} required />
            </Field>
          </div>

          {/* ─── Inline multa model — propina only ─── */}
          <AnimatePresence>
            {isPropina && (
              <motion.div key="multa-inline"
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="border-2 border-amber-300 bg-amber-50 rounded-2xl p-4 space-y-4 overflow-hidden">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <p className="text-sm font-semibold text-amber-900">
                    Modelo de cobrança de multa <span className="text-red-500">*</span>
                  </p>
                </div>
                <p className="text-xs text-amber-700 -mt-2">
                  A multa é automaticamente adicionada à propina: <strong>Propina + Multa = Total pago pelo encarregado.</strong>{" "}
                  Seleccione como a multa por atraso será calculada para este colégio.
                </p>
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
                {multaModeloSelecionado && (
                  <div className="space-y-3 bg-white rounded-xl p-3 border border-amber-200">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Dia limite mensal">
                        <input type="number" min="1" max="31" className={iCls} placeholder="ex: 10"
                          value={multaDia} onChange={e => setMultaDia(e.target.value)} required />
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
                        <input type="number" min="0" max="100" step="0.1" className={iCls}
                          placeholder="ex: 10" value={multaPerc} onChange={e => setMultaPerc(e.target.value)} required />
                      </Field>
                    )}
                    {multaModelo === 2 && (
                      <div>
                        <p className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Escalões progressivos</p>
                        <div className="space-y-1.5">
                          {multaBrackets.map((b, i) => (
                            <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2 text-xs">
                              <span className="text-slate-400 shrink-0">Escalão {i+1}</span>
                              <span className="text-slate-400">Dia</span>
                              <input type="number" min="1" max="31" className="w-14 px-2 py-1 border border-slate-200 rounded-lg text-center text-xs"
                                value={b.dia_inicio} onChange={e => updateInlineBracket(i,"dia_inicio",e.target.value)} />
                              <span className="text-slate-400">–</span>
                              <input type="number" min="1" max="31" className="w-14 px-2 py-1 border border-slate-200 rounded-lg text-center text-xs"
                                value={b.dia_fim} onChange={e => updateInlineBracket(i,"dia_fim",e.target.value)} />
                              <span className="text-slate-400">→</span>
                              <input type="number" min="0" max="100" className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-center text-xs"
                                value={b.percentagem} onChange={e => updateInlineBracket(i,"percentagem",e.target.value)} />
                              <span className="text-slate-400">%</span>
                              {multaBrackets.length > 1 && (
                                <button type="button" onClick={() => removeInlineBracket(i)} className="ml-auto text-slate-300 hover:text-red-400">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        <button type="button" onClick={addInlineBracket}
                          className="mt-1.5 text-xs text-amber-700 font-semibold flex items-center gap-1 hover:text-amber-900">
                          <Plus className="w-3 h-3" />Adicionar escalão
                        </button>
                      </div>
                    )}
                    {multaModelo === 3 && (
                      <Field label="Valor fixo da multa (AOA)">
                        <input type="number" min="0" step="0.01" className={iCls}
                          placeholder="ex: 5000" value={multaFixo} onChange={e => setMultaFixo(e.target.value)} required />
                      </Field>
                    )}
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
            {saving
              ? <><RefreshCw className="w-4 h-4 animate-spin" />A guardar...</>
              : <><Plus className="w-4 h-4" />Adicionar emolumento</>}
          </button>
        </form>
      </div>

      {/* ─── Emolumentos list ─── */}
      {list.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Receipt className="w-10 h-10 mx-auto mb-2 text-slate-200" />
          <p className="text-sm">Nenhum emolumento registado</p>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-2xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[500px]">
            <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
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
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${TIPO_COLOR_SCH[em.tipo] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                      {tipoLabelSch(em.tipo)}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-medium text-slate-900">{em.nome}</td>
                  <td className="px-5 py-3 font-mono text-slate-700">{fmt(em.montante)}</td>
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

      {/* ─── Multa regras panel ─── */}
      <SchoolMultaRegrasPanel token={token} initial={multaRegra} onSaved={r => setMultaRegra(r)} />
    </div>
  );
}

/* ─── School Emolumentos sub-tab: global list (read-only) ─── */
function GlobalEmolumentosTab({ token }: { token: string }) {
  const [list, setList] = useState<Emolumento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`${API}/school/emolumentos`, { headers: { Authorization: `Bearer ${token}` } });
        if (r.ok) {
          const all: Emolumento[] = await r.json();
          setList(all.filter(e => e.is_global));
        }
      } catch {}
      setLoading(false);
    })();
  }, [token]);

  const grouped = useMemo(() => {
    const map: Record<string, Emolumento[]> = {};
    for (const em of list) {
      if (!map[em.tipo]) map[em.tipo] = [];
      map[em.tipo].push(em);
    }
    return map;
  }, [list]);

  return (
    <div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2 mb-4">
        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5"/>
        <p className="text-xs text-amber-800">
          Estes emolumentos são geridos pela administração central e são <strong>apenas de leitura</strong>.
          Pode criar os seus próprios na aba «Locais».
        </p>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400"><RefreshCw className="w-4 h-4 animate-spin mr-2"/>A carregar…</div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-slate-400 gap-2">
          <Globe className="w-8 h-8 opacity-30"/>
          <p className="text-sm text-slate-500">Nenhum emolumento global configurado</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([tipo, items]) => (
            <div key={tipo} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className={`flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 ${(TIPO_COLOR_SCH[tipo] ?? "bg-slate-50 text-slate-700 border-slate-200").split(" ")[0]}/20`}>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${TIPO_COLOR_SCH[tipo] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>{tipoLabelSch(tipo)}</span>
                <span className="ml-auto flex items-center gap-1.5 text-xs text-amber-600 font-medium"><Globe className="w-3 h-3"/>Global</span>
              </div>
              <div className="divide-y divide-slate-50">
                {items.map(em => (
                  <div key={em.id} className={`px-4 py-3 flex items-center gap-3 ${em.activo ? "" : "opacity-40"}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{em.nome}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-slate-400">{em.ano_lectivo}</span>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-slate-900 tabular-nums shrink-0">{Number(em.montante).toLocaleString("pt-AO")} Kz</p>
                    {!em.activo && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Inactivo</span>}
                    <ShieldOff className="w-4 h-4 text-slate-300 shrink-0" title="Apenas leitura"/>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <p className="text-xs text-center text-slate-400 pb-2">{list.length} emolumento{list.length !== 1 ? "s" : ""} global{list.length !== 1 ? "is" : ""}</p>
        </div>
      )}
    </div>
  );
}

/* ─── School Pacotes tab ─── */
function PacotesSchoolTab({ token }: { token: string }) {
  const [list, setList] = useState<Pacote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editPacote, setEditPacote] = useState<Pacote | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nome: "", descricao: "" });
  const [formErr, setFormErr] = useState("");
  const [formItens, setFormItens] = useState<{ nome: string; valor: string }[]>([]);
  const [editItens, setEditItens] = useState<{ nome: string; valor: string }[]>([]);

  const hdrs = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/school/pacotes`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setList(await r.json());
    } catch {}
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const totalItens = (itens: { nome: string; valor: string }[]) =>
    itens.reduce((s, i) => s + (Number(i.valor) || 0), 0);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault(); setFormErr("");
    if (!form.nome.trim()) return setFormErr("Nome do pacote é obrigatório.");
    setSaving(true);
    try {
      const itens = formItens.filter(i => i.nome.trim()).map(i => ({ nome: i.nome.trim(), valor: Number(i.valor) || 0 }));
      const r = await fetch(`${API}/school/pacotes`, {
        method: "POST", headers: hdrs,
        body: JSON.stringify({ nome: form.nome.trim(), descricao: form.descricao.trim(), itens }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Erro ao guardar.");
      setList(prev => [...prev, data]);
      setForm({ nome: "", descricao: "" }); setFormItens([]); setShowForm(false);
    } catch (err: any) { setFormErr(err.message); }
    setSaving(false);
  };

  const saveEdit = async () => {
    if (!editPacote || !editPacote.nome?.trim()) return;
    setSaving(true);
    try {
      const itens = editItens.filter(i => i.nome.trim()).map(i => ({ nome: i.nome.trim(), valor: Number(i.valor) || 0 }));
      const r = await fetch(`${API}/school/pacotes/${editPacote.id}`, {
        method: "PUT", headers: hdrs,
        body: JSON.stringify({ nome: editPacote.nome.trim(), descricao: editPacote.descricao ?? "", itens }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Erro ao guardar.");
      setList(prev => prev.map(p => p.id === data.id ? data : p));
      setEditPacote(null);
    } catch (err: any) { alert(err.message); }
    setSaving(false);
  };

  const toggleActivo = async (p: Pacote) => {
    const r = await fetch(`${API}/school/pacotes/${p.id}/toggle`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) { const d = await r.json(); setList(prev => prev.map(x => x.id === p.id ? d : x)); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Eliminar este pacote?")) return;
    await fetch(`${API}/school/pacotes/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    setList(prev => prev.filter(p => p.id !== id));
  };

  const addItem = (setter: React.Dispatch<React.SetStateAction<{ nome: string; valor: string }[]>>) =>
    setter(prev => [...prev, { nome: "", valor: "" }]);
  const removeItem = (setter: React.Dispatch<React.SetStateAction<{ nome: string; valor: string }[]>>, idx: number) =>
    setter(prev => prev.filter((_, i) => i !== idx));
  const updateItem = (setter: React.Dispatch<React.SetStateAction<{ nome: string; valor: string }[]>>, idx: number, field: "nome" | "valor", val: string) =>
    setter(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));

  const inputCls = "w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20";

  const renderItemsEditor = (
    items: { nome: string; valor: string }[],
    setter: React.Dispatch<React.SetStateAction<{ nome: string; valor: string }[]>>
  ) => (
    <div className="space-y-2">
      {items.map((it, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <input className={inputCls + " flex-1"} placeholder="Descrição do item" value={it.nome} onChange={e => updateItem(setter, idx, "nome", e.target.value)} />
          <input type="number" min="0" className={inputCls + " w-32 shrink-0"} placeholder="Valor AOA" value={it.valor} onChange={e => updateItem(setter, idx, "valor", e.target.value)} />
          <button type="button" onClick={() => removeItem(setter, idx)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors"><X className="w-4 h-4"/></button>
        </div>
      ))}
      <button type="button" onClick={() => addItem(setter)} className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium mt-1">
        <Plus className="w-3.5 h-3.5"/> Adicionar item
      </button>
      {items.length > 0 && (
        <p className="text-xs text-slate-500 font-medium mt-1">Total: {totalItens(items).toLocaleString("pt-AO")} Kz</p>
      )}
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">Agrupamentos de emolumentos para cobrança simplificada</p>
        <button onClick={() => { setShowForm(s => !s); setFormErr(""); setFormItens([]); setForm({ nome: "", descricao: "" }); }}
          className="flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm shrink-0">
          <Plus className="w-3.5 h-3.5"/> {showForm ? "Cancelar" : "Novo pacote"}
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-5">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <h4 className="font-semibold text-slate-700 mb-4 text-sm">Novo Pacote</h4>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Nome do pacote <span className="text-red-500">*</span></label>
                    <input className={inputCls} placeholder="Ex: Pacote de Matrícula Completa" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Descrição</label>
                    <input className={inputCls} placeholder="Opcional" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Itens do pacote</label>
                  {renderItemsEditor(formItens, setFormItens)}
                </div>
                {formErr && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{formErr}</p>}
                <div className="flex gap-3">
                  <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors">
                    {saving ? <><RefreshCw className="w-4 h-4 animate-spin"/>A guardar…</> : <><Plus className="w-4 h-4"/>Criar pacote</>}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit modal */}
      <AnimatePresence>
        {editPacote && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-900">Editar Pacote</h3>
                <button onClick={() => setEditPacote(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-5 h-5"/></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Nome do pacote <span className="text-red-500">*</span></label>
                  <input className={inputCls} value={editPacote.nome} onChange={e => setEditPacote(p => p ? { ...p, nome: e.target.value } : p)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Descrição</label>
                  <input className={inputCls} value={editPacote.descricao ?? ""} onChange={e => setEditPacote(p => p ? { ...p, descricao: e.target.value } : p)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Itens do pacote</label>
                  {renderItemsEditor(editItens, setEditItens)}
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={saveEdit} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors">
                    {saving ? <><RefreshCw className="w-4 h-4 animate-spin"/>A guardar…</> : <><Save className="w-4 h-4"/>Guardar</>}
                  </button>
                  <button onClick={() => setEditPacote(null)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400"><RefreshCw className="w-4 h-4 animate-spin mr-2"/>A carregar…</div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-slate-400 gap-3">
          <Package className="w-8 h-8 opacity-30"/>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-500">Nenhum pacote criado</p>
            <p className="text-xs text-slate-400 mt-1">Agrupe emolumentos para facilitar a cobrança</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map(p => (
            <div key={p.id} className={`bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm transition-opacity ${p.activo ? "" : "opacity-50"}`}>
              <div className="px-4 py-3.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800 truncate">{p.nome}</p>
                    {!p.activo && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full shrink-0">Inactivo</span>}
                  </div>
                  {p.descricao && <p className="text-xs text-slate-400 mt-0.5 truncate">{p.descricao}</p>}
                </div>
                <p className="text-sm font-bold text-primary tabular-nums shrink-0">{Number(p.valor).toLocaleString("pt-AO")} Kz</p>
                <button onClick={() => toggleActivo(p)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${p.activo ? "bg-emerald-500" : "bg-slate-300"}`}
                  title={p.activo ? "Desactivar" : "Activar"}>
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${p.activo ? "translate-x-4" : "translate-x-1"}`}/>
                </button>
                <button onClick={() => {
                  setEditPacote(p);
                  setEditItens((p.itens ?? []).map((i: any) => ({ nome: i.nome ?? "", valor: String(i.valor ?? "") })));
                }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors" title="Editar"><Pencil className="w-3.5 h-3.5"/></button>
                <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors" title="Eliminar"><Trash2 className="w-3.5 h-3.5"/></button>
              </div>
              {(p.itens ?? []).length > 0 && (
                <div className="border-t border-slate-50 px-4 pb-3 pt-2">
                  <div className="space-y-1">
                    {(p.itens ?? []).map((it: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-slate-600">{it.nome}</span>
                        <span className="font-medium text-slate-700 tabular-nums">{Number(it.valor).toLocaleString("pt-AO")} Kz</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   BolsasSchoolTab — Bolsas de Estudo management (School Portal)
   ═══════════════════════════════════════════════════════════════ */
function BolsasSchoolTab({ token }: { token: string }) {
  const [tipos, setTipos] = useState<BolsaTipo[]>([]);
  const [atribuicoes, setAtribuicoes] = useState<BolsaAtribuicao[]>([]);
  const [stats, setStats] = useState<{ total_bolseiros: string; total_tipos: string; total_desconto_historico: string; propinas_com_desconto: string } | null>(null);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEstado, setFilterEstado] = useState<"activa" | "revogada" | "">("activa");
  const [filterTurma, setFilterTurma] = useState("");
  const [filterSearch, setFilterSearch] = useState("");

  // Tipo form
  const [showTipoForm, setShowTipoForm] = useState(false);
  const [editTipo, setEditTipo] = useState<BolsaTipo | null>(null);
  const [tipoNome, setTipoNome] = useState("");
  const [tipoDescricao, setTipoDescricao] = useState("");
  const [tipoTipoDesconto, setTipoTipoDesconto] = useState<'percentagem' | 'fixo'>('percentagem');
  const [tipoValor, setTipoValor] = useState("");
  const [tipoAbrangencia, setTipoAbrangencia] = useState<'propina' | 'tudo'>('propina');
  const [tipoSaving, setTipoSaving] = useState(false);
  const [tipoError, setTipoError] = useState("");
  const [togglingTipo, setTogglingTipo] = useState<number | null>(null);

  // Atribuicao form
  const [showAtribuirForm, setShowAtribuirForm] = useState(false);
  const [atribStudent, setAtribStudent] = useState("");
  const [atribTipo, setAtribTipo] = useState("");
  const [atribDataInicio, setAtribDataInicio] = useState(new Date().toISOString().slice(0, 10));
  const [atribDataFim, setAtribDataFim] = useState("");
  const [atribNotas, setAtribNotas] = useState("");
  const [atribSaving, setAtribSaving] = useState(false);
  const [atribError, setAtribError] = useState("");

  // Edit atribuicao
  const [editAtrib, setEditAtrib] = useState<BolsaAtribuicao | null>(null);
  const [editAtribDataFim, setEditAtribDataFim] = useState("");
  const [editAtribNotas, setEditAtribNotas] = useState("");
  const [editAtribSaving, setEditAtribSaving] = useState(false);
  const [editAtribError, setEditAtribError] = useState("");

  // Revogar modal
  const [revogarModal, setRevogarModal] = useState<BolsaAtribuicao | null>(null);
  const [revogarMotivo, setRevogarMotivo] = useState("");
  const [revogarSaving, setRevogarSaving] = useState(false);

  const hdrs = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const iCls = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20";
  const lCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5";

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/school/bolsas/tipos`, { headers: hdrs }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/school/bolsas/atribuicoes${filterEstado ? `?estado=${filterEstado}` : ''}`, { headers: hdrs }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/school/bolsas/stats`, { headers: hdrs }).then(r => r.ok ? r.json() : null),
      fetch(`${API}/school/alunos`, { headers: hdrs }).then(r => r.ok ? r.json() : []),
    ]).then(([t, a, s, al]) => {
      setTipos(t); setAtribuicoes(a); setStats(s); setAlunos(al);
    }).finally(() => setLoading(false));
  }, [token, filterEstado]);

  useEffect(() => { load(); }, [load]);

  const saveTipo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tipoNome.trim() || !tipoValor) { setTipoError("Nome e valor são obrigatórios."); return; }
    setTipoSaving(true); setTipoError("");
    try {
      const method = editTipo ? 'PUT' : 'POST';
      const url = editTipo ? `${API}/school/bolsas/tipos/${editTipo.id}` : `${API}/school/bolsas/tipos`;
      const res = await fetch(url, { method, headers: hdrs, body: JSON.stringify({ nome: tipoNome, descricao: tipoDescricao, tipo_desconto: tipoTipoDesconto, valor: Number(tipoValor), abrangencia: tipoAbrangencia }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao guardar.");
      setShowTipoForm(false); setEditTipo(null); setTipoNome(""); setTipoDescricao(""); setTipoValor(""); setTipoTipoDesconto('percentagem'); setTipoAbrangencia('propina');
      load();
    } catch (err: any) { setTipoError(err.message); }
    finally { setTipoSaving(false); }
  };

  const toggleTipoActivo = async (t: BolsaTipo) => {
    setTogglingTipo(t.id);
    try {
      await fetch(`${API}/school/bolsas/tipos/${t.id}`, { method: "PUT", headers: hdrs, body: JSON.stringify({ activo: !t.activo }) });
      load();
    } finally { setTogglingTipo(null); }
  };

  const deleteTipo = async (id: number) => {
    if (!confirm("Eliminar este tipo de bolsa?")) return;
    const res = await fetch(`${API}/school/bolsas/tipos/${id}`, { method: "DELETE", headers: hdrs });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    load();
  };

  const atribuirBolsa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!atribStudent || !atribTipo) { setAtribError("Aluno e tipo de bolsa são obrigatórios."); return; }
    setAtribSaving(true); setAtribError("");
    try {
      const res = await fetch(`${API}/school/bolsas/atribuicoes`, { method: "POST", headers: hdrs, body: JSON.stringify({ student_id: Number(atribStudent), bolsa_tipo_id: Number(atribTipo), data_inicio: atribDataInicio, data_fim: atribDataFim || null, notas: atribNotas.trim() || null }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao atribuir.");
      setShowAtribuirForm(false); setAtribStudent(""); setAtribTipo(""); setAtribNotas(""); setAtribDataFim("");
      load();
    } catch (err: any) { setAtribError(err.message); }
    finally { setAtribSaving(false); }
  };

  const saveEditAtrib = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAtrib) return;
    setEditAtribSaving(true); setEditAtribError("");
    try {
      const res = await fetch(`${API}/school/bolsas/atribuicoes/${editAtrib.id}`, {
        method: "PUT", headers: hdrs,
        body: JSON.stringify({ data_fim: editAtribDataFim || null, notas: editAtribNotas.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao guardar.");
      setEditAtrib(null); load();
    } catch (err: any) { setEditAtribError(err.message); }
    finally { setEditAtribSaving(false); }
  };

  const confirmarRevogar = async () => {
    if (!revogarModal) return;
    setRevogarSaving(true);
    await fetch(`${API}/school/bolsas/atribuicoes/${revogarModal.id}`, {
      method: "PUT", headers: hdrs,
      body: JSON.stringify({ estado: "revogada", motivo_revogacao: revogarMotivo.trim() || "Revogada pelo secretariado" }),
    });
    setRevogarModal(null); setRevogarMotivo(""); setRevogarSaving(false);
    load();
  };

  const openEditTipo = (t: BolsaTipo) => { setEditTipo(t); setTipoNome(t.nome); setTipoDescricao(t.descricao || ""); setTipoTipoDesconto(t.tipo_desconto); setTipoValor(String(t.valor)); setTipoAbrangencia(t.abrangencia); setShowTipoForm(true); };

  const daysUntil = (dateStr: string | null) => {
    if (!dateStr) return null;
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  };

  const turmasUnicas = useMemo(() => {
    const seen = new Set<string>();
    return alunos.filter(a => a.turma && !seen.has(a.turma) && seen.add(a.turma)).map(a => a.turma);
  }, [alunos]);

  const atribuicoesFiltradas = useMemo(() => {
    const q = filterSearch.toLowerCase();
    return atribuicoes.filter(a => {
      const matchTurma = !filterTurma || a.turma === filterTurma;
      const matchSearch = !q || a.aluno_nome.toLowerCase().includes(q) || a.bolsa_nome.toLowerCase().includes(q);
      return matchTurma && matchSearch;
    });
  }, [atribuicoes, filterTurma, filterSearch]);

  return (
    <div className="space-y-8">
      {/* ── Stats ── */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Bolseiros activos", value: stats.total_bolseiros, icon: <GraduationCap className="w-4 h-4 text-primary"/>, color: "text-primary" },
            { label: "Tipos de bolsa", value: stats.total_tipos, icon: <Tag className="w-4 h-4 text-violet-600"/>, color: "text-violet-600" },
            { label: "Propinas c/ desconto", value: stats.propinas_com_desconto, icon: <Receipt className="w-4 h-4 text-blue-600"/>, color: "text-blue-600" },
            { label: "Desconto total", value: `${Number(stats.total_desconto_historico).toLocaleString("pt-AO")} AOA`, icon: <TrendingUp className="w-4 h-4 text-emerald-600"/>, color: "text-emerald-600" },
          ].map((s, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">{s.icon}<span className="text-xs text-slate-500 font-medium leading-tight">{s.label}</span></div>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Tipologias ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Tipologias de Bolsa</h2>
            <p className="text-xs text-slate-500 mt-0.5">Categorias de desconto disponíveis para atribuição</p>
          </div>
          <button onClick={() => { setShowTipoForm(true); setEditTipo(null); setTipoNome(""); setTipoDescricao(""); setTipoValor(""); setTipoTipoDesconto('percentagem'); setTipoAbrangencia('propina'); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 transition-colors">
            <Plus className="w-3.5 h-3.5"/> Nova Tipologia
          </button>
        </div>

        {showTipoForm && (
          <form onSubmit={saveTipo} className="mb-4 bg-primary/5 border border-primary/20 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-primary">{editTipo ? "Editar" : "Nova"} Tipologia de Bolsa</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={lCls}>Nome</label>
                <input className={iCls} value={tipoNome} onChange={e => setTipoNome(e.target.value)} placeholder="ex: Bolsa de Mérito"/>
              </div>
              <div className="col-span-2">
                <label className={lCls}>Descrição (opcional)</label>
                <input className={iCls} value={tipoDescricao} onChange={e => setTipoDescricao(e.target.value)} placeholder="Critérios de atribuição..."/>
              </div>
              <div>
                <label className={lCls}>Tipo de Desconto</label>
                <select className={iCls} value={tipoTipoDesconto} onChange={e => setTipoTipoDesconto(e.target.value as 'percentagem' | 'fixo')}>
                  <option value="percentagem">Percentagem (%)</option>
                  <option value="fixo">Valor fixo (AOA)</option>
                </select>
              </div>
              <div>
                <label className={lCls}>{tipoTipoDesconto === 'percentagem' ? 'Percentagem (0–100)' : 'Valor (AOA)'}</label>
                <input type="number" min="0" max={tipoTipoDesconto === 'percentagem' ? 100 : undefined} step="0.01" className={iCls} value={tipoValor} onChange={e => setTipoValor(e.target.value)} placeholder={tipoTipoDesconto === 'percentagem' ? 'ex: 50' : 'ex: 15000'}/>
              </div>
              <div className="col-span-2">
                <label className={lCls}>Abrangência</label>
                <div className="flex gap-2">
                  {([{v:'propina',l:'Apenas propina mensal'},{v:'tudo',l:'Todos os emolumentos'}] as const).map(opt => (
                    <button type="button" key={opt.v} onClick={() => setTipoAbrangencia(opt.v)}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${tipoAbrangencia === opt.v ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200 hover:border-primary/40'}`}>
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {tipoError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{tipoError}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setShowTipoForm(false); setEditTipo(null); }} className="flex-1 py-2 text-xs text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50">Cancelar</button>
              <button type="submit" disabled={tipoSaving} className="flex-1 py-2 text-xs font-semibold bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-60">
                {tipoSaving ? "A guardar..." : "Guardar"}
              </button>
            </div>
          </form>
        )}

        {tipos.length === 0 ? (
          <div className="text-center py-10 bg-white border border-slate-200 rounded-2xl text-slate-400">
            <GraduationCap className="w-8 h-8 mx-auto mb-2 opacity-40"/>
            <p className="text-sm">Nenhuma tipologia configurada.</p>
            <p className="text-xs mt-1 text-slate-300">Crie uma tipologia para começar a atribuir bolsas.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {tipos.map(t => (
              <div key={t.id} className={`bg-white border rounded-2xl p-4 transition-opacity ${t.activo ? 'border-slate-200' : 'border-slate-100 opacity-55'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <GraduationCap className="w-4 h-4 text-primary shrink-0"/>
                      <p className="font-semibold text-slate-900 text-sm truncate">{t.nome}</p>
                      {!t.activo && <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded-full">Inactiva</span>}
                    </div>
                    {t.descricao && <p className="text-xs text-slate-500 mb-2 line-clamp-2">{t.descricao}</p>}
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-semibold">
                        {t.tipo_desconto === 'percentagem' ? `${t.valor}%` : `${Number(t.valor).toLocaleString("pt-AO")} AOA`}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                        {t.abrangencia === 'propina' ? 'Propina mensal' : 'Todos emolumentos'}
                      </span>
                      {t.total_activos > 0 && (
                        <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">{t.total_activos} bolseiro(s)</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {/* Toggle activo/inactivo */}
                    <button onClick={() => toggleTipoActivo(t)} disabled={togglingTipo === t.id}
                      title={t.activo ? "Desactivar tipologia" : "Reactivar tipologia"}
                      className={`p-1.5 rounded-lg transition-colors ${t.activo ? 'hover:bg-amber-50 text-amber-500' : 'hover:bg-emerald-50 text-emerald-500'}`}>
                      {togglingTipo === t.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin"/> : t.activo ? <XCircle className="w-3.5 h-3.5"/> : <CheckCircle2 className="w-3.5 h-3.5"/>}
                    </button>
                    <button onClick={() => openEditTipo(t)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><Pencil className="w-3.5 h-3.5"/></button>
                    <button onClick={() => deleteTipo(t.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Bolseiros ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Alunos Bolseiros</h2>
            <p className="text-xs text-slate-500 mt-0.5">Gestão de atribuições e vigências</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
              {([{v:'activa',l:'Activas'},{v:'revogada',l:'Revogadas'},{v:'',l:'Todas'}] as const).map(o => (
                <button key={o.v} onClick={() => setFilterEstado(o.v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterEstado === o.v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  {o.l}
                </button>
              ))}
            </div>
            {tipos.filter(t => t.activo).length > 0 && (
              <button onClick={() => setShowAtribuirForm(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 transition-colors">
                <Plus className="w-3.5 h-3.5"/> Atribuir
              </button>
            )}
          </div>
        </div>

        {/* ── Filtros de pesquisa ── */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none"/>
            <input className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
              placeholder="Pesquisar aluno ou tipologia..." value={filterSearch} onChange={e => setFilterSearch(e.target.value)}/>
          </div>
          {turmasUnicas.length > 0 && (
            <select className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={filterTurma} onChange={e => setFilterTurma(e.target.value)}>
              <option value="">Todas as turmas</option>
              {turmasUnicas.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
        </div>

        {showAtribuirForm && (
          <form onSubmit={atribuirBolsa} className="mb-4 bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-emerald-800">Atribuir Bolsa</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={lCls}>Aluno</label>
                <select className={iCls} value={atribStudent} onChange={e => setAtribStudent(e.target.value)}>
                  <option value="">Seleccionar aluno...</option>
                  {alunos.map(a => <option key={a.id} value={a.id}>{a.nome} — {a.turma}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className={lCls}>Tipologia</label>
                <select className={iCls} value={atribTipo} onChange={e => setAtribTipo(e.target.value)}>
                  <option value="">Seleccionar tipologia...</option>
                  {tipos.filter(t => t.activo).map(t => (
                    <option key={t.id} value={t.id}>{t.nome} — {t.tipo_desconto === 'percentagem' ? `${t.valor}%` : `${Number(t.valor).toLocaleString("pt-AO")} AOA`}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lCls}>Início</label>
                <input type="date" className={iCls} value={atribDataInicio} onChange={e => setAtribDataInicio(e.target.value)}/>
              </div>
              <div>
                <label className={lCls}>Fim (opcional)</label>
                <input type="date" className={iCls} value={atribDataFim} onChange={e => setAtribDataFim(e.target.value)}/>
              </div>
              <div className="col-span-2">
                <label className={lCls}>Notas (opcional)</label>
                <input className={iCls} value={atribNotas} onChange={e => setAtribNotas(e.target.value)} placeholder="Observações sobre a concessão..."/>
              </div>
            </div>
            {atribError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{atribError}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowAtribuirForm(false)} className="flex-1 py-2 text-xs text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50">Cancelar</button>
              <button type="submit" disabled={atribSaving} className="flex-1 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-60">
                {atribSaving ? "A atribuir..." : "Atribuir Bolsa"}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12"><RefreshCw className="w-5 h-5 animate-spin text-primary"/></div>
        ) : atribuicoesFiltradas.length === 0 ? (
          <div className="text-center py-10 bg-white border border-slate-200 rounded-2xl text-slate-400">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-40"/>
            <p className="text-sm">Nenhum resultado{filterSearch || filterTurma ? ' para os filtros aplicados' : filterEstado === 'activa' ? ' — sem bolseiros activos' : filterEstado === 'revogada' ? ' — sem bolsas revogadas' : ''}.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {atribuicoesFiltradas.map(a => {
              const days = daysUntil(a.data_fim ?? null);
              const expireSoon = days !== null && days >= 0 && days <= 30;
              const isEditing = editAtrib?.id === a.id;
              return (
                <div key={a.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <GraduationCap className="w-4 h-4 text-primary"/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">{a.aluno_nome}</p>
                      <p className="text-xs text-slate-500">{a.turma} · <span className="font-medium text-primary">{a.bolsa_nome}</span> · {a.tipo_desconto === 'percentagem' ? `${a.bolsa_valor}%` : fmt(a.bolsa_valor)}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        {a.data_fim && (
                          <span className={`text-xs ${expireSoon ? 'text-amber-600 font-semibold' : 'text-slate-400'}`}>
                            {expireSoon && '⚠ '}Válida até {new Date(a.data_fim).toLocaleDateString("pt-AO")}{expireSoon && ` (${days}d)`}
                          </span>
                        )}
                        {a.notas && <span className="text-xs text-slate-400 italic truncate max-w-[160px]">{a.notas}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {a.estado === 'activa'
                        ? <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-semibold">Activa</span>
                        : <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full font-semibold capitalize">{a.estado}</span>}
                      {a.estado === 'activa' && (<>
                        <button onClick={() => { setEditAtrib(a); setEditAtribDataFim(a.data_fim ?? ""); setEditAtribNotas(a.notas ?? ""); setEditAtribError(""); }}
                          title="Editar vigência e notas"
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                          <Pencil className="w-3.5 h-3.5"/>
                        </button>
                        <button onClick={() => { setRevogarModal(a); setRevogarMotivo(""); }}
                          className="text-xs text-red-400 hover:text-red-600 font-semibold px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">
                          Revogar
                        </button>
                      </>)}
                    </div>
                  </div>

                  {/* ── Inline edit form ── */}
                  {isEditing && (
                    <form onSubmit={saveEditAtrib} className="border-t border-slate-100 px-4 py-3 bg-slate-50 space-y-3">
                      <p className="text-xs font-semibold text-slate-600">Editar vigência e notas</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Data de fim (opcional)</label>
                          <input type="date" className={iCls} value={editAtribDataFim} onChange={e => setEditAtribDataFim(e.target.value)}/>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Notas</label>
                          <input className={iCls} value={editAtribNotas} onChange={e => setEditAtribNotas(e.target.value)} placeholder="Observações..."/>
                        </div>
                      </div>
                      {editAtribError && <p className="text-xs text-red-600">{editAtribError}</p>}
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setEditAtrib(null)} className="flex-1 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-xl hover:bg-white">Cancelar</button>
                        <button type="submit" disabled={editAtribSaving} className="flex-1 py-1.5 text-xs font-semibold bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-60">
                          {editAtribSaving ? "A guardar..." : "Guardar"}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modal de Revogação ── */}
      <AnimatePresence>
        {revogarModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setRevogarModal(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                  <XCircle className="w-5 h-5 text-red-500"/>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Revogar Bolsa</h3>
                  <p className="text-xs text-slate-500">{revogarModal.aluno_nome} · {revogarModal.bolsa_nome}</p>
                </div>
              </div>
              <div>
                <label className={lCls}>Motivo (opcional)</label>
                <input className={iCls} value={revogarMotivo} onChange={e => setRevogarMotivo(e.target.value)}
                  placeholder="ex: Não cumpriu critérios de renovação"/>
              </div>
              <p className="text-xs text-slate-400">A bolsa será marcada como revogada. As propinas futuras já não terão desconto aplicado.</p>
              <div className="flex gap-2">
                <button onClick={() => setRevogarModal(null)} className="flex-1 py-2.5 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50">Cancelar</button>
                <button onClick={confirmarRevogar} disabled={revogarSaving}
                  className="flex-1 py-2.5 text-sm font-semibold bg-red-500 text-white rounded-xl hover:bg-red-600 disabled:opacity-60">
                  {revogarSaving ? "A revogar..." : "Confirmar Revogação"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   ARTIGOS TAB — store items with smart pre-defined suggestions
   ══════════════════════════════════════════════════════════ */
function ArtigosTab({ token, onPendingChange }: { token: string; onPendingChange?: (n: number) => void }) {
  const [items, setItems] = useState<StoreItemDB[]>([]);
  const [emolumentos, setEmolumentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<StoreItemDB | null>(null);
  const [form, setForm] = useState({ nome: "", descricao: "", preco: "", stock: "", categoria: "", visivel_portal: true });
  const [formErr, setFormErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [toggling, setToggling] = useState<number | null>(null);

  // Dropdown state
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedPredefined, setSelectedPredefined] = useState<any | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const api = (p: string, o?: RequestInit) => fetch(`${API}${p}`, { headers: h, ...o });
  const fmtKz = (n: number) => Number(n).toLocaleString("pt-AO") + " Kz";
  const inp = "w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20";
  const inpLocked = "w-full px-3 py-2 rounded-xl border border-slate-100 bg-slate-50 text-sm text-slate-500 cursor-not-allowed";

  const TIPO_LABEL: Record<string, string> = {
    propina: "Propina", transporte: "Transporte", atl: "ATL",
    confirmacao_matricula: "Matrícula", seguro: "Seguro",
    extracurricular: "Extracurricular", outro: "Taxa", multa: "Multa"
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    const [iRes, eRes] = await Promise.all([
      api("/school/store/items"),
      api("/school/emolumentos"),
    ]);
    if (iRes.ok) setItems(await iRes.json());
    if (eRes.ok) {
      const all = await eRes.json();
      setEmolumentos(all.filter((e: any) => e.school_id !== null && e.activo));
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Emolumentos not yet in store
  const predefinedNotInStore = emolumentos.filter(e =>
    !items.some(it => it.nome.toLowerCase() === e.nome.toLowerCase())
  );

  // Filtered + grouped dropdown options
  const q = searchQuery.toLowerCase().trim();
  const filteredOptions = emolumentos.filter(e =>
    !q || e.nome.toLowerCase().includes(q) || (TIPO_LABEL[e.tipo] || e.tipo).toLowerCase().includes(q)
  );
  const grouped = filteredOptions.reduce((acc: Record<string, any[]>, e) => {
    const cat = TIPO_LABEL[e.tipo] || e.tipo || "Outros";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(e);
    return acc;
  }, {});
  const groupKeys = Object.keys(grouped).sort();

  const alreadyInStore = (nome: string) => items.some(it => it.nome.toLowerCase() === nome.toLowerCase());

  const selectPredefined = (e: any) => {
    setSelectedPredefined(e);
    setForm(f => ({ ...f, nome: e.nome, preco: String(e.montante), categoria: TIPO_LABEL[e.tipo] || e.tipo, descricao: "" }));
    setSearchQuery(e.nome);
    setDropdownOpen(false);
    setManualMode(false);
    setFormErr("");
  };

  const clearSelection = () => {
    setSelectedPredefined(null);
    setSearchQuery("");
    setForm(f => ({ ...f, nome: "", preco: "", categoria: "", descricao: "" }));
    setTimeout(() => { searchRef.current?.focus(); setDropdownOpen(true); }, 50);
  };

  const openCreate = () => {
    setEditItem(null);
    setSelectedPredefined(null);
    setSearchQuery("");
    setManualMode(false);
    setForm({ nome: "", descricao: "", preco: "", stock: "", categoria: "", visivel_portal: true });
    setFormErr(""); setShowForm(true);
    setTimeout(() => { searchRef.current?.focus(); setDropdownOpen(true); }, 100);
  };

  const openEdit = (it: StoreItemDB) => {
    setEditItem(it);
    setSelectedPredefined(null);
    setSearchQuery("");
    setManualMode(true);
    setForm({ nome: it.nome, descricao: it.descricao || "", preco: String(it.preco), stock: it.stock !== null ? String(it.stock) : "", categoria: it.categoria || "", visivel_portal: it.visivel_portal });
    setFormErr(""); setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim() || !form.preco) return setFormErr("Nome e preço são obrigatórios.");
    setSaving(true); setFormErr("");
    const body = JSON.stringify({ nome: form.nome.trim(), descricao: form.descricao, preco: Number(form.preco), stock: form.stock !== "" ? Number(form.stock) : null, categoria: form.categoria, visivel_portal: form.visivel_portal });
    const r = await api(editItem ? `/school/store/items/${editItem.id}` : "/school/store/items", { method: editItem ? "PUT" : "POST", body });
    const d = await r.json();
    if (!r.ok) { setFormErr(d.error || "Erro ao guardar."); setSaving(false); return; }
    setShowForm(false); loadData(); setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Eliminar este artigo?")) return;
    setDeleting(id);
    await api(`/school/store/items/${id}`, { method: "DELETE" });
    setDeleting(null); loadData();
  };
  const handleTogglePortal = async (id: number) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, visivel_portal: !i.visivel_portal } : i));
    setToggling(id);
    try {
      const res = await api(`/school/store/items/${id}/toggle-portal`, { method: "PATCH" });
      if (res.ok) {
        const updated = await res.json();
        setItems(prev => prev.map(i => i.id === id ? updated : i));
      } else {
        setItems(prev => prev.map(i => i.id === id ? { ...i, visivel_portal: !i.visivel_portal } : i));
      }
    } catch {
      setItems(prev => prev.map(i => i.id === id ? { ...i, visivel_portal: !i.visivel_portal } : i));
    } finally {
      setToggling(null);
    }
  };
  const handleToggleAtivo = async (id: number) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ativo: !i.ativo } : i));
    try {
      const res = await api(`/school/store/items/${id}/toggle-ativo`, { method: "PATCH" });
      if (res.ok) {
        const updated = await res.json();
        setItems(prev => prev.map(i => i.id === id ? updated : i));
      } else {
        setItems(prev => prev.map(i => i.id === id ? { ...i, ativo: !i.ativo } : i));
      }
    } catch {
      setItems(prev => prev.map(i => i.id === id ? { ...i, ativo: !i.ativo } : i));
    }
  };

  const isLocked = !!selectedPredefined && !manualMode;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-slate-700">Artigos & Serviços</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Itens disponíveis para venda/cobrança no portal
            {predefinedNotInStore.length > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-blue-600 font-semibold">
                <Zap className="w-3 h-3"/> {predefinedNotInStore.length} pré-definido{predefinedNotInStore.length !== 1 ? "s" : ""} por adicionar
              </span>
            )}
          </p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4"/> Novo Artigo
        </button>
      </div>

      {/* Items table */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><RefreshCw className="w-6 h-6 animate-spin text-slate-300"/></div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-14 text-center">
          <Package className="w-12 h-12 text-slate-200 mx-auto mb-3"/>
          <p className="font-semibold text-slate-500">Nenhum artigo configurado</p>
          <p className="text-sm text-slate-400 mt-1 mb-4">
            {predefinedNotInStore.length > 0
              ? `Tem ${predefinedNotInStore.length} artigo(s) pré-definido(s) prontos a adicionar ao portal.`
              : "Adicione artigos que os encarregados poderão comprar no portal."}
          </p>
          <button onClick={openCreate} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90">
            <Plus className="w-3.5 h-3.5 inline mr-1"/>Adicionar Artigo
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Artigo</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Preço</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Stock</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Portal</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
                  <th className="px-4 py-3"/>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map(it => (
                  <tr key={it.id} className={`hover:bg-slate-50/60 transition-colors ${!it.ativo ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{it.nome}</p>
                      {it.descricao && <p className="text-xs text-slate-400 max-w-xs truncate">{it.descricao}</p>}
                      {it.categoria && <span className="inline-block mt-0.5 text-[11px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">{it.categoria}</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{fmtKz(Number(it.preco))}</td>
                    <td className="px-4 py-3 text-center">
                      {it.stock === null ? <span className="text-xs font-semibold text-emerald-600">∞</span>
                        : <span className={`font-bold ${it.stock === 0 ? "text-red-500" : it.stock < 5 ? "text-amber-600" : "text-slate-700"}`}>{it.stock}</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => handleTogglePortal(it.id)} disabled={toggling===it.id} title={it.visivel_portal ? "Visível no portal" : "Oculto no portal"}
                        className="inline-flex items-center justify-center rounded-full transition-colors relative"
                        style={{ height: 22, width: 40, backgroundColor: it.visivel_portal ? "hsl(var(--primary))" : "#e2e8f0" }}>
                        {toggling===it.id ? <RefreshCw className="w-3 h-3 text-white animate-spin absolute"/> :
                          <div className={`w-4 h-4 rounded-full bg-white shadow absolute transition-all ${it.visivel_portal ? "right-[3px]" : "left-[3px]"}`}/>}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => handleToggleAtivo(it.id)}
                        className={`text-xs px-2.5 py-1 rounded-lg font-semibold border transition-colors ${it.ativo ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-500 border-slate-200"}`}>
                        {it.ativo ? "Activo" : "Inactivo"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEdit(it)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><Pencil className="w-3.5 h-3.5"/></button>
                        <button onClick={() => handleDelete(it.id)} disabled={deleting===it.id} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                          {deleting===it.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin"/> : <Trash2 className="w-3.5 h-3.5"/>}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL CRIAR / EDITAR ARTIGO ── */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto">

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-900">{editItem ? "Editar Artigo" : "Adicionar Artigo"}</h3>
                <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4"/></button>
              </div>

              <div className="p-5 space-y-4">
                {formErr && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-sm">{formErr}</div>}

                {/* ── SMART SELECTOR (only when creating, not editing) ── */}
                {!editItem && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-slate-500">
                        {manualMode ? "Modo manual" : "Seleccionar artigo pré-definido"}
                      </label>
                      <button onClick={() => { setManualMode(v => !v); setSelectedPredefined(null); setSearchQuery(""); setForm(f => ({ ...f, nome: "", preco: "", categoria: "", descricao: "" })); }}
                        className="text-xs text-primary font-semibold hover:underline">
                        {manualMode ? "← Usar pré-definido" : "Criar do zero"}
                      </button>
                    </div>

                    {!manualMode && (
                      <div className="relative" ref={dropdownRef}>
                        {/* Search input */}
                        {!selectedPredefined ? (
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"/>
                            <input ref={searchRef}
                              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                              placeholder="Pesquisar artigo — ex: Uniforme, Propina..."
                              value={searchQuery}
                              onChange={e => { setSearchQuery(e.target.value); setDropdownOpen(true); }}
                              onFocus={() => setDropdownOpen(true)}
                            />
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-xl">
                            <CheckCircle2 className="w-4 h-4 text-primary shrink-0"/>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-900 truncate">{selectedPredefined.nome}</p>
                              <p className="text-xs text-slate-500">{TIPO_LABEL[selectedPredefined.tipo] || selectedPredefined.tipo} · {fmtKz(Number(selectedPredefined.montante))}</p>
                            </div>
                            <button onClick={clearSelection} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 shrink-0"><X className="w-3.5 h-3.5"/></button>
                          </div>
                        )}

                        {/* Dropdown list */}
                        <AnimatePresence>
                          {dropdownOpen && !selectedPredefined && (
                            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                              className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                              {groupKeys.length === 0 ? (
                                <div className="px-4 py-8 text-center">
                                  <p className="text-sm text-slate-400">
                                    {emolumentos.length === 0 ? "Sem artigos pré-definidos. Use \"Criar do zero\" para adicionar manualmente." : "Nenhum resultado para a pesquisa."}
                                  </p>
                                </div>
                              ) : (
                                groupKeys.map(cat => (
                                  <div key={cat}>
                                    <div className="px-3 py-1.5 bg-slate-50 border-y border-slate-100 sticky top-0">
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{cat}</p>
                                    </div>
                                    {grouped[cat].map((e: any) => {
                                      const inStore = alreadyInStore(e.nome);
                                      return (
                                        <button key={e.id} onClick={() => !inStore && selectPredefined(e)}
                                          className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors group ${inStore ? "opacity-40 cursor-not-allowed" : "hover:bg-primary/5"}`}>
                                          <div className="min-w-0">
                                            <p className="text-sm font-medium text-slate-800 truncate">{e.nome}</p>
                                            {inStore && <p className="text-[11px] text-slate-400">já na loja</p>}
                                          </div>
                                          <div className="text-right shrink-0 ml-3">
                                            <p className="text-sm font-bold text-slate-700">{fmtKz(Number(e.montante))}</p>
                                            {!inStore && <p className="text-[11px] text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">+ Seleccionar</p>}
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                ))
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {/* Duplicate warning */}
                    {!selectedPredefined && !manualMode && form.nome && alreadyInStore(form.nome) && (
                      <div className="mt-2 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5"/>
                        <p className="text-xs text-amber-700">Este artigo já existe na loja. Seleccione-o da lista para evitar duplicados.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* ── FORM FIELDS ── */}
                {(manualMode || !!editItem) && (
                  <>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">Nome do artigo *</label>
                      <input className={inp} value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="ex: Uniforme Completo, Propina"/>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">Categoria</label>
                      <input className={inp} value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} placeholder="ex: Vestuário, Propina, Taxa"/>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">Descrição</label>
                      <textarea className={inp} rows={2} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descrição breve (opcional)"/>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Preço (Kz) *</label>
                        <input type="number" min={0} className={inp} value={form.preco} onChange={e => setForm(f => ({ ...f, preco: e.target.value }))} placeholder="0"/>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Stock (vazio = ilimitado)</label>
                        <input type="number" min={0} className={inp} value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} placeholder="∞"/>
                      </div>
                    </div>
                  </>
                )}

                {/* When pre-defined selected: show locked fields + only editable stock */}
                {isLocked && (
                  <>
                    <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-100">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1">Dados do artigo (pré-definido)</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-slate-400 mb-0.5">Nome</p>
                          <p className="text-sm font-semibold text-slate-800">{form.nome}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-0.5">Preço</p>
                          <p className="text-sm font-bold text-slate-800">{fmtKz(Number(form.preco))}</p>
                        </div>
                      </div>
                      {form.categoria && (
                        <div>
                          <p className="text-xs text-slate-400 mb-0.5">Categoria</p>
                          <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 font-medium">{form.categoria}</span>
                        </div>
                      )}
                      <button onClick={() => setManualMode(true)} className="text-xs text-primary font-semibold hover:underline flex items-center gap-1">
                        <Pencil className="w-3 h-3"/> Editar dados manualmente
                      </button>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">Descrição para o portal</label>
                      <textarea className={inp} rows={2} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descrição adicional (opcional)"/>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">Stock (vazio = ilimitado)</label>
                      <input type="number" min={0} className={inp} value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} placeholder="∞ ilimitado"/>
                    </div>
                  </>
                )}

                {/* Visibility toggle — always visible */}
                <div className="flex items-center justify-between py-3 border-t border-slate-100">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Visível no portal</p>
                    <p className="text-xs text-slate-400">Encarregados podem ver e pagar</p>
                  </div>
                  <button type="button" onClick={() => setForm(f => ({ ...f, visivel_portal: !f.visivel_portal }))}
                    style={{ height: 22, width: 40, backgroundColor: form.visivel_portal ? "hsl(var(--primary))" : "#e2e8f0" }}
                    className="rounded-full relative transition-colors shrink-0 flex-shrink-0">
                    <div className={`w-4 h-4 rounded-full bg-white absolute top-[3px] transition-all ${form.visivel_portal ? "left-[21px]" : "left-[3px]"}`}/>
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
                <button onClick={handleSave} disabled={saving || (!editItem && !isLocked && !manualMode && !form.nome.trim())}
                  className="px-5 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 flex items-center gap-2">
                  {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin"/>}
                  {saving ? "A guardar..." : editItem ? "Guardar alterações" : "Adicionar à loja"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   ENTREGAS TAB — order delivery queue
   ══════════════════════════════════════════════════════════ */
function EntregasTab({ token, onPendingChange }: { token: string; onPendingChange?: (n: number) => void }) {
  const [orders, setOrders] = useState<StoreOrderDB[]>([]);
  const [filterEstado, setFilterEstado] = useState("pago");
  const [deliverModal, setDeliverModal] = useState<StoreOrderDB | null>(null);
  const [operador, setOperador] = useState("");
  const [deliveryNotas, setDeliveryNotas] = useState("");
  const [savingDelivery, setSavingDelivery] = useState(false);
  const [markingPago, setMarkingPago] = useState<number | null>(null);

  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const api = (p: string, o?: RequestInit) => fetch(`${API}${p}`, { headers: h, ...o });
  const fmtKz = (n: number) => Number(n).toLocaleString("pt-AO") + " Kz";

  const loadOrders = useCallback(async (estado = filterEstado) => {
    const r = await api(`/school/store/orders?estado=${estado}`);
    if (r.ok) {
      const data = await r.json();
      setOrders(data);
      if (estado === "pago") onPendingChange?.(data.length);
    }
  }, [token, filterEstado]);

  useEffect(() => { loadOrders(filterEstado); }, [filterEstado]);

  const handleMarkPago = async (id: number) => {
    setMarkingPago(id);
    await api(`/school/store/orders/${id}/marcar-pago`, { method: "POST", body: JSON.stringify({}) });
    setMarkingPago(null); loadOrders(filterEstado);
  };
  const handleDeliver = async () => {
    if (!deliverModal) return;
    setSavingDelivery(true);
    const r = await api(`/school/store/orders/${deliverModal.id}/entregar`, { method: "POST", body: JSON.stringify({ operador: operador || "Operador", notas: deliveryNotas }) });
    if (r.ok) { setDeliverModal(null); setOperador(""); setDeliveryNotas(""); loadOrders(filterEstado); }
    setSavingDelivery(false);
  };

  const pendingPago = orders.filter(o => o.estado === "pago").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-700">Fila de Entrega</h2>
          <p className="text-xs text-slate-400">Gerencie encomendas pagas e confirme entregas</p>
        </div>
        {pendingPago > 0 && (
          <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold border border-amber-200">
            {pendingPago} aguarda{pendingPago !== 1 ? "m" : ""} entrega
          </span>
        )}
      </div>
      <div className="flex gap-2 flex-wrap mb-4">
        {(["pago", "pendente_pagamento", "entregue"] as const).map(e => (
          <button key={e} onClick={() => setFilterEstado(e)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${filterEstado === e ? "bg-primary text-white border-primary" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
            {e === "pago" ? "Aguardando Entrega" : e === "entregue" ? "Entregues" : "Pag. Pendente"}
          </button>
        ))}
      </div>
      {orders.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-14 text-center">
          <Truck className="w-12 h-12 text-slate-200 mx-auto mb-3"/>
          <p className="font-semibold text-slate-500">Nenhuma encomenda</p>
          <p className="text-sm text-slate-400 mt-1">
            {filterEstado === "pago" ? "Não há encomendas pagas aguardando entrega." : filterEstado === "entregue" ? "Nenhuma entrega realizada ainda." : "Nenhuma encomenda pendente."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => (
            <div key={order.id} className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg tracking-widest text-sm">{order.voucher_code}</span>
                    {order.estado === "pago" && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">Aguarda Entrega</span>}
                    {order.estado === "entregue" && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">Entregue ✓</span>}
                    {order.estado === "pendente_pagamento" && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">Pag. Pendente</span>}
                  </div>
                  {order.guardian_nome && <p className="text-sm text-slate-700"><span className="font-medium">Encarregado:</span> {order.guardian_nome}</p>}
                  {order.student_nome && <p className="text-xs text-slate-500 mt-0.5">Educando: {order.student_nome}</p>}
                  <div className="mt-2 space-y-0.5">
                    {Array.isArray(order.items) && order.items.filter((i: any) => i.item_nome).map((it: any, idx: number) => (
                      <p key={idx} className="text-xs text-slate-500">• {it.item_nome} × {it.quantidade} — <span className="font-medium text-slate-700">{fmtKz(Number(it.preco_unit) * it.quantidade)}</span></p>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> {new Date(order.created_at).toLocaleString("pt-AO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    <span>· Total: <span className="font-semibold text-slate-700">{fmtKz(Number(order.total))}</span></span>
                    {order.referencia && <span>· Ref: <span className="font-mono">{order.referencia}</span></span>}
                  </div>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  {order.estado === "pendente_pagamento" && (
                    <button onClick={() => handleMarkPago(order.id)} disabled={markingPago === order.id}
                      className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 disabled:opacity-60">
                      {markingPago === order.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin"/> : <CheckCheck className="w-3.5 h-3.5"/>} Marcar Pago
                    </button>
                  )}
                  {order.estado === "pago" && (
                    <button onClick={() => { setDeliverModal(order); setOperador(""); setDeliveryNotas(""); }}
                      className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700">
                      <Truck className="w-3.5 h-3.5"/> Confirmar Entrega
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal confirmar entrega */}
      <AnimatePresence>
        {deliverModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 flex items-center gap-2"><Truck className="w-4 h-4 text-emerald-600"/> Confirmar Entrega</h3>
                <button onClick={() => setDeliverModal(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4"/></button>
              </div>
              <div className="p-5 space-y-4">
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-slate-500 mb-1">Código de Voucher</p>
                  <p className="font-mono font-bold text-slate-900 text-2xl tracking-widest">{deliverModal.voucher_code}</p>
                  <p className="text-xs text-slate-400 mt-1">{deliverModal.guardian_nome}</p>
                </div>
                <div className="space-y-1.5 text-xs text-slate-500 border border-slate-100 rounded-xl p-3">
                  {Array.isArray(deliverModal.items) && deliverModal.items.filter((i: any) => i.item_nome).map((it: any, idx: number) => (
                    <p key={idx}>• {it.item_nome} × {it.quantidade}</p>
                  ))}
                  <p className="font-semibold text-slate-700 pt-1 border-t border-slate-100 mt-1">Total: {fmtKz(Number(deliverModal.total))}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Operador responsável</label>
                  <input className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={operador} onChange={e => setOperador(e.target.value)} placeholder="Nome do operador"/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Notas (opcional)</label>
                  <textarea className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" rows={2}
                    value={deliveryNotas} onChange={e => setDeliveryNotas(e.target.value)} placeholder="Observações..."/>
                </div>
              </div>
              <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
                <button onClick={() => setDeliverModal(null)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
                <button onClick={handleDeliver} disabled={savingDelivery} className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-2">
                  {savingDelivery && <RefreshCw className="w-3.5 h-3.5 animate-spin"/>} Confirmar Entrega
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Main EmolumentosView: sub-tabs ─── */
function EmolumentosView({ token, onStorePending }: { token: string; onStorePending?: (n: number) => void }) {
  const [activeTab, setActiveTab] = useState<"globais" | "locais" | "pacotes" | "bolsas" | "artigos" | "entregas">("globais");

  const tabs = [
    { key: "globais" as const, label: "Globais", icon: <Globe className="w-4 h-4"/> },
    { key: "locais" as const, label: "Locais", icon: <Receipt className="w-4 h-4"/> },
    { key: "pacotes" as const, label: "Pacotes", icon: <Package className="w-4 h-4"/> },
    { key: "bolsas" as const, label: "Bolsas", icon: <GraduationCap className="w-4 h-4"/> },
    { key: "artigos" as const, label: "Artigos", icon: <ShoppingCart className="w-4 h-4"/> },
    { key: "entregas" as const, label: "Entregas", icon: <Truck className="w-4 h-4"/> },
  ];

  return (
    <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex-1 p-4 md:p-6 max-w-4xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Receipt className="w-5 h-5 text-primary"/> Emolumentos & Artigos
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Taxas académicas, pacotes, bolsas e artigos disponíveis no portal</p>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 mb-6 w-fit flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "globais" && (
          <motion.div key="globais" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <GlobalEmolumentosTab token={token} />
          </motion.div>
        )}
        {activeTab === "locais" && (
          <motion.div key="locais" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <LocalEmolumentosTab token={token} />
          </motion.div>
        )}
        {activeTab === "pacotes" && (
          <motion.div key="pacotes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <PacotesSchoolTab token={token} />
          </motion.div>
        )}
        {activeTab === "bolsas" && (
          <motion.div key="bolsas" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <BolsasSchoolTab token={token} />
          </motion.div>
        )}
        {activeTab === "artigos" && (
          <motion.div key="artigos" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ArtigosTab token={token} onPendingChange={onStorePending} />
          </motion.div>
        )}
        {activeTab === "entregas" && (
          <motion.div key="entregas" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <EntregasTab token={token} onPendingChange={onStorePending} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}


/* ══════════════════════════════════════════════════════════
   MÓDULO: CALENDÁRIO ESCOLAR
   ══════════════════════════════════════════════════════════ */
function CalendarioView({ token, turmas, moduloInfantil }: { token: string; turmas: Turma[]; moduloInfantil?: boolean }) {
  type CTab = "calendarios" | "tipos" | "infantil";
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const DIAS_FULL = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];
  const MESES_SHORT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const MESES_FULL = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const COR_PRESETS = ["#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899","#06B6D4","#84CC16","#F97316","#6B7280"];
  const PESO_LABELS = ["","Peso 1","Peso 2","Peso 3","Peso 4","Peso 5"];
  const PESO_COLORS = ["","bg-slate-100 text-slate-500","bg-blue-100 text-blue-700","bg-violet-100 text-violet-700","bg-amber-100 text-amber-700","bg-red-100 text-red-700"];
  const DISCIPLINAS = ["Língua Portuguesa","Matemática","Física","Química","Biologia","História","Geografia","Educação Física","Educação Cívica","Inglês","Francês","Geometria Descritiva","Filosofia","Economia","Contabilidade","Direito","Literatura","Informática","Música","Artes Visuais","Ciências Naturais","Empreendedorismo"];
  const STATUS_CLS: Record<string,string> = { activo:"bg-emerald-100 text-emerald-700 border-emerald-200", programado:"bg-blue-100 text-blue-700 border-blue-200", historico:"bg-slate-100 text-slate-500 border-slate-200" };
  const STATUS_PT: Record<string,string> = { activo:"Activo", programado:"Programado", historico:"Histórico" };

  // ─── Navigation ───
  const [cTab, setCTab] = useState<CTab>("calendarios");
  const [calViewMode, setCalViewMode] = useState<"mes"|"semana"|"lista">("lista");
  const [calViewDate, setCalViewDate] = useState(() => new Date());

  // ─── Filters ───
  const [filterTurma, setFilterTurma] = useState("");
  const [filterTipo, setFilterTipo] = useState("");

  // ─── Toast ───
  const [toast, setToast] = useState<{msg:string;type:"error"|"warning"}|null>(null);
  const showToast = useCallback((msg: string, type: "error"|"warning" = "error") => {
    setToast({msg, type});
    setTimeout(() => setToast(null), 5000);
  }, []);

  // ─── Tipos de Prova ───
  const [tipos, setTipos] = useState<any[]>([]);
  const [loadingTipos, setLoadingTipos] = useState(false);
  const [showTipoForm, setShowTipoForm] = useState(false);
  const [editTipo, setEditTipo] = useState<any>(null);
  const [tipoForm, setTipoForm] = useState({ nome:"", sigla:"", cor:"#3B82F6", peso:1, descricao:"" });
  const [savingTipo, setSavingTipo] = useState(false);

  const loadTipos = useCallback(async () => {
    setLoadingTipos(true);
    try {
      const r = await fetch(`${API}/school/calendario/tipos-prova`, { headers });
      if (r.ok) setTipos(await r.json());
    } catch {} finally { setLoadingTipos(false); }
  }, [token]);
  useEffect(() => { loadTipos(); }, [loadTipos]);

  const saveTipo = async () => {
    if (!tipoForm.nome.trim()) return;
    setSavingTipo(true);
    try {
      const url = editTipo ? `${API}/school/calendario/tipos-prova/${editTipo.id}` : `${API}/school/calendario/tipos-prova`;
      const r = await fetch(url, { method: editTipo?"PUT":"POST", headers, body: JSON.stringify(tipoForm) });
      if (r.ok) { await loadTipos(); setShowTipoForm(false); setEditTipo(null); setTipoForm({nome:"",sigla:"",cor:"#3B82F6",peso:1,descricao:""}); }
    } catch {} finally { setSavingTipo(false); }
  };
  const deleteTipo = async (id: number) => {
    if (!confirm("Eliminar este tipo de prova?")) return;
    await fetch(`${API}/school/calendario/tipos-prova/${id}`, { method:"DELETE", headers });
    await loadTipos();
  };

  // ─── Calendários ───
  const [calendarios, setCalendarios] = useState<any[]>([]);
  const [loadingCal, setLoadingCal] = useState(false);
  const [showCalForm, setShowCalForm] = useState(false);
  const [editCal, setEditCal] = useState<any>(null);
  const todayStr = new Date().toISOString().slice(0,10);
  const threeMonthsStr = new Date(Date.now()+90*86400000).toISOString().slice(0,10);
  const emptyCalForm = { nome:"", tipo:"provas", descricao:"", vigencia_inicio:todayStr, vigencia_fim:threeMonthsStr, alertas_horas:"48", gerar_notificacoes:true };
  const [calForm, setCalForm] = useState(emptyCalForm);
  const [savingCal, setSavingCal] = useState(false);
  const [expandedCals, setExpandedCals] = useState<Set<number>>(new Set());
  const [togglingPub, setTogglingPub] = useState<number|null>(null);
  const [deletingCal, setDeletingCal] = useState<number|null>(null);

  const loadCalendarios = useCallback(async () => {
    setLoadingCal(true);
    try {
      const r = await fetch(`${API}/school/calendarios`, { headers });
      if (r.ok) {
        const data = await r.json();
        setCalendarios(data);
        if (data.length > 0) {
          setExpandedCals(new Set(data.map((c: any) => c.id)));
          data.forEach((c: any) => loadEventos(c.id));
        }
      }
    } catch {} finally { setLoadingCal(false); }
  }, [token]);
  useEffect(() => { loadCalendarios(); }, [loadCalendarios]);

  const saveCal = async () => {
    setSavingCal(true);
    try {
      const url = editCal ? `${API}/school/calendarios/${editCal.id}` : `${API}/school/calendarios`;
      const r = await fetch(url, { method: editCal?"PUT":"POST", headers, body: JSON.stringify({...calForm, alertas_horas: Number(calForm.alertas_horas)}) });
      if (r.ok) { await loadCalendarios(); setShowCalForm(false); setEditCal(null); setCalForm(emptyCalForm); }
    } catch {} finally { setSavingCal(false); }
  };
  const togglePublicar = async (id: number) => {
    setTogglingPub(id);
    try {
      const r = await fetch(`${API}/school/calendarios/${id}/publicar`, { method:"PATCH", headers });
      if (r.ok) { const up = await r.json(); setCalendarios(prev => prev.map(c => c.id===id ? {...c,...up} : c)); }
    } catch {} finally { setTogglingPub(null); }
  };
  const deleteCal = async (id: number) => {
    if (!confirm("Eliminar este calendário e todos os seus eventos?")) return;
    setDeletingCal(id);
    try {
      await fetch(`${API}/school/calendarios/${id}`, { method:"DELETE", headers });
      setCalendarios(prev => prev.filter(c => c.id!==id));
      setExpandedCals(prev => { const s = new Set(prev); s.delete(id); return s; });
    } catch {} finally { setDeletingCal(null); }
  };

  // ─── Eventos ───
  const [eventos, setEventos] = useState<Record<number,any[]>>({});
  const [loadingEvt, setLoadingEvt] = useState<number|null>(null);
  const [showEvtForm, setShowEvtForm] = useState<number|null>(null);
  const [editEvt, setEditEvt] = useState<any>(null);
  const [evtForm, setEvtForm] = useState<Record<string,any>>({});
  const [savingEvt, setSavingEvt] = useState(false);
  const [evtError, setEvtError] = useState<string|null>(null);
  const [deletingEvt, setDeletingEvt] = useState<number|null>(null);

  const loadEventos = async (calId: number) => {
    setLoadingEvt(calId);
    try {
      const r = await fetch(`${API}/school/calendarios/${calId}/eventos`, { headers });
      if (r.ok) { const data = await r.json(); setEventos(prev => ({...prev, [calId]: data})); }
    } catch {} finally { setLoadingEvt(null); }
  };

  const toggleExpandCal = (id: number) => {
    setExpandedCals(prev => {
      const s = new Set(prev);
      if (s.has(id)) { s.delete(id); } else { s.add(id); if (!eventos[id]) loadEventos(id); }
      return s;
    });
  };

  const openEvtForm = (calId: number, cal: any, evt?: any, prefillDate?: string) => {
    setEditEvt(evt||null); setEvtError(null);
    if (evt) {
      setEvtForm({...evt, data_inicio: evt.data_inicio ? evt.data_inicio.slice(0,16) : "", data_fim: evt.data_fim ? evt.data_fim.slice(0,16) : "", dias_semana: [Number(evt.dia_semana)], turma_ids: evt.turma_id ? [String(evt.turma_id)] : []});
    } else {
      const base: Record<string,any> = { titulo:"", turma_id:"", turma_ids:[], professor:"", sala:"", descricao:"", tipo_prova_id:"", publicado:true };
      if (cal.tipo==="provas") {
        base.data_inicio = prefillDate ? `${prefillDate}T08:00` : "";
        base.data_fim    = prefillDate ? `${prefillDate}T10:00` : "";
      } else {
        base.dias_semana=[0,1,2,3,4]; base.hora_inicio_aula="08:00"; base.hora_fim_aula="09:00";
      }
      setEvtForm(base);
    }
    setShowEvtForm(calId);
  };

  const saveEvt = async (calId: number) => {
    setSavingEvt(true); setEvtError(null);
    try {
      const base = {...evtForm};
      if (base.tipo_prova_id) {
        const tp = tipos.find((t:any) => t.id===Number(base.tipo_prova_id));
        if (tp) { base.tipo_prova_nome=tp.nome; base.tipo_prova_cor=tp.cor; }
      }
      const cal = calendarios.find(c => c.id===calId);
      const isProvas = cal?.tipo === "provas";
      const turmaIds: string[] = (isProvas && !editEvt && (base.turma_ids||[]).length > 0) ? base.turma_ids : [];

      if (editEvt) {
        const payload = {...base, dia_semana: (base.dias_semana||[Number(base.dia_semana)])[0] };
        if (payload.turma_id) { const tm = turmas.find(t => String(t.id)===String(payload.turma_id)); if (tm) payload.turma_nome=tm.nome; }
        delete payload.dias_semana; delete payload.turma_ids;
        const r = await fetch(`${API}/school/calendarios/${calId}/eventos/${editEvt.id}`, { method:"PUT", headers, body: JSON.stringify(payload) });
        if (!r.ok) { const e = await r.json(); const msg = e.error||"Erro ao guardar."; setEvtError(msg); if (r.status===409) showToast(msg,"warning"); setSavingEvt(false); return; }
      } else if (isProvas && turmaIds.length > 0) {
        const results = await Promise.all(turmaIds.map(tid => {
          const tm = turmas.find(t => String(t.id)===tid);
          const payload = {...base, turma_id: tid, turma_nome: tm?.nome||"", dia_semana: null };
          delete payload.dias_semana; delete payload.turma_ids;
          return fetch(`${API}/school/calendarios/${calId}/eventos`, { method:"POST", headers, body: JSON.stringify(payload) });
        }));
        const failed = results.find(r => !r.ok);
        if (failed) { const e = await failed.json(); const msg = e.error||"Erro ao guardar."; setEvtError(msg); if (failed.status===409) showToast(msg,"warning"); setSavingEvt(false); return; }
      } else if (!isProvas) {
        const dias: number[] = base.dias_semana||[0];
        if (dias.length===0) { setEvtError("Seleccione pelo menos um dia da semana."); setSavingEvt(false); return; }
        const results = await Promise.all(dias.map(d => {
          const payload = {...base, dia_semana: d};
          delete payload.dias_semana; delete payload.turma_ids;
          if (payload.turma_id) { const tm = turmas.find(t => String(t.id)===String(payload.turma_id)); if (tm) payload.turma_nome=tm.nome; }
          return fetch(`${API}/school/calendarios/${calId}/eventos`, { method:"POST", headers, body: JSON.stringify(payload) });
        }));
        const failed = results.find(r => !r.ok);
        if (failed) { const e = await failed.json(); const msg = e.error||"Erro ao guardar."; setEvtError(msg); if (failed.status===409) showToast(msg,"warning"); setSavingEvt(false); return; }
      } else {
        if (base.turma_id) { const tm = turmas.find(t => String(t.id)===String(base.turma_id)); if (tm) base.turma_nome=tm.nome; }
        const payload = {...base}; delete payload.dias_semana; delete payload.turma_ids;
        const r = await fetch(`${API}/school/calendarios/${calId}/eventos`, { method:"POST", headers, body: JSON.stringify(payload) });
        if (!r.ok) { const e = await r.json(); const msg = e.error||"Erro ao guardar."; setEvtError(msg); if (r.status===409) showToast(msg,"warning"); setSavingEvt(false); return; }
      }
      await loadEventos(calId);
      setShowEvtForm(null); setEditEvt(null);
    } catch { setEvtError("Erro de ligação."); } finally { setSavingEvt(false); }
  };

  const deleteEvt = async (calId: number, evtId: number) => {
    setDeletingEvt(evtId);
    try {
      await fetch(`${API}/school/calendarios/${calId}/eventos/${evtId}`, { method:"DELETE", headers });
      setEventos(prev => ({...prev, [calId]: (prev[calId]||[]).filter(e => e.id!==evtId)}));
    } catch {} finally { setDeletingEvt(null); }
  };

  const fmtDate = (s: string) => new Date(s).toLocaleDateString("pt-AO",{day:"2-digit",month:"short",year:"numeric"});

  // ─── Computed ───
  const allEventos = useMemo(() => Object.values(eventos).flat(), [eventos]);

  const filteredEventos = useMemo(() => allEventos.filter(ev => {
    if (filterTurma && String(ev.turma_id) !== filterTurma) return false;
    if (filterTipo && String(ev.tipo_prova_id) !== filterTipo) return false;
    return true;
  }), [allEventos, filterTurma, filterTipo]);

  const eventosByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    filteredEventos.forEach(ev => {
      if (!ev.data_inicio) return;
      const key = new Date(ev.data_inicio).toISOString().slice(0,10);
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    });
    return map;
  }, [filteredEventos]);

  const monthCells = useMemo(() => {
    const firstDay = new Date(calViewDate.getFullYear(), calViewDate.getMonth(), 1);
    const dow = (firstDay.getDay() + 6) % 7;
    const start = new Date(firstDay);
    start.setDate(start.getDate() - dow);
    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) cells.push(new Date(start.getTime() + i * 86400000));
    return cells;
  }, [calViewDate]);

  const weekDays = useMemo(() => {
    const d = new Date(calViewDate);
    const dow = (d.getDay() + 6) % 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - dow);
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) days.push(new Date(monday.getTime() + i * 86400000));
    return days;
  }, [calViewDate]);

  const todayDateStr = new Date().toISOString().slice(0,10);

  const defaultProvasCal = useMemo(() =>
    calendarios.find(c => c.tipo==="provas" && c.status==="activo") ||
    calendarios.find(c => c.tipo==="provas") || null,
  [calendarios]);

  const navigatePrev = () => {
    const d = new Date(calViewDate);
    if (calViewMode==="mes") d.setMonth(d.getMonth()-1); else d.setDate(d.getDate()-7);
    setCalViewDate(d);
  };
  const navigateNext = () => {
    const d = new Date(calViewDate);
    if (calViewMode==="mes") d.setMonth(d.getMonth()+1); else d.setDate(d.getDate()+7);
    setCalViewDate(d);
  };

  const calNavLabel = calViewMode==="mes"
    ? `${MESES_FULL[calViewDate.getMonth()]} ${calViewDate.getFullYear()}`
    : (() => {
        const s = weekDays[0]; const e = weekDays[6];
        return `${String(s.getDate()).padStart(2,"0")} ${MESES_SHORT[s.getMonth()]} – ${String(e.getDate()).padStart(2,"0")} ${MESES_SHORT[e.getMonth()]} ${e.getFullYear()}`;
      })();

  return (
    <div className="max-w-5xl mx-auto px-4 pb-8">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div className={`fixed top-4 right-4 z-[100] flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm ${toast.type==="warning"?"bg-amber-50 border-amber-200 text-amber-800":"bg-red-50 border-red-200 text-red-800"}`}
            initial={{opacity:0,y:-16}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-16}}>
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5"/>
            <p className="text-sm font-medium flex-1">{toast.msg}</p>
            <button onClick={()=>setToast(null)} className="shrink-0 opacity-60 hover:opacity-100"><X className="w-3.5 h-3.5"/></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Calendário Escolar</h2>
          <p className="text-slate-500 text-sm mt-0.5">Horários de aulas e calendários de provas</p>
        </div>
        {cTab !== "infantil" && (
          <button onClick={() => { setShowCalForm(true); setEditCal(null); setCalForm(emptyCalForm); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4"/> Novo Calendário
          </button>
        )}
      </div>

      {/* Main tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-6 w-fit flex-wrap">
        {([["calendarios","Calendários"],["tipos","Tipos de Prova"],...(moduloInfantil?[["infantil","Módulo Infantil"]]:[])] as [CTab,string][]).map(([k,l]) => (
          <button key={k} onClick={() => setCTab(k)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${cTab===k?"bg-white shadow text-slate-900":"text-slate-500 hover:text-slate-700"}`}>{l}</button>
        ))}
      </div>

      {/* ─── TAB: CALENDÁRIOS ─── */}
      {cTab==="calendarios" && (
        <div>
          {/* View switcher + filters bar */}
          <div className="flex flex-wrap gap-3 items-center mb-5">
            <div className="flex gap-0.5 bg-slate-100 rounded-xl p-1">
              {(["lista","mes","semana"] as const).map(m => (
                <button key={m} onClick={() => setCalViewMode(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${calViewMode===m?"bg-white shadow text-slate-900":"text-slate-500 hover:text-slate-700"}`}>
                  {m==="lista"?"Lista":m==="mes"?"Mês":"Semana"}
                </button>
              ))}
            </div>
            <select value={filterTurma} onChange={e=>setFilterTurma(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">Todas as turmas</option>
              {turmas.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
            <select value={filterTipo} onChange={e=>setFilterTipo(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">Todos os tipos</option>
              {tipos.map(tp=><option key={tp.id} value={tp.id}>{tp.nome}</option>)}
            </select>
            {(filterTurma||filterTipo) && (
              <button onClick={()=>{setFilterTurma("");setFilterTipo("");}} className="text-xs text-blue-600 hover:underline">Limpar filtros</button>
            )}
          </div>

          {/* ── VISTA MÊS ── */}
          {calViewMode==="mes" && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <button onClick={navigatePrev} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><ChevronLeft className="w-5 h-5"/></button>
                <span className="font-bold text-slate-800 min-w-[190px] text-center">{calNavLabel}</span>
                <button onClick={navigateNext} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><ChevronRight className="w-5 h-5"/></button>
                <button onClick={()=>setCalViewDate(new Date())} className="ml-1 px-3 py-1 rounded-lg text-xs font-medium border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">Hoje</button>
                {defaultProvasCal && (
                  <span className="ml-auto text-xs text-slate-400 hidden sm:block">Clique num dia para agendar</span>
                )}
              </div>
              <div className="grid grid-cols-7 mb-1">
                {DIAS_FULL.map(d=>(
                  <div key={d} className="py-1 text-center text-xs font-bold text-slate-400 uppercase tracking-wide">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {monthCells.map((cell, idx) => {
                  const dateStr = cell.toISOString().slice(0,10);
                  const isCurrentMonth = cell.getMonth()===calViewDate.getMonth();
                  const isToday = dateStr===todayDateStr;
                  const dayEvts = eventosByDate[dateStr]||[];
                  return (
                    <div key={idx}
                      onClick={() => { if (defaultProvasCal) openEvtForm(defaultProvasCal.id, defaultProvasCal, undefined, dateStr); }}
                      className={`min-h-[80px] sm:min-h-[90px] rounded-xl p-1.5 border transition-colors
                        ${isToday?"border-blue-400 bg-blue-50/50":"border-slate-100"}
                        ${!isCurrentMonth?"bg-slate-50/40 border-slate-50":"bg-white"}
                        ${defaultProvasCal?"cursor-pointer hover:border-blue-200 hover:bg-blue-50/20":""}`}>
                      <span className={`text-xs font-bold leading-none inline-flex items-center justify-center w-6 h-6 rounded-full mb-1
                        ${isToday?"bg-blue-600 text-white":isCurrentMonth?"text-slate-700":"text-slate-300"}`}>
                        {cell.getDate()}
                      </span>
                      <div className="space-y-0.5">
                        {dayEvts.slice(0,3).map(ev=>(
                          <div key={ev.id} onClick={e=>{e.stopPropagation();const c=calendarios.find(cl=>cl.id===ev.calendario_id);if(c)openEvtForm(c.id,c,ev);}}
                            className="text-xs rounded px-1 py-0.5 truncate font-medium leading-tight cursor-pointer hover:opacity-80 transition-opacity"
                            style={{backgroundColor:(ev.tipo_prova_cor||"#3B82F6")+"28",color:ev.tipo_prova_cor||"#3B82F6"}}>
                            {ev.turma_nome?`${ev.turma_nome} `:""}
                            {ev.titulo}
                          </div>
                        ))}
                        {dayEvts.length>3 && <div className="text-xs text-slate-400 pl-1">+{dayEvts.length-3}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
              {tipos.filter(tp=>filteredEventos.some(ev=>Number(ev.tipo_prova_id)===tp.id)).length>0 && (
                <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-slate-100">
                  {tipos.filter(tp=>filteredEventos.some(ev=>Number(ev.tipo_prova_id)===tp.id)).map(tp=>(
                    <div key={tp.id} className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{backgroundColor:tp.cor}}/>
                      <span className="text-xs text-slate-500">{tp.sigla||tp.nome}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── VISTA SEMANA ── */}
          {calViewMode==="semana" && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <button onClick={navigatePrev} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><ChevronLeft className="w-5 h-5"/></button>
                <span className="font-bold text-slate-800 min-w-[240px] text-center text-sm">{calNavLabel}</span>
                <button onClick={navigateNext} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><ChevronRight className="w-5 h-5"/></button>
                <button onClick={()=>setCalViewDate(new Date())} className="ml-1 px-3 py-1 rounded-lg text-xs font-medium border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">Hoje</button>
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {weekDays.map((day, di) => {
                  const dateStr = day.toISOString().slice(0,10);
                  const isToday = dateStr===todayDateStr;
                  const dayEvts = eventosByDate[dateStr]||[];
                  return (
                    <div key={di} className={`rounded-xl border overflow-hidden ${isToday?"border-blue-400":"border-slate-200"}`}>
                      <div className={`px-2 py-2 text-center border-b ${isToday?"border-blue-200 bg-blue-50":"border-slate-100 bg-slate-50/60"}`}>
                        <p className="text-xs font-bold text-slate-400 uppercase">{DIAS_FULL[di]}</p>
                        <p className={`text-xl font-bold leading-none mt-0.5 ${isToday?"text-blue-600":"text-slate-800"}`}>{day.getDate()}</p>
                        <p className="text-xs text-slate-400">{MESES_SHORT[day.getMonth()]}</p>
                      </div>
                      <div className="p-1.5 space-y-1 min-h-[96px] bg-white">
                        {dayEvts.length===0 ? (
                          defaultProvasCal ? (
                            <button onClick={()=>openEvtForm(defaultProvasCal.id,defaultProvasCal,undefined,dateStr)}
                              className="w-full min-h-[72px] flex items-center justify-center text-slate-200 hover:text-blue-300 transition-colors">
                              <Plus className="w-5 h-5"/>
                            </button>
                          ) : <div className="min-h-[72px]"/>
                        ) : dayEvts.map(ev=>(
                          <div key={ev.id} className="rounded-lg px-2 py-1.5 relative group cursor-pointer"
                            onClick={()=>{const c=calendarios.find(cl=>cl.id===ev.calendario_id);if(c)openEvtForm(c.id,c,ev);}}
                            style={{backgroundColor:(ev.tipo_prova_cor||"#3B82F6")+"22",borderLeft:`3px solid ${ev.tipo_prova_cor||"#3B82F6"}`}}>
                            <p className="text-xs font-bold leading-tight text-slate-800 truncate">{ev.titulo}</p>
                            {ev.turma_nome && <p className="text-xs text-slate-400 leading-tight">{ev.turma_nome}</p>}
                            {ev.data_inicio && <p className="text-xs text-slate-400">{new Date(ev.data_inicio).toLocaleTimeString("pt-AO",{hour:"2-digit",minute:"2-digit"})}</p>}
                            <button onClick={e=>{e.stopPropagation();deleteEvt(ev.calendario_id||0,ev.id);}} disabled={deletingEvt===ev.id}
                              className="absolute top-0.5 right-0.5 hidden group-hover:flex p-0.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 bg-white/80">
                              {deletingEvt===ev.id?<RefreshCw className="w-3 h-3 animate-spin"/>:<Trash2 className="w-3 h-3"/>}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── VISTA LISTA ── */}
          {calViewMode==="lista" && (
            <div className="space-y-4">
              {loadingCal ? (
                <div className="flex justify-center py-16"><RefreshCw className="w-6 h-6 animate-spin text-blue-500"/></div>
              ) : calendarios.length===0 ? (
                <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center">
                  <Calendar className="w-10 h-10 text-slate-200 mx-auto mb-3"/>
                  <p className="font-semibold text-slate-400">Nenhum calendário criado</p>
                  <p className="text-slate-300 text-sm mt-1">Crie um calendário de aulas ou de provas para começar</p>
                </div>
              ) : calendarios.map(cal => {
                const calEvts = (eventos[cal.id]||[]).filter(ev => {
                  if (filterTurma && String(ev.turma_id) !== filterTurma) return false;
                  if (filterTipo && String(ev.tipo_prova_id) !== filterTipo) return false;
                  return true;
                });
                return (
                  <div key={cal.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="flex items-start gap-3 p-4">
                      <div className={`mt-0.5 p-2 rounded-xl ${cal.tipo==="aulas"?"bg-blue-50":"bg-violet-50"}`}>
                        {cal.tipo==="aulas" ? <Clock className="w-5 h-5 text-blue-600"/> : <BookOpen className="w-5 h-5 text-violet-600"/>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900">{cal.nome}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_CLS[cal.status]||STATUS_CLS.historico}`}>{STATUS_PT[cal.status]||cal.status}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{cal.tipo==="aulas"?"Horário de Aulas":"Calendário de Provas"}</span>
                          {cal.publicado && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">Publicado</span>}
                        </div>
                        <div className="flex items-center gap-4 mt-1 flex-wrap">
                          <span className="text-xs text-slate-400 flex items-center gap-1"><CalendarDays className="w-3 h-3"/> {fmtDate(cal.vigencia_inicio)} → {fmtDate(cal.vigencia_fim)}</span>
                          <span className="text-xs text-slate-400 flex items-center gap-1"><Bell className="w-3 h-3"/> Alertas {cal.alertas_horas}h antes</span>
                          <span className="text-xs text-slate-400">{cal.total_eventos} evento{cal.total_eventos!==1?"s":""}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={()=>togglePublicar(cal.id)} disabled={togglingPub===cal.id}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${cal.publicado?"bg-amber-50 text-amber-700 hover:bg-amber-100":"bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}>
                          {togglingPub===cal.id?<RefreshCw className="w-3 h-3 animate-spin inline"/>:(cal.publicado?"Despublicar":"Publicar")}
                        </button>
                        <button onClick={()=>{ setEditCal(cal); setCalForm({nome:cal.nome,tipo:cal.tipo,descricao:cal.descricao||"",vigencia_inicio:cal.vigencia_inicio?.slice(0,10)||"",vigencia_fim:cal.vigencia_fim?.slice(0,10)||"",alertas_horas:String(cal.alertas_horas||48),gerar_notificacoes:cal.gerar_notificacoes!==false}); setShowCalForm(true); }}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><Pencil className="w-3.5 h-3.5"/></button>
                        <button onClick={()=>deleteCal(cal.id)} disabled={deletingCal===cal.id}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500">
                          {deletingCal===cal.id?<RefreshCw className="w-3.5 h-3.5 animate-spin"/>:<Trash2 className="w-3.5 h-3.5"/>}
                        </button>
                        <button onClick={()=>toggleExpandCal(cal.id)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                          {expandedCals.has(cal.id)?<ChevronUp className="w-4 h-4"/>:<ChevronDown className="w-4 h-4"/>}
                        </button>
                      </div>
                    </div>

                    {expandedCals.has(cal.id) && (
                      <div className="border-t border-slate-100 bg-slate-50/60 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-semibold text-slate-700">Eventos</span>
                          <button onClick={()=>openEvtForm(cal.id, cal)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700">
                            <Plus className="w-3.5 h-3.5"/> Novo Evento
                          </button>
                        </div>
                        {loadingEvt===cal.id ? (
                          <div className="flex justify-center py-8"><RefreshCw className="w-5 h-5 animate-spin text-blue-500"/></div>
                        ) : calEvts.length===0 ? (
                          <div className="text-center py-8 text-slate-400">
                            <Calendar className="w-8 h-8 text-slate-200 mx-auto mb-2"/>
                            <p className="text-sm">{(filterTurma||filterTipo)?"Nenhum evento corresponde aos filtros.":"Sem eventos. Clique em \"Novo Evento\" para adicionar."}</p>
                          </div>
                        ) : cal.tipo==="aulas" ? (
                          (() => {
                            const DIAS_TBL = ["Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
                            const activeDays = [0,1,2,3,4,5].filter(d => calEvts.some((e:any) => Number(e.dia_semana)===d));
                            const slots = [...new Set(calEvts.filter((e:any)=>e.hora_inicio_aula).map((e:any)=>e.hora_inicio_aula.slice(0,5)))].sort() as string[];
                            const grid: Record<string,Record<number,any[]>> = {};
                            calEvts.forEach((ev:any) => {
                              const s = ev.hora_inicio_aula?.slice(0,5); const d = Number(ev.dia_semana);
                              if (!s) return;
                              if (!grid[s]) grid[s]={};
                              if (!grid[s][d]) grid[s][d]=[];
                              grid[s][d].push(ev);
                            });
                            return (
                              <div className="overflow-x-auto rounded-xl border border-slate-200">
                                <table className="w-full text-sm min-w-[520px] border-collapse">
                                  <thead>
                                    <tr className="bg-slate-700 text-white">
                                      <th className="px-3 py-2.5 text-xs font-semibold text-left border-r border-slate-600 w-24">Horário</th>
                                      {activeDays.length===0
                                        ? <th className="px-3 py-2.5 text-xs font-semibold text-center">—</th>
                                        : activeDays.map(d=>(
                                          <th key={d} className="px-3 py-2.5 text-xs font-semibold text-center border-r border-slate-600 last:border-r-0">{DIAS_TBL[d]}</th>
                                        ))
                                      }
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {slots.length===0 ? (
                                      <tr><td colSpan={activeDays.length+1} className="px-4 py-10 text-center text-slate-400 text-sm bg-white">Sem eventos. Clique em "Novo Evento" para adicionar.</td></tr>
                                    ) : slots.map((slot,si) => {
                                      const fim = (calEvts.find((e:any)=>e.hora_inicio_aula?.slice(0,5)===slot) as any)?.hora_fim_aula?.slice(0,5);
                                      return (
                                        <tr key={slot} className={si%2===0?"bg-white":"bg-slate-50/60"}>
                                          <td className="px-3 py-2 border-r border-b border-slate-100 align-middle">
                                            <span className="block text-xs font-bold text-slate-700">{slot}</span>
                                            {fim && <span className="block text-xs text-slate-400">{fim}</span>}
                                          </td>
                                          {activeDays.map(d => {
                                            const cell = (grid[slot]||{})[d]||[];
                                            return (
                                              <td key={d} className="px-1.5 py-1.5 border-r border-b border-slate-100 last:border-r-0 align-middle min-w-[110px]">
                                                {cell.length===0 ? (
                                                  <span className="text-slate-200 text-xs flex justify-center">—</span>
                                                ) : cell.map((ev:any)=>(
                                                  <div key={ev.id} className="rounded-lg px-2 py-1.5 mb-1 last:mb-0 relative group"
                                                    style={{backgroundColor:(ev.tipo_prova_cor||"#3B82F6")+"18",borderLeft:`3px solid ${ev.tipo_prova_cor||"#3B82F6"}`}}>
                                                    <p className="text-xs font-bold text-slate-800 leading-tight">{ev.titulo}</p>
                                                    {ev.professor && <p className="text-xs text-slate-500 leading-tight mt-0.5">{ev.professor}</p>}
                                                    {ev.sala && <p className="text-xs text-slate-400 leading-tight">Sala {ev.sala}</p>}
                                                    {ev.turma_nome && <p className="text-xs text-slate-400 leading-tight">{ev.turma_nome}</p>}
                                                    <div className="absolute top-0.5 right-0.5 hidden group-hover:flex gap-0.5 bg-white/80 rounded p-0.5">
                                                      <button onClick={()=>openEvtForm(cal.id,cal,ev)} className="p-0.5 rounded hover:bg-slate-100 text-slate-400"><Pencil className="w-3 h-3"/></button>
                                                      <button onClick={()=>deleteEvt(cal.id,ev.id)} disabled={deletingEvt===ev.id} className="p-0.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500">
                                                        {deletingEvt===ev.id?<RefreshCw className="w-3 h-3 animate-spin"/>:<Trash2 className="w-3 h-3"/>}
                                                      </button>
                                                    </div>
                                                  </div>
                                                ))}
                                              </td>
                                            );
                                          })}
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            );
                          })()
                        ) : (
                          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Data</th>
                                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Disciplina / Título</th>
                                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo</th>
                                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Professor</th>
                                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Sala</th>
                                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Turma</th>
                                  <th className="px-4 py-2.5"/>
                                </tr>
                              </thead>
                              <tbody>
                                {[...calEvts].sort((a,b)=>(a.data_inicio||"").localeCompare(b.data_inicio||"")).map(ev => {
                                  const d = ev.data_inicio ? new Date(ev.data_inicio) : null;
                                  return (
                                    <tr key={ev.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                                      <td className="px-4 py-3 whitespace-nowrap">
                                        {d ? (
                                          <div className="flex flex-col">
                                            <span className="font-bold text-slate-900 text-base leading-none">{String(d.getDate()).padStart(2,"0")}</span>
                                            <span className="text-xs text-slate-400">{MESES_SHORT[d.getMonth()]} {d.getFullYear()}</span>
                                            <span className="text-xs text-slate-400 mt-0.5">{d.toLocaleTimeString("pt-AO",{hour:"2-digit",minute:"2-digit"})}</span>
                                          </div>
                                        ) : "—"}
                                      </td>
                                      <td className="px-4 py-3"><span className="font-semibold text-slate-900">{ev.titulo}</span></td>
                                      <td className="px-4 py-3">
                                        {ev.tipo_prova_nome ? (
                                          <span className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap" style={{backgroundColor:(ev.tipo_prova_cor||"#3B82F6")+"20",color:ev.tipo_prova_cor||"#3B82F6"}}>
                                            {ev.tipo_prova_nome}
                                          </span>
                                        ) : "—"}
                                      </td>
                                      <td className="px-4 py-3 text-slate-500">{ev.professor||"—"}</td>
                                      <td className="px-4 py-3 text-slate-500">{ev.sala||"—"}</td>
                                      <td className="px-4 py-3 text-slate-500">{ev.turma_nome||"—"}</td>
                                      <td className="px-4 py-3">
                                        <div className="flex items-center gap-1 justify-end">
                                          <button onClick={()=>openEvtForm(cal.id,cal,ev)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><Pencil className="w-3.5 h-3.5"/></button>
                                          <button onClick={()=>deleteEvt(cal.id,ev.id)} disabled={deletingEvt===ev.id} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500">
                                            {deletingEvt===ev.id?<RefreshCw className="w-3.5 h-3.5 animate-spin"/>:<Trash2 className="w-3.5 h-3.5"/>}
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: TIPOS DE PROVA ─── */}
      {cTab==="tipos" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-500">Categorize as avaliações e defina o peso de cada tipo</p>
            <button onClick={()=>{ setShowTipoForm(true); setEditTipo(null); setTipoForm({nome:"",sigla:"",cor:"#3B82F6",peso:1,descricao:""}); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 shadow-sm">
              <Plus className="w-4 h-4"/> Novo Tipo
            </button>
          </div>
          {loadingTipos ? (
            <div className="flex justify-center py-16"><RefreshCw className="w-6 h-6 animate-spin text-blue-500"/></div>
          ) : tipos.length===0 ? (
            <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center">
              <BookOpen className="w-10 h-10 text-slate-200 mx-auto mb-3"/>
              <p className="font-semibold text-slate-400">Nenhum tipo de prova definido</p>
              <p className="text-slate-300 text-sm mt-1">Ex: Prova Trimestral, Exame Nacional, Trabalho de Campo</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {tipos.map(tp => (
                <div key={tp.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center" style={{backgroundColor:tp.cor+"22"}}>
                    <div className="w-4 h-4 rounded-full" style={{backgroundColor:tp.cor}}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900 text-sm">{tp.nome}</p>
                      {tp.sigla && <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono font-bold">{tp.sigla}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      {tp.peso>=1 && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${PESO_COLORS[Math.min(tp.peso||1,5)]}`}>
                          {PESO_LABELS[Math.min(tp.peso||1,5)]}
                        </span>
                      )}
                    </div>
                    {tp.descricao && <p className="text-xs text-slate-400 mt-1 line-clamp-1">{tp.descricao}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={()=>{ setEditTipo(tp); setTipoForm({nome:tp.nome,sigla:tp.sigla||"",cor:tp.cor||"#3B82F6",peso:tp.peso||1,descricao:tp.descricao||""}); setShowTipoForm(true); }}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><Pencil className="w-3.5 h-3.5"/></button>
                    <button onClick={()=>deleteTipo(tp.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5"/></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: MÓDULO INFANTIL ─── */}
      {cTab === "infantil" && moduloInfantil && (
        <InfantilView token={token} embedded/>
      )}

      {/* MODAL: Calendário */}
      <AnimatePresence>
      {showCalForm && (
        <motion.div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
          <motion.div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh]" initial={{scale:0.95,y:20}} animate={{scale:1,y:0}}>
            <div className="flex items-center justify-between p-4 border-b border-slate-100 shrink-0">
              <h3 className="font-bold text-slate-900">{editCal?"Editar Calendário":"Novo Calendário"}</h3>
              <button onClick={()=>setShowCalForm(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4"/></button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Nome *</label>
                <input value={calForm.nome} onChange={e=>setCalForm(p=>({...p,nome:e.target.value}))} placeholder="Ex: Época de Exames 1º Trimestre"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Tipo</label>
                <select value={calForm.tipo} onChange={e=>setCalForm(p=>({...p,tipo:e.target.value}))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="provas">Calendário de Provas</option>
                  <option value="aulas">Horário de Aulas</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Início de Vigência *</label>
                  <input type="date" value={calForm.vigencia_inicio} onChange={e=>setCalForm(p=>({...p,vigencia_inicio:e.target.value}))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Fim de Vigência *</label>
                  <input type="date" value={calForm.vigencia_fim} onChange={e=>setCalForm(p=>({...p,vigencia_fim:e.target.value}))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Antecedência dos Alertas</label>
                <div className="flex gap-2">
                  {["24","48","72"].map(h=>(
                    <button key={h} onClick={()=>setCalForm(p=>({...p,alertas_horas:h}))}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${calForm.alertas_horas===h?"bg-blue-600 text-white border-blue-600":"border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{h}h</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Notificações</label>
                <button type="button" onClick={()=>setCalForm(p=>({...p,gerar_notificacoes:!p.gerar_notificacoes}))}
                  className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border transition-colors ${calForm.gerar_notificacoes?"border-blue-200 bg-blue-50":"border-slate-200 bg-slate-50"}`}>
                  <div className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${calForm.gerar_notificacoes?"bg-blue-600":"bg-slate-300"}`}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${calForm.gerar_notificacoes?"left-5":"left-0.5"}`}/>
                  </div>
                  <div className="text-left">
                    <p className={`text-sm font-medium ${calForm.gerar_notificacoes?"text-blue-700":"text-slate-500"}`}>{calForm.gerar_notificacoes?"Notificações activas":"Notificações desactivadas"}</p>
                    <p className="text-xs text-slate-400">Enviar alertas automáticos aos encarregados sobre eventos deste calendário</p>
                  </div>
                </button>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Descrição</label>
                <textarea value={calForm.descricao} onChange={e=>setCalForm(p=>({...p,descricao:e.target.value}))} rows={2}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Descrição opcional..."/>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-slate-100 shrink-0">
              <button onClick={()=>setShowCalForm(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button onClick={saveCal} disabled={savingCal||!calForm.nome.trim()}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                {savingCal&&<RefreshCw className="w-3.5 h-3.5 animate-spin"/>} Guardar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* MODAL: Tipo de Prova */}
      <AnimatePresence>
      {showTipoForm && (
        <motion.div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
          <motion.div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" initial={{scale:0.95,y:20}} animate={{scale:1,y:0}}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">{editTipo?"Editar Tipo de Prova":"Novo Tipo de Prova"}</h3>
              <button onClick={()=>setShowTipoForm(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4"/></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Nome *</label>
                  <input value={tipoForm.nome} onChange={e=>setTipoForm(p=>({...p,nome:e.target.value}))} placeholder="Ex: Prova Trimestral"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Sigla</label>
                  <input value={tipoForm.sigla} onChange={e=>setTipoForm(p=>({...p,sigla:e.target.value}))} placeholder="Ex: P1, ATT, EX"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" maxLength={20}/>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Peso Académico</label>
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(p=>(
                    <button key={p} type="button" onClick={()=>setTipoForm(f=>({...f,peso:p}))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${tipoForm.peso===p?"shadow-sm":"border-slate-200 text-slate-400 hover:border-slate-300"}`}
                      style={tipoForm.peso===p?{backgroundColor:tipoForm.cor+"25",borderColor:tipoForm.cor,color:tipoForm.cor}:{}}>{p}</button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-1.5">{["","Peso leve — participação, trabalhos pequenos","Peso intermédio — testes, mini-provas","Peso standard — provas trimestrais","Peso alto — exames de época","Peso máximo — exames nacionais"][tipoForm.peso]}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Cor no Calendário</label>
                <div className="flex gap-2 flex-wrap items-center">
                  {COR_PRESETS.map(cor=>(
                    <button key={cor} type="button" onClick={()=>setTipoForm(p=>({...p,cor}))}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${tipoForm.cor===cor?"border-slate-900 scale-110":"border-transparent hover:scale-105"}`}
                      style={{backgroundColor:cor}}/>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Descrição</label>
                <input value={tipoForm.descricao} onChange={e=>setTipoForm(p=>({...p,descricao:e.target.value}))} placeholder="Descrição opcional..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-slate-100">
              <button onClick={()=>setShowTipoForm(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button onClick={saveTipo} disabled={savingTipo||!tipoForm.nome.trim()}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                {savingTipo&&<RefreshCw className="w-3.5 h-3.5 animate-spin"/>} Guardar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* MODAL: Evento / Agendar Avaliação */}
      <AnimatePresence>
      {showEvtForm!==null && (() => {
        const cal = calendarios.find(c=>c.id===showEvtForm)!;
        const isAulas = cal?.tipo==="aulas";
        const isProvas = cal?.tipo==="provas";
        return (
          <motion.div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
            <motion.div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" initial={{scale:0.95,y:20}} animate={{scale:1,y:0}}>
              <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
                <h3 className="font-bold text-slate-900">{editEvt?"Editar Evento":isProvas?"Agendar Avaliação":"Novo Evento de Aula"}</h3>
                <button onClick={()=>{setShowEvtForm(null);setEditEvt(null);setEvtError(null);}} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4"/></button>
              </div>
              <div className="p-5 space-y-4">
                {evtError && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5"/>
                    <p className="text-xs text-red-700 font-medium">{evtError}</p>
                  </div>
                )}
                {/* Disciplina / Título */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">{isProvas?"Disciplina *":"Título *"}</label>
                  <input value={evtForm.titulo||""} onChange={e=>setEvtForm(p=>({...p,titulo:e.target.value}))}
                    placeholder={isAulas?"Ex: Matemática":"Ex: Matemática — Prova do 1.º Trimestre"}
                    list={isProvas?"disciplinas-datalist":undefined}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                  {isProvas && (
                    <datalist id="disciplinas-datalist">
                      {DISCIPLINAS.map(d=><option key={d} value={d}/>)}
                    </datalist>
                  )}
                </div>
                {/* Tipo de Prova */}
                {!isAulas && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Tipo de Prova</label>
                    <select value={evtForm.tipo_prova_id||""} onChange={e=>setEvtForm(p=>({...p,tipo_prova_id:e.target.value}))}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">— Nenhum —</option>
                      {tipos.map(tp=>(
                        <option key={tp.id} value={tp.id}>
                          {tp.sigla?`[${tp.sigla}] `:""}
                          {tp.nome}
                          {tp.peso?` · Peso ${tp.peso}`:""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {/* Turma(s) */}
                {isProvas && !editEvt ? (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Turma(s)</label>
                    {turmas.length===0 ? (
                      <p className="text-xs text-slate-400">Nenhuma turma disponível</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto">
                        {turmas.map(t=>{
                          const selected = (evtForm.turma_ids||[]).includes(String(t.id));
                          return (
                            <button key={t.id} type="button"
                              onClick={()=>setEvtForm(p=>{
                                const cur: string[] = p.turma_ids||[];
                                return {...p, turma_ids: selected ? cur.filter((x:string)=>x!==String(t.id)) : [...cur,String(t.id)]};
                              })}
                              className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border-2 text-xs font-medium transition-all text-left ${selected?"bg-blue-50 border-blue-500 text-blue-700":"border-slate-200 text-slate-500 hover:border-blue-300"}`}>
                              <div className={`w-3.5 h-3.5 rounded border-2 shrink-0 flex items-center justify-center ${selected?"bg-blue-500 border-blue-500":"border-slate-300"}`}>
                                {selected && <span className="text-white" style={{fontSize:"9px",lineHeight:1}}>✓</span>}
                              </div>
                              <span className="truncate">{t.nome}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {(evtForm.turma_ids||[]).length===0 && (
                      <p className="text-xs text-slate-400 mt-1">Sem turma — o evento ficará geral para toda a escola</p>
                    )}
                    {(evtForm.turma_ids||[]).length>1 && (
                      <p className="text-xs text-blue-500 mt-1">Serão criados {(evtForm.turma_ids||[]).length} eventos separados (um por turma)</p>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Turma</label>
                    <select value={evtForm.turma_id||""} onChange={e=>setEvtForm(p=>({...p,turma_id:e.target.value}))}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">— Todas as turmas —</option>
                      {turmas.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}
                    </select>
                  </div>
                )}
                {/* Professor + Sala */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Professor</label>
                    <input value={evtForm.professor||""} onChange={e=>setEvtForm(p=>({...p,professor:e.target.value}))} placeholder="Nome do professor"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Sala</label>
                    <input value={evtForm.sala||""} onChange={e=>setEvtForm(p=>({...p,sala:e.target.value}))} placeholder="Ex: A201"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                  </div>
                </div>
                {/* Date/time */}
                {isAulas ? (
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Dias da Semana</label>
                        <div className="flex gap-1">
                          <button type="button" onClick={()=>setEvtForm(p=>({...p,dias_semana:[0,1,2,3,4]}))} className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 hover:bg-slate-200">Seg–Sex</button>
                          <button type="button" onClick={()=>setEvtForm(p=>({...p,dias_semana:[0,1,2,3,4,5]}))} className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 hover:bg-slate-200">Todos</button>
                          <button type="button" onClick={()=>setEvtForm(p=>({...p,dias_semana:[]}))} className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 hover:bg-slate-200">Limpar</button>
                        </div>
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        {[["Seg",0],["Ter",1],["Qua",2],["Qui",3],["Sex",4],["Sáb",5]].map(([label,i]) => {
                          const sel = (evtForm.dias_semana||[]).includes(i);
                          return (
                            <button key={i} type="button"
                              onClick={()=>setEvtForm(p=>{
                                const cur: number[] = p.dias_semana||[];
                                return {...p, dias_semana: sel ? cur.filter((x:number)=>x!==i) : [...cur,i as number].sort()};
                              })}
                              className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all ${sel?"bg-blue-600 text-white border-blue-600 shadow-sm":"border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600 bg-white"}`}>
                              {label}
                            </button>
                          );
                        })}
                      </div>
                      {(evtForm.dias_semana||[]).length===0 && <p className="text-xs text-amber-600 mt-1">Seleccione pelo menos um dia</p>}
                      {!editEvt&&(evtForm.dias_semana||[]).length>1&&<p className="text-xs text-blue-500 mt-1">Serão criados {(evtForm.dias_semana||[]).length} eventos (um por dia)</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Hora de Início</label>
                        <input type="time" value={evtForm.hora_inicio_aula||"08:00"} onChange={e=>setEvtForm(p=>({...p,hora_inicio_aula:e.target.value}))}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Hora de Fim</label>
                        <input type="time" value={evtForm.hora_fim_aula||"09:00"} onChange={e=>setEvtForm(p=>({...p,hora_fim_aula:e.target.value}))}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Data e Hora de Início</label>
                      <input type="datetime-local" value={evtForm.data_inicio||""} onChange={e=>setEvtForm(p=>({...p,data_inicio:e.target.value}))}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Data e Hora de Fim</label>
                      <input type="datetime-local" value={evtForm.data_fim||""} onChange={e=>setEvtForm(p=>({...p,data_fim:e.target.value}))}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                    </div>
                  </div>
                )}
                {/* Notes */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Notas / Instruções Adicionais</label>
                  <textarea value={evtForm.descricao||""} onChange={e=>setEvtForm(p=>({...p,descricao:e.target.value}))} rows={2}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Ex: Trazer calculadora científica, material de desenho geométrico..."/>
                </div>
              </div>
              <div className="flex justify-end gap-2 p-5 border-t border-slate-100 sticky bottom-0 bg-white">
                <button onClick={()=>{setShowEvtForm(null);setEditEvt(null);setEvtError(null);}} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancelar</button>
                <button onClick={()=>saveEvt(showEvtForm!)} disabled={savingEvt||!evtForm.titulo?.trim()}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                  {savingEvt&&<RefreshCw className="w-3.5 h-3.5 animate-spin"/>}
                  {isProvas?"Agendar":"Guardar Evento"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        );
      })()}
      </AnimatePresence>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════════
   InfantilView — Módulo de Gestão Infantil (Creche / Centro Infantil)
══════════════════════════════════════════════════════════════════ */
const DIAS_SEM = ["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"];
const DIAS_UTEIS_INF = [1,2,3,4,5];
const REFEICOES_INF = [
  { key: "pequeno_almoco", label: "Pequeno-almoço", emoji: "☕" },
  { key: "almoco",         label: "Almoço",         emoji: "🍽️" },
  { key: "lanche",         label: "Lanche",          emoji: "🥪" },
];
const COR_OPTS = ["#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899","#06B6D4","#84CC16"];

function getMondayStr(d: Date) {
  const dt = new Date(d);
  const diff = dt.getDate() - dt.getDay() + (dt.getDay() === 0 ? -6 : 1);
  dt.setDate(diff);
  return dt.toISOString().slice(0, 10);
}

function InfantilView({ token, embedded }: { token: string; embedded?: boolean }) {
  const apiH = useCallback((ct = true) => {
    const h: Record<string,string> = { Authorization: `Bearer ${token}` };
    if (ct) h["Content-Type"] = "application/json";
    return h;
  }, [token]);

  const [sub, setSub] = useState<"rotinas"|"ementas"|"galeria">("rotinas");

  /* ── Rotinas state ── */
  const [rotinas, setRotinas]     = useState<any[]>([]);
  const [rTurmas, setRTurmas]     = useState<any[]>([]);
  const [loadRot, setLoadRot]     = useState(true);
  const [filTurma, setFilTurma]   = useState("");
  const [showRF, setShowRF]       = useState(false);
  const [editRot, setEditRot]     = useState<any>(null);
  const [rf, setRf] = useState({ turma_id:"", dia_semana:1, hora_inicio:"08:00", hora_fim:"09:00", atividade:"", descricao:"", cor:"#3B82F6" });
  const [rView, setRView]         = useState<"grelha"|"lista">("grelha");

  /* ── Ementas state ── */
  const [ementas, setEmentas]       = useState<any[]>([]);
  const [loadEm, setLoadEm]         = useState(false);
  const [semana, setSemana]         = useState(() => getMondayStr(new Date()));
  const [emModal, setEmModal]       = useState<{ dia_semana: number; refeicao: string } | null>(null);
  const [emForm, setEmForm]         = useState({ descricao:"", alergenios:"" });
  const [savingEm, setSavingEm]     = useState(false);

  /* ── Galeria state ── */
  const [galeria, setGaleria]       = useState<any[]>([]);
  const [loadGal, setLoadGal]       = useState(false);
  const [filGalTurma, setFilGalTurma] = useState("");
  const [uploading, setUploading]   = useState(false);
  const fileRef                     = useRef<HTMLInputElement>(null);
  const [galForm, setGalForm]       = useState({ turma_id:"", titulo:"" });
  const [lightbox, setLightbox]     = useState<any>(null);

  /* turmas */
  useEffect(() => {
    fetch(`${API}/school/infant/turmas`, { headers: apiH() })
      .then(r => r.ok ? r.json() : []).then(setRTurmas).catch(() => {});
  }, [token]);

  /* load rotinas */
  const loadRotinas = useCallback(() => {
    setLoadRot(true);
    const url = filTurma ? `${API}/school/infant/rotinas?turma_id=${filTurma}` : `${API}/school/infant/rotinas`;
    fetch(url, { headers: apiH() }).then(r => r.ok ? r.json() : []).then(setRotinas).finally(() => setLoadRot(false));
  }, [token, filTurma]);
  useEffect(() => { if (sub === "rotinas") loadRotinas(); }, [sub, loadRotinas]);

  /* load ementas */
  const loadEmentas = useCallback(() => {
    setLoadEm(true);
    fetch(`${API}/school/infant/ementas?semana=${semana}`, { headers: apiH() }).then(r => r.ok ? r.json() : []).then(setEmentas).finally(() => setLoadEm(false));
  }, [token, semana]);
  useEffect(() => { if (sub === "ementas") loadEmentas(); }, [sub, loadEmentas]);

  /* load galeria */
  const loadGaleria = useCallback(() => {
    setLoadGal(true);
    const url = filGalTurma ? `${API}/school/infant/galeria?turma_id=${filGalTurma}` : `${API}/school/infant/galeria`;
    fetch(url, { headers: apiH() }).then(r => r.ok ? r.json() : []).then(setGaleria).finally(() => setLoadGal(false));
  }, [token, filGalTurma]);
  useEffect(() => { if (sub === "galeria") loadGaleria(); }, [sub, loadGaleria]);

  /* rotinas CRUD */
  const saveRotina = async () => {
    const method = editRot ? "PUT" : "POST";
    const url = editRot ? `${API}/school/infant/rotinas/${editRot.id}` : `${API}/school/infant/rotinas`;
    const r = await fetch(url, { method, headers: apiH(), body: JSON.stringify({ ...rf, turma_id: rf.turma_id || null }) });
    if (r.ok) { loadRotinas(); setShowRF(false); setEditRot(null); setRf({ turma_id:"", dia_semana:1, hora_inicio:"08:00", hora_fim:"09:00", atividade:"", descricao:"", cor:"#3B82F6" }); }
  };
  const delRotina = async (id: number) => {
    await fetch(`${API}/school/infant/rotinas/${id}`, { method:"DELETE", headers: apiH(false) });
    setRotinas(p => p.filter(x => x.id !== id));
  };

  /* ementas CRUD */
  const saveEmenta = async () => {
    setSavingEm(true);
    const r = await fetch(`${API}/school/infant/ementas`, { method:"POST", headers: apiH(), body: JSON.stringify({ semana_inicio: semana, ...emModal, ...emForm }) });
    if (r.ok) { loadEmentas(); setEmModal(null); setEmForm({ descricao:"", alergenios:"" }); }
    setSavingEm(false);
  };
  const delEmenta = async (id: number) => {
    await fetch(`${API}/school/infant/ementas/${id}`, { method:"DELETE", headers: apiH(false) });
    setEmentas(p => p.filter(x => x.id !== id));
  };

  /* galeria upload */
  const handleUpload = async (file: File) => {
    if (!galForm.turma_id) { alert("Selecione uma sala/turma."); return; }
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("turma_id", galForm.turma_id);
    if (galForm.titulo) fd.append("titulo", galForm.titulo);
    const r = await fetch(`${API}/school/infant/galeria`, { method:"POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
    if (r.ok) { loadGaleria(); setGalForm(f => ({ ...f, titulo:"" })); }
    setUploading(false);
  };
  const delGaleria = async (id: number) => {
    await fetch(`${API}/school/infant/galeria/${id}`, { method:"DELETE", headers: apiH(false) });
    setGaleria(p => p.filter(x => x.id !== id));
  };

  const ementaMap = useMemo(() => {
    const m: Record<string, any> = {};
    for (const e of ementas) m[`${e.dia_semana}-${e.refeicao}`] = e;
    return m;
  }, [ementas]);

  const shiftWeek = (n: number) => {
    const d = new Date(semana + "T00:00:00");
    d.setDate(d.getDate() + n * 7);
    setSemana(getMondayStr(d));
  };

  const SUBTABS = [
    { key:"rotinas"  as const, label:"Rotinas Diárias",      icon:<Clock className="w-4 h-4"/> },
    { key:"ementas"  as const, label:"Ementas Alimentares",   icon:<UtensilsCrossed className="w-4 h-4"/> },
    { key:"galeria"  as const, label:"Galeria Multimédia",    icon:<ImageIcon className="w-4 h-4"/> },
  ];
  const inp = "w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20";

  const Outer: React.ElementType = embedded ? "div" : (motion.div as React.ElementType);
  const outerProps: Record<string, any> = embedded
    ? { className: "space-y-5" }
    : { key: "modulo_infantil", initial:{opacity:0,x:16}, animate:{opacity:1,x:0}, exit:{opacity:0}, className:"flex-1 p-4 md:p-6 space-y-5" };

  return (
    <Outer {...outerProps}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
          <Baby className="w-5 h-5 text-emerald-600"/>
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">Módulo Infantil</h2>
          <p className="text-xs text-slate-500">Rotinas, ementas alimentares e galeria multimédia</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 max-w-xl">
        {SUBTABS.map(t => (
          <button key={t.key} onClick={() => setSub(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${sub===t.key?"bg-white text-slate-800 shadow-sm":"text-slate-500 hover:text-slate-700"}`}>
            {t.icon}<span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ────── ROTINAS ────── */}
      {sub === "rotinas" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500 shrink-0">Sala:</label>
                <select value={filTurma} onChange={e => setFilTurma(e.target.value)}
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                  <option value="">Todas</option>
                  {rTurmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </div>
              <div className="flex gap-0.5 bg-slate-100 p-0.5 rounded-lg">
                <button onClick={() => setRView("grelha")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${rView==="grelha"?"bg-white text-slate-800 shadow-sm":"text-slate-400 hover:text-slate-600"}`}>
                  <LayoutGrid className="w-3.5 h-3.5"/> Grelha
                </button>
                <button onClick={() => setRView("lista")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${rView==="lista"?"bg-white text-slate-800 shadow-sm":"text-slate-400 hover:text-slate-600"}`}>
                  <List className="w-3.5 h-3.5"/> Lista
                </button>
              </div>
            </div>
            <button onClick={() => { setEditRot(null); setShowRF(true); setRf({ turma_id:"", dia_semana:1, hora_inicio:"08:00", hora_fim:"09:00", atividade:"", descricao:"", cor:"#3B82F6" }); }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4"/> Nova Rotina
            </button>
          </div>

          {loadRot ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="w-5 h-5 animate-spin text-primary"/></div>
          ) : rotinas.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
              <Clock className="w-10 h-10 text-slate-200 mx-auto mb-3"/>
              <p className="font-semibold text-slate-400">Nenhuma rotina definida</p>
              <p className="text-xs text-slate-300 mt-1">Adicione as actividades diárias da sala.</p>
            </div>
          ) : rView === "grelha" ? (() => {
            const slots = [...new Set(rotinas.map(r => r.hora_inicio?.slice(0,5)))].sort() as string[];
            const DIAS_G = [1,2,3,4,5];
            const DIAS_G_LABELS = ["Segunda","Terça","Quarta","Quinta","Sexta"];
            const grid: Record<string, Record<number, any[]>> = {};
            for (const r of rotinas) {
              const slot = r.hora_inicio?.slice(0,5) as string;
              if (!grid[slot]) grid[slot] = {};
              if (!grid[slot][r.dia_semana]) grid[slot][r.dia_semana] = [];
              grid[slot][r.dia_semana].push(r);
            }
            return (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-28 border-r border-slate-200">Horário</th>
                      {DIAS_G_LABELS.map((d, i) => (
                        <th key={i} className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wide border-r border-slate-200 last:border-r-0">{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {slots.map((slot, si) => {
                      const endTime = (() => {
                        const allWithSlot = rotinas.filter(r => r.hora_inicio?.slice(0,5) === slot);
                        return allWithSlot[0]?.hora_fim?.slice(0,5) ?? "";
                      })();
                      return (
                        <tr key={slot} className={si % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                          <td className="px-4 py-2.5 border-r border-b border-slate-100 align-middle w-28">
                            <span className="block text-xs font-bold text-slate-700">{slot}</span>
                            {endTime && <span className="block text-xs text-slate-400">{endTime}</span>}
                          </td>
                          {DIAS_G.map(dia => {
                            const cells = (grid[slot]||{})[dia] || [];
                            return (
                              <td key={dia} className="px-2 py-2 border-r border-b border-slate-100 last:border-r-0 align-top min-w-[120px]">
                                {cells.length === 0 ? (
                                  <span className="text-slate-200 text-xs flex justify-center pt-1">—</span>
                                ) : cells.map(r => (
                                  <div key={r.id} className="rounded-lg px-2.5 py-2 mb-1 last:mb-0 relative group cursor-pointer"
                                    style={{ backgroundColor: (r.cor||"#3B82F6")+"20", borderLeft: `3px solid ${r.cor||"#3B82F6"}` }}>
                                    <p className="text-xs font-semibold text-slate-800 leading-snug">{r.atividade}</p>
                                    {r.turma_nome && <p className="text-xs text-emerald-600 mt-0.5 leading-none">{r.turma_nome}</p>}
                                    <div className="absolute top-1 right-1 hidden group-hover:flex gap-0.5 bg-white/90 rounded p-0.5 shadow-sm">
                                      <button onClick={() => { setEditRot(r); setRf({ turma_id:r.turma_id?.toString()||"", dia_semana:r.dia_semana, hora_inicio:r.hora_inicio?.slice(0,5)||"08:00", hora_fim:r.hora_fim?.slice(0,5)||"09:00", atividade:r.atividade, descricao:r.descricao||"", cor:r.cor||"#3B82F6" }); setShowRF(true); }}
                                        className="p-0.5 rounded hover:bg-slate-100 text-slate-400"><Pencil className="w-3 h-3"/></button>
                                      <button onClick={() => delRotina(r.id)}
                                        className="p-0.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 className="w-3 h-3"/></button>
                                    </div>
                                  </div>
                                ))}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })() : (
            <div className="grid gap-3">
              {[0,1,2,3,4,5,6].map(dia => {
                const dias = rotinas.filter(r => r.dia_semana === dia);
                if (!dias.length) return null;
                return (
                  <div key={dia} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                      <p className="text-sm font-semibold text-slate-700">{DIAS_SEM[dia]}</p>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {dias.map(r => (
                        <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.cor || "#3B82F6" }}/>
                          <div className="text-xs text-slate-400 font-mono shrink-0 w-24">{r.hora_inicio?.slice(0,5)}–{r.hora_fim?.slice(0,5)}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{r.atividade}</p>
                            {r.descricao && <p className="text-xs text-slate-400 truncate">{r.descricao}</p>}
                            {r.turma_nome && <p className="text-xs text-emerald-600 font-medium mt-0.5">{r.turma_nome}</p>}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => { setEditRot(r); setRf({ turma_id: r.turma_id?.toString()||"", dia_semana:r.dia_semana, hora_inicio:r.hora_inicio?.slice(0,5)||"08:00", hora_fim:r.hora_fim?.slice(0,5)||"09:00", atividade:r.atividade, descricao:r.descricao||"", cor:r.cor||"#3B82F6" }); setShowRF(true); }}
                              className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"><Pencil className="w-3.5 h-3.5"/></button>
                            <button onClick={() => delRotina(r.id)}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Rotina Form Modal */}
          <AnimatePresence>
            {showRF && (
              <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.95,opacity:0}} className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                  <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <h3 className="font-bold text-slate-800">{editRot ? "Editar Rotina" : "Nova Rotina"}</h3>
                    <button onClick={() => { setShowRF(false); setEditRot(null); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4"/></button>
                  </div>
                  <div className="p-5 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Dia da semana</label>
                        <select value={rf.dia_semana} onChange={e => setRf(f => ({ ...f, dia_semana: Number(e.target.value) }))} className={inp}>
                          {DIAS_SEM.map((d,i) => <option key={i} value={i}>{d}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Sala/Turma</label>
                        <select value={rf.turma_id} onChange={e => setRf(f => ({ ...f, turma_id: e.target.value }))} className={inp}>
                          <option value="">Todas as salas</option>
                          {rTurmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Hora início</label>
                        <input type="time" value={rf.hora_inicio} onChange={e => setRf(f => ({ ...f, hora_inicio: e.target.value }))} className={inp}/>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Hora fim</label>
                        <input type="time" value={rf.hora_fim} onChange={e => setRf(f => ({ ...f, hora_fim: e.target.value }))} className={inp}/>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Actividade *</label>
                      <input type="text" placeholder="ex: Hora da Brincadeira" value={rf.atividade} onChange={e => setRf(f => ({ ...f, atividade: e.target.value }))} className={inp}/>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Descrição (opcional)</label>
                      <input type="text" placeholder="Detalhes adicionais..." value={rf.descricao} onChange={e => setRf(f => ({ ...f, descricao: e.target.value }))} className={inp}/>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">Cor da actividade</label>
                      <div className="flex gap-2 flex-wrap">
                        {COR_OPTS.map(c => (
                          <button key={c} onClick={() => setRf(f => ({ ...f, cor: c }))}
                            className={`w-7 h-7 rounded-full transition-transform ${rf.cor===c?"ring-2 ring-offset-2 ring-slate-400 scale-110":"hover:scale-105"}`}
                            style={{ backgroundColor: c }}/>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 p-5 border-t border-slate-100">
                    <button onClick={() => { setShowRF(false); setEditRot(null); }} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
                    <button onClick={saveRotina} disabled={!rf.atividade.trim()}
                      className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
                      {editRot ? "Guardar" : "Adicionar"}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ────── EMENTAS ────── */}
      {sub === "ementas" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <button onClick={() => shiftWeek(-1)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"><ChevronLeft className="w-4 h-4 text-slate-600"/></button>
            <p className="text-sm font-semibold text-slate-700 text-center">
              Semana de {new Date(semana + "T00:00:00").toLocaleDateString("pt-AO", { day:"numeric", month:"long", year:"numeric" })}
            </p>
            <button onClick={() => shiftWeek(1)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"><ChevronRight className="w-4 h-4 text-slate-600"/></button>
          </div>

          {loadEm ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="w-5 h-5 animate-spin text-primary"/></div>
          ) : (
            <div className="grid gap-3">
              {DIAS_UTEIS_INF.map(dia => (
                <div key={dia} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                  <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                    <p className="text-sm font-semibold text-slate-700">{DIAS_SEM[dia]}</p>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {REFEICOES_INF.map(ref => {
                      const entry = ementaMap[`${dia}-${ref.key}`];
                      return (
                        <div key={ref.key} className="flex items-center gap-3 px-4 py-3">
                          <span className="text-lg shrink-0">{ref.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-500 mb-0.5">{ref.label}</p>
                            {entry ? (
                              <>
                                <p className="text-sm text-slate-800">{entry.descricao}</p>
                                {entry.alergenios && <p className="text-xs text-amber-600 mt-0.5">⚠ Alergénios: {entry.alergenios}</p>}
                              </>
                            ) : (
                              <p className="text-sm text-slate-300 italic">Não definido</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => { setEmModal({ dia_semana:dia, refeicao:ref.key }); setEmForm({ descricao:entry?.descricao||"", alergenios:entry?.alergenios||"" }); }}
                              className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"><Pencil className="w-3.5 h-3.5"/></button>
                            {entry && (
                              <button onClick={() => delEmenta(entry.id)}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Ementa Modal */}
          <AnimatePresence>
            {emModal && (
              <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.95,opacity:0}} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
                  <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <h3 className="font-bold text-slate-800">
                      {DIAS_SEM[emModal.dia_semana]} — {REFEICOES_INF.find(r => r.key === emModal.refeicao)?.label}
                    </h3>
                    <button onClick={() => setEmModal(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4"/></button>
                  </div>
                  <div className="p-5 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Descrição da refeição *</label>
                      <textarea rows={3} placeholder="ex: Arroz de frango, feijão, salada..." value={emForm.descricao} onChange={e => setEmForm(f => ({ ...f, descricao: e.target.value }))}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"/>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Alergénios (opcional)</label>
                      <input type="text" placeholder="ex: Glúten, Lactose..." value={emForm.alergenios} onChange={e => setEmForm(f => ({ ...f, alergenios: e.target.value }))}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"/>
                    </div>
                  </div>
                  <div className="flex gap-2 p-5 border-t border-slate-100">
                    <button onClick={() => setEmModal(null)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
                    <button onClick={saveEmenta} disabled={!emForm.descricao.trim() || savingEm}
                      className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
                      {savingEm ? "A guardar..." : "Guardar"}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ────── GALERIA ────── */}
      {sub === "galeria" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <h3 className="font-semibold text-slate-800 mb-3 text-sm">Carregar ficheiro</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Sala/Turma *</label>
                <select value={galForm.turma_id} onChange={e => setGalForm(f => ({ ...f, turma_id: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                  <option value="">Selecionar sala</option>
                  {rTurmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Título (opcional)</label>
                <input type="text" placeholder="Título..." value={galForm.titulo} onChange={e => setGalForm(f => ({ ...f, titulo: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"/>
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*,video/mp4,video/quicktime,video/webm" className="hidden"
              onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); e.target.value = ""; }}/>
            <button onClick={() => fileRef.current?.click()} disabled={uploading || !galForm.turma_id}
              className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-500 hover:border-primary hover:text-primary disabled:opacity-50 transition-all w-full justify-center">
              {uploading ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Upload className="w-4 h-4"/>}
              {uploading ? "A carregar..." : "Selecionar imagem ou vídeo"}
            </button>
            <p className="text-xs text-slate-400 mt-2 text-center">Imagens JPG/PNG/WebP e vídeos MP4/MOV até 80MB</p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Filtrar sala:</label>
            <select value={filGalTurma} onChange={e => setFilGalTurma(e.target.value)}
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none">
              <option value="">Todas</option>
              {rTurmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>

          {loadGal ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="w-5 h-5 animate-spin text-primary"/></div>
          ) : galeria.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
              <ImageIcon className="w-10 h-10 text-slate-200 mx-auto mb-3"/>
              <p className="font-semibold text-slate-400">Galeria vazia</p>
              <p className="text-xs text-slate-300 mt-1">Carregue fotos e vídeos dos momentos especiais.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {galeria.map(g => (
                <div key={g.id} className="relative group rounded-xl overflow-hidden bg-slate-100 aspect-square">
                  {g.tipo === "video" ? (
                    <div className="w-full h-full flex items-center justify-center bg-slate-700 cursor-pointer" onClick={() => setLightbox(g)}>
                      <Film className="w-8 h-8 text-white/70"/>
                      <span className="absolute bottom-2 left-2 text-xs text-white/80 bg-black/40 px-1.5 py-0.5 rounded">Vídeo</span>
                    </div>
                  ) : (
                    <img src={`${API}/school/infant/media/${g.filename}`}
                      alt={g.titulo||""} className="w-full h-full object-cover cursor-pointer" onClick={() => setLightbox(g)}
                      onError={e => { (e.target as HTMLImageElement).style.display="none"; }}/>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex flex-col justify-between opacity-0 group-hover:opacity-100">
                    <div className="flex justify-end p-2">
                      <button onClick={() => delGaleria(g.id)}
                        className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
                        <Trash2 className="w-3 h-3"/>
                      </button>
                    </div>
                    <div className="p-2">
                      {g.titulo && <p className="text-white text-xs font-medium truncate">{g.titulo}</p>}
                      {g.turma_nome && <p className="text-white/70 text-xs truncate">{g.turma_nome}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Lightbox */}
          <AnimatePresence>
            {lightbox && (
              <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                onClick={() => setLightbox(null)}
                className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-pointer">
                <motion.div initial={{scale:0.9}} animate={{scale:1}} exit={{scale:0.9}} onClick={e => e.stopPropagation()} className="relative max-w-3xl w-full">
                  {lightbox.tipo === "video" ? (
                    <video src={`${API}/school/infant/media/${lightbox.filename}`}
                      controls className="w-full rounded-2xl max-h-[80vh]" autoPlay/>
                  ) : (
                    <img src={`${API}/school/infant/media/${lightbox.filename}`}
                      alt={lightbox.titulo||""} className="w-full rounded-2xl max-h-[80vh] object-contain"/>
                  )}
                  {lightbox.titulo && <p className="text-white text-center mt-3 font-medium">{lightbox.titulo}</p>}
                  <button onClick={() => setLightbox(null)} className="absolute top-3 right-3 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors">
                    <X className="w-4 h-4"/>
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </Outer>
  );
}

function PartilharPortalView({ token }: { token: string }) {
  const [info, setInfo] = useState<{ slug: string; name: string; logo_url: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`${API}/school/portal-info`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (!d.error) setInfo(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const portalUrl = info ? `${window.location.origin}/portal/${info.slug}` : "";
  const qrUrl = info
    ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&bgcolor=ffffff&color=1e3a5f&data=${encodeURIComponent(portalUrl)}`
    : "";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const whatsappText = info
    ? `Olá! Para acompanhar as rotinas, consultar o calendário escolar e gerir os pagamentos de forma 100% digital, aceda ao Portal Oficial da ${info.name}.\n\n🔗 Clique no link permanente para entrar: ${portalUrl}\n\nNota: O seu acesso está condicionado ao número de telemóvel registado no ato da matrícula.`
    : "";

  const handleDownloadQR = () => {
    const link = document.createElement("a");
    link.href = qrUrl;
    link.download = `qr-portal-${info?.slug ?? "escola"}.png`;
    link.click();
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <RefreshCw className="w-6 h-6 animate-spin text-indigo-500"/>
    </div>
  );

  return (
    <motion.div key="partilhar_portal" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
      className="flex-1 p-4 md:p-6 max-w-2xl mx-auto w-full">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900">Partilhar Portal de Acesso</h2>
        <p className="text-sm text-slate-500 mt-1">Link e QR Code permanentes para os encarregados acederem ao portal da instituição.</p>
      </div>

      {/* URL */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Link Permanente</p>
        <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-200">
          <Globe className="w-4 h-4 text-slate-400 flex-shrink-0"/>
          <span className="text-sm text-slate-700 flex-1 truncate font-mono">{portalUrl}</span>
          <button onClick={handleCopy}
            className="flex-shrink-0 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 flex items-center gap-1.5 transition-colors">
            {copied ? <><CheckCircle2 className="w-3.5 h-3.5"/> Copiado</> : <><Copy className="w-3.5 h-3.5"/> Copiar</>}
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <a href={`https://wa.me/?text=${encodeURIComponent(whatsappText)}`} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold text-sm rounded-xl py-3 transition-colors">
          <MessageCircle className="w-4 h-4"/> Partilhar via WhatsApp
        </a>
        <button onClick={handleDownloadQR}
          className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-sm rounded-xl py-3 transition-colors">
          <Download className="w-4 h-4"/> Descarregar QR Code
        </button>
      </div>

      {/* QR Code */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 flex flex-col items-center mb-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-5">QR Code Institucional</p>
        {info && <img src={qrUrl} alt="QR Code Portal" className="w-56 h-56 rounded-xl"/>}
        <p className="mt-4 text-xs text-slate-400 text-center">Imprima e coloque na secretaria para acesso imediato dos encarregados.</p>
        <div className="mt-3 bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-100 text-center">
          <p className="text-xs font-semibold text-slate-600">{info?.name}</p>
          <p className="text-xs text-slate-400 mt-0.5">Portal Oficial</p>
        </div>
      </div>

      {/* Message preview */}
      <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
        <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">Mensagem de Partilha (WhatsApp)</p>
        <p className="text-sm text-green-800 whitespace-pre-line leading-relaxed">{whatsappText}</p>
      </div>
    </motion.div>
  );
}

export default function Dashboard() {
  const { session, token, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [view, setView] = useState<DashView>("inicio");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [propinas, setPropinas] = useState<Propina[]>([]);
  const [pacotes, setPacotes] = useState<Pacote[]>([]);
  const [loading, setLoading] = useState(true);
  const [schoolModuloInfantil, setSchoolModuloInfantil] = useState(false);

  // Modals
  const [modal, setModal] = useState<"turma"|"aluno"|"propina"|"referencia"|"lote"|null>(null);

  const schoolName = session?.schoolName ?? "Colégio";
  const schoolId = session?.schoolId ?? "";
  const initials = schoolName.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
  const portalLabel = (session?.portalNomenclatura === "aluno") ? "Portal do Aluno" : "Portal do Encarregado";

  const headers: Record<string, string> = token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };

  const loadAll = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    try {
      const [tRes, aRes, pRes, pkRes] = await Promise.all([
        fetch(`${API}/school/turmas`, { headers }),
        fetch(`${API}/school/alunos`, { headers }),
        fetch(`${API}/school/propinas`, { headers }),
        fetch(`${API}/school/pacotes`, { headers }),
      ]);
      if (tRes.ok) setTurmas(await tRes.json());
      if (aRes.ok) setAlunos(await aRes.json());
      if (pRes.ok) setPropinas(await pRes.json());
      if (pkRes.ok) setPacotes(await pkRes.json());
    } catch {}
    setLoading(false);
  }, [token]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/school/infant/status`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : { modulo_infantil: false })
      .then((d: { modulo_infantil: boolean }) => setSchoolModuloInfantil(!!d.modulo_infantil))
      .catch(() => {});
  }, [token]);

  const handleDeleteAluno = async (id: number) => {
    if (!token) return;
    await fetch(`${API}/school/alunos/${id}`, { method: "DELETE", headers });
    setAlunos(prev => prev.filter(a => a.id !== id));
  };
  const handleDeleteTurma = async (id: number) => {
    if (!token) return;
    await fetch(`${API}/school/turmas/${id}`, { method: "DELETE", headers });
    setTurmas(prev => prev.filter(t => t.id !== id));
  };

  const handleLogout = () => { logout(); setLocation("/escolar"); };

  const [ddPendingCount, setDdPendingCount] = useState(0);
  const [storePendingCount, setStorePendingCount] = useState(0);
  useEffect(() => {
    if (!token) return;
    fetch(`${API}/school/direct-debit/subscriptions`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((rows: DDSub[]) => setDdPendingCount(rows.filter(r => r.status === "cancellation_requested").length))
      .catch(() => {});
  }, [token]);

  /* ── Navigation types ── */
  type NavLeaf  = { type: "item";  key: DashView; icon: React.ReactNode; label: string; badge?: number };
  type NavGroup = { type: "group"; key: string;   icon: React.ReactNode; label: string; children: NavLeaf[] };
  type NavEntry = NavLeaf | NavGroup;

  /* Views that belong to each accordion group */
  const FINANCIAL_VIEWS: DashView[] = ["reconciliacao", "relatorios", "caixa"];
  const COMUNICAR_VIEWS: DashView[] = ["comunicar", "ocorrencias"];

  /* ── Structured NAV ── */
  const NAV: NavEntry[] = [
    { type: "item",  key: "inicio",        icon: <LayoutDashboard className="w-5 h-5"/>, label: "Início" },
    { type: "item",  key: "alunos",        icon: <Users className="w-5 h-5"/>,           label: "Alunos & Turmas" },
    { type: "item",  key: "propinas",      icon: <FileText className="w-5 h-5"/>,         label: "Propinas & Faturas" },
    {
      type: "group", key: "financeiro",
      icon: <Banknote className="w-5 h-5"/>, label: "Financeiro",
      children: [
        { type: "item", key: "caixa",         icon: <Receipt className="w-4 h-4"/>,     label: "Fatura de Caixa" },
        { type: "item", key: "reconciliacao", icon: <ShieldCheck className="w-4 h-4"/>, label: "Reconciliação" },
        { type: "item", key: "relatorios",    icon: <BarChart3 className="w-4 h-4"/>,   label: "Relatórios" },
      ],
    },
    { type: "item",  key: "debito_direto", icon: <CreditCard className="w-5 h-5"/>,     label: "Débito Direto", badge: ddPendingCount },
    { type: "item",  key: "emolumentos",   icon: <Receipt className="w-5 h-5"/>,         label: "Emolumentos",   badge: storePendingCount },
    {
      type: "group", key: "comunicar_group",
      icon: <Megaphone className="w-5 h-5"/>, label: "Comunicar",
      children: [
        { type: "item", key: "comunicar",   icon: <Send className="w-4 h-4"/>,          label: "Enviar Comunicado" },
        { type: "item", key: "ocorrencias", icon: <AlertTriangle className="w-4 h-4"/>, label: "Ocorrências" },
      ],
    },
    { type: "item",  key: "gestao_acessos", icon: <Lock className="w-5 h-5"/>,          label: "Gestão de Acessos" },
    { type: "item",  key: "avaliacoes",     icon: <CalendarDays className="w-5 h-5"/>,  label: "Calendário Escolar" },
    { type: "item",  key: "partilhar_portal", icon: <Share2 className="w-5 h-5"/>,       label: "Partilhar Portal" },
  ];

  /* ── Accordion state: which groups are manually expanded ── */
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const s = new Set<string>();
    if (FINANCIAL_VIEWS.includes("inicio" as DashView)) s.add("financeiro");
    if (COMUNICAR_VIEWS.includes("inicio" as DashView)) s.add("comunicar_group");
    return s;
  });

  /* Auto-expand parent group when navigating to a child view */
  useEffect(() => {
    if (FINANCIAL_VIEWS.includes(view)) setExpandedGroups(prev => new Set([...prev, "financeiro"]));
    else if (COMUNICAR_VIEWS.includes(view)) setExpandedGroups(prev => new Set([...prev, "comunicar_group"]));
  }, [view]);

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  /* Resolve the display label for any view (including nested) */
  const getViewLabel = (v: DashView): string => {
    for (const entry of NAV) {
      if (entry.type === "item" && entry.key === v) return entry.label;
      if (entry.type === "group") {
        const child = entry.children.find(c => c.key === v);
        if (child) return child.label;
      }
    }
    return v;
  };

  /* ── Sidebar nav renderer ── */
  const SidebarContent = ({ onNav }: { onNav?: () => void }) => (
    <>
      <nav className="flex-1 px-4 py-6 space-y-0.5">
        {NAV.map(entry => {
          if (entry.type === "item") {
            const active = view === entry.key;
            return (
              <button key={entry.key}
                onClick={() => { setView(entry.key); onNav?.(); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-sm
                  ${active ? "bg-primary/10 text-primary font-medium" : "hover:bg-slate-800 text-slate-400 hover:text-slate-200"}`}>
                {entry.icon}
                <span className="flex-1 text-left">{entry.label}</span>
                {entry.badge && entry.badge > 0
                  ? <span className="ml-auto px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold leading-none">{entry.badge}</span>
                  : null}
              </button>
            );
          }

          /* Group (accordion) */
          const hasActiveChild = entry.children.some(c => c.key === view);
          const isOpen = hasActiveChild || expandedGroups.has(entry.key);

          return (
            <div key={entry.key}>
              {/* Group header */}
              <button
                onClick={() => toggleGroup(entry.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-sm
                  ${hasActiveChild ? "text-primary font-medium" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"}`}>
                {entry.icon}
                <span className="flex-1 text-left">{entry.label}</span>
                <motion.span
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: 0.18, ease: "easeInOut" }}
                  className="ml-auto flex-shrink-0">
                  <ChevronDown className="w-4 h-4 opacity-60"/>
                </motion.span>
              </button>

              {/* Children (animated slide) */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    key="children"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden">
                    <div className="ml-3 pl-3 border-l border-slate-700 mt-0.5 mb-1 space-y-0.5">
                      {entry.children.map(child => {
                        const childActive = view === child.key;
                        return (
                          <button key={child.key}
                            onClick={() => { setView(child.key); onNav?.(); }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-sm
                              ${childActive ? "bg-primary/10 text-primary font-medium" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"}`}>
                            {child.icon}
                            <span className="flex-1 text-left">{child.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        <div className="border-t border-slate-800 mt-2 pt-2">
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 transition-colors text-sm text-slate-400 hover:text-slate-200">
            <Settings className="w-5 h-5"/> Configurações
          </a>
          <Link href="/encarregado" className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 transition-colors text-sm text-emerald-400 hover:text-emerald-300" onClick={onNav}>
            <GraduationCap className="w-5 h-5"/> {portalLabel}
          </Link>
        </div>
      </nav>
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center">{initials}</div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate">{schoolName}</p>
            <p className="text-xs text-slate-500 truncate">{session?.adminEmail}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 transition-colors text-red-400 hover:text-red-300 text-sm">
          <LogOut className="w-5 h-5"/> Terminar Sessão
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-x-hidden">

      {/* ── Desktop Sidebar (md+) ── */}
      <aside className="bg-slate-900 text-slate-300 w-64 flex-shrink-0 hidden md:flex flex-col sticky top-0 h-screen overflow-y-auto">
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center font-extrabold mr-3 text-sm">K</div>
          <span className="font-display font-bold text-white text-base">Kiwara Escolar</span>
        </div>
        <SidebarContent />
      </aside>

      {/* ── Mobile Drawer ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              key="dash-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
            />
            <motion.aside
              key="dash-drawer"
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.22, ease: "easeInOut" }}
              className="fixed top-0 left-0 z-50 h-full w-72 bg-slate-900 text-slate-300 flex flex-col shadow-2xl md:hidden"
            >
              <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center font-extrabold text-sm">K</div>
                  <span className="font-display font-bold text-white text-base">Kiwara Escolar</span>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors">
                  <X className="w-4 h-4"/>
                </button>
              </div>
              <SidebarContent onNav={() => setSidebarOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(o => !o)}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 md:hidden transition-colors"
              aria-label="Menu"
            >
              <Menu className="w-5 h-5"/>
            </button>
            <h1 className="font-semibold text-slate-900 text-sm md:text-base">
              {getViewLabel(view)}
            </h1>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <div className="relative hidden sm:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input type="text" placeholder="Pesquisar aluno..."
                className="pl-9 pr-4 py-2 bg-slate-100 border-transparent rounded-full text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all w-40 lg:w-56"/>
            </div>
            <button className="relative p-2 text-slate-500 hover:text-slate-900"><Bell className="w-5 h-5"/></button>
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center font-bold text-xs shadow-sm">{initials}</div>
          </div>
        </header>

        {loading ? (
          <div className="flex-1 flex items-center justify-center"><RefreshCw className="w-6 h-6 animate-spin text-primary"/></div>
        ) : (
          <AnimatePresence mode="wait">
            {view === "inicio" && (
              <motion.div key="inicio" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1">
                <InicioView token={token} alunos={alunos} propinas={propinas} turmas={turmas} schoolId={schoolId} schoolName={schoolName}
                  onOpenCriarTurma={() => setModal("turma")} onOpenAdicionarAluno={() => setModal("aluno")}
                  onOpenGerarPropina={() => setModal("propina")} onOpenGerarRef={() => setModal("referencia")}
                  onOpenGerarLote={() => setModal("lote")}/>
              </motion.div>
            )}
            {view === "alunos" && (
              <motion.div key="alunos" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex-1">
                <AlunosView token={token} alunos={alunos} turmas={turmas} pacotes={pacotes}
                  onOpenAdicionarAluno={() => setModal("aluno")} onOpenCriarTurma={() => setModal("turma")}
                  onDeleteAluno={handleDeleteAluno} onDeleteTurma={handleDeleteTurma} onRefresh={loadAll}/>
              </motion.div>
            )}
            {view === "propinas" && (
              <motion.div key="propinas" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex-1">
                <PropinasView token={token} propinas={propinas} alunos={alunos} turmas={turmas}
                  onOpenGerarPropina={() => setModal("propina")} onOpenGerarRef={() => setModal("referencia")}
                  onOpenGerarLote={() => setModal("lote")}/>
              </motion.div>
            )}
            {view === "reconciliacao" && (
              <ReconciliacaoView key="reconciliacao" token={token}/>
            )}
            {view === "ocorrencias" && (
              <motion.div key="ocorrencias" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col">
                <OcorrenciasView token={token} schoolName={schoolName}/>
              </motion.div>
            )}
            {view === "comunicar" && (
              <motion.div key="comunicar" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex-1">
                <ComunicarView token={token} moduloInfantil={schoolModuloInfantil}/>
              </motion.div>
            )}
            {view === "caixa" && token && (
              <motion.div key="caixa" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex-1">
                <CaixaView token={token}/>
              </motion.div>
            )}
            {view === "debito_direto" && (
              <DDCancelamentosView key="debito_direto" token={token}/>
            )}
            {view === "emolumentos" && token && (
              <EmolumentosView key="emolumentos" token={token} onStorePending={setStorePendingCount}/>
            )}
            {view === "relatorios" && token && (
              <ReportsDashboard key="relatorios" token={token}/>
            )}
            {view === "gestao_acessos" && token && (
              <AccessManagement key="gestao_acessos" token={token}/>
            )}
            {view === "avaliacoes" && token && (
              <motion.div key="avaliacoes" initial={{ opacity:0, x:16 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0 }} className="flex-1">
                <CalendarioView token={token} turmas={turmas} moduloInfantil={schoolModuloInfantil}/>
              </motion.div>
            )}
            {view === "partilhar_portal" && token && (
              <PartilharPortalView key="partilhar_portal" token={token}/>
            )}
          </AnimatePresence>
        )}
      </main>

      {/* Modals */}
      <AnimatePresence>
        {modal === "turma" && token && (
          <Modal key="m-turma" title="Criar Turma" onClose={() => setModal(null)}>
            <ModalCriarTurma token={token} onClose={() => setModal(null)} onCreated={t => { setTurmas(prev => [...prev, t]); setModal(null); }}/>
          </Modal>
        )}
        {modal === "aluno" && token && (
          <Modal key="m-aluno" title="Adicionar Aluno" onClose={() => setModal(null)}>
            <ModalAdicionarAluno token={token} turmas={turmas} onClose={() => setModal(null)} onCreated={a => { setAlunos(prev => [...prev, a]); setModal(null); }}/>
          </Modal>
        )}
        {modal === "propina" && token && (
          <Modal key="m-propina" title="Gerar Propinas" onClose={() => setModal(null)}>
            <ModalGerarPropina token={token} alunos={alunos} onClose={() => setModal(null)} onCreated={loadAll}/>
          </Modal>
        )}
        {modal === "referencia" && token && (
          <Modal key="m-ref" title="Gerar Referência Multicaixa" onClose={() => setModal(null)}>
            <ModalGerarReferencia token={token} propinas={propinas} alunos={alunos} onClose={() => setModal(null)} onDone={loadAll}/>
          </Modal>
        )}
        {modal === "lote" && token && (
          <Modal key="m-lote" title="Gerar Propinas em Massa" onClose={() => setModal(null)}>
            <ModalGerarLote token={token} onClose={() => setModal(null)} onCreated={loadAll}/>
          </Modal>
        )}

      </AnimatePresence>
    </div>
  );
}

