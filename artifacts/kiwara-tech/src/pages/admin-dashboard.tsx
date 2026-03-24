import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, LayoutDashboard, Building2, LogOut, Plus, Trash2, ChevronRight,
  Upload, Landmark, Receipt, Users, GraduationCap, RefreshCw, CheckCircle2,
  AlertCircle, X, Download, TrendingUp, Banknote, School, FileSpreadsheet,
  Eye, EyeOff, Search, ArrowLeft, Menu, Calendar, Pencil, MoreHorizontal,
  FileText, Clock, CreditCard, History, Slash, BadgePercent,
} from "lucide-react";

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
  total_alunos: number; total_turmas: number;
}
interface ColegioDetail extends Colegio {
  turmas: { id: number; nome: string; ano: string; turno: string }[];
  emolumentos: Emolumento[];
  multa_regra: MultaRegra | null;
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setSaving(true);
    try {
      const res = await api("/admin/colegios", {
        method: "POST", body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao criar colégio.");
      onCreated({ ...data, total_alunos: 0, total_turmas: 0 });
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

/* ─── CSV Upload Panel ─── */
function UploadAlunosPanel({ schoolId, anoLectivo }: { schoolId: number; anoLectivo: string }) {
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ inserted: number; skipped: number; errors: string[] } | null>(null);
  const [error, setError] = useState("");
  const [ano, setAno] = useState(anoLectivo);
  const inputRef = useRef<HTMLInputElement>(null);

  const CSV_HEADERS = ["nome", "bilhete", "numero_processo", "data_nascimento", "sexo", "turma_nome", "turno", "nome_encarregado", "telefone_encarregado"];

  function parseCSV(text: string) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/[^a-z_]/g, ""));
    return lines.slice(1).map(line => {
      const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { if (vals[i]) obj[h] = vals[i]; });
      return obj;
    }).filter(r => r.nome);
  }

  function handleFile(file: File) {
    if (!file.name.endsWith(".csv")) { setError("Apenas ficheiros CSV são suportados."); return; }
    setFileName(file.name);
    setError(""); setResult(null);
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const rows = parseCSV(text);
      setPreview(rows);
    };
    reader.readAsText(file, "UTF-8");
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const doUpload = async () => {
    if (!preview.length) return;
    setUploading(true); setResult(null); setError("");
    try {
      const res = await api(`/admin/colegios/${schoolId}/alunos/upload`, {
        method: "POST",
        body: JSON.stringify({ alunos: preview, ano_lectivo: ano }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro no carregamento.");
      setResult(data);
      setPreview([]); setFileName("");
    } catch (err: any) { setError(err.message); }
    finally { setUploading(false); }
  };

  const downloadTemplate = () => {
    const header = CSV_HEADERS.join(",");
    const example = "João Manuel Silva,009874321LA041,PROC-2025-001,2009-05-15,M,10ª Classe A,Manhã,António Silva,924000001";
    const blob = new Blob([header + "\n" + example], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "modelo_alunos.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Ano lectivo */}
      <div className="flex items-center gap-4">
        <Field label="Ano lectivo de importação">
          <input className={`${inputCls} w-36`} value={ano} onChange={e => setAno(e.target.value)} placeholder="2025/2026" />
        </Field>
        <button onClick={downloadTemplate}
          className="mt-5 flex items-center gap-2 text-sm text-primary hover:text-primary/70 font-medium">
          <Download className="w-4 h-4" /> Descarregar modelo CSV
        </button>
      </div>

      {/* Drop zone */}
      {!preview.length && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${dragging ? "border-primary bg-primary/5" : "border-slate-200 hover:border-slate-300 bg-slate-50"}`}
        >
          <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-medium text-slate-600">Arraste o ficheiro CSV aqui</p>
          <p className="text-sm text-slate-400 mt-1">ou clique para seleccionar</p>
          <input ref={inputRef} type="file" accept=".csv" className="hidden"
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
        </div>
      )}

      {/* Preview */}
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
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase">
                <tr>
                  {["Nome", "Bilhete", "Turma", "Sexo", "Encarregado"].map(h => (
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
                    <td className="px-3 py-1.5 text-slate-500">{r.sexo || "—"}</td>
                    <td className="px-3 py-1.5 text-slate-500">{r.nome_encarregado || "—"}</td>
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

      {result && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span className="font-semibold text-emerald-800">Importação concluída</span>
          </div>
          <p className="text-sm text-emerald-700">{result.inserted} alunos adicionados, {result.skipped} ignorados.</p>
          {result.errors.length > 0 && (
            <div className="mt-2 text-xs text-red-600">
              {result.errors.slice(0, 5).map((e, i) => <p key={i}>• {e}</p>)}
            </div>
          )}
        </div>
      )}

      {preview.length > 0 && (
        <button onClick={doUpload} disabled={uploading}
          className="w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
          {uploading ? <><RefreshCw className="w-4 h-4 animate-spin" />A importar...</> : <><Upload className="w-4 h-4" />Importar {preview.length} alunos</>}
        </button>
      )}
    </div>
  );
}

/* ─── Emolumento tipo helpers ─── */
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

function MultaRegrasPanel({ schoolId, initial }: { schoolId: number; initial: MultaRegra | null }) {
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
function EmolumentosPanel({ schoolId, initial, multaRegra }: {
  schoolId: number; initial: Emolumento[]; multaRegra: MultaRegra | null;
}) {
  const [list, setList] = useState<Emolumento[]>(initial);
  const [form, setForm] = useState({ tipo: "propina", nome: "", montante: "", ano_lectivo: "2025/2026" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setSaving(true);
    try {
      const res = await api(`/admin/colegios/${schoolId}/emolumentos`, {
        method: "POST", body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro.");
      setList(l => [data, ...l]);
      setForm(f => ({ ...f, nome: "", montante: "" }));
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const deleteEm = async (id: number) => {
    if (!confirm("Eliminar este emolumento?")) return;
    await api(`/admin/emolumentos/${id}`, { method: "DELETE" });
    setList(l => l.filter(x => x.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Add form */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
        <h4 className="font-semibold text-slate-700 mb-4">Adicionar emolumento</h4>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Tipo de emolumento" required>
              <select className={selectCls} value={form.tipo}
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
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
              <input className={inputCls} placeholder="ex: Propina Mensal — 10ª Classe" value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required />
            </Field>
            <Field label="Montante (AOA)" required>
              <input type="number" min="0" className={inputCls} placeholder="35000" value={form.montante}
                onChange={e => setForm(f => ({ ...f, montante: e.target.value }))} required />
            </Field>
          </div>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>}
          <button type="submit" disabled={saving}
            className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-2">
            {saving ? <><RefreshCw className="w-4 h-4 animate-spin" />A guardar...</> : <><Plus className="w-4 h-4" />Adicionar</>}
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

      {/* Regras de multa */}
      <MultaRegrasPanel schoolId={schoolId} initial={multaRegra} />
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

/* ─── School Detail View ─── */
function ColegioDetail({ school, onBack }: { school: ColegioDetail; onBack: () => void }) {
  const [tab, setTab] = useState<"geral" | "alunos" | "emolumentos" | "propinas" | "iban">("geral");
  const [currentSchool, setCurrentSchool] = useState(school);
  const TABS = [
    { id: "geral" as const, label: "Visão Geral", icon: <Building2 className="w-4 h-4" /> },
    { id: "alunos" as const, label: "Carregar Alunos", icon: <Upload className="w-4 h-4" /> },
    { id: "emolumentos" as const, label: "Emolumentos", icon: <Receipt className="w-4 h-4" /> },
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
      )}
      {tab === "alunos" && (
        <div className="bg-white border border-slate-100 rounded-2xl p-6">
          <h3 className="font-semibold text-slate-900 mb-1">Importar base de dados de alunos</h3>
          <p className="text-sm text-slate-500 mb-5">Carregue um ficheiro CSV com os dados dos alunos. Turmas inexistentes serão criadas automaticamente.</p>
          <UploadAlunosPanel schoolId={currentSchool.id} anoLectivo="2025/2026" />
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
