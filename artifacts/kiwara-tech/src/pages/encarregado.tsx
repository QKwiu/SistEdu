import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap, Phone, Hash, LogOut, CheckCircle2,
  Clock, AlertCircle, ChevronRight, Building2,
  CreditCard, TrendingUp, X, Bell, Download, ExternalLink,
} from "lucide-react";
import { Button, Input, Card } from "@/components/ui-elements";

interface GuardianSession {
  phone: string;
  schoolId: string;
  schoolName: string;
  studentName: string;
  turma: string;
  turno: string;
}

interface Propina {
  id: number;
  mes: string;
  ano: string;
  montante: number;
  status: "pago" | "pendente" | "vencido";
  referencia: string | null;
  pagoEm: string | null;
}

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function gerarPropinas(ano = 2025): Propina[] {
  const agora = new Date();
  const mesAtual = agora.getMonth();
  return MESES.slice(1, 11).map((mes, i) => {
    const idx = i + 1;
    let status: Propina["status"] = "pendente";
    if (idx < mesAtual - 1) status = "pago";
    else if (idx < mesAtual) status = "vencido";
    return {
      id: idx,
      mes,
      ano: String(ano),
      montante: 35000,
      status,
      referencia: status !== "pago" ? `925 ${String(1000 + idx * 37).padStart(4,"0")} ${String(ano).slice(2)}${String(idx).padStart(2,"0")}` : null,
      pagoEm: status === "pago" ? `${String(idx).padStart(2,"0")}/${String(ano).slice(2)}` : null,
    };
  });
}

function StatusBadge({ status }: { status: Propina["status"] }) {
  if (status === "pago") return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
      <CheckCircle2 className="w-3.5 h-3.5" /> Pago
    </span>
  );
  if (status === "vencido") return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
      <AlertCircle className="w-3.5 h-3.5" /> Vencido
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
      <Clock className="w-3.5 h-3.5" /> Pendente
    </span>
  );
}

// ────────────────────────────────────────
// Login form
// ────────────────────────────────────────
function LoginPanel({ onLogin }: { onLogin: (s: GuardianSession) => void }) {
  const [, params] = useLocation();
  const urlParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const prefilledSchool = urlParams.get("escola") ?? "";

  const [form, setForm] = useState({ schoolId: prefilledSchool, phone: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError("");
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.schoolId.startsWith("SCH-") || form.schoolId.length < 9) {
      setError("Introduza um código de escola válido (ex: SCH-XXXXXX).");
      return;
    }
    if (form.phone.length < 9) {
      setError("Introduza um número de telefone válido.");
      return;
    }

    setLoading(true);
    setTimeout(() => {
      let schoolName = "Colégio Kiwara";
      try {
        const raw = localStorage.getItem("kiwara_school_session");
        if (raw) {
          const s = JSON.parse(raw);
          if (s.schoolId === form.schoolId.toUpperCase()) schoolName = s.schoolName;
        }
      } catch {}

      const session: GuardianSession = {
        phone: form.phone,
        schoolId: form.schoolId.toUpperCase(),
        schoolName,
        studentName: "João Manuel Silva",
        turma: "10ª Classe",
        turno: "Manhã",
      };

      localStorage.setItem("kiwara_guardian_session", JSON.stringify(session));
      onLogin(session);
      setLoading(false);
    }, 900);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50/30 flex flex-col items-center justify-center p-4">
      <Link href="/escolar" className="absolute top-8 left-8 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center font-extrabold text-sm">K</div>
        <span className="font-display font-bold text-slate-900">Kiwara <span className="text-primary">Escolar</span></span>
      </Link>

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Card className="p-8 sm:p-10 shadow-2xl shadow-slate-200/50 border border-slate-100">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-5 shadow-lg shadow-primary/20">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Portal do Encarregado</h1>
            <p className="text-slate-500 text-sm leading-relaxed">
              Consulte as propinas e o estado de pagamento do seu educando.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">Código do Colégio</label>
              <div className="relative">
                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  name="schoolId"
                  required
                  placeholder="SCH-XXXXXX"
                  className="pl-11 uppercase tracking-widest font-mono"
                  value={form.schoolId}
                  onChange={handleChange}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1.5">Fornecido pelo colégio do seu educando.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">Número de Telefone</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  name="phone"
                  required
                  type="tel"
                  placeholder="9XX XXX XXX"
                  className="pl-11"
                  value={form.phone}
                  onChange={handleChange}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1.5">O número registado pelo colégio.</p>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-center gap-2"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
              </motion.p>
            )}

            <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
              {loading ? "A verificar..." : "Aceder ao Portal"}
              {!loading && <ChevronRight className="w-4 h-4 ml-1" />}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-xs text-slate-400 text-center">
              É responsável de um colégio?{" "}
              <Link href="/signup" className="text-primary font-medium hover:underline">
                Aceda ao painel de gestão →
              </Link>
            </p>
          </div>
        </Card>

        <p className="text-center text-xs text-slate-400 mt-6">
          Kiwara Escolar · Portal seguro para encarregados de educação
        </p>
      </motion.div>
    </div>
  );
}

