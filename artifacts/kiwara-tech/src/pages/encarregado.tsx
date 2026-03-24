import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone, Lock, Eye, EyeOff, LogOut, Copy, Check,
  AlertTriangle, Clock, CheckCircle, Wallet, Users,
  RefreshCw, X, CreditCard, Calendar, Info,
  ChevronDown, ChevronUp, ShieldCheck, KeyRound,
} from "lucide-react";

const API = "/api";
const SESSION_KEY = "kiwara_guardian_token";

interface Guardian { id: number; nome: string; telefone: string; first_login: boolean; }
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
type Screen = "login" | "change-password" | "dashboard";

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

function CopyBtn({ text, label = "" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(()=>setCopied(false),2000); })}
      className="flex items-center gap-1 p-1.5 rounded-lg hover:bg-gray-100 transition-colors" title="Copiar">
      {copied ? <Check size={14} className="text-emerald-600"/> : <Copy size={14} className="text-gray-400"/>}
      {label && <span className="text-xs text-gray-400">{copied ? "Copiado!" : label}</span>}
    </button>
  );
}

function PasswordInput({ value, onChange, placeholder, label }: {
  value: string; onChange: (v: string)=>void; placeholder?: string; label: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-blue-200 text-sm font-medium mb-2">{label}</label>
      <div className="relative">
        <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40"/>
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? "••••••"}
          autoComplete="current-password"
          className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl pl-10 pr-11 py-3.5 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all"
        />
        <button type="button" onClick={()=>setShow(!show)}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors">
          {show ? <EyeOff size={16}/> : <Eye size={16}/>}
        </button>
      </div>
    </div>
  );
}

