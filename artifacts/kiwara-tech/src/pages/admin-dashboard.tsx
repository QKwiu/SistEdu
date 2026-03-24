import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, LayoutDashboard, Building2, LogOut, Plus, Trash2, ChevronRight,
  Upload, Landmark, Receipt, Users, GraduationCap, RefreshCw, CheckCircle2,
  AlertCircle, X, Download, TrendingUp, Banknote, School, FileSpreadsheet,
  Eye, EyeOff, Search, ArrowLeft,
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
}
interface Emolumento {
  id: number; school_id: number; tipo: string; nome: string;
  montante: number; ano_lectivo: string;
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
    <div className="p-6 lg:p-8">
      <h2 className="text-2xl font-bold text-slate-900 mb-6">Visão Geral da Plataforma</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <div className={`w-11 h-11 rounded-xl ${c.bg} flex items-center justify-center mb-3`}>{c.icon}</div>
            <div className="text-2xl font-bold text-slate-900">{c.value}</div>
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

/* ─── Emolumentos Panel ─── */
function EmolumentosPanel({ schoolId, initial }: { schoolId: number; initial: Emolumento[] }) {
  const [list, setList] = useState<Emolumento[]>(initial);
  const [form, setForm] = useState({ tipo: "propina", nome: "", montante: "", ano_lectivo: "2025/2026" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const TIPOS = [
    { value: "matricula", label: "Matrícula" },
    { value: "propina", label: "Propina Mensal" },
    { value: "folha_prova", label: "Folha de Prova" },
    { value: "seguro", label: "Seguro Escolar" },
    { value: "exame", label: "Taxa de Exame" },
    { value: "outro", label: "Outro" },
  ];

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

  const tipoLabel = (t: string) => TIPOS.find(x => x.value === t)?.label ?? t;

  return (
    <div className="space-y-6">
      {/* Add form */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
        <h4 className="font-semibold text-slate-700 mb-4">Adicionar emolumento</h4>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tipo">
              <select className={selectCls} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Ano lectivo">
              <input className={inputCls} value={form.ano_lectivo} onChange={e => setForm(f => ({ ...f, ano_lectivo: e.target.value }))} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
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
        <div className="border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm text-left">
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
                      em.tipo === "matricula" ? "blue" : em.tipo === "propina" ? "green" :
                      em.tipo === "folha_prova" ? "amber" : "slate"
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
  const [tab, setTab] = useState<"geral" | "alunos" | "emolumentos" | "iban">("geral");
  const [currentSchool, setCurrentSchool] = useState(school);
  const TABS = [
    { id: "geral" as const, label: "Visão Geral", icon: <Building2 className="w-4 h-4" /> },
    { id: "alunos" as const, label: "Carregar Alunos", icon: <Upload className="w-4 h-4" /> },
    { id: "emolumentos" as const, label: "Emolumentos", icon: <Receipt className="w-4 h-4" /> },
    { id: "iban" as const, label: "IBAN", icon: <Landmark className="w-4 h-4" /> },
  ];

  return (
    <div className="p-6 lg:p-8 flex-1 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack}
          className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-slate-900">{currentSchool.name}</h2>
          <p className="text-sm text-slate-500">{currentSchool.email} · {currentSchool.school_id}</p>
        </div>
        <div className="flex gap-2">
          <span className="flex items-center gap-1.5 text-sm text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">
            <Users className="w-4 h-4" />{currentSchool.total_alunos} alunos
          </span>
          <span className="flex items-center gap-1.5 text-sm text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">
            <School className="w-4 h-4" />{currentSchool.total_turmas} turmas
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
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
        <div className="bg-white border border-slate-100 rounded-2xl p-6">
          <h3 className="font-semibold text-slate-900 mb-1">Emolumentos do colégio</h3>
          <p className="text-sm text-slate-500 mb-5">Defina os tipos e valores de propinas, matrículas e outros encargos.</p>
          <EmolumentosPanel schoolId={currentSchool.id} initial={currentSchool.emolumentos} />
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
    <div className="p-6 lg:p-8 flex-1 overflow-y-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <h2 className="text-2xl font-bold text-slate-900">Colégios ({colegios.length})</h2>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Criar Colégio
        </button>
      </div>

      <div className="relative mb-5">
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
        <div className="grid gap-4">
          {filtered.map(c => (
            <div key={c.id}
              className="bg-white border border-slate-100 rounded-2xl p-5 hover:border-slate-200 hover:shadow-sm transition-all flex items-center gap-5">
              <div className="w-12 h-12 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-slate-900 truncate">{c.name}</span>
                  {c.iban && <Badge text="IBAN" color="green" />}
                </div>
                <p className="text-sm text-slate-500 truncate">{c.email}</p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                  <span>{c.total_alunos} alunos</span>
                  <span>·</span>
                  <span>{c.total_turmas} turmas</span>
                  {c.nif && <><span>·</span><span>NIF: {c.nif}</span></>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => onSelect(c.id)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors">
                  <Eye className="w-4 h-4" /> Gerir
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
                <button onClick={() => del(c.id, c.name)}
                  className="p-2 rounded-xl hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
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

  // Auth check
  useEffect(() => {
    const token = getToken();
    if (!token) { setLocation("/admin"); return; }
    api("/admin/stats").then(r => {
      if (r.status === 401) { localStorage.removeItem(TOKEN_KEY); setLocation("/admin"); }
      else r.json().then(setStats);
    });
  }, []);

  // Load school detail when selected
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
    { id: "stats" as const, label: "Visão Geral", icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: "colegios" as const, label: "Colégios", icon: <Building2 className="w-4 h-4" /> },
  ];

  return (
    <div className="flex bg-slate-50">
      {/* Sidebar — sticky, scrolls with page but stays in view */}
      <aside className="sticky top-0 h-screen w-64 bg-slate-900 text-white flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="font-bold text-sm leading-tight">Kiwara Tech</div>
              <div className="text-xs text-slate-400">Administração Central</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map(n => (
            <button key={n.id}
              onClick={() => { setView(n.id); setSelectedSchoolId(null); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
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
          <div className="px-4 py-3 border-t border-white/10 space-y-2 shrink-0">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Colégios</span><span className="text-slate-300 font-semibold">{stats.total_colegios}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Alunos</span><span className="text-slate-300 font-semibold">{fmt(stats.total_alunos)}</span>
            </div>
          </div>
        )}

        {/* Logout */}
        <div className="p-3 border-t border-white/10 shrink-0">
          <button onClick={logout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
            <LogOut className="w-4 h-4" /> Terminar sessão
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-h-screen overflow-y-auto">
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
