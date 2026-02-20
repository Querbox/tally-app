import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { createFileStorage, STORAGE_FILES, isTauri } from '../lib/fileStorage';
import { CURRENT_VERSION } from '../data/releases';

export interface DayRecord {
  date: string;
  startedAt: string;
  endedAt?: string;
  isActive: boolean;
}

// Sound settings
export interface SoundSettings {
  enabled: boolean;
  taskComplete: boolean;
  taskDelete: boolean;
  timerStart: boolean;
  timerStop: boolean;
  meetingReminder: boolean;
  notification: boolean;
  volume: number; // 0-1
}

// Notification settings
export interface NotificationSettings {
  enabled: boolean;
  meetingReminders: boolean;
  reminderIntervals: number[]; // Minutes before meeting (e.g., [15, 5, 1])
}

// Focus Timer settings
export interface FocusTimerSettings {
  focusDuration: number; // minutes
  shortBreakDuration: number;
  longBreakDuration: number;
  sessionsUntilLongBreak: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
}

// Theme settings
export type ThemeMode = 'light' | 'dark' | 'system';

// Privacy settings
export interface PrivacySettings {
  allowExternalLogos: boolean; // DSGVO: Erlaubt das Laden von externen Firmenlogos
  externalLogosConsentDate: string | null; // Datum der Zustimmung
}

// Accessibility settings (ADHS-freundlich)
export interface AccessibilitySettings {
  reduceMotion: boolean; // Reduziert Animationen für weniger Ablenkung
}

// Task sort options
export type TaskSortOption = 'priority' | 'newest' | 'oldest' | 'alphabetical';

// Expert Mode - schaltet erweiterte Features frei
export interface ExpertModeSettings {
  enabled: boolean; // Master-Toggle für alle erweiterten Features
  // Granulare Feature-Toggles
  customShortcuts: boolean; // Eigene Tastenkürzel definieren
  advancedFilters: boolean; // Erweiterte Filter (AND/OR, gespeicherte Filter)
  automations: boolean; // Automatisierungsregeln
  bulkOperations: boolean; // Mehrere Aufgaben gleichzeitig bearbeiten
  detailedAnalytics: boolean; // Detaillierte Produktivitäts-Analysen
  taskTemplates: boolean; // Erweiterte Aufgaben-Templates
}

// Custom Keyboard Shortcuts
export interface CustomShortcut {
  id: string;
  action: string; // z.B. 'newTask', 'focusMode', 'search'
  key: string; // z.B. 'n', 'f', 'e'
  modifiers: ('ctrl' | 'alt' | 'shift' | 'meta')[]; // Modifier-Tasten
  enabled: boolean;
}

// Saved Filter
export interface SavedFilter {
  id: string;
  name: string;
  conditions: FilterCondition[];
  logic: 'and' | 'or';
  createdAt: string;
}

export interface FilterCondition {
  field: 'priority' | 'status' | 'client' | 'tag' | 'date' | 'hasDeadline';
  operator: 'equals' | 'notEquals' | 'contains' | 'before' | 'after' | 'isEmpty' | 'isNotEmpty';
  value: string;
}

// Automation Rule
export interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  conditions: FilterCondition[];
  actions: AutomationAction[];
  createdAt: string;
  lastTriggered?: string;
  triggerCount: number;
}

export interface AutomationTrigger {
  type: 'taskCreated' | 'taskCompleted' | 'taskMoved' | 'timeReached' | 'dayStart' | 'dayEnd';
  config?: Record<string, unknown>;
}

export interface AutomationAction {
  type: 'setPriority' | 'setClient' | 'addTag' | 'moveToDate' | 'markOptional' | 'duplicate' | 'notify';
  config: Record<string, unknown>;
}

interface SettingsStore {
  // App Settings
  workStartTime: string;
  workEndTime: string;
  autoCarryOverTasks: boolean;
  showCompletedTasks: boolean;
  defaultTaskDuration: number; // in minutes
  taskSortOption: TaskSortOption; // Sortierung fuer Aufgaben

