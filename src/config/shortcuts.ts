/**
 * TALLY KEYBOARD SHORTCUTS
 * ========================
 *
 * EINZIGE QUELLE DER WAHRHEIT für alle Tastenkürzel.
 *
 * Änderungen hier aktualisieren automatisch:
 * - Event-Handling (useKeyboardShortcuts)
 * - Hilfe-Modal (KeyboardShortcutsModal)
 * - Settings-Anzeige (SettingsView)
 * - Tooltips
 *
 * DESIGN-PRINZIPIEN:
 * - macOS-konform (⌘ für System-Aktionen)
 * - Einfache Buchstaben für häufige Aktionen
 * - Keine Konflikte mit Browser/System
 * - Muskelgedächtnis-freundlich
 */

// === TYPES ===

export type ShortcutContext = 'global' | 'day' | 'focus' | 'modal' | 'calendar';
export type ShortcutCategory = 'navigation' | 'tasks' | 'filter' | 'focus' | 'calendar' | 'general';

export interface ShortcutDefinition {
  id: string;
  key: string; // Lowercase key (z.B. 'e', 'n', ' ' für Space)
  meta?: boolean; // ⌘ (Mac)
  ctrl?: boolean; // Ctrl (für Windows-Fallback)
  alt?: boolean; // ⌥ (Mac) / Alt
  shift?: boolean;

  // Display
  label: string;
  category: ShortcutCategory;

  // Kontext - wo ist der Shortcut aktiv
  context: ShortcutContext[];

  // Für Anzeige
  displayKey: string; // z.B. "⌘E" oder "Space"
}

// === SHORTCUT DEFINITIONS ===

export const SHORTCUTS: ShortcutDefinition[] = [
  // ==================
  // NAVIGATION
  // ==================
  {
    id: 'search',
    key: 'e',
    meta: true,
    label: 'Suche öffnen',
    category: 'navigation',
    context: ['global'],
    displayKey: '⌘E',
  },
  {
    id: 'search-ctrl',
    key: 'e',
    ctrl: true,
    label: 'Suche öffnen',
    category: 'navigation',
    context: ['global'],
    displayKey: 'Ctrl+E',
  },
  {
    id: 'settings',
    key: 'g',
    label: 'Einstellungen',
    category: 'navigation',
    context: ['day'],
    displayKey: 'G',
  },
  {
    id: 'close',
    key: 'Escape',
    label: 'Schließen',
    category: 'navigation',
    context: ['global', 'modal', 'focus'],
    displayKey: 'Esc',
  },
  {
    id: 'dayView',
    key: 'd',
    label: 'Tagesansicht',
    category: 'navigation',
    context: ['day'],
    displayKey: 'D',
  },
  {
    id: 'calendarView',
    key: 'c',
    label: 'Kalenderansicht',
    category: 'navigation',
    context: ['day'],
    displayKey: 'C',
  },

  // ==================
  // AUFGABEN
  // ==================
  {
    id: 'newTask',
    key: 'n',
    label: 'Neue Aufgabe',
    category: 'tasks',
    context: ['day'],
    displayKey: 'N',
  },
  {
    id: 'newMeeting',
    key: 't',
    label: 'Neues Meeting',
    category: 'tasks',
    context: ['day'],
    displayKey: 'T',
  },
  {
    id: 'startFocus',
    key: 'f',
    label: 'Fokus-Modus',
    category: 'tasks',
    context: ['day'],
    displayKey: 'F',
  },
  {
    id: 'stats',
    key: 's',
    label: 'Statistiken',
    category: 'tasks',
    context: ['day'],
    displayKey: 'S',
  },
  {
    id: 'toggleFocus',
    key: ' ', // Space
    label: 'Fokus-Aufgabe wählen',
    category: 'tasks',
    context: ['day'],
    displayKey: 'Space',
  },

  // ==================
  // FILTER
  // ==================
  {
    id: 'filterUrgent',
    key: '1',
    label: 'Filter: Dringend',
    category: 'filter',
    context: ['day'],
    displayKey: '1',
  },
  {
    id: 'filterHigh',
    key: '2',
    label: 'Filter: Hoch',
    category: 'filter',
    context: ['day'],
    displayKey: '2',
  },
  {
    id: 'filterMedium',
    key: '3',
    label: 'Filter: Normal',
    category: 'filter',
    context: ['day'],
    displayKey: '3',
  },
  {
    id: 'filterLow',
    key: '4',
    label: 'Filter: Niedrig',
    category: 'filter',
    context: ['day'],
    displayKey: '4',
  },
  {
    id: 'filterReset',
    key: '0',
    label: 'Filter zurücksetzen',
    category: 'filter',
    context: ['day'],
    displayKey: '0',
  },

  // ==================
  // FOKUS-MODUS
  // ==================
  {
    id: 'focusToggle',
    key: ' ', // Space
    label: 'Timer starten/pausieren',
    category: 'focus',
    context: ['focus'],
    displayKey: 'Space',
  },
  {
    id: 'focusReset',
    key: 'r',
    label: 'Timer zurücksetzen',
    category: 'focus',
    context: ['focus'],
    displayKey: 'R',
  },

  // ==================
  // KALENDER
  // ==================
  {
    id: 'calendarPrevWeek',
    key: 'ArrowLeft',
    alt: true,
    label: 'Vorherige Woche',
    category: 'calendar',
    context: ['calendar'],
    displayKey: '⌥←',
  },
  {
    id: 'calendarNextWeek',
    key: 'ArrowRight',
    alt: true,
    label: 'Nächste Woche',
    category: 'calendar',
    context: ['calendar'],
    displayKey: '⌥→',
  },
  {
    id: 'calendarMoveTask',
    key: 'm',
    label: 'Aufgabe verschieben',
    category: 'calendar',
    context: ['calendar'],
    displayKey: 'M',
  },

  // ==================
  // ALLGEMEIN
  // ==================
  {
    id: 'help',
    key: '?',
    label: 'Tastenkürzel anzeigen',
    category: 'general',
    context: ['day'],
    displayKey: '?',
  },
];

