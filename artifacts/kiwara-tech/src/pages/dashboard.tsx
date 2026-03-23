import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Users, FileText, Settings, LogOut,
  Bell, Search, Plus, TrendingUp, AlertCircle, CheckCircle2,
  Clock, BarChart3, ArrowRight, GraduationCap, Banknote, PartyPopper
} from "lucide-react";
import { Button, Card } from "@/components/ui-elements";
import { useAuth } from "@/lib/auth";

const ONBOARDING_STEPS = [
  {
    icon: <Users className="w-6 h-6 text-primary" />,
    title: "Adicionar alunos",
    desc: "Registe os seus alunos e organize-os por turmas.",
    action: "Adicionar Aluno",
  },
  {
    icon: <GraduationCap className="w-6 h-6 text-primary" />,
    title: "Criar turmas",
    desc: "Organize os alunos em turmas para uma gestão mais simples.",
    action: "Criar Turma",
  },
  {
    icon: <Banknote className="w-6 h-6 text-primary" />,
    title: "Gerar propinas",
    desc: "Gere propinas automaticamente e envie referências de pagamento.",
    action: "Gerar Propina",
  },
];

function OnboardingDashboard({ schoolName, schoolId }: { schoolName: string; schoolId: string }) {
  return (
    <div className="p-6 lg:p-10 flex-1">
      {/* Welcome banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-primary to-accent rounded-3xl p-8 text-white mb-10 relative overflow-hidden"
      >
        <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-10">
          <PartyPopper className="w-40 h-40" />
        </div>
        <div className="relative">
          <div className="flex items-center gap-2 text-white/70 text-sm font-medium mb-3">
            <CheckCircle2 className="w-4 h-4" /> Conta criada com sucesso
          </div>
          <h2 className="text-3xl font-display font-extrabold mb-2">
            Bem-vindo, {schoolName}!
          </h2>
          <p className="text-white/80 text-lg mb-1">O seu colégio está pronto para começar.</p>
          <p className="text-white/50 text-xs font-mono mt-3">ID: {schoolId}</p>
        </div>
      </motion.div>

      {/* Onboarding steps */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <div className="mb-6">
          <h3 className="text-xl font-bold text-slate-900 mb-1">Configure o seu colégio</h3>
          <p className="text-slate-500 text-sm">Siga os passos abaixo para começar a gerir propinas.</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-5 mb-10">
          {ONBOARDING_STEPS.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
            >
              <Card className="p-6 h-full flex flex-col hover:border-primary/30 transition-colors cursor-pointer group">
                <div className="w-12 h-12 rounded-xl bg-primary/8 flex items-center justify-center mb-5 group-hover:bg-primary/15 transition-colors">
                  {step.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-slate-400">Passo {i + 1}</span>
                  </div>
                  <h4 className="font-bold text-slate-900 mb-2">{step.title}</h4>
                  <p className="text-sm text-slate-500 leading-relaxed mb-5">{step.desc}</p>
                </div>
                <button className="flex items-center gap-2 text-sm font-semibold text-primary group-hover:gap-3 transition-all">
                  {step.action} <ArrowRight className="w-4 h-4" />
                </button>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Empty stats */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <h3 className="text-lg font-bold text-slate-900 mb-5">Resumo financeiro</h3>
        <div className="grid sm:grid-cols-3 gap-5">
          {[
            { label: "Total de Alunos", value: "—", sub: "Nenhum aluno ainda", icon: <Users className="text-blue-400" />, bg: "bg-blue-50" },
            { label: "Propinas Pendentes", value: "—", sub: "Sem propinas geradas", icon: <AlertCircle className="text-amber-400" />, bg: "bg-amber-50" },
            { label: "Total Recebido", value: "AOA 0", sub: "Sem pagamentos ainda", icon: <TrendingUp className="text-emerald-400" />, bg: "bg-emerald-50" },
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
    </div>
  );
}

function PopulatedDashboard({ schoolName }: { schoolName: string }) {
  const stats = [
    { label: "Total de Alunos", value: "247", trend: "+12% este mês", icon: <Users className="text-blue-500" />, bg: "bg-blue-50" },
    { label: "Propinas Pendentes", value: "18", trend: "Referente a Maio", icon: <AlertCircle className="text-amber-500" />, bg: "bg-amber-50" },
    { label: "Total Recebido (Mês)", value: "AOA 2.450.000", trend: "Em conformidade", icon: <TrendingUp className="text-emerald-500" />, bg: "bg-emerald-50" },
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
          <Button variant="outline" className="flex-1 sm:flex-none bg-white">
            <FileText className="w-4 h-4 mr-2" /> Gerar Propina
          </Button>
          <Button className="flex-1 sm:flex-none">
            <Plus className="w-4 h-4 mr-2" /> Adicionar Aluno
          </Button>
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
                        <CheckCircle2 className="w-3.5 h-3.5" /> {tx.status}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock className="w-3.5 h-3.5" /> {tx.status}
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
    </div>
  );
}

export default function Dashboard() {
  const { session, logout } = useAuth();
  const [, setLocation] = useLocation();

  const schoolName = session?.schoolName ?? "Colégio";
  const schoolId = session?.schoolId ?? "";
  const isNew = session?.isNew ?? true;

  const handleLogout = () => {
    logout();
    setLocation("/escolar");
  };

  const initials = schoolName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="bg-slate-900 text-slate-300 w-64 flex-shrink-0 hidden md:flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center font-extrabold mr-3 text-sm">K</div>
          <span className="font-display font-bold text-white text-base">Kiwara Escolar</span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
          <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-primary/10 text-primary font-medium text-sm">
            <LayoutDashboard className="w-5 h-5" /> Início
          </Link>
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 transition-colors text-sm">
            <Users className="w-5 h-5" /> Alunos & Turmas
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 transition-colors text-sm">
            <FileText className="w-5 h-5" /> Propinas & Faturas
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 transition-colors text-sm">
            <BarChart3 className="w-5 h-5" /> Relatórios
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 transition-colors text-sm">
            <Settings className="w-5 h-5" /> Configurações
          </a>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{schoolName}</p>
              <p className="text-xs text-slate-500 truncate">{session?.adminEmail}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 transition-colors text-red-400 hover:text-red-300 text-sm"
          >
            <LogOut className="w-5 h-5" /> Terminar Sessão
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-10">
          <h1 className="font-semibold text-slate-900">Dashboard</h1>
          <div className="flex items-center gap-4">
            <div className="relative hidden sm:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Pesquisar aluno..."
                className="pl-9 pr-4 py-2 bg-slate-100 border-transparent rounded-full text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all w-56"
              />
            </div>
            <button className="relative p-2 text-slate-500 hover:text-slate-900">
              <Bell className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center font-bold text-xs shadow-sm">
              {initials}
            </div>
          </div>
        </header>

        {isNew ? (
          <OnboardingDashboard schoolName={schoolName} schoolId={schoolId} />
        ) : (
          <PopulatedDashboard schoolName={schoolName} />
        )}
      </main>
    </div>
  );
}
