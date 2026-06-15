import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ChevronDown, Bot, BarChart2, GraduationCap, Users } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SERVICES_DROPDOWN = [
  {
    href: "/servicos#ia",
    label: "Agência de IA",
    sublabel: "Automação de processos",
    icon: <Bot className="w-5 h-5 text-primary" />,
  },
  {
    href: "/servicos#dados",
    label: "Análise de Dados",
    sublabel: "Insights e visualização",
    icon: <BarChart2 className="w-5 h-5 text-primary" />,
  },
  {
    href: "/solucoes/escolar",
    label: "Sistema de Gestão Escolar",
    sublabel: "Plataforma SaaS para colégios",
    icon: <GraduationCap className="w-5 h-5 text-primary" />,
  },
];

const NAV_LINKS = [
  { href: "/", label: "Início" },
  { href: "/solucoes/escolar", label: "Solução Escolar" },
];

export function Navbar() {
  const [location] = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setServicesOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (location.startsWith("/dashboard") || location.startsWith("/encarregado")) return null;

  return (
    <header
      translate="no"
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        isScrolled ? "bg-white/80 backdrop-blur-md shadow-sm py-3" : "bg-transparent py-5"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo + Company name */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg group-hover:shadow-primary/30 transition-all">
              <span className="text-white font-extrabold text-lg leading-none">P</span>
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-slate-900">
              Propina<span className="text-primary">Plus</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="/"
              className={cn(
                "text-sm font-medium transition-colors hover:text-primary",
                location === "/" ? "text-primary" : "text-slate-600"
              )}
            >
              Início
            </Link>

            {/* Serviços dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setServicesOpen(!servicesOpen)}
                className={cn(
                  "flex items-center gap-1 text-sm font-medium transition-colors hover:text-primary",
                  location.startsWith("/servicos") ? "text-primary" : "text-slate-600"
                )}
              >
                O que fazemos
                <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", servicesOpen && "rotate-180")} />
              </button>

              <AnimatePresence>
                {servicesOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden"
                  >
                    <div className="p-2">
                      {SERVICES_DROPDOWN.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setServicesOpen(false)}
                          className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group/item"
                        >
                          <div className="w-10 h-10 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                            {item.icon}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900 group-hover/item:text-primary transition-colors">{item.label}</p>
                            <p className="text-xs text-slate-500">{item.sublabel}</p>
                          </div>
                        </Link>
                      ))}
                      <div className="border-t border-slate-100 mt-2 pt-2">
                        <Link
                          href="/servicos"
                          onClick={() => setServicesOpen(false)}
                          className="flex items-center justify-center p-2 text-sm font-medium text-primary hover:bg-primary/5 rounded-xl transition-colors"
                        >
                          Ver todos os serviços →
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Link
              href="/solucoes/escolar"
              className={cn(
                "text-sm font-medium transition-colors hover:text-primary",
                location === "/solucoes/escolar" ? "text-primary" : "text-slate-600"
              )}
            >
              Solução Escolar
            </Link>

            <div className="w-px h-6 bg-slate-200 mx-2" />
            <Link
              href="/encarregado"
              className={cn(
                "inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full border transition-all duration-200",
                location.startsWith("/encarregado")
                  ? "border-primary text-primary bg-primary/5"
                  : "border-slate-200 text-slate-600 hover:border-primary hover:text-primary hover:bg-primary/5"
              )}
            >
              <Users size={14} />
              Portal Encarregado
            </Link>
            <Link
              href="/escolar"
              className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium rounded-full bg-primary text-white shadow-md shadow-primary/20 hover:shadow-lg hover:-translate-y-0.5 hover:bg-primary/90 transition-all duration-200"
            >
              Aderir ao PropinaPlus
            </Link>
          </nav>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden p-2 text-slate-600 hover:text-primary transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-full left-0 right-0 bg-white border-b border-slate-100 shadow-xl md:hidden flex flex-col p-4"
          >
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "p-4 text-base font-medium rounded-xl transition-colors",
                location === "/" ? "bg-primary/5 text-primary" : "text-slate-600 hover:bg-slate-50"
              )}
            >
              Início
            </Link>

            <p className="px-4 pt-4 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">O que fazemos</p>
            {SERVICES_DROPDOWN.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 p-4 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors"
              >
                {item.icon}
                <div>
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="text-xs text-slate-400">{item.sublabel}</p>
                </div>
              </Link>
            ))}

            <Link
              href="/encarregado"
              onClick={() => setMobileMenuOpen(false)}
              className="mt-4 flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-primary text-primary font-medium"
            >
              <Users size={16} />
              Portal do Encarregado
            </Link>
            <Link
              href="/escolar"
              onClick={() => setMobileMenuOpen(false)}
              className="mt-2 flex items-center justify-center p-4 rounded-xl bg-primary text-white font-medium shadow-md"
            >
              Aderir ao PropinaPlus
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

export function Footer() {
  const [location] = useLocation();
  if (location.startsWith("/dashboard")) return null;

  return (
    <footer translate="no" className="bg-slate-900 pt-16 pb-8 text-slate-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-lg">
                P
              </div>
              <span className="font-display font-bold text-xl text-white">PropinaPlus</span>
            </Link>
            <p className="text-slate-400 max-w-md leading-relaxed">
              Impulsionamos o sucesso de empresas e instituições em Angola através de soluções tecnológicas inovadoras, fiáveis e focadas em resultados reais.
            </p>
          </div>
          <div>
            <h4 className="font-display font-semibold text-white mb-4">Soluções</h4>
            <ul className="space-y-3">
              <li><Link href="/servicos" className="hover:text-primary transition-colors">Desenvolvimento Web</Link></li>
              <li><Link href="/servicos" className="hover:text-primary transition-colors">Consultoria IT</Link></li>
              <li><Link href="/solucoes/escolar" className="hover:text-primary transition-colors">Sistema de Gestão Escolar</Link></li>
              <li><Link href="/encarregado" className="hover:text-primary transition-colors">Portal do Encarregado</Link></li>
              <li><Link href="/admin" className="hover:text-primary transition-colors">Administração Sistema Escolar</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-display font-semibold text-white mb-4">Empresa</h4>
            <ul className="space-y-3">
              <li><Link href="/" className="hover:text-primary transition-colors">Sobre Nós</Link></li>
              <li><Link href="/servicos" className="hover:text-primary transition-colors">Serviços</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">Contactos</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
          <p>© {new Date().getFullYear()} PropinaPlus. Todos os direitos reservados.</p>
          <div className="flex items-center gap-6">
            <Link href="#" className="hover:text-white transition-colors">Política de Privacidade</Link>
            <Link href="#" className="hover:text-white transition-colors">Termos de Serviço</Link>
            <Link href="/admin" className="text-slate-700 hover:text-slate-500 transition-colors text-xs">Administração</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div translate="no" className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow pt-20">
        {children}
      </main>
      <Footer />
    </div>
  );
}
