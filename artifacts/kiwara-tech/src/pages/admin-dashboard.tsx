import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, LayoutDashboard, Building2, LogOut, Plus, Trash2, ChevronRight,
  Upload, Landmark, Receipt, Users, GraduationCap, RefreshCw, CheckCircle2,
  AlertCircle, X, Download, TrendingUp, Banknote, School, FileSpreadsheet,
  Eye, EyeOff, Search, ArrowLeft, Menu, Calendar, Pencil, MoreHorizontal,
  FileText, Clock, CreditCard, History, Slash, BadgePercent, TableProperties, UserPlus,
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
interface Colegio {
  id: number; school_id: string; name: string; nif?: string; phone?: string;
  email: string; iban?: string; created_at: string;
  total_alunos: number; total_turmas: number; usa_pacotes: boolean;
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

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className={labelCls}>{label}{required && <span className="text-red-400 ml-0.5">*</span>}</label>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.18 }}
        className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? "max-w-2xl" : "max-w-lg"} max-h-[90vh] overflow-y-auto`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10 rounded-t-2xl">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        {children}
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
function ModalCriarColegio({ onClose, onCreated }: { onClose: () => void; onCreated: (c: Colegio) => void }) {
  const [form, setForm] = useState({
    name: "", nif: "", phone: "", email: "", password: "", iban: "",
  });
  const [usaPacotes, setUsaPacotes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setSaving(true);
    try {
      const res = await api("/admin/colegios", {
        method: "POST", body: JSON.stringify({ ...form, usa_pacotes: usaPacotes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao criar colégio.");
      onCreated({ ...data, total_alunos: 0, total_turmas: 0, usa_pacotes: !!data.usa_pacotes });
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <Modal title="Criar Colégio" onClose={onClose}>
      <form onSubmit={submit} className="p-6 space-y-4">
        <Field label="Nome do colégio" required>
          <input className={inputCls} placeholder="ex: Colégio Nossa Senhora de Fátima" value={form.name} onChange={f("name")} required />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="NIF">
            <input className={inputCls} placeholder="NIF da escola" value={form.nif} onChange={f("nif")} />
          </Field>
          <Field label="Telefone">
            <input className={inputCls} placeholder="9xx xxx xxx" value={form.phone} onChange={f("phone")} />
          </Field>
        </div>
        <Field label="Email" required>
          <input type="email" className={inputCls} placeholder="secretaria@colegio.ao" value={form.email} onChange={f("email")} required />
        </Field>
        <Field label="Palavra-passe inicial">
          <div className="relative">
            <input type={showPass ? "text" : "password"} className={`${inputCls} pr-10`}
              placeholder="Kiwara@2025 (padrão)" value={form.password} onChange={f("password")} />
            <button type="button" onClick={() => setShowPass(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </Field>
        <Field label="IBAN (opcional)">
          <input className={inputCls} placeholder="AO06004400006729503010102" value={form.iban} onChange={f("iban")} />
        </Field>
        {/* Pacotes toggle */}
        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl">
          <button type="button" onClick={() => setUsaPacotes(v => !v)}
            className={`relative shrink-0 w-10 h-5.5 rounded-full transition-colors mt-0.5 ${usaPacotes ? "bg-primary" : "bg-slate-300"}`}
            style={{ height: 22, width: 40 }}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${usaPacotes ? "translate-x-[18px]" : "translate-x-0.5"}`} />
          </button>
          <div>
            <p className="text-sm font-semibold text-slate-800">Pacotes de emolumentos</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Permite agrupar emolumentos (ex: Mensalidade + Transporte + ATL) num pacote com valor fixo por aluno. Configurável após criar o colégio.
            </p>
          </div>
        </div>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <><RefreshCw className="w-4 h-4 animate-spin" />A criar...</> : "Criar Colégio"}
          </button>
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

