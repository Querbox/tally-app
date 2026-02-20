import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Sidebar } from './components/layout/Sidebar';
import { Toolbar } from './components/layout/Toolbar';
import { WindowDragRegion } from './components/layout/WindowDragRegion';
import { SearchModal } from './components/search/SearchModal';
import { DayView } from './views/DayView';
import { CalendarView } from './views/CalendarView';
import { DayStartView } from './views/DayStartView';
import { DayEndView } from './views/DayEndView';
import { TaskDetailModal } from './components/tasks/TaskDetailModal';
import { ClientDetailModal } from './components/modals/ClientDetailModal';
import { KeyboardShortcutsModal } from './components/modals/KeyboardShortcutsModal';
import { QuickAddModal } from './components/modals/QuickAddModal';
import { checkForUpdatesInBackground } from './components/modals/UpdateModal';
import { FocusMode } from './components/focus/FocusMode';
import { FloatingAssistant } from './components/assistant';
import { useSettingsStore } from './stores/settingsStore';
import { useTaskStore } from './stores/taskStore';
import { useNotifications } from './hooks/useNotifications';
import { usePatternDetection } from './hooks/usePatternDetection';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useTheme } from './hooks/useTheme';
import { useReducedMotion } from './hooks/useReducedMotion';
import { initGlobalSounds } from './hooks/useSounds';
import { getTodayString } from './utils/dateUtils';
import { runMigrations, isTauri } from './lib/fileStorage';
import { Loader2 } from 'lucide-react';
import type { Task, Client, TaskPriority } from './types';

// Lazy-loaded modals for better initial load performance
const SettingsView = lazy(() => import('./views/SettingsView').then(m => ({ default: m.SettingsView })));
const StatsView = lazy(() => import('./views/StatsView').then(m => ({ default: m.StatsView })));
const OnboardingModal = lazy(() => import('./components/onboarding/OnboardingModal').then(m => ({ default: m.OnboardingModal })));
const WhatsNewModal = lazy(() => import('./components/modals/WhatsNewModal').then(m => ({ default: m.WhatsNewModal })));
const UpdateModal = lazy(() => import('./components/modals/UpdateModal').then(m => ({ default: m.UpdateModal })));

// Loading fallback for lazy modals
function ModalLoader() {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        <p className="text-sm text-gray-500">Lade...</p>
      </div>
    </div>
  );
}

// Hook um auf Store-Hydration zu warten
function useStoreHydration() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Prüfe ob beide Stores hydriert sind
    const checkHydration = () => {
      const settingsHydrated = useSettingsStore.persist.hasHydrated();
      const tasksHydrated = useTaskStore.persist.hasHydrated();

      if (settingsHydrated && tasksHydrated) {
        setHydrated(true);
      }
    };

    // Prüfe initial
    checkHydration();

    // Registriere Listener falls noch nicht hydriert
    const unsubSettings = useSettingsStore.persist.onFinishHydration(() => checkHydration());
    const unsubTasks = useTaskStore.persist.onFinishHydration(() => checkHydration());

    return () => {
      unsubSettings();
      unsubTasks();
    };
  }, []);

  return hydrated;
}

type AppState = 'day_start' | 'day_active' | 'day_end';

// Loading-Screen während Store-Hydration
function LoadingScreen() {
  return (
    <div className="h-screen w-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        <p className="text-sm text-gray-500">Lade Daten...</p>
      </div>
    </div>
  );
}

