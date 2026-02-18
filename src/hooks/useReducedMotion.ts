import { useEffect } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

/**
 * Hook für reduzierte Animationen (ADHS-freundlich)
 *
 * Setzt CSS-Klasse 'reduce-motion' auf document.body wenn:
 * 1. User hat in Settings "Weniger Bewegung" aktiviert
 * 2. ODER System hat prefers-reduced-motion aktiv
 *
 * CSS in index.css respektiert diese Klasse.
 */
export function useReducedMotion() {
  const reduceMotion = useSettingsStore((s) => s.accessibilitySettings.reduceMotion);

  useEffect(() => {
    // Prüfe System-Einstellung
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Wende an wenn User ODER System es will
    if (reduceMotion || prefersReducedMotion) {
      document.body.classList.add('reduce-motion');
    } else {
      document.body.classList.remove('reduce-motion');
    }

    // Listener für System-Änderungen
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches || reduceMotion) {
        document.body.classList.add('reduce-motion');
      } else {
        document.body.classList.remove('reduce-motion');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [reduceMotion]);
}