/* ─── School Detail View ─── */
function ColegioDetail({ school, onBack }: { school: ColegioDetail; onBack: () => void }) {
  const [tab, setTab] = useState<"geral" | "alunos" | "emolumentos" | "propinas" | "pacotes" | "iban">("geral");
  const [alunoSubTab, setAlunoSubTab] = useState<"individual" | "massa">("individual");
  const [currentSchool, setCurrentSchool] = useState(school);
  const [togglingPacotes, setTogglingPacotes] = useState(false);

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
    { id: "iban" as const, label: "IBAN", icon: <Landmark className="w-4 h-4" /> },
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
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === "geral" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              { label: "Nome", value: currentSchool.name },
              { label: "NIF", value: currentSchool.nif || "—" },
              { label: "Telefone", value: currentSchool.phone || "—" },
              { label: "Email", value: currentSchool.email },
              { label: "IBAN", value: currentSchool.iban || "Não definido" },
              { label: "Escola ID", value: currentSchool.school_id },
              { label: "Turmas", value: String(currentSchool.total_turmas) },
              { label: "Alunos", value: String(currentSchool.total_alunos) },
            ].map(item => (
              <div key={item.label} className="bg-white border border-slate-100 rounded-xl p-4">
                <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider mb-1">{item.label}</p>
                <p className="font-medium text-slate-900 font-mono text-sm">{item.value}</p>
              </div>
            ))}
            {currentSchool.turmas.length > 0 && (
              <div className="md:col-span-2 bg-white border border-slate-100 rounded-xl p-4">
                <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider mb-3">Turmas registadas</p>
                <div className="flex flex-wrap gap-2">
                  {currentSchool.turmas.map(t => (
                    <span key={t.id} className="text-sm bg-slate-100 text-slate-700 px-3 py-1 rounded-lg">
                      {t.nome} <span className="text-slate-400">({t.turno})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* Pacotes toggle */}
          <div className="bg-white border border-slate-100 rounded-xl p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-slate-800">Pacotes de emolumentos</p>
                <p className="text-sm text-slate-500 mt-0.5">
                  Permite agrupar serviços (mensalidade, transporte, ATL…) num pacote com valor fixo por aluno.
                  {currentSchool.usa_pacotes && " A aba «Pacotes» fica disponível para configurar os pacotes."}
                </p>
              </div>
              <button onClick={toggleUsaPacotes} disabled={togglingPacotes}
                className={`relative shrink-0 rounded-full transition-colors disabled:opacity-60 ${currentSchool.usa_pacotes ? "bg-primary" : "bg-slate-300"}`}
                style={{ height: 24, width: 44 }}>
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${currentSchool.usa_pacotes ? "translate-x-[20px]" : "translate-x-0.5"}`} />
              </button>
            </div>
          </div>
        </div>
      )}
      {tab === "alunos" && (
        <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
          {/* Sub-tab bar */}
          <div className="flex border-b border-slate-100">
            <button
              onClick={() => setAlunoSubTab("individual")}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${alunoSubTab === "individual" ? "border-primary text-primary bg-primary/5" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
              <UserPlus className="w-4 h-4" /> Adicionar Aluno
            </button>
            <button
              onClick={() => setAlunoSubTab("massa")}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${alunoSubTab === "massa" ? "border-primary text-primary bg-primary/5" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
              <Upload className="w-4 h-4" /> Importar em Massa
            </button>
          </div>

          <div className="p-6">
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

/* ─── Main Dashboard ─── */
type AdminView = "stats" | "colegios";

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
          {/* Menu toggle */}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors shrink-0"
            aria-label="Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Branding */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <div className="hidden sm:block">
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

      {/* ── Sidebar Drawer ── */}
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
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            />

            {/* Drawer */}
            <motion.aside
              key="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.22, ease: "easeInOut" }}
              className="fixed top-0 left-0 z-50 h-full w-72 bg-slate-900 text-white flex flex-col shadow-2xl"
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
      <main className="w-full">
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
          </>
        )}
      </main>
    </div>
  );
}
