import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Optional custom fallback UI */
  fallback?: ReactNode;
  /** Section/page name for contextual error messages */
  section?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary — captura erros de renderização React e mostra UI amigável
 * ao invés de uma tela em branco.
 *
 * Uso:
 *   <ErrorBoundary section="Dashboard">
 *     <MinhaSecção />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error(`[ErrorBoundary${this.props.section ? ` — ${this.props.section}` : ""}]`, error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    const section = this.props.section ?? "esta secção";
    const isDev = import.meta.env.DEV;

    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] p-8 text-center">
        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
          <AlertTriangle className="w-7 h-7 text-red-500" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">
          Ocorreu um erro em {section}
        </h3>
        <p className="text-sm text-gray-500 mb-4 max-w-sm">
          Algo correu mal ao apresentar esta página. Por favor tente novamente.
          Se o problema persistir, contacte o suporte.
        </p>
        {isDev && this.state.error && (
          <details className="mb-4 text-left w-full max-w-lg">
            <summary className="text-xs text-red-500 cursor-pointer font-mono mb-1">
              {this.state.error.message}
            </summary>
            <pre className="text-xs bg-gray-50 border border-gray-200 rounded p-3 overflow-auto max-h-40 text-gray-600">
              {this.state.errorInfo?.componentStack}
            </pre>
          </details>
        )}
        <button
          onClick={this.handleReset}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Tentar novamente
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
