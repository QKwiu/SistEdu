import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Code, Database, Server, GraduationCap, CheckCircle2 } from "lucide-react";
import { Button, Card } from "@/components/ui-elements";
import { PageLayout } from "@/components/layout";

export default function Home() {
  return (
    <PageLayout>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-background pt-16 pb-32">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/5 to-transparent rounded-bl-full" />
          <div className="absolute bottom-0 left-0 w-1/3 h-1/2 bg-gradient-to-tr from-accent/5 to-transparent rounded-tr-full" />
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="max-w-2xl"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-sm font-medium text-slate-600 mb-6 shadow-sm">
                <span className="flex h-2 w-2 rounded-full bg-accent animate-pulse"></span>
                Inovação tecnológica em Angola
              </div>
              <h1 className="text-5xl lg:text-6xl font-display font-extrabold leading-[1.1] mb-6">
                Soluções tecnológicas que <span className="text-gradient">impulsionam negócios</span>.
              </h1>
              <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                A PropinaPlus desenvolve software e sistemas de gestão desenhados para modernizar a sua empresa, automatizar processos e escalar os seus resultados.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/servicos">
                  <Button size="lg" className="w-full sm:w-auto">
                    Conhecer Serviços
                  </Button>
                </Link>
                <Link href="/solucoes/escolar">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto group">
                    Ver Sistema Escolar <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative lg:h-[600px] rounded-3xl overflow-hidden shadow-2xl border border-white/20"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent z-10" />
              <img 
                src={`${import.meta.env.BASE_URL}images/hero-main.png`} 
                alt="Digital Transformation" 
                className="w-full h-full object-cover"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">O que fazemos</h2>
            <p className="text-slate-600 text-lg">
              Especialistas em transformação digital, oferecemos um leque de serviços para levar a sua operação para o próximo nível.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: <Code className="w-8 h-8 text-primary" />,
                title: "Desenvolvimento de Software",
                desc: "Sistemas à medida, desenhados especificamente para os processos e necessidades da sua empresa."
              },
              {
                icon: <Server className="w-8 h-8 text-primary" />,
                title: "Consultoria em IT",
                desc: "Aconselhamento estratégico para modernização da infraestrutura e adoção de novas tecnologias."
              },
              {
                icon: <Database className="w-8 h-8 text-primary" />,
                title: "Integração de Sistemas",
                desc: "Conectamos as suas ferramentas existentes para que a informação flua sem atritos e sem silos."
              }
            ].map((service, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="h-full hover:-translate-y-1 transition-transform duration-300">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                    {service.icon}
                  </div>
                  <h3 className="text-xl font-bold mb-3">{service.title}</h3>
                  <p className="text-slate-600">{service.desc}</p>
                </Card>
              </motion.div>
            ))}

            {/* Highlighted Service Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="lg:col-span-1"
            >
              <div className="h-full bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-8 shadow-xl shadow-slate-900/20 flex flex-col relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-accent/20 rounded-full blur-3xl -mr-10 -mt-10" />
                <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center mb-6 border border-white/10">
                  <GraduationCap className="w-8 h-8 text-accent" />
                </div>
                <h3 className="text-xl font-display font-bold mb-3">PropinaPlus Escolar</h3>
                <p className="text-slate-300 mb-8 flex-grow">
                  A nossa solução SaaS de referência para a gestão completa de pagamentos e propinas em colégios.
                </p>
                <Link href="/solucoes/escolar" className="mt-auto">
                  <Button variant="accent" className="w-full justify-between group-hover:bg-accent">
                    Ver Solução <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* About/Trust Section */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-slate-100 flex flex-col lg:flex-row gap-12 items-center">
            <div className="lg:w-1/2">
              <h2 className="text-3xl md:text-4xl font-display font-bold mb-6">Porquê escolher a PropinaPlus?</h2>
              <ul className="space-y-4">
                {[
                  "Equipa local com conhecimento do mercado angolano",
                  "Foco absoluto na segurança e integridade dos dados",
                  "Suporte técnico dedicado e responsivo",
                  "Tecnologias cloud escaláveis e modernas"
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-accent shrink-0" />
                    <span className="text-slate-700 text-lg">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:w-1/2 grid grid-cols-2 gap-4 w-full">
              <div className="bg-slate-50 p-6 rounded-2xl text-center border border-slate-100">
                <div className="text-4xl font-display font-bold text-primary mb-2">99.9%</div>
                <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">Uptime</div>
              </div>
              <div className="bg-slate-50 p-6 rounded-2xl text-center border border-slate-100">
                <div className="text-4xl font-display font-bold text-primary mb-2">24/7</div>
                <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">Suporte</div>
              </div>
              <div className="col-span-2 bg-gradient-to-r from-primary/10 to-accent/10 p-6 rounded-2xl text-center border border-primary/20">
                <div className="text-2xl font-display font-bold text-slate-900 mb-2">Feito em Angola</div>
                <div className="text-sm text-slate-600">Com tecnologia de classe mundial</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
