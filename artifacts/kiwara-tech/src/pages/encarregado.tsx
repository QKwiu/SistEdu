import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone, Shield, ArrowLeft, Copy, Check, LogOut,
  AlertTriangle, Clock, CheckCircle, Wallet, Users,
  RefreshCw, X, CreditCard, Calendar, Info, Square, CheckSquare,
  Zap, ChevronDown, ChevronUp,
} from "lucide-react";

const API = "/api";
const SESSION_KEY = "kiwara_guardian_token";

interface Guardian { id: number; nome: string; telefone: string; }
interface Student {
  id: number; nome: string; bilhete: string;
  turma: string | null; turno: string | null;
  divida_total: number; total_multas: number;
  propinas_vencidas: number; propinas_pendentes: number;
}
interface Propina {
  id: number; mes: string; ano: string;
  valor_base: number; multa: number; total: number;
  estado: "PENDENTE" | "PAGO" | "VENCIDO";
  data_vencimento: string;
  pagamento_id: number | null; entidade: string | null;
  referencia: string | null; ref_valor: number | null;
  ref_estado: string | null; validade: string | null;
}
interface ReferenciaCombinada {
  entidade: string; referencia: string; valor: number; validade: string;
  propinas: { id: number; mes: string; ano: string; valor: number; multa: number; aluno: string }[];
}
type Screen = "login" | "otp" | "dashboard";
type FilterType = "all" | "pendente" | "vencido" | "pago";

const MONTHS_ORDER: Record<string, number> = {
  Janeiro:1, Fevereiro:2, Março:3, Abril:4, Maio:5, Junho:6,
  Julho:7, Agosto:8, Setembro:9, Outubro:10, Novembro:11, Dezembro:12,
};

function fmt(val: number | string) {
  const n = typeof val === "string" ? parseFloat(val) : val;
  return n.toLocaleString("pt-AO") + " Kz";
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("pt-AO", { day: "2-digit", month: "long", year: "numeric" });
}
function fmtShort(d: string) {
  return new Date(d).toLocaleDateString("pt-AO", { day: "2-digit", month: "short", year: "numeric" });
}