  // Work Time Settings
  weeklyWorkHours: number; // Soll-Stunden pro Woche (z.B. 40)
  workDaysPerWeek: number; // Arbeitstage pro Woche (z.B. 5)
  showWeekends: boolean; // Wochenende in Kalenderansicht anzeigen

  // Sound & Notification Settings
  soundSettings: SoundSettings;
  notificationSettings: NotificationSettings;
  focusTimerSettings: FocusTimerSettings;

  // Privacy Settings
  privacySettings: PrivacySettings;

  // Accessibility Settings
  accessibilitySettings: AccessibilitySettings;

  // Expert Mode Settings
  expertModeSettings: ExpertModeSettings;

  // Expert Mode Data
  customShortcuts: CustomShortcut[];
  savedFilters: SavedFilter[];
  automationRules: AutomationRule[];

  // UI State
  sidebarCollapsed: boolean;
  workTimeWidgetCollapsed: boolean;
  themeMode: ThemeMode;
  appVersion: string;
  lastUpdateCheck: string | null;
  dismissedVersion: string | null;
  lastSeenVersion: string | null; // Letzte gesehene Version fuer What's New

  // Onboarding
  hasCompletedOnboarding: boolean;
  onboardingCompletedAt: string | null;

  // Day State
  currentDay: DayRecord | null;
  dayHistory: DayRecord[];

  // Actions
  updateSettings: (settings: Partial<SettingsStore>) => void;
  updateSoundSettings: (settings: Partial<SoundSettings>) => void;
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => void;
  updateFocusTimerSettings: (settings: Partial<FocusTimerSettings>) => void;
  updatePrivacySettings: (settings: Partial<PrivacySettings>) => void;
  updateAccessibilitySettings: (settings: Partial<AccessibilitySettings>) => void;
  updateExpertModeSettings: (settings: Partial<ExpertModeSettings>) => void;
  // Custom Shortcuts Actions
  addCustomShortcut: (shortcut: Omit<CustomShortcut, 'id'>) => void;
  updateCustomShortcut: (id: string, updates: Partial<CustomShortcut>) => void;
  deleteCustomShortcut: (id: string) => void;
  // Saved Filters Actions
  addSavedFilter: (filter: Omit<SavedFilter, 'id' | 'createdAt'>) => void;
  updateSavedFilter: (id: string, updates: Partial<SavedFilter>) => void;
  deleteSavedFilter: (id: string) => void;
  // Automation Rules Actions
  addAutomationRule: (rule: Omit<AutomationRule, 'id' | 'createdAt' | 'triggerCount'>) => void;
  updateAutomationRule: (id: string, updates: Partial<AutomationRule>) => void;
  deleteAutomationRule: (id: string) => void;
  toggleSidebar: () => void;
  toggleWorkTimeWidget: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  completeOnboarding: () => void;
  startDay: (date: string) => void;
  endDay: (date: string) => void;
  isDayStarted: (date: string) => boolean;
  isDayEnded: (date: string) => boolean;
  getDayRecord: (date: string) => DayRecord | undefined;
}

// Migrate data from old FlowsApp storage to new Tally storage
function migrateFromFlowsApp() {
  const oldStorage = localStorage.getItem('flows-app-settings');
  const newStorage = localStorage.getItem('tally-settings');

  if (oldStorage && !newStorage) {
    localStorage.setItem('tally-settings', oldStorage);
    localStorage.removeItem('flows-app-settings');
  }
}

// Run migration on module load
migrateFromFlowsApp();

// Definiere den State-Typ separat fuer den Storage-Adapter
interface SettingsStoreState {
  workStartTime: string;
  workEndTime: string;
  autoCarryOverTasks: boolean;
  showCompletedTasks: boolean;
  defaultTaskDuration: number;
  taskSortOption: TaskSortOption;
  weeklyWorkHours: number;
  workDaysPerWeek: number;
  showWeekends: boolean;
  soundSettings: SoundSettings;
  notificationSettings: NotificationSettings;
  focusTimerSettings: FocusTimerSettings;
  privacySettings: PrivacySettings;
  accessibilitySettings: AccessibilitySettings;
  expertModeSettings: ExpertModeSettings;
  customShortcuts: CustomShortcut[];
  savedFilters: SavedFilter[];
  automationRules: AutomationRule[];
  sidebarCollapsed: boolean;
  workTimeWidgetCollapsed: boolean;
  themeMode: ThemeMode;
  appVersion: string;
  lastUpdateCheck: string | null;
  dismissedVersion: string | null;
  lastSeenVersion: string | null;
  hasCompletedOnboarding: boolean;
  onboardingCompletedAt: string | null;
  currentDay: DayRecord | null;
  dayHistory: DayRecord[];
}

