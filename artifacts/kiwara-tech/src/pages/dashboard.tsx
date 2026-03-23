import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { 
  LayoutDashboard, Users, FileText, Settings, LogOut, 
  Bell, Search, Plus, TrendingUp, AlertCircle, CheckCircle2 
} from "lucide-react";
import { Button, Card } from "@/components/ui-elements";

export default function Dashboard() {
  const [isSidebarOpen, setSidebarOpen] = useState(true);

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
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className={`bg-slate-900 text-slate-300 w-64 flex-shrink-0 hidden md:flex flex-col transition-all duration-300 ${isSidebarOpen ? '' : '-ml-64'}`}>
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <div className="w-8 h-8 rounded bg-primary text-white flex items-center justify-center font-bold mr-3">K</div>
          <span className="font-display font-bold text-white text-lg">Kiwara Escolar</span>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-1">
          <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary/10 text-primary font-medium">
            <LayoutDashboard className="w-5 h-5" /> Início
          </Link>
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition-colors">
            <Users className="w-5 h-5" /> Alunos & Turmas
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition-colors">
            <FileText className="w-5 h-5" /> Propinas & Faturas
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition-colors">
            <Settings className="w-5 h-5" /> Configurações
          </a>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <Link href="/" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition-colors text-red-400 hover:text-red-300">
            <LogOut className="w-5 h-5" /> Terminar Sessão
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="text-slate-500 hover:text-slate-900 hidden md:block">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinelinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <h1 className="font-semibold text-xl text-slate-900">Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative hidden sm:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Pesquisar aluno..." 
                className="pl-9 pr-4 py-2 bg-slate-100 border-transparent rounded-full text-sm focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none w-64"
              />
            </div>
            <button className="relative p-2 text-slate-500 hover:text-slate-900">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 border-2 border-white"></span>
            </button>
            <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center font-medium shadow-sm">
              AM
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="p-6 lg:p-8 flex-1 overflow-y-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Bem-vindo ao sistema, Admin</h2>
              <p className="text-slate-500">Aqui está o resumo financeiro do Colégio Esperança de hoje.</p>
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              <Button variant="outline" className="flex-1 sm:flex-none bg-white"><FileText className="w-4 h-4 mr-2"/> Gerar Propina</Button>
              <Button className="flex-1 sm:flex-none"><Plus className="w-4 h-4 mr-2"/> Adicionar Aluno</Button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {stats.map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="p-6 flex items-start gap-4">
                  <div className={`p-4 rounded-xl ${stat.bg}`}>
                    {stat.icon}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500 mb-1">{stat.label}</p>
                    <h3 className="text-2xl font-bold text-slate-900 mb-1">{stat.value}</h3>
                    <p className="text-xs font-medium text-slate-400">{stat.trend}</p>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Recent Activity Table */}
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
                        {tx.status === 'Pago' ? (
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
      </main>
    </div>
  );
}
