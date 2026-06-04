import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock, Eye, EyeOff, LogOut, Copy, Check,
  AlertTriangle, Clock, CheckCircle, Wallet, Users,
  RefreshCw, X, CreditCard, Calendar, Info,
  ShieldCheck, KeyRound, Zap, ListFilter, BookOpen,
  Phone, HelpCircle, RotateCcw, Menu, Bell, ArrowLeftRight,
  FileText, Send, ChevronRight, ChevronLeft, Banknote,
  BadgeCheck, XCircle, GraduationCap, CalendarDays,
  ShoppingCart, Truck, Store, MinusCircle, PlusCircle,
  UtensilsCrossed, Image as ImageIcon, Play, Soup,
} from "lucide-react";

const API = "/api";
const SESSION_KEY = "kiwara_guardian_token";

interface Guardian { id: number; nome: string; telefone: string; first_login: boolean; }
interface Student {
  id: number; nome: string; bilhete: string;
  school_id: number; school_name: string; school_logo_url: string | null;
  institution_type?: string; portal_nomenclatura?: string;
  turma: string | null; turno: string | null;
  divida_total: number; total_multas: number;
  propinas_vencidas: number; propinas_pendentes: number;
}
interface Propina {
  id: number; mes: string; ano: string;
  valor_base: number; multa: number; total: number;
  desconto: number;
  bolsa_atribuicao_id: number | null;
  estado: "PENDENTE" | "PAGO" | "VENCIDO";
  data_vencimento: string;
  pagamento_id: number | null; entidade: string | null;
  referencia: string | null; ref_valor: number | null;
  ref_estado: string | null; validade: string | null;
}
interface GeneratedRef {
  entidade: string; referencia: string; valor: number; validade: string;
  total_emolumentos?: number;
  propinas: { id: number; mes: string; ano: string; valor_base: number; multa: number; total: number; }[];
  cobrancas?: { id: number; descricao: string; montante: string; quantidade: number; emolumento_nome?: string; }[];
}
interface EmolItem {
  emolumento_id: number | null;
  student_id: number | null;
  descricao: string;
  montante: number;
  quantidade: number;
}
interface GPOResult {
  transaction_id: string; redirect_url: string; valor: number;
  propinas: { id: number; mes: string; ano: string; valor_base: number; multa: number; total: number; }[];
}
interface Ocorrencia {
  id: number; tipo: string; descricao: string; registado_por: string;
  data_ocorrencia: string; created_at: string;
}
interface Comunicado {
  id: number; titulo: string; conteudo: string;
  prioridade: "normal" | "urgente" | "informativo";
  created_at: string; lido: boolean;
}
interface AvailableMethods {
  allow_reference: boolean;
  allow_gpo_mcx: boolean;
  allow_direct_debit: boolean;
  direct_debit: { banco_parceiro: string; instrucoes: string; } | null;
}
interface DDSubscription {
  id: number;
  encarregado_id: number;
  school_id: number;
  status: "active" | "cancellation_requested" | "cancelled";
  iban: string;
  emolumentos: string[];
  debit_day: number;
  email: string | null;
  created_at: string;
  activated_at: string | null;
  cancellation_requested_at: string | null;
  cancelled_at: string | null;
}
type Screen = "login" | "change-password" | "dashboard";
type FilterEstado = "TODOS" | "PENDENTE" | "VENCIDO" | "PAGO";
type StudentTab = "propinas" | "ocorrencias";
type ActiveMenu = "facturas" | "ocorrencias" | "comunicados" | "avaliacoes" | "loja" | "inf_rotinas" | "inf_ementa" | "inf_galeria";

const TIPO_COLORS_ENC: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  "Comportamento Inadequado": { bg:"bg-red-50", text:"text-red-700", border:"border-red-200", dot:"bg-red-500" },
  "Medida Disciplinar":       { bg:"bg-orange-50", text:"text-orange-700", border:"border-orange-200", dot:"bg-orange-500" },
  "Ausência Injustificada":   { bg:"bg-amber-50", text:"text-amber-700", border:"border-amber-200", dot:"bg-amber-500" },
  "Atraso Repetido":          { bg:"bg-yellow-50", text:"text-yellow-700", border:"border-yellow-200", dot:"bg-yellow-500" },
  "Incidente Académico":      { bg:"bg-purple-50", text:"text-purple-700", border:"border-purple-200", dot:"bg-purple-500" },
  "Elogio / Mérito":          { bg:"bg-emerald-50", text:"text-emerald-700", border:"border-emerald-200", dot:"bg-emerald-500" },
  "Comunicação aos Pais":     { bg:"bg-blue-50", text:"text-blue-700", border:"border-blue-200", dot:"bg-blue-500" },
  "Outro":                    { bg:"bg-gray-50", text:"text-gray-600", border:"border-gray-200", dot:"bg-gray-400" },
};
function tipoBadgeEnc(tipo: string) {
  const c = TIPO_COLORS_ENC[tipo] ?? TIPO_COLORS_ENC["Outro"];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${c.bg} ${c.text} ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}/>{tipo}
    </span>
  );
}

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
    <button onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(()=>setCopied(false),2000); })}
      className="flex items-center gap-1 p-1.5 rounded-lg hover:bg-gray-100 transition-colors" title="Copiar">
      {copied ? <Check size={14} className="text-emerald-600"/> : <Copy size={14} className="text-gray-400"/>}
    </button>
  );
}

