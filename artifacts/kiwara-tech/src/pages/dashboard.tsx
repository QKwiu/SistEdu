import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, FileText, Settings, LogOut,
  Bell, Search, Plus, TrendingUp, AlertCircle, CheckCircle2,
  Clock, BarChart3, GraduationCap, Banknote, Share2, Copy,
  AlertTriangle, RefreshCw, Trash2, Calendar, BookOpen, X, Menu,
  ChevronDown, User, School, CreditCard, MoreHorizontal, History,
  UserPlus, FileSpreadsheet, Download, Upload,
  ArrowLeftRight, ShieldCheck, Receipt, Landmark, Filter,
  Paperclip, FileCheck, CalendarDays, MessageSquare, ExternalLink, BadgeCheck,
  Eye, FileImage, Link as LinkIcon, Smartphone, Send, ToggleLeft, ToggleRight,
  ChevronLeft, ChevronRight, ListFilter,
  Megaphone, CheckCheck, XCircle, Info,
  Pencil, Lock, Save, EyeOff, Package, Globe, ShieldOff,
} from "lucide-react";
import { Button, Card } from "@/components/ui-elements";
import { useAuth } from "@/lib/auth";
import { StudentRegistrationForm } from "@/components/student-form";

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
interface GeneratedRef { entidade: string; referencia: string; valor: number; validade: string; total_base?: number; total_multa?: number; }