// ────────────────────────────────────────
// Guardian dashboard
// ────────────────────────────────────────
function GuardianDashboard({ session, onLogout }: { session: GuardianSession; onLogout: () => void }) {
  const propinas = gerarPropinas(2025);
  const totalPago = propinas.filter(p => p.status === "pago").reduce((s, p) => s + p.montante, 0);
  const totalPendente = propinas.filter(p => p.status !== "pago").reduce((s, p) => s + p.montante, 0);
  const vencidas = propinas.filter(p => p.status === "vencido");

  const [selected, setSelected] = useState<Propina | null>(null);

  const fmt = (n: number) => new Intl.NumberFormat("pt-AO").format(n) + " AOA";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow">
              <span className="text-white font-extrabold text-sm">K</span>
            </div>
            <div>
              <p className="text-xs text-slate-500 leading-none">Portal do Encarregado</p>
              <p className="font-semibold text-slate-900 text-sm leading-tight">{session.schoolName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-2 text-slate-400 hover:text-slate-600">
              <Bell className="w-5 h-5" />
              {vencidas.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-red-500 transition-colors px-3 py-2 rounded-xl hover:bg-red-50"
            >
              <LogOut className="w-4 h-4" /> Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Alerta de propinas vencidas */}
        {vencidas.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex items-center gap-4"
          >
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-red-800 text-sm">
                {vencidas.length} propina{vencidas.length > 1 ? "s" : ""} vencida{vencidas.length > 1 ? "s" : ""}
              </p>
              <p className="text-red-600 text-xs mt-0.5">Regularize o pagamento para evitar penalizações.</p>
            </div>
          </motion.div>
        )}

        {/* Student card */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-6 flex items-center gap-5 border-primary/15 bg-gradient-to-r from-primary/3 to-accent/3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-extrabold text-xl shadow-lg shadow-primary/20 shrink-0">
              {session.studentName.split(" ").map(w => w[0]).slice(0, 2).join("")}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-900 text-lg leading-tight">{session.studentName}</p>
              <div className="flex flex-wrap gap-3 mt-1.5">
                <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <GraduationCap className="w-3.5 h-3.5 text-primary" /> {session.turma}
                </span>
                <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <Clock className="w-3.5 h-3.5 text-primary" /> Turno {session.turno}
                </span>
                <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <Building2 className="w-3.5 h-3.5 text-primary" /> {session.schoolId}
                </span>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: "Total Pago", value: fmt(totalPago), icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />, bg: "bg-emerald-50", border: "border-emerald-100" },
            { label: "Em Dívida", value: fmt(totalPendente), icon: <AlertCircle className="w-5 h-5 text-amber-500" />, bg: "bg-amber-50", border: "border-amber-100" },
            { label: "Propina Mensal", value: fmt(35000), icon: <CreditCard className="w-5 h-5 text-primary" />, bg: "bg-primary/5", border: "border-primary/10" },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
              <Card className={`p-5 ${s.border}`}>
                <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>{s.icon}</div>
                <p className="text-xs font-medium text-slate-500 mb-0.5">{s.label}</p>
                <p className="font-bold text-slate-900 text-base leading-tight">{s.value}</p>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Propinas table */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="overflow-hidden p-0">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-900">Propinas 2025</h2>
                <p className="text-xs text-slate-500 mt-0.5">Ano lectivo Fevereiro – Novembro</p>
              </div>
              <button className="flex items-center gap-2 text-xs font-medium text-primary hover:underline">
                <Download className="w-3.5 h-3.5" /> Exportar
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-medium text-xs">
                  <tr>
                    <th className="px-6 py-3">Mês</th>
                    <th className="px-6 py-3">Montante</th>
                    <th className="px-6 py-3">Estado</th>
                    <th className="px-6 py-3">Referência</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 bg-white">
                  {propinas.map((p, i) => (
                    <motion.tr
                      key={p.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.25 + i * 0.04 }}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium text-slate-900">{p.mes}</td>
                      <td className="px-6 py-4 font-semibold text-slate-800">{fmt(p.montante)}</td>
                      <td className="px-6 py-4"><StatusBadge status={p.status} /></td>
                      <td className="px-6 py-4">
                        {p.referencia ? (
                          <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">{p.referencia}</span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {p.status !== "pago" && (
                          <button
                            onClick={() => setSelected(p)}
                            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 ml-auto"
                          >
                            Pagar <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>

        {/* Footer contact */}
        <div className="text-center py-4">
          <p className="text-xs text-slate-400">
            Dúvidas? Contacte o secretariado de{" "}
            <span className="font-medium text-slate-600">{session.schoolName}</span>
          </p>
        </div>
      </main>

      {/* Payment modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-slate-900 text-lg">Como Pagar</h3>
                <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-slate-50 rounded-2xl p-5 mb-6 text-center border border-slate-200">
                <p className="text-xs text-slate-500 mb-1">Propina de {selected.mes} {selected.ano}</p>
                <p className="text-3xl font-extrabold text-slate-900">{fmt(selected.montante)}</p>
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <p className="text-xs text-slate-500 mb-2">Referência Multicaixa / ATM</p>
                  <p className="font-mono text-lg font-bold text-primary tracking-widest">{selected.referencia}</p>
                </div>
              </div>

              <div className="space-y-3 text-sm text-slate-600">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</div>
                  <p>Vá a qualquer <strong>ATM / Multicaixa Express</strong></p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</div>
                  <p>Selecione <strong>Pagamento de Serviços</strong> e introduza a referência acima</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</div>
                  <p>O pagamento é <strong>confirmado automaticamente</strong> no sistema do colégio</p>
                </div>
              </div>

              <Button className="w-full mt-6" onClick={() => setSelected(null)}>
                Fechar
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ────────────────────────────────────────
// Main export
// ────────────────────────────────────────
export default function Encarregado() {
  const [session, setSession] = useState<GuardianSession | null>(() => {
    try {
      const raw = localStorage.getItem("kiwara_guardian_session");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  const handleLogin = (s: GuardianSession) => setSession(s);

  const handleLogout = () => {
    localStorage.removeItem("kiwara_guardian_session");
    setSession(null);
  };

  return session
    ? <GuardianDashboard session={session} onLogout={handleLogout} />
    : <LoginPanel onLogin={handleLogin} />;
}
