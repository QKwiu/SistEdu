import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  CheckCircle2, X, BarChart3, Clock, Lock, Banknote,
  TrendingUp, Timer, DollarSign, PieChart, ChevronDown, ChevronUp,
  Smartphone, ArrowRight
} from "lucide-react";
import { Button, Card } from "@/components/ui-elements";
import { useState } from "react";

const faqs = [
  { q: "Preciso instalar algo?", a: "Não. Funciona totalmente online, basta ter acesso à internet." },
  { q: "Posso testar antes de pagar?", a: "Sim, oferecemos um período gratuito sem compromisso." },
  { q: "Funciona com Multicaixa?", a: "Sim, a plataforma está preparada para integração com Multicaixa e EMIS." },
  { q: "É seguro?", a: "Sim, utilizamos padrões modernos de segurança com dados encriptados e acessos controlados por perfis." },
];

function FAQ() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="space-y-3 max-w-2xl mx-auto">
      {faqs.map((faq, i) => (
        <div
          key={i}
          className="border border-slate-200 rounded-2xl overflow-hidden bg-white"
        >
          <button
            className="w-full flex items-center justify-between px-6 py-5 text-left"
            onClick={() => setOpen(open === i ? null : i)}
          >
            <span className="font-semibold text-slate-900">{faq.q}</span>
            {open === i ? <ChevronUp className="w-5 h-5 text-primary shrink-0" /> : <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />}
          </button>
          {open === i && (
            <div className="px-6 pb-5 text-slate-600 text-sm leading-relaxed border-t border-slate-100 pt-4">
              {faq.a}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function EscolarLanding() {
  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Navbar */}
      <nav className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between py-4">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md">
              <span className="text-white font-extrabold text-base">P</span>
            </div>
            <span className="font-display font-bold text-lg">Propina<span className="text-primary">Plus</span></span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/signup" className="hidden sm:block text-sm font-medium text-slate-600 hover:text-primary transition-colors px-3 py-2">
              Iniciar Sessão
            </Link>
            <Link href="/signup">
              <Button size="sm" className="rounded-full px-5">Criar Conta Grátis</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-24 lg:py-36 bg-gradient-to-b from-blue-50/60 to-white text-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-4xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 bg-primary/8 text-primary text-xs font-semibold px-4 py-2 rounded-full mb-8 border border-primary/15">
            <Smartphone className="w-3.5 h-3.5" /> Adaptado ao sistema angolano
          </div>
          <h1 className="text-5xl lg:text-7xl font-display font-extrabold text-slate-900 tracking-tight leading-tight mb-6">
            Automatize a cobrança de propinas<br className="hidden lg:block" /> no seu colégio.
          </h1>
          <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            Pare de perder o controlo de pagamentos. Com o nosso sistema, gere alunos, propinas e receba pagamentos com referências automáticas.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Link href="/signup" className="w-full sm:w-auto">
              <Button size="lg" className="w-full text-base h-14 px-8 rounded-full shadow-lg shadow-primary/20">
                Criar Conta Grátis <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="w-full sm:w-auto text-base h-14 px-8 rounded-full bg-white">
              Ver Demonstração
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
            {["Sem instalação", "Pronto em minutos", "Adaptado ao sistema angolano"].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> {t}
              </span>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Problems */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-slate-900 mb-4">
              Os desafios que os colégios enfrentam
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto">Isso resulta em perdas financeiras e desorganização.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {[
              "Dificuldade no controlo de propinas",
              "Pagamentos não rastreados",
              "Erros manuais e perda de tempo",
              "Falta de visibilidade financeira",
            ].map((prob, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex items-start gap-3 p-6 rounded-2xl bg-red-50 border border-red-100"
              >
                <div className="mt-0.5 w-6 h-6 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <X className="w-3.5 h-3.5 text-red-600" />
                </div>
                <p className="font-medium text-slate-800 text-sm leading-relaxed">{prob}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Solution */}
      <section className="py-24 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">A solução completa para o seu colégio</h2>
            <p className="text-slate-400 max-w-xl mx-auto">Tudo numa única plataforma simples e segura.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: <Banknote className="w-6 h-6" />, title: "Gestão de alunos e turmas", desc: "Cadastro completo de alunos com histórico de pagamentos e turmas organizadas." },
              { icon: <Clock className="w-6 h-6" />, title: "Geração automática de propinas", desc: "Propinas geradas automaticamente por mês, turma ou aluno." },
              { icon: <BarChart3 className="w-6 h-6" />, title: "Referências Multicaixa / EMIS", desc: "Referências de pagamento geradas automaticamente para ATM ou Multicaixa Express." },
              { icon: <CheckCircle2 className="w-6 h-6" />, title: "Confirmação automática", desc: "O sistema atualiza o estado da propina mal o pagamento é confirmado." },
              { icon: <PieChart className="w-6 h-6" />, title: "Relatórios financeiros", desc: "Relatórios em tempo real sobre receita prevista, arrecadada e pendente." },
              { icon: <Lock className="w-6 h-6" />, title: "Segurança e controlo", desc: "Dados encriptados e acessos controlados por perfis de utilizador." },
            ].map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="flex gap-4 p-6 rounded-2xl bg-slate-800 border border-slate-700 hover:border-primary/40 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/20 text-primary flex items-center justify-center shrink-0">{f.icon}</div>
                <div>
                  <h3 className="font-bold text-white mb-1">{f.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-slate-900 mb-4">Como funciona</h2>
          <p className="text-slate-500 mb-16">Simples, rápido e eficiente.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { num: "1", label: "Registe o seu colégio", desc: "Preencha o formulário e crie a sua conta em menos de 2 minutos." },
              { num: "2", label: "Adicione alunos", desc: "Importe ou registe os seus alunos e organize por turmas." },
              { num: "3", label: "Gere propinas", desc: "O sistema gera as propinas automaticamente com referências de pagamento." },
              { num: "4", label: "Receba sem esforço", desc: "Os pagamentos são confirmados automaticamente. Acompanhe tudo em tempo real." },
            ].map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex flex-col items-center text-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-extrabold text-xl mb-5 shadow-lg shadow-primary/20">
                  {step.num}
                </div>
                <h3 className="font-bold text-slate-900 mb-2">{step.label}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-slate-900 mb-4">Por que escolher a nossa plataforma?</h2>
            <p className="text-slate-500">Mais eficiência. Mais controlo. Mais resultados.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: <TrendingUp className="w-7 h-7 text-primary" />, title: "Aumente a taxa de cobrança", desc: "Notificações automáticas aumentam a taxa de pagamento dos encarregados." },
              { icon: <Timer className="w-7 h-7 text-primary" />, title: "Poupe tempo administrativo", desc: "Elimine tarefas manuais repetitivas e liberte a equipa para o que importa." },
              { icon: <DollarSign className="w-7 h-7 text-primary" />, title: "Controlo financeiro total", desc: "Visualize receitas, pendências e previsões em tempo real." },
              { icon: <BarChart3 className="w-7 h-7 text-primary" />, title: "Decisões baseadas em dados", desc: "Relatórios detalhados para suportar decisões estratégicas." },
            ].map((b, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="p-8 h-full hover:border-primary/20 transition-colors text-center">
                  <div className="w-14 h-14 rounded-2xl bg-primary/8 flex items-center justify-center mx-auto mb-5">{b.icon}</div>
                  <h3 className="font-bold text-slate-900 mb-3">{b.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{b.desc}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Preview */}
      <section className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-slate-900 mb-4">Veja como funciona na prática</h2>
          <p className="text-slate-500 mb-12">Interface simples e intuitiva para toda a equipa.</p>
          <div className="relative bg-slate-900 rounded-3xl p-6 sm:p-10 shadow-2xl overflow-hidden">
            <div className="flex gap-2 mb-6">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <img
              src={`${import.meta.env.BASE_URL}images/school-hero.png`}
              alt="Interface do PropinaPlus"
              className="rounded-xl w-full shadow-xl"
            />
            <div className="flex gap-3 justify-center mt-6">
              {["Dashboard", "Propinas", "Pagamentos"].map((t) => (
                <span key={t} className="text-xs font-semibold text-slate-400 bg-slate-800 px-3 py-1.5 rounded-full">{t}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-display font-bold text-slate-900 text-center mb-12">Perguntas Frequentes</h2>
          <FAQ />
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-28 bg-gradient-to-br from-primary via-primary to-accent relative overflow-hidden">
        <div className="max-w-3xl mx-auto px-4 text-center relative z-10 text-white">
          <h2 className="text-4xl md:text-5xl font-display font-extrabold mb-6 leading-tight">
            Comece agora gratuitamente
          </h2>
          <p className="text-xl text-white/80 mb-10">
            Crie a sua conta e comece a gerir o seu colégio hoje.
          </p>
          <Link href="/signup">
            <Button size="lg" className="text-lg h-16 px-12 rounded-full bg-white text-primary hover:bg-white/90 shadow-2xl shadow-slate-900/20 font-bold">
              Criar Conta Grátis
            </Button>
          </Link>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-white/70">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-white" /> Acesso imediato</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-white" /> Sem compromisso</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-white" /> Sem cartão de crédito</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 py-10 text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <span className="text-white font-bold text-xs">P</span>
            </div>
            <span className="text-white font-semibold">PropinaPlus</span>
            <span className="text-slate-600">© {new Date().getFullYear()}</span>
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition-colors">Termos</a>
            <a href="#" className="hover:text-white transition-colors">Privacidade</a>
            <a href="#" className="hover:text-white transition-colors">Contacto</a>
          </div>
          <div className="flex gap-5">
            <span>📞 Telefone</span>
            <span>✉️ Email</span>
            <span>💬 WhatsApp</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
