import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LogOut, Search, X, CheckCircle2, Printer, Eye, EyeOff,
  RefreshCw, Clock, AlertCircle, Upload, FileCheck, Building2,
  User, Shield, ChevronDown, Filter, KeyRound,
} from "lucide-react";
import {
  getStaffToken, setStaffToken, clearStaffToken,
  STAFF_SESSION_KEY,
} from "@/lib/auth";

const API = "/api";

interface StaffSession {
  id: number;
  nome: string;
  email: string;
  school_id: number;
  school_name: string;
  school_nif?: string;
  school_phone?: string;
  role_nome?: string;
}

interface Propina {
  id: number;
  student_id: number;
  aluno_nome: string;
  numero_processo?: string;
  turma: string;
  mes: string;
  ano: number;
  montante: number;
  multa: number;
  status: string;
  data_vencimento?: string;
  pagamento_origem: string;
  pago_em?: string;
}

const MESES_PT: Record<string, string> = {
  janeiro: "Jan", fevereiro: "Fev", março: "Mar", abril: "Abr",
  maio: "Mai", junho: "Jun", julho: "Jul", agosto: "Ago",
  setembro: "Set", outubro: "Out", novembro: "Nov", dezembro: "Dez",
};

const fmt = (v: number) => Number(v).toLocaleString("pt-AO");

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pendente: { label: "Pendente", cls: "bg-amber-100 text-amber-700" },
  vencido:  { label: "Vencido",  cls: "bg-red-100 text-red-700" },
  pago:     { label: "Pago",     cls: "bg-emerald-100 text-emerald-700" },
};

/* ══════════════════════════════════════════
   PRINT FUNCTIONS
══════════════════════════════════════════ */
function printCaixaFatura(fatura: any, escola: any, mode: "thermal" | "a4") {
  const fmtN = (v: number) => Number(v).toLocaleString("pt-AO");
  const dataHora = new Date(fatura.created_at);
  const dataStr = dataHora.toLocaleDateString("pt-AO");
  const horaStr = dataHora.toLocaleTimeString("pt-AO", { hour: "2-digit", minute: "2-digit" });
  const metodoLabel =
    fatura.metodo_pagamento === "CASH" ? "Numerário" :
    fatura.metodo_pagamento === "BANK_TRANSFER" ? "Transferência Bancária" :
    fatura.metodo_pagamento === "POS_TPA" ? "POS/TPA" :
    fatura.metodo_pagamento ?? "Manual";

  const html = mode === "thermal"
    ? `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8"/>
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
<div class="c b">COMPROVATIVO DE PAGAMENTO</div>
<div class="c b" style="font-size:13px">${fatura.numero_fatura}</div>
<div class="c">${dataStr} ${horaStr}</div>
<hr/>
<div><span class="b">Aluno: </span>${fatura.aluno_nome}</div>
${fatura.aluno_numero_processo ? `<div>Proc: ${fatura.aluno_numero_processo}</div>` : ""}
${fatura.aluno_turma ? `<div>Turma: ${fatura.aluno_turma}</div>` : ""}
<hr/>
<div class="row"><span>${fatura.descricao}</span><span>${fmtN(fatura.montante)} Kz</span></div>
<hr/>
<div class="row lg b"><span>TOTAL</span><span>${fmtN(fatura.montante)} Kz</span></div>
<div class="c" style="margin-top:3px">${metodoLabel}</div>
<hr/>
<div class="c">Operador: ${fatura.operador_nome}</div>
<div class="c b" style="margin-top:4px">★ LIQUIDADO ★</div>
<div class="c" style="margin-top:6px">Obrigado!</div>
<script>window.onload=function(){window.print();window.onafterprint=function(){window.close();}}</script>
</body></html>`
    : `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8"/>
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
    <div class="tag">Comprovativo de Pagamento</div>
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
    <tr><td>${fatura.descricao}</td><td class="mono" style="text-align:right;font-weight:600">${fmtN(fatura.montante)}</td></tr>
  </tbody>
  <tfoot>
    <tr class="total-row"><td>TOTAL PAGO</td><td class="mono" style="text-align:right">${fmtN(fatura.montante)}</td></tr>
  </tfoot>
</table>
<div class="ftr">
  <div><span class="paid">✓ LIQUIDADO</span><div style="margin-top:4px">${metodoLabel}</div></div>
  <div style="text-align:right"><div>Operador: ${fatura.operador_nome}</div><div style="margin-top:4px">${dataStr} ${horaStr}</div></div>
</div>
<script>window.onload=function(){window.print();window.onafterprint=function(){window.close();}}</script>
</body></html>`;

  const win = window.open("", "_blank", "width=800,height=600");
  if (win) { win.document.write(html); win.document.close(); }
}