function AppContent() {
  const {
    isDayStarted,
    isDayEnded,
    hasCompletedOnboarding,
    completeOnboarding,
    appVersion,
    lastSeenVersion,
    updateSettings,
  } = useSettingsStore(
    useShallow((s) => ({
      isDayStarted: s.isDayStarted,
      isDayEnded: s.isDayEnded,
      hasCompletedOnboarding: s.hasCompletedOnboarding,
      completeOnboarding: s.completeOnboarding,
      appVersion: s.appVersion,
      lastSeenVersion: s.lastSeenVersion,
      updateSettings: s.updateSettings,
    }))
  );
  const today = getTodayString();

  // Determine initial state
  const getInitialState = (): AppState => {
    if (isDayEnded(today)) return 'day_start'; // New day after ending
    if (isDayStarted(today)) return 'day_active';
    return 'day_start';
  };

  const [appState, setAppState] = useState<AppState>(getInitialState);
  const [currentView, setCurrentView] = useState<'day' | 'calendar'>('day');
  const [showSettings, setShowSettings] = useState(false);
  const [showDayEnd, setShowDayEnd] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddIsMeeting, setQuickAddIsMeeting] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(!hasCompletedOnboarding);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [focusModeTask, setFocusModeTask] = useState<Task | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null); // Leichte Fokus-Markierung in DayView

  // Get tasks for focus mode
  const tasks = useTaskStore((s) => s.tasks);
  const todayTasks = useMemo(() => {
    return tasks.filter((t) => t.scheduledDate === today && t.status !== 'completed' && !t.isMeeting);
  }, [tasks, today]);

  // Auto-Fokus: Automatisch die erste Aufgabe (höchste Priorität) als "Heute zuerst" setzen
  // Nur wenn Nutzer noch keine Fokus-Aufgabe manuell gewählt hat
  const autoFocusRef = useRef(false);
  useEffect(() => {
    // Nur einmal beim ersten Laden setzen, nicht bei jeder Änderung
    if (autoFocusRef.current) return;
    if (todayTasks.length > 0 && focusTaskId === null) {
      autoFocusRef.current = true;
      const priorityOrder: Record<TaskPriority, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
      const sortedTasks = [...todayTasks].sort((a, b) => {
        const pa = priorityOrder[a.priority || 'medium'];
        const pb = priorityOrder[b.priority || 'medium'];
        return pb - pa;
      });
      setFocusTaskId(sortedTasks[0].id);
    }
  }, [todayTasks, focusTaskId]);

  // Sync onboarding state when settings are loaded (async loading from file)
  const onboardingInitRef = useRef(false);
  useEffect(() => {
    if (onboardingInitRef.current) return;
    // Only update once when hasCompletedOnboarding becomes true
    if (hasCompletedOnboarding) {
      onboardingInitRef.current = true;
      setShowOnboarding(false);
    }
  }, [hasCompletedOnboarding]);

  // Check if we should show What's New modal (after onboarding, when version changed)
  const whatsNewCheckRef = useRef(false);
  useEffect(() => {
    if (whatsNewCheckRef.current) return;
    if (!hasCompletedOnboarding) return; // Wait for onboarding to complete
    whatsNewCheckRef.current = true;

    // Show What's New if version is newer than last seen
    if (lastSeenVersion !== appVersion) {
      // Small delay to not overwhelm user right at startup
      setTimeout(() => setShowWhatsNew(true), 500);
    }
  }, [hasCompletedOnboarding, lastSeenVersion, appVersion]);

  // Migrate data from localStorage to file system on first Tauri start
  const migrationRef = useRef(false);
  useEffect(() => {
    if (migrationRef.current) return;
    migrationRef.current = true;

    if (isTauri()) {
      runMigrations().catch(console.error);
    }

    // Bereinige alte gelöschte Tasks (älter als 7 Tage)
    useTaskStore.getState().cleanupOldDeletedTasks();

    // Bereinige alte Recurring-Instanzen (älter als 30 Tage)
    useTaskStore.getState().cleanupOldRecurringInstances();
  }, []);

  // Check for updates on app start (once per session, with 5 second delay)
  const updateCheckRef = useRef(false);
  useEffect(() => {
    if (updateCheckRef.current) return;
    updateCheckRef.current = true;

    const checkUpdates = async () => {
      // Wait 5 seconds after app start before checking
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const update = await checkForUpdatesInBackground();
      if (update) {
        // Show update modal automatically if update is available
        setShowUpdateModal(true);
      }
    };

    checkUpdates();
  }, []);

  // Initialize meeting notifications
  useNotifications();

  // Initialize pattern detection engine
  usePatternDetection();

  // Initialize theme
  useTheme();

  // Initialize reduced motion (ADHS-freundlich)
  useReducedMotion();

  // Initialize audio on first user interaction (required by browser policy)
  const audioInitializedRef = useRef(false);
  useEffect(() => {
    const initAudio = () => {
      if (!audioInitializedRef.current) {
        audioInitializedRef.current = true;
        initGlobalSounds();
      }
    };

    // Listen for any user interaction to unlock AudioContext
    window.addEventListener('click', initAudio, { once: true });
    window.addEventListener('keydown', initAudio, { once: true });
    window.addEventListener('touchstart', initAudio, { once: true });

    return () => {
      window.removeEventListener('click', initAudio);
      window.removeEventListener('keydown', initAudio);
      window.removeEventListener('touchstart', initAudio);
    };
  }, []);

  // Quick add handlers
  const handleQuickAddTask = useCallback(() => {
    setQuickAddIsMeeting(false);
    setShowQuickAdd(true);
  }, []);

  const handleQuickAddMeeting = useCallback(() => {
    setQuickAddIsMeeting(true);
    setShowQuickAdd(true);
  }, []);

  // Handler for focus mode
  const handleOpenFocusMode = useCallback(() => {
    if (todayTasks.length > 0) {
      // Get highest priority task
      const priorityOrder: Record<TaskPriority, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
      const sortedTasks = [...todayTasks].sort((a, b) => {
        const pa = priorityOrder[a.priority || 'medium'];
        const pb = priorityOrder[b.priority || 'medium'];
        return pb - pa;
      });
      setFocusModeTask(sortedTasks[0]);
    }
  }, [todayTasks]);

  // Handler for priority filter
  const handleSetPriorityFilter = useCallback((priority: TaskPriority | 'all') => {
    setPriorityFilter(priority);
  }, []);

  // Handler für Fokus-Toggle (Space) - setzt die erste offene Aufgabe als Fokus
  const handleToggleFocus = useCallback(() => {
    if (focusTaskId) {
      // Fokus aufheben
      setFocusTaskId(null);
    } else if (todayTasks.length > 0) {
      // Höchste Priorität als Fokus setzen
      const priorityOrder: Record<TaskPriority, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
      const sortedTasks = [...todayTasks].sort((a, b) => {
        const pa = priorityOrder[a.priority || 'medium'];
        const pb = priorityOrder[b.priority || 'medium'];
        return pb - pa;
      });
      setFocusTaskId(sortedTasks[0].id);
    }
  }, [focusTaskId, todayTasks]);

  // Global keyboard shortcuts - nutzt zentrale Config aus shortcuts.ts
  // Actions mappen Shortcut-IDs zu Funktionen
  const shortcutActions = useMemo(
    () => [
      // Navigation
      { id: 'search', action: () => setShowSearch(true) },
      { id: 'search-ctrl', action: () => setShowSearch(true) },
      { id: 'settings', action: () => setShowSettings(true) },
      { id: 'dayView', action: () => setCurrentView('day') },
      { id: 'calendarView', action: () => setCurrentView('calendar') },
      {
        id: 'close',
        action: () => {
          setShowSearch(false);
          setShowSettings(false);
          setShowKeyboardHelp(false);
          setShowQuickAdd(false);
          setShowStats(false);
          setSelectedTask(null);
          setSelectedClient(null);
          setFocusModeTask(null);
        },
      },
      // Aufgaben
      { id: 'newTask', action: handleQuickAddTask },
      { id: 'newMeeting', action: handleQuickAddMeeting },
      { id: 'startFocus', action: handleOpenFocusMode },
      { id: 'toggleFocus', action: handleToggleFocus },
      { id: 'stats', action: () => setShowStats(true) },
      // Filter
      { id: 'filterUrgent', action: () => handleSetPriorityFilter('urgent') },
      { id: 'filterHigh', action: () => handleSetPriorityFilter('high') },
      { id: 'filterMedium', action: () => handleSetPriorityFilter('medium') },
      { id: 'filterLow', action: () => handleSetPriorityFilter('low') },
      { id: 'filterReset', action: () => handleSetPriorityFilter('all') },
      // Hilfe
      { id: 'help', action: () => setShowKeyboardHelp(true) },
    ],
    [handleQuickAddTask, handleQuickAddMeeting, handleOpenFocusMode, handleToggleFocus, handleSetPriorityFilter]
  );

  useKeyboardShortcuts({
    actions: shortcutActions,
    context: 'day',
    enabled: appState === 'day_active' && !focusModeTask,
  });

  const handleStartDay = () => {
    setAppState('day_active');
  };

  const handleOpenDayEnd = () => {
    setShowDayEnd(true);
  };

  const handleEndDay = () => {
    setShowDayEnd(false);
    setAppState('day_start');
  };

  const handleSelectTask = (task: Task) => {
    setSelectedTask(task);
  };

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
  };

  // Day Start Screen
  if (appState === 'day_start') {
    return <DayStartView onStartDay={handleStartDay} />;
  }

  // Main App
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* macOS-style Toolbar */}
      <Toolbar onOpenSearch={() => setShowSearch(true)} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          currentView={currentView}
          onViewChange={setCurrentView}
          onOpenSettings={() => setShowSettings(true)}
        />

        {currentView === 'day' ? (
          <DayView
            onEndDay={handleOpenDayEnd}
            externalPriorityFilter={priorityFilter}
            onPriorityFilterChange={setPriorityFilter}
            focusTaskId={focusTaskId}
            onFocusTask={(task) => setFocusTaskId(task ? task.id : null)}
          />
        ) : (
          <CalendarView />
        )}
      </div>

      {/* Search Modal */}
      <SearchModal
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        onSelectTask={handleSelectTask}
        onSelectClient={handleSelectClient}
      />

      {/* Task Detail Modal (from search) */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}

      {/* Client Detail Modal (from search) */}
      {selectedClient && (
        <ClientDetailModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          isNew={false}
        />
      )}

      {/* Settings Modal (lazy loaded) */}
      {showSettings && (
        <Suspense fallback={<ModalLoader />}>
          <SettingsView onClose={() => setShowSettings(false)} />
        </Suspense>
      )}

      {/* Day End Modal */}
      {showDayEnd && (
        <DayEndView
          onClose={() => setShowDayEnd(false)}
          onEndDay={handleEndDay}
        />
      )}

      {/* Keyboard Shortcuts Help */}
      {showKeyboardHelp && (
        <KeyboardShortcutsModal onClose={() => setShowKeyboardHelp(false)} />
      )}

      {/* Quick Add Modal */}
      {showQuickAdd && (
        <QuickAddModal
          onClose={() => setShowQuickAdd(false)}
          isMeeting={quickAddIsMeeting}
        />
      )}

      {/* Stats View (lazy loaded) */}
      {showStats && (
        <Suspense fallback={<ModalLoader />}>
          <StatsView onClose={() => setShowStats(false)} />
        </Suspense>
      )}

      {/* Update Modal (lazy loaded) */}
      {showUpdateModal && (
        <Suspense fallback={<ModalLoader />}>
          <UpdateModal onClose={() => setShowUpdateModal(false)} />
        </Suspense>
      )}

      {/* Onboarding Modal (lazy loaded, für neue Nutzer) */}
      {showOnboarding && (
        <Suspense fallback={<ModalLoader />}>
          <OnboardingModal
            onComplete={() => {
              completeOnboarding();
              setShowOnboarding(false);
            }}
          />
        </Suspense>
      )}

      {/* What's New Modal (lazy loaded, nach Updates) */}
      {showWhatsNew && !showOnboarding && (
        <Suspense fallback={<ModalLoader />}>
          <WhatsNewModal
            currentVersion={appVersion}
            lastSeenVersion={lastSeenVersion}
            onClose={() => {
              updateSettings({ lastSeenVersion: appVersion });
              setShowWhatsNew(false);
            }}
          />
        </Suspense>
      )}

      {/* Global Focus Mode */}
      {focusModeTask && (
        <FocusMode
          task={focusModeTask}
          onClose={() => setFocusModeTask(null)}
        />
      )}

      {/* Floating Assistant Tally */}
      <FloatingAssistant />

      {/* Global drag region - always on top so window can be dragged even with overlays open */}
      <WindowDragRegion />
    </div>
  );
}

// Wrapper-Komponente die auf Hydration wartet
function App() {
  const hydrated = useStoreHydration();
  if (!hydrated) {
    return <LoadingScreen />;
  }

  return <AppContent />;
}

export default App;