type DashView = "inicio" | "alunos" | "propinas" | "ocorrencias" | "reconciliacao" | "comunicar" | "debito_direto" | "emolumentos";

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
        <select className={selectCls} value={form.student_id} onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))}>
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
            onChange={e => setForm(f => ({ ...f, montante: e.target.value }))} placeholder="ex: 35000"/>
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<null | { total_geradas: number; total_skipped: number; total_alunos: number; periodos: number; detalhes: any[] }>(null);

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
    return (
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 shrink-0"/>
          <div>
            <p className="font-bold text-emerald-800">Lote gerado com sucesso!</p>
            <p className="text-sm text-emerald-600">{result.total_geradas} propina(s) criada(s) · {result.total_skipped} ignorada(s) (já existentes)</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Alunos processados", value: result.total_alunos },
            { label: "Meses gerados", value: result.periodos },
            { label: "Propinas criadas", value: result.total_geradas },
          ].map(s => (
            <div key={s.label} className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
              <p className="text-2xl font-bold text-slate-900">{s.value}</p>
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

      {/* Preview */}
      {periodoPreview > 0 && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
          <Calendar className="w-4 h-4 shrink-0"/>
          <span>Serão geradas propinas para <strong>{periodoPreview} mês{periodoPreview>1?"es":""}</strong> para todos os alunos activos.</span>
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
  const [copied, setCopied] = useState(false);

  const pending = propinas.filter(p => p.status === "pendente" || p.status === "vencido");

  // Distinct months present in pending propinas (sorted by year+month index)
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

  const selectedTotal = [...selectedIds].reduce((sum, id) => {
    const p = pending.find(x => x.id === id);
    return sum + (p ? Number(p.montante) + Number(p.multa) : 0);
  }, 0);

  const submit = async () => {
    if (!selectedIds.size) return setError("Selecione pelo menos uma propina.");
    setError(""); setSaving(true);
    try {
      const res = await fetch(`${API}/school/propinas/referencia`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ propina_ids: [...selectedIds] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao gerar referência.");
      setResult(data);
      onDone();
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const copy = (text: string) => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  if (result) {
    return (
      <div className="p-6 space-y-5">
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3"/>
          <p className="font-bold text-emerald-900 text-lg mb-1">Referência Gerada</p>
          <p className="text-emerald-700 text-sm">Referência Multicaixa válida até {fmtDate(result.validade)}</p>
        </div>
        {/* Breakdown: base + multa + total */}
        {(result.total_multa !== undefined && result.total_multa > 0) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm space-y-1">
            <div className="flex justify-between text-slate-600">
              <span>Propinas (base)</span>
              <span className="font-semibold">{fmt(result.total_base ?? 0)} Kz</span>
            </div>
            <div className="flex justify-between text-red-600">
              <span className="flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5"/>Multa por atraso aplicada</span>
              <span className="font-semibold">+ {fmt(result.total_multa)} Kz</span>
            </div>
            <div className="flex justify-between text-slate-900 font-bold border-t border-amber-200 pt-1 mt-1">
              <span>Total da Referência</span>
              <span>{fmt(result.valor)} Kz</span>
            </div>
          </div>
        )}
        <div className="space-y-3">
          {[
            { label: "Entidade", value: result.entidade },
            { label: "Referência", value: result.referencia },
            { label: "Valor Total", value: fmt(result.valor) + " Kz" },
            { label: "Válida até", value: fmtDate(result.validade) },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
              <span className="text-sm text-slate-500">{row.label}</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 font-mono">{row.value}</span>
                <button onClick={() => copy(row.value)} className="text-slate-300 hover:text-primary transition-colors">
                  {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500"/> : <Copy className="w-4 h-4"/>}
                </button>
              </div>
            </div>
          ))}
        </div>
        <Button onClick={onClose} className="w-full">Fechar</Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Filters */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Filtrar por aluno">
          <select className={selectCls} value={filterAluno}
            onChange={e => { setFilterAluno(e.target.value); setSelectedIds(new Set()); }}>
            <option value="">Todos os alunos</option>
            {alunos.filter(a => pending.some(p => p.student_id === a.id)).map(a => (
              <option key={a.id} value={a.id}>{a.nome}</option>
            ))}
          </select>
        </Field>
        <Field label="Filtrar por mês">
          <select className={selectCls} value={filterMes}
            onChange={e => { setFilterMes(e.target.value); setSelectedIds(new Set()); }}>
            <option value="">Todos os meses</option>
            {availableMeses.map(m => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>
        </Field>
      </div>

      {pending.length === 0 ? (
        <div className="py-8 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-300 mx-auto mb-2"/>
          <p className="text-slate-500 font-medium">Sem propinas pendentes</p>
        </div>
      ) : (
        <>
          {/* Select all / clear bar */}
          <div className="flex items-center justify-between py-1">
            <p className="text-xs text-slate-500">{filtered.length} propina(s) visível(eis)</p>
            <div className="flex gap-2">
              <button type="button" onClick={allSelected ? clearAll : selectAll}
                className="text-xs font-semibold text-primary hover:underline">
                {allSelected ? "Desseleccionar todos" : "Seleccionar todos"}
              </button>
              {selectedIds.size > 0 && !allSelected && (
                <button type="button" onClick={clearAll} className="text-xs text-slate-400 hover:text-slate-600">Limpar</button>
              )}
            </div>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">Nenhuma propina corresponde aos filtros.</p>
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
                    <span className="text-sm font-bold text-slate-900 block">{fmt(Number(p.montante) + Number(p.multa))}</span>
                    {p.status === "vencido" && <span className="text-xs text-red-500 font-medium">Vencida</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {selectedIds.size > 0 && (
        <div className="bg-slate-900 rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-white font-bold text-lg">{fmt(selectedTotal)}</p>
            <p className="text-slate-400 text-xs">{selectedIds.size} propina(s) seleccionada(s)</p>
          </div>
          <button onClick={clearAll} className="text-slate-400 hover:text-white p-1"><X className="w-4 h-4"/></button>
        </div>
      )}

      {/* Automatic fine notice */}
      {[...selectedIds].some(id => pending.find(p => p.id === id)?.status === "vencido") && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-start gap-2 text-amber-800 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600"/>
          <span>As propinas vencidas incluídas terão a multa por atraso calculada automaticamente com base nas regras configuradas e incorporada no total da referência.</span>
        </div>
      )}

      <Feedback error={error}/>
      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
        <Button onClick={submit} disabled={saving || !selectedIds.size} className="flex-1">
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
      onSubmitForm={handleSubmit}
      onCreateTurma={onCreateTurma}
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

/* ─── AlunoFichaSlideOver (portal da escola) ─── */
interface AlunoFichaData {
  id: number; nome: string; bilhete?: string; numero_processo?: string;
  data_nascimento?: string; sexo?: string; estado?: string;
  turma_id?: number | null; turma_nome?: string; turno?: string;
  nome_encarregado?: string; telefone_encarregado?: string;
  encarregado?: { id: number; nome: string; telefone: string; email?: string; first_login: boolean } | null;
  turmas?: { id: number; nome: string; turno?: string }[];
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

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const inp = "border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 w-full";

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/school/alunos/${alunoId}`, { headers })
      .then(r => r.json())
      .then((d: AlunoFichaData) => {
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
      })
      .finally(() => setLoading(false));
  }, [alunoId]);

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
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Erro ao guardar.");
      setSaved(true);
      onSaved?.({ id: alunoId, nome: d.nome, bilhete: d.bilhete, numero_processo: d.numero_processo,
        data_nascimento: d.data_nascimento, sexo: d.sexo, estado: d.estado,
        nome_encarregado: d.nome_encarregado, telefone_encarregado: d.telefone_encarregado,
        turma_id: d.turma_id, turma: d.turma_nome, turno: d.turno });
      setTimeout(() => { setSaved(false); onClose(); }, 1200);
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
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
          <Button variant="outline" className="bg-white gap-2" onClick={onOpenGerarPropina}><FileText className="w-4 h-4"/> Gerar Propina</Button>
          <Button variant="outline" className="bg-white gap-2" onClick={onOpenGerarLote}><Users className="w-4 h-4"/> Gerar em Lote</Button>
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
                        ? <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            <Landmark className="w-2.5 h-2.5"/> {p.metodo_pagamento ?? "Online"}
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
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2"/>
                  <p className="font-semibold text-emerald-800">Pagamento registado com sucesso!</p>
                  <p className="text-sm text-emerald-600 mt-1">Estado actualizado para <strong>{bmResult.status}</strong></p>
                  <button onClick={() => setBmPropina(null)}
                    className="mt-4 px-5 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors">
                    Fechar
                  </button>
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
  const [bmMetodo, setBmMetodo] = useState("Numerário");
  const [bmData, setBmData] = useState("");
  const [bmObs, setBmObs] = useState("");
  const [bmFile, setBmFile] = useState<File | null>(null);
  const [bmResult, setBmResult] = useState<any>(null);
  const [bmError, setBmError] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [recSubTab, setRecSubTab] = useState<"faturas" | "multas">("faturas");

  const authHeader = (): HeadersInit => token ? { Authorization: `Bearer ${token}` } : {};

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const qs = filterStatus ? `?status=${filterStatus}` : "";
      const r = await fetch(`${API}/school/reconciliacao${qs}`, { headers: authHeader() });
      if (r.ok) {
        const d = await r.json();
        setPropinas(d.propinas ?? []);
        setStats(d.stats ?? null);
        setCommissionRate(Number(d.commission_rate ?? 0));
      }
    } finally { setLoading(false); }
  }, [token, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const handleBaixaManual = async () => {
    if (!baixaModal) return;
    if (!bmFile) { setBmError("Seleccione o comprovante de pagamento."); return; }
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
      fd.append("comprovante", bmFile);
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
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 self-start sm:self-auto">
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

      {/* Stats cards */}
      {recSubTab === "faturas" && stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Faturas Pendentes", value: stats.pendentes, icon: <Clock className="w-5 h-5"/>, color: "text-amber-600 bg-amber-50 border-amber-200" },
            { label: "Faturas Vencidas",  value: stats.vencidas,  icon: <AlertCircle className="w-5 h-5"/>, color: "text-red-600 bg-red-50 border-red-200" },
            { label: "Faturas Pagas",     value: stats.pagas,     icon: <CheckCircle2 className="w-5 h-5"/>, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
            { label: "Receita Total",     value: fmt(stats.receita_total), icon: <Banknote className="w-5 h-5"/>, color: "text-primary bg-primary/5 border-primary/20" },
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Landmark className="w-4 h-4 text-blue-600"/>
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Conta do Colégio</p>
              </div>
              <p className="text-2xl font-bold text-blue-800">{fmt(stats.receita_escola)}</p>
              <p className="text-xs text-blue-600 mt-1">Receita líquida após comissão</p>
            </div>
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Receipt className="w-4 h-4 text-violet-600"/>
                <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Comissão Plataforma</p>
              </div>
              <p className="text-2xl font-bold text-violet-800">{fmt(stats.comissao_plataforma)}</p>
              <p className="text-xs text-violet-600 mt-1">Kiwara Tech ({commissionRate}%)</p>
            </div>
          </div>
        </div>
      )}

      {/* Filter bar */}
      {recSubTab === "faturas" && <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar aluno ou referência…"
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"/>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
          {(["", "pendente", "vencido", "pago"] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterStatus===s?"bg-white text-slate-900 shadow-sm":"text-slate-500 hover:text-slate-700"}`}>
              {s === "" ? "Todas" : s === "pendente" ? "Pendentes" : s === "vencido" ? "Vencidas" : "Pagas"}
            </button>
          ))}
        </div>
        <button onClick={load} className="p-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-500 transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}/>
        </button>
      </div>}

      {recSubTab === "faturas" && <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Aluno</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Referência Interna</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Período</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Fatura</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Split Escola</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Comissão</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-12 text-center text-slate-400"><RefreshCw className="w-5 h-5 animate-spin inline"/></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-slate-400 text-sm">Nenhum registo encontrado.</td></tr>
              ) : filtered.map(p => (
                <>
                  <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{p.aluno_nome}</p>
                      <p className="text-xs text-slate-400">{p.turma}</p>
                    </td>
                    <td className="px-4 py-3">
                      {p.internal_reference ? (
                        <span className="font-mono text-xs text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">{p.internal_reference}</span>
                      ) : <span className="text-slate-400 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{p.mes}/{p.ano}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{fmt(p.total_fatura)}</td>
                    <td className="px-4 py-3 text-right text-blue-700 font-medium">{p.status==="pago"?fmt(p.split_escola):"—"}</td>
                    <td className="px-4 py-3 text-right text-violet-700 font-medium">{p.status==="pago"?fmt(p.split_plataforma):"—"}</td>
                    <td className="px-4 py-3 text-center">{statusBadge(p.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {p.status !== "pago" && (
                          <button onClick={() => {
                            setBaixaModal(p);
                            setBmValor(String(Math.round(p.total_fatura)));
                            setBmData(new Date().toISOString().slice(0,10));
                            setBmMetodo("Numerário");
                            setBmObs(""); setBmFile(null); setBmResult(null); setBmError("");
                          }}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors whitespace-nowrap">
                            <FileCheck className="w-3 h-3"/> Baixa Manual
                          </button>
                        )}
                        {p.baixa_manual && (
                          <span className="flex items-center gap-1 px-2 py-1 text-xs font-semibold bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
                            <BadgeCheck className="w-3 h-3"/> Manual
                          </span>
                        )}
                        <button onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors">
                          <ChevronDown className={`w-4 h-4 transition-transform ${expandedId===p.id?"rotate-180":""}`}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === p.id && (
                    <tr key={`${p.id}-detail`} className="bg-slate-50/80 border-b border-slate-100">
                      <td colSpan={8} className="px-6 py-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div><p className="text-slate-400 uppercase font-semibold tracking-wide">Montante base</p><p className="font-semibold text-slate-800 mt-0.5">{fmt(p.montante)}</p></div>
                          <div><p className="text-slate-400 uppercase font-semibold tracking-wide">Multa</p><p className="font-semibold text-red-700 mt-0.5">{fmt(p.multa)}</p></div>
                          <div><p className="text-slate-400 uppercase font-semibold tracking-wide">Vencimento</p><p className="font-semibold text-slate-800 mt-0.5">{fmtDate(p.data_vencimento)}</p></div>
                          {p.pago_em && <div><p className="text-slate-400 uppercase font-semibold tracking-wide">Data Pagamento</p><p className="font-semibold text-emerald-700 mt-0.5">{fmtDate(p.pago_em)}</p></div>}
                          {p.ref_multicaixa && <div><p className="text-slate-400 uppercase font-semibold tracking-wide">Ref. Multicaixa</p><p className="font-mono font-semibold text-slate-800 mt-0.5">{p.entidade} / {p.ref_multicaixa}</p></div>}
                        </div>
                        {p.baixa_manual && (
                          <div className="mt-4 border-t border-blue-100 pt-4">
                            <p className="text-xs font-bold text-blue-700 uppercase tracking-wide flex items-center gap-1 mb-3">
                              <BadgeCheck className="w-3.5 h-3.5"/> Baixa Manual — Detalhes
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                              {p.baixa_manual_por && <div><p className="text-slate-400 uppercase font-semibold tracking-wide">Registado por</p><p className="font-semibold text-slate-800 mt-0.5">{p.baixa_manual_por}</p></div>}
                              {p.baixa_manual_em && <div><p className="text-slate-400 uppercase font-semibold tracking-wide">Registado em</p><p className="font-semibold text-slate-800 mt-0.5">{fmtDate(p.baixa_manual_em)}</p></div>}
                              {p.data_recebimento && <div><p className="text-slate-400 uppercase font-semibold tracking-wide">Data Recebimento</p><p className="font-semibold text-emerald-700 mt-0.5">{fmtDate(p.data_recebimento)}</p></div>}
                              {p.baixa_manual_obs && <div className="col-span-2"><p className="text-slate-400 uppercase font-semibold tracking-wide">Observações</p><p className="text-slate-700 mt-0.5 italic">{p.baixa_manual_obs}</p></div>}
                            </div>
                            {p.comprovante_url && (
                              <a href={p.comprovante_url} target="_blank" rel="noopener noreferrer"
                                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg transition-colors">
                                <Paperclip className="w-3.5 h-3.5"/> Ver Comprovante
                                <ExternalLink className="w-3 h-3 ml-0.5"/>
                              </a>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>}

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
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                    <p className="text-emerald-800 font-semibold flex items-center gap-2 mb-1">
                      <CheckCircle2 className="w-4 h-4"/> Baixa manual registada com sucesso
                    </p>
                    <p className="text-xs text-emerald-700">Ref. pagamento: <span className="font-mono font-bold">{bmResult.payment_ref}</span></p>
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
                  <Button onClick={() => { setBaixaModal(null); setBmResult(null); }} className="w-full">Fechar</Button>
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
                    <select value={bmMetodo} onChange={e => setBmMetodo(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40">
                      <option>Numerário</option>
                      <option>Transferência</option>
                      <option>EMIS</option>
                      <option>Appy Pay</option>
                      <option>Cheque</option>
                      <option>Outro</option>
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

                  {/* Comprovante upload */}
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
                  </div>

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
   ComunicarView — unified communication hub (portal + SMS)
   ═══════════════════════════════════════════════════════════════ */
function ComunicarView({ token }: { token: string }) {
  const authH = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  type ComunicarTab = "compor" | "publicados" | "historico";
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
   DDCancelamentosView — direct debit management for school portal
   ═══════════════════════════════════════════════════════════════ */
interface DDSub {
  id: number; encarregado_id: number; encarregado_nome: string; encarregado_telefone: string;
  status: string; created_at: string; cancelled_at?: string; cancellation_requested_at?: string;
}

function DDCancelamentosView({ token }: { token: string }) {
  const [list, setList] = useState<DDSub[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<number | null>(null);
  const [filter, setFilter] = useState<"todos" | "active" | "cancellation_requested" | "cancelled">("todos");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/school/direct-debit/subscriptions`, { headers: { Authorization: `Bearer ${token}` } });
      setList(await r.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const doAction = async (id: number, action: "approve-cancellation" | "reject-cancellation") => {
    setActioning(id);
    try {
      await fetch(`${API}/school/direct-debit/subscriptions/${id}/${action}`, {
        method: "PUT", headers: { Authorization: `Bearer ${token}` },
      });
      load();
    } catch { alert("Erro ao processar a acção."); }
    finally { setActioning(null); }
  };

  const statusBadge = (s: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      active: { label: "Activo", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
      cancellation_requested: { label: "Cancelamento Pedido", cls: "bg-amber-100 text-amber-700 border-amber-200" },
      cancelled: { label: "Cancelado", cls: "bg-slate-100 text-slate-500 border-slate-200" },
    };
    const cfg = map[s] ?? { label: s, cls: "bg-slate-100 text-slate-500 border-slate-200" };
    return <span className={`px-2 py-0.5 rounded text-xs font-medium border ${cfg.cls}`}>{cfg.label}</span>;
  };

  const filtered = filter === "todos" ? list : list.filter(d => d.status === filter);
  const pendingCount = list.filter(d => d.status === "cancellation_requested").length;

  return (
    <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex-1 p-6 max-w-3xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary"/> Débito Direto
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Subscrições e pedidos de cancelamento</p>
        </div>
        {pendingCount > 0 && (
          <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold border border-amber-200">
            {pendingCount} pedido{pendingCount > 1 ? "s" : ""} pendente{pendingCount > 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {(["todos","active","cancellation_requested","cancelled"] as const).map(f => {
          const labels: Record<string, string> = { todos: "Todos", active: "Activos", cancellation_requested: "Pedidos Cancelamento", cancelled: "Cancelados" };
          return (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors border ${filter === f ? "bg-primary text-white border-primary" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
              {labels[f]}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2"/> A carregar…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-slate-400 gap-2">
          <CreditCard className="w-8 h-8 opacity-40"/>
          <p className="text-sm">Nenhuma subscrição encontrada.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(d => (
            <div key={d.id} className={`bg-white border rounded-2xl p-5 shadow-sm ${d.status === "cancellation_requested" ? "border-amber-200" : "border-slate-200"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {statusBadge(d.status)}
                    <span className="text-xs text-slate-400">Subscrito em {new Date(d.created_at).toLocaleDateString("pt-AO", { day: "2-digit", month: "short", year: "numeric" })}</span>
                  </div>
                  <p className="font-semibold text-slate-900 text-sm">{d.encarregado_nome}</p>
                  <p className="text-xs text-slate-500">{d.encarregado_telefone}</p>
                  {d.cancellation_requested_at && (
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <Info className="w-3.5 h-3.5"/> Cancelamento pedido em {new Date(d.cancellation_requested_at).toLocaleDateString("pt-AO", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  )}
                  {d.cancelled_at && (
                    <p className="text-xs text-slate-400 mt-1">Cancelado em {new Date(d.cancelled_at).toLocaleDateString("pt-AO", { day: "2-digit", month: "short", year: "numeric" })}</p>
                  )}
                </div>
                {d.status === "cancellation_requested" && (
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button onClick={() => doAction(d.id, "approve-cancellation")} disabled={actioning === d.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 disabled:opacity-50 transition-colors">
                      <XCircle className="w-3.5 h-3.5"/> Confirmar Cancelamento
                    </button>
                    <button onClick={() => doAction(d.id, "reject-cancellation")} disabled={actioning === d.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-medium hover:bg-emerald-600 disabled:opacity-50 transition-colors">
                      <CheckCheck className="w-3.5 h-3.5"/> Manter Activo
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
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
  multa_ativo: boolean; multa_tipo: string;
  multa_valor_fixo: number | null; multa_percentagem: number | null;
  juros_mora: number; dias_carencia: number;
}

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
function LocalEmolumentosTab({ token }: { token: string }) {
  const [list, setList] = useState<Emolumento[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const MULTA_INIT = { multa_ativo: false, multa_tipo: "fixo", multa_valor_fixo: "", multa_percentagem: "", juros_mora: "", dias_carencia: "0" };
  const [editForm, setEditForm] = useState({ nome: "", montante: "", ano_lectivo: "2025/2026", ...MULTA_INIT });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ tipo: "propina", nome: DESCRICAO_POR_TIPO_SCH["propina"][0] ?? "", montante: "", ano_lectivo: "2025/2026", nomeCustom: "", ...MULTA_INIT });
  const [formErr, setFormErr] = useState("");

  const hdrs = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/school/emolumentos`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const all: Emolumento[] = await r.json();
        setList(all.filter(e => !e.is_global));
      }
    } catch {}
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault(); setFormErr("");
    const nome = form.tipo === "outro" ? form.nomeCustom.trim() : form.nome.trim();
    if (!nome) return setFormErr("Introduza uma descrição.");
    if (!form.montante || Number(form.montante) <= 0) return setFormErr("Introduza um montante válido.");
    setSaving(true);
    try {
      const r = await fetch(`${API}/school/emolumentos`, {
        method: "POST", headers: hdrs,
        body: JSON.stringify({ tipo: form.tipo, nome, montante: Number(form.montante), ano_lectivo: form.ano_lectivo, multa_ativo: form.multa_ativo, multa_tipo: form.multa_tipo, multa_valor_fixo: form.multa_valor_fixo ? Number(form.multa_valor_fixo) : null, multa_percentagem: form.multa_percentagem ? Number(form.multa_percentagem) : null, juros_mora: form.juros_mora ? Number(form.juros_mora) : 0, dias_carencia: Number(form.dias_carencia || 0) }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Erro ao guardar.");
      setList(prev => [data, ...prev]);
      setForm({ tipo: "propina", nome: DESCRICAO_POR_TIPO_SCH["propina"][0] ?? "", montante: "", ano_lectivo: "2025/2026", nomeCustom: "", ...MULTA_INIT });
      setShowForm(false);
    } catch (err: any) { setFormErr(err.message); }
    setSaving(false);
  };

  const saveEdit = async (id: number) => {
    if (!editForm.nome.trim() || !editForm.montante) return;
    setSaving(true);
    try {
      const r = await fetch(`${API}/school/emolumentos/${id}`, {
        method: "PUT", headers: hdrs,
        body: JSON.stringify({ nome: editForm.nome.trim(), montante: Number(editForm.montante), ano_lectivo: editForm.ano_lectivo, multa_ativo: editForm.multa_ativo, multa_tipo: editForm.multa_tipo, multa_valor_fixo: editForm.multa_valor_fixo ? Number(editForm.multa_valor_fixo) : null, multa_percentagem: editForm.multa_percentagem ? Number(editForm.multa_percentagem) : null, juros_mora: editForm.juros_mora ? Number(editForm.juros_mora) : 0, dias_carencia: Number(editForm.dias_carencia || 0) }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Erro ao guardar.");
      setList(prev => prev.map(e => e.id === id ? { ...e, ...data } : e));
      setEditId(null);
    } catch (err: any) { alert(err.message); }
    setSaving(false);
  };

  const toggleActivo = async (em: Emolumento) => {
    const r = await fetch(`${API}/school/emolumentos/${em.id}/toggle`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) { const d = await r.json(); setList(prev => prev.map(e => e.id === em.id ? { ...e, ...d } : e)); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Eliminar este emolumento local?")) return;
    await fetch(`${API}/school/emolumentos/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    setList(prev => prev.filter(e => e.id !== id));
  };

  const grouped = useMemo(() => {
    const map: Record<string, Emolumento[]> = {};
    for (const em of list) {
      if (!map[em.tipo]) map[em.tipo] = [];
      map[em.tipo].push(em);
    }
    return map;
  }, [list]);

  const inputCls = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">Emolumentos criados por esta instituição (editáveis)</p>
        <button onClick={() => { setShowForm(s => !s); setFormErr(""); }}
          className="flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm shrink-0">
          <Plus className="w-3.5 h-3.5"/> {showForm ? "Cancelar" : "Adicionar"}
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-5">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Tipo <span className="text-red-500">*</span></label>
                    <select className={inputCls} value={form.tipo} onChange={e => {
                      const tipo = e.target.value;
                      setForm(f => ({ ...f, tipo, nome: (DESCRICAO_POR_TIPO_SCH[tipo] ?? [])[0] ?? "", nomeCustom: "" }));
                    }}>
                      {TIPO_GRUPOS_SCH.map(g => (
                        <optgroup key={g.grupo} label={g.grupo}>
                          {g.items.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Ano lectivo</label>
                    <input className={inputCls} value={form.ano_lectivo} onChange={e => setForm(f => ({ ...f, ano_lectivo: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Descrição <span className="text-red-500">*</span></label>
                    {form.tipo === "outro" ? (
                      <input className={inputCls} placeholder="Ex: Taxa de Passeio Anual" value={form.nomeCustom} onChange={e => setForm(f => ({ ...f, nomeCustom: e.target.value }))} />
                    ) : (DESCRICAO_POR_TIPO_SCH[form.tipo] ?? []).length > 0 ? (
                      <select className={inputCls} value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}>
                        {DESCRICAO_POR_TIPO_SCH[form.tipo].map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    ) : (
                      <input className={inputCls} placeholder="Descrição" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Montante (AOA) <span className="text-red-500">*</span></label>
                    <input type="number" min="0" className={inputCls} placeholder="ex: 35000" value={form.montante} onChange={e => setForm(f => ({ ...f, montante: e.target.value }))} />
                  </div>
                </div>
                {/* ─── Multa Config Panel ─── */}
                <div className="border border-slate-200 rounded-xl p-3.5 bg-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-700">Configuração de Multa</p>
                      <p className="text-xs text-slate-400 mt-0.5">Penalização por atraso de pagamento</p>
                    </div>
                    <button type="button" onClick={() => setForm(f => ({ ...f, multa_ativo: !f.multa_ativo }))}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${form.multa_ativo ? "bg-emerald-500" : "bg-slate-300"}`}>
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${form.multa_ativo ? "translate-x-4" : "translate-x-1"}`}/>
                    </button>
                  </div>
                  {form.multa_ativo && (
                    <div className="space-y-3 pt-3 mt-3 border-t border-slate-100">
                      <div>
                        <p className="text-xs font-medium text-slate-600 mb-1.5">Tipo de multa</p>
                        <div className="flex gap-2">
                          {(["fixo", "percentual"] as const).map(t => (
                            <button key={t} type="button" onClick={() => setForm(f => ({ ...f, multa_tipo: t }))}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${form.multa_tipo === t ? "bg-primary text-white border-primary" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
                              {t === "fixo" ? "Valor Fixo" : "Percentual"}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {form.multa_tipo === "fixo" ? (
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1.5">Valor fixo (AOA)</label>
                            <input type="number" min="0" className={inputCls} placeholder="ex: 5000" value={form.multa_valor_fixo} onChange={e => setForm(f => ({ ...f, multa_valor_fixo: e.target.value }))} />
                          </div>
                        ) : (
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1.5">Percentagem (%)</label>
                            <input type="number" min="0" max="100" step="0.1" className={inputCls} placeholder="ex: 5" value={form.multa_percentagem} onChange={e => setForm(f => ({ ...f, multa_percentagem: e.target.value }))} />
                          </div>
                        )}
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1.5">Juros de mora (% / dia)</label>
                          <input type="number" min="0" step="0.01" className={inputCls} placeholder="ex: 0.1" value={form.juros_mora} onChange={e => setForm(f => ({ ...f, juros_mora: e.target.value }))} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1.5">Dias de carência</label>
                          <input type="number" min="0" className={inputCls} placeholder="ex: 5" value={form.dias_carencia} onChange={e => setForm(f => ({ ...f, dias_carencia: e.target.value }))} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {formErr && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{formErr}</p>}
                <div className="flex gap-3">
                  <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors">
                    {saving ? <><RefreshCw className="w-4 h-4 animate-spin"/>A guardar…</> : <><Plus className="w-4 h-4"/>Criar</>}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400"><RefreshCw className="w-4 h-4 animate-spin mr-2"/>A carregar…</div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-slate-400 gap-3">
          <Receipt className="w-8 h-8 opacity-30"/>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-500">Nenhum emolumento local</p>
            <p className="text-xs text-slate-400 mt-1">Adicione os seus próprios emolumentos específicos</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([tipo, items]) => (
            <div key={tipo} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className={`flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 ${(TIPO_COLOR_SCH[tipo] ?? "bg-slate-50 text-slate-700 border-slate-200").split(" ")[0]}/20`}>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${TIPO_COLOR_SCH[tipo] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>{tipoLabelSch(tipo)}</span>
                <span className="text-xs text-slate-400 ml-auto">{items.length} item{items.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="divide-y divide-slate-100">
                {items.map(em => (
                  <div key={em.id} className={`transition-opacity ${em.activo ? "" : "opacity-50"}`}>
                    {editId === em.id ? (
                      <div className="px-4 py-4 space-y-3 bg-slate-50/70">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Descrição</label>
                            <input className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white" value={editForm.nome} onChange={e => setEditForm(f => ({ ...f, nome: e.target.value }))} />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Montante (AOA)</label>
                            <input type="number" min="0" className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white" value={editForm.montante} onChange={e => setEditForm(f => ({ ...f, montante: e.target.value }))} />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Ano lectivo</label>
                            <input className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white" value={editForm.ano_lectivo} onChange={e => setEditForm(f => ({ ...f, ano_lectivo: e.target.value }))} />
                          </div>
                        </div>
                        {/* Edit multa panel */}
                        <div className="border border-slate-200 rounded-xl p-3 bg-white">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-slate-700">Configuração de Multa</p>
                            <button type="button" onClick={() => setEditForm(f => ({ ...f, multa_ativo: !f.multa_ativo }))}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${editForm.multa_ativo ? "bg-emerald-500" : "bg-slate-300"}`}>
                              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${editForm.multa_ativo ? "translate-x-4" : "translate-x-1"}`}/>
                            </button>
                          </div>
                          {editForm.multa_ativo && (
                            <div className="space-y-3 pt-3 mt-2 border-t border-slate-100">
                              <div className="flex gap-2">
                                {(["fixo", "percentual"] as const).map(t => (
                                  <button key={t} type="button" onClick={() => setEditForm(f => ({ ...f, multa_tipo: t }))}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${editForm.multa_tipo === t ? "bg-primary text-white border-primary" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
                                    {t === "fixo" ? "Valor Fixo" : "Percentual"}
                                  </button>
                                ))}
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {editForm.multa_tipo === "fixo" ? (
                                  <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Valor fixo (AOA)</label>
                                    <input type="number" min="0" className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white" placeholder="ex: 5000" value={editForm.multa_valor_fixo} onChange={e => setEditForm(f => ({ ...f, multa_valor_fixo: e.target.value }))} />
                                  </div>
                                ) : (
                                  <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Percentagem (%)</label>
                                    <input type="number" min="0" max="100" step="0.1" className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white" placeholder="ex: 5" value={editForm.multa_percentagem} onChange={e => setEditForm(f => ({ ...f, multa_percentagem: e.target.value }))} />
                                  </div>
                                )}
                                <div>
                                  <label className="block text-xs font-medium text-slate-500 mb-1">Juros de mora (% / dia)</label>
                                  <input type="number" min="0" step="0.01" className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white" placeholder="ex: 0.1" value={editForm.juros_mora} onChange={e => setEditForm(f => ({ ...f, juros_mora: e.target.value }))} />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-slate-500 mb-1">Dias de carência</label>
                                  <input type="number" min="0" className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white" placeholder="ex: 5" value={editForm.dias_carencia} onChange={e => setEditForm(f => ({ ...f, dias_carencia: e.target.value }))} />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button onClick={() => saveEdit(em.id)} disabled={saving} className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors">
                            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin"/> : <Save className="w-3.5 h-3.5"/>} Guardar
                          </button>
                          <button onClick={() => setEditId(null)} className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-100 transition-colors">Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <div className="px-4 py-3 flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{em.nome}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-xs text-slate-400">{em.ano_lectivo}</span>
                            {em.multa_ativo && (
                              <span className="text-xs bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded-full">
                                {em.multa_tipo === "fixo"
                                  ? `Multa ${Number(em.multa_valor_fixo ?? 0).toLocaleString("pt-AO")} Kz`
                                  : `Multa ${em.multa_percentagem}%`}
                                {Number(em.juros_mora) > 0 && ` + ${em.juros_mora}%/dia`}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-sm font-bold text-slate-900 tabular-nums shrink-0">{Number(em.montante).toLocaleString("pt-AO")} Kz</p>
                        <button onClick={() => toggleActivo(em)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${em.activo ? "bg-emerald-500" : "bg-slate-300"}`}
                          title={em.activo ? "Desactivar" : "Activar"}>
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${em.activo ? "translate-x-4" : "translate-x-1"}`}/>
                        </button>
                        <button onClick={() => { setEditId(em.id); setEditForm({ nome: em.nome, montante: String(em.montante), ano_lectivo: em.ano_lectivo, multa_ativo: !!em.multa_ativo, multa_tipo: em.multa_tipo || "fixo", multa_valor_fixo: em.multa_valor_fixo != null ? String(em.multa_valor_fixo) : "", multa_percentagem: em.multa_percentagem != null ? String(em.multa_percentagem) : "", juros_mora: em.juros_mora != null ? String(em.juros_mora) : "", dias_carencia: String(em.dias_carencia ?? 0) }); }}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors" title="Editar"><Pencil className="w-3.5 h-3.5"/></button>
                        <button onClick={() => handleDelete(em.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors" title="Eliminar"><Trash2 className="w-3.5 h-3.5"/></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
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
                        {em.multa_ativo && (
                          <span className="text-xs bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded-full">
                            {em.multa_tipo === "fixo"
                              ? `Multa ${Number(em.multa_valor_fixo ?? 0).toLocaleString("pt-AO")} Kz`
                              : `Multa ${em.multa_percentagem}%`}
                            {Number(em.juros_mora) > 0 && ` + ${em.juros_mora}%/dia`}
                            {Number(em.dias_carencia) > 0 && ` (carência ${em.dias_carencia}d)`}
                          </span>
                        )}
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

/* ─── Main EmolumentosView: sub-tabs ─── */
function EmolumentosView({ token }: { token: string }) {
  const [activeTab, setActiveTab] = useState<"globais" | "locais" | "pacotes">("globais");

  const tabs = [
    { key: "globais" as const, label: "Globais", icon: <Globe className="w-4 h-4"/> },
    { key: "locais" as const, label: "Locais", icon: <Receipt className="w-4 h-4"/> },
    { key: "pacotes" as const, label: "Pacotes", icon: <Package className="w-4 h-4"/> },
  ];

  return (
    <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex-1 p-4 md:p-6 max-w-4xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Receipt className="w-5 h-5 text-primary"/> Emolumentos & Pacotes
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Gestão de taxas, serviços e pacotes de cobrança</p>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 mb-6 w-fit">
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
      </AnimatePresence>
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
  useEffect(() => {
    if (!token) return;
    fetch(`${API}/school/direct-debit/subscriptions`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((rows: DDSub[]) => setDdPendingCount(rows.filter(r => r.status === "cancellation_requested").length))
      .catch(() => {});
  }, [token]);

  const NAV: { key: DashView; icon: React.ReactNode; label: string; badge?: number }[] = [
    { key: "inicio", icon: <LayoutDashboard className="w-5 h-5"/>, label: "Início" },
    { key: "alunos", icon: <Users className="w-5 h-5"/>, label: "Alunos & Turmas" },
    { key: "propinas", icon: <FileText className="w-5 h-5"/>, label: "Propinas & Faturas" },
    { key: "reconciliacao", icon: <ShieldCheck className="w-5 h-5"/>, label: "Reconciliação" },
    { key: "ocorrencias", icon: <AlertTriangle className="w-5 h-5"/>, label: "Ocorrências" },
    { key: "comunicar", icon: <Megaphone className="w-5 h-5"/>, label: "Comunicar" },
    { key: "debito_direto", icon: <CreditCard className="w-5 h-5"/>, label: "Débito Direto", badge: ddPendingCount },
    { key: "emolumentos", icon: <Receipt className="w-5 h-5"/>, label: "Emolumentos" },
  ];

  const SidebarContent = ({ onNav }: { onNav?: () => void }) => (
    <>
      <nav className="flex-1 px-4 py-6 space-y-1">
        {NAV.map(item => (
          <button key={item.key} onClick={() => { setView(item.key); onNav?.(); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-sm ${view===item.key?"bg-primary/10 text-primary font-medium":"hover:bg-slate-800 text-slate-400 hover:text-slate-200"}`}>
            {item.icon}
            <span className="flex-1 text-left">{item.label}</span>
            {item.badge && item.badge > 0 ? <span className="ml-auto px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold leading-none">{item.badge}</span> : null}
          </button>
        ))}
        <div className="border-t border-slate-800 mt-2 pt-2">
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 transition-colors text-sm text-slate-400 hover:text-slate-200">
            <BarChart3 className="w-5 h-5"/> Relatórios
          </a>
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
              {NAV.find(n => n.key === view)?.label ?? view}
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
                <ComunicarView token={token}/>
              </motion.div>
            )}
            {view === "debito_direto" && (
              <DDCancelamentosView key="debito_direto" token={token}/>
            )}
            {view === "emolumentos" && token && (
              <EmolumentosView key="emolumentos" token={token}/>
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
          <Modal key="m-lote" title="Gerar Propinas em Lote" onClose={() => setModal(null)}>
            <ModalGerarLote token={token} onClose={() => setModal(null)} onCreated={loadAll}/>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}