function printBaixaManualReceipt(
  result: any,
  propina: { aluno_nome: string; mes: string; ano: number | string; turma?: string; numero_processo?: string },
  metodo: string,
  operador: string,
  mode: "thermal" | "a4"
) {
  const escola = result.escola ?? {};
  const alunoNome = result.propina?.aluno_nome ?? propina.aluno_nome ?? "";
  const alunoProcesso = result.propina?.aluno_processo ?? propina.numero_processo ?? "";
  const mes = result.propina?.mes ?? propina.mes ?? "";
  const ano = result.propina?.ano ?? propina.ano ?? "";
  const fatura = {
    numero_fatura: result.payment_ref ?? "MAN-?",
    created_at: new Date().toISOString(),
    aluno_nome: alunoNome,
    aluno_numero_processo: alunoProcesso,
    aluno_turma: propina.turma ?? "",
    descricao: `Propina de ${mes}/${ano}`,
    montante: result.valor_pago ?? 0,
    metodo_pagamento: (metodo === "Numerário" || metodo === "Cash") ? "CASH" :
      metodo.includes("Transfer") ? "BANK_TRANSFER" :
      metodo.includes("POS") || metodo.includes("TPA") ? "POS_TPA" : "CASH",
    operador_nome: operador || result.baixa_manual_por || "Operador",
  };
  printCaixaFatura(fatura, escola, mode);
}

