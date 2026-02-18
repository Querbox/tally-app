import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { createFileStorage, STORAGE_FILES, isTauri } from '../lib/fileStorage';
import type {
  PatternType,
  PatternAutonomy,
  PatternPreference,
  DetectedPattern,
  DismissedPattern,
} from '../types';

/**
 * Pattern Intelligence Store
 *
 * Verwaltet erkannte Muster, Nutzerpräferenzen und Rate-Limiting.
 *
 * Rate-Limits:
 * - Max 3 Vorschläge pro Tag
 * - Max 10 Vorschläge pro Woche
 * - Abgelehnte Muster werden nicht erneut angezeigt
 */

// postpone + deadlineWarning starten mit 'ask', autoClient ist Expert-Feature (default off)
const DEFAULT_PREFERENCES: PatternPreference[] = [
  { patternType: 'postpone', autonomy: 'ask', threshold: 3 },
  { patternType: 'deadlineWarning', autonomy: 'ask', threshold: 2 },
  { patternType: 'autoClient', autonomy: 'off' },
];

const MAX_SUGGESTIONS_PER_DAY = 3;
const MAX_SUGGESTIONS_PER_WEEK = 10;

// --- Persistierter State (ohne Actions) ---
interface PatternStoreState {
  preferences: PatternPreference[];
  activePatterns: DetectedPattern[];
  dismissedPatterns: DismissedPattern[];
  suggestionsShownToday: number;
  lastSuggestionDate: string | null;
  suggestionsShownThisWeek: number;
  weekStartDate: string | null;
}

// --- Actions ---
interface PatternStoreActions {
  getPreference: (type: PatternType) => PatternPreference;
  updatePreference: (type: PatternType, updates: Partial<PatternPreference>) => void;

  addDetectedPattern: (pattern: DetectedPattern) => void;
  removePattern: (patternId: string) => void;
  clearPatternsForTask: (taskId: string) => void;
  replaceActivePatterns: (patterns: DetectedPattern[]) => void;

  acceptPattern: (patternId: string) => void;
  dismissPattern: (patternId: string, permanent?: boolean) => void;

  canShowPattern: (type: PatternType, taskId?: string) => boolean;
  recordPatternShown: () => void;

  /** Alle Muster global an/aus (setzt autonomy auf 'ask' bzw. 'off') */
  setAllPatternsEnabled: (enabled: boolean) => void;
  /** Prüft ob mindestens ein Muster aktiv ist */
  isAnyPatternEnabled: () => boolean;
}

type PatternStore = PatternStoreState & PatternStoreActions;

