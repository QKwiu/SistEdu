import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Building2, Mail, Phone, Lock, Loader2, User } from "lucide-react";
import { Button, Input, Card } from "@/components/ui-elements";

export default function Signup() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate API call delay
    setTimeout(() => {
      setIsLoading(false);
      setLocation("/dashboard");
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Link href="/" className="absolute top-8 left-8 text-xl font-display font-bold text-slate-900 flex items-center gap-2">
        <div className="w-8 h-8 rounded bg-primary text-white flex items-center justify-center">K</div>
        Kiwara <span className="text-primary">Escolar</span>
      </Link>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Card className="p-8 sm:p-10 shadow-2xl shadow-slate-200/50">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Criar Conta Escolar</h1>
            <p className="text-slate-500 text-sm">Registe o seu colégio e comece a faturar hoje.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="relative">
              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input 
                required 
                placeholder="Nome do Colégio" 
                className="pl-11"
              />
            </div>
            
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input 
                required 
                placeholder="NIF (Número de Identificação Fiscal)" 
                className="pl-11"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input 
                  required 
                  type="tel"
                  placeholder="Telefone" 
                  className="pl-11"
                />
              </div>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input 
                  required 
                  type="email"
                  placeholder="Email" 
                  className="pl-11"
                />
              </div>
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input 
                required 
                type="password"
                placeholder="Palavra-passe" 
                className="pl-11"
              />
            </div>

            <div className="pt-2">
              <Button 
                type="submit" 
                className="w-full h-12 text-base"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    A criar ambiente...
                  </>
                ) : "Registar Escola"}
              </Button>
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Ao registar-se, concorda com os nossos <Link href="#" className="text-primary hover:underline">Termos de Serviço</Link> e <Link href="#" className="text-primary hover:underline">Política de Privacidade</Link>.
          </p>
        </Card>
      </motion.div>
    </div>
  );
}
