import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, RefreshCw, AlertCircle, CheckCircle2, Shield, ArrowLeft, Phone } from "lucide-react";

const API = "/api";
const GUARDIAN_TOKEN_KEY = "kiwara_guardian_token";

interface SchoolInfo {
  name: string;
  logo_url: string | null;
  institution_type: string;
  portal_nomenclatura: string;
  slug: string;
}

export default function PortalPublico() {
  const [, params] = useRoute("/portal/:slug");
  const [, setLocation] = useLocation();
  const slug = params?.slug ?? "";

  const [school, setSchool] = useState<SchoolInfo | null>(null);
  const [loadingSchool, setLoadingSchool] = useState(true);
  const [schoolError, setSchoolError] = useState("");

  const [step, setStep] = useState<"contact" | "password" | "set-password">("contact");
  const [contact, setContact] = useState("");
  const [nome, setNome] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showPassConfirm, setShowPassConfirm] = useState(false);

  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetch(`${API}/portal/${slug}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setSchoolError(d.error); return; }
        setSchool(d);
      })
      .catch(() => setSchoolError("Não foi possível carregar o portal. Verifique o link."))
      .finally(() => setLoadingSchool(false));
  }, [slug]);

  const handleCheckContact = async () => {
    if (!contact.trim()) { setError("Introduza o seu telemóvel ou email."); return; }
    setChecking(true); setError("");
    try {
      const r = await fetch(`${API}/portal/${slug}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact: contact.trim() }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Erro ao validar contacto."); return; }
      setNome(d.nome);
      setStep(d.needs_password ? "set-password" : "password");
    } catch { setError("Erro de ligação. Tente novamente."); }
    finally { setChecking(false); }
  };

  const handleLogin = async () => {
    if (!password) { setError("Introduza a palavra-passe."); return; }
    setSubmitting(true); setError("");
    try {
      const r = await fetch(`${API}/portal/${slug}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact: contact.trim(), password }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Erro ao iniciar sessão."); return; }
      localStorage.setItem(GUARDIAN_TOKEN_KEY, d.token);
      setSuccess(true);
      setTimeout(() => setLocation("/encarregado"), 1200);
    } catch { setError("Erro de ligação. Tente novamente."); }
    finally { setSubmitting(false); }
  };

  const handleSetPassword = async () => {
    if (!password.trim()) { setError("Introduza uma palavra-passe."); return; }
    if (password.trim().length < 6) { setError("A palavra-passe deve ter pelo menos 6 caracteres."); return; }
    if (password !== passwordConfirm) { setError("As palavras-passe não coincidem."); return; }
    setSubmitting(true); setError("");
    try {
      const r = await fetch(`${API}/portal/${slug}/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact: contact.trim(), password: password.trim() }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Erro ao definir palavra-passe."); return; }
      localStorage.setItem(GUARDIAN_TOKEN_KEY, d.token);
      setSuccess(true);
      setTimeout(() => setLocation("/encarregado"), 1200);
    } catch { setError("Erro de ligação. Tente novamente."); }
    finally { setSubmitting(false); }
  };

  if (loadingSchool) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-white animate-spin"/>
      </div>
    );
  }

  if (schoolError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4"/>
          <h2 className="font-bold text-slate-900 text-lg mb-2">Portal não encontrado</h2>
          <p className="text-sm text-slate-500">{schoolError}</p>
        </div>
      </div>
    );
  }

  const initials = school!.name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();
  const portalLabel = school!.portal_nomenclatura === "aluno" ? "Portal do Aluno" : "Portal do Encarregado";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 px-6 pt-8 pb-10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-4 shadow-lg overflow-hidden">
              {school!.logo_url
                ? <img src={school!.logo_url} alt={school!.name} className="w-full h-full object-cover"/>
                : <span className="text-white font-bold text-xl">{initials}</span>}
            </div>
            <h1 className="text-white font-bold text-lg leading-tight">{school!.name}</h1>
            <p className="text-indigo-200 text-sm mt-1">{portalLabel}</p>
          </div>

          {/* Card body */}
          <div className="px-6 py-6 -mt-4 relative">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-5 py-5">
              <AnimatePresence mode="wait">
                {success ? (
                  <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-4">
                    <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-3"/>
                    <p className="font-bold text-slate-900 text-lg">Bem-vindo(a)!</p>
                    <p className="text-sm text-slate-500 mt-1">A redirecionar para o painel...</p>
                  </motion.div>
                ) : step === "contact" ? (
                  <motion.div key="contact" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                        <Shield className="w-4 h-4 text-indigo-600"/>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">Acesso Condicionado</p>
                        <p className="text-xs text-slate-400">Contacto registado na matrícula</p>
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Telemóvel ou Email</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
                        <input type="text" value={contact} onChange={e => { setContact(e.target.value); setError(""); }}
                          onKeyDown={e => e.key === "Enter" && handleCheckContact()}
                          placeholder="9XX XXX XXX ou nome@email.com"
                          className="w-full pl-10 pr-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
                      </div>
                    </div>
                    {error && (
                      <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-700 mb-3">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"/>
                        {error}
                      </div>
                    )}
                    <button onClick={handleCheckContact} disabled={checking}
                      className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-60 text-sm flex items-center justify-center gap-2 transition-colors">
                      {checking ? <RefreshCw className="w-4 h-4 animate-spin"/> : "Continuar"}
                    </button>
                  </motion.div>
                ) : step === "password" ? (
                  <motion.div key="password" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                    <button onClick={() => { setStep("contact"); setError(""); setPassword(""); }}
                      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 mb-4 transition-colors">
                      <ArrowLeft className="w-3.5 h-3.5"/> Voltar
                    </button>
                    <p className="text-sm font-bold text-slate-900 mb-1">Olá, {nome}!</p>
                    <p className="text-xs text-slate-500 mb-4">Introduza a sua palavra-passe para aceder ao portal.</p>
                    <div className="mb-4">
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Palavra-passe</label>
                      <div className="relative">
                        <input type={showPass ? "text" : "password"} value={password}
                          onChange={e => { setPassword(e.target.value); setError(""); }}
                          onKeyDown={e => e.key === "Enter" && handleLogin()}
                          placeholder="A sua palavra-passe"
                          className="w-full px-4 py-3 pr-11 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
                        <button type="button" onClick={() => setShowPass(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          {showPass ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                        </button>
                      </div>
                    </div>
                    {error && (
                      <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-700 mb-3">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"/>
                        {error}
                      </div>
                    )}
                    <button onClick={handleLogin} disabled={submitting}
                      className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-60 text-sm flex items-center justify-center gap-2 transition-colors">
                      {submitting ? <RefreshCw className="w-4 h-4 animate-spin"/> : "Entrar"}
                    </button>
                  </motion.div>
                ) : (
                  <motion.div key="set-password" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                    <button onClick={() => { setStep("contact"); setError(""); setPassword(""); setPasswordConfirm(""); }}
                      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 mb-4 transition-colors">
                      <ArrowLeft className="w-3.5 h-3.5"/> Voltar
                    </button>
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 mb-4">
                      <p className="text-xs font-bold text-indigo-800 mb-0.5">Primeiro acesso, {nome}!</p>
                      <p className="text-xs text-indigo-600">Defina uma palavra-passe para aceder ao portal da {school!.name}.</p>
                    </div>
                    <div className="space-y-3 mb-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nova palavra-passe</label>
                        <div className="relative">
                          <input type={showPass ? "text" : "password"} value={password}
                            onChange={e => { setPassword(e.target.value); setError(""); }}
                            placeholder="Mínimo 6 caracteres"
                            className="w-full px-4 py-3 pr-11 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
                          <button type="button" onClick={() => setShowPass(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            {showPass ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Confirmar palavra-passe</label>
                        <div className="relative">
                          <input type={showPassConfirm ? "text" : "password"} value={passwordConfirm}
                            onChange={e => { setPasswordConfirm(e.target.value); setError(""); }}
                            onKeyDown={e => e.key === "Enter" && handleSetPassword()}
                            placeholder="Repetir palavra-passe"
                            className="w-full px-4 py-3 pr-11 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
                          <button type="button" onClick={() => setShowPassConfirm(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            {showPassConfirm ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                          </button>
                        </div>
                      </div>
                    </div>
                    {error && (
                      <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-700 mb-3">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"/>
                        {error}
                      </div>
                    )}
                    <button onClick={handleSetPassword} disabled={submitting}
                      className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-60 text-sm flex items-center justify-center gap-2 transition-colors">
                      {submitting ? <RefreshCw className="w-4 h-4 animate-spin"/> : "Definir Palavra-passe e Entrar"}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <p className="text-center text-xs text-white/50 mt-5 px-2">
              Acesso restrito. Contacto validado com os dados registados na secretaria da instituição.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
