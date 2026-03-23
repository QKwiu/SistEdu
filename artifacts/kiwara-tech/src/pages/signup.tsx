import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, Mail, Phone, Lock, Loader2, User, CheckCircle2, ShieldCheck, Zap } from "lucide-react";
import { Button, Input, Card } from "@/components/ui-elements";
import { useAuth, generateSchoolId } from "@/lib/auth";

type Step = "form" | "creating" | "done";

const CREATION_STEPS = [
  "A criar o perfil do colégio...",
  "A gerar o seu ID único...",
  "A configurar o painel financeiro...",
  "A preparar o seu ambiente...",
];

export default function Signup() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [step, setStep] = useState<Step>("form");
  const [creationMsg, setCreationMsg] = useState(0);

  const [form, setForm] = useState({
    schoolName: "",
    nif: "",
    phone: "",
    email: "",
    password: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep("creating");

    let msgIdx = 0;
    const interval = setInterval(() => {
      msgIdx++;
      if (msgIdx < CREATION_STEPS.length) {
        setCreationMsg(msgIdx);
      } else {
        clearInterval(interval);
      }
    }, 700);

    setTimeout(() => {
      clearInterval(interval);
      const schoolId = generateSchoolId();
      login({
        schoolId,
        schoolName: form.schoolName,
        adminEmail: form.email,
        isNew: true,
      });
      setStep("done");
      setTimeout(() => setLocation("/dashboard"), 1200);
    }, 3200);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 flex items-center justify-center p-4">
      <Link href="/escolar" className="absolute top-8 left-8 text-lg font-display font-bold text-slate-900 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center font-extrabold">K</div>
        Kiwara <span className="text-primary">Escolar</span>
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <AnimatePresence mode="wait">
          {step === "form" && (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Card className="p-8 sm:p-10 shadow-2xl shadow-slate-200/60 border border-slate-100">
                <div className="text-center mb-8">
                  <div className="inline-flex items-center gap-2 bg-primary/8 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
                    <Zap className="w-3.5 h-3.5" /> Acesso imediato · Sem compromisso
                  </div>
                  <h1 className="text-2xl font-bold text-slate-900 mb-2">Criar Conta Escolar</h1>
                  <p className="text-slate-500 text-sm">Registe o seu colégio e comece a gerir propinas hoje.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                    <Input
                      name="schoolName"
                      required
                      placeholder="Nome do Colégio"
                      className="pl-11"
                      value={form.schoolName}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                    <Input
                      name="nif"
                      required
                      placeholder="NIF (Número de Identificação Fiscal)"
                      className="pl-11"
                      value={form.nif}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                      <Input
                        name="phone"
                        required
                        type="tel"
                        placeholder="Telefone"
                        className="pl-11"
                        value={form.phone}
                        onChange={handleChange}
                      />
                    </div>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                      <Input
                        name="email"
                        required
                        type="email"
                        placeholder="Email"
                        className="pl-11"
                        value={form.email}
                        onChange={handleChange}
                      />
                    </div>
                  </div>

                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                    <Input
                      name="password"
                      required
                      type="password"
                      placeholder="Palavra-passe"
                      className="pl-11"
                      value={form.password}
                      onChange={handleChange}
                    />
                  </div>

                  <Button type="submit" className="w-full h-12 text-base mt-2">
                    Criar Conta Grátis
                  </Button>
                </form>

                <div className="mt-6 flex items-center justify-center gap-5 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Dados seguros</span>
                  <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Sem cartão</span>
                  <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-emerald-500" /> Pronto em 30s</span>
                </div>

                <p className="mt-4 text-center text-xs text-slate-400">
                  Ao criar conta concorda com os{" "}
                  <Link href="#" className="text-primary hover:underline">Termos de Serviço</Link>{" "}
                  e a{" "}
                  <Link href="#" className="text-primary hover:underline">Política de Privacidade</Link>.
                </p>
              </Card>
            </motion.div>
          )}

          {step === "creating" && (
            <motion.div key="creating" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <Card className="p-10 shadow-2xl shadow-slate-200/60 text-center border border-slate-100">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary/20">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">A preparar o seu colégio</h2>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={creationMsg}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="text-slate-500 text-sm mb-8"
                  >
                    {CREATION_STEPS[creationMsg]}
                  </motion.p>
                </AnimatePresence>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 3, ease: "linear" }}
                  />
                </div>
              </Card>
            </motion.div>
          )}

          {step === "done" && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              <Card className="p-10 shadow-2xl shadow-slate-200/60 text-center border border-emerald-100">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">Colégio criado com sucesso!</h2>
                <p className="text-slate-500 text-sm">A redirecionar para o seu painel...</p>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
