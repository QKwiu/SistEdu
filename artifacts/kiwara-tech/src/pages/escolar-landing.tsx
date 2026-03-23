import { Link } from "wouter";
import { motion } from "framer-motion";
import { CheckCircle2, ChevronRight, BarChart3, Clock, Lock, Banknote } from "lucide-react";
import { Button, Card } from "@/components/ui-elements";

export default function EscolarLanding() {
  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Landing Navbar - Simplified */}
      <nav className="border-b border-slate-200 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-primary to-accent flex items-center justify-center">
               <span className="text-white font-bold text-sm">K</span>
            </div>
            <span className="font-display font-bold text-lg">Kiwara <span className="text-primary">Escolar</span></span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/signup" className="hidden sm:block text-sm font-medium text-slate-600 hover:text-slate-900">
              Iniciar Sessão
            </Link>
            <Link href="/signup">
              <Button size="sm">Criar Conta Grátis</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-20 lg:py-32 bg-slate-50 text-center px-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto"
        >
          <h1 className="text-5xl lg:text-7xl font-display font-extrabold text-slate-900 tracking-tight mb-8">
            Automatize a cobrança de propinas no seu colégio.
          </h1>
          <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
            Diga adeus às filas na tesouraria, aos pagamentos perdidos e às dores de cabeça financeiras. A plataforma Kiwara Escolar simplifica a gestão do seu colégio.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup" className="w-full sm:w-auto">
              <Button size="lg" className="w-full text-lg h-14">Criar Conta Grátis</Button>
            </Link>
            <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg h-14 bg-white">Ver Demonstração</Button>
          </div>
          <p className="mt-4 text-sm text-slate-500 font-medium">Nenhum cartão de crédito necessário.</p>
        </motion.div>
      </section>

      {/* Problem Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-display font-bold mb-4">A gestão manual custa-lhe tempo e dinheiro</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: "Filas Intermináveis", desc: "Encarregados de educação perdem horas nas tesourarias no final do mês." },
              { title: "Erros de Reconciliação", desc: "Comprovativos falsos ou transferências não identificadas no extrato bancário." },
              { title: "Falta de Controlo", desc: "Dificuldade em saber instantaneamente quem pagou e quem está em dívida." }
            ].map((p, i) => (
              <div key={i} className="bg-red-50/50 border border-red-100 p-8 rounded-2xl">
                <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center font-bold text-xl mb-6">0{i+1}</div>
                <h3 className="text-xl font-bold mb-3">{p.title}</h3>
                <p className="text-slate-600">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features/Benefits */}
      <section className="py-24 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-display font-bold mb-6">A Solução Kiwara</h2>
              <p className="text-slate-300 text-lg mb-8">
                Desenvolvemos um sistema focado na realidade angolana, integrando as melhores práticas financeiras com uma interface incrivelmente simples.
              </p>
              
              <ul className="space-y-6">
                {[
                  { icon: <Banknote />, title: "Referências Multicaixa", desc: "Geração automática de referências para pagamentos diretos no ATM ou Multicaixa Express." },
                  { icon: <Clock />, title: "Reconciliação em Tempo Real", desc: "O sistema atualiza o estado da propina automaticamente mal o pagamento é feito." },
                  { icon: <BarChart3 />, title: "Relatórios Detalhados", desc: "Saiba exatamente qual a receita prevista, arrecadada e pendente." },
                  { icon: <Lock />, title: "Segurança Bancária", desc: "Dados encriptados e acessos controlados por perfis de utilizador." }
                ].map((f, i) => (
                  <li key={i} className="flex gap-4">
                    <div className="mt-1 w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center text-primary shrink-0">
                      {f.icon}
                    </div>
                    <div>
                      <h4 className="text-lg font-bold">{f.title}</h4>
                      <p className="text-slate-400">{f.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl relative">
               <img src={`${import.meta.env.BASE_URL}images/school-hero.png`} alt="Interface do Kiwara Escolar" className="rounded-xl w-full shadow-lg" />
               <div className="absolute -right-6 top-1/4 bg-accent text-white py-3 px-6 rounded-xl font-bold shadow-xl shadow-accent/20 rotate-3">
                 +40% Eficiência
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1509062522246-3755977927d7?w=1920&q=80')] bg-cover opacity-10 mix-blend-overlay"></div>
        <div className="max-w-4xl mx-auto px-4 text-center relative z-10 text-white">
          <h2 className="text-4xl md:text-6xl font-display font-bold mb-6">Pronto para modernizar a sua escola?</h2>
          <p className="text-xl text-primary-foreground/80 mb-10">Junte-se a dezenas de colégios que já simplificaram a sua gestão financeira com o Kiwara Escolar.</p>
          <Link href="/signup">
            <Button size="lg" variant="accent" className="text-lg h-16 px-10 shadow-xl shadow-slate-900/20">
              Começar Agora Gratuitamente
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
