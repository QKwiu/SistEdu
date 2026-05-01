import { useState, useRef } from "react";
import {
  Paperclip, ArrowRightLeft, AlertCircle, CheckCircle2,
  X, RefreshCw, UserPlus, School, Sparkles,
} from "lucide-react";

export interface FormTurma { id: number; nome: string; turno?: string }
export interface FormPacote { id: number; nome: string; valor: number }

interface StudentRegistrationFormProps {
  turmas: FormTurma[];
  anoLectivo?: string;
  usaPacotes?: boolean;
  pacotes?: FormPacote[];
  nextNumeroProcesso?: string;
  onSubmitForm: (fd: FormData) => Promise<string>;
  onCreateTurma?: () => void;
  onRegisterSuccess?: () => void;
}

/* ─── File Input ─── */
function FileInput({ label, name, accept, required, hint }: {
  label: string; name: string; accept?: string; required?: boolean; hint?: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <p className="block text-xs font-medium text-slate-600 mb-1">{label}{required && " *"}</p>
      <div
        onClick={() => inputRef.current?.click()}
        className={`flex items-center gap-2 border-2 border-dashed rounded-lg px-4 py-3 cursor-pointer transition-colors text-sm
          ${file
            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
            : "border-slate-200 bg-white hover:border-primary/50 text-slate-500"}`}>
        <Paperclip className="w-4 h-4 shrink-0" />
        <span className="truncate">{file ? file.name : "Clique para seleccionar ficheiro"}</span>
        {file && (
          <button type="button" className="ml-auto shrink-0 text-slate-400 hover:text-red-500"
            onClick={e => { e.stopPropagation(); setFile(null); if (inputRef.current) inputRef.current.value = ""; }}>
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" name={name} accept={accept ?? ".pdf,.jpg,.jpeg,.png"}
        required={required && !file} className="hidden"
        onChange={e => setFile(e.target.files?.[0] ?? null)} />
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

/* ─── StudentRegistrationForm ─── */
export function StudentRegistrationForm({
  turmas,
  anoLectivo,
  usaPacotes = false,
  pacotes = [],
  nextNumeroProcesso,
  onSubmitForm,
  onCreateTurma,
  onRegisterSuccess,
}: StudentRegistrationFormProps) {
  const ano = anoLectivo ?? `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;

  const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white";
  const labelCls = "block text-xs font-medium text-slate-600 mb-1";
  const secCls   = "text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3";

  const blank = () => ({
    nome: "", bilhete: "", numero_processo: "", data_nascimento: "", sexo: "",
    turma_id: "", turma_nova: "", turno: "Manhã",
    nome_encarregado: "", telefone_encarregado: "", pacote_id: "",
  });

  const [form, setForm] = useState(blank());
  const [isTransferencia, setIsTransferencia] = useState(false);
  const [escolaAnterior, setEscolaAnterior] = useState("");
  const [anoClasseAnterior, setAnoClasseAnterior] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const reset = () => {
    setForm(blank());
    setIsTransferencia(false);
    setEscolaAnterior("");
    setAnoClasseAnterior("");
    setFormKey(k => k + 1);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.nome.trim()) { setError("O nome do aluno é obrigatório."); return; }
    setError(""); setSaving(true);
    try {
      const fd = new FormData(e.currentTarget);
      fd.set("nome", form.nome.trim());
      fd.set("ano_lectivo", ano);
      fd.set("turno", form.turno);
      fd.set("is_transferencia", isTransferencia ? "true" : "false");
      if (isTransferencia) {
        fd.set("escola_anterior", escolaAnterior.trim());
        fd.set("ano_classe_anterior", anoClasseAnterior.trim());
      }
      if (form.turma_id) fd.set("turma_id", form.turma_id);
      else if (form.turma_nova.trim()) fd.set("turma_nome", form.turma_nova.trim());
      if (form.pacote_id) fd.set("pacote_id", form.pacote_id);

      const studentName = await onSubmitForm(fd);
      setSuccess(studentName);
      reset();
      onRegisterSuccess?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form key={formKey} onSubmit={handleSubmit} className="space-y-7">

      {/* Feedback */}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-emerald-800">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          Aluno <strong>{success}</strong> registado com sucesso!
          <button type="button" onClick={() => setSuccess(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      {/* ── Dados Pessoais ── */}
      <div>
        <p className={secCls}>Dados Pessoais</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelCls}>Nome completo *</label>
            <input className={inputCls} placeholder="ex: João Manuel Silva"
              value={form.nome} onChange={e => set("nome", e.target.value)} required />
          </div>
          <div>
            <label className={labelCls}>Bilhete de Identidade (nº)</label>
            <input name="bilhete" className={inputCls} placeholder="ex: 005234567LA041"
              value={form.bilhete} onChange={e => set("bilhete", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Nº de Processo</label>
            {nextNumeroProcesso !== undefined ? (
              <div className="relative">
                <input
                  name="numero_processo"
                  className={`${inputCls} bg-slate-50 text-slate-500 pr-8`}
                  value={nextNumeroProcesso}
                  readOnly
                  title="Gerado automaticamente pelo sistema"
                />
                <Sparkles className="w-3.5 h-3.5 text-primary/60 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            ) : (
              <input name="numero_processo" className={inputCls} placeholder="ex: 2025/0001"
                value={form.numero_processo} onChange={e => set("numero_processo", e.target.value)} />
            )}
            {nextNumeroProcesso !== undefined && (
              <p className="text-xs text-primary/70 mt-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3"/> Atribuído automaticamente em sequência
              </p>
            )}
          </div>
          <div>
            <label className={labelCls}>Data de Nascimento</label>
            <input name="data_nascimento" type="date" className={inputCls}
              value={form.data_nascimento} onChange={e => set("data_nascimento", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Sexo</label>
            <select name="sexo" className={inputCls} value={form.sexo} onChange={e => set("sexo", e.target.value)}>
              <option value="">— Seleccionar —</option>
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Documentos ── */}
      <div>
        <p className={secCls}>Documentos do Aluno</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FileInput name="bi_doc" label="BI / Cédula do Aluno" hint="PDF, JPG ou PNG (máx. 10 MB)" />
          <FileInput name="bi_encarregado_doc" label="BI do Encarregado de Educação" hint="PDF, JPG ou PNG (máx. 10 MB)" />
        </div>
      </div>

      {/* ── Turma ── */}
      <div>
        <p className={secCls}>Turma</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Seleccionar turma</label>
            {turmas.length === 0 ? (
              <div className="flex items-center gap-3 px-3 py-2.5 border border-slate-200 rounded-lg bg-slate-50">
                <span className="text-sm text-slate-400">Nenhuma turma disponível</span>
                {onCreateTurma && (
                  <button type="button" onClick={onCreateTurma}
                    className="ml-auto flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                    <School className="w-3.5 h-3.5" /> Criar turma
                  </button>
                )}
              </div>
            ) : (
              <select className={inputCls} value={form.turma_id}
                onChange={e => { set("turma_id", e.target.value); if (e.target.value) set("turma_nova", ""); }}>
                <option value="">— Seleccionar —</option>
                {turmas.map(t => (
                  <option key={t.id} value={String(t.id)}>
                    {t.nome}{t.turno ? ` (${t.turno})` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className={labelCls}>Ou criar nova turma</label>
            <input
              className={`${inputCls} ${form.turma_id ? "bg-slate-50 text-slate-400" : ""}`}
              placeholder="ex: 9ª Classe A"
              value={form.turma_nova}
              disabled={!!form.turma_id}
              onChange={e => set("turma_nova", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Turno</label>
            <select className={inputCls} value={form.turno} onChange={e => set("turno", e.target.value)}>
              <option value="Manhã">Manhã</option>
              <option value="Tarde">Tarde</option>
              <option value="Noite">Noite</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Encarregado ── */}
      <div>
        <p className={secCls}>Encarregado de Educação</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Nome do encarregado</label>
            <input name="nome_encarregado" className={inputCls} placeholder="ex: Manuel José Silva"
              value={form.nome_encarregado} onChange={e => set("nome_encarregado", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Telefone</label>
            <input name="telefone_encarregado" className={inputCls} placeholder="ex: 923 456 789"
              value={form.telefone_encarregado} onChange={e => set("telefone_encarregado", e.target.value)} />
            <p className="text-xs text-slate-400 mt-1">PIN inicial de acesso ao portal: 1234</p>
          </div>
        </div>
      </div>

      {/* ── Transferência ── */}
      <div className={`rounded-xl border-2 transition-colors ${isTransferencia ? "border-amber-200 bg-amber-50/50" : "border-slate-100"}`}>
        <button type="button" onClick={() => setIsTransferencia(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700">
          <span className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-amber-600" />
            Aluno em processo de transferência
          </span>
          <span className={`relative shrink-0 rounded-full transition-colors ${isTransferencia ? "bg-amber-500" : "bg-slate-300"}`}
            style={{ height: 22, width: 40 }}>
            <span className={`absolute top-0.5 bg-white rounded-full shadow transition-transform ${isTransferencia ? "translate-x-[18px]" : "translate-x-0.5"}`}
              style={{ width: 18, height: 18 }} />
          </span>
        </button>
        {isTransferencia && (
          <div className="px-4 pb-4 space-y-4 border-t border-amber-200">
            <p className="text-xs text-amber-700 pt-3">
              Para transferências, o documento da instituição anterior é obrigatório.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Escola / Instituição anterior</label>
                <input className={inputCls} placeholder="ex: Colégio São José"
                  value={escolaAnterior} onChange={e => setEscolaAnterior(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Ano lectivo e classe anterior</label>
                <input className={inputCls} placeholder="ex: 2024/2025 — 8ª Classe"
                  value={anoClasseAnterior} onChange={e => setAnoClasseAnterior(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <FileInput name="docs_transferencia" label="Documentos da instituição anterior" required
                  hint="Declaração de transferência, histórico, etc. PDF, JPG ou PNG (máx. 10 MB)" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Pacote ── */}
      {usaPacotes && pacotes.length > 0 && (
        <div>
          <p className={secCls}>Pacote de Emolumentos</p>
          <select className={`${inputCls} sm:max-w-sm`} value={form.pacote_id}
            onChange={e => set("pacote_id", e.target.value)}>
            <option value="">— Sem pacote —</option>
            {pacotes.map(p => (
              <option key={p.id} value={String(p.id)}>
                {p.nome} — {Number(p.valor).toLocaleString("pt-AO")} Kz
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Submit */}
      <div className="flex justify-end pt-2 border-t border-slate-100">
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          {saving ? "A registar…" : "Registar Aluno"}
        </button>
      </div>
    </form>
  );
}