/* ══════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════ */
export default function StaffPortal() {
  const [token, setToken] = useState<string | null>(() => getStaffToken() || null);
  const [session, setSession] = useState<StaffSession | null>(() => {
    try {
      const raw = localStorage.getItem(STAFF_SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  const handleLogin = (s: StaffSession, t: string) => {
    setStaffToken(t);
    localStorage.setItem(STAFF_SESSION_KEY, JSON.stringify(s));
    setToken(t);
    setSession(s);
  };

  const handleLogout = useCallback(async () => {
    const t = getStaffToken();
    if (t) {
      fetch(`${API}/school/rbac/staff/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${t}` },
      }).catch(() => {});
    }
    clearStaffToken();
    localStorage.removeItem(STAFF_SESSION_KEY);
    setToken(null);
    setSession(null);
  }, []);

  if (!token || !session) {
    return <LoginView onLogin={handleLogin} />;
  }

  return <DashboardView session={session} token={token} onLogout={handleLogout} />;
}

/* ══════════════════════════════════════════
   LOGIN VIEW
══════════════════════════════════════════ */
function LoginView({ onLogin }: { onLogin: (s: StaffSession, t: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const r = await fetch(`${API}/school/rbac/staff/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Erro ao autenticar."); return; }
      onLogin(d.staff, d.token);
    } catch {
      setError("Erro de ligação. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div translate="no" className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Shield className="w-7 h-7 text-primary"/>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Portal de Staff</h1>
            <p className="text-sm text-slate-500 mt-1">Atendimento / Tesouraria</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Email
              </label>
              <input
                type="email"
                autoComplete="email"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                placeholder="nome@escola.ao"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all pr-11"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPw ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-start gap-2 bg-red-50 text-red-700 px-3 py-2.5 rounded-xl text-sm"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5"/>
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin"/> : null}
              {loading ? "A autenticar…" : "Entrar"}
            </button>
          </form>
        </div>
        <p className="text-center text-slate-400 text-xs mt-6">
          Acesso restrito a colaboradores autorizados
        </p>
      </motion.div>
    </div>
  );
}

/* ══════════════════════════════════════════
   DASHBOARD VIEW
══════════════════════════════════════════ */
function DashboardView({
  session, token, onLogout,
}: {
  session: StaffSession;
  token: string;
  onLogout: () => void;
}) {
  const authH = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [propinas, setPropinas] = useState<Propina[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [filterStatus, setFilterStatus] = useState("pendente");
  const [showFilter, setShowFilter] = useState(false);

  /* Change Password state */
  const [showCP, setShowCP] = useState(false);
  const [cpCurrent, setCpCurrent] = useState("");
  const [cpNew, setCpNew] = useState("");
  const [cpConfirm, setCpConfirm] = useState("");
  const [cpSaving, setCpSaving] = useState(false);
  const [cpError, setCpError] = useState("");
  const [cpSuccess, setCpSuccess] = useState(false);
  const [cpShowCurrent, setCpShowCurrent] = useState(false);
  const [cpShowNew, setCpShowNew] = useState(false);

  const handleChangePassword = async () => {
    if (!cpCurrent || !cpNew || !cpConfirm) { setCpError("Preencha todos os campos."); return; }
    if (cpNew.length < 6) { setCpError("A nova password deve ter pelo menos 6 caracteres."); return; }
    if (cpNew !== cpConfirm) { setCpError("As passwords não coincidem."); return; }
    setCpSaving(true); setCpError("");
    try {
      const r = await fetch(`${API}/school/rbac/staff/change-password`, {
        method: "POST",
        headers: { ...authH, "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: cpCurrent, new_password: cpNew }),
      });
      const d = await r.json();
      if (!r.ok) { setCpError(d.error ?? "Erro ao alterar password."); return; }
      setCpSuccess(true);
      setTimeout(() => { onLogout(); }, 2000);
    } catch { setCpError("Erro de ligação. Tente novamente."); }
    finally { setCpSaving(false); }
  };

  /* Baixa Manual state */
  const [bmPropina, setBmPropina] = useState<Propina | null>(null);
  const [bmValor, setBmValor] = useState("");
  const [bmMetodo, setBmMetodo] = useState("Numerário");
  const [bmData, setBmData] = useState(() => new Date().toISOString().slice(0, 10));
  const [bmObs, setBmObs] = useState("");
  const [bmFile, setBmFile] = useState<File | null>(null);
  const [bmRefDoc, setBmRefDoc] = useState("");
  const [bmSaving, setBmSaving] = useState(false);
  const [bmError, setBmError] = useState("");
  const [bmResult, setBmResult] = useState<any>(null);
  const [bmPrintMode, setBmPrintMode] = useState<"thermal" | "a4">("thermal");

  const loadPropinas = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "todos") params.set("status", filterStatus);
      if (q.trim()) params.set("q", q.trim());
      const r = await fetch(`${API}/school/staff/propinas?${params}`, { headers: authH });
      if (!r.ok) {
        if (r.status === 401 || r.status === 403) { onLogout(); return; }
        throw new Error("Erro ao carregar propinas");
      }
      setPropinas(await r.json());
    } catch (e: any) {
      setError(e.message ?? "Erro de ligação.");
    } finally {
      setLoading(false);
    }
  }, [authH, filterStatus, q, onLogout]);

  useEffect(() => {
    const t = setTimeout(loadPropinas, q ? 400 : 0);
    return () => clearTimeout(t);
  }, [loadPropinas, q]);

  const openBaixa = (p: Propina) => {
    setBmPropina(p);
    setBmValor(String(Math.round(Number(p.montante) + Number(p.multa))));
    setBmData(new Date().toISOString().slice(0, 10));
    setBmMetodo("Numerário");
    setBmObs("");
    setBmFile(null);
    setBmRefDoc("");
    setBmResult(null);
    setBmError("");
  };

  const closeBaixa = () => {
    setBmPropina(null);
    setBmResult(null);
    if (bmResult) loadPropinas();
  };

  const handleBaixaManual = async () => {
    if (!bmPropina) return;
    if (!bmValor || Number(bmValor) <= 0) { setBmError("Introduza o valor pago."); return; }
    if (!bmData) { setBmError("Introduza a data de recebimento."); return; }
    setBmSaving(true);
    setBmError("");
    try {
      const fd = new FormData();
      fd.append("propina_id", String(bmPropina.id));
      fd.append("valor_pago", bmValor);
      fd.append("metodo", bmMetodo);
      fd.append("data_recebimento", bmData);
      fd.append("observacoes", bmObs);
      fd.append("referencia_doc", bmRefDoc);
      if (bmFile) fd.append("comprovante", bmFile);

      const r = await fetch(`${API}/school/staff/baixa-manual`, {
        method: "POST",
        headers: authH,
        body: fd,
      });
      const d = await r.json();
      if (!r.ok) { setBmError(d.error ?? "Erro ao registar pagamento."); return; }
      setBmResult(d);
      setPropinas(prev => prev.map(p =>
        p.id === bmPropina.id ? { ...p, status: d.status } : p
      ));
    } catch {
      setBmError("Erro de ligação. Tente novamente.");
    } finally {
      setBmSaving(false);
    }
  };

  const pendentes = propinas.filter(p => p.status === "pendente" || p.status === "vencido").length;

  return (
    <div translate="no" className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-primary"/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-900 text-sm truncate">{session.school_name}</p>
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <User className="w-3 h-3"/> {session.nome}
              {session.role_nome && (
                <><span className="text-slate-300">·</span>
                <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded-full text-[10px] font-semibold">{session.role_nome}</span></>
              )}
            </p>
          </div>
          <button onClick={() => { setShowCP(true); setCpCurrent(""); setCpNew(""); setCpConfirm(""); setCpError(""); setCpSuccess(false); }}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors" title="Alterar Palavra-passe">
            <KeyRound className="w-4 h-4"/>
          </button>
          <button onClick={onLogout} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors" title="Sair">
            <LogOut className="w-4 h-4"/>
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Total", value: propinas.length, cls: "text-slate-700" },
            { label: "Pendentes", value: propinas.filter(p => p.status === "pendente").length, cls: "text-amber-600" },
            { label: "Vencidos", value: propinas.filter(p => p.status === "vencido").length, cls: "text-red-600" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 px-4 py-3 text-center">
              <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filter / Search bar */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 mb-4 flex flex-wrap gap-2 items-center">
          <div className="flex-1 min-w-[160px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"/>
            <input
              className="w-full pl-8 pr-3 py-2 text-sm bg-slate-50 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-primary/30"
              placeholder="Pesquisar aluno ou processo…"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl p-1">
            {[
              { v: "pendente", l: "Pendente" },
              { v: "vencido",  l: "Vencido" },
              { v: "pago",     l: "Pago" },
              { v: "todos",    l: "Todos" },
            ].map(s => (
              <button
                key={s.v}
                onClick={() => setFilterStatus(s.v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  filterStatus === s.v
                    ? "bg-white shadow-sm text-primary"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {s.l}
              </button>
            ))}
          </div>

          <button
            onClick={loadPropinas}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
            title="Actualizar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}/>
          </button>
        </div>

        {/* Propinas table */}
        {error ? (
          <div className="bg-red-50 text-red-700 rounded-xl p-4 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0"/>{error}
          </div>
        ) : loading ? (
          <div className="text-center py-16 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2"/>
            <p className="text-sm">A carregar propinas…</p>
          </div>
        ) : propinas.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30"/>
            <p className="font-semibold text-slate-500">Nenhuma propina encontrada</p>
            <p className="text-sm mt-1">
              {filterStatus !== "todos" ? `Sem propinas com estado "${filterStatus}".` : "Sem resultados."}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["Aluno / Turma", "Período", "Montante", "Multa", "Total", "Estado", ""].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {propinas.map(p => {
                  const st = STATUS_LABELS[p.status] ?? STATUS_LABELS.pendente;
                  const total = Number(p.montante) + Number(p.multa);
                  const canBaixa = p.status !== "pago" && p.pagamento_origem !== "online";
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{p.aluno_nome}</p>
                        <p className="text-xs text-slate-400">{p.turma}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {p.mes} {p.ano}
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-mono whitespace-nowrap">
                        {fmt(p.montante)} Kz
                      </td>
                      <td className={`px-4 py-3 font-mono whitespace-nowrap ${Number(p.multa) > 0 ? "text-red-600 font-semibold" : "text-slate-400"}`}>
                        {Number(p.multa) > 0 ? `+${fmt(p.multa)}` : "—"}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900 font-mono whitespace-nowrap">
                        {fmt(total)} Kz
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${st.cls}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {canBaixa ? (
                          <button
                            onClick={() => openBaixa(p)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors whitespace-nowrap"
                          >
                            <FileCheck className="w-3.5 h-3.5"/> Baixa Manual
                          </button>
                        ) : p.status === "pago" ? (
                          <span className="text-xs text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5"/> Pago
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5"/> Online
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Baixa Manual Modal */}
      <AnimatePresence>
        {bmPropina && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
            >
              {/* Modal header */}
              <div className="flex items-start justify-between p-5 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-slate-900">Baixa Manual de Pagamento</h3>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {bmPropina.aluno_nome} · {bmPropina.mes} {bmPropina.ano}
                  </p>
                </div>
                <button
                  onClick={closeBaixa}
                  className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"
                >
                  <X className="w-5 h-5"/>
                </button>
              </div>

              {/* Modal body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {bmResult ? (
                  /* ─── SUCCESS SCREEN ─── */
                  <div className="space-y-5">
                    <div className="text-center pt-2">
                      <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                        <CheckCircle2 className="w-9 h-9 text-emerald-600"/>
                      </div>
                      <p className="text-lg font-bold text-slate-900">Pagamento Registado com Sucesso!</p>
                      <p className="text-sm text-slate-500 mt-1">
                        Ref.: <span className="font-mono font-semibold text-slate-700">{bmResult.payment_ref}</span>
                      </p>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Aluno</span>
                        <span className="font-semibold truncate max-w-[60%]">{bmPropina.aluno_nome}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Turma</span>
                        <span className="font-semibold">{bmPropina.turma}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Período</span>
                        <span className="font-semibold">{bmPropina.mes} {bmPropina.ano}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Valor Pago</span>
                        <span className="font-bold text-emerald-700">{fmt(bmResult.valor_pago ?? 0)} Kz</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Método</span>
                        <span className="font-semibold">{bmMetodo}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Operador</span>
                        <span className="font-semibold text-xs">{session.nome}</span>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                        Formato de Impressão
                      </p>
                      <div className="flex gap-2">
                        {(["thermal", "a4"] as const).map(m => (
                          <button
                            key={m}
                            onClick={() => setBmPrintMode(m)}
                            className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${
                              bmPrintMode === m
                                ? "bg-primary/10 border-primary text-primary"
                                : "border-slate-200 text-slate-500 hover:border-slate-300"
                            }`}
                          >
                            {m === "thermal" ? "🧾 Talão 80mm" : "📄 Folha A4"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={closeBaixa}
                        className="flex-1 px-5 py-2.5 border border-slate-200 bg-white text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
                      >
                        Fechar
                      </button>
                      <button
                        onClick={() => printBaixaManualReceipt(bmResult, bmPropina, bmMetodo, session.nome, bmPrintMode)}
                        className="flex-1 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                      >
                        <Printer className="w-4 h-4"/> Imprimir Comprovativo
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ─── FORM ─── */
                  <>
                    {/* Amount summary */}
                    <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-3 gap-3 text-center text-sm">
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Propina</p>
                        <p className="font-semibold">{fmt(bmPropina.montante)} Kz</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Multa</p>
                        <p className={`font-semibold ${Number(bmPropina.multa) > 0 ? "text-red-600" : "text-slate-800"}`}>
                          {fmt(bmPropina.multa)} Kz
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Total</p>
                        <p className="font-bold text-primary">
                          {fmt(Number(bmPropina.montante) + Number(bmPropina.multa))} Kz
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                          Valor Pago (AOA) *
                        </label>
                        <input
                          type="number" min="0" step="0.01"
                          className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                          value={bmValor}
                          onChange={e => setBmValor(e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                          Data de Recebimento *
                        </label>
                        <input
                          type="date"
                          className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                          value={bmData}
                          onChange={e => setBmData(e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Método de Pagamento *
                      </label>
                      <select
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                        value={bmMetodo}
                        onChange={e => setBmMetodo(e.target.value)}
                      >
                        {["Numerário", "Transferência Bancária", "Multicaixa Express", "Cheque", "POS/TPA", "Outro"].map(m => (
                          <option key={m}>{m}</option>
                        ))}
                      </select>
                    </div>

                    {(bmMetodo === "Transferência Bancária" || bmMetodo === "Multicaixa Express" || bmMetodo === "POS/TPA") && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                          {bmMetodo === "POS/TPA" ? "Nº Talão / ID Transação" : "Referência da Transferência"}
                        </label>
                        <input
                          type="text"
                          className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                          value={bmRefDoc}
                          onChange={e => setBmRefDoc(e.target.value)}
                          placeholder="Ex: TRF-20240601-001"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Comprovante de Pagamento
                      </label>
                      <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-primary/40 transition-colors">
                        <Upload className="w-4 h-4 text-slate-400 shrink-0"/>
                        <span className="text-sm text-slate-500 truncate">
                          {bmFile ? bmFile.name : "Clique para seleccionar ficheiro (PDF, JPG, PNG)"}
                        </span>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.webp"
                          className="hidden"
                          onChange={e => setBmFile(e.target.files?.[0] ?? null)}
                        />
                      </label>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Observações
                      </label>
                      <textarea
                        rows={2}
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                        placeholder="Notas adicionais (opcional)…"
                        value={bmObs}
                        onChange={e => setBmObs(e.target.value)}
                      />
                    </div>

                    <AnimatePresence>
                      {bmError && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex items-start gap-2 bg-red-50 text-red-700 px-3 py-2.5 rounded-xl text-sm"
                        >
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5"/>{bmError}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={closeBaixa}
                        className="px-5 py-2.5 border border-slate-200 bg-white text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleBaixaManual}
                        disabled={bmSaving}
                        className="flex-1 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                      >
                        {bmSaving ? <RefreshCw className="w-4 h-4 animate-spin"/> : <FileCheck className="w-4 h-4"/>}
                        {bmSaving ? "A registar…" : "Confirmar Baixa"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Change Password Modal */}
      <AnimatePresence>
        {showCP && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-indigo-600"/>
                  <h3 className="font-bold text-slate-900">Alterar Palavra-passe</h3>
                </div>
                <button onClick={() => setShowCP(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                  <X className="w-4 h-4"/>
                </button>
              </div>

              {cpSuccess ? (
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2"/>
                    <p className="font-semibold text-emerald-800">Password alterada com sucesso!</p>
                    <p className="text-xs text-emerald-600 mt-1">A iniciar sessão novamente...</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Password actual *</label>
                    <div className="relative">
                      <input type={cpShowCurrent ? "text" : "password"} value={cpCurrent}
                        onChange={e => setCpCurrent(e.target.value)}
                        placeholder="A sua password actual"
                        className="w-full px-3 py-2 pr-10 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
                      <button type="button" onClick={() => setCpShowCurrent(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {cpShowCurrent ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Nova password *</label>
                    <div className="relative">
                      <input type={cpShowNew ? "text" : "password"} value={cpNew}
                        onChange={e => setCpNew(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full px-3 py-2 pr-10 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
                      <button type="button" onClick={() => setCpShowNew(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {cpShowNew ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Confirmar nova password *</label>
                    <input type="password" value={cpConfirm}
                      onChange={e => setCpConfirm(e.target.value)}
                      placeholder="Repetir nova password"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
                  </div>
                  {cpError && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0"/>
                      {cpError}
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setShowCP(false)}
                      className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 text-sm">
                      Cancelar
                    </button>
                    <button onClick={handleChangePassword} disabled={cpSaving}
                      className="flex-1 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 text-sm flex items-center justify-center gap-2">
                      {cpSaving ? <RefreshCw className="w-4 h-4 animate-spin"/> : <KeyRound className="w-4 h-4"/>}
                      Alterar
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
