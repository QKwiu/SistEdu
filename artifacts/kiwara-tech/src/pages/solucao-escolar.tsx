import { Link } from "wouter";
import { motion } from "framer-motion";
import { GraduationCap, ArrowRight, Wallet, Users, LayoutDashboard, ShieldCheck } from "lucide-react";
import { PageLayout } from "@/components/layout";
import { Button } from "@/components/ui-elements";

export default function SolucaoEscolar() {
  return (
    <PageLayout>
      <div className="min-h-[80vh] flex items-center bg-slate-900 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 right-1/4 w-[800px] h-[800px] bg-primary/20 rounded-full blur-[120px] mix-blend-screen opacity-50 animate-pulse" />
          <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] bg-accent/20 rounded-full blur-[100px] mix-blend-screen opacity-50" />
        </div>
        
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1577896851231-70ef18881754?w=1920&q=80')] bg-cover bg-center opacity-10 mix-blend-overlay" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 py-24">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white font-medium mb-8 backdrop-blur-sm">
                <GraduationCap className="w-5 h-5 text-accent" />
                Produto Estrela Kiwara
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-7xl font-display font-extrabold text-white leading-tight mb-6">
                Sistema de Gestão Escolar
              </h1>
              <p className="text-xl text-slate-300 mb-10 leading-relaxed max-w-xl">
                A plataforma definitiva para colégios angolanos. Automatize a cobrança de propinas, acabe com as filas na tesouraria e tenha controlo financeiro total.
              </p>
              
              <div className="space-y-4 mb-10">
                {[
                  { icon: <Wallet className="text-accent w-5 h-5" />, text: "Pagamentos e reconciliação automática" },
                  { icon: <Users className="text-accent w-5 h-5" />, text: "Portal do Aluno e Encarregado de Educação" },
                  { icon: <LayoutDashboard className="text-accent w-5 h-5" />, text: "Gestão completa de matrículas e turmas" },
                  { icon: <ShieldCheck className="text-accent w-5 h-5" />, text: "Relatórios financeiros blindados e seguros" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-white text-lg font-medium">
                    <div className="p-1 bg-white/10 rounded-md backdrop-blur-sm">{item.icon}</div>
                    {item.text}
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/escolar">
                  <Button size="lg" variant="accent" className="w-full sm:w-auto text-lg px-8 h-14 group">
                    Explorar Produto Completo
                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Link href="/servicos">
                  <Button size="lg" variant="ghost" className="w-full sm:w-auto text-white hover:bg-white/10 hover:text-white h-14">
                    Ver outros serviços
                  </Button>
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="hidden lg:block relative"
            >
              <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-slate-800/50 backdrop-blur-sm p-4">
                <img 
                  src={`${import.meta.env.BASE_URL}images/school-hero.png`} 
                  alt="Dashboard Preview" 
                  className="rounded-xl w-full shadow-inner"
                />
                
                {/* Floating Elements */}
                <div className="absolute -bottom-6 -left-6 bg-white rounded-xl p-4 shadow-xl border border-slate-100 flex items-center gap-4 animate-bounce" style={{ animationDuration: '3s' }}>
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <ShieldCheck className="text-green-600 w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-sm text-slate-500 font-medium">Propina Paga</div>
                    <div className="text-slate-900 font-bold">AOA 35.000</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