// --- Hilfsfunktionen ---
function getWeekStart(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

// --- Storage ---
const fileStorage = createFileStorage<PatternStoreState>(STORAGE_FILES.patterns);

const storage: StateStorage = isTauri()
  ? fileStorage
  : {
      getItem: (name) => {
        const value = localStorage.getItem(name);
        return value ? Promise.resolve(value) : Promise.resolve(null);
      },
      setItem: (name, value) => {
        localStorage.setItem(name, value);
        return Promise.resolve();
      },
      removeItem: (name) => {
        localStorage.removeItem(name);
        return Promise.resolve();
      },
    };

export const usePatternStore = create<PatternStore>()(
  persist(
    (set, get) => ({
      // --- Initial State ---
      preferences: DEFAULT_PREFERENCES,
      activePatterns: [],
      dismissedPatterns: [],
      suggestionsShownToday: 0,
      lastSuggestionDate: null,
      suggestionsShownThisWeek: 0,
      weekStartDate: null,

      // --- Preference Management ---
      getPreference: (type: PatternType): PatternPreference => {
        const pref = get().preferences.find((p) => p.patternType === type);
        return pref || { patternType: type, autonomy: 'ask' as PatternAutonomy };
      },

      updatePreference: (type: PatternType, updates: Partial<PatternPreference>) => {
        set((state) => ({
          preferences: state.preferences.map((p) =>
            p.patternType === type ? { ...p, ...updates } : p
          ),
        }));
      },

      // --- Pattern Lifecycle ---
      addDetectedPattern: (pattern: DetectedPattern) => {
        set((state) => {
          const exists = state.activePatterns.some(
            (p) =>
              p.patternType === pattern.patternType &&
              p.taskIds[0] === pattern.taskIds[0]
          );
          if (exists) return state;
          return { activePatterns: [...state.activePatterns, pattern] };
        });
      },

      removePattern: (patternId: string) => {
        set((state) => ({
          activePatterns: state.activePatterns.filter((p) => p.id !== patternId),
        }));
      },

      clearPatternsForTask: (taskId: string) => {
        set((state) => ({
          activePatterns: state.activePatterns.filter(
            (p) => !p.taskIds.includes(taskId)
          ),
        }));
      },

      replaceActivePatterns: (patterns: DetectedPattern[]) => {
        set({ activePatterns: patterns });
      },

      // --- Nutzer-Aktionen ---
      acceptPattern: (patternId: string) => {
        set((state) => ({
          activePatterns: state.activePatterns.filter((p) => p.id !== patternId),
        }));
      },

      dismissPattern: (patternId: string, permanent = false) => {
        const pattern = get().activePatterns.find((p) => p.id === patternId);
        if (!pattern) return;

        set((state) => ({
          activePatterns: state.activePatterns.filter((p) => p.id !== patternId),
          dismissedPatterns: [
            ...state.dismissedPatterns,
            {
              patternType: pattern.patternType,
              taskId: permanent ? undefined : pattern.taskIds[0],
              dismissedAt: new Date().toISOString(),
              permanent,
            },
          ],
        }));
      },

      // --- Rate Limiting ---
      canShowPattern: (type: PatternType, taskId?: string): boolean => {
        const state = get();
        const today = getTodayString();
        const currentWeekStart = getWeekStart();

        // Muster ausgeschaltet?
        const pref = state.preferences.find((p) => p.patternType === type);
        if (pref?.autonomy === 'off') return false;

        // Counter-Resets
        const effectiveToday =
          state.lastSuggestionDate === today ? state.suggestionsShownToday : 0;
        const effectiveWeek =
          state.weekStartDate === currentWeekStart
            ? state.suggestionsShownThisWeek
            : 0;

        if (effectiveToday >= MAX_SUGGESTIONS_PER_DAY) return false;
        if (effectiveWeek >= MAX_SUGGESTIONS_PER_WEEK) return false;

        // Abgelehnt?
        const isDismissed = state.dismissedPatterns.some((d) => {
          if (d.permanent && d.patternType === type && !d.taskId) return true;
          if (d.patternType === type && d.taskId && d.taskId === taskId)
            return true;
          return false;
        });
        if (isDismissed) return false;

        return true;
      },

      recordPatternShown: () => {
        const today = getTodayString();
        const currentWeekStart = getWeekStart();

        set((state) => ({
          lastSuggestionDate: today,
          suggestionsShownToday:
            state.lastSuggestionDate === today
              ? state.suggestionsShownToday + 1
              : 1,
          suggestionsShownThisWeek:
            state.weekStartDate === currentWeekStart
              ? state.suggestionsShownThisWeek + 1
              : 1,
          weekStartDate: currentWeekStart,
        }));
      },

      // --- Globaler Toggle ---
      setAllPatternsEnabled: (enabled: boolean) => {
        set((state) => ({
          preferences: state.preferences.map((p) => ({
            ...p,
            autonomy: enabled
              ? (DEFAULT_PREFERENCES.find((d) => d.patternType === p.patternType)?.autonomy ?? 'ask')
              : ('off' as PatternAutonomy),
          })),
          // Bei Deaktivierung aktive Patterns sofort entfernen
          activePatterns: enabled ? state.activePatterns : [],
        }));
      },

      isAnyPatternEnabled: () => {
        return get().preferences.some((p) => p.autonomy !== 'off');
      },
    }),
    {
      name: 'tally-patterns',
      version: 2,
      storage: createJSONStorage(() => storage),
      migrate: (persisted, version) => {
        if (!persisted || typeof persisted !== 'object') return persisted as PatternStoreState;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const state = persisted as any;
        if (version < 2) {
          // V1→V2: acceptanceLog, autoActionLog entfernt, whiteboards-Kontamination bereinigen
          delete state.acceptanceLog;
          delete state.autoActionLog;
          delete state.whiteboards;
        }
        return state as PatternStoreState;
      },
    }
  )
);
