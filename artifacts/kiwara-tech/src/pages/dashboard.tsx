import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, FileText, Settings, LogOut,
  Bell, Search, Plus, TrendingUp, AlertCircle, CheckCircle2,
  Clock, BarChart3, GraduationCap, Banknote, Share2, Copy,
  AlertTriangle, RefreshCw, Trash2, Calendar, BookOpen, X,
  ChevronDown, User, School, CreditCard, MoreHorizontal, History,
  UserPlus, FileSpreadsheet, Download, Upload,
  ArrowLeftRight, ShieldCheck, Receipt, Landmark, Filter,
} from "lucide-react";
import { Button, Card } from "@/components/ui-elements";
import { useAuth } from "@/lib/auth";
import { StudentRegistrationForm } from "@/components/student-form";

const API = "/api";
const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const TURNOS = ["Manhã","Tarde","Noite"];

/* ─── Interfaces ─── */
interface Turma { id: number; nome: string; ano: string; turno: string; total_alunos: number; }
interface Pacote { id: number; nome: string; valor: number; activo: boolean; }
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
}
interface GeneratedRef { entidade: string; referencia: string; valor: number; validade: string; }

type DashView = "inicio" | "alunos" | "propinas" | "ocorrencias" | "reconciliacao";

interface RecPropina {
  id: number; student_id: number; aluno_nome: string; turma: string;
  mes: string; ano: string; montante: number; multa: number; status: string;
  internal_reference?: string; data_vencimento: string; pago_em?: string;
  total_fatura: number; split_escola: number; split_plataforma: number;
  ref_multicaixa?: string; entidade?: string;
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
  const [modo, setModo] = useState<"unico"|"intervalo">("unico");
  const [mesInicio, setMesInicio] = useState(MESES[new Date().getMonth()]);
  const [anoInicio, setAnoInicio] = useState(anoAtual);
  const [mesFim, setMesFim] = useState(MESES[new Date().getMonth()]);
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
        <div className="space-y-3">
          {[
            { label: "Entidade", value: result.entidade },
            { label: "Referência", value: result.referencia },
            { label: "Valor Total", value: fmt(result.valor) },
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
              <h4 className="font-bold text-slate-900 mb-1">Portal do Encarregado</h4>
              <p className="text-sm text-slate-500 mb-3">Partilhe este link com os encarregados.</p>
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

function AlunosView({ token, alunos, turmas, pacotes, onOpenAdicionarAluno, onOpenCriarTurma, onDeleteAluno, onDeleteTurma, onRefresh }: {
  token: string | null; alunos: Aluno[]; turmas: Turma[]; pacotes: Pacote[];
  onOpenAdicionarAluno: () => void; onOpenCriarTurma: () => void;
  onDeleteAluno: (id: number) => void; onDeleteTurma: (id: number) => void;
  onRefresh: () => void;
}) {
  const [tab, setTab] = useState<"alunos"|"turmas"|"registar">("alunos");
  const [regTab, setRegTab] = useState<"manual"|"csv">("manual");
  const [search, setSearch] = useState("");
  const [soMultas, setSoMultas] = useState(false);
  const [assigningPacote, setAssigningPacote] = useState<number | null>(null);

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div><h2 className="text-2xl font-bold text-slate-900">Alunos & Turmas</h2></div>
        {tab !== "registar" && (
          <div className="flex gap-2">
            <Button variant="outline" className="bg-white gap-2" onClick={onOpenCriarTurma}><School className="w-4 h-4"/> Criar Turma</Button>
            <Button className="gap-2" onClick={onOpenAdicionarAluno}><Plus className="w-4 h-4"/> Adicionar Aluno</Button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2 mb-5 items-center">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {(["alunos","turmas","registar"] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setSoMultas(false); }}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab===t && !soMultas ?"bg-white text-slate-900 shadow-sm":"text-slate-500 hover:text-slate-700"}`}>
              {t === "alunos" ? `Alunos (${alunos.length})` : t === "turmas" ? `Turmas (${turmas.length})` : "Adicionar Alunos"}
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
      {tab !== "registar" && (
        <div className="relative mb-5">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={tab==="alunos"?"Pesquisar aluno...":"Pesquisar turma..."}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"/>
        </div>
      )}

      {tab === "alunos" ? (
        filteredAlunos.length === 0 ? (
          <Card className="p-12 text-center"><Users className="w-12 h-12 text-slate-200 mx-auto mb-3"/><p className="font-semibold text-slate-500">Sem alunos encontrados</p><Button className="mt-4" onClick={onOpenAdicionarAluno}><Plus className="w-4 h-4 mr-2"/> Adicionar Aluno</Button></Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            <table className="w-full text-left text-sm">
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
                          <span className="text-xs text-slate-400 italic">Sem pacotes definidos</span>
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
                        <button onClick={() => { if(confirm(`Eliminar ${a.nome}?`)) onDeleteAluno(a.id); }}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4"/>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )
      ) : (
        filteredTurmas.length === 0 ? (
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
        )
      )}

      {/* ── Adicionar Alunos tab ── */}
      {tab === "registar" && (
        <div className="max-w-3xl">
          <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
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
      )}
    </div>
  );
}

const AJUSTE_TIPO_LABELS: Record<string, string> = {
  perdao: "❌ Perdão de multa",
  ajuste_valor: "✏️ Ajuste de valor",
  reagendamento: "📅 Reagendamento",
  justificacao: "📊 Justificação",
};

interface PropAjusteS {
  id: number; propina_id: number; tipo: string;
  multa_anterior: number; multa_nova: number | null;
  valor_anterior: number; valor_novo: number | null;
  nova_data_vencimento: string | null; motivo: string; created_by: string; created_at: string;
}

function ModalAjusteSchool({ propina, token, onClose, onDone }: {
  propina: Propina; token: string | null; onClose: () => void; onDone: (updated: Propina) => void;
}) {
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const [tipo, setTipo] = useState<"perdao"|"ajuste_valor"|"reagendamento"|"justificacao">("perdao");
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

function PropinasView({ token, propinas: initialPropinas, alunos, onOpenGerarPropina, onOpenGerarRef, onOpenGerarLote }: {
  token: string | null; propinas: Propina[]; alunos: Aluno[];
  onOpenGerarPropina: () => void; onOpenGerarRef: () => void; onOpenGerarLote: () => void;
}) {
  const [propinas, setPropinas] = useState<Propina[]>(initialPropinas);
  const [filterStatus, setFilterStatus] = useState<"todos"|"pendente"|"vencido"|"pago">("todos");
  const [filterAluno, setFilterAluno] = useState("");
  const [ajuste, setAjuste] = useState<Propina | null>(null);
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const filtered = propinas
    .filter(p => filterStatus === "todos" || p.status === filterStatus)
    .filter(p => !filterAluno || String(p.student_id) === filterAluno);

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
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {[{k:"todos",l:"Todas"},{k:"pendente",l:"Pendentes"},{k:"vencido",l:"Vencidas"},{k:"pago",l:"Pagas"}].map(({k,l}) => (
            <button key={k} onClick={() => setFilterStatus(k as any)}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${filterStatus===k?"bg-white text-slate-900 shadow-sm":"text-slate-500 hover:text-slate-700"}`}>{l}</button>
          ))}
        </div>
        <select className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
          value={filterAluno} onChange={e => setFilterAluno(e.target.value)}>
          <option value="">Todos os alunos</option>
          {alunos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
        </select>
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
                    {p.status === "pago"
                      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle2 className="w-3 h-3"/> Pago</span>
                      : p.status === "vencido"
                      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200"><AlertCircle className="w-3 h-3"/> Vencido</span>
                      : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200"><Clock className="w-3 h-3"/> Pendente</span>
                    }
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-500">{p.ref_numero ? `${p.entidade} / ${p.ref_numero}` : "—"}</td>
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
                                  {AJUSTE_TIPO_LABELS[t]}
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
        </Card>
      )}

      {ajuste && (
        <ModalAjusteSchool
          propina={ajuste} token={token}
          onClose={() => setAjuste(null)}
          onDone={updated => {
            setPropinas(prev => prev.map(pp => pp.id === updated.id ? updated : pp));
            setAjuste(null);
          }}
        />
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
  const [recModal, setRecModal] = useState<{ ref: string; total: number } | null>(null);
  const [recValor, setRecValor] = useState("");
  const [recMetodo, setRecMetodo] = useState("EMIS");
  const [recResult, setRecResult] = useState<any>(null);
  const [recError, setRecError] = useState("");
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

  const handleReconciliar = async () => {
    if (!recModal || !recValor) return;
    setReconciling(true); setRecError(""); setRecResult(null);
    try {
      const r = await fetch(`${API}/admin/reconciliacao/reconciliar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          internal_reference: recModal.ref,
          valor_pago: Number(recValor.replace(/\D/g, "")),
          metodo: recMetodo,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setRecError(d.error ?? "Erro na reconciliação."); return; }
      setRecResult(d);
      load();
    } catch { setRecError("Erro de ligação."); }
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
                        {p.status !== "pago" && p.internal_reference && (
                          <button onClick={() => { setRecModal({ ref: p.internal_reference!, total: p.total_fatura }); setRecValor(String(Math.round(p.total_fatura))); setRecResult(null); setRecError(""); }}
                            className="px-2.5 py-1.5 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap">
                            Reconciliar
                          </button>
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
            onClick={e => { if (e.target === e.currentTarget) { setRecModal(null); setRecResult(null); } }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
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
                    <p className="text-emerald-800 font-semibold flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/> Reconciliação efectuada com sucesso</p>
                    <p className="text-xs text-emerald-700 mt-2">Ref. interna: <span className="font-mono">{recResult.payment_ref}</span></p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                      <p className="text-blue-600 font-semibold uppercase tracking-wide mb-1">Colégio</p>
                      <p className="text-blue-900 font-bold text-lg">{fmt(recResult.split?.escola ?? 0)}</p>
                    </div>
                    <div className="bg-violet-50 border border-violet-100 rounded-xl p-3">
                      <p className="text-violet-600 font-semibold uppercase tracking-wide mb-1">Plataforma</p>
                      <p className="text-violet-900 font-bold text-lg">{fmt(recResult.split?.plataforma ?? 0)}</p>
                    </div>
                  </div>
                  <Button onClick={() => { setRecModal(null); setRecResult(null); }} className="w-full">Fechar</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Total da fatura</p>
                    <p className="text-2xl font-bold text-slate-900">{fmt(recModal.total)}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Método de pagamento</label>
                    <select value={recMetodo} onChange={e => setRecMetodo(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option>EMIS</option>
                      <option>Appy Pay</option>
                      <option>Transferência</option>
                      <option>Numerário</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Valor recebido (AOA)</label>
                    <input type="number" value={recValor} onChange={e => setRecValor(e.target.value)} min={1}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"/>
                  </div>
                  {recError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{recError}</p>}
                  <div className="flex gap-3 pt-2">
                    <Button variant="ghost" onClick={() => setRecModal(null)} className="flex-1">Cancelar</Button>
                    <Button onClick={handleReconciliar} disabled={reconciling} className="flex-1 gap-2">
                      {reconciling ? <RefreshCw className="w-4 h-4 animate-spin"/> : <ShieldCheck className="w-4 h-4"/>}
                      {reconciling ? "A processar…" : "Confirmar"}
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

export default function Dashboard() {
  const { session, token, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [view, setView] = useState<DashView>("inicio");

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

  const NAV: { key: DashView; icon: React.ReactNode; label: string }[] = [
    { key: "inicio", icon: <LayoutDashboard className="w-5 h-5"/>, label: "Início" },
    { key: "alunos", icon: <Users className="w-5 h-5"/>, label: "Alunos & Turmas" },
    { key: "propinas", icon: <FileText className="w-5 h-5"/>, label: "Propinas & Faturas" },
    { key: "reconciliacao", icon: <ShieldCheck className="w-5 h-5"/>, label: "Reconciliação" },
    { key: "ocorrencias", icon: <AlertTriangle className="w-5 h-5"/>, label: "Ocorrências" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="bg-slate-900 text-slate-300 w-64 flex-shrink-0 hidden md:flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center font-extrabold mr-3 text-sm">K</div>
          <span className="font-display font-bold text-white text-base">Kiwara Escolar</span>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1">
          {NAV.map(item => (
            <button key={item.key} onClick={() => setView(item.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-sm ${view===item.key?"bg-primary/10 text-primary font-medium":"hover:bg-slate-800 text-slate-400 hover:text-slate-200"}`}>
              {item.icon} {item.label}
            </button>
          ))}
          <div className="border-t border-slate-800 mt-2 pt-2">
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 transition-colors text-sm text-slate-400 hover:text-slate-200">
              <BarChart3 className="w-5 h-5"/> Relatórios
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 transition-colors text-sm text-slate-400 hover:text-slate-200">
              <Settings className="w-5 h-5"/> Configurações
            </a>
            <Link href="/encarregado" className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 transition-colors text-sm text-emerald-400 hover:text-emerald-300">
              <GraduationCap className="w-5 h-5"/> Portal Encarregado
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
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-10">
          <h1 className="font-semibold text-slate-900 capitalize">
            {NAV.find(n => n.key === view)?.label ?? view}
          </h1>
          <div className="flex items-center gap-4">
            <div className="relative hidden sm:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input type="text" placeholder="Pesquisar aluno..."
                className="pl-9 pr-4 py-2 bg-slate-100 border-transparent rounded-full text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all w-56"/>
            </div>
            <button className="relative p-2 text-slate-500 hover:text-slate-900"><Bell className="w-5 h-5"/></button>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center font-bold text-xs shadow-sm">{initials}</div>
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
                <PropinasView token={token} propinas={propinas} alunos={alunos}
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