function PasswordInput({ value, onChange, placeholder, label, autoComplete }: {
  value: string; onChange: (v: string)=>void; placeholder?: string; label: string; autoComplete?: string;
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
          autoComplete={autoComplete ?? "current-password"}
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

/* ─── School color palette (consistent per school ID) ─── */
const SCHOOL_COLORS = [
  "from-blue-500 to-blue-700", "from-emerald-500 to-teal-700",
  "from-violet-500 to-purple-700", "from-orange-500 to-amber-600",
  "from-rose-500 to-pink-700", "from-cyan-500 to-sky-700",
];
function schoolColor(schoolId: number) { return SCHOOL_COLORS[schoolId % SCHOOL_COLORS.length]; }
function schoolInitials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join("").toUpperCase(); }

function SchoolBadge({ name, logoUrl, schoolId, size = "sm" }: { name: string; logoUrl: string | null; schoolId: number; size?: "sm"|"md" }) {
  const dim = size === "md" ? "w-8 h-8 text-sm" : "w-6 h-6 text-[10px]";
  return (
    <div className="flex items-center gap-1.5">
      {logoUrl ? (
        <img src={logoUrl} alt={name} className={`${dim} rounded-lg object-cover border border-white/30`}/>
      ) : (
        <div className={`${dim} rounded-lg bg-gradient-to-br ${schoolColor(schoolId)} flex items-center justify-center text-white font-bold shrink-0`}>
          {schoolInitials(name)}
        </div>
      )}
      <span className="text-xs font-semibold text-gray-600 leading-tight truncate max-w-[140px]">{name}</span>
    </div>
  );
}

/* ─── Pre-existing reference modal (from backoffice) ─── */
function RefModal({ propina, onClose, schoolName }: { propina: Propina; onClose: ()=>void; schoolName?: string }) {
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
          {schoolName && <p className="text-blue-200 text-xs mt-0.5 flex items-center gap-1"><span className="opacity-70">Beneficiário:</span> <span className="font-semibold">{schoolName}</span></p>}
        </div>
        <div className="p-5 space-y-4">
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
            <p className="text-blue-800 text-xs">Pague via Multicaixa Express, ATM ou internet banking com a entidade, referência e valor exatos.</p>
          </div>
          <button onClick={copyAll}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors flex items-center justify-center gap-2">
            {copiedAll ? <><Check size={16}/>Copiado!</> : <><Copy size={16}/>Copiar Dados de Pagamento</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Combined reference modal (generated for multiple months) ─── */
function CombinedRefModal({ ref: generated, onClose, schoolName }: { ref: GeneratedRef; onClose: ()=>void; schoolName?: string }) {
  const [copiedAll, setCopiedAll] = useState(false);
  const refFmt = generated.referencia.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3");

  const copyAll = () => {
    const txt = `Entidade: ${generated.entidade}\nReferência: ${generated.referencia}\nValor: ${fmt(generated.valor)}\nValidade: ${fmtDate(generated.validade)}`;
    navigator.clipboard.writeText(txt).then(()=>{ setCopiedAll(true); setTimeout(()=>setCopiedAll(false),2500); });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"/>
      <motion.div initial={{y:80,opacity:0}} animate={{y:0,opacity:1}} exit={{y:80,opacity:0}}
        transition={{type:"spring",stiffness:300,damping:30}}
        className="relative w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-2xl"
        onClick={e=>e.stopPropagation()}>
        <div className="bg-gradient-to-r from-emerald-700 to-emerald-600 p-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Zap size={18}/><span className="font-semibold">Referência Combinada</span></div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"><X size={16}/></button>
          </div>
          <p className="text-emerald-100 text-sm mt-1">{generated.propinas.length} {generated.propinas.length===1?"mês":"meses"} selecionado{generated.propinas.length===1?"":"s"}</p>
          {schoolName && <p className="text-emerald-200 text-xs mt-0.5 flex items-center gap-1"><span className="opacity-70">Beneficiário:</span> <span className="font-semibold">{schoolName}</span></p>}
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Entidade</p>
              <p className="text-3xl font-bold text-gray-900 font-mono">{generated.entidade}</p>
            </div>
            <div className="border-t pt-3">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Referência</p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold text-emerald-700 font-mono tracking-widest">{refFmt}</p>
                <CopyBtn text={generated.referencia}/>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t pt-3">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Total a pagar</p>
                <p className="font-bold text-gray-900 text-lg">{fmt(generated.valor)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Válida até</p>
                <p className="font-semibold text-gray-900 text-sm">{fmtShort(generated.validade)}</p>
              </div>
            </div>
          </div>

          {/* Breakdown */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Detalhe dos meses</p>
            <div className="space-y-1.5">
              {generated.propinas.map((p, i) => (
                <div key={i} className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2 text-sm">
                  <span className="text-gray-700 font-medium">{p.mes} {p.ano}</span>
                  <div className="text-right">
                    <span className="font-semibold text-gray-900">{fmt(p.total)}</span>
                    {p.multa > 0 && <span className="text-red-500 text-xs ml-1">(+{fmt(p.multa)} multa)</span>}
                  </div>
                </div>
              ))}
              <div className="flex justify-between items-center border-t pt-2 px-3 text-sm font-bold">
                <span className="text-gray-900">Total</span>
                <span className="text-emerald-700">{fmt(generated.valor)}</span>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex gap-2">
            <Info size={15} className="text-blue-500 shrink-0 mt-0.5"/>
            <p className="text-blue-800 text-xs">Uma única referência para pagar todos os meses selecionados. Use via Multicaixa Express, ATM ou internet banking.</p>
          </div>

          <button onClick={copyAll}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors flex items-center justify-center gap-2">
            {copiedAll ? <><Check size={16}/>Copiado!</> : <><Copy size={16}/>Copiar Dados de Pagamento</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Checkout Wizard (3-step payment flow) ─── */
function CheckoutWizard({
  propinas, total, availableMethods, token, schoolName, alunos, onClose, onSuccess,
}: {
  propinas: Propina[]; total: number; availableMethods: AvailableMethods;
  token: string; schoolName?: string; alunos?: Student[];
  onClose: () => void; onSuccess: (ref?: GeneratedRef) => void;
}) {
  const hasBoth = availableMethods.allow_reference && availableMethods.allow_gpo_mcx;
  const effectiveDefault = availableMethods.allow_reference ? "reference" : "gpo_mcx";
  const [step, setStep] = useState(1);
  const [method, setMethod] = useState<"reference" | "gpo_mcx">(effectiveDefault);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refResult, setRefResult] = useState<GeneratedRef | null>(null);
  const [gpoResult, setGpoResult] = useState<GPOResult | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [emolList, setEmolList] = useState<{id:number;tipo:string;nome:string;montante:string}[]>([]);
  const [emolItems, setEmolItems] = useState<EmolItem[]>([]);
  const [selEmolId, setSelEmolId] = useState("");
  const [selStudentId, setSelStudentId] = useState("");
  const [selQty, setSelQty] = useState(1);
  const [emolOpen, setEmolOpen] = useState(false);

  useEffect(() => {
    fetch(`${API}/guardian/emolumentos`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setEmolList(d); }).catch(() => {});
  }, [token]);

  const emolTotal = emolItems.reduce((s, i) => s + i.montante * i.quantidade, 0);
  const grandTotal = total + emolTotal;

  const addEmol = () => {
    if (!selEmolId) return;
    const found = emolList.find(e => e.id === Number(selEmolId));
    if (!found) return;
    setEmolItems(prev => [...prev, {
      emolumento_id: found.id,
      student_id: selStudentId ? Number(selStudentId) : null,
      descricao: found.nome,
      montante: Number(found.montante),
      quantidade: selQty,
    }]);
    setSelEmolId(""); setSelStudentId(""); setSelQty(1);
  };

  const totalSteps = hasBoth ? 3 : 2;
  const STEP_LABELS = hasBoth ? ["Resumo", "Método", "Confirmação"] : ["Resumo", "Confirmação"];
  const effectiveMethod = hasBoth ? method : effectiveDefault;
  const isLastStep = step === totalSteps;
  const isActionStep = step === (hasBoth ? 2 : 1);

  const handleProceed = async () => {
    setError(""); setLoading(true);
    try {
      const ids = propinas.map(p => p.id);
      if (effectiveMethod === "reference") {
        const res = await fetch(`${API}/guardian/pagamentos/gerar`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ propina_ids: ids, method: "reference", emolumento_items: emolItems }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Erro ao gerar referência.");
        setRefResult(data);
        setStep(totalSteps);
        onSuccess(data);
      } else {
        const res = await fetch(`${API}/guardian/pagamentos/gpo-checkout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ propina_ids: ids }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Erro ao iniciar pagamento GPO.");
        setGpoResult(data);
        setStep(totalSteps);
      }
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const copyRefAll = () => {
    if (!refResult) return;
    const txt = `Entidade: ${refResult.entidade}\nReferência: ${refResult.referencia}\nValor: ${fmt(refResult.valor)}\nValidade: ${fmtDate(refResult.validade)}`;
    navigator.clipboard.writeText(txt).then(() => { setCopiedAll(true); setTimeout(() => setCopiedAll(false), 2500); });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"/>
      <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 30 }}
        className="relative w-full sm:max-w-lg bg-white sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-blue-600 px-5 py-4 text-white shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Banknote size={18}/>
              <span className="font-semibold">Pagar Propinas</span>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors">
              <X size={16}/>
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            {STEP_LABELS.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5 flex-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all
                  ${step > i+1 ? "bg-emerald-400 text-white" : step === i+1 ? "bg-white text-blue-700" : "bg-white/20 text-white/60"}`}>
                  {step > i+1 ? <Check size={12}/> : i+1}
                </div>
                <span className={`text-xs whitespace-nowrap hidden sm:block ${step === i+1 ? "text-white font-semibold" : "text-white/50"}`}>{s}</span>
                {i < STEP_LABELS.length - 1 && <div className="flex-1 h-px bg-white/20 mx-1"/>}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Step 1: Summary */}
          {step === 1 && (
            <>
              <div>
                <p className="font-semibold text-gray-900 mb-1">Resumo do pagamento</p>
                {schoolName && (
                  <p className="text-xs text-gray-500 mb-3">
                    <span className="opacity-70">Beneficiário:</span>{" "}
                    <span className="font-semibold text-gray-700">{schoolName}</span>
                  </p>
                )}
                <div className="space-y-2">
                  {propinas.map((p, i) => (
                    <div key={i} className={`flex justify-between items-center rounded-xl px-3 py-2.5 text-sm ${
                      p.estado === "VENCIDO" ? "bg-red-50 border border-red-100" : "bg-gray-50"}`}>
                      <div>
                        <span className="font-semibold text-gray-900">{p.mes} {p.ano}</span>
                        {Number(p.multa) > 0 && <span className="ml-2 text-xs text-red-500 font-medium">+multa</span>}
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-gray-900">{fmt(p.total)}</span>
                        {Number(p.multa) > 0 && (
                          <p className="text-xs text-red-400">{fmt(p.valor_base)} + {fmt(p.multa)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center border-t-2 border-gray-200 pt-2 px-3">
                    <span className={`font-bold text-gray-900 ${emolItems.length > 0 ? "text-sm" : ""}`}>
                      {emolItems.length > 0 ? "Subtotal Propinas" : "Total"}
                    </span>
                    <span className={`font-bold text-blue-700 ${emolItems.length > 0 ? "" : "text-lg"}`}>{fmt(total)}</span>
                  </div>
                  {emolItems.map((item, i) => (
                    <div key={i} className="flex justify-between items-center bg-blue-50 rounded-lg px-3 py-2 text-sm">
                      <div className="flex-1 min-w-0">
                        <span className="text-gray-700 font-medium truncate">{item.descricao}</span>
                        {item.quantidade > 1 && <span className="text-gray-500 text-xs ml-1">×{item.quantidade}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{fmt(item.montante * item.quantidade)}</span>
                        <button onClick={() => setEmolItems(prev => prev.filter((_,j) => j !== i))}
                          className="text-gray-400 hover:text-red-500 transition-colors"><X size={14}/></button>
                      </div>
                    </div>
                  ))}
                  {emolItems.length > 0 && (
                    <div className="flex justify-between items-center border-t-2 border-blue-200 pt-2 px-3">
                      <span className="font-bold text-gray-900">Total</span>
                      <span className="font-bold text-blue-700 text-lg">{fmt(grandTotal)}</span>
                    </div>
                  )}
                </div>
              </div>


              {propinas.some(p => Number(p.multa) > 0) && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2">
                  <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5"/>
                  <p className="text-red-700 text-xs">Este pagamento inclui multas por atraso. O valor total já contempla as penalizações aplicadas.</p>
                </div>
              )}
              {!hasBoth && (
                <div className={`rounded-xl p-3 flex gap-2 ${effectiveDefault === "gpo_mcx" ? "bg-emerald-50 border border-emerald-200" : "bg-blue-50 border border-blue-200"}`}>
                  {effectiveDefault === "gpo_mcx"
                    ? <Zap size={14} className="text-emerald-500 shrink-0 mt-0.5"/>
                    : <CreditCard size={14} className="text-blue-500 shrink-0 mt-0.5"/>}
                  <p className={`text-xs ${effectiveDefault === "gpo_mcx" ? "text-emerald-800" : "text-blue-800"}`}>
                    {effectiveDefault === "gpo_mcx"
                      ? "Será redirecionado para o portal EMIS/GPO para concluir o pagamento em tempo real."
                      : "Será gerada uma referência de pagamento para usar no ATM, Multicaixa ou internet banking."}
                  </p>
                </div>
              )}
            </>
          )}

          {/* Step 2 (only when hasBoth): Method selection */}
          {hasBoth && step === 2 && (
            <>
              <div>
                <p className="font-semibold text-gray-900 mb-1">Método de pagamento</p>
                <p className="text-xs text-gray-500 mb-3">
                  Selecione como pretende pagar <span className="font-semibold text-gray-800">{fmt(grandTotal)}</span>.
                </p>
                <div className="space-y-3">
                  <button onClick={() => setMethod("reference")}
                    className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all
                      ${method === "reference" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${method === "reference" ? "bg-blue-100" : "bg-gray-100"}`}>
                      <CreditCard size={18} className={method === "reference" ? "text-blue-600" : "text-gray-400"}/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-semibold text-gray-900 text-sm">Referência Bancária</p>
                        {method === "reference" && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">Seleccionado</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">ATM, internet banking ou Multicaixa com entidade e referência.</p>
                      <div className="flex gap-1.5 mt-1.5">
                        {["ATM","Multicaixa","Internet Banking"].map(l => (
                          <span key={l} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">{l}</span>
                        ))}
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all
                      ${method === "reference" ? "border-blue-500 bg-blue-500" : "border-gray-300"}`}>
                      {method === "reference" && <div className="w-2 h-2 rounded-full bg-white"/>}
                    </div>
                  </button>

                  <button onClick={() => setMethod("gpo_mcx")}
                    className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all
                      ${method === "gpo_mcx" ? "border-emerald-500 bg-emerald-50" : "border-gray-200 hover:border-gray-300"}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${method === "gpo_mcx" ? "bg-emerald-100" : "bg-gray-100"}`}>
                      <Zap size={18} className={method === "gpo_mcx" ? "text-emerald-600" : "text-gray-400"}/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-semibold text-gray-900 text-sm">Multicaixa Express / GPO</p>
                        {method === "gpo_mcx" && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">Seleccionado</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">Pagamento online imediato via portal GPO ou app Multicaixa Express.</p>
                      <div className="flex gap-1.5 mt-1.5">
                        {["Tempo Real","Online","MCX Express"].map(l => (
                          <span key={l} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">{l}</span>
                        ))}
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all
                      ${method === "gpo_mcx" ? "border-emerald-500 bg-emerald-500" : "border-gray-300"}`}>
                      {method === "gpo_mcx" && <div className="w-2 h-2 rounded-full bg-white"/>}
                    </div>
                  </button>
                </div>
              </div>
              <AnimatePresence>
                {error && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2">
                    <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5"/>
                    <p className="text-red-700 text-sm">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}

          {/* Last step: Result */}
          {isLastStep && (
            <>
              {/* Reference result */}
              {refResult && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                      <CheckCircle size={20} className="text-emerald-600"/>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">Referência gerada com sucesso</p>
                      <p className="text-xs text-gray-500">
                        {refResult.propinas.length} {refResult.propinas.length === 1 ? "mês" : "meses"} —
                        válida até <span className="font-semibold">{fmtShort(refResult.validade)}</span>
                      </p>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Entidade</p>
                      <p className="text-3xl font-bold text-gray-900 font-mono">{refResult.entidade}</p>
                    </div>
                    <div className="border-t pt-3">
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Referência</p>
                      <div className="flex items-center gap-2">
                        <p className="text-2xl font-bold text-blue-700 font-mono tracking-widest">
                          {refResult.referencia.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3")}
                        </p>
                        <CopyBtn text={refResult.referencia}/>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 border-t pt-3">
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Total a pagar</p>
                        <p className="font-bold text-gray-900 text-lg">{fmt(refResult.valor)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Válida até</p>
                        <p className="font-semibold text-gray-900 text-sm">{fmtShort(refResult.validade)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {refResult.propinas.map((p, i) => (
                      <div key={i} className="flex justify-between text-xs bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-gray-700 font-medium">{p.mes} {p.ano}</span>
                        <span className="font-semibold text-gray-900">
                          {fmt(p.total)}
                          {p.multa > 0 && <span className="text-red-500 ml-1">(+{fmt(p.multa)})</span>}
                        </span>
                      </div>
                    ))}
                    {refResult.cobrancas && refResult.cobrancas.length > 0 && (
                      <>
                        {refResult.cobrancas.map((c, i) => (
                          <div key={`c-${i}`} className="flex justify-between text-xs bg-blue-50 rounded-lg px-3 py-2">
                            <span className="text-gray-700 font-medium">
                              {c.descricao}{Number(c.quantidade) > 1 ? ` ×${c.quantidade}` : ""}
                            </span>
                            <span className="font-semibold text-gray-900">
                              {fmt(Number(c.montante) * Number(c.quantidade))}
                            </span>
                          </div>
                        ))}
                        <div className="flex justify-between text-xs px-3 py-1 text-blue-700 font-semibold">
                          <span>Emolumentos</span>
                          <span>{fmt(refResult.total_emolumentos ?? 0)}</span>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex gap-2">
                    <Info size={14} className="text-blue-500 shrink-0 mt-0.5"/>
                    <p className="text-blue-800 text-xs">Use esta referência no ATM, Multicaixa Express ou internet banking com a entidade, referência e valor exactos.</p>
                  </div>
                  <button onClick={copyRefAll}
                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors flex items-center justify-center gap-2">
                    {copiedAll ? <><Check size={16}/>Copiado!</> : <><Copy size={16}/>Copiar Dados de Pagamento</>}
                  </button>
                </motion.div>
              )}

              {/* GPO result */}
              {gpoResult && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                      <ShieldCheck size={20} className="text-emerald-600"/>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">Sessão GPO criada e registada</p>
                      <p className="text-xs text-gray-500">O registo de auditoria foi guardado antes do redirecionamento.</p>
                    </div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Total a pagar</p>
                      <p className="font-bold text-emerald-800 text-2xl">{fmt(gpoResult.valor)}</p>
                    </div>
                    <div className="border-t border-emerald-200 pt-3">
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">ID da transacção</p>
                      <p className="font-mono text-xs text-gray-700 break-all">{gpoResult.transaction_id}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {gpoResult.propinas.map((p, i) => (
                      <div key={i} className="flex justify-between text-xs bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-gray-700 font-medium">{p.mes} {p.ano}</span>
                        <span className="font-semibold text-gray-900">
                          {fmt(p.total)}
                          {p.multa > 0 && <span className="text-red-500 ml-1">(+{fmt(p.multa)})</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
                    <ShieldCheck size={14} className="text-amber-600 shrink-0 mt-0.5"/>
                    <p className="text-amber-800 text-xs">A sua tentativa de pagamento foi registada. Será redirecionado para o portal EMIS/GPO para concluir. Em caso de dúvida, use a referência interna acima.</p>
                  </div>
                  <a href={gpoResult.redirect_url} target="_blank" rel="noopener noreferrer"
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors flex items-center justify-center gap-2">
                    <Zap size={16}/> Ir para o Portal GPO / MCX Express
                  </a>
                </motion.div>
              )}

              {/* Error on final step (no result yet) */}
              {!refResult && !gpoResult && (
                <div className="flex flex-col items-center py-8 gap-4 text-center">
                  <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center">
                    <AlertTriangle size={26} className="text-red-500"/>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Erro ao processar</p>
                    <p className="text-sm text-gray-500 mt-1">{error || "Ocorreu um erro inesperado."}</p>
                  </div>
                  <button onClick={() => { setStep(hasBoth ? 2 : 1); setError(""); }}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors">
                    <ChevronLeft size={15}/> Tentar novamente
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer navigation */}
        {!isLastStep && (
          <div className="border-t border-gray-100 px-5 py-4 flex gap-3 shrink-0">
            {step > 1 ? (
              <button onClick={() => { setStep(s => s - 1); setError(""); }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors">
                <ChevronLeft size={16}/> Anterior
              </button>
            ) : (
              <button onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-semibold hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
            )}
            <div className="flex-1"/>
            {isActionStep ? (
              <button onClick={handleProceed} disabled={loading}
                className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-colors disabled:opacity-60
                  ${effectiveMethod === "gpo_mcx" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-700"}`}>
                {loading
                  ? <><RefreshCw size={15} className="animate-spin"/>A processar...</>
                  : effectiveMethod === "gpo_mcx"
                    ? <><Zap size={15}/>Iniciar GPO / MCX</>
                    : <><CreditCard size={15}/>Gerar Referência</>}
              </button>
            ) : (
              <button onClick={() => setStep(s => s + 1)}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors">
                Seguinte <ChevronRight size={16}/>
              </button>
            )}
          </div>
        )}
        {isLastStep && (
          <div className="border-t border-gray-100 px-5 py-4 shrink-0">
            <button onClick={onClose}
              className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-semibold hover:bg-gray-50 transition-colors">
              Fechar
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

/* ─── Recuperar PIN Modal ─── */
function RecuperarPinModal({ onClose }: { onClose: () => void }) {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    const clean = phone.replace(/\D/g, "");
    if (clean.length < 9) return setError("Introduza um número de telemóvel válido.");
    setLoading(true);
    try {
      const res = await fetch(`${API}/guardian/recuperar-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefone: clean }),
      });
      let data: any = {};
      try { data = await res.json(); } catch {}
      if (!res.ok) throw new Error(data.error ?? "Erro ao repor o PIN. Tente novamente.");
      setSuccess(data.nome);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, y: 48 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 48 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="relative w-full max-w-sm bg-slate-900 border border-white/15 rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
              <RotateCcw className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm">Recuperar Palavra-passe</h3>
              <p className="text-slate-400 text-xs">Portal do Encarregado</p>
            </div>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-5">
          {!success ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-slate-300 text-sm leading-relaxed">
                Introduza o número de telemóvel associado à sua conta. O PIN será reposto
                para o valor padrão e terá de criar um novo PIN no próximo acesso.
              </p>
              <div>
                <label className="block text-blue-200 text-sm font-medium mb-2">Número de Telemóvel</label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                    <span className="text-white/60 text-sm font-medium">+244</span>
                    <span className="w-px h-4 bg-white/25" />
                  </div>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="943 612 744" autoComplete="tel"
                    className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl pl-[72px] pr-4 py-3 font-mono tracking-wide focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all" />
                </div>
              </div>
              <AnimatePresence>
                {error && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="bg-red-500/20 border border-red-400/30 rounded-xl px-3 py-2.5 flex items-center gap-2">
                    <AlertTriangle size={14} className="text-red-300 shrink-0" />
                    <p className="text-red-200 text-sm">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>
              <button type="submit" disabled={loading}
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-white/20 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                {loading ? <RefreshCw size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                {loading ? "A repor..." : "Repor PIN"}
              </button>
              <button type="button" onClick={onClose}
                className="w-full py-2.5 text-slate-400 text-sm hover:text-slate-200 transition-colors">
                Cancelar
              </button>
            </form>
          ) : (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4 text-center">
              <div className="w-14 h-14 bg-emerald-500/20 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle size={26} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-white font-semibold text-base">PIN Reposto com Sucesso!</p>
                <p className="text-slate-400 text-sm mt-1">Olá, <span className="text-white font-medium">{success}</span>.</p>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-left space-y-2">
                <p className="text-amber-200 text-sm font-medium flex items-center gap-2">
                  <Phone size={14} /> Use o PIN temporário para entrar:
                </p>
                <p className="text-amber-100 text-3xl font-bold font-mono tracking-[0.3em] text-center py-2">1234</p>
                <p className="text-amber-300/80 text-xs text-center">
                  Será obrigado a criar um novo PIN seguro após o acesso.
                </p>
              </div>
              <button onClick={onClose}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-semibold py-3 rounded-xl transition-colors">
                Ir para o Login
              </button>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* ─── DD helpers ─── */
const EMOLUMENTOS_OPCOES = [
  { id: "propina",    label: "Propina mensal",                desc: "Mensalidade escolar mensal" },
  { id: "transporte", label: "Serviço de Transporte",         desc: "Taxa mensal de transporte escolar" },
  { id: "refeicao",   label: "Serviço de Refeição",           desc: "Cantina e refeições escolares" },
  { id: "atividades", label: "Actividades Extracurriculares", desc: "Aulas e actividades opcionais" },
];

const EMOLUMENTO_LABEL: Record<string, string> = {
  propina: "Propina mensal", transporte: "Transporte", refeicao: "Refeição", atividades: "Actividades",
};

const TERMOS_DD = `CONTRATO DE AUTORIZAÇÃO DE DÉBITO DIRETO

1. AUTORIZAÇÃO
O Encarregado de Educação (doravante "Titular"), ao aceitar estes termos, autoriza expressamente o Estabelecimento de Ensino (doravante "Colégio") a debitar automaticamente na conta bancária indicada, através do banco parceiro, os montantes correspondentes aos serviços selecionados.

2. SERVIÇOS COBERTOS
Apenas os serviços selecionados aquando da adesão serão debitados automaticamente. O Titular pode consultar os serviços ativos no Portal do Encarregado.

3. PERIODICIDADE E DATA DE DÉBITO
Os débitos são processados mensalmente na data indicada pelo Titular, salvo indicação contrária. Caso a data recaia num dia não útil, o débito é processado no dia útil imediatamente seguinte.

4. NOTIFICAÇÃO PRÉVIA
O Colégio compromete-se a notificar o Titular com pelo menos 5 (cinco) dias úteis de antecedência em caso de alteração do valor a debitar.

5. CANCELAMENTO
O Titular pode solicitar o cancelamento do débito direto através do Portal do Encarregado. O cancelamento está sujeito a validação e aprovação pelo Colégio e produz efeitos no mês seguinte à aprovação.

6. RESPONSABILIDADE
O Titular é responsável por manter saldo suficiente na conta indicada. Em caso de recusa do débito por insuficiência de fundos, o Colégio reserva-se o direito de aplicar encargos previstos no Regulamento Interno.

7. DADOS PESSOAIS
Os dados fornecidos são tratados de acordo com a política de privacidade do Colégio e da plataforma Kiwara Tech, exclusivamente para efeitos de processamento dos pagamentos autorizados.

Ao confirmar a adesão, o Titular declara ter lido, compreendido e aceite integralmente estes Termos e Condições.`;

function maskIban(iban: string): string {
  const clean = iban.replace(/[.\s]/g, "");
  if (clean.length < 8) return iban;
  return clean.slice(0, 4) + "·····" + clean.slice(-4);
}

function nextDebitDates(day: number, count = 6): Date[] {
  const dates: Date[] = [];
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  while (dates.length < count) {
    const d = new Date(year, month, day);
    if (d > now) dates.push(d);
    month++;
    if (month > 11) { month = 0; year++; }
  }
  return dates;
}

/* ─── DirectDebitWizard ─── */
function DirectDebitWizard({ onClose, onSuccess, availableMethods, token }: {
  onClose: () => void;
  onSuccess: (sub: DDSubscription) => void;
  availableMethods: AvailableMethods;
  token: string;
}) {
  const [step, setStep] = useState(1);
  const [emolumentos, setEmolumentos] = useState<string[]>(["propina"]);
  const [iban, setIban] = useState("");
  const [debitDay, setDebitDay] = useState(5);
  const [email, setEmail] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const dates = useMemo(() => nextDebitDates(debitDay), [debitDay]);

  const toggleEmol = (id: string) =>
    setEmolumentos(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]);

  const handleSubmit = async () => {
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API}/guardian/direct-debit/subscribe`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ iban, emolumentos, debit_day: debitDay, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao registar subscrição.");
      setSuccess(true);
      setTimeout(() => { onSuccess(data.subscription); onClose(); }, 2200);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const STEPS = ["Emolumentos", "Cronograma", "Termos e Confirmação"];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"/>
      <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 30 }}
        className="relative w-full sm:max-w-lg bg-white sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="bg-gradient-to-r from-violet-700 to-violet-600 px-5 py-4 text-white shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ArrowLeftRight size={18}/>
              <span className="font-semibold">Adesão ao Débito Direto</span>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors">
              <X size={16}/>
            </button>
          </div>
          {/* Step indicators */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5 flex-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all
                  ${step > i+1 ? "bg-emerald-400 text-white" : step === i+1 ? "bg-white text-violet-700" : "bg-white/20 text-white/60"}`}>
                  {step > i+1 ? <Check size={12}/> : i+1}
                </div>
                <span className={`text-xs whitespace-nowrap hidden sm:block ${step === i+1 ? "text-white font-semibold" : "text-white/50"}`}>{s}</span>
                {i < STEPS.length - 1 && <div className="flex-1 h-px bg-white/20 mx-1"/>}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── Step 1: Emolumentos + IBAN + Dia ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <p className="font-semibold text-gray-900 mb-1">O que deseja debitar automaticamente?</p>
                <p className="text-xs text-gray-500 mb-3">Selecione os serviços a incluir no débito mensal.</p>
                <div className="space-y-2">
                  {EMOLUMENTOS_OPCOES.map(opt => {
                    const sel = emolumentos.includes(opt.id);
                    return (
                      <button key={opt.id} onClick={() => toggleEmol(opt.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all
                          ${sel ? "border-violet-500 bg-violet-50" : "border-gray-200 hover:border-gray-300"}`}>
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all
                          ${sel ? "bg-violet-600 border-violet-600" : "border-gray-300"}`}>
                          {sel && <Check size={12} className="text-white"/>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold ${sel ? "text-violet-800" : "text-gray-800"}`}>{opt.label}</p>
                          <p className="text-xs text-gray-400">{opt.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">IBAN da conta a debitar</label>
                <input value={iban} onChange={e => setIban(e.target.value)}
                  placeholder="AO06.0044.0000.0000.0000.0000.0"
                  className="w-full border-2 border-gray-200 focus:border-violet-400 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-400/20 transition-all"/>
                <p className="text-xs text-gray-400 mt-1">Conta bancária associada ao banco parceiro {availableMethods.direct_debit?.banco_parceiro ?? ""}.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Dia do débito mensal</label>
                <div className="flex items-center gap-3">
                  <input type="range" min={1} max={28} value={debitDay} onChange={e => setDebitDay(Number(e.target.value))}
                    className="flex-1 accent-violet-600"/>
                  <span className="w-12 text-center font-bold text-violet-700 text-lg shrink-0">Dia {debitDay}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">O débito será processado todo o mês no dia {debitDay}.</p>
              </div>
            </div>
          )}

          {/* ── Step 2: Cronograma e Transparência ── */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <p className="font-semibold text-gray-900 mb-1">Detalhe do serviço</p>
                <p className="text-xs text-gray-500 mb-3">Reveja o resumo antes de continuar.</p>

                <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-violet-800 text-sm font-semibold mb-2">
                    <ArrowLeftRight size={15}/> Resumo da subscrição
                  </div>
                  <div className="text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Conta (IBAN)</span>
                      <span className="font-mono font-semibold text-gray-800">{maskIban(iban)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Dia do débito</span>
                      <span className="font-semibold text-gray-800">Todo o mês no dia {debitDay}</span>
                    </div>
                    {availableMethods.direct_debit?.banco_parceiro && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Banco parceiro</span>
                        <span className="font-semibold text-gray-800">{availableMethods.direct_debit.banco_parceiro}</span>
                      </div>
                    )}
                  </div>
                  <div className="border-t border-violet-200 pt-2 mt-2">
                    <p className="text-xs text-gray-500 mb-1.5">Serviços incluídos:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {emolumentos.map(e => (
                        <span key={e} className="text-xs px-2.5 py-1 rounded-full bg-violet-100 text-violet-700 font-semibold">
                          {EMOLUMENTO_LABEL[e] ?? e}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                  <Calendar size={14}/> Cronograma de débitos previstos
                </p>
                <div className="space-y-1.5">
                  {dates.map((d, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${i === 0 ? "bg-violet-500" : "bg-gray-300"}`}/>
                        <span className="text-sm text-gray-700">
                          {d.toLocaleDateString("pt-AO", { day: "2-digit", month: "long", year: "numeric" })}
                        </span>
                      </div>
                      {i === 0 && <span className="text-xs font-semibold text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full">Próximo</span>}
                    </div>
                  ))}
                </div>
                <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
                  <Info size={14} className="text-amber-500 shrink-0 mt-0.5"/>
                  <p className="text-xs text-amber-700">Os valores exactos de cada débito serão os correspondentes às propinas e serviços em vigor em cada mês. Será notificado com antecedência em caso de alteração.</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: T&C + Email + Confirmação ── */}
          {step === 3 && !success && (
            <div className="space-y-4">
              <div>
                <p className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                  <FileText size={16} className="text-violet-600"/> Termos e Condições
                </p>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 h-48 overflow-y-auto text-xs text-gray-600 leading-relaxed whitespace-pre-line font-mono">
                  {TERMOS_DD}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <Send size={14} className="text-violet-500"/> E-mail para envio do contrato
                  <span className="text-xs font-normal text-gray-400">(opcional)</span>
                </label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="encarregado@exemplo.com"
                  className="w-full border-2 border-gray-200 focus:border-violet-400 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/20 transition-all"/>
                <p className="text-xs text-gray-400 mt-1">O contrato de débito direto será enviado para este endereço.</p>
              </div>

              <label className="flex items-start gap-2 cursor-pointer p-3 rounded-xl border-2 border-gray-200 hover:border-violet-300 transition-colors">
                <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)}
                  className="mt-0.5 accent-violet-600 w-4 h-4 shrink-0"/>
                <span className="text-sm text-gray-700 leading-snug">
                  Li, compreendi e aceito os <span className="text-violet-600 font-semibold">Termos e Condições</span> do débito direto e autorizo o processamento automático dos montantes correspondentes.
                </span>
              </label>

              <AnimatePresence>
                {error && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2">
                    <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5"/>
                    <p className="text-red-700 text-sm">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* ── Success ── */}
          {success && (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center justify-center py-8 text-center gap-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center">
                <BadgeCheck size={32} className="text-emerald-600"/>
              </div>
              <div>
                <p className="font-bold text-gray-900 text-lg">Adesão confirmada!</p>
                <p className="text-gray-500 text-sm mt-1">O seu débito direto está activo.</p>
                {email && <p className="text-xs text-gray-400 mt-2">Contrato enviado para <span className="font-semibold">{email}</span></p>}
              </div>
            </motion.div>
          )}
        </div>

        {/* Footer buttons */}
        {!success && (
          <div className="border-t border-gray-100 px-5 py-4 flex gap-3 shrink-0">
            {step > 1 ? (
              <button onClick={() => setStep(s => s - 1)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors">
                <ChevronLeft size={16}/> Anterior
              </button>
            ) : (
              <button onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-semibold hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
            )}
            <div className="flex-1"/>
            {step < 3 ? (
              <button onClick={() => setStep(s => s + 1)}
                disabled={step === 1 && (emolumentos.length === 0 || iban.trim().length < 10)}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-violet-200 text-white text-sm font-semibold transition-colors">
                Seguinte <ChevronRight size={16}/>
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={!accepted || loading}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-violet-200 text-white text-sm font-semibold transition-colors">
                {loading ? <RefreshCw size={15} className="animate-spin"/> : <BadgeCheck size={15}/>}
                {loading ? "A registar..." : "Confirmar Adesão"}
              </button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

/* ─── DDSubscriptionCard ─── */
function DDSubscriptionCard({ sub, token, onCancelled }: {
  sub: DDSubscription;
  token: string;
  onCancelled: () => void;
}) {
  const [showCancel, setShowCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const dates = useMemo(() => nextDebitDates(sub.debit_day, 4), [sub.debit_day]);

  const handleCancelRequest = async () => {
    setCancelError(""); setCancelling(true);
    try {
      const res = await fetch(`${API}/guardian/direct-debit/cancel-request`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ subscription_id: sub.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao submeter pedido.");
      onCancelled();
      setShowCancel(false);
    } catch (e: any) { setCancelError(e.message); }
    finally { setCancelling(false); }
  };

  const isCancelRequested = sub.status === "cancellation_requested";
  const isSusp  = sub.status === "SUSP";
  const isCanc  = sub.status === "CANC" || sub.status === "cancelled";
  const isExprd = sub.status === "EXPRD";

  const headerCfg = isCancelRequested
    ? { bg: "bg-amber-50 border-b border-amber-200",    icon: <Clock size={14} className="text-amber-600"/>,   label: "Pedido de cancelamento em análise pelo colégio", textCls: "text-amber-800" }
    : isSusp
    ? { bg: "bg-orange-50 border-b border-orange-200",  icon: <AlertCircle size={14} className="text-orange-500"/>, label: "Mandato suspenso — contacte o colégio",        textCls: "text-orange-800" }
    : isCanc
    ? { bg: "bg-red-50 border-b border-red-200",        icon: <XCircle size={14} className="text-red-500"/>,   label: "Débito Direto cancelado",                       textCls: "text-red-800" }
    : isExprd
    ? { bg: "bg-slate-50 border-b border-slate-200",    icon: <Clock size={14} className="text-slate-400"/>,   label: "Mandato expirado — renove a adesão",             textCls: "text-slate-600" }
    : { bg: "bg-violet-50 border-b border-violet-200",  icon: <BadgeCheck size={14} className="text-violet-700"/>, label: "Débito Direto Activo",                       textCls: "text-violet-800" };

  return (
    <div className="bg-white rounded-2xl border-2 border-violet-200 shadow-sm overflow-hidden">
      {/* Status header */}
      <div className={`px-4 py-3 flex items-center gap-2 ${headerCfg.bg}`}>
        {headerCfg.icon}
        <span className={`text-xs font-semibold ${headerCfg.textCls}`}>{headerCfg.label}</span>
      </div>

      <div className="p-4 space-y-3">
        {/* Details */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div>
            <p className="text-gray-400 mb-0.5">IBAN</p>
            <p className="font-mono font-semibold text-gray-800">{maskIban(sub.iban)}</p>
          </div>
          <div>
            <p className="text-gray-400 mb-0.5">Dia do débito</p>
            <p className="font-semibold text-gray-800">Todo o mês no dia {sub.debit_day}</p>
          </div>
          <div className="col-span-2">
            <p className="text-gray-400 mb-1">Serviços debitados</p>
            <div className="flex flex-wrap gap-1.5">
              {(Array.isArray(sub.emolumentos) ? sub.emolumentos : []).map(e => (
                <span key={e} className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-semibold">
                  {EMOLUMENTO_LABEL[e] ?? e}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Next debits */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Calendar size={11}/> Próximos débitos previstos
          </p>
          <div className="space-y-1">
            {dates.map((d, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${i === 0 ? "bg-violet-500" : "bg-gray-300"}`}/>
                {d.toLocaleDateString("pt-AO", { day: "2-digit", month: "long", year: "numeric" })}
                {i === 0 && <span className="text-violet-600 font-semibold">(próximo)</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Cancel section */}
        {!isCancelRequested && (
          <div className="border-t border-gray-100 pt-3">
            <AnimatePresence>
              {!showCancel ? (
                <button onClick={() => setShowCancel(true)}
                  className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 font-semibold transition-colors">
                  <XCircle size={13}/> Solicitar cancelamento da subscrição
                </button>
              ) : (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden space-y-2">
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                    <p className="text-red-800 text-xs font-semibold mb-1">Confirmar pedido de cancelamento</p>
                    <p className="text-red-700 text-xs">O cancelamento requer aprovação do colégio e produz efeitos a partir do mês seguinte à aprovação. O colégio será notificado do seu pedido.</p>
                  </div>
                  {cancelError && (
                    <p className="text-red-600 text-xs flex items-center gap-1"><AlertTriangle size={11}/>{cancelError}</p>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => { setShowCancel(false); setCancelError(""); }}
                      className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-500 text-xs font-semibold hover:bg-gray-50 transition-colors">
                      Manter subscrição
                    </button>
                    <button onClick={handleCancelRequest} disabled={cancelling}
                      className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5">
                      {cancelling ? <RefreshCw size={12} className="animate-spin"/> : <XCircle size={12}/>}
                      {cancelling ? "A submeter..." : "Submeter pedido"}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {isCancelRequested && (
          <div className="border-t border-gray-100 pt-3">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
              <Clock size={14} className="text-amber-500 shrink-0 mt-0.5"/>
              <div>
                <p className="text-amber-800 text-xs font-semibold">Pedido em análise</p>
                <p className="text-amber-700 text-xs mt-0.5">O colégio irá analisar o seu pedido de cancelamento. Será notificado assim que for aprovado.</p>
                {sub.cancellation_requested_at && (
                  <p className="text-amber-500 text-xs mt-1">Submetido em {fmtDate(sub.cancellation_requested_at)}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LoginScreen({ onSuccess }: { onSuccess: (token: string, g: Guardian) => void }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showRecovery, setShowRecovery] = useState(false);

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

            {/* Recover link */}
            <div className="text-center pt-1">
              <button type="button" onClick={() => setShowRecovery(true)}
                className="text-xs text-blue-300/70 hover:text-amber-300 transition-colors flex items-center gap-1.5 mx-auto">
                <HelpCircle size={12} />
                Esqueceu a palavra-passe?
              </button>
            </div>
          </form>
          <div className="mt-6 bg-white/5 border border-white/10 rounded-xl p-3">
            <p className="text-blue-300/80 text-xs text-center">
              <span className="font-semibold text-blue-200">Primeiro acesso?</span> Use a palavra-passe temporária <span className="font-mono font-bold text-amber-200">1234</span> — será pedida uma nova após o login.
            </p>
          </div>
        </motion.div>
      </div>

      {/* Recovery modal */}
      <AnimatePresence>
        {showRecovery && <RecuperarPinModal onClose={() => setShowRecovery(false)} />}
      </AnimatePresence>
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
            <PasswordInput value={nova} onChange={setNova} placeholder="Mínimo 6 caracteres" label="Nova palavra-passe" autoComplete="new-password"/>
            <PasswordInput value={confirmar} onChange={setConfirmar} placeholder="Repetir palavra-passe" label="Confirmar palavra-passe" autoComplete="new-password"/>
            {nova.length > 0 && (
              <div className="flex items-center gap-1.5">
                {[6,8,12].map((len,i) => (
                  <div key={i} className={`flex-1 h-1 rounded-full transition-all ${nova.length >= len ? i===0?"bg-amber-400":i===1?"bg-blue-400":"bg-emerald-400" : "bg-white/15"}`}/>
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
/* ══════════════════════════════════════════════════════════════════
   Infant Screens — read-only guardian portal views
══════════════════════════════════════════════════════════════════ */
const INF_DIAS = ["","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira"];
const INF_REFEICOES = [
  { key:"pequeno_almoco", label:"Pequeno-almoço", emoji:"☕" },
  { key:"almoco",         label:"Almoço",         emoji:"🍽️" },
  { key:"lanche",         label:"Lanche",          emoji:"🥪" },
];
const INF_DIAS_ALL = ["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"];

function getMondayISO(d: Date) {
  const dt = new Date(d);
  const diff = dt.getDate() - dt.getDay() + (dt.getDay() === 0 ? -6 : 1);
  dt.setDate(diff);
  return dt.toISOString().slice(0, 10);
}

function InfantRotinaScreen({ token, headers }: { token: string; headers: Record<string,string> }) {
  const [rotinas, setRotinas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/guardian/infant/rotinas`, { headers })
      .then(r => r.ok ? r.json() : []).then(setRotinas).finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div className="flex items-center justify-center py-16"><RefreshCw size={22} className="animate-spin text-blue-400"/></div>
  );

  const byDay: Record<number, any[]> = {};
  for (const r of rotinas) {
    if (!byDay[r.dia_semana]) byDay[r.dia_semana] = [];
    byDay[r.dia_semana].push(r);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <Clock size={12}/> Rotinas Diárias
        </p>
      </div>
      {rotinas.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 border border-gray-100 text-center">
          <Clock size={36} className="text-gray-200 mx-auto mb-3"/>
          <p className="font-semibold text-gray-400">Sem rotinas definidas</p>
          <p className="text-gray-300 text-xs mt-1">A escola ainda não publicou rotinas para a sua sala.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {[0,1,2,3,4,5,6].map(dia => {
            const items = byDay[dia] || [];
            if (!items.length) return null;
            return (
              <div key={dia} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-700">{INF_DIAS_ALL[dia]}</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {items.map((r: any) => (
                    <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.cor || "#3B82F6" }}/>
                      <div className="text-xs text-gray-400 font-mono shrink-0 w-24">{r.hora_inicio?.slice(0,5)}–{r.hora_fim?.slice(0,5)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{r.atividade}</p>
                        {r.descricao && <p className="text-xs text-gray-400 truncate">{r.descricao}</p>}
                        {r.turma_nome && <p className="text-xs text-emerald-600 font-medium mt-0.5">{r.turma_nome}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InfantEmentaScreen({ token, headers }: { token: string; headers: Record<string,string> }) {
  const [ementas, setEmentas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [semana, setSemana] = useState(() => getMondayISO(new Date()));

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/guardian/infant/ementa?semana=${semana}`, { headers })
      .then(r => r.ok ? r.json() : []).then(setEmentas).finally(() => setLoading(false));
  }, [token, semana]);

  const shiftWeek = (n: number) => {
    const d = new Date(semana + "T00:00:00");
    d.setDate(d.getDate() + n * 7);
    setSemana(getMondayISO(d));
  };

  const emap: Record<string, any> = {};
  for (const e of ementas) emap[`${e.dia_semana}-${e.refeicao}`] = e;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => shiftWeek(-1)} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors active:scale-95">
          <ChevronLeft size={16} className="text-gray-600"/>
        </button>
        <p className="text-sm font-semibold text-gray-700 text-center">
          Semana de {new Date(semana + "T00:00:00").toLocaleDateString("pt-AO", { day:"numeric", month:"long" })}
        </p>
        <button onClick={() => shiftWeek(1)} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors active:scale-95">
          <ChevronRight size={16} className="text-gray-600"/>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><RefreshCw size={22} className="animate-spin text-blue-400"/></div>
      ) : (
        <div className="space-y-3 pb-6">
          {[1,2,3,4,5].map(dia => (
            <div key={dia} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-700">{INF_DIAS[dia]}</p>
              </div>
              <div className="divide-y divide-gray-50">
                {INF_REFEICOES.map(ref => {
                  const entry = emap[`${dia}-${ref.key}`];
                  return (
                    <div key={ref.key} className="flex items-start gap-3 px-4 py-3">
                      <span className="text-lg mt-0.5">{ref.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-500 mb-0.5">{ref.label}</p>
                        {entry ? (
                          <>
                            <p className="text-sm text-gray-800">{entry.descricao}</p>
                            {entry.alergenios && (
                              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                <AlertTriangle size={11}/> {entry.alergenios}
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-sm text-gray-300 italic">Não definido</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {ementas.length === 0 && (
            <div className="bg-white rounded-2xl p-10 border border-gray-100 text-center">
              <UtensilsCrossed size={36} className="text-gray-200 mx-auto mb-3"/>
              <p className="font-semibold text-gray-400">Ementa não disponível</p>
              <p className="text-gray-300 text-xs mt-1">Ainda não há ementa publicada para esta semana.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfantGaleriaScreen({ token, headers }: { token: string; headers: Record<string,string> }) {
  const [galeria, setGaleria] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/guardian/infant/galeria`, { headers })
      .then(r => r.ok ? r.json() : []).then(setGaleria).finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div className="flex items-center justify-center py-16"><RefreshCw size={22} className="animate-spin text-blue-400"/></div>
  );

  return (
    <div className="space-y-4 pb-6">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
        <ImageIcon size={12}/> Galeria de Momentos
      </p>

      {galeria.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 border border-gray-100 text-center">
          <ImageIcon size={36} className="text-gray-200 mx-auto mb-3"/>
          <p className="font-semibold text-gray-400">Galeria vazia</p>
          <p className="text-gray-300 text-xs mt-1">A escola ainda não publicou fotografias.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {galeria.map((g: any) => (
              <div key={g.id} onClick={() => setLightbox(g)}
                className="relative rounded-2xl overflow-hidden bg-gray-100 aspect-square cursor-pointer active:scale-95 transition-transform">
                {g.tipo === "video" ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800">
                    <Play size={28} className="text-white/70"/>
                    {g.titulo && <p className="text-white/60 text-xs mt-2 px-2 text-center truncate">{g.titulo}</p>}
                  </div>
                ) : (
                  <img src={`${API}/guardian/infant/media/${g.filename}`}
                    alt={g.titulo || ""}
                    className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}/>
                )}
                {(g.titulo || g.turma_nome) && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
                    {g.titulo && <p className="text-white text-xs font-medium truncate">{g.titulo}</p>}
                    {g.turma_nome && <p className="text-white/70 text-xs truncate">{g.turma_nome}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>

          <AnimatePresence>
            {lightbox && (
              <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                onClick={() => setLightbox(null)}
                className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
                <motion.div initial={{scale:0.9}} animate={{scale:1}} exit={{scale:0.9}}
                  onClick={e => e.stopPropagation()} className="relative max-w-lg w-full">
                  {lightbox.tipo === "video" ? (
                    <video src={`${API}/guardian/infant/media/${lightbox.filename}`}
                      controls autoPlay className="w-full rounded-2xl max-h-[75vh]"/>
                  ) : (
                    <img src={`${API}/guardian/infant/media/${lightbox.filename}`}
                      alt={lightbox.titulo || ""} className="w-full rounded-2xl max-h-[75vh] object-contain"/>
                  )}
                  {lightbox.titulo && <p className="text-white text-center mt-3 font-medium text-sm">{lightbox.titulo}</p>}
                  <button onClick={() => setLightbox(null)}
                    className="absolute top-3 right-3 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors">
                    <X size={16}/>
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

function Dashboard({ token, guardian, onLogout }: { token: string; guardian: Guardian; onLogout: ()=>void }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student|null>(null);
  const [propinas, setPropinas] = useState<Propina[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingPropinas, setLoadingPropinas] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<ActiveMenu>("facturas");
  const [schoolModuloInfantil, setSchoolModuloInfantil] = useState(false);

  const portalLabel = selectedStudent?.portal_nomenclatura === "aluno" ? "Portal do Aluno" : "Portal do Encarregado";

  // Comunicados
  const [comunicados, setComunicados] = useState<Comunicado[]>([]);
  const [loadingComunicados, setLoadingComunicados] = useState(false);

  // Current school context (changes when selected student is from a different school)
  const [currentSchoolId, setCurrentSchoolId] = useState<number | null>(null);

  // Available payment methods
  const [availableMethods, setAvailableMethods] = useState<AvailableMethods>({
    allow_reference: true, allow_gpo_mcx: false, allow_direct_debit: false, direct_debit: null,
  });

  // Direct debit subscription state
  const [ddSubscription, setDdSubscription] = useState<DDSubscription | null | "loading">("loading");
  const [showDDWizard, setShowDDWizard] = useState(false);

  // Modals
  const [viewPropina, setViewPropina] = useState<Propina|null>(null);
  const [generatedRef, setGeneratedRef] = useState<GeneratedRef|null>(null);
  const [showCheckout, setShowCheckout] = useState(false);

  // Filter + selection
  const [filterEstado, setFilterEstado] = useState<FilterEstado>("TODOS");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Occurrences
  const [studentTab, setStudentTab] = useState<StudentTab>("propinas");
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [loadingOcorrencias, setLoadingOcorrencias] = useState(false);

  // Avaliações
  const [calSub, setCalSub] = useState<"provas"|"horario">("provas");
  const [horario, setHorario] = useState<any[]>([]);
  const [provas, setProvas] = useState<any[]>([]);
  const [loadingHorario, setLoadingHorario] = useState(false);
  const [loadingProvas, setLoadingProvas] = useState(false);

  // Loja
  const [storeItems, setStoreItems] = useState<any[]>([]);
  const [loadingStore, setLoadingStore] = useState(false);
  const [storeOrders, setStoreOrders] = useState<any[]>([]);
  const [loadingStoreOrders, setLoadingStoreOrders] = useState(false);
  const [cart, setCart] = useState<{ item: any; qty: number }[]>([]);
  const [lojaSub, setLojaSub] = useState<"artigos" | "pedidos">("artigos");
  const [showStoreCheckout, setShowStoreCheckout] = useState(false);
  const [storeCheckoutStep, setStoreCheckoutStep] = useState(1);
  const [storeMethod, setStoreMethod] = useState<"reference" | "gpo_mcx">("reference");
  const [storeResult, setStoreResult] = useState<any>(null);
  const [storeCheckoutLoading, setStoreCheckoutLoading] = useState(false);
  const [storeCheckoutError, setStoreCheckoutError] = useState("");

  const headers = { Authorization:`Bearer ${token}`, "Content-Type":"application/json" };

  const loadStudents = useCallback(async () => {
    try {
      const res = await fetch(`${API}/guardian/alunos`, {headers});
      if (!res.ok) { onLogout(); return; }
      const data: Student[] = await res.json();
      setStudents(data);
      if (data.length > 0) {
        setSelectedStudent(prev => {
          if (prev) return prev;
          // First load: set school context and load per-school data
          const first = data[0];
          setCurrentSchoolId(first.school_id);
          loadAvailableMethods(first.school_id);
          loadDDSubscription(first.school_id);
          return first;
        });
      }
    } catch {}
    finally { setLoadingStudents(false); }
  }, [token]);

  const loadPropinas = useCallback(async (id: number) => {
    setLoadingPropinas(true);
    setSelectedIds(new Set());
    try {
      const res = await fetch(`${API}/guardian/alunos/${id}/propinas?_t=${Date.now()}`, { headers, cache: "no-store" });
      if (!res.ok) return;
      setPropinas(await res.json());
    } catch {}
    finally { setLoadingPropinas(false); }
  }, [token]);

  const loadOcorrencias = useCallback(async (id: number) => {
    setLoadingOcorrencias(true);
    try {
      const res = await fetch(`${API}/guardian/alunos/${id}/ocorrencias`, {headers});
      if (!res.ok) return;
      setOcorrencias(await res.json());
    } catch {}
    finally { setLoadingOcorrencias(false); }
  }, [token]);

  const loadComunicados = useCallback(async (schoolId?: number) => {
    setLoadingComunicados(true);
    try {
      const url = schoolId
        ? `${API}/guardian/comunicados?school_id=${schoolId}`
        : `${API}/guardian/comunicados`;
      const res = await fetch(url, {headers});
      if (!res.ok) return;
      setComunicados(await res.json());
    } catch {}
    finally { setLoadingComunicados(false); }
  }, [token]);

  const loadAvailableMethods = useCallback(async (schoolId?: number) => {
    try {
      const url = schoolId
        ? `${API}/guardian/payments/available-methods?school_id=${schoolId}`
        : `${API}/guardian/payments/available-methods`;
      const res = await fetch(url, {headers});
      if (!res.ok) return;
      setAvailableMethods(await res.json());
    } catch {}
  }, [token]);

  const loadDDSubscription = useCallback(async (schoolId?: number) => {
    setDdSubscription("loading");
    try {
      const url = schoolId
        ? `${API}/guardian/direct-debit/subscription?school_id=${schoolId}`
        : `${API}/guardian/direct-debit/subscription`;
      const res = await fetch(url, {headers});
      if (!res.ok) { setDdSubscription(null); return; }
      setDdSubscription(await res.json());
    } catch { setDdSubscription(null); }
  }, [token]);

  const loadHorario = useCallback(async () => {
    setLoadingHorario(true);
    try {
      const res = await fetch(`${API}/guardian/horario`, { headers });
      if (res.ok) setHorario(await res.json());
    } catch {} finally { setLoadingHorario(false); }
  }, [token]);

  const loadProvas = useCallback(async () => {
    setLoadingProvas(true);
    try {
      const res = await fetch(`${API}/guardian/provas`, { headers });
      if (res.ok) setProvas(await res.json());
    } catch {} finally { setLoadingProvas(false); }
  }, [token]);

  const loadStoreItems = useCallback(async () => {
    setLoadingStore(true);
    try {
      const sid = selectedStudent?.school_id;
      const base = sid ? `${API}/guardian/store/items?school_id=${sid}` : `${API}/guardian/store/items`;
      const url = `${base}${sid ? "&" : "?"}_t=${Date.now()}`;
      const res = await fetch(url, { headers, cache: "no-store" });
      if (res.ok) setStoreItems(await res.json());
    } catch {}
    finally { setLoadingStore(false); }
  }, [token, selectedStudent?.school_id]);

  const loadStoreOrders = useCallback(async () => {
    setLoadingStoreOrders(true);
    try {
      const res = await fetch(`${API}/guardian/store/orders`, { headers });
      if (res.ok) setStoreOrders(await res.json());
    } catch {}
    finally { setLoadingStoreOrders(false); }
  }, [token]);

  const marcarLido = async (id: number) => {
    setComunicados(prev => prev.map(c => c.id === id ? { ...c, lido: true } : c));
    try {
      await fetch(`${API}/guardian/comunicados/${id}/marcar-lido`, {
        method: "POST", headers,
      });
    } catch {}
  };

  useEffect(() => { loadStudents(); }, [loadStudents]);
  useEffect(() => { loadComunicados(); }, [loadComunicados]);
  useEffect(() => { if (activeMenu === "avaliacoes") { loadHorario(); loadProvas(); } }, [activeMenu]);
  useEffect(() => { if (activeMenu === "loja") { loadStoreItems(); loadStoreOrders(); } }, [activeMenu, selectedStudent?.school_id]);

  // Fetch infant module status when student changes
  useEffect(() => {
    if (!token || !selectedStudent) { setSchoolModuloInfantil(false); return; }
    fetch(`${API}/guardian/infant/status`, { headers })
      .then(r => r.ok ? r.json() : { modulo_infantil: false })
      .then(d => setSchoolModuloInfantil(d.modulo_infantil === true))
      .catch(() => setSchoolModuloInfantil(false));
  }, [selectedStudent?.id, token]);

  // Load per-school data on initial mount (no specific school yet — auto-detect)
  useEffect(() => { loadAvailableMethods(); loadDDSubscription(); }, [token]);

  useEffect(() => {
    if (!selectedStudent) return;
    setStudentTab("propinas");
    setOcorrencias([]);
    loadPropinas(selectedStudent.id);

    // If school changed, reload payment methods, DD subscription, and comunicados
    if (selectedStudent.school_id !== currentSchoolId) {
      setCurrentSchoolId(selectedStudent.school_id);
      loadAvailableMethods(selectedStudent.school_id);
      loadDDSubscription(selectedStudent.school_id);
      loadComunicados(selectedStudent.school_id);
    }
  }, [selectedStudent?.id]);

  useEffect(() => {
    if (selectedStudent && studentTab === "ocorrencias") {
      loadOcorrencias(selectedStudent.id);
    }
  }, [studentTab, selectedStudent?.id]);

  const totalDivida = students.reduce((s,st)=>s+Number(st.divida_total),0);
  const totalMultas = students.reduce((s,st)=>s+Number(st.total_multas),0);
  const totalVencidas = students.reduce((s,st)=>s+Number(st.propinas_vencidas),0);

  // Filter logic
  const selectablePropinas = propinas.filter(p => p.estado !== "PAGO");
  const filteredPropinas = filterEstado === "TODOS"
    ? propinas
    : propinas.filter(p => p.estado === filterEstado);

  // Counts per tab
  const countByEstado = (e: FilterEstado) => e === "TODOS" ? propinas.length : propinas.filter(p=>p.estado===e).length;

  // Selection helpers
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const visibleSelectable = filteredPropinas.filter(p => p.estado !== "PAGO");
  const allVisibleSelected = visibleSelectable.length > 0 && visibleSelectable.every(p => selectedIds.has(p.id));
  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(prev => { const n = new Set(prev); visibleSelectable.forEach(p=>n.delete(p.id)); return n; });
    } else {
      setSelectedIds(prev => { const n = new Set(prev); visibleSelectable.forEach(p=>n.add(p.id)); return n; });
    }
  };

  // Selected propinas details for floating bar
  const selectedPropinas = selectablePropinas.filter(p => selectedIds.has(p.id));
  const selectedTotal = selectedPropinas.reduce((s,p)=>s+Number(p.total),0);

  // Called by CheckoutWizard when a reference is successfully generated
  const handleCheckoutSuccess = (ref?: GeneratedRef) => {
    setSelectedIds(new Set());
    setShowCheckout(false);
    if (selectedStudent) loadPropinas(selectedStudent.id);
  };

  const initials = guardian.nome.split(/\s+/).map(w=>w[0]).join("").slice(0,2).toUpperCase();
  const unreadCount = comunicados.filter(c => !c.lido).length;
  const sidebarItems: { key: ActiveMenu; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: "facturas",    label: "Consultar facturas ou referências",   icon: <CreditCard size={16} /> },
    { key: "ocorrencias", label: "Ocorrências/medidas disciplinares",   icon: <BookOpen size={16} /> },
    { key: "comunicados", label: "Comunicados",                         icon: <Bell size={16} />, badge: unreadCount },
    { key: "avaliacoes",  label: "Calendário Escolar",                  icon: <CalendarDays size={16} /> },
    { key: "loja",        label: "Outros Emolumentos & Artigos",        icon: <ShoppingCart size={16} /> },
    ...(schoolModuloInfantil ? [
      { key: "inf_rotinas" as ActiveMenu, label: "Rotinas Diárias",       icon: <Clock size={16} /> },
      { key: "inf_ementa"  as ActiveMenu, label: "Ementa Semanal",        icon: <UtensilsCrossed size={16} /> },
      { key: "inf_galeria" as ActiveMenu, label: "Galeria de Momentos",   icon: <ImageIcon size={16} /> },
    ] : []),
  ];

  if (loadingStudents) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <RefreshCw size={24} className="animate-spin text-blue-600"/>
    </div>
  );

  const FILTER_TABS: { key: FilterEstado; label: string }[] = [
    { key:"TODOS",    label:"Todos"    },
    { key:"PENDENTE", label:"Pendente" },
    { key:"VENCIDO",  label:"Vencido"  },
    { key:"PAGO",     label:"Pago"     },
  ];

  return (
    <div className="min-h-screen bg-gray-50 md:flex">
      <aside className="hidden md:flex w-80 bg-slate-900 text-white flex-col shrink-0">
        <div className="h-16 px-6 border-b border-white/10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center font-bold">K</div>
          <div>
            <p className="font-semibold text-sm">{portalLabel}</p>
            <p className="text-xs text-slate-400">Kiwara Tech</p>
          </div>
        </div>
        <div className="flex-1 p-4 space-y-1">
          {sidebarItems.map(item => (
            <button key={item.key} onClick={() => setActiveMenu(item.key)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeMenu === item.key ? "bg-white/10 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"}`}>
              <span className="relative shrink-0">
                {item.icon}
                {item.badge && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white font-bold flex items-center justify-center">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                )}
              </span>
              <span className="text-left flex-1">{item.label}</span>
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-white/10">
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
            <LogOut size={16}/> Terminar sessão
          </button>
        </div>
      </aside>

      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div key="guardian-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
            <motion.aside key="guardian-drawer" initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.22, ease: "easeInOut" }}
              className="fixed top-0 left-0 z-50 h-full w-72 bg-slate-900 text-white flex flex-col md:hidden">
              <div className="h-16 px-5 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center font-bold">K</div>
                  <div>
                    <p className="font-semibold text-sm">{portalLabel}</p>
                    <p className="text-xs text-slate-400">Kiwara Tech</p>
                  </div>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg hover:bg-white/10 text-slate-300">
                  <X size={16}/>
                </button>
              </div>
              <div className="flex-1 p-4 space-y-1">
                {sidebarItems.map(item => (
                  <button key={item.key} onClick={() => { setActiveMenu(item.key); setSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeMenu === item.key ? "bg-white/10 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"}`}>
                    <span className="relative shrink-0">
                      {item.icon}
                      {item.badge && item.badge > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white font-bold flex items-center justify-center">
                          {item.badge > 9 ? "9+" : item.badge}
                        </span>
                      )}
                    </span>
                    <span className="text-left flex-1">{item.label}</span>
                  </button>
                ))}
              </div>
              <div className="p-4 border-t border-white/10">
                <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
                  <LogOut size={16}/> Terminar sessão
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 min-w-0">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
          <div className="px-4 md:px-6 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600">
                <Menu size={18}/>
              </button>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-emerald-500 flex items-center justify-center text-white font-bold text-sm">{initials}</div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{guardian.nome}</p>
                <p className="text-xs text-gray-400 truncate">+244 {guardian.telefone}</p>
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

        {/* ══ ECRÃ: FACTURAS / REFERÊNCIAS ══ */}
        {activeMenu === "facturas" && <>

        {/* Summary */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Resumo Financeiro</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon:<Wallet size={15} className="text-red-600"/>, bg:"bg-red-50", label:"Por liquidar", value: fmt(totalDivida) },
              { icon:<AlertTriangle size={15} className="text-amber-600"/>, bg:"bg-amber-50", label:"Multas", value: fmt(totalMultas) },
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

        {/* Payment Methods */}
        {(availableMethods.allow_gpo_mcx || availableMethods.allow_direct_debit || availableMethods.allow_reference) && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <CreditCard size={12}/> Modalidades de Pagamento Disponíveis
            </p>
            <div className="grid gap-3">

              {/* Referência Bancária */}
              {availableMethods.allow_reference && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <CreditCard size={18} className="text-blue-600"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">Referência Bancária</p>
                    <p className="text-xs text-gray-500 mt-0.5">Gere uma referência e pague via ATM, internet banking ou Multicaixa.</p>
                    <div className="flex gap-2 mt-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">ATM</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">Multicaixa</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">Internet Banking</span>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-semibold shrink-0">Activo</span>
                </div>
              )}

              {/* GPO / MCX Express */}
              {availableMethods.allow_gpo_mcx && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                    <Zap size={18} className="text-emerald-600"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">Multicaixa Express / GPO</p>
                    <p className="text-xs text-gray-500 mt-0.5">Pagamento online em tempo real via Multicaixa Express ou portal GPO.</p>
                    <div className="flex gap-2 mt-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">Tempo Real</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">MCX Express</span>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-semibold shrink-0">Activo</span>
                </div>
              )}

              {/* Débito Direto */}
              {availableMethods.allow_direct_debit && (
                <>
                  {/* If subscribed — show subscription card */}
                  {ddSubscription && ddSubscription !== "loading" ? (
                    <DDSubscriptionCard
                      sub={ddSubscription}
                      token={token}
                      onCancelled={() => loadDDSubscription(currentSchoolId ?? undefined)}
                    />
                  ) : ddSubscription === "loading" ? (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                        <RefreshCw size={18} className="animate-spin text-violet-400"/>
                      </div>
                      <p className="text-sm text-gray-400">A verificar subscrição de débito direto...</p>
                    </div>
                  ) : (
                    /* Not subscribed — show adhesion card */
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                        <ArrowLeftRight size={18} className="text-violet-600"/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm">Débito Direto</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {availableMethods.direct_debit?.instrucoes || "Autorize débitos automáticos da sua conta bancária para pagamento de propinas."}
                        </p>
                        {availableMethods.direct_debit?.banco_parceiro && (
                          <p className="text-xs text-violet-600 font-semibold mt-1">Banco parceiro: {availableMethods.direct_debit.banco_parceiro}</p>
                        )}
                        <div className="flex gap-2 mt-2">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-semibold">Débito Automático</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-semibold">Mensal</span>
                        </div>
                      </div>
                      <button onClick={() => setShowDDWizard(true)}
                        className="shrink-0 text-xs px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold transition-colors">
                        Aderir
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

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
                <button key={st.id} onClick={()=>{ setSelectedStudent(st); setFilterEstado("TODOS"); setSelectedIds(new Set()); }}
                  className={`flex-shrink-0 w-56 text-left rounded-2xl p-4 border-2 transition-all ${sel?"border-blue-600 bg-blue-50 shadow-md":"border-gray-200 bg-white hover:border-gray-300"}`}>

                  {/* School badge — top identifier */}
                  <div className="mb-3">
                    <SchoolBadge name={st.school_name} logoUrl={st.school_logo_url} schoolId={st.school_id} size="sm"/>
                  </div>

                  <div className="flex items-start justify-between mb-2">
                    <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${schoolColor(st.school_id)} flex items-center justify-center text-white font-bold text-sm`}>
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
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="mb-1">
                  <SchoolBadge name={selectedStudent.school_name} logoUrl={selectedStudent.school_logo_url} schoolId={selectedStudent.school_id} size="sm"/>
                </div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Propinas</p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5">{selectedStudent.nome}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Total em dívida</p>
                <p className="font-bold text-red-600">{fmt(selectedStudent.divida_total)}</p>
              </div>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1.5 mb-4 bg-gray-100 p-1 rounded-xl overflow-x-auto">
              {FILTER_TABS.map(tab => {
                const count = countByEstado(tab.key);
                const active = filterEstado === tab.key;
                const dotColor = tab.key==="PENDENTE"?"bg-amber-400":tab.key==="VENCIDO"?"bg-red-500":tab.key==="PAGO"?"bg-emerald-500":"bg-transparent";
                return (
                  <button key={tab.key} onClick={()=>{ setFilterEstado(tab.key); setSelectedIds(new Set()); }}
                    className={`flex-1 min-w-[68px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${active?"bg-white text-gray-900 shadow-sm":"text-gray-500 hover:text-gray-700"}`}>
                    {tab.key !== "TODOS" && <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}/>}
                    {tab.label}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active?"bg-gray-100 text-gray-600":"bg-gray-200 text-gray-400"}`}>{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Select all — only when non-paid tabs are visible */}
            {visibleSelectable.length > 0 && filterEstado !== "PAGO" && (
              <div className="flex items-center justify-between mb-3">
                <button onClick={toggleSelectAll}
                  className="flex items-center gap-2 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors">
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${allVisibleSelected?"bg-blue-600 border-blue-600":"border-gray-300 bg-white"}`}>
                    {allVisibleSelected && <Check size={10} className="text-white"/>}
                  </div>
                  <ListFilter size={12}/>
                  {allVisibleSelected ? "Desselecionar todos" : "Selecionar todos"}
                </button>
                {selectedIds.size > 0 && (
                  <span className="text-xs text-gray-400">{selectedIds.size} selecionado{selectedIds.size===1?"":"s"}</span>
                )}
              </div>
            )}

            {/* List */}
            {loadingPropinas ? (
              <div className="flex items-center justify-center py-10"><RefreshCw size={20} className="animate-spin text-blue-600"/></div>
            ) : filteredPropinas.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                <CheckCircle size={28} className="mx-auto mb-2 text-emerald-400 opacity-70"/>
                <p className="text-gray-500 font-medium">Sem propinas nesta categoria</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPropinas.map(p => {
                  const isSelectable = p.estado !== "PAGO";
                  const isSelected = selectedIds.has(p.id);
                  return (
                    <motion.div key={p.id} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}}
                      className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
                        isSelected ? "border-blue-500 shadow-blue-100 shadow-md" :
                        p.estado==="VENCIDO" ? "border-red-200" : "border-gray-100"
                      }`}>

                      {p.estado === "VENCIDO" && (
                        <div className="bg-red-50 border-b border-red-100 px-4 py-1.5 flex items-center gap-1.5">
                          <AlertTriangle size={12} className="text-red-500"/>
                          <span className="text-red-700 text-xs font-semibold">Propina vencida — multa por atraso aplicada</span>
                        </div>
                      )}

                      <div className="p-4">
                        {/* Top row: checkbox + month + status */}
                        <div className="flex items-start gap-3 mb-3">
                          {isSelectable && (
                            <button onClick={()=>toggleSelect(p.id)}
                              className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${isSelected?"bg-blue-600 border-blue-600":"border-gray-300 hover:border-blue-400"}`}>
                              {isSelected && <Check size={12} className="text-white"/>}
                            </button>
                          )}
                          {!isSelectable && <div className="w-5 shrink-0"/>}
                          <div className="flex-1 flex items-start justify-between">
                            <div>
                              <p className="font-semibold text-gray-900">{p.mes} {p.ano}</p>
                              <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                                <Calendar size={10}/>Vencimento: {fmtDate(p.data_vencimento)}
                              </p>
                            </div>
                            <StatusBadge estado={p.estado}/>
                          </div>
                        </div>

                        {/* Values */}
                        <div className="ml-8 space-y-1 text-sm mb-3">
                          {Number(p.desconto) > 0 ? (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Valor original</span>
                              <span className="font-medium text-gray-400 line-through">{fmt(Number(p.valor_base) + Number(p.desconto))}</span>
                            </div>
                          ) : (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Valor base</span>
                              <span className="font-medium text-gray-800">{fmt(p.valor_base)}</span>
                            </div>
                          )}
                          {Number(p.desconto) > 0 && (
                            <div className="flex justify-between">
                              <span className="text-emerald-600 flex items-center gap-1">
                                <GraduationCap size={10}/> Bolsa de estudo
                              </span>
                              <span className="font-semibold text-emerald-600">- {fmt(p.desconto)}</span>
                            </div>
                          )}
                          {Number(p.desconto) > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Valor após desconto</span>
                              <span className="font-semibold text-gray-800">{fmt(p.valor_base)}</span>
                            </div>
                          )}
                          {Number(p.multa) > 0 && (
                            <div className="flex justify-between">
                              <span className="text-red-500 flex items-center gap-1"><AlertTriangle size={10}/>Multa (atraso)</span>
                              <span className="font-semibold text-red-600">+ {fmt(p.multa)}</span>
                            </div>
                          )}
                          {p.estado !== "PAGO" && (
                            <div className="flex justify-between border-t pt-1">
                              <span className="font-semibold text-gray-900">Total a pagar</span>
                              <span className="font-bold text-gray-900">{fmt(p.total)}</span>
                            </div>
                          )}
                        </div>

                        {/* Reference / paid indicator */}
                        {p.estado === "PAGO" ? (
                          <div className="ml-8 flex items-center gap-2 bg-emerald-50 rounded-xl px-3 py-2">
                            <CheckCircle size={14} className="text-emerald-600"/>
                            <span className="text-emerald-700 text-sm font-medium">Propina liquidada</span>
                          </div>
                        ) : p.referencia ? (
                          <div className="ml-8 space-y-2">
                            <div className="bg-blue-50 rounded-xl px-3 py-2 flex items-center justify-between">
                              <div>
                                <p className="text-xs text-blue-500 font-medium">Entidade {p.entidade} · Ref.</p>
                                <p className="font-mono font-bold text-blue-800 text-sm tracking-widest">
                                  {p.referencia.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3")}
                                </p>
                              </div>
                              <CopyBtn text={p.referencia}/>
                            </div>
                            <button onClick={()=>setViewPropina(p)}
                              className={`w-full py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border ${p.estado==="VENCIDO"?"border-red-200 text-red-600 hover:bg-red-50":"border-blue-200 text-blue-600 hover:bg-blue-50"}`}>
                              <CreditCard size={13}/>Ver Referência Completa
                            </button>
                          </div>
                        ) : (
                          <div className="ml-8 bg-gray-50 rounded-xl px-3 py-2 flex items-center gap-2 text-gray-400">
                            <Clock size={13}/>
                            <p className="text-xs">Selecione e gere uma referência de pagamento</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        </>}{/* end facturas screen */}

        {/* ══ ECRÃ: OCORRÊNCIAS ══ */}
        {activeMenu === "ocorrencias" && <>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Users size={12}/> Selecionar educando
            </p>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {students.map(st => {
                const sel = selectedStudent?.id === st.id;
                return (
                  <button key={st.id} onClick={()=>{ setSelectedStudent(st); loadOcorrencias(st.id); }}
                    className={`flex-shrink-0 w-44 text-left rounded-2xl p-3 border-2 transition-all ${sel?"border-blue-600 bg-blue-50 shadow-md":"border-gray-200 bg-white hover:border-gray-300"}`}>
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white font-bold text-sm mb-2">
                      {st.nome.split(" ").map((w:string)=>w[0]).join("").slice(0,2)}
                    </div>
                    <p className="font-semibold text-gray-900 text-sm leading-snug">{st.nome}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{st.turma ?? "Sem turma"}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedStudent && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Ocorrências — {selectedStudent.nome}
              </p>
              <div className="space-y-3 pb-6">
                {loadingOcorrencias ? (
                  <div className="flex items-center justify-center py-10">
                    <RefreshCw size={20} className="animate-spin text-blue-500"/>
                  </div>
                ) : ocorrencias.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 border border-gray-100 text-center">
                    <BookOpen size={32} className="text-gray-200 mx-auto mb-3"/>
                    <p className="font-semibold text-gray-400 text-sm">Sem ocorrências registadas</p>
                    <p className="text-gray-300 text-xs mt-1">Não existem ocorrências para este educando.</p>
                  </div>
                ) : (
                  ocorrencias.map((o, i) => (
                    <motion.div key={o.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                      className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        {tipoBadgeEnc(o.tipo)}
                        <span className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
                          <Calendar size={11}/> {fmtShort(o.data_ocorrencia)}
                        </span>
                      </div>
                      <p className="text-gray-800 text-sm leading-relaxed">{o.descricao}</p>
                      <p className="text-gray-400 text-xs mt-2">Registado por: {o.registado_por}</p>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          )}
        </>}{/* end ocorrencias screen */}

        {/* ══ ECRÃ: COMUNICADOS ══ */}
        {activeMenu === "comunicados" && <>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Bell size={12}/> Comunicados da Escola
            </p>
            {unreadCount > 0 && (
              <span className="text-xs bg-red-100 text-red-700 font-semibold px-2.5 py-1 rounded-full">
                {unreadCount} por ler
              </span>
            )}
          </div>

          {loadingComunicados ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw size={24} className="animate-spin text-blue-500"/>
            </div>
          ) : comunicados.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 border border-gray-100 text-center">
              <Bell size={36} className="text-gray-200 mx-auto mb-3"/>
              <p className="font-semibold text-gray-400">Sem comunicados</p>
              <p className="text-gray-300 text-xs mt-1">Nenhum comunicado da escola por enquanto.</p>
            </div>
          ) : (
            <div className="space-y-3 pb-6">
              {comunicados.map((c, i) => {
                const prioColor = c.prioridade === "urgente"
                  ? "border-red-300 bg-red-50"
                  : c.prioridade === "informativo"
                  ? "border-blue-200 bg-blue-50"
                  : "border-gray-100 bg-white";
                const prioLabel = c.prioridade === "urgente" ? "Urgente" : c.prioridade === "informativo" ? "Informativo" : "Normal";
                const prioLabelCls = c.prioridade === "urgente"
                  ? "bg-red-100 text-red-700"
                  : c.prioridade === "informativo"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-600";
                return (
                  <motion.div key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                    className={`rounded-2xl border shadow-sm overflow-hidden transition-all ${prioColor}`}>
                    {!c.lido && (
                      <div className="px-4 pt-2 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"/>
                        <span className="text-xs font-semibold text-red-600">Novo</span>
                      </div>
                    )}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold text-gray-900 text-sm ${!c.lido ? "font-bold" : ""}`}>{c.titulo}</p>
                          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                            <Calendar size={10}/> {fmtShort(c.created_at)}
                          </p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${prioLabelCls}`}>{prioLabel}</span>
                      </div>
                      <p className="text-gray-700 text-sm leading-relaxed mb-3">{c.conteudo}</p>
                      {!c.lido && (
                        <button onClick={() => marcarLido(c.id)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors">
                          <Check size={13}/> Marcar como lido
                        </button>
                      )}
                      {c.lido && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <CheckCircle size={13} className="text-emerald-500"/> Lido
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </>}{/* end comunicados screen */}

        {/* ══ ECRÃ: CALENDÁRIO ESCOLAR ══ */}
        {activeMenu === "avaliacoes" && <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <CalendarDays size={12}/> Calendário Escolar
            </p>
            <button onClick={() => { loadHorario(); loadProvas(); }} disabled={loadingHorario || loadingProvas}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 disabled:opacity-50">
              <RefreshCw size={13} className={(loadingHorario || loadingProvas) ? "animate-spin" : ""}/>
            </button>
          </div>

          {/* Sub-tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
            {([["provas","Calendário de Provas"],["horario","Horário de Aulas"]] as const).map(([k,l]) => (
              <button key={k} onClick={() => setCalSub(k)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${calSub===k?"bg-white shadow text-gray-900":"text-gray-500"}`}>
                {l}
              </button>
            ))}
          </div>

          {/* ── PROVAS ── */}
          {calSub === "provas" && (loadingProvas ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw size={22} className="animate-spin text-blue-500"/>
            </div>
          ) : provas.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 border border-gray-100 text-center">
              <BookOpen size={34} className="text-gray-200 mx-auto mb-3"/>
              <p className="font-semibold text-gray-400">Sem provas publicadas</p>
              <p className="text-gray-300 text-xs mt-1">Não há provas agendadas para os seus educandos.</p>
            </div>
          ) : (() => {
            const MESES_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
            const byMonth: Record<string,any[]> = {};
            provas.forEach(ev => {
              const d = new Date(ev.data_inicio);
              const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
              if (!byMonth[key]) byMonth[key] = [];
              byMonth[key].push(ev);
            });
            return (
              <div className="space-y-5 pb-6">
                {Object.entries(byMonth).sort(([a],[b])=>a.localeCompare(b)).map(([key,evs]) => {
                  const [yr,mo] = key.split("-");
                  return (
                    <div key={key}>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <Calendar size={11}/> {MESES_PT[Number(mo)-1]} {yr}
                      </p>
                      <div className="space-y-2">
                        {evs.map((ev,i) => {
                          const inicio = new Date(ev.data_inicio);
                          const fim = ev.data_fim ? new Date(ev.data_fim) : null;
                          const isUpcoming = inicio > new Date();
                          return (
                            <motion.div key={ev.id} initial={{opacity:0,y:5}} animate={{opacity:1,y:0}} transition={{delay:i*0.04}}
                              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex">
                              <div className="w-1 shrink-0" style={{backgroundColor:ev.tipo_prova_cor||"#6366f1"}}/>
                              <div className="flex-1 p-4">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                      <span className="font-bold text-gray-900 text-sm">{ev.titulo}</span>
                                      {ev.tipo_prova_nome && (
                                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                          style={{backgroundColor:(ev.tipo_prova_cor||"#6366f1")+"20",color:ev.tipo_prova_cor||"#6366f1"}}>
                                          {ev.tipo_prova_nome}
                                        </span>
                                      )}
                                      {isUpcoming && (
                                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-600 border border-blue-100">Próxima</span>
                                      )}
                                    </div>
                                    <p className="text-xs text-gray-500 flex items-center gap-1 mb-0.5">
                                      <Clock size={10}/>
                                      {inicio.toLocaleString("pt-AO",{weekday:"short",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}
                                      {fim && ` → ${fim.toLocaleTimeString("pt-AO",{hour:"2-digit",minute:"2-digit"})}`}
                                    </p>
                                    {ev.turma_nome && <p className="text-xs text-gray-400 flex items-center gap-1 mb-0.5"><Users size={10}/> {ev.turma_nome}</p>}
                                    {ev.sala && <p className="text-xs text-gray-400 flex items-center gap-1"><Calendar size={10}/> Sala: {ev.sala}</p>}
                                    {ev.professor && <p className="text-xs text-gray-400 mt-1">Prof. {ev.professor}</p>}
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className="text-xl font-black text-gray-900 leading-none">{String(inicio.getDate()).padStart(2,"0")}</p>
                                    <p className="text-xs text-gray-400">{MESES_PT[inicio.getMonth()].slice(0,3)}</p>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })())}

          {/* ── HORÁRIO ── */}
          {calSub === "horario" && (loadingHorario ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw size={22} className="animate-spin text-blue-500"/>
            </div>
          ) : horario.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 border border-gray-100 text-center">
              <Clock size={34} className="text-gray-200 mx-auto mb-3"/>
              <p className="font-semibold text-gray-400">Sem horário publicado</p>
              <p className="text-gray-300 text-xs mt-1">O horário de aulas ainda não foi publicado.</p>
            </div>
          ) : (() => {
            const DIAS_PT = ["Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
            const activeDays = [0,1,2,3,4,5].filter(d => horario.some(e => Number(e.dia_semana)===d));
            const slots = [...new Set(horario.filter(e=>e.hora_inicio_aula).map(e=>e.hora_inicio_aula.slice(0,5)))].sort() as string[];
            const grid: Record<string,Record<number,any[]>> = {};
            horario.forEach(ev => {
              const s = ev.hora_inicio_aula?.slice(0,5); const d = Number(ev.dia_semana);
              if (!s) return;
              if (!grid[s]) grid[s]={};
              if (!grid[s][d]) grid[s][d]=[];
              grid[s][d].push(ev);
            });
            return (
              <div className="pb-6">
                <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm">
                  <table className="w-full text-sm min-w-[400px] border-collapse">
                    <thead>
                      <tr className="bg-blue-700 text-white">
                        <th className="px-3 py-2.5 text-xs font-bold text-left border-r border-blue-600 w-20 whitespace-nowrap">Horário</th>
                        {activeDays.map(d=>(
                          <th key={d} className="px-2 py-2.5 text-xs font-bold text-center border-r border-blue-600 last:border-r-0">{DIAS_PT[d]}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {slots.map((slot,si) => {
                        const fim = horario.find(e=>e.hora_inicio_aula?.slice(0,5)===slot)?.hora_fim_aula?.slice(0,5);
                        return (
                          <tr key={slot} className={si%2===0?"bg-white":"bg-gray-50/60"}>
                            <td className="px-3 py-2 border-r border-b border-gray-100 align-middle">
                              <span className="block text-xs font-bold text-gray-700">{slot}</span>
                              {fim && <span className="block text-xs text-gray-400">{fim}</span>}
                            </td>
                            {activeDays.map(d => {
                              const cell = (grid[slot]||{})[d]||[];
                              return (
                                <td key={d} className="px-1.5 py-1.5 border-r border-b border-gray-100 last:border-r-0 align-middle min-w-[90px]">
                                  {cell.length===0 ? (
                                    <span className="text-gray-200 text-xs flex justify-center">—</span>
                                  ) : cell.map((ev,i)=>(
                                    <motion.div key={ev.id} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*0.03}}
                                      className="rounded-lg px-2 py-1.5 mb-1 last:mb-0"
                                      style={{backgroundColor:(ev.tipo_prova_cor||"#3B82F6")+"18",borderLeft:`3px solid ${ev.tipo_prova_cor||"#3B82F6"}`}}>
                                      <p className="text-xs font-bold text-gray-800 leading-tight">{ev.titulo}</p>
                                      {ev.professor && <p className="text-xs text-gray-500 leading-tight mt-0.5">{ev.professor}</p>}
                                      {ev.sala && <p className="text-xs text-gray-400 leading-tight">Sala {ev.sala}</p>}
                                    </motion.div>
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
              </div>
            );
          })())}
        </>}{/* end calendário screen */}

        {/* ══ ECRÃ: LOJA & EMOLUMENTOS ══ */}
        {activeMenu === "loja" && (() => {
          const cartTotal = cart.reduce((s, c) => s + Number(c.item.preco) * c.qty, 0);
          const cartCount = cart.reduce((s, c) => s + c.qty, 0);
          const fmtKz = (n: number) => Number(n).toLocaleString("pt-AO") + " Kz";
          const hasBothStore = availableMethods.allow_reference && availableMethods.allow_gpo_mcx;
          const storeEffMethod = hasBothStore ? storeMethod : (availableMethods.allow_reference ? "reference" : "gpo_mcx");
          const storeTotalSteps = hasBothStore ? 3 : 2;

          const addToCart = (item: any) => setCart(prev => {
            const ex = prev.find(c => c.item.id === item.id);
            if (ex) return prev.map(c => c.item.id === item.id ? { ...c, qty: c.qty + 1 } : c);
            return [...prev, { item, qty: 1 }];
          });
          const removeFromCart = (itemId: number) => setCart(prev => {
            const ex = prev.find(c => c.item.id === itemId);
            if (!ex) return prev;
            if (ex.qty <= 1) return prev.filter(c => c.item.id !== itemId);
            return prev.map(c => c.item.id === itemId ? { ...c, qty: c.qty - 1 } : c);
          });

          const handleStoreCheckout = async () => {
            if (!selectedStudent) return;
            setStoreCheckoutLoading(true); setStoreCheckoutError("");
            try {
              const res = await fetch(`${API}/guardian/store/checkout`, {
                method: "POST", headers,
                body: JSON.stringify({
                  school_id: selectedStudent.school_id, student_id: selectedStudent.id,
                  items: cart.map(c => ({ item_id: c.item.id, quantidade: c.qty })),
                  method: storeEffMethod,
                }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || "Erro ao processar encomenda.");
              setStoreResult(data);
              setStoreCheckoutStep(storeTotalSteps);
              setCart([]);
              loadStoreOrders();
              loadStoreItems();
            } catch (e: any) { setStoreCheckoutError(e.message); }
            finally { setStoreCheckoutLoading(false); }
          };

          return <>
            {/* Sub-tab bar */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                {(["artigos","pedidos"] as const).map(t => (
                  <button key={t} onClick={() => setLojaSub(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${lojaSub===t?"bg-white shadow text-gray-900":"text-gray-500 hover:text-gray-700"}`}>
                    {t === "artigos" ? "Artigos" : "Os meus pedidos"}
                  </button>
                ))}
              </div>
              <button onClick={() => { loadStoreItems(); loadStoreOrders(); }} disabled={loadingStore||loadingStoreOrders}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 disabled:opacity-50">
                <RefreshCw size={13} className={(loadingStore||loadingStoreOrders) ? "animate-spin" : ""}/>
              </button>
            </div>

            {/* ─── Sub-tab: ARTIGOS ─── */}
            {lojaSub === "artigos" && (
              loadingStore ? (
                <div className="flex items-center justify-center py-16">
                  <RefreshCw size={24} className="animate-spin text-blue-500"/>
                </div>
              ) : storeItems.length === 0 ? (
                <div className="bg-white rounded-2xl p-10 border border-gray-100 text-center">
                  <Store size={36} className="text-gray-200 mx-auto mb-3"/>
                  <p className="font-semibold text-gray-400">Nenhum artigo disponível</p>
                  <p className="text-gray-300 text-xs mt-1">A escola ainda não publicou artigos para venda.</p>
                </div>
              ) : (
                <div className="space-y-3 pb-28">
                  {/* Group by school if multiple */}
                  {(() => {
                    const bySchool: Record<string, any[]> = {};
                    storeItems.forEach(it => {
                      const k = it.escola_nome || "Escola";
                      if (!bySchool[k]) bySchool[k] = [];
                      bySchool[k].push(it);
                    });
                    return Object.entries(bySchool).map(([escola, its]) => (
                      <div key={escola}>
                        {Object.keys(bySchool).length > 1 && (
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{escola}</p>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          {its.map(item => {
                            const inCart = cart.find(c => c.item.id === item.id);
                            const stockLow = item.stock !== null && item.stock <= 5;
                            const outOfStock = item.stock !== null && item.stock === 0;
                            return (
                              <motion.div key={item.id} layout
                                className={`bg-white rounded-2xl border overflow-hidden shadow-sm flex flex-col ${outOfStock ? "opacity-60" : "border-gray-100"} ${inCart ? "border-blue-200 ring-1 ring-blue-200" : ""}`}>
                                {/* Category band */}
                                {item.categoria && (
                                  <div className="px-3 pt-2.5">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md">{item.categoria}</span>
                                  </div>
                                )}
                                <div className="p-3 flex-1 flex flex-col gap-1.5">
                                  <p className="font-bold text-gray-900 text-sm leading-snug">{item.nome}</p>
                                  {item.descricao && <p className="text-xs text-gray-400 leading-snug line-clamp-2">{item.descricao}</p>}
                                  <p className="font-bold text-blue-700 text-base mt-auto">{fmtKz(Number(item.preco))}</p>
                                  {item.stock !== null && (
                                    <p className={`text-[10px] font-semibold ${outOfStock?"text-red-500":stockLow?"text-amber-600":"text-gray-300"}`}>
                                      {outOfStock ? "Esgotado" : `${item.stock} em stock`}
                                    </p>
                                  )}
                                </div>
                                {/* Cart controls */}
                                {!outOfStock && (
                                  <div className="px-3 pb-3">
                                    {inCart ? (
                                      <div className="flex items-center justify-between bg-blue-50 rounded-xl px-1 py-1">
                                        <button onClick={() => removeFromCart(item.id)} className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600 transition-colors">
                                          <MinusCircle size={16}/>
                                        </button>
                                        <span className="font-bold text-blue-700 text-sm w-6 text-center">{inCart.qty}</span>
                                        <button
                                          onClick={() => addToCart(item)}
                                          disabled={item.stock !== null && inCart.qty >= item.stock}
                                          className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600 transition-colors disabled:opacity-40">
                                          <PlusCircle size={16}/>
                                        </button>
                                      </div>
                                    ) : (
                                      <button onClick={() => addToCart(item)}
                                        className="w-full py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors">
                                        Adicionar
                                      </button>
                                    )}
                                  </div>
                                )}
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )
            )}

            {/* ─── Sub-tab: PEDIDOS ─── */}
            {lojaSub === "pedidos" && (
              loadingStoreOrders ? (
                <div className="flex items-center justify-center py-16">
                  <RefreshCw size={24} className="animate-spin text-blue-500"/>
                </div>
              ) : storeOrders.length === 0 ? (
                <div className="bg-white rounded-2xl p-10 border border-gray-100 text-center">
                  <Truck size={36} className="text-gray-200 mx-auto mb-3"/>
                  <p className="font-semibold text-gray-400">Nenhuma encomenda ainda</p>
                  <p className="text-gray-300 text-xs mt-1">As suas compras na loja aparecerão aqui.</p>
                </div>
              ) : (
                <div className="space-y-3 pb-6">
                  {storeOrders.map(order => (
                    <div key={order.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <span className="font-mono font-bold text-gray-900 text-sm tracking-widest bg-gray-100 px-2 py-0.5 rounded-lg">{order.voucher_code}</span>
                          <p className="text-xs text-gray-400 mt-1">{order.escola_nome}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full font-semibold shrink-0 ${order.estado==="entregue"?"bg-emerald-100 text-emerald-700":order.estado==="pago"?"bg-blue-100 text-blue-700":"bg-amber-100 text-amber-700"}`}>
                          {order.estado==="entregue"?"Entregue ✓":order.estado==="pago"?"Pago — Levantar":"Pag. Pendente"}
                        </span>
                      </div>
                      <div className="space-y-0.5 mb-2">
                        {Array.isArray(order.items) && order.items.filter((i:any)=>i.item_nome).map((it:any,idx:number)=>(
                          <p key={idx} className="text-xs text-gray-600">• {it.item_nome} × {it.quantidade} — {fmtKz(Number(it.preco_unit)*it.quantidade)}</p>
                        ))}
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                        <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleDateString("pt-AO",{day:"2-digit",month:"short",year:"numeric"})}</p>
                        <p className="text-sm font-bold text-gray-900">{fmtKz(Number(order.total))}</p>
                      </div>
                      {order.estado === "pago" && order.referencia && (
                        <div className="mt-2 bg-blue-50 rounded-xl px-3 py-2 text-xs text-blue-700">
                          <span className="font-semibold">Referência: {order.entidade} / {order.referencia}</span>
                          <br/>Apresente o voucher <span className="font-mono font-bold">{order.voucher_code}</span> no balcão para levantamento.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}

            {/* ─── CART FOOTER ─── */}
            <AnimatePresence>
              {cart.length > 0 && lojaSub === "artigos" && (
                <motion.div initial={{y:100,opacity:0}} animate={{y:0,opacity:1}} exit={{y:100,opacity:0}}
                  transition={{type:"spring",stiffness:350,damping:30}}
                  className="fixed bottom-0 left-0 right-0 z-40 p-4">
                  <div className="max-w-lg mx-auto bg-gray-900 rounded-2xl shadow-2xl p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-white font-bold text-lg leading-tight">{fmtKz(cartTotal)}</p>
                      <p className="text-gray-400 text-xs">{cartCount} {cartCount===1?"artigo":"artigos"} no carrinho</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => setCart([])} className="p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                        <X size={18}/>
                      </button>
                      <button onClick={() => { setStoreCheckoutStep(1); setStoreMethod("reference"); setStoreResult(null); setStoreCheckoutError(""); setShowStoreCheckout(true); }}
                        className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-5 py-2.5 rounded-xl transition-all flex items-center gap-2">
                        <ShoppingCart size={16}/> Pagar
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ─── CHECKOUT MODAL ─── */}
            <AnimatePresence>
              {showStoreCheckout && (
                <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                  className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                  <motion.div initial={{scale:0.95,y:30}} animate={{scale:1,y:0}} exit={{scale:0.95,y:30}}
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">

                    {/* Modal header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                      <div>
                        <h3 className="font-bold text-gray-900">
                          {storeCheckoutStep === storeTotalSteps && storeResult ? "Encomenda Confirmada" : "Finalizar Compra"}
                        </h3>
                        {storeTotalSteps > 1 && storeCheckoutStep < storeTotalSteps && (
                          <p className="text-xs text-gray-400">Passo {storeCheckoutStep} de {storeTotalSteps - 1}</p>
                        )}
                      </div>
                      <button onClick={() => setShowStoreCheckout(false)} className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors">
                        <X size={18}/>
                      </button>
                    </div>

                    <div className="p-5">
                      {/* STEP 1: Cart summary */}
                      {storeCheckoutStep === 1 && (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            {cart.map(c => (
                              <div key={c.item.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-gray-900 truncate">{c.item.nome}</p>
                                  <p className="text-xs text-gray-400">{c.qty} × {fmtKz(Number(c.item.preco))}</p>
                                </div>
                                <p className="font-bold text-gray-900 shrink-0 ml-3">{fmtKz(Number(c.item.preco) * c.qty)}</p>
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                            <span className="font-bold text-gray-700">Total</span>
                            <span className="font-bold text-xl text-blue-700">{fmtKz(cartTotal)}</span>
                          </div>
                          {selectedStudent && (
                            <p className="text-xs text-gray-400 text-center">Educando: <span className="font-semibold text-gray-600">{selectedStudent.nome}</span></p>
                          )}
                          {storeCheckoutError && <p className="text-sm text-red-600 text-center">{storeCheckoutError}</p>}
                          <button
                            onClick={() => hasBothStore ? setStoreCheckoutStep(2) : handleStoreCheckout()}
                            disabled={storeCheckoutLoading}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
                            {storeCheckoutLoading ? <RefreshCw size={16} className="animate-spin"/> : null}
                            {storeCheckoutLoading ? "A processar..." : hasBothStore ? "Escolher método →" : "Confirmar e Pagar"}
                          </button>
                        </div>
                      )}

                      {/* STEP 2 (only if hasBoth): Method selection */}
                      {storeCheckoutStep === 2 && hasBothStore && (
                        <div className="space-y-4">
                          <p className="text-sm font-semibold text-gray-700 text-center">Método de pagamento</p>
                          <div className="space-y-2">
                            {[{m:"reference",label:"Referência Multicaixa",sub:"Pague no multibanco ou internet banking"},{m:"gpo_mcx",label:"Multicaixa Express (GPO)",sub:"Pague com o seu telemóvel"}].map(opt=>(
                              <button key={opt.m} onClick={()=>setStoreMethod(opt.m as any)}
                                className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${storeMethod===opt.m?"border-blue-500 bg-blue-50":"border-gray-100 hover:border-gray-200"}`}>
                                <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${storeMethod===opt.m?"border-blue-500 bg-blue-500":"border-gray-300"}`}>
                                  {storeMethod===opt.m&&<div className="w-2 h-2 rounded-full bg-white"/>}
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900 text-sm">{opt.label}</p>
                                  <p className="text-xs text-gray-400">{opt.sub}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                          {storeCheckoutError && <p className="text-sm text-red-600 text-center">{storeCheckoutError}</p>}
                          <div className="flex gap-2">
                            <button onClick={()=>setStoreCheckoutStep(1)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 font-semibold rounded-xl text-sm hover:bg-gray-50 transition-colors">← Voltar</button>
                            <button onClick={handleStoreCheckout} disabled={storeCheckoutLoading}
                              className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-xl text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60">
                              {storeCheckoutLoading?<RefreshCw size={14} className="animate-spin"/>:null}
                              {storeCheckoutLoading?"A processar...":"Confirmar →"}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* FINAL STEP: Result + voucher */}
                      {storeCheckoutStep === storeTotalSteps && storeResult && (
                        <div className="space-y-4">
                          {/* Voucher */}
                          <div className="bg-gradient-to-br from-blue-600 to-emerald-600 rounded-2xl p-5 text-white text-center">
                            <p className="text-xs font-semibold uppercase tracking-widest text-blue-100 mb-1">Código de Voucher</p>
                            <p className="font-mono font-black text-3xl tracking-[0.25em] mb-1">{storeResult.voucher_code}</p>
                            <p className="text-xs text-blue-100">Apresente este código no balcão para levantamento</p>
                          </div>

                          {/* Reference info */}
                          {storeResult.metodo_pagamento === "reference" && storeResult.referencia && (
                            <div className="bg-gray-50 rounded-xl divide-y divide-gray-100">
                              {[
                                { label: "Entidade", value: storeResult.entidade },
                                { label: "Referência", value: storeResult.referencia, mono: true },
                                { label: "Montante", value: fmtKz(Number(storeResult.montante)) },
                                { label: "Validade", value: storeResult.validade ? new Date(storeResult.validade).toLocaleDateString("pt-AO") : "" },
                              ].map(row => (
                                <div key={row.label} className="flex items-center justify-between px-4 py-2.5">
                                  <span className="text-xs text-gray-400">{row.label}</span>
                                  <span className={`text-sm font-bold text-gray-900 ${row.mono?"font-mono":""}`}>{row.value}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* GPO redirect */}
                          {storeResult.metodo_pagamento === "gpo_mcx" && storeResult.gpo_redirect_url && (
                            <a href={storeResult.gpo_redirect_url} target="_blank" rel="noreferrer"
                              className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors">
                              <Zap size={16}/> Pagar com Multicaixa Express
                            </a>
                          )}

                          <p className="text-xs text-gray-400 text-center">Após confirmação do pagamento, o seu artigo ficará disponível para levantamento.</p>
                          <button onClick={() => { setShowStoreCheckout(false); setLojaSub("pedidos"); }}
                            className="w-full py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-xl text-sm hover:bg-gray-200 transition-colors">
                            Ver os meus pedidos
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </>;
        })()}
        {/* end loja screen */}

        {/* ══ ECRÃ: ROTINAS DIÁRIAS ══ */}
        {activeMenu === "inf_rotinas" && (
          <InfantRotinaScreen token={token} headers={headers}/>
        )}

        {/* ══ ECRÃ: EMENTA SEMANAL ══ */}
        {activeMenu === "inf_ementa" && (
          <InfantEmentaScreen token={token} headers={headers}/>
        )}

        {/* ══ ECRÃ: GALERIA ══ */}
        {activeMenu === "inf_galeria" && (
          <InfantGaleriaScreen token={token} headers={headers}/>
        )}

        <div className="text-center pt-2">
          <p className="text-xs text-gray-300">Kiwara Escolar — {portalLabel}</p>
        </div>
      </div>
      </div>{/* end flex-1 min-w-0 */}

      {/* Floating action bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div initial={{y:100,opacity:0}} animate={{y:0,opacity:1}} exit={{y:100,opacity:0}}
            transition={{type:"spring",stiffness:350,damping:30}}
            className="fixed bottom-0 left-0 right-0 z-40 p-4">
            <div className="max-w-lg mx-auto bg-gray-900 rounded-2xl shadow-2xl p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-white font-bold text-lg leading-tight">{fmt(selectedTotal)}</p>
                <p className="text-gray-400 text-xs truncate">
                  {selectedIds.size} {selectedIds.size===1?"mês selecionado":"meses selecionados"}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={()=>setSelectedIds(new Set())}
                  className="p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                  <X size={18}/>
                </button>
                <button onClick={() => setShowCheckout(true)}
                  className="bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-5 py-2.5 rounded-xl transition-all flex items-center gap-2">
                  <Banknote size={16}/>
                  Pagar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {viewPropina && <RefModal propina={viewPropina} onClose={()=>setViewPropina(null)} schoolName={selectedStudent?.school_name}/>}
        {generatedRef && <CombinedRefModal ref={generatedRef} onClose={()=>setGeneratedRef(null)} schoolName={selectedStudent?.school_name}/>}
        {showCheckout && (
          <CheckoutWizard
            propinas={selectedPropinas}
            total={selectedTotal}
            availableMethods={availableMethods}
            token={token}
            schoolName={selectedStudent?.school_name}
            alunos={students}
            onClose={() => setShowCheckout(false)}
            onSuccess={handleCheckoutSuccess}
          />
        )}
        {showDDWizard && (
          <DirectDebitWizard
            onClose={() => setShowDDWizard(false)}
            onSuccess={(sub) => { setDdSubscription(sub); setShowDDWizard(false); }}
            availableMethods={availableMethods}
            token={token}
          />
        )}
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
