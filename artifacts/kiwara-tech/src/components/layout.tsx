import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const NAV_LINKS = [
  { href: "/", label: "Início" },
  { href: "/servicos", label: "Serviços" },
  { href: "/solucoes/escolar", label: "Solução Escolar" },
];

export function Navbar() {
  const [location] = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Don't show public navbar on dashboard
  if (location.startsWith("/dashboard")) return null;

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        isScrolled ? "bg-white/80 backdrop-blur-md shadow-sm py-3" : "bg-transparent py-5"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent p-0.5 shadow-lg group-hover:shadow-primary/25 transition-all">
              <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
                 <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="Kiwara Tech" className="w-6 h-6 object-contain" />
              </div>
            </div>
            <span className="font-display font-bold text-xl tracking-tight">Kiwara <span className="text-primary">Tech</span></span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-primary",
                  location === link.href ? "text-primary" : "text-slate-600"
                )}
              >
                {link.label}
              </Link>
            ))}
            <div className="w-px h-6 bg-slate-200 mx-2" />
            <Link
              href="/escolar"
              className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium rounded-full bg-primary text-white shadow-md shadow-primary/20 hover:shadow-lg hover:-translate-y-0.5 hover:bg-primary/90 transition-all duration-200"
            >
              Aderir ao Kiwara Escolar
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
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "p-4 text-base font-medium rounded-xl transition-colors",
                  location === link.href ? "bg-primary/5 text-primary" : "text-slate-600 hover:bg-slate-50"
                )}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/escolar"
              onClick={() => setMobileMenuOpen(false)}
              className="mt-4 flex items-center justify-center p-4 rounded-xl bg-primary text-white font-medium shadow-md"
            >
              Aderir ao Kiwara Escolar
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
    <footer className="bg-slate-900 pt-16 pb-8 text-slate-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-lg">
                K
              </div>
              <span className="font-display font-bold text-xl text-white">Kiwara Tech</span>
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
              <li><Link href="/servicos" className="hover:text-primary transition-colors">Integração de Sistemas</Link></li>
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
          <p>© {new Date().getFullYear()} Kiwara Tech. Todos os direitos reservados.</p>
          <div className="flex items-center gap-6">
            <Link href="#" className="hover:text-white transition-colors">Política de Privacidade</Link>
            <Link href="#" className="hover:text-white transition-colors">Termos de Serviço</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow pt-20">
        {children}
      </main>
      <Footer />
    </div>
  );
}
