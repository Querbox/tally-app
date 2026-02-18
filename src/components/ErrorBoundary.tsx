import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary Komponente
 * Faengt JavaScript-Fehler in Child-Komponenten ab und zeigt eine Fallback-UI
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Logge den Fehler (in Produktion koennte hier ein Error-Service sein)
    console.error('[ErrorBoundary] Fehler gefangen:', error);
    console.error('[ErrorBoundary] Component Stack:', errorInfo.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback wenn vorhanden
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Standard Fallback UI
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
            {/* Icon */}
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>

            {/* Title */}
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              Etwas ist schiefgelaufen
            </h1>

            {/* Description */}
            <p className="text-gray-600 mb-6">
              Ein unerwarteter Fehler ist aufgetreten. Deine Daten sind sicher gespeichert.
            </p>

            {/* Error Details */}
            {this.state.error && (
              <div className="mb-6 p-4 bg-gray-100 rounded-xl text-left">
                <p className="text-xs font-mono text-red-600 break-all">
                  {this.state.error.message}
                </p>
                {this.state.error.stack && (
                  <p className="text-xs font-mono text-gray-500 mt-2 break-all max-h-40 overflow-auto">
                    {this.state.error.stack}
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all text-sm font-medium"
              >
                Erneut versuchen
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all text-sm font-medium flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Neu laden
              </button>
            </div>

            {/* Help text */}
            <p className="mt-6 text-xs text-gray-400">
              Falls das Problem weiterhin besteht, starte die App neu.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