/* ─── Payment Reference Modal ─── */
function RefModal({ propina, onClose }: { propina: Propina; onClose: ()=>void }) {
  const [copiedAll, setCopiedAll] = useState(false);
  const refFmt = propina.referencia?.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3") ?? "";

  const copyAll = () => {
    const txt = `Entidade: ${propina.entidade}\nReferência: ${propina.referencia}\nValor: ${fmt(propina.ref_valor ?? propina.total)}\nValidade: ${fmtDate(propina.validade ?? "")}`;
    navigator.clipboard.writeText(txt).then(()=>{ setCopiedAll(true); setTimeout(()=>setCopiedAll(false),2500); });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"/>
      <motion.div initial={{y:80,opacity:0}} animate={{y:0,opacity:1}} exit={{y:80,opacity:0}}
        transition={{type:"spring",stiffness:300,damping:30}}
        className="relative w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-2xl"
        onClick={e=>e.stopPropagation()}>

        <div className="bg-gradient-to-r from-blue-700 to-blue-600 p-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><CreditCard size={18}/><span className="font-semibold">Referência de Pagamento</span></div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"><X size={16}/></button>
          </div>
          <p className="text-blue-100 text-sm mt-1">{propina.mes} {propina.ano}</p>
        </div>

        <div className="p-5 space-y-4">
          {propina.referencia ? (
            <>
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Entidade</p>
                  <p className="text-3xl font-bold text-gray-900 font-mono">{propina.entidade}</p>
                </div>
                <div className="border-t pt-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Referência</p>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold text-blue-700 font-mono tracking-widest">{refFmt}</p>
                    <CopyBtn text={propina.referencia ?? ""}/>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 border-t pt-3">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Valor a pagar</p>
                    <p className="font-bold text-gray-900 text-lg">{fmt(propina.ref_valor ?? propina.total)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Válida até</p>
                    <p className="font-semibold text-gray-900 text-sm">{fmtShort(propina.validade ?? "")}</p>
                  </div>
                </div>
              </div>

              {Number(propina.multa) > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2">
                  <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5"/>
                  <div>
                    <p className="text-red-800 text-sm font-semibold">Inclui multa por atraso</p>
                    <p className="text-red-600 text-xs mt-0.5">Base: {fmt(propina.valor_base)} + Multa: {fmt(propina.multa)}</p>
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex gap-2">
                <Info size={15} className="text-blue-500 shrink-0 mt-0.5"/>
                <p className="text-blue-800 text-xs">
                  Pague via Multicaixa Express, ATM ou internet banking com a entidade, referência e valor exatos.
                </p>
              </div>

              <button onClick={copyAll}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors flex items-center justify-center gap-2">
                {copiedAll ? <><Check size={16}/>Copiado!</> : <><Copy size={16}/>Copiar Dados de Pagamento</>}
              </button>
            </>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <CreditCard size={32} className="mx-auto mb-2 opacity-30"/>
              <p className="text-sm">Referência ainda não disponível.</p>
              <p className="text-xs mt-1">Contacte o secretariado da escola.</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Login Screen ─── */
function LoginScreen({ onSuccess }: { onSuccess: (token: string, g: Guardian) => void }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    const clean = phone.replace(/\D/g, "");
    if (clean.length < 9) return setError("Introduza um número de telemóvel válido.");
    if (!password) return setError("Introduza a sua palavra-passe.");
    setLoading(true);
    try {
      const res = await fetch(`${API}/guardian/login`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ telefone: clean, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao iniciar sessão.");
      localStorage.setItem(SESSION_KEY, data.token);
      onSuccess(data.token, { ...data.guardian, first_login: data.first_login });
    } catch(err: any) { setError(err.message); }
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
              <KeyRound size={28} className="text-white"/>
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
            </div>

            <PasswordInput value={password} onChange={setPassword} placeholder="Palavra-passe" label="Palavra-passe"/>

            <AnimatePresence>
              {error && (
                <motion.div initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}} exit={{opacity:0}}
                  className="bg-red-500/20 border border-red-400/30 rounded-xl px-3 py-2.5 flex items-center gap-2">
                  <AlertTriangle size={14} className="text-red-300 shrink-0"/>
                  <p className="text-red-200 text-sm">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <button type="submit" disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/20 text-white font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2">
              {loading ? <RefreshCw size={18} className="animate-spin"/> : <Lock size={18}/>}
              {loading ? "A verificar..." : "Entrar"}
            </button>
          </form>

          <div className="mt-6 bg-white/5 border border-white/10 rounded-xl p-3">
            <p className="text-blue-300/80 text-xs text-center">
              <span className="font-semibold text-blue-200">Primeiro acesso?</span> Use a palavra-passe temporária <span className="font-mono font-bold text-amber-200">1234</span> — será pedida uma nova após o login.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/* ─── Change Password Screen ─── */
function ChangePasswordScreen({ token, guardian, onSuccess }: {
  token: string; guardian: Guardian; onSuccess: ()=>void;
}) {
  const [nova, setNova] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    if (nova.length < 6) return setError("A palavra-passe deve ter pelo menos 6 caracteres.");
    if (nova !== confirmar) return setError("As palavras-passe não coincidem.");
    setLoading(true);
    try {
      const res = await fetch(`${API}/guardian/change-password`, {
        method:"POST",
        headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` },
        body: JSON.stringify({ nova_senha: nova, confirmar_senha: confirmar }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao actualizar palavra-passe.");
      onSuccess();
    } catch(err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const initials = guardian.nome.split(/\s+/).map(w=>w[0]).join("").slice(0,2).toUpperCase();

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
            <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-400/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ShieldCheck size={28} className="text-emerald-300"/>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-emerald-400 flex items-center justify-center text-white font-bold mx-auto mb-3">
              {initials}
            </div>
            <h1 className="text-xl font-bold text-white">Bem-vindo, {guardian.nome.split(" ")[0]}!</h1>
            <p className="text-blue-300 text-sm mt-1">Por segurança, defina uma palavra-passe pessoal para continuar.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <PasswordInput value={nova} onChange={setNova} placeholder="Mínimo 6 caracteres" label="Nova palavra-passe"/>
            <PasswordInput value={confirmar} onChange={setConfirmar} placeholder="Repetir palavra-passe" label="Confirmar palavra-passe"/>

            {/* Strength hints */}
            {nova.length > 0 && (
              <div className="flex gap-1.5">
                {[6,8,12].map((len,i) => (
                  <div key={i} className={`flex-1 h-1 rounded-full transition-all ${
                    nova.length >= len
                      ? i===0?"bg-amber-400":i===1?"bg-blue-400":"bg-emerald-400"
                      : "bg-white/15"
                  }`}/>
                ))}
                <span className="text-xs text-white/40 ml-1">
                  {nova.length < 6?"Fraca":nova.length < 8?"Razoável":nova.length < 12?"Boa":"Forte"}
                </span>
              </div>
            )}

            <AnimatePresence>
              {error && (
                <motion.div initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}} exit={{opacity:0}}
                  className="bg-red-500/20 border border-red-400/30 rounded-xl px-3 py-2.5 flex items-center gap-2">
                  <AlertTriangle size={14} className="text-red-300 shrink-0"/>
                  <p className="text-red-200 text-sm">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <button type="submit" disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/20 text-white font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2">
              {loading ? <RefreshCw size={18} className="animate-spin"/> : <ShieldCheck size={18}/>}
              {loading ? "A guardar..." : "Definir Palavra-passe e Entrar"}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}

/* ─── Dashboard ─── */
function Dashboard({ token, guardian, onLogout }: { token: string; guardian: Guardian; onLogout: ()=>void }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student|null>(null);
  const [propinas, setPropinas] = useState<Propina[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingPropinas, setLoadingPropinas] = useState(false);
  const [selectedPropina, setSelectedPropina] = useState<Propina|null>(null);
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
    try {
      const res = await fetch(`${API}/guardian/alunos/${id}/propinas`, {headers});
      if (!res.ok) return;
      setPropinas(await res.json());
    } catch {}
    finally { setLoadingPropinas(false); }
  }, [token]);

  useEffect(() => { loadStudents(); }, [loadStudents]);
  useEffect(() => { if (selectedStudent) loadPropinas(selectedStudent.id); }, [selectedStudent, loadPropinas]);

  const totalDivida = students.reduce((s,st)=>s+Number(st.divida_total),0);
  const totalMultas = students.reduce((s,st)=>s+Number(st.total_multas),0);
  const totalVencidas = students.reduce((s,st)=>s+Number(st.propinas_vencidas),0);

  const unpaid = propinas.filter(p => p.estado !== "PAGO");
  const paid   = propinas.filter(p => p.estado === "PAGO");

  const initials = guardian.nome.split(/\s+/).map(w=>w[0]).join("").slice(0,2).toUpperCase();

  if (loadingStudents) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <RefreshCw size={24} className="animate-spin text-blue-600"/>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
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
            ].map((c,i)=>(
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
                <button key={st.id} onClick={()=>setSelectedStudent(st)}
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
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Propinas em aberto</p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5">{selectedStudent.nome}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Total em dívida</p>
                <p className="font-bold text-red-600">{fmt(selectedStudent.divida_total)}</p>
              </div>
            </div>

            {loadingPropinas ? (
              <div className="flex items-center justify-center py-10"><RefreshCw size={20} className="animate-spin text-blue-600"/></div>
            ) : (
              <div className="space-y-3">
                {/* Unpaid propinas */}
                {unpaid.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                    <CheckCircle size={28} className="mx-auto mb-2 text-emerald-400 opacity-70"/>
                    <p className="text-gray-500 font-medium">Sem propinas em aberto</p>
                    <p className="text-gray-400 text-sm mt-1">Todas as propinas estão liquidadas.</p>
                  </div>
                ) : (
                  unpaid.map(p => (
                    <motion.div key={p.id} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}}
                      className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${p.estado==="VENCIDO"?"border-red-200":"border-gray-100"}`}>

                      {p.estado === "VENCIDO" && (
                        <div className="bg-red-50 border-b border-red-100 px-4 py-1.5 flex items-center gap-1.5">
                          <AlertTriangle size={12} className="text-red-500"/>
                          <span className="text-red-700 text-xs font-semibold">Propina vencida — multa por atraso aplicada</span>
                        </div>
                      )}

                      <div className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-semibold text-gray-900">{p.mes} {p.ano}</p>
                            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                              <Calendar size={10}/>Vencimento: {fmtDate(p.data_vencimento)}
                            </p>
                          </div>
                          <StatusBadge estado={p.estado}/>
                        </div>

                        {/* Values */}
                        <div className="space-y-1.5 text-sm mb-4">
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
                          <div className="flex justify-between border-t pt-1.5">
                            <span className="font-semibold text-gray-900">Total a pagar</span>
                            <span className="font-bold text-gray-900">{fmt(p.total)}</span>
                          </div>
                        </div>

                        {/* Reference preview + button */}
                        {p.referencia ? (
                          <div className="space-y-2">
                            <div className="bg-blue-50 rounded-xl px-3 py-2 flex items-center justify-between">
                              <div>
                                <p className="text-xs text-blue-500 font-medium">Entidade {p.entidade} · Ref.</p>
                                <p className="font-mono font-bold text-blue-800 text-sm tracking-widest">
                                  {p.referencia.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3")}
                                </p>
                              </div>
                              <CopyBtn text={p.referencia}/>
                            </div>
                            <button onClick={()=>setSelectedPropina(p)}
                              className={`w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                                p.estado==="VENCIDO"?"bg-red-600 hover:bg-red-700 text-white":"bg-blue-600 hover:bg-blue-700 text-white"
                              }`}>
                              <CreditCard size={14}/>Ver Referência Completa
                            </button>
                          </div>
                        ) : (
                          <div className="bg-gray-50 rounded-xl px-3 py-2.5 flex items-center gap-2 text-gray-400">
                            <Clock size={14}/>
                            <p className="text-sm">Referência a ser gerada pelo secretariado</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))
                )}

                {/* Paid propinas (collapsible) */}
                {paid.length > 0 && (
                  <div>
                    <button onClick={()=>setShowPaid(!showPaid)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-2xl border border-gray-100 text-sm text-gray-500 hover:bg-gray-50 transition-colors mt-1">
                      <span className="flex items-center gap-2">
                        <CheckCircle size={14} className="text-emerald-500"/>
                        {paid.length} {paid.length===1?"propina liquidada":"propinas liquidadas"}
                      </span>
                      {showPaid ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                    </button>
                    <AnimatePresence>
                      {showPaid && (
                        <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}}
                          className="overflow-hidden space-y-2 mt-2">
                          {paid.map(p=>(
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
              </div>
            )}
          </div>
        )}

        <div className="text-center pt-2">
          <p className="text-xs text-gray-300">Kiwara Escolar — Portal do Encarregado</p>
        </div>
      </div>

      <AnimatePresence>
        {selectedPropina && <RefModal propina={selectedPropina} onClose={()=>setSelectedPropina(null)}/>}
      </AnimatePresence>
    </div>
  );
}

/* ─── Root ─── */
export default function EncarregadoPortal() {
  const [screen, setScreen] = useState<Screen>("login");
  const [token, setToken] = useState<string|null>(null);
  const [guardian, setGuardian] = useState<Guardian|null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (!saved) return;
    fetch(`${API}/guardian/me`, { headers:{ Authorization:`Bearer ${saved}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        setToken(saved);
        setGuardian(data);
        setScreen(data.first_login ? "change-password" : "dashboard");
      })
      .catch(() => localStorage.removeItem(SESSION_KEY));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    setToken(null); setGuardian(null); setScreen("login");
  };

  const handleLoginSuccess = (t: string, g: Guardian) => {
    setToken(t); setGuardian(g);
    setScreen(g.first_login ? "change-password" : "dashboard");
  };

  const handlePasswordChanged = () => {
    if (guardian) setGuardian({ ...guardian, first_login: false });
    setScreen("dashboard");
  };

  if (screen === "login")
    return <LoginScreen onSuccess={handleLoginSuccess}/>;

  if (screen === "change-password" && token && guardian)
    return <ChangePasswordScreen token={token} guardian={guardian} onSuccess={handlePasswordChanged}/>;

  if (screen === "dashboard" && token && guardian)
    return <Dashboard token={token} guardian={guardian} onLogout={handleLogout}/>;

  return null;
}
