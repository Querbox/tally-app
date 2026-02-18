import { Suspense, ComponentType, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface LazyModalProps {
  children: ReactNode;
}

/**
 * Loading fallback for lazy-loaded modals
 */
function ModalSkeleton() {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        <p className="text-sm text-gray-500">Lade...</p>
      </div>
    </div>
  );
}

/**
 * Wrapper for lazy-loaded modal components
 * Provides a loading fallback while the modal chunk is being loaded
 */
export function LazyModal({ children }: LazyModalProps) {
  return (
    <Suspense fallback={<ModalSkeleton />}>
      {children}
    </Suspense>
  );
}

/**
 * HOC to wrap a modal component with Suspense
 */
export function withLazySuspense<P extends object>(
  Component: ComponentType<P>
): ComponentType<P> {
  return function LazyWrapper(props: P) {
    return (
      <Suspense fallback={<ModalSkeleton />}>
        <Component {...props} />
      </Suspense>
    );
  };
}
