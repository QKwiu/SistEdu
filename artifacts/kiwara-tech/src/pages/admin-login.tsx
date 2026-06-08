import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, User, Eye, EyeOff, Shield, HelpCircle, X, Mail, Phone } from "lucide-react";
import { setAdminToken } from "@/lib/auth";

const API = "/api";

function RecoveryModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-md bg-slate-800 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm">Recuperar Acesso</h3>
              <p className="text-slate-400 text-xs">Área de Administração Central</p>
            </div>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
            <p className="text-amber-200 text-sm leading-relaxed">
              As credenciais de acesso ao painel de administração central são geridas
              directamente pela equipa técnica da <strong>Kiwara Tech</strong> através
              das configurações do servidor.
            </p>
          </div>
          <p className="text-slate-300 text-sm">
            Para recuperar o acesso, contacte o suporte técnico através dos seguintes meios:
          </p>
          <div className="space-y-2.5">
            <a href="mailto:suporte@kiwara.tech"
              className="flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 transition-colors group">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-white text-sm font-medium group-hover:text-primary transition-colors">suporte@kiwara.tech</p>
                <p className="text-slate-500 text-xs">E-mail de suporte técnico</p>
              </div>
            </a>
            <a href="tel:+244923000000"
              className="flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 transition-colors group">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                <Phone className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-white text-sm font-medium group-hover:text-emerald-400 transition-colors">+244 923 000 000</p>
                <p className="text-slate-500 text-xs">Linha de suporte (dias úteis)</p>
              </div>
            </a>
          </div>
        </div>

        <div className="px-6 pb-5">
          <button onClick={onClose}
            className="w-full py-2.5 bg-white/10 hover:bg-white/15 text-slate-300 text-sm font-medium rounded-xl transition-colors">
            Fechar
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const [form, setForm] = useState({ username: "", password: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showRecovery, setShowRecovery] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro de autenticação.");
      setAdminToken(data.token);
      setLocation("/admin/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/20 border border-primary/30 mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-white">Área de Administração</h1>
          <p className="text-slate-400 text-sm mt-1">Kiwara Tech — Plataforma Central</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={submit} className="space-y-5">
            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Utilizador</label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  autoComplete="username"
                  required
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="admin"
                  className="w-full pl-10 pr-4 py-3 bg-white/8 border border-white/15 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-300">Palavra-passe</label>
                <button type="button" onClick={() => setShowRecovery(true)}
                  className="text-xs text-slate-500 hover:text-primary transition-colors flex items-center gap-1">
                  <HelpCircle className="w-3 h-3" />
                  Esqueceu a palavra-passe?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="••••••"
                  className="w-full pl-10 pr-12 py-3 bg-white/8 border border-white/15 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/15 border border-red-500/30 rounded-xl px-4 py-3 text-red-300 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Autenticando...</>
              ) : "Entrar"}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          Kiwara Tech © {new Date().getFullYear()} — Uso restrito a administradores
        </p>
      </motion.div>

      {/* Recovery Modal */}
      <AnimatePresence>
        {showRecovery && <RecoveryModal onClose={() => setShowRecovery(false)} />}
      </AnimatePresence>
    </div>
  );
}