// === HELPER FUNCTIONS ===

/**
 * Hole alle Shortcuts für eine Kategorie
 */
export function getShortcutsByCategory(category: ShortcutCategory): ShortcutDefinition[] {
  return SHORTCUTS.filter((s) => s.category === category);
}

/**
 * Hole alle Shortcuts für einen Kontext
 */
export function getShortcutsByContext(context: ShortcutContext): ShortcutDefinition[] {
  return SHORTCUTS.filter((s) => s.context.includes(context));
}

/**
 * Finde einen Shortcut per ID
 */
export function getShortcutById(id: string): ShortcutDefinition | undefined {
  return SHORTCUTS.find((s) => s.id === id);
}

/**
 * Gruppiere Shortcuts nach Kategorie (für Modal-Anzeige)
 */
export function getShortcutsGrouped(): { category: ShortcutCategory; label: string; shortcuts: ShortcutDefinition[] }[] {
  const categories: ShortcutCategory[] = ['navigation', 'tasks', 'filter', 'focus', 'calendar', 'general'];

  return categories
    .map((category) => ({
      category,
      label: CATEGORY_LABELS[category],
      shortcuts: getShortcutsByCategory(category).filter(
        // Filtere Windows-Fallbacks aus der Anzeige
        (s) => !s.id.endsWith('-ctrl')
      ),
    }))
    .filter((group) => group.shortcuts.length > 0);
}

/**
 * Hole Shortcuts für Settings-Anzeige (nur die wichtigsten)
 */
export function getShortcutsForSettings(): ShortcutDefinition[] {
  const importantIds = ['newTask', 'newMeeting', 'stats', 'search', 'help', 'close'];
  return importantIds
    .map((id) => getShortcutById(id))
    .filter((s): s is ShortcutDefinition => s !== undefined);
}

// === LABELS ===

export const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  navigation: 'Navigation',
  tasks: 'Aufgaben',
  filter: 'Filter',
  focus: 'Fokus-Modus',
  calendar: 'Kalender',
  general: 'Allgemein',
};

// === SHORTCUT MATCHING ===

/**
 * Prüft ob ein KeyboardEvent zu einem Shortcut passt
 */
export function matchesShortcut(event: KeyboardEvent, shortcut: ShortcutDefinition): boolean {
  const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
  const metaMatch = shortcut.meta ? event.metaKey : !event.metaKey;
  const ctrlMatch = shortcut.ctrl ? event.ctrlKey : !event.ctrlKey;
  const altMatch = shortcut.alt ? event.altKey : !event.altKey;
  const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;

  return keyMatch && metaMatch && ctrlMatch && altMatch && shiftMatch;
}

/**
 * Finde den passenden Shortcut für ein Event
 */
export function findMatchingShortcut(
  event: KeyboardEvent,
  context: ShortcutContext
): ShortcutDefinition | undefined {
  const contextShortcuts = getShortcutsByContext(context);
  return contextShortcuts.find((s) => matchesShortcut(event, s));
}
