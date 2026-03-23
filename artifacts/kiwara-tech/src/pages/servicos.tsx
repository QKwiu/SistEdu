import { Link } from "wouter";
import { motion } from "framer-motion";
import { Code, Database, Server, Smartphone, Cloud, Shield, ArrowLeft } from "lucide-react";
import { PageLayout } from "@/components/layout";
import { Card, Button } from "@/components/ui-elements";

export default function Servicos() {
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
