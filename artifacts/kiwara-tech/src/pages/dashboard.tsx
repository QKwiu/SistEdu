import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, FileText, Settings, LogOut,
  Bell, Search, Plus, TrendingUp, AlertCircle, CheckCircle2,
  Clock, BarChart3, ArrowRight, GraduationCap, Banknote, PartyPopper,
  Share2, Copy, AlertTriangle, ChevronDown, RefreshCw, Trash2,
  Calendar, User, BookOpen, X,
} from "lucide-react";
import { Button, Card } from "@/components/ui-elements";
import { useAuth } from "@/lib/auth";

const API = "/api";

const TIPOS_OCORRENCIA = [
  "Comportamento Inadequado",
  "Medida Disciplinar",
  "Ausência Injustificada",
  "Atraso Repetido",
  "Incidente Académico",
  "Elogio / Mérito",
  "Comunicação aos Pais",
  "Outro",
];

const TIPO_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  "Comportamento Inadequado": { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", dot: "bg-red-500" },
  "Medida Disciplinar":       { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", dot: "bg-orange-500" },
  "Ausência Injustificada":   { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500" },
  "Atraso Repetido":          { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200", dot: "bg-yellow-500" },
  "Incidente Académico":      { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", dot: "bg-purple-500" },
  "Elogio / Mérito":          { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  "Comunicação aos Pais":     { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", dot: "bg-blue-500" },
  "Outro":                    { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200", dot: "bg-slate-400" },
};

function tipoBadge(tipo: string) {
  const c = TIPO_COLORS[tipo] ?? TIPO_COLORS["Outro"];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${c.bg} ${c.text} ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}/>
      {tipo}
    </span>
  );
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("pt-AO", { day: "2-digit", month: "long", year: "numeric" });
}

interface Student { id: number; nome: string; bilhete: string; turma: string; }
interface Ocorrencia {
  id: number; tipo: string; descricao: string; registado_por: string;
  data_ocorrencia: string; created_at: string;
  aluno_nome?: string; bilhete?: string; turma?: string;
}

/* ─── Occurrences Module ─── */
function OcorrenciasView({ token, schoolName }: { token: string | null; schoolName: string }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filterStudent, setFilterStudent] = useState<number | "">("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    student_id: "" as number | "",
    tipo: TIPOS_OCORRENCIA[0],
    descricao: "",
    registado_por: schoolName,
    data_ocorrencia: new Date().toISOString().slice(0, 10),
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

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

  const filteredStudents = students.filter(s =>
    s.nome.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setSuccess("");
    if (!form.student_id) return setError("Selecione um aluno.");
    if (!form.descricao.trim()) return setError("A descrição é obrigatória.");
    if (!token) return setError("Sessão inválida. Faça login novamente.");
    setSaving(true);
    try {
      const res = await fetch(`${API}/ocorrencias`, {
        method: "POST", headers,
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao registar.");
      setSuccess("Ocorrência registada com sucesso!");
      setForm(f => ({ ...f, student_id: "", descricao: "", tipo: TIPOS_OCORRENCIA[0] }));
      setShowForm(false);
      load();
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!token || !confirm("Tem a certeza que quer eliminar esta ocorrência?")) return;
    setDeleting(id);
    try {
      await fetch(`${API}/ocorrencias/${id}`, { method: "DELETE", headers });
      setOcorrencias(prev => prev.filter(o => o.id !== id));
    } catch {}
    setDeleting(null);
  };

  if (!token) {
    return (
      <div className="p-8 flex-1 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
          </div>
          <h3 className="font-bold text-slate-900 text-lg mb-2">Sessão sem token de API</h3>
          <p className="text-slate-500 text-sm mb-4">Para aceder a esta funcionalidade, por favor termine a sessão e inicie uma nova.</p>
          <Link href="/escolar">
            <Button size="sm">Ir para o Login</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 flex-1 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Ocorrências</h2>
          <p className="text-slate-500 text-sm mt-0.5">Registe e consulte ocorrências por aluno</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Registar Ocorrência
        </Button>
      </div>

      {/* Feedback */}
      <AnimatePresence>
        {success && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-2 mb-5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <p className="text-emerald-800 text-sm font-medium">{success}</p>
          </motion.div>
        )}
        {error && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2 mb-5">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-red-700 text-sm">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left — filter sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Filtrar por aluno</p>
            <div className="relative mb-3">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar..."
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"/>
            </div>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              <button onClick={() => setFilterStudent("")}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${filterStudent === "" ? "bg-primary/10 text-primary font-semibold" : "hover:bg-slate-50 text-slate-700"}`}>
                Todos os alunos ({ocorrencias.length})
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
              {filteredStudents.length === 0 && (
                <p className="text-slate-400 text-xs px-3 py-2">Nenhum aluno encontrado</p>
              )}
            </div>
          </Card>

          {/* Quick stats */}
          <Card className="p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Resumo por tipo</p>
            <div className="space-y-2">
              {TIPOS_OCORRENCIA.map(tipo => {
                const count = ocorrencias.filter(o => o.tipo === tipo).length;
                if (count === 0) return null;
                const c = TIPO_COLORS[tipo] ?? TIPO_COLORS["Outro"];
                return (
                  <div key={tipo} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-slate-700">
                      <span className={`w-2 h-2 rounded-full ${c.dot}`}/>
                      <span className="truncate">{tipo}</span>
                    </span>
                    <span className="font-semibold text-slate-900 ml-2">{count}</span>
                  </div>
                );
              })}
              {ocorrencias.length === 0 && <p className="text-slate-400 text-xs">Sem ocorrências registadas</p>}
            </div>
          </Card>
        </div>

        {/* Right — list */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="flex items-center justify-center py-16"><RefreshCw className="w-5 h-5 animate-spin text-primary"/></div>
          ) : ocorrencias.length === 0 ? (
            <Card className="p-12 text-center">
              <BookOpen className="w-12 h-12 text-slate-200 mx-auto mb-3"/>
              <p className="font-semibold text-slate-500">Sem ocorrências registadas</p>
              <p className="text-slate-400 text-sm mt-1">Clique em "Registar Ocorrência" para adicionar.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {ocorrencias.map((o, i) => (
                <motion.div key={o.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <Card className="p-5 hover:border-slate-300 transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        {tipoBadge(o.tipo)}
                        {o.aluno_nome && (
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <User className="w-3 h-3"/> {o.aluno_nome}
                          </span>
                        )}
                        {o.turma && <span className="text-xs text-slate-400">{o.turma}</span>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <Calendar className="w-3 h-3"/> {fmtDate(o.data_ocorrencia)}
                        </span>
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
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Registration modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"/>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-lg">Registar Ocorrência</h3>
                <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                  <X className="w-4 h-4"/>
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {/* Student selector */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Aluno *</label>
                  <select value={form.student_id} onChange={e => setForm(f => ({ ...f, student_id: Number(e.target.value) || "" }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white">
                    <option value="">Selecionar aluno...</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>{s.nome} — {s.turma}</option>
                    ))}
                  </select>
                </div>

                {/* Tipo */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tipo de Ocorrência *</label>
                  <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white">
                    {TIPOS_OCORRENCIA.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Data da Ocorrência</label>
                  <input type="date" value={form.data_ocorrencia}
                    onChange={e => setForm(f => ({ ...f, data_ocorrencia: e.target.value }))}
                    max={new Date().toISOString().slice(0, 10)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"/>
                </div>

                {/* Registado por */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Registado por</label>
                  <input type="text" value={form.registado_por} placeholder="Nome do funcionário"
                    onChange={e => setForm(f => ({ ...f, registado_por: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"/>
                </div>

                {/* Descrição */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Descrição *</label>
                  <textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                    placeholder="Descreva a ocorrência com detalhe..." rows={4}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"/>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0"/>
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="flex-1">
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving} className="flex-1">
                    {saving ? <><RefreshCw className="w-4 h-4 animate-spin mr-2"/>A guardar...</> : "Registar Ocorrência"}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Onboarding Dashboard ─── */
const ONBOARDING_STEPS = [
  { icon: <Users className="w-6 h-6 text-primary"/>, title: "Adicionar alunos", desc: "Registe os seus alunos e organize-os por turmas.", action: "Adicionar Aluno" },
  { icon: <GraduationCap className="w-6 h-6 text-primary"/>, title: "Criar turmas", desc: "Organize os alunos em turmas para uma gestão mais simples.", action: "Criar Turma" },
  { icon: <Banknote className="w-6 h-6 text-primary"/>, title: "Gerar propinas", desc: "Gere propinas automaticamente e envie referências de pagamento.", action: "Gerar Propina" },
];

function GuardianPortalCard({ schoolId }: { schoolId: string }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}${import.meta.env.BASE_URL}encarregado?escola=${schoolId}`;
  const copyLink = () => { navigator.clipboard.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="mt-8">
      <Card className="p-6 border-primary/20 bg-gradient-to-r from-primary/3 to-accent/3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 shadow-md shadow-primary/20">
            <GraduationCap className="w-6 h-6 text-white"/>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-slate-900 mb-1">Portal do Encarregado</h4>
            <p className="text-sm text-slate-500 mb-3">Partilhe este link com os encarregados para que possam consultar propinas e ocorrências.</p>
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 max-w-sm">
              <span className="text-xs text-slate-500 font-mono truncate flex-1">{link}</span>
              <button onClick={copyLink} className="shrink-0 text-primary hover:text-primary/70 transition-colors">
                {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500"/> : <Copy className="w-4 h-4"/>}
              </button>
            </div>
          </div>
          <Link href="/encarregado">
            <Button variant="outline" size="sm" className="shrink-0 bg-white gap-2">
              <Share2 className="w-4 h-4"/> Ver Portal
            </Button>
          </Link>
        </div>
      </Card>
    </motion.div>
  );
}

function OnboardingDashboard({ schoolName, schoolId }: { schoolName: string; schoolId: string }) {
  return (
    <div className="p-6 lg:p-10 flex-1">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-primary to-accent rounded-3xl p-8 text-white mb-10 relative overflow-hidden">
        <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-10"><PartyPopper className="w-40 h-40"/></div>
        <div className="relative">
          <div className="flex items-center gap-2 text-white/70 text-sm font-medium mb-3">
            <CheckCircle2 className="w-4 h-4"/> Conta criada com sucesso
          </div>
          <h2 className="text-3xl font-display font-extrabold mb-2">Bem-vindo, {schoolName}!</h2>
          <p className="text-white/80 text-lg mb-1">O seu colégio está pronto para começar.</p>
          <p className="text-white/50 text-xs font-mono mt-3">ID: {schoolId}</p>
        </div>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <div className="mb-6">
          <h3 className="text-xl font-bold text-slate-900 mb-1">Configure o seu colégio</h3>
          <p className="text-slate-500 text-sm">Siga os passos abaixo para começar a gerir propinas.</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-5 mb-10">
          {ONBOARDING_STEPS.map((step, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.1 }}>
              <Card className="p-6 h-full flex flex-col hover:border-primary/30 transition-colors cursor-pointer group">
                <div className="w-12 h-12 rounded-xl bg-primary/8 flex items-center justify-center mb-5 group-hover:bg-primary/15 transition-colors">{step.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2"><span className="text-xs font-bold text-slate-400">Passo {i + 1}</span></div>
                  <h4 className="font-bold text-slate-900 mb-2">{step.title}</h4>
                  <p className="text-sm text-slate-500 leading-relaxed mb-5">{step.desc}</p>
                </div>
                <button className="flex items-center gap-2 text-sm font-semibold text-primary group-hover:gap-3 transition-all">
                  {step.action} <ArrowRight className="w-4 h-4"/>
                </button>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
        <h3 className="text-lg font-bold text-slate-900 mb-5">Resumo financeiro</h3>
        <div className="grid sm:grid-cols-3 gap-5">
          {[
            { label: "Total de Alunos", value: "—", sub: "Nenhum aluno ainda", icon: <Users className="text-blue-400"/>, bg: "bg-blue-50" },
            { label: "Propinas Pendentes", value: "—", sub: "Sem propinas geradas", icon: <AlertCircle className="text-amber-400"/>, bg: "bg-amber-50" },
            { label: "Total Recebido", value: "AOA 0", sub: "Sem pagamentos ainda", icon: <TrendingUp className="text-emerald-400"/>, bg: "bg-emerald-50" },
          ].map((stat, i) => (
            <Card key={i} className="p-6 flex items-start gap-4 opacity-60">
              <div className={`p-3 rounded-xl ${stat.bg}`}>{stat.icon}</div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">{stat.label}</p>
                <h3 className="text-2xl font-bold text-slate-400 mb-0.5">{stat.value}</h3>
                <p className="text-xs text-slate-400">{stat.sub}</p>
              </div>
            </Card>
          ))}
        </div>
      </motion.div>
      <GuardianPortalCard schoolId={schoolId}/>
    </div>
  );
}

function PopulatedDashboard({ schoolName, schoolId }: { schoolName: string; schoolId: string }) {
  const stats = [
    { label: "Total de Alunos", value: "247", trend: "+12% este mês", icon: <Users className="text-blue-500"/>, bg: "bg-blue-50" },
    { label: "Propinas Pendentes", value: "18", trend: "Referente a Maio", icon: <AlertCircle className="text-amber-500"/>, bg: "bg-amber-50" },
    { label: "Total Recebido (Mês)", value: "AOA 2.450.000", trend: "Em conformidade", icon: <TrendingUp className="text-emerald-500"/>, bg: "bg-emerald-50" },
  ];
  const recentTransactions = [
    { id: "TRX-001", student: "João Silva", grade: "10ª Classe", amount: "35.000 AOA", status: "Pago", date: "Hoje, 10:45" },
    { id: "TRX-002", student: "Maria Santos", grade: "8ª Classe", amount: "35.000 AOA", status: "Pago", date: "Hoje, 09:12" },
    { id: "TRX-003", student: "Pedro Costa", grade: "12ª Classe", amount: "40.000 AOA", status: "Pendente", date: "Ontem" },
    { id: "TRX-004", student: "Ana Lúcia", grade: "7ª Classe", amount: "35.000 AOA", status: "Pago", date: "Ontem" },
  ];
  return (
    <div className="p-6 lg:p-8 flex-1 overflow-y-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Bem-vindo, {schoolName}</h2>
          <p className="text-slate-500">Resumo financeiro de hoje.</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <Button variant="outline" className="flex-1 sm:flex-none bg-white"><FileText className="w-4 h-4 mr-2"/> Gerar Propina</Button>
          <Button className="flex-1 sm:flex-none"><Plus className="w-4 h-4 mr-2"/> Adicionar Aluno</Button>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {stats.map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card className="p-6 flex items-start gap-4">
              <div className={`p-4 rounded-xl ${stat.bg}`}>{stat.icon}</div>
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">{stat.label}</p>
                <h3 className="text-2xl font-bold text-slate-900 mb-1">{stat.value}</h3>
                <p className="text-xs font-medium text-slate-400">{stat.trend}</p>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
      <Card className="p-0 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
          <h3 className="font-bold text-lg text-slate-900">Pagamentos Recentes</h3>
          <button className="text-sm font-medium text-primary hover:underline">Ver todos</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">ID Transação</th>
                <th className="px-6 py-4">Aluno</th>
                <th className="px-6 py-4">Turma</th>
                <th className="px-6 py-4">Valor</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {recentTransactions.map((tx, i) => (
                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-slate-500">{tx.id}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{tx.student}</td>
                  <td className="px-6 py-4 text-slate-600">{tx.grade}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{tx.amount}</td>
                  <td className="px-6 py-4">
                    {tx.status === "Pago" ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5"/> {tx.status}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock className="w-3.5 h-3.5"/> {tx.status}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-500">{tx.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <GuardianPortalCard schoolId={schoolId}/>
    </div>
  );
}

/* ─── Main Dashboard ─── */
type DashView = "dashboard" | "ocorrencias";

export default function Dashboard() {
  const { session, token, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [view, setView] = useState<DashView>("dashboard");

  const schoolName = session?.schoolName ?? "Colégio";
  const schoolId = session?.schoolId ?? "";
  const isNew = session?.isNew ?? true;

  const handleLogout = () => { logout(); setLocation("/escolar"); };

  const initials = schoolName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  const NAV_ITEMS: { key: DashView | null; icon: React.ReactNode; label: string; href?: string }[] = [
    { key: "dashboard", icon: <LayoutDashboard className="w-5 h-5"/>, label: "Início" },
    { key: null, icon: <Users className="w-5 h-5"/>, label: "Alunos & Turmas" },
    { key: null, icon: <FileText className="w-5 h-5"/>, label: "Propinas & Faturas" },
    { key: "ocorrencias", icon: <AlertTriangle className="w-5 h-5"/>, label: "Ocorrências" },
    { key: null, icon: <BarChart3 className="w-5 h-5"/>, label: "Relatórios" },
    { key: null, icon: <Settings className="w-5 h-5"/>, label: "Configurações" },
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
          {NAV_ITEMS.map((item, i) => {
            const active = item.key !== null && view === item.key;
            const clickable = item.key !== null;
            return clickable ? (
              <button key={i} onClick={() => setView(item.key!)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-sm ${
                  active ? "bg-primary/10 text-primary font-medium" : "hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                }`}>
                {item.icon} {item.label}
              </button>
            ) : (
              <a key={i} href="#"
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 transition-colors text-sm text-slate-400 hover:text-slate-200">
                {item.icon} {item.label}
              </a>
            );
          })}
          <Link href="/encarregado"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 transition-colors text-sm text-emerald-400 hover:text-emerald-300 mt-2 border-t border-slate-800 pt-4">
            <GraduationCap className="w-5 h-5"/> Portal Encarregado
          </Link>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center">{initials}</div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{schoolName}</p>
              <p className="text-xs text-slate-500 truncate">{session?.adminEmail}</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 transition-colors text-red-400 hover:text-red-300 text-sm">
            <LogOut className="w-5 h-5"/> Terminar Sessão
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-10">
          <h1 className="font-semibold text-slate-900">
            {view === "ocorrencias" ? "Ocorrências" : "Dashboard"}
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

        <AnimatePresence mode="wait">
          {view === "ocorrencias" ? (
            <motion.div key="ocorrencias" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col">
              <OcorrenciasView token={token} schoolName={schoolName}/>
            </motion.div>
          ) : isNew ? (
            <motion.div key="onboarding" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1">
              <OnboardingDashboard schoolName={schoolName} schoolId={schoolId}/>
            </motion.div>
          ) : (
            <motion.div key="populated" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1">
              <PopulatedDashboard schoolName={schoolName} schoolId={schoolId}/>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
