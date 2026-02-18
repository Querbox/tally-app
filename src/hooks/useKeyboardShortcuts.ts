import { useEffect, useCallback } from 'react';
import {
  type ShortcutDefinition,
  type ShortcutContext,
  matchesShortcut,
  getShortcutsByContext,
  SHORTCUTS,
} from '../config/shortcuts';

/**
 * KEYBOARD SHORTCUTS HOOK
 * =======================
 *
 * Zentraler Hook für Keyboard-Handling.
 * Nutzt die Shortcut-Definitionen aus config/shortcuts.ts
 *
 * FEATURES:
 * - Ignoriert Eingaben in Input/Textarea
 * - Escape blurred immer das aktive Element
 * - Kontext-basiertes Aktivieren/Deaktivieren
 */

export interface ShortcutAction {
  id: string;
  action: () => void;
}

interface UseKeyboardShortcutsOptions {
  actions: ShortcutAction[];
  context: ShortcutContext;
  enabled?: boolean;
}

export function useKeyboardShortcuts({
  actions,
  context,
  enabled = true,
}: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Allow Escape to blur inputs
        if (event.key === 'Escape') {
          target.blur();
        }
        return;
      }

      // Find matching shortcut from central config
      const contextShortcuts = getShortcutsByContext(context);

      for (const shortcut of contextShortcuts) {
        if (matchesShortcut(event, shortcut)) {
          // Find the action for this shortcut
          const actionConfig = actions.find((a) => a.id === shortcut.id);

          if (actionConfig) {
            event.preventDefault();
            actionConfig.action();
            return;
          }
        }
      }

      // Also check global shortcuts if we're not already in global context
      if (context !== 'global') {
        const globalShortcuts = getShortcutsByContext('global');

        for (const shortcut of globalShortcuts) {
          if (matchesShortcut(event, shortcut)) {
            const actionConfig = actions.find((a) => a.id === shortcut.id);

            if (actionConfig) {
              event.preventDefault();
              actionConfig.action();
              return;
            }
          }
        }
      }
    },
    [actions, context, enabled]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

// Re-export für Abwärtskompatibilität
export { SHORTCUTS, type ShortcutDefinition };

// Legacy-Interface für schrittweise Migration
export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
}

/**
 * Legacy-Hook für Abwärtskompatibilität
 * @deprecated Nutze useKeyboardShortcuts mit actions[] stattdessen
 */
export function useLegacyKeyboardShortcuts({
  shortcuts,
  enabled = true,
}: {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
}) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        if (event.key === 'Escape') {
          target.blur();
        }
        return;
      }

      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl ? event.ctrlKey : !event.ctrlKey;
        const metaMatch = shortcut.meta ? event.metaKey : !event.metaKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

        if (keyMatch && ctrlMatch && metaMatch && shiftMatch && altMatch) {
          event.preventDefault();
          shortcut.action();
          return;
        }
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