// Erstelle den File-Storage-Adapter fuer Tauri
const fileStorage = createFileStorage<SettingsStoreState>(STORAGE_FILES.settings);

// Verwende File-Storage in Tauri, ansonsten localStorage als Fallback
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

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      // Default Settings
      workStartTime: '09:00',
      workEndTime: '18:00',
      autoCarryOverTasks: true,
      showCompletedTasks: true,
      defaultTaskDuration: 30,
      taskSortOption: 'newest' as TaskSortOption, // Neueste zuerst als Standard

      // Work Time Settings
      weeklyWorkHours: 40,
      workDaysPerWeek: 5,
      showWeekends: false,

      // Sound Settings
      soundSettings: {
        enabled: true,
        taskComplete: true,
        taskDelete: true,
        timerStart: true,
        timerStop: true,
        meetingReminder: true,
        notification: true,
        volume: 0.5,
      },

      // Notification Settings
      notificationSettings: {
        enabled: true,
        meetingReminders: true,
        reminderIntervals: [15, 5, 1],
      },

      // Focus Timer Settings
      focusTimerSettings: {
        focusDuration: 25,
        shortBreakDuration: 5,
        longBreakDuration: 15,
        sessionsUntilLongBreak: 4,
        autoStartBreaks: false,
        autoStartFocus: false,
      },

      // Privacy Settings (DSGVO-konform: standardmäßig deaktiviert)
      privacySettings: {
        allowExternalLogos: false,
        externalLogosConsentDate: null,
      },

      // Accessibility Settings (ADHS-freundlich)
      accessibilitySettings: {
        reduceMotion: false, // Respektiert auch System-Einstellung
      },

      // Expert Mode Settings (standardmäßig deaktiviert für einfache UX)
      expertModeSettings: {
        enabled: false, // Zeigt erweiterte Features wie Prioritäten, Timer-Button, Filter
        customShortcuts: false,
        advancedFilters: false,
        automations: false,
        bulkOperations: false,
        detailedAnalytics: false,
        taskTemplates: false,
      },

      // Expert Mode Data
      customShortcuts: [],
      savedFilters: [],
      automationRules: [],

      // UI State
      sidebarCollapsed: false,
      workTimeWidgetCollapsed: false,
      themeMode: 'light' as ThemeMode,
      appVersion: '1.5.0',
      lastUpdateCheck: null,
      dismissedVersion: null,
      lastSeenVersion: null,

      // Onboarding
      hasCompletedOnboarding: false,
      onboardingCompletedAt: null,

      // Day State
      currentDay: null,
      dayHistory: [],

      updateSettings: (newSettings) => {
        set((state) => ({ ...state, ...newSettings }));
      },

      updateSoundSettings: (newSoundSettings) => {
        set((state) => ({
          soundSettings: { ...state.soundSettings, ...newSoundSettings },
        }));
      },

      updateNotificationSettings: (newNotificationSettings) => {
        set((state) => ({
          notificationSettings: { ...state.notificationSettings, ...newNotificationSettings },
        }));
      },

      updateFocusTimerSettings: (newFocusTimerSettings) => {
        set((state) => ({
          focusTimerSettings: { ...state.focusTimerSettings, ...newFocusTimerSettings },
        }));
      },

      updatePrivacySettings: (newPrivacySettings) => {
        set((state) => ({
          privacySettings: {
            ...state.privacySettings,
            ...newPrivacySettings,
            // Setze Zustimmungsdatum wenn Logos aktiviert werden
            externalLogosConsentDate: newPrivacySettings.allowExternalLogos
              ? new Date().toISOString()
              : state.privacySettings.externalLogosConsentDate,
          },
        }));
      },

      updateAccessibilitySettings: (newAccessibilitySettings) => {
        set((state) => ({
          accessibilitySettings: {
            ...state.accessibilitySettings,
            ...newAccessibilitySettings,
          },
        }));
      },

      updateExpertModeSettings: (newExpertModeSettings) => {
        set((state) => ({
          expertModeSettings: {
            ...state.expertModeSettings,
            ...newExpertModeSettings,
          },
        }));
      },

      // Custom Shortcuts Actions
      addCustomShortcut: (shortcut) => {
        set((state) => ({
          customShortcuts: [
            ...state.customShortcuts,
            { ...shortcut, id: crypto.randomUUID() },
          ],
        }));
      },

      updateCustomShortcut: (id, updates) => {
        set((state) => ({
          customShortcuts: state.customShortcuts.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        }));
      },

      deleteCustomShortcut: (id) => {
        set((state) => ({
          customShortcuts: state.customShortcuts.filter((s) => s.id !== id),
        }));
      },

      // Saved Filters Actions
      addSavedFilter: (filter) => {
        set((state) => ({
          savedFilters: [
            ...state.savedFilters,
            { ...filter, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
          ],
        }));
      },

      updateSavedFilter: (id, updates) => {
        set((state) => ({
          savedFilters: state.savedFilters.map((f) =>
            f.id === id ? { ...f, ...updates } : f
          ),
        }));
      },

      deleteSavedFilter: (id) => {
        set((state) => ({
          savedFilters: state.savedFilters.filter((f) => f.id !== id),
        }));
      },

      // Automation Rules Actions
      addAutomationRule: (rule) => {
        set((state) => ({
          automationRules: [
            ...state.automationRules,
            { ...rule, id: crypto.randomUUID(), createdAt: new Date().toISOString(), triggerCount: 0 },
          ],
        }));
      },

      updateAutomationRule: (id, updates) => {
        set((state) => ({
          automationRules: state.automationRules.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        }));
      },

      deleteAutomationRule: (id) => {
        set((state) => ({
          automationRules: state.automationRules.filter((r) => r.id !== id),
        }));
      },

      toggleSidebar: () => {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
      },

      toggleWorkTimeWidget: () => {
        set((state) => ({ workTimeWidgetCollapsed: !state.workTimeWidgetCollapsed }));
      },

      setThemeMode: (mode: ThemeMode) => {
        set({ themeMode: mode });
      },

      completeOnboarding: () => {
        set({
          hasCompletedOnboarding: true,
          onboardingCompletedAt: new Date().toISOString(),
        });
      },

      startDay: (date: string) => {
        const newDay: DayRecord = {
          date,
          startedAt: new Date().toISOString(),
          isActive: true,
        };
        set((state) => ({
          currentDay: newDay,
          dayHistory: [...state.dayHistory.filter((d) => d.date !== date), newDay],
        }));
      },

      endDay: (date: string) => {
        set((state) => {
          const updatedDay: DayRecord = {
            ...state.currentDay!,
            endedAt: new Date().toISOString(),
            isActive: false,
          };
          return {
            currentDay: null,
            dayHistory: state.dayHistory.map((d) =>
              d.date === date ? updatedDay : d
            ),
          };
        });
      },

      isDayStarted: (date: string) => {
        const record = get().dayHistory.find((d) => d.date === date);
        return !!record;
      },

      isDayEnded: (date: string) => {
        const record = get().dayHistory.find((d) => d.date === date);
        return !!record?.endedAt;
      },

      getDayRecord: (date: string) => {
        return get().dayHistory.find((d) => d.date === date);
      },
    }),
    {
      name: 'tally-settings',
      storage: createJSONStorage(() => storage),
      onRehydrateStorage: () => (state) => {
        // Nach dem Laden des persistierten Stores: appVersion immer auf aktuelle Version setzen
        if (state && state.appVersion !== CURRENT_VERSION) {
          state.updateSettings({ appVersion: CURRENT_VERSION });
        }
      },
    }
  )
);