function StatusBadge({ estado }: { estado: string }) {
  const c: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    PAGO:     { label:"Pago",     cls:"bg-emerald-100 text-emerald-800 border-emerald-200", icon:<CheckCircle size={11}/> },
    PENDENTE: { label:"Pendente", cls:"bg-amber-100 text-amber-800 border-amber-200",       icon:<Clock size={11}/> },
    VENCIDO:  { label:"Vencido",  cls:"bg-red-100 text-red-800 border-red-200",             icon:<AlertTriangle size={11}/> },
  };
  const s = c[estado] ?? c["PENDENTE"];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${s.cls}`}>
      {s.icon}{s.label}
    </span>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(()=>setCopied(false),2000); }); }}
      className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" title="Copiar">
      {copied ? <Check size={14} className="text-emerald-600"/> : <Copy size={14} className="text-gray-500"/>}
    </button>
  );
}

/* ─── Combined Payment Modal ─── */
function CombinedRefModal({ ref: refData, onClose }: { ref: ReferenciaCombinada; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const refFmt = refData.referencia.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3");
  const hasMulhas = refData.propinas.some(p => p.multa > 0);

  const copyAll = () => {
    const txt = `Entidade: ${refData.entidade}\nReferência: ${refData.referencia}\nValor: ${fmt(refData.valor)}\nValidade: ${fmtDate(refData.validade)}`;
    navigator.clipboard.writeText(txt).then(() => { setCopied(true); setTimeout(()=>setCopied(false),2500); });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"/>
      <motion.div initial={{ y:80, opacity:0 }} animate={{ y:0, opacity:1 }} exit={{ y:80, opacity:0 }}
        transition={{ type:"spring", stiffness:300, damping:30 }}
        className="relative w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
        onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-blue-600 p-5 text-white shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard size={18}/><span className="font-semibold">Referência de Pagamento</span>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"><X size={16}/></button>
          </div>
          <p className="text-blue-100 text-sm mt-1">
            {refData.propinas.length === 1
              ? `${refData.propinas[0].mes} ${refData.propinas[0].ano}`
              : `${refData.propinas.length} meses selecionados`}
          </p>
        </div>

        <div className="overflow-y-auto">
          <div className="p-5 space-y-4">
            {/* Reference card */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Entidade</p>
                  <p className="text-3xl font-bold text-gray-900 font-mono">{refData.entidade}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Multicaixa Express</p>
                  <p className="text-xs text-gray-400">ATM · Internet Banking</p>
                </div>
              </div>
              <div className="border-t pt-3">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Referência</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-blue-700 font-mono tracking-widest">{refFmt}</p>
                  <CopyBtn text={refData.referencia}/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 border-t pt-3">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Total a pagar</p>
                  <p className="font-bold text-gray-900 text-lg">{fmt(refData.valor)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Validade</p>
                  <p className="font-semibold text-gray-900 text-sm">{fmtShort(refData.validade)}</p>
                </div>
              </div>
            </div>

            {/* Breakdown */}
            {refData.propinas.length > 1 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Detalhe dos meses incluídos</p>
                <div className="bg-gray-50 rounded-xl divide-y divide-gray-200">
                  {refData.propinas.map((p, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500"/>
                        <span className="text-sm text-gray-700">{p.mes} {p.ano}</span>
                        {p.multa > 0 && (
                          <span className="text-xs text-red-500 flex items-center gap-0.5">
                            <AlertTriangle size={10}/> multa
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-gray-900">{fmt(p.valor)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-3 py-2.5 bg-blue-50 rounded-b-xl">
                    <span className="text-sm font-bold text-gray-900">Total</span>
                    <span className="text-sm font-bold text-blue-700">{fmt(refData.valor)}</span>
                  </div>
                </div>
              </div>
            )}

            {hasMulhas && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2">
                <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5"/>
                <p className="text-red-800 text-xs">O valor inclui multas por atraso no pagamento.</p>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex gap-2">
              <Info size={15} className="text-blue-500 shrink-0 mt-0.5"/>
              <p className="text-blue-800 text-xs">
                Utilize exatamente esta entidade, referência e valor. O pagamento será confirmado automaticamente.
              </p>
            </div>

            <button onClick={copyAll}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors flex items-center justify-center gap-2">
              {copied ? <><Check size={16}/>Copiado!</> : <><Copy size={16}/>Copiar Dados de Pagamento</>}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Login ─── */
function LoginScreen({ onSuccess }: { onSuccess: (phone: string) => void }) {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    const clean = phone.replace(/\D/g, "");
    if (clean.length < 9) return setError("Introduza um número de telemóvel válido.");
    setLoading(true);
    try {
      const res = await fetch(`${API}/guardian/login`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({telefone:clean}) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao enviar código.");
      onSuccess(clean);
    } catch(err:any) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 flex flex-col">
      <div className="flex items-center p-6">
        <Link href="/" className="flex items-center gap-2.5 text-white/70 hover:text-white transition-colors">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-emerald-400 rounded-lg flex items-center justify-center text-white font-bold text-sm">K</div>
          <span className="font-medium text-sm">Kiwara Tech</span>
        </Link>
      </div>
      <div className="flex-1 flex items-center justify-center px-6">
        <motion.div initial={{opacity:0,y:28}} animate={{opacity:1,y:0}} className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-white/10 border border-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Phone size={28} className="text-white"/>
            </div>
            <h1 className="text-2xl font-bold text-white">Portal do Encarregado</h1>
            <p className="text-blue-300 text-sm mt-1">Consulte propinas e referências de pagamento</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-blue-200 text-sm font-medium mb-2">Número de Telemóvel</label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                  <span className="text-white/60 text-sm font-medium">+244</span>
                  <span className="w-px h-4 bg-white/25"/>
                </div>
                <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="943 612 744"
                  className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl pl-[72px] pr-4 py-3.5 text-lg font-mono tracking-wide focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all"
                  autoComplete="tel"/>
              </div>
              <AnimatePresence>
                {error && (
                  <motion.p initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}} exit={{opacity:0}}
                    className="text-red-300 text-sm mt-2 flex items-center gap-1.5">
                    <AlertTriangle size={13}/>{error}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/20 text-white font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2">
              {loading ? <RefreshCw size={18} className="animate-spin"/> : <Phone size={18}/>}
              {loading ? "A enviar..." : "Receber Código OTP"}
            </button>
          </form>
          <p className="text-blue-400/60 text-xs text-center mt-6">Receberá um código de 4 dígitos para confirmar o seu acesso.</p>
        </motion.div>
      </div>
    </div>
  );
}

/* ─── OTP ─── */
function OtpScreen({ phone, onSuccess, onBack }: { phone:string; onSuccess:(t:string,g:Guardian)=>void; onBack:()=>void }) {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resent, setResent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    if (otp.length !== 4) return setError("O código OTP tem 4 dígitos.");
    setLoading(true);
    try {
      const res = await fetch(`${API}/guardian/verify-otp`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({telefone:phone,otp}) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Código inválido.");
      localStorage.setItem(SESSION_KEY, data.token);
      onSuccess(data.token, data.guardian);
    } catch(err:any) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 flex flex-col">
      <div className="p-6">
        <button onClick={onBack} className="flex items-center gap-2 text-white/70 hover:text-white transition-colors">
          <ArrowLeft size={18}/><span className="text-sm">Voltar</span>
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center px-6">
        <motion.div initial={{opacity:0,y:28}} animate={{opacity:1,y:0}} className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-white/10 border border-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Shield size={28} className="text-white"/>
            </div>
            <h1 className="text-2xl font-bold text-white">Verificação</h1>
            <p className="text-blue-300 text-sm mt-1">
              Código enviado para <span className="font-mono font-semibold text-white">+244 {phone.slice(0,3)}***{phone.slice(-2)}</span>
            </p>
          </div>
          <div className="bg-amber-500/15 border border-amber-400/30 rounded-xl p-3 mb-5 text-center">
            <p className="text-amber-200 text-xs">
              <span className="font-semibold">Demo:</span> utilize o código{" "}
              <span className="font-mono font-bold text-amber-100 text-base">1234</span>
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-blue-200 text-sm font-medium mb-2">Código OTP</label>
              <input type="tel" value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="0000"
                className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl px-4 py-4 text-4xl font-mono text-center tracking-[0.6em] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all"
                autoComplete="one-time-code" maxLength={4}/>
              <AnimatePresence>
                {error && (
                  <motion.p initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}} exit={{opacity:0}}
                    className="text-red-300 text-sm mt-2 flex items-center gap-1.5">
                    <AlertTriangle size={13}/>{error}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
            <button type="submit" disabled={loading||otp.length!==4}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/20 text-white font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2">
              {loading ? <RefreshCw size={18} className="animate-spin"/> : <Shield size={18}/>}
              {loading ? "A verificar..." : "Confirmar e Entrar"}
            </button>
          </form>
          <div className="text-center mt-4">
            <button onClick={async()=>{
              await fetch(`${API}/guardian/login`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({telefone:phone})});
              setResent(true); setTimeout(()=>setResent(false),5000);
            }} className="text-blue-300 hover:text-white text-sm transition-colors">
              {resent ? <span className="text-emerald-400">✓ Código reenviado!</span> : "Reenviar código"}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/* ─── Dashboard ─── */
function Dashboard({ token, guardian, onLogout }: { token:string; guardian:Guardian; onLogout:()=>void }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student|null>(null);
  const [propinas, setPropinas] = useState<Propina[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingPropinas, setLoadingPropinas] = useState(false);
  const [refModal, setRefModal] = useState<ReferenciaCombinada|null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [showPaid, setShowPaid] = useState(false);

  const headers = { Authorization:`Bearer ${token}`, "Content-Type":"application/json" };

  const loadStudents = useCallback(async () => {
    try {
      const res = await fetch(`${API}/guardian/alunos`, {headers});
      if (!res.ok) { onLogout(); return; }
      const data: Student[] = await res.json();
      setStudents(data);
      if (data.length > 0) setSelectedStudent(prev => prev ?? data[0]);
    } catch {}
    finally { setLoadingStudents(false); }
  }, [token]);

  const loadPropinas = useCallback(async (id: number) => {
    setLoadingPropinas(true);
    setSelectedIds(new Set());
    try {
      const res = await fetch(`${API}/guardian/alunos/${id}/propinas`, {headers});
      if (!res.ok) return;
      setPropinas(await res.json());
    } catch {}
    finally { setLoadingPropinas(false); }
  }, [token]);

  useEffect(() => { loadStudents(); }, [loadStudents]);
  useEffect(() => { if (selectedStudent) loadPropinas(selectedStudent.id); }, [selectedStudent, loadPropinas]);

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setGenError("");
  };

  const selectAll = () => {
    const unpaid = propinas.filter(p => p.estado !== "PAGO").map(p => p.id);
    setSelectedIds(new Set(unpaid));
  };

  const clearSelection = () => { setSelectedIds(new Set()); setGenError(""); };

  const generateRef = async () => {
    if (selectedIds.size === 0) return;
    setGenerating(true); setGenError("");
    try {
      const res = await fetch(`${API}/guardian/pagamentos/gerar`, {
        method:"POST", headers,
        body: JSON.stringify({ propina_ids: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao gerar referência.");
      setRefModal(data);
    } catch(err:any) { setGenError(err.message); }
    finally { setGenerating(false); }
  };

  const totalDivida = students.reduce((s,st) => s + Number(st.divida_total), 0);
  const totalMultas = students.reduce((s,st) => s + Number(st.total_multas), 0);
  const totalVencidas = students.reduce((s,st) => s + Number(st.propinas_vencidas), 0);

  const unpaidPropinas = propinas.filter(p => p.estado !== "PAGO");
  const paidPropinas = propinas.filter(p => p.estado === "PAGO");
  const filtered = filter === "all"
    ? unpaidPropinas
    : filter === "pago"
      ? paidPropinas
      : propinas.filter(p => p.estado.toLowerCase() === filter);

  const selectedTotal = propinas
    .filter(p => selectedIds.has(p.id))
    .reduce((s, p) => s + Number(p.total), 0);

  const initials = guardian.nome.split(/\s+/).map(w=>w[0]).join("").slice(0,2).toUpperCase();

  if (loadingStudents) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <RefreshCw size={24} className="animate-spin text-blue-600"/>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-36">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-emerald-500 flex items-center justify-center text-white font-bold text-sm">{initials}</div>
            <div>
              <p className="font-semibold text-gray-900 text-sm leading-tight">{guardian.nome}</p>
              <p className="text-xs text-gray-400">+244 {guardian.telefone}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={()=>{ loadStudents(); if(selectedStudent) loadPropinas(selectedStudent.id); }}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700" title="Atualizar">
              <RefreshCw size={16}/>
            </button>
            <button onClick={onLogout}
              className="p-2 rounded-lg hover:bg-red-50 transition-colors text-gray-400 hover:text-red-600" title="Terminar sessão">
              <LogOut size={16}/>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-6">

        {/* Summary */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Resumo — Março 2026</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon:<Wallet size={15} className="text-red-600"/>, bg:"bg-red-50", label:"Em dívida", value:`${(totalDivida/1000).toFixed(0)}K Kz` },
              { icon:<AlertTriangle size={15} className="text-amber-600"/>, bg:"bg-amber-50", label:"Multas", value:`${(totalMultas/1000).toFixed(0)}K Kz` },
              { icon:<Clock size={15} className="text-orange-600"/>, bg:"bg-orange-50", label:"Em atraso", value:`${totalVencidas} ${totalVencidas===1?"mês":"meses"}` },
            ].map((c,i) => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <div className={`w-7 h-7 ${c.bg} rounded-lg flex items-center justify-center mb-2`}>{c.icon}</div>
                <p className="text-xs text-gray-400 mb-0.5">{c.label}</p>
                <p className="text-base font-bold text-gray-900 leading-tight">{c.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Students */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Users size={12}/> Educandos ({students.length})
          </p>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {students.map(st => {
              const sel = selectedStudent?.id === st.id;
              const hasVenc = Number(st.propinas_vencidas) > 0;
              const hasDebt = Number(st.divida_total) > 0;
              return (
                <button key={st.id} onClick={()=>{ setSelectedStudent(st); setFilter("all"); setSelectedIds(new Set()); }}
                  className={`flex-shrink-0 w-52 text-left rounded-2xl p-4 border-2 transition-all ${sel?"border-blue-600 bg-blue-50 shadow-md":"border-gray-200 bg-white hover:border-gray-300"}`}>
                  <div className="flex items-start justify-between mb-2.5">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white font-bold text-sm">
                      {st.nome.split(" ").map(w=>w[0]).join("").slice(0,2)}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${hasVenc?"bg-red-100 text-red-700":hasDebt?"bg-amber-100 text-amber-700":"bg-emerald-100 text-emerald-700"}`}>
                      {hasVenc?"Em atraso":hasDebt?"Pendente":"Regular"}
                    </span>
                  </div>
                  <p className="font-semibold text-gray-900 text-sm leading-snug">{st.nome}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{st.turma ?? "Sem turma"}</p>
                  {hasDebt && <p className="text-xs font-bold text-red-600 mt-2">{fmt(st.divida_total)}</p>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Propinas */}
        {selectedStudent && (
          <div>
            {/* Section header */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Propinas em aberto</p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5">{selectedStudent.nome}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Dívida total</p>
                <p className="font-bold text-red-600 text-sm">{fmt(selectedStudent.divida_total)}</p>
              </div>
            </div>

            {/* Selection controls */}
            {unpaidPropinas.length > 0 && (
              <div className="flex items-center justify-between mb-3 bg-blue-50 rounded-xl px-3 py-2.5 border border-blue-100">
                <p className="text-xs text-blue-700 font-medium">
                  {selectedIds.size === 0
                    ? "Selecione os meses para gerar referência"
                    : `${selectedIds.size} ${selectedIds.size===1?"mês":"meses"} selecionado${selectedIds.size===1?"":"s"}`}
                </p>
                <div className="flex gap-2">
                  {selectedIds.size > 0 && (
                    <button onClick={clearSelection} className="text-xs text-gray-500 hover:text-gray-700 transition-colors px-2 py-1 rounded-lg hover:bg-white">
                      Limpar
                    </button>
                  )}
                  <button onClick={selectedIds.size === unpaidPropinas.length ? clearSelection : selectAll}
                    className="text-xs text-blue-700 font-semibold hover:text-blue-900 transition-colors px-2 py-1 rounded-lg hover:bg-white">
                    {selectedIds.size === unpaidPropinas.length ? "Desselecionar" : "Selecionar tudo"}
                  </button>
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-0.5">
              {(["all","vencido","pendente"] as FilterType[]).map(f => {
                const labels = { all:`Todas (${unpaidPropinas.length})`, vencido:"Vencidas", pendente:"Pendentes" };
                return (
                  <button key={f} onClick={()=>setFilter(f)}
                    className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${filter===f?"bg-blue-600 text-white shadow-sm":"bg-white text-gray-600 border border-gray-200 hover:border-gray-300"}`}>
                    {labels[f]}
                  </button>
                );
              })}
            </div>

            {loadingPropinas ? (
              <div className="flex items-center justify-center py-10">
                <RefreshCw size={20} className="animate-spin text-blue-600"/>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(p => {
                  const isSelected = selectedIds.has(p.id);
                  const isVencido = p.estado === "VENCIDO";
                  return (
                    <motion.div key={p.id} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}}
                      onClick={()=>toggleSelect(p.id)}
                      className={`bg-white rounded-2xl border shadow-sm overflow-hidden cursor-pointer transition-all select-none ${
                        isSelected
                          ? "border-blue-500 ring-2 ring-blue-200 shadow-md"
                          : isVencido ? "border-red-200 hover:border-red-300" : "border-gray-100 hover:border-gray-300"
                      }`}>
                      {isVencido && !isSelected && (
                        <div className="bg-red-50 border-b border-red-100 px-4 py-1.5 flex items-center gap-1.5">
                          <AlertTriangle size={12} className="text-red-500"/>
                          <span className="text-red-700 text-xs font-semibold">Propina vencida — multa por atraso</span>
                        </div>
                      )}
                      {isSelected && (
                        <div className="bg-blue-600 px-4 py-1.5 flex items-center gap-1.5">
                          <CheckSquare size={12} className="text-white"/>
                          <span className="text-white text-xs font-semibold">Selecionado para pagamento</span>
                        </div>
                      )}
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            {/* Checkbox */}
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                              isSelected ? "bg-blue-600 border-blue-600" : "border-gray-300"
                            }`}>
                              {isSelected && <Check size={12} className="text-white"/>}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{p.mes} {p.ano}</p>
                              <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                                <Calendar size={10}/>
                                Vencimento: {fmtDate(p.data_vencimento)}
                              </p>
                            </div>
                          </div>
                          <StatusBadge estado={p.estado}/>
                        </div>

                        <div className="space-y-1.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Valor base</span>
                            <span className="font-medium text-gray-800">{fmt(p.valor_base)}</span>
                          </div>
                          {Number(p.multa) > 0 && (
                            <div className="flex justify-between">
                              <span className="text-red-500 flex items-center gap-1"><AlertTriangle size={10}/>Multa (atraso)</span>
                              <span className="font-semibold text-red-600">+ {fmt(p.multa)}</span>
                            </div>
                          )}
                          <div className="flex justify-between border-t pt-1.5 mt-0.5">
                            <span className="font-semibold text-gray-900">Total</span>
                            <span className="font-bold text-gray-900">{fmt(p.total)}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                {/* Paid section toggle */}
                {paidPropinas.length > 0 && filter !== "vencido" && filter !== "pendente" && (
                  <div>
                    <button onClick={()=>setShowPaid(!showPaid)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-2xl border border-gray-100 text-sm text-gray-500 hover:bg-gray-50 transition-colors">
                      <span className="flex items-center gap-2">
                        <CheckCircle size={14} className="text-emerald-500"/>
                        {paidPropinas.length} {paidPropinas.length===1?"propina paga":"propinas pagas"}
                      </span>
                      {showPaid ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                    </button>
                    <AnimatePresence>
                      {showPaid && (
                        <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}}
                          className="overflow-hidden space-y-2 mt-2">
                          {paidPropinas.map(p => (
                            <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-4 opacity-60">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-semibold text-gray-700 text-sm">{p.mes} {p.ano}</p>
                                  <p className="text-xs text-gray-400">{fmt(p.valor_base)}</p>
                                </div>
                                <div className="flex items-center gap-2 bg-emerald-50 rounded-xl px-3 py-1.5">
                                  <CheckCircle size={13} className="text-emerald-600"/>
                                  <span className="text-emerald-700 text-xs font-medium">Pago</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {filtered.length === 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                    <CheckCircle size={28} className="mx-auto mb-2 text-emerald-400 opacity-60"/>
                    <p className="text-gray-400 text-sm">Nenhuma propina nesta categoria.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="text-center pb-4 pt-2">
          <p className="text-xs text-gray-300">Kiwara Escolar — Portal do Encarregado</p>
        </div>
      </div>

      {/* Floating action bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ y:100, opacity:0 }}
            animate={{ y:0, opacity:1 }}
            exit={{ y:100, opacity:0 }}
            transition={{ type:"spring", stiffness:350, damping:30 }}
            className="fixed bottom-0 left-0 right-0 z-40 p-4"
          >
            <div className="max-w-2xl mx-auto">
              <div className="bg-blue-700 rounded-2xl shadow-2xl p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm">
                    {selectedIds.size} {selectedIds.size===1?"mês selecionado":"meses selecionados"}
                  </p>
                  <p className="text-blue-200 text-xs font-mono">{fmt(selectedTotal)}</p>
                </div>
                {genError && (
                  <p className="text-red-300 text-xs shrink-0 max-w-[120px] text-right">{genError}</p>
                )}
                <button
                  onClick={generateRef}
                  disabled={generating}
                  className="flex-shrink-0 bg-white text-blue-700 font-bold px-5 py-3 rounded-xl hover:bg-blue-50 transition-all flex items-center gap-2 disabled:opacity-70"
                >
                  {generating ? <RefreshCw size={16} className="animate-spin"/> : <Zap size={16}/>}
                  {generating ? "A gerar..." : "Gerar Referência"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reference modal */}
      <AnimatePresence>
        {refModal && <CombinedRefModal ref={refModal} onClose={()=>setRefModal(null)}/>}
      </AnimatePresence>
    </div>
  );
}

/* ─── Root ─── */
export default function EncarregadoPortal() {
  const [screen, setScreen] = useState<Screen>("login");
  const [phone, setPhone] = useState("");
  const [token, setToken] = useState<string|null>(null);
  const [guardian, setGuardian] = useState<Guardian|null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (!saved) return;
    fetch(`${API}/guardian/me`, { headers:{ Authorization:`Bearer ${saved}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => { setToken(saved); setGuardian(data); setScreen("dashboard"); })
      .catch(() => localStorage.removeItem(SESSION_KEY));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    setToken(null); setGuardian(null); setScreen("login");
  };

  if (screen==="login") return <LoginScreen onSuccess={p=>{ setPhone(p); setScreen("otp"); }}/>;
  if (screen==="otp")   return <OtpScreen phone={phone} onSuccess={(t,g)=>{ setToken(t); setGuardian(g); setScreen("dashboard"); }} onBack={()=>setScreen("login")}/>;
  if (screen==="dashboard" && token && guardian) return <Dashboard token={token} guardian={guardian} onLogout={handleLogout}/>;
  return null;
}
