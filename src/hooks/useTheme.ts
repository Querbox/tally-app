import { useEffect } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

export function useTheme() {
  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);

  useEffect(() => {
    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    if (themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mediaQuery.matches);

      const handler = (e: MediaQueryListEvent) => applyTheme(e.matches);
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else {
      applyTheme(themeMode === 'dark');
    }
  }, [themeMode]);

  const isDark =
    themeMode === 'dark' ||
    (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return { themeMode, setThemeMode, isDark };
}
