import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, AlertCircle, Info, Undo2 } from 'lucide-react';

// Toast Types
export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  undoAction?: () => void;
  undoLabel?: string;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  // Convenience methods
  success: (message: string, options?: ToastOptions) => string;
  error: (message: string, options?: ToastOptions) => string;
  info: (message: string, options?: ToastOptions) => string;
  withUndo: (message: string, undoAction: () => void, undoLabel?: string) => string;
}

interface ToastOptions {
  duration?: number;
  undoAction?: () => void;
  undoLabel?: string;
}

const ToastContext = createContext<ToastContextType | null>(null);

// Generate unique ID
let toastIdCounter = 0;
const generateToastId = () => `toast-${++toastIdCounter}-${Date.now()}`;

// Toast Provider
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<Toast, 'id'>): string => {
    const id = generateToastId();
    const newToast: Toast = { ...toast, id };
    setToasts(prev => [...prev, newToast]);
    return id;
  }, []);

  const success = useCallback((message: string, options?: ToastOptions): string => {
    return addToast({
      message,
      type: 'success',
      duration: options?.duration ?? 3000,
      undoAction: options?.undoAction,
      undoLabel: options?.undoLabel,
    });
  }, [addToast]);

  const error = useCallback((message: string, options?: ToastOptions): string => {
    return addToast({
      message,
      type: 'error',
      duration: options?.duration ?? 5000,
      undoAction: options?.undoAction,
      undoLabel: options?.undoLabel,
    });
  }, [addToast]);

  const info = useCallback((message: string, options?: ToastOptions): string => {
    return addToast({
      message,
      type: 'info',
      duration: options?.duration ?? 3000,
      undoAction: options?.undoAction,
      undoLabel: options?.undoLabel,
    });
  }, [addToast]);

  const withUndo = useCallback((
    message: string,
    undoAction: () => void,
    undoLabel = 'Rückgängig'
  ): string => {
    return addToast({
      message,
      type: 'success',
      duration: 5000, // Longer duration for undo toasts
      undoAction,
      undoLabel,
    });
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, info, withUndo }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

// Hook to use toasts
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  // Add simple toast function that defaults to success
  const toast = (message: string, options?: ToastOptions) => context.success(message, options);
  return { ...context, toast };
}

// Toast Container (renders via portal)
function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return createPortal(
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>,
    document.body
  );
}

// Individual Toast Item
function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const [isExiting, setIsExiting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;

    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onRemove(toast.id), 200); // Wait for exit animation
    }, toast.duration);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove, isPaused]);

  const handleUndo = () => {
    if (toast.undoAction) {
      toast.undoAction();
      onRemove(toast.id);
    }
  };

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 200);
  };

  const icons = {
    success: <CheckCircle className="w-6 h-6 text-green-500" />,
    error: <AlertCircle className="w-6 h-6 text-red-500" />,
    info: <Info className="w-6 h-6 text-blue-500" />,
  };

  const bgColors = {
    success: 'bg-green-50 border-green-300',
    error: 'bg-red-50 border-red-300',
    info: 'bg-blue-50 border-blue-300',
  };

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={`
        pointer-events-auto flex items-center gap-4 px-5 py-4
        bg-white border-2 rounded-2xl shadow-2xl min-w-[320px] max-w-md
        transition-all duration-200
        ${bgColors[toast.type]}
        ${isExiting ? 'opacity-0 translate-x-4 scale-95' : 'opacity-100 translate-x-0 scale-100 animate-slide-in-right'}
      `}
    >
      {icons[toast.type]}

      <span className="flex-1 text-base font-medium text-gray-800">{toast.message}</span>

      {toast.undoAction && (
        <button
          onClick={handleUndo}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-blue-600 hover:bg-blue-100 rounded-xl transition-colors"
        >
          <Undo2 className="w-4 h-4" />
          {toast.undoLabel || 'Rückgängig'}
        </button>
      )}

      <button
        onClick={handleDismiss}
        className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}
