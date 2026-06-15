import { Link } from "wouter";
import { motion } from "framer-motion";
import { Code, Database, Server, Smartphone, Cloud, Shield, ArrowLeft, Bot, BarChart2, GraduationCap, ArrowRight } from "lucide-react";
import { PageLayout } from "@/components/layout";
import { Card, Button } from "@/components/ui-elements";

export default function Servicos() {
  const featuredServices = [
    {
      id: "escolar",
      icon: <GraduationCap className="w-10 h-10 text-white" />,
      badge: "Lançamento",
      badgeColor: "bg-emerald-400/20 text-emerald-300",
      highlighted: true,
      title: "Pagamentos e Reconciliação Escolar",
      desc: "O primeiro produto da PropinaPlus já disponível. Automatize a cobrança de propinas, gere referências Multicaixa e tenha controlo financeiro total do seu colégio numa plataforma simples e segura.",
      features: ["Geração automática de propinas", "Referências Multicaixa / EMIS", "Confirmação automática de pagamentos", "Relatórios financeiros em tempo real"],
      href: "/solucoes/escolar",
      cta: "Ver o produto",
    },
    {
      id: "ia",
      icon: <Bot className="w-10 h-10 text-primary" />,
      badge: "Em breve",
      badgeColor: "bg-primary/10 text-primary",
      highlighted: false,
      title: "Agência de IA — Automação de Processos",
      desc: "Transformamos fluxos de trabalho manuais em processos automatizados com Inteligência Artificial. Chatbots, pipelines de decisão e muito mais.",
      features: ["Chatbots & Assistentes Virtuais", "Automação de Documentos", "Integração com LLMs (GPT, Gemini)", "Workflows Inteligentes"],
      href: null,
      cta: null,
    },
    {
      id: "dados",
      icon: <BarChart2 className="w-10 h-10 text-primary" />,
      badge: "Em breve",
      badgeColor: "bg-primary/10 text-primary",
      highlighted: false,
      title: "Análise de Dados",
      desc: "Transformamos os dados da sua empresa em vantagem competitiva. Dashboards, relatórios e modelos preditivos para decisões estratégicas.",
      features: ["Dashboards Interativos", "Relatórios Automatizados", "Modelos Preditivos", "Business Intelligence"],
      href: null,
      cta: null,
    },
  ];

  const services = [
    {
      icon: <Code className="w-10 h-10 text-primary" />,
      title: "Desenvolvimento de Software à Medida",
      desc: "Criamos plataformas robustas desenhadas exatamente para os requisitos do seu negócio, seja um ERP interno, um CRM ou uma ferramenta operacional complexa.",
      features: ["Aplicações Web", "Automação de Processos", "Painéis de Controlo"]
    },
    {
      icon: <Smartphone className="w-10 h-10 text-primary" />,
      title: "Desenvolvimento Mobile",
      desc: "Aplicações nativas ou híbridas (iOS e Android) com experiências de utilizador fluidas e integração total com os sistemas da sua empresa.",
      features: ["React Native / Flutter", "Apps Nativas", "UI/UX Design"]
    },
    {
      icon: <Server className="w-10 h-10 text-primary" />,
      title: "Consultoria IT",
      desc: "Analisamos a sua infraestrutura atual e desenhamos roteiros de modernização tecnológica para otimizar custos e maximizar eficiência.",
      features: ["Auditoria de Sistemas", "Planeamento Cloud", "Otimização de Custos"]
    },
    {
      icon: <Database className="w-10 h-10 text-primary" />,
      title: "Integração de Sistemas & APIs",
      desc: "Eliminamos o trabalho manual conetando os seus sistemas dispersos. Fazemos com que o seu software financeiro fale com o seu CRM automaticamente.",
      features: ["Desenvolvimento de APIs", "Webhooks", "Sincronização de Dados"]
    },
    {
      icon: <Cloud className="w-10 h-10 text-primary" />,
      title: "Migração para Cloud",
      desc: "Apoiamos a transição da sua empresa para serviços em nuvem (AWS, Azure, Google Cloud), garantindo escalabilidade e disponibilidade.",
      features: ["Arquitetura Cloud", "Deployments Contínuos", "Manutenção"]
    },
    {
      icon: <Shield className="w-10 h-10 text-primary" />,
      title: "Segurança da Informação",
      desc: "Implementamos práticas e sistemas de segurança rigorosos para proteger os dados sensíveis da sua empresa e dos seus clientes.",
      features: ["Auditorias de Segurança", "Backups Automáticos", "Conformidade (RGPD)"]
    }
  ];

  return (
    <PageLayout>
      <div className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <Link href="/" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-primary mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao Início
          </Link>
          <h1 className="text-4xl lg:text-5xl font-display font-bold text-slate-900 mb-6">
            Nossos Serviços
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl leading-relaxed">
            Um ecossistema completo de soluções tecnológicas para digitalizar, proteger e escalar a sua organização.
          </p>
        </div>
      </div>

      <div className="py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Featured services */}
          <div className="mb-16">
            <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">Soluções em Destaque</p>
            <h2 className="text-3xl font-display font-bold text-slate-900 mb-10">Tecnologia de ponta para o seu negócio</h2>
            <div className="grid lg:grid-cols-3 gap-6 items-stretch">
              {featuredServices.map((service, index) => (
                <motion.div
                  id={service.id}
                  key={service.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  className="flex"
                >
                  {service.highlighted ? (
                    <div className="flex flex-col w-full rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700 p-8 shadow-2xl shadow-slate-900/20 ring-2 ring-primary/30">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/30">
                          {service.icon}
                        </div>
                        <span className={`text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wide ${service.badgeColor}`}>
                          {service.badge}
                        </span>
                      </div>
                      <h3 className="text-xl font-bold text-white mb-3">{service.title}</h3>
                      <p className="text-slate-400 text-sm mb-6 flex-grow leading-relaxed">{service.desc}</p>
                      <div className="pt-6 border-t border-slate-700 mb-6">
                        <ul className="space-y-2.5">
                          {service.features.map((feature, i) => (
                            <li key={i} className="flex items-center text-sm text-slate-300">
                              <div className="w-1.5 h-1.5 rounded-full bg-primary mr-2.5 shrink-0" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </div>
                      {service.href && (
                        <Link href={service.href}>
                          <button className="flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 transition-colors group">
                            {service.cta} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </button>
                        </Link>
                      )}
                    </div>
                  ) : (
                    <Card className="h-full flex flex-col w-full border-slate-200 hover:border-primary/30 transition-colors opacity-80">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-primary/8 flex items-center justify-center">{service.icon}</div>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${service.badgeColor}`}>
                          {service.badge}
                        </span>
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-3">{service.title}</h3>
                      <p className="text-slate-600 text-sm mb-6 flex-grow leading-relaxed">{service.desc}</p>
                      <div className="pt-6 border-t border-slate-100">
                        <ul className="space-y-2">
                          {service.features.map((feature, i) => (
                            <li key={i} className="flex items-center text-sm font-medium text-slate-600">
                              <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mr-2 shrink-0" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </Card>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-16">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-sm text-slate-400 font-medium">Outros Serviços</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Other services */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((service, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <Card className="h-full flex flex-col hover:border-primary/30 transition-colors">
                  <div className="mb-6">{service.icon}</div>
                  <h3 className="text-2xl font-bold mb-3">{service.title}</h3>
                  <p className="text-slate-600 mb-6 flex-grow">{service.desc}</p>
                  <div className="pt-6 border-t border-slate-100">
                    <ul className="space-y-2">
                      {service.features.map((feature, i) => (
                        <li key={i} className="flex items-center text-sm font-medium text-slate-700">
                          <div className="w-1.5 h-1.5 rounded-full bg-accent mr-2" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="mt-24 text-center">
            <h3 className="text-2xl font-display font-bold mb-6">Precisa de uma solução específica?</h3>
            <Button size="lg">Falar com a nossa equipa</Button>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
