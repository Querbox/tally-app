import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useShallow } from 'zustand/react/shallow';
import { useSettingsStore } from '../stores/settingsStore';
import { useTaskStore } from '../stores/taskStore';
import { usePatternStore } from '../stores/patternStore';
import type { PatternType } from '../types';
import { playGlobalSound, type SoundType } from '../hooks/useSounds';
import { UpdateModal } from '../components/modals/UpdateModal';
import { WhatsNewModal } from '../components/modals/WhatsNewModal';
import { FeedbackModal } from '../components/modals/FeedbackModal';
import { CURRENT_VERSION } from '../data/releases';
import { OnboardingModal } from '../components/onboarding/OnboardingModal';
import {
  CustomShortcutsEditor,
  AdvancedFiltersEditor,
  AutomationsEditor,
  TaskTemplatesEditor,
} from '../components/expert';
import {
  X,
  Plus,
  Trash2,
  Tag,
  Clock,
  ListChecks,
  AlertTriangle,
  Volume2,
  Bell,
  Play,
  Calendar,
  Keyboard,
  Target,
  Sun,
  Moon,
  Monitor,
  Download,
  Upload,
  Sparkles,
  RefreshCw,
  Shield,
  Globe,
  Info,
  Settings,
  HelpCircle,
  BookOpen,
  MessageSquare,
  Heart,
  Bug,
  Lightbulb,
  ExternalLink,
  Zap,
  Check,
  Minus,
  Coffee,
} from 'lucide-react';
import type { ThemeMode } from '../stores/settingsStore';
import { PRESET_COLORS } from '../constants/colors';
import { getShortcutsForSettings } from '../config/shortcuts';

// ---------------------------------------------------------------------------
// Inline Sub-Components
// ---------------------------------------------------------------------------

/** Wraps a settings section in a white card with rounded corners */
function SettingsSection({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`bg-white border border-gray-100 rounded-2xl p-5 ${className}`}>
      {children}
    </section>
  );
}

/** macOS-style toggle row */
function ToggleRow({
  label,
  description,
  checked,
  onChange,
  icon,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon?: React.ReactNode;
}) {
  return (
    <label className="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer transition-all duration-200 hover:bg-gray-100/80">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {icon && <span className="flex-shrink-0">{icon}</span>}
        <div className="min-w-0">
          <span className="text-sm text-gray-700 font-medium block">{label}</span>
          {description && (
            <p className="text-xs text-gray-400 mt-0.5 leading-snug">{description}</p>
          )}
        </div>
      </div>
      {/* macOS-style toggle */}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={(e) => {
          e.preventDefault();
          onChange(!checked);
        }}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200 ease-in-out focus:outline-none ml-3 ${
          checked ? 'bg-gray-900' : 'bg-gray-300'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform duration-200 ease-in-out mt-0.5 ${
            checked ? 'translate-x-[22px] ml-0' : 'translate-x-0.5'
          }`}
        />
      </button>
    </label>
  );
}

/** Selectable option card with checkmark badge (used for theme selection) */
function OptionCard({
  selected,
  onClick,
  children,
  className = '',
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 ${
        selected
          ? 'border-gray-900 bg-gray-50 shadow-sm'
          : 'border-gray-100 bg-gray-50 hover:border-gray-200 hover:bg-gray-100/70'
      } ${className}`}
    >
      {selected && (
        <span className="absolute top-2 right-2 w-5 h-5 bg-gray-900 rounded-full flex items-center justify-center">
          <Check className="w-3 h-3 text-white" />
        </span>
      )}
      {children}
    </button>
  );
}

/** Big number with minus / plus buttons (for focus timer) */
function NumberStepper({
  value,
  onChange,
  min = 1,
  max = 120,
  step = 1,
  unit = 'Min',
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - step))}
        disabled={value <= min}
        className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >
        <Minus className="w-4 h-4" />
      </button>
      <div className="text-center min-w-[3.5rem]">
        <span className="text-2xl font-bold text-gray-900 tabular-nums">{value}</span>
        <span className="text-xs text-gray-400 ml-1">{unit}</span>
      </div>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + step))}
        disabled={value >= max}
        className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

