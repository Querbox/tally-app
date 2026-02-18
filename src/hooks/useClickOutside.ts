import { useEffect, RefObject } from 'react';

/**
 * Hook der eine Callback-Funktion aufruft, wenn außerhalb eines Elements geklickt wird.
 * Nützlich für Dropdowns, Modals, Context-Menüs etc.
 *
 * @param ref - React ref des Elements das überwacht werden soll
 * @param callback - Funktion die aufgerufen wird wenn außerhalb geklickt wird
 * @param enabled - Optional: Hook nur aktiv wenn true (default: true)
 */
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T>,
  callback: () => void,
  enabled: boolean = true
): void {
  useEffect(() => {
    if (!enabled) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        callback();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [ref, callback, enabled]);
}
