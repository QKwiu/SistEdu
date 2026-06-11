import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "@/lib/auth";
import ErrorBoundary from "@/components/ui/ErrorBoundary";

import Home from "./pages/home";
import Servicos from "./pages/servicos";
import SolucaoEscolar from "./pages/solucao-escolar";
import EscolarLanding from "./pages/escolar-landing";
import Signup from "./pages/signup";
import Dashboard from "./pages/dashboard";
import Encarregado from "./pages/encarregado";
import AdminLogin from "./pages/admin-login";
import AdminDashboard from "./pages/admin-dashboard";
import StaffPortal from "./pages/StaffPortal";
import PortalPublico from "./pages/PortalPublico";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 },
  },
});

function ProtectedDashboard() {
  const { session } = useAuth();
  if (!session) return <Redirect to="/escolar" />;
  return <Dashboard />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/servicos" component={Servicos} />
      <Route path="/solucoes/escolar" component={SolucaoEscolar} />
      <Route path="/escolar" component={EscolarLanding} />
      <Route path="/signup" component={Signup} />
      <Route path="/dashboard" component={ProtectedDashboard} />
      <Route path="/encarregado" component={Encarregado} />
      <Route path="/staff" component={StaffPortal} />
      <Route path="/admin" component={AdminLogin} />
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route path="/portal/:slug" component={PortalPublico} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary section="aplicação">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <ErrorBoundary section="página">
                <Router />
              </ErrorBoundary>
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