/** Slider row with live value display */
function SliderRow({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  leftLabel,
  rightLabel,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  leftLabel?: string;
  rightLabel?: string;
}) {
  return (
    <div className="p-3 bg-gray-50 rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-700 font-medium">{label}</span>
        <span className="text-sm font-semibold text-gray-900 tabular-nums">
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-gray-900"
      />
      {(leftLabel || rightLabel) && (
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------------------

interface SettingsViewProps {
  onClose: () => void;
}

type TabId = 'general' | 'tasks' | 'notifications' | 'privacy' | 'trash' | 'about' | 'expert';

interface Tab {
  id: TabId;
  label: string;
  icon: typeof Settings;
  expertOnly?: boolean;
}

const TABS: Tab[] = [
  { id: 'general', label: 'Allgemein', icon: Settings },
  { id: 'tasks', label: 'Aufgaben & Timer', icon: ListChecks },
  { id: 'notifications', label: 'Sounds & Hinweise', icon: Bell },
  { id: 'expert', label: 'Experten-Tools', icon: Zap, expertOnly: true },
  { id: 'privacy', label: 'Datenschutz', icon: Shield },
  { id: 'trash', label: 'Papierkorb', icon: Trash2 },
  { id: 'about', label: 'Über & Hilfe', icon: HelpCircle },
];

const PATTERN_SETTINGS_CONFIG: { type: PatternType; label: string; description: string }[] = [
  {
    type: 'postpone',
    label: 'Oft verschobene Aufgaben',
    description: 'Hinweis oder Auto-Aktion wenn eine Aufgabe 3+ mal verschoben wurde',
  },
  {
    type: 'deadlineWarning',
    label: 'Deadline-Warnung',
    description: 'Warnung wenn eine Deadline näher rückt ohne Fortschritt',
  },
  {
    type: 'autoClient',
    label: 'Kundenerkennung',
    description: 'Kundenname im Aufgabentitel erkennen und zuordnen',
  },
];

const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function SettingsView({ onClose }: SettingsViewProps) {
  const settings = useSettingsStore(useShallow((s) => s));
  const tags = useTaskStore((s) => s.tags);
  const addTag = useTaskStore((s) => s.addTag);
  const deleteTag = useTaskStore((s) => s.deleteTag);
  const deletedTasks = useTaskStore((s) => s.deletedTasks);
  const restoreTask = useTaskStore((s) => s.restoreTask);
  const permanentlyDeleteTask = useTaskStore((s) => s.permanentlyDeleteTask);
  const emptyTrash = useTaskStore((s) => s.emptyTrash);
  const patternPreferences = usePatternStore((s) => s.preferences);
  const updatePatternPreference = usePatternStore((s) => s.updatePreference);
  const setAllPatternsEnabled = usePatternStore((s) => s.setAllPatternsEnabled);
  const isAnyPatternEnabled = usePatternStore((s) => s.isAnyPatternEnabled);

  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#8B5CF6');
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'feature' | 'bug' | 'feedback' | null>(null);

  const handleAddTag = () => {
    if (!newTagName.trim()) return;
    addTag({ name: newTagName.trim(), color: newTagColor });
    setNewTagName('');
  };

  const handleTestSound = (type: SoundType) => {
    // Temporarily enable all sounds for testing
    const originalSettings = settings.soundSettings;
    settings.updateSoundSettings({ enabled: true, [type]: true });
    playGlobalSound(type);
    // Restore original settings after a short delay
    setTimeout(() => {
      settings.updateSoundSettings(originalSettings);
    }, 100);
  };

  const toggleReminderInterval = (interval: number) => {
    const current = settings.notificationSettings.reminderIntervals;
    const newIntervals = current.includes(interval)
      ? current.filter((i) => i !== interval)
      : [...current, interval].sort((a, b) => b - a);
    settings.updateNotificationSettings({ reminderIntervals: newIntervals });
  };

  const handleClearAllData = () => {
    if (confirm('Alle Daten unwiderruflich loschen? Diese Aktion kann nicht ruckgangig gemacht werden.')) {
      localStorage.removeItem('tally-storage');
      localStorage.removeItem('tally-settings');
      localStorage.removeItem('tally-worktime');
      window.location.reload();
    }
  };

  const handleExportData = (format: 'json' | 'csv') => {
    const taskStore = useTaskStore.getState();
    const settingsStore = useSettingsStore.getState();

    if (format === 'json') {
      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        tasks: taskStore.tasks,
        clients: taskStore.clients,
        tags: taskStore.tags,
        settings: {
          workStartTime: settingsStore.workStartTime,
          workEndTime: settingsStore.workEndTime,
          weeklyWorkHours: settingsStore.weeklyWorkHours,
          workDaysPerWeek: settingsStore.workDaysPerWeek,
          themeMode: settingsStore.themeMode,
        },
        dayHistory: settingsStore.dayHistory,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tally-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // CSV export for tasks
      const headers = ['Titel', 'Status', 'Datum', 'Kunde', 'Priorität', 'Erstellt', 'Abgeschlossen', 'Zeit (Minuten)'];
      const rows = taskStore.tasks.map((task) => {
        const client = taskStore.clients.find((c) => c.id === task.clientId);
        const totalTime = task.timeEntries.reduce((acc, e) => acc + (e.duration || 0), 0);
        return [
          `"${task.title.replace(/"/g, '""')}"`,
          task.status,
          task.scheduledDate,
          client?.name || '',
          task.priority || 'medium',
          task.createdAt,
          task.completedAt || '',
          Math.round(totalTime / 60),
        ].join(',');
      });

      const csv = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tally-tasks-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.version && data.tasks && data.clients) {
          if (confirm('Vorhandene Daten werden überschrieben. Fortfahren?')) {
            const taskStore = useTaskStore.getState();
            // Import tasks, clients, tags
            data.tasks.forEach((task: any) => {
              if (!taskStore.tasks.find((t) => t.id === task.id)) {
                taskStore.addTask(task);
              }
            });
            data.clients.forEach((client: any) => {
              if (!taskStore.clients.find((c) => c.id === client.id)) {
                taskStore.addClient(client);
              }
            });
            data.tags.forEach((tag: any) => {
              if (!taskStore.tags.find((t) => t.id === tag.id)) {
                taskStore.addTag(tag);
              }
            });
            alert('Import erfolgreich!');
          }
        } else {
          alert('Ungültiges Dateiformat');
        }
      } catch {
        alert('Fehler beim Importieren der Datei');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleReplayOnboarding = () => {
    setShowOnboarding(true);
  };

  // =========================================================================
  // Tab Content Renderers
  // =========================================================================

  const renderGeneralTab = () => (
    <div className="space-y-6">
      {/* Theme Settings — OptionCards with mini-previews */}
      <SettingsSection>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center">
            {settings.themeMode === 'dark' ? (
              <Moon className="w-5 h-5 text-gray-700" />
            ) : settings.themeMode === 'light' ? (
              <Sun className="w-5 h-5 text-amber-500" />
            ) : (
              <Monitor className="w-5 h-5 text-gray-600" />
            )}
          </div>
          <h3 className="font-medium text-gray-900">Erscheinungsbild</h3>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {([
            { mode: 'light' as ThemeMode, icon: Sun, label: 'Hell', bg: 'bg-white', bar: 'bg-gray-200', text: 'bg-gray-300' },
            { mode: 'dark' as ThemeMode, icon: Moon, label: 'Dunkel', bg: 'bg-gray-800', bar: 'bg-gray-600', text: 'bg-gray-500' },
            { mode: 'system' as ThemeMode, icon: Monitor, label: 'System', bg: 'bg-gradient-to-r from-white to-gray-800', bar: 'bg-gray-400', text: 'bg-gray-400' },
          ] as const).map(({ mode, icon: Icon, label, bg, bar, text }) => (
            <OptionCard
              key={mode}
              selected={settings.themeMode === mode}
              onClick={() => settings.setThemeMode(mode)}
            >
              {/* Mini preview */}
              <div className={`w-full h-14 rounded-lg ${bg} border border-gray-200 p-2 flex flex-col gap-1.5`}>
                <div className={`h-1.5 w-8 ${bar} rounded-full`} />
                <div className={`h-1.5 w-12 ${text} rounded-full`} />
                <div className={`h-1.5 w-6 ${text} rounded-full`} />
              </div>
              <div className="flex items-center gap-1.5">
                <Icon className="w-4 h-4 text-gray-500" />
                <span className="text-xs font-medium text-gray-700">{label}</span>
              </div>
            </OptionCard>
          ))}
        </div>
      </SettingsSection>

      {/* Work Hours */}
      <SettingsSection>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
            <Clock className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="font-medium text-gray-900">Arbeitszeiten</h3>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Arbeitsbeginn</label>
            <input
              type="time"
              value={settings.workStartTime}
              onChange={(e) => settings.updateSettings({ workStartTime: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/10 transition-all duration-200"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Arbeitsende</label>
            <input
              type="time"
              value={settings.workEndTime}
              onChange={(e) => settings.updateSettings({ workEndTime: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/10 transition-all duration-200"
            />
          </div>
        </div>

        {/* Weekly hours — SliderRow */}
        <SliderRow
          label="Soll-Stunden pro Woche"
          value={settings.weeklyWorkHours}
          onChange={(v) => settings.updateSettings({ weeklyWorkHours: v })}
          min={1}
          max={60}
          step={1}
          unit=" Std"
        />

        {/* Visual day buttons Mo-So */}
        <div className="mt-4">
          <label className="block text-xs text-gray-500 mb-2">Arbeitstage pro Woche</label>
          <div className="flex gap-2">
            {DAY_LABELS.map((day, idx) => {
              const dayNum = idx + 1; // 1=Mo .. 7=So
              const isActive = dayNum <= settings.workDaysPerWeek;
              return (
                <button
                  key={day}
                  onClick={() => settings.updateSettings({ workDaysPerWeek: dayNum })}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-gray-900 text-white shadow-sm'
                      : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      </SettingsSection>

      {/* Expert Mode */}
      <SettingsSection className="!bg-gradient-to-br from-purple-50 to-indigo-50 !border-purple-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Experten-Modus</h3>
            <p className="text-xs text-gray-500">Für Power-User mit mehr Erfahrung</p>
          </div>
        </div>
        <div className="space-y-3">
          <ToggleRow
            label="Experten-Modus aktivieren"
            description="Zeigt erweiterte Funktionen wie Prioritäten-Flags, Timer-Button, Filter und Sortierung"
            checked={settings.expertModeSettings?.enabled ?? false}
            onChange={(v) => settings.updateExpertModeSettings({ enabled: v })}
          />

          {/* Feature-Toggles — nur sichtbar wenn Experten-Modus aktiv */}
          {settings.expertModeSettings?.enabled && (
            <div className="space-y-2 pt-2 border-t border-purple-200/50">
              <p className="text-xs text-purple-600 font-medium px-1">Erweiterte Features:</p>

              <ToggleRow
                label="Eigene Tastenkürzel"
                description="Definiere eigene Shortcuts für häufige Aktionen"
                checked={settings.expertModeSettings?.customShortcuts ?? false}
                onChange={(v) => settings.updateExpertModeSettings({ customShortcuts: v })}
                icon={<Keyboard className="w-4 h-4 text-purple-500" />}
              />

              <ToggleRow
                label="Erweiterte Filter"
                description="Komplexe Filter mit UND/ODER-Logik, gespeicherte Filter"
                checked={settings.expertModeSettings?.advancedFilters ?? false}
                onChange={(v) => settings.updateExpertModeSettings({ advancedFilters: v })}
                icon={<ListChecks className="w-4 h-4 text-blue-500" />}
              />

              <ToggleRow
                label="Automatisierungen"
                description="Regeln für automatische Aktionen (z.B. Priorität setzen)"
                checked={settings.expertModeSettings?.automations ?? false}
                onChange={(v) => settings.updateExpertModeSettings({ automations: v })}
                icon={<RefreshCw className="w-4 h-4 text-green-500" />}
              />

              <ToggleRow
                label="Massenbearbeitung"
                description="Mehrere Aufgaben gleichzeitig bearbeiten"
                checked={settings.expertModeSettings?.bulkOperations ?? false}
                onChange={(v) => settings.updateExpertModeSettings({ bulkOperations: v })}
                icon={<ListChecks className="w-4 h-4 text-orange-500" />}
              />

              <ToggleRow
                label="Detaillierte Statistiken"
                description="Erweiterte Produktivitäts-Analysen und Trends"
                checked={settings.expertModeSettings?.detailedAnalytics ?? false}
                onChange={(v) => settings.updateExpertModeSettings({ detailedAnalytics: v })}
                icon={<Target className="w-4 h-4 text-cyan-500" />}
              />

              <ToggleRow
                label="Aufgaben-Templates"
                description="Vorlagen für wiederkehrende Aufgaben speichern"
                checked={settings.expertModeSettings?.taskTemplates ?? false}
                onChange={(v) => settings.updateExpertModeSettings({ taskTemplates: v })}
                icon={<Download className="w-4 h-4 text-pink-500" />}
              />
            </div>
          )}
        </div>
      </SettingsSection>

      {/* Calendar Settings */}
      <SettingsSection>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center">
            <Calendar className="w-5 h-5 text-indigo-600" />
          </div>
          <h3 className="font-medium text-gray-900">Kalender</h3>
        </div>
        <ToggleRow
          label="Wochenende anzeigen"
          description="Samstag und Sonntag in der Wochenansicht"
          checked={settings.showWeekends}
          onChange={(v) => settings.updateSettings({ showWeekends: v })}
        />
      </SettingsSection>

      {/* Export/Import */}
      <SettingsSection>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
            <Download className="w-5 h-5 text-emerald-600" />
          </div>
          <h3 className="font-medium text-gray-900">Daten exportieren / importieren</h3>
        </div>
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => handleExportData('json')}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-all text-sm font-medium text-gray-700"
            >
              <Download className="w-4 h-4" />
              JSON Export
            </button>
            <button
              onClick={() => handleExportData('csv')}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-all text-sm font-medium text-gray-700"
            >
              <Download className="w-4 h-4" />
              CSV Export
            </button>
          </div>
          <label className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-all text-sm font-medium text-gray-700 cursor-pointer">
            <Upload className="w-4 h-4" />
            JSON importieren
            <input
              type="file"
              accept=".json"
              onChange={handleImportData}
              className="hidden"
            />
          </label>
          <p className="text-xs text-gray-400 text-center">
            JSON enthält alle Daten, CSV nur die Aufgabenliste
          </p>
        </div>
      </SettingsSection>
    </div>
  );

  const renderTasksTab = () => (
    <div className="space-y-6">
      {/* Task Settings */}
      <SettingsSection>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center">
            <ListChecks className="w-5 h-5 text-green-600" />
          </div>
          <h3 className="font-medium text-gray-900">Aufgaben</h3>
        </div>
        <div className="space-y-3">
          <ToggleRow
            label="Unerledigte Aufgaben automatisch ubertragen"
            checked={settings.autoCarryOverTasks}
            onChange={(v) => settings.updateSettings({ autoCarryOverTasks: v })}
          />
          <ToggleRow
            label="Erledigte Aufgaben anzeigen"
            checked={settings.showCompletedTasks}
            onChange={(v) => settings.updateSettings({ showCompletedTasks: v })}
          />
          <div className="p-3 bg-gray-50 rounded-xl">
            <label className="block text-xs text-gray-500 mb-1.5">Standard-Aufgabendauer</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="5"
                max="480"
                step="5"
                value={settings.defaultTaskDuration}
                onChange={(e) => settings.updateSettings({ defaultTaskDuration: parseInt(e.target.value) || 30 })}
                className="w-20 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 text-center bg-white"
              />
              <span className="text-sm text-gray-500">Minuten</span>
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* Focus Timer Settings — 3 colored cards with NumberSteppers */}
      <SettingsSection>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center">
            <Target className="w-5 h-5 text-purple-600" />
          </div>
          <h3 className="font-medium text-gray-900">Focus Timer</h3>
        </div>
        <div className="space-y-4">
          {/* 3 colored timer cards */}
          <div className="grid grid-cols-3 gap-3">
            {/* Focus card — purple */}
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 flex flex-col items-center gap-2">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <Target className="w-4 h-4 text-purple-600" />
              </div>
              <span className="text-xs font-medium text-purple-700">Focus-Zeit</span>
              <NumberStepper
                value={settings.focusTimerSettings.focusDuration}
                onChange={(v) => settings.updateFocusTimerSettings({ focusDuration: v })}
                min={1}
                max={120}
              />
            </div>
            {/* Short break — green */}
            <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex flex-col items-center gap-2">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <Coffee className="w-4 h-4 text-green-600" />
              </div>
              <span className="text-xs font-medium text-green-700">Kurze Pause</span>
              <NumberStepper
                value={settings.focusTimerSettings.shortBreakDuration}
                onChange={(v) => settings.updateFocusTimerSettings({ shortBreakDuration: v })}
                min={1}
                max={30}
              />
            </div>
            {/* Long break — blue */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex flex-col items-center gap-2">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Coffee className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-xs font-medium text-blue-700">Lange Pause</span>
              <NumberStepper
                value={settings.focusTimerSettings.longBreakDuration}
                onChange={(v) => settings.updateFocusTimerSettings({ longBreakDuration: v })}
                min={1}
                max={60}
              />
            </div>
          </div>

          {/* Sessions until long break */}
          <div className="p-3 bg-gray-50 rounded-xl flex items-center justify-between">
            <span className="text-sm text-gray-700 font-medium">Sessions bis lange Pause</span>
            <NumberStepper
              value={settings.focusTimerSettings.sessionsUntilLongBreak}
              onChange={(v) => settings.updateFocusTimerSettings({ sessionsUntilLongBreak: v })}
              min={1}
              max={10}
              unit="x"
            />
          </div>

          {/* Auto-start options */}
          <div className="space-y-2">
            <ToggleRow
              label="Pausen automatisch starten"
              checked={settings.focusTimerSettings.autoStartBreaks}
              onChange={(v) => settings.updateFocusTimerSettings({ autoStartBreaks: v })}
            />
            <ToggleRow
              label="Focus nach Pause automatisch starten"
              checked={settings.focusTimerSettings.autoStartFocus}
              onChange={(v) => settings.updateFocusTimerSettings({ autoStartFocus: v })}
            />
          </div>
        </div>
      </SettingsSection>

      {/* Tags */}
      <SettingsSection>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
            <Tag className="w-5 h-5 text-amber-600" />
          </div>
          <h3 className="font-medium text-gray-900">Tags</h3>
        </div>

        {/* Existing Tags */}
        <div className="space-y-2 mb-4">
          {tags.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Noch keine Tags angelegt</p>
          ) : (
            tags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-xl group hover:shadow-sm transition-all duration-200"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-4 h-4 rounded-full shadow-sm"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="text-sm text-gray-700 font-medium">{tag.name}</span>
                </div>
                <button
                  onClick={() => deleteTag(tag.id)}
                  className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add New Tag */}
        <div className="bg-gray-50 rounded-xl p-3">
          <label className="block text-xs text-gray-500 mb-2">Neuer Tag</label>
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setNewTagColor(color)}
                  className={`w-6 h-6 rounded-full transition-all duration-200 ${
                    newTagColor === color ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="Tag-Name..."
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/10 transition-all duration-200 text-sm bg-white"
              onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
            />
            <button
              onClick={handleAddTag}
              disabled={!newTagName.trim()}
              className="p-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 btn-press"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>
      </SettingsSection>
    </div>
  );

  const renderNotificationsTab = () => (
    <div className="space-y-6">
      {/* Sound Settings */}
      <SettingsSection>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center">
            <Volume2 className="w-5 h-5 text-orange-600" />
          </div>
          <h3 className="font-medium text-gray-900">Sound-Effekte</h3>
        </div>
        <div className="space-y-3">
          {/* Master Toggle */}
          <ToggleRow
            label="Sounds aktiviert"
            checked={settings.soundSettings.enabled}
            onChange={(v) => settings.updateSoundSettings({ enabled: v })}
          />

          {settings.soundSettings.enabled && (
            <>
              {/* Volume Slider */}
              <SliderRow
                label="Lautstärke"
                value={Math.round(settings.soundSettings.volume * 100)}
                onChange={(v) => settings.updateSoundSettings({ volume: v / 100 })}
                min={0}
                max={100}
                step={10}
                unit="%"
                leftLabel="Leise"
                rightLabel="Laut"
              />

              {/* Individual Sound Toggles */}
              <div className="space-y-2">
                {[
                  { key: 'taskComplete' as const, label: 'Aufgabe erledigt', type: 'taskComplete' as SoundType },
                  { key: 'taskDelete' as const, label: 'Aufgabe gelöscht', type: 'taskDelete' as SoundType },
                  { key: 'timerStart' as const, label: 'Timer gestartet', type: 'timerStart' as SoundType },
                  { key: 'timerStop' as const, label: 'Timer gestoppt', type: 'timerStop' as SoundType },
                  { key: 'meetingReminder' as const, label: 'Meeting-Erinnerung', type: 'meetingReminder' as SoundType },
                ].map(({ key, label, type }) => (
                  <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl group">
                    <ToggleRow
                      label={label}
                      checked={settings.soundSettings[key]}
                      onChange={(v) => settings.updateSoundSettings({ [key]: v })}
                    />
                    <button
                      onClick={() => handleTestSound(type)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-all opacity-0 group-hover:opacity-100 ml-2 flex-shrink-0"
                      title="Sound testen"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </SettingsSection>

      {/* Notification Settings */}
      <SettingsSection>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-pink-50 rounded-xl flex items-center justify-center">
            <Bell className="w-5 h-5 text-pink-600" />
          </div>
          <h3 className="font-medium text-gray-900">Benachrichtigungen</h3>
        </div>
        <div className="space-y-3">
          {/* Master Toggle */}
          <ToggleRow
            label="Benachrichtigungen aktiviert"
            checked={settings.notificationSettings.enabled}
            onChange={(v) => settings.updateNotificationSettings({ enabled: v })}
          />

          {settings.notificationSettings.enabled && (
            <>
              <ToggleRow
                label="Meeting-Erinnerungen"
                checked={settings.notificationSettings.meetingReminders}
                onChange={(v) => settings.updateNotificationSettings({ meetingReminders: v })}
              />

              {settings.notificationSettings.meetingReminders && (
                <div className="p-3 bg-gray-50 rounded-xl">
                  <label className="block text-xs text-gray-500 mb-2">Erinnern vor Meeting</label>
                  <div className="flex flex-wrap gap-2">
                    {[30, 15, 10, 5, 1].map((minutes) => (
                      <button
                        key={minutes}
                        onClick={() => toggleReminderInterval(minutes)}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                          settings.notificationSettings.reminderIntervals.includes(minutes)
                            ? 'bg-gray-900 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                        }`}
                      >
                        {minutes} Min
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </SettingsSection>

      {/* Intelligente Hinweise — einfacher Toggle */}
      <SettingsSection>
        <ToggleRow
          label="Intelligente Hinweise"
          description="Verschobene Aufgaben, Deadlines, Kundenerkennung"
          checked={isAnyPatternEnabled()}
          onChange={(v) => setAllPatternsEnabled(v)}
          icon={
            <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-violet-600" />
            </div>
          }
        />
        {settings.expertModeSettings?.enabled && isAnyPatternEnabled() && (
          <p className="text-xs text-gray-400 mt-3 ml-12">
            Einzelne Muster konfigurieren: Experten-Tools &rarr; Hinweise
          </p>
        )}
      </SettingsSection>
    </div>
  );

  const renderPrivacyTab = () => (
    <div className="space-y-6">
      {/* DSGVO Übersicht */}
      <SettingsSection className="!bg-gradient-to-br from-indigo-50 to-purple-50 !border-indigo-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">DSGVO-Konformität</h3>
            <p className="text-xs text-gray-500">Datenschutz-Grundverordnung (EU) 2016/679</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-white/70 rounded-xl">
            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <Check className="w-3.5 h-3.5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">Lokale Datenspeicherung</p>
              <p className="text-xs text-gray-500 mt-0.5">Alle deine Daten werden ausschließlich lokal auf deinem Mac in der App gespeichert. Es findet keine Übertragung an Server statt.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-white/70 rounded-xl">
            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <Check className="w-3.5 h-3.5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">Keine Registrierung erforderlich</p>
              <p className="text-xs text-gray-500 mt-0.5">Tally benötigt kein Konto. Du musst keine persönlichen Daten angeben, um die App zu nutzen.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-white/70 rounded-xl">
            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <Check className="w-3.5 h-3.5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">Kein Tracking oder Analytics</p>
              <p className="text-xs text-gray-500 mt-0.5">Tally sammelt keine Nutzungsdaten, erstellt keine Profile und trackt dein Verhalten nicht.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-white/70 rounded-xl">
            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <Check className="w-3.5 h-3.5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">Volle Datenkontrolle</p>
              <p className="text-xs text-gray-500 mt-0.5">Du kannst deine Daten jederzeit exportieren oder vollständig löschen. Die Kontrolle liegt bei dir.</p>
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* Externe Dienste */}
      <SettingsSection>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
            <Globe className="w-5 h-5 text-amber-600" />
          </div>
          <h3 className="font-medium text-gray-900">Externe Dienste (Opt-in)</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Folgende optionale Funktionen erfordern eine Verbindung zu externen Diensten. Diese sind standardmäßig deaktiviert und können nur mit deiner ausdrücklichen Zustimmung aktiviert werden.
        </p>
        <div className="space-y-4">
          {/* External Logos Toggle */}
          <div className="p-4 bg-gray-50 rounded-xl">
            <ToggleRow
              label="Firmenlogos automatisch laden"
              description="Lädt Logos basierend auf der Website-Domain deiner Kunden."
              checked={settings.privacySettings?.allowExternalLogos ?? false}
              onChange={(v) => settings.updatePrivacySettings({ allowExternalLogos: v })}
            />

            {/* Detaillierte Info Box */}
            <div className="mt-3 p-3 bg-amber-50 rounded-lg">
              <p className="text-xs font-medium text-amber-800 mb-2">Bei Aktivierung werden folgende Daten übertragen:</p>
              <ul className="text-xs text-amber-700 space-y-1 ml-3 list-disc">
                <li>Domain-Namen deiner Kunden (z.B. "example.com")</li>
                <li>Deine IP-Adresse (technisch notwendig)</li>
              </ul>
              <p className="text-xs text-amber-700 mt-2">
                <strong>Empfänger:</strong> DuckDuckGo, Google (Favicon-Dienste)
              </p>
              <p className="text-xs text-amber-700 mt-1">
                <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. a DSGVO (Einwilligung)
              </p>
              {settings.privacySettings?.externalLogosConsentDate && (
                <p className="text-xs text-green-600 mt-2 font-medium">
                  Zustimmung erteilt am: {new Date(settings.privacySettings.externalLogosConsentDate).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </div>

          {/* Update Check Info */}
          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="flex items-start gap-3">
              <Info className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-sm font-medium text-gray-700">Update-Prüfung</span>
                <p className="text-xs text-gray-500 mt-1">
                  Bei der manuellen Prüfung auf Updates wird eine Anfrage an GitHub gesendet, um die neueste Version abzurufen. Dabei wird deine IP-Adresse übertragen.
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  <strong>Empfänger:</strong> GitHub Inc. (raw.githubusercontent.com)
                </p>
              </div>
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* Code Splitting Info */}
      <SettingsSection>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
            <Info className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="font-medium text-gray-900">Lokales Code-Splitting</h3>
        </div>
        <p className="text-sm text-gray-600 mb-3">
          Um die initiale Ladezeit zu verkürzen, werden einige Funktionen erst bei Bedarf geladen:
        </p>
        <div className="space-y-2">
          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <Check className="w-3.5 h-3.5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">Dokument-Editor</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Der Editor für Dokumente wird erst geladen, wenn du ein Dokument öffnest oder erstellst. Dies spart ca. 300 KB beim ersten App-Start.
              </p>
            </div>
          </div>
        </div>
        <div className="mt-3 p-3 bg-green-50 rounded-lg">
          <p className="text-xs text-green-700">
            <strong>Keine externe Datenübertragung:</strong> Alle nachgeladenen Module sind Teil der App und werden lokal von deinem Gerät geladen – es werden keine Daten ins Internet gesendet.
          </p>
        </div>
      </SettingsSection>

      {/* Deine Rechte */}
      <SettingsSection>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
            <Info className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="font-medium text-gray-900">Deine Rechte nach DSGVO</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 bg-gray-50 rounded-xl">
            <p className="text-sm font-medium text-gray-700">Auskunftsrecht</p>
            <p className="text-xs text-gray-500 mt-0.5">Du kannst jederzeit deine Daten über den JSON-Export einsehen.</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl">
            <p className="text-sm font-medium text-gray-700">Recht auf Löschung</p>
            <p className="text-xs text-gray-500 mt-0.5">Du kannst alle Daten jederzeit vollständig löschen.</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl">
            <p className="text-sm font-medium text-gray-700">Recht auf Datenübertragbarkeit</p>
            <p className="text-xs text-gray-500 mt-0.5">Exportiere deine Daten als JSON oder CSV.</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl">
            <p className="text-sm font-medium text-gray-700">Widerrufsrecht</p>
            <p className="text-xs text-gray-500 mt-0.5">Einwilligungen können jederzeit widerrufen werden.</p>
          </div>
        </div>
      </SettingsSection>

      {/* Danger Zone */}
      <section className="border border-red-200 rounded-2xl p-5 bg-red-50/30">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <h3 className="font-medium text-red-700">Gefahrenzone</h3>
        </div>
        <p className="text-sm text-red-600/70 mb-4">
          Diese Aktion kann nicht rückgängig gemacht werden. Alle Aufgaben, Kunden, Tags und Einstellungen werden dauerhaft gelöscht.
        </p>
        <button
          onClick={handleClearAllData}
          className="px-4 py-2.5 bg-red-100 text-red-700 rounded-xl hover:bg-red-200 transition-all duration-200 text-sm font-medium btn-press"
        >
          Alle Daten löschen
        </button>
        <p className="text-xs text-red-500/60 mt-3">
          Entspricht dem Recht auf Löschung nach Art. 17 DSGVO
        </p>
      </section>
    </div>
  );

  const renderTrashTab = () => {
    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return `Heute um ${date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
      } else if (diffDays === 1) {
        return `Gestern um ${date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
      } else if (diffDays < 7) {
        return `vor ${diffDays} Tagen`;
      } else {
        return date.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
      }
    };

    const getDaysUntilDeletion = (deletedAt: string) => {
      const deletedDate = new Date(deletedAt);
      const deleteDate = new Date(deletedDate);
      deleteDate.setDate(deleteDate.getDate() + 7);
      const now = new Date();
      const diffMs = deleteDate.getTime() - now.getTime();
      return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    };

    return (
      <div className="space-y-6">
        {/* Info Banner */}
        <SettingsSection className="!bg-gradient-to-br from-amber-50 to-orange-50 !border-amber-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Papierkorb</h3>
              <p className="text-xs text-gray-500">
                {deletedTasks.length === 0
                  ? 'Keine gelöschten Aufgaben'
                  : `${deletedTasks.length} ${deletedTasks.length === 1 ? 'Aufgabe' : 'Aufgaben'} im Papierkorb`
                }
              </p>
            </div>
          </div>
          <p className="text-sm text-amber-700">
            Gelöschte Aufgaben werden nach 7 Tagen automatisch endgültig entfernt.
          </p>
        </SettingsSection>

        {/* Empty Trash Button */}
        {deletedTasks.length > 0 && (
          <div className="flex justify-end">
            <button
              onClick={() => {
                if (confirm('Papierkorb endgültig leeren? Diese Aktion kann nicht rückgängig gemacht werden.')) {
                  emptyTrash();
                }
              }}
              className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl transition-all text-sm font-medium"
            >
              <Trash2 className="w-4 h-4" />
              Papierkorb leeren
            </button>
          </div>
        )}

        {/* Deleted Tasks List */}
        {deletedTasks.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Trash2 className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 text-sm">Der Papierkorb ist leer</p>
            <p className="text-gray-400 text-xs mt-1">
              Gelöschte Aufgaben erscheinen hier
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {deletedTasks
              .sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime())
              .map((task) => {
                const daysLeft = getDaysUntilDeletion(task.deletedAt);
                return (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 hover:shadow-sm transition-all group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {task.title}
                        </span>
                        {task.isMeeting && (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-600 text-xs rounded-full">
                            Meeting
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-400">
                          Gelöscht {formatDate(task.deletedAt)}
                        </span>
                        <span className="text-xs text-amber-500">
                          &bull; {daysLeft === 0 ? 'Wird heute gelöscht' : `${daysLeft} ${daysLeft === 1 ? 'Tag' : 'Tage'} verbleibend`}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => restoreTask(task.id)}
                        className="px-3 py-1.5 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg text-sm font-medium transition-all"
                      >
                        Wiederherstellen
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Aufgabe endgültig löschen?')) {
                            permanentlyDeleteTask(task.id);
                          }
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    );
  };

  const renderAboutTab = () => (
    <div className="space-y-6">
      {/* App Updates */}
      <SettingsSection>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-gray-900">App Updates</h3>
            <p className="text-xs text-gray-500">Version {settings.appVersion}</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <div>
              <span className="text-sm text-gray-700">Aktuell installiert</span>
              <p className="text-xs text-gray-400">
                {settings.lastUpdateCheck
                  ? `Zuletzt geprüft: ${new Date(settings.lastUpdateCheck).toLocaleDateString('de-DE', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}`
                  : 'Noch nicht nach Updates gesucht'
                }
              </p>
            </div>
            <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
              v{settings.appVersion}
            </span>
          </div>
          <button
            onClick={() => setShowUpdateModal(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-all text-sm font-medium text-gray-700"
          >
            <RefreshCw className="w-4 h-4" />
            Nach Updates suchen
          </button>
        </div>
      </SettingsSection>

      {/* Onboarding */}
      <SettingsSection>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-cyan-50 rounded-xl flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-cyan-600" />
          </div>
          <h3 className="font-medium text-gray-900">Einführung</h3>
        </div>
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Lerne die wichtigsten Funktionen von Tally kennen – perfekt für Einsteiger oder zur Auffrischung.
          </p>
          <button
            onClick={handleReplayOnboarding}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl hover:from-cyan-600 hover:to-blue-700 transition-all text-sm font-medium"
          >
            <Sparkles className="w-4 h-4" />
            Einführung erneut ansehen
          </button>
          {settings.onboardingCompletedAt && (
            <p className="text-xs text-gray-400 text-center">
              Zuletzt abgeschlossen: {new Date(settings.onboardingCompletedAt).toLocaleDateString('de-DE')}
            </p>
          )}
        </div>
      </SettingsSection>

      {/* Feedback */}
      <SettingsSection>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-pink-50 rounded-xl flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-pink-600" />
          </div>
          <h3 className="font-medium text-gray-900">Feedback & Support</h3>
        </div>
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Hast du Ideen, Probleme oder Wünsche? Dein Feedback hilft uns, Tally besser zu machen!
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              onClick={() => setFeedbackType('feature')}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl hover:bg-amber-50 hover:border-amber-200 transition-all text-sm font-medium text-gray-700"
            >
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <span>Feature-Idee</span>
            </button>
            <button
              onClick={() => setFeedbackType('bug')}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl hover:bg-red-50 hover:border-red-200 transition-all text-sm font-medium text-gray-700"
            >
              <Bug className="w-4 h-4 text-red-500" />
              <span>Bug melden</span>
            </button>
            <button
              onClick={() => setFeedbackType('feedback')}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl hover:bg-pink-50 hover:border-pink-200 transition-all text-sm font-medium text-gray-700"
            >
              <Heart className="w-4 h-4 text-pink-500" />
              <span>Feedback</span>
            </button>
          </div>
          <a
            href="https://github.com/Querbox/tally-app/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all text-sm font-medium"
          >
            <ExternalLink className="w-4 h-4" />
            GitHub Issues öffnen
          </a>
        </div>
      </SettingsSection>

      {/* Keyboard Shortcuts — dynamisch aus zentraler Config */}
      <SettingsSection>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center">
            <Keyboard className="w-5 h-5 text-gray-600" />
          </div>
          <h3 className="font-medium text-gray-900">Tastaturkürzel</h3>
        </div>
        <div className="space-y-2">
          {getShortcutsForSettings().map((shortcut) => (
            <div
              key={shortcut.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
            >
              <span className="text-sm text-gray-700">{shortcut.label}</span>
              <kbd className="px-2 py-1 text-xs font-mono bg-white border border-gray-200 rounded text-gray-600">
                {shortcut.displayKey}
              </kbd>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3 text-center">
          Drücke <kbd className="px-1.5 py-0.5 bg-gray-50 border border-gray-200 rounded">?</kbd> um alle Kürzel anzuzeigen
        </p>
      </SettingsSection>
    </div>
  );

  const renderExpertTab = () => (
    <div className="space-y-6">
      {/* Info Banner */}
      <SettingsSection className="!bg-gradient-to-br from-purple-50 to-indigo-50 !border-purple-100">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center">
            <Zap className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Experten-Tools</h3>
            <p className="text-xs text-gray-500">Erweiterte Funktionen für Power-User</p>
          </div>
        </div>
        <p className="text-sm text-purple-700">
          Hier findest du alle erweiterten Features die du im Experten-Modus aktiviert hast.
          Aktiviere oder deaktiviere einzelne Features unter "Allgemein &rarr; Experten-Modus".
        </p>
      </SettingsSection>

      {/* Custom Shortcuts */}
      {settings.expertModeSettings?.customShortcuts && (
        <CustomShortcutsEditor />
      )}

      {/* Advanced Filters */}
      {settings.expertModeSettings?.advancedFilters && (
        <AdvancedFiltersEditor />
      )}

      {/* Automations */}
      {settings.expertModeSettings?.automations && (
        <AutomationsEditor />
      )}

      {/* Task Templates */}
      {settings.expertModeSettings?.taskTemplates && (
        <TaskTemplatesEditor />
      )}

      {/* Intelligente Hinweise — Detailkonfiguration */}
      {isAnyPatternEnabled() && (
        <SettingsSection>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Intelligente Hinweise</h3>
              <p className="text-xs text-gray-500">Verhalten pro Muster konfigurieren</p>
            </div>
          </div>
          <div className="space-y-3">
            {PATTERN_SETTINGS_CONFIG.map(({ type, label, description }) => {
              const pref = patternPreferences.find((p) => p.patternType === type);
              const currentAutonomy = pref?.autonomy ?? 'ask';
              return (
                <div key={type} className="p-3 bg-gray-50 rounded-xl">
                  <div className="mb-2">
                    <span className="text-sm text-gray-700 font-medium">{label}</span>
                    <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                  </div>
                  <div className="flex gap-1">
                    {(['auto', 'ask', 'off'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => updatePatternPreference(type, { autonomy: mode })}
                        className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          currentAutonomy === mode
                            ? mode === 'auto'
                              ? 'bg-green-100 text-green-700'
                              : mode === 'ask'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-200 text-gray-600'
                            : 'bg-white text-gray-400 hover:bg-gray-100'
                        }`}
                      >
                        {mode === 'auto' ? 'Automatisch' : mode === 'ask' ? 'Fragen' : 'Aus'}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </SettingsSection>
      )}

      {/* Keine Features aktiviert */}
      {!settings.expertModeSettings?.customShortcuts &&
       !settings.expertModeSettings?.advancedFilters &&
       !settings.expertModeSettings?.automations &&
       !settings.expertModeSettings?.taskTemplates &&
       !isAnyPatternEnabled() && (
        <div className="text-center py-12">
          <Zap className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Keine Experten-Features aktiviert</p>
          <p className="text-gray-400 text-xs mt-2">
            Gehe zu "Allgemein &rarr; Experten-Modus" um Features zu aktivieren
          </p>
        </div>
      )}
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return renderGeneralTab();
      case 'tasks':
        return renderTasksTab();
      case 'notifications':
        return renderNotificationsTab();
      case 'expert':
        return renderExpertTab();
      case 'privacy':
        return renderPrivacyTab();
      case 'trash':
        return renderTrashTab();
      case 'about':
        return renderAboutTab();
      default:
        return null;
    }
  };

  // =========================================================================
  // Modal Shell — sidebar navigation layout
  // =========================================================================

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center animate-fade-in"
      style={{ zIndex: 9999 }}
    >
      <div className="bg-white rounded-2xl w-full max-w-[1200px] max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-scale-in mx-6">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900">Einstellungen</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-all duration-200 btn-press"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body: Sidebar + Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Navigation — 200px */}
          <nav className="w-[200px] flex-shrink-0 border-r border-gray-100 py-4 px-3 overflow-y-auto">
            <div className="space-y-1">
              {TABS
                .filter(tab => !tab.expertOnly || settings.expertModeSettings?.enabled)
                .map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? tab.expertOnly
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-900 text-white'
                          : tab.expertOnly
                            ? 'text-purple-600 hover:bg-purple-50'
                            : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{tab.label}</span>
                    </button>
                  );
                })}
            </div>
          </nav>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6">
            {renderTabContent()}
          </div>
        </div>
      </div>

      {/* Update Modal */}
      {showUpdateModal && (
        <UpdateModal
          onClose={() => setShowUpdateModal(false)}
          onShowWhatsNew={() => {
            setShowUpdateModal(false);
            setShowWhatsNew(true);
          }}
        />
      )}

      {/* What's New Modal */}
      {showWhatsNew && (
        <WhatsNewModal
          onClose={() => setShowWhatsNew(false)}
          currentVersion={CURRENT_VERSION}
          lastSeenVersion={null}
        />
      )}

      {/* Feedback Modal */}
      {feedbackType && (
        <FeedbackModal
          feedbackType={feedbackType}
          onClose={() => setFeedbackType(null)}
        />
      )}

      {/* Onboarding Modal */}
      {showOnboarding && (
        <OnboardingModal
          onComplete={() => {
            setShowOnboarding(false);
            settings.completeOnboarding();
          }}
        />
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
}
