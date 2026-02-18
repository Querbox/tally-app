import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useShallow } from 'zustand/react/shallow';
import { useSettingsStore } from '../stores/settingsStore';
import { useTaskStore } from '../stores/taskStore';
import { usePatternStore } from '../stores/patternStore';
import type { PatternType } from '../types';
import { playGlobalSound, type SoundType } from '../hooks/useSounds';
import { UpdateModal } from '../components/modals/UpdateModal';
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
} from 'lucide-react';
import type { ThemeMode } from '../stores/settingsStore';
import { PRESET_COLORS } from '../constants/colors';
import { getShortcutsForSettings } from '../config/shortcuts';

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
  const [showOnboarding, setShowOnboarding] = useState(false);

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

  // Tab Content Renderers
  const renderGeneralTab = () => (
    <div className="space-y-6">
      {/* Theme Settings */}
      <section className="bg-gray-50 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-gray-200 rounded-xl flex items-center justify-center">
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
        <div className="flex gap-2">
          {[
            { mode: 'light' as ThemeMode, icon: Sun, label: 'Hell' },
            { mode: 'dark' as ThemeMode, icon: Moon, label: 'Dunkel' },
            { mode: 'system' as ThemeMode, icon: Monitor, label: 'System' },
          ].map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => settings.setThemeMode(mode)}
              className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${
                settings.themeMode === mode
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Work Hours */}
      <section className="bg-gray-50 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
            <Clock className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="font-medium text-gray-900">Arbeitszeiten</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Arbeitsbeginn</label>
            <input
              type="time"
              value={settings.workStartTime}
              onChange={(e) => settings.updateSettings({ workStartTime: e.target.value })}
              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/10 transition-all duration-200"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Arbeitsende</label>
            <input
              type="time"
              value={settings.workEndTime}
              onChange={(e) => settings.updateSettings({ workEndTime: e.target.value })}
              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/10 transition-all duration-200"
            />
          </div>
        </div>

        {/* Soll-Arbeitszeit */}
        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200">
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Soll-Stunden pro Woche</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="60"
                step="1"
                value={settings.weeklyWorkHours}
                onChange={(e) => settings.updateSettings({ weeklyWorkHours: parseInt(e.target.value) || 40 })}
                className="w-20 px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 text-center"
              />
              <span className="text-sm text-gray-500">Stunden</span>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Arbeitstage pro Woche</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="7"
                step="1"
                value={settings.workDaysPerWeek}
                onChange={(e) => settings.updateSettings({ workDaysPerWeek: parseInt(e.target.value) || 5 })}
                className="w-20 px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 text-center"
              />
              <span className="text-sm text-gray-500">Tage</span>
            </div>
          </div>
        </div>
      </section>

      {/* Expert Mode */}
      <section className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-5 border border-purple-100">
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
          <label className="flex items-center justify-between p-3 bg-white/70 rounded-xl hover:bg-white transition-all duration-200 cursor-pointer">
            <div className="flex-1">
              <span className="text-sm text-gray-700 font-medium">Experten-Modus aktivieren</span>
              <p className="text-xs text-gray-500 mt-0.5">
                Zeigt erweiterte Funktionen wie Prioritäten-Flags, Timer-Button, Filter und Sortierung
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.expertModeSettings?.enabled ?? false}
              onChange={(e) => settings.updateExpertModeSettings({ enabled: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 ml-3"
            />
          </label>

          {/* Feature-Toggles - nur sichtbar wenn Experten-Modus aktiv */}
          {settings.expertModeSettings?.enabled && (
            <div className="space-y-2 pt-2 border-t border-purple-200/50">
              <p className="text-xs text-purple-600 font-medium px-1">Erweiterte Features:</p>

              {/* Custom Shortcuts */}
              <label className="flex items-center justify-between p-3 bg-white/60 rounded-xl hover:bg-white transition-all duration-200 cursor-pointer">
                <div className="flex-1">
                  <span className="text-sm text-gray-700 font-medium flex items-center gap-2">
                    <Keyboard className="w-4 h-4 text-purple-500" />
                    Eigene Tastenkürzel
                  </span>
                  <p className="text-xs text-gray-500 mt-0.5 ml-6">
                    Definiere eigene Shortcuts für häufige Aktionen
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.expertModeSettings?.customShortcuts ?? false}
                  onChange={(e) => settings.updateExpertModeSettings({ customShortcuts: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 ml-3"
                />
              </label>

              {/* Advanced Filters */}
              <label className="flex items-center justify-between p-3 bg-white/60 rounded-xl hover:bg-white transition-all duration-200 cursor-pointer">
                <div className="flex-1">
                  <span className="text-sm text-gray-700 font-medium flex items-center gap-2">
                    <ListChecks className="w-4 h-4 text-blue-500" />
                    Erweiterte Filter
                  </span>
                  <p className="text-xs text-gray-500 mt-0.5 ml-6">
                    Komplexe Filter mit UND/ODER-Logik, gespeicherte Filter
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.expertModeSettings?.advancedFilters ?? false}
                  onChange={(e) => settings.updateExpertModeSettings({ advancedFilters: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 ml-3"
                />
              </label>

              {/* Automations */}
              <label className="flex items-center justify-between p-3 bg-white/60 rounded-xl hover:bg-white transition-all duration-200 cursor-pointer">
                <div className="flex-1">
                  <span className="text-sm text-gray-700 font-medium flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-green-500" />
                    Automatisierungen
                  </span>
                  <p className="text-xs text-gray-500 mt-0.5 ml-6">
                    Regeln für automatische Aktionen (z.B. Priorität setzen)
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.expertModeSettings?.automations ?? false}
                  onChange={(e) => settings.updateExpertModeSettings({ automations: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 ml-3"
                />
              </label>

              {/* Bulk Operations */}
              <label className="flex items-center justify-between p-3 bg-white/60 rounded-xl hover:bg-white transition-all duration-200 cursor-pointer">
                <div className="flex-1">
                  <span className="text-sm text-gray-700 font-medium flex items-center gap-2">
                    <ListChecks className="w-4 h-4 text-orange-500" />
                    Massenbearbeitung
                  </span>
                  <p className="text-xs text-gray-500 mt-0.5 ml-6">
                    Mehrere Aufgaben gleichzeitig bearbeiten
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.expertModeSettings?.bulkOperations ?? false}
                  onChange={(e) => settings.updateExpertModeSettings({ bulkOperations: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 ml-3"
                />
              </label>

              {/* Detailed Analytics */}
              <label className="flex items-center justify-between p-3 bg-white/60 rounded-xl hover:bg-white transition-all duration-200 cursor-pointer">
                <div className="flex-1">
                  <span className="text-sm text-gray-700 font-medium flex items-center gap-2">
                    <Target className="w-4 h-4 text-cyan-500" />
                    Detaillierte Statistiken
                  </span>
                  <p className="text-xs text-gray-500 mt-0.5 ml-6">
                    Erweiterte Produktivitäts-Analysen und Trends
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.expertModeSettings?.detailedAnalytics ?? false}
                  onChange={(e) => settings.updateExpertModeSettings({ detailedAnalytics: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 ml-3"
                />
              </label>

              {/* Task Templates */}
              <label className="flex items-center justify-between p-3 bg-white/60 rounded-xl hover:bg-white transition-all duration-200 cursor-pointer">
                <div className="flex-1">
                  <span className="text-sm text-gray-700 font-medium flex items-center gap-2">
                    <Download className="w-4 h-4 text-pink-500" />
                    Aufgaben-Templates
                  </span>
                  <p className="text-xs text-gray-500 mt-0.5 ml-6">
                    Vorlagen für wiederkehrende Aufgaben speichern
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.expertModeSettings?.taskTemplates ?? false}
                  onChange={(e) => settings.updateExpertModeSettings({ taskTemplates: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 ml-3"
                />
              </label>
            </div>
          )}
        </div>
      </section>

      {/* Calendar Settings */}
      <section className="bg-gray-50 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
            <Calendar className="w-5 h-5 text-indigo-600" />
          </div>
          <h3 className="font-medium text-gray-900">Kalender</h3>
        </div>
        <div className="space-y-3">
          <label className="flex items-center justify-between p-3 bg-white rounded-xl hover:bg-gray-50 transition-all duration-200 cursor-pointer">
            <div>
              <span className="text-sm text-gray-700 font-medium">Wochenende anzeigen</span>
              <p className="text-xs text-gray-400 mt-0.5">Samstag und Sonntag in der Wochenansicht</p>
            </div>
            <input
              type="checkbox"
              checked={settings.showWeekends}
              onChange={(e) => settings.updateSettings({ showWeekends: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300"
            />
          </label>
        </div>
      </section>

      {/* Export/Import */}
      <section className="bg-gray-50 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
            <Download className="w-5 h-5 text-emerald-600" />
          </div>
          <h3 className="font-medium text-gray-900">Daten exportieren / importieren</h3>
        </div>
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => handleExportData('json')}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all text-sm font-medium text-gray-700"
            >
              <Download className="w-4 h-4" />
              JSON Export
            </button>
            <button
              onClick={() => handleExportData('csv')}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all text-sm font-medium text-gray-700"
            >
              <Download className="w-4 h-4" />
              CSV Export
            </button>
          </div>
          <label className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all text-sm font-medium text-gray-700 cursor-pointer">
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
      </section>
    </div>
  );

  const renderTasksTab = () => (
    <div className="space-y-6">
      {/* Task Settings */}
      <section className="bg-gray-50 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center">
            <ListChecks className="w-5 h-5 text-green-600" />
          </div>
          <h3 className="font-medium text-gray-900">Aufgaben</h3>
        </div>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer p-3 bg-white rounded-xl hover:bg-gray-50 transition-all duration-200">
            <input
              type="checkbox"
              checked={settings.autoCarryOverTasks}
              onChange={(e) => settings.updateSettings({ autoCarryOverTasks: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">Unerledigte Aufgaben automatisch ubertragen</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer p-3 bg-white rounded-xl hover:bg-gray-50 transition-all duration-200">
            <input
              type="checkbox"
              checked={settings.showCompletedTasks}
              onChange={(e) => settings.updateSettings({ showCompletedTasks: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">Erledigte Aufgaben anzeigen</span>
          </label>
          <div className="p-3 bg-white rounded-xl">
            <label className="block text-xs text-gray-500 mb-1.5">Standard-Aufgabendauer</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="5"
                max="480"
                step="5"
                value={settings.defaultTaskDuration}
                onChange={(e) => settings.updateSettings({ defaultTaskDuration: parseInt(e.target.value) || 30 })}
                className="w-20 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 text-center"
              />
              <span className="text-sm text-gray-500">Minuten</span>
            </div>
          </div>
        </div>
      </section>

      {/* Focus Timer Settings */}
      <section className="bg-gray-50 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center">
            <Target className="w-5 h-5 text-purple-600" />
          </div>
          <h3 className="font-medium text-gray-900">Focus Timer</h3>
        </div>
        <div className="space-y-4">
          {/* Timer Durations */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-white rounded-xl">
              <label className="block text-xs text-gray-500 mb-1.5">Focus-Zeit</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={settings.focusTimerSettings.focusDuration}
                  onChange={(e) => settings.updateFocusTimerSettings({ focusDuration: parseInt(e.target.value) || 25 })}
                  className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-center text-sm"
                />
                <span className="text-xs text-gray-500">Min</span>
              </div>
            </div>
            <div className="p-3 bg-white rounded-xl">
              <label className="block text-xs text-gray-500 mb-1.5">Kurze Pause</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={settings.focusTimerSettings.shortBreakDuration}
                  onChange={(e) => settings.updateFocusTimerSettings({ shortBreakDuration: parseInt(e.target.value) || 5 })}
                  className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-center text-sm"
                />
                <span className="text-xs text-gray-500">Min</span>
              </div>
            </div>
            <div className="p-3 bg-white rounded-xl">
              <label className="block text-xs text-gray-500 mb-1.5">Lange Pause</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={settings.focusTimerSettings.longBreakDuration}
                  onChange={(e) => settings.updateFocusTimerSettings({ longBreakDuration: parseInt(e.target.value) || 15 })}
                  className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-center text-sm"
                />
                <span className="text-xs text-gray-500">Min</span>
              </div>
            </div>
            <div className="p-3 bg-white rounded-xl">
              <label className="block text-xs text-gray-500 mb-1.5">Sessions bis Pause</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={settings.focusTimerSettings.sessionsUntilLongBreak}
                  onChange={(e) => settings.updateFocusTimerSettings({ sessionsUntilLongBreak: parseInt(e.target.value) || 4 })}
                  className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-center text-sm"
                />
                <span className="text-xs text-gray-500">×</span>
              </div>
            </div>
          </div>

          {/* Auto-start options */}
          <div className="space-y-2">
            <label className="flex items-center justify-between p-3 bg-white rounded-xl hover:bg-gray-50 transition-all cursor-pointer">
              <span className="text-sm text-gray-700">Pausen automatisch starten</span>
              <input
                type="checkbox"
                checked={settings.focusTimerSettings.autoStartBreaks}
                onChange={(e) => settings.updateFocusTimerSettings({ autoStartBreaks: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300"
              />
            </label>
            <label className="flex items-center justify-between p-3 bg-white rounded-xl hover:bg-gray-50 transition-all cursor-pointer">
              <span className="text-sm text-gray-700">Focus nach Pause automatisch starten</span>
              <input
                type="checkbox"
                checked={settings.focusTimerSettings.autoStartFocus}
                onChange={(e) => settings.updateFocusTimerSettings({ autoStartFocus: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300"
              />
            </label>
          </div>
        </div>
      </section>

      {/* Tags */}
      <section className="bg-gray-50 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center">
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
                className="flex items-center justify-between p-3 bg-white rounded-xl group hover:shadow-sm transition-all duration-200"
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
        <div className="bg-white rounded-xl p-3 border border-gray-100">
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
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/10 transition-all duration-200 text-sm"
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
      </section>
    </div>
  );

  const renderNotificationsTab = () => (
    <div className="space-y-6">
      {/* Sound Settings */}
      <section className="bg-gray-50 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center">
            <Volume2 className="w-5 h-5 text-orange-600" />
          </div>
          <h3 className="font-medium text-gray-900">Sound-Effekte</h3>
        </div>
        <div className="space-y-3">
          {/* Master Toggle */}
          <label className="flex items-center justify-between p-3 bg-white rounded-xl hover:bg-gray-50 transition-all duration-200">
            <span className="text-sm text-gray-700 font-medium">Sounds aktiviert</span>
            <input
              type="checkbox"
              checked={settings.soundSettings.enabled}
              onChange={(e) => settings.updateSoundSettings({ enabled: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300"
            />
          </label>

          {settings.soundSettings.enabled && (
            <>
              {/* Volume Slider */}
              <div className="p-3 bg-white rounded-xl">
                <label className="block text-xs text-gray-500 mb-2">Lautstärke</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.soundSettings.volume}
                  onChange={(e) => settings.updateSoundSettings({ volume: parseFloat(e.target.value) })}
                  className="w-full accent-gray-900"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>Leise</span>
                  <span>{Math.round(settings.soundSettings.volume * 100)}%</span>
                  <span>Laut</span>
                </div>
              </div>

              {/* Individual Sound Toggles */}
              <div className="space-y-2">
                {[
                  { key: 'taskComplete' as const, label: 'Aufgabe erledigt', type: 'taskComplete' as SoundType },
                  { key: 'taskDelete' as const, label: 'Aufgabe gelöscht', type: 'taskDelete' as SoundType },
                  { key: 'timerStart' as const, label: 'Timer gestartet', type: 'timerStart' as SoundType },
                  { key: 'timerStop' as const, label: 'Timer gestoppt', type: 'timerStop' as SoundType },
                  { key: 'meetingReminder' as const, label: 'Meeting-Erinnerung', type: 'meetingReminder' as SoundType },
                ].map(({ key, label, type }) => (
                  <div key={key} className="flex items-center justify-between p-3 bg-white rounded-xl group">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={settings.soundSettings[key]}
                        onChange={(e) => settings.updateSoundSettings({ [key]: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">{label}</span>
                    </div>
                    <button
                      onClick={() => handleTestSound(type)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all opacity-0 group-hover:opacity-100"
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
      </section>

      {/* Notification Settings */}
      <section className="bg-gray-50 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-pink-100 rounded-xl flex items-center justify-center">
            <Bell className="w-5 h-5 text-pink-600" />
          </div>
          <h3 className="font-medium text-gray-900">Benachrichtigungen</h3>
        </div>
        <div className="space-y-3">
          {/* Master Toggle */}
          <label className="flex items-center justify-between p-3 bg-white rounded-xl hover:bg-gray-50 transition-all duration-200">
            <span className="text-sm text-gray-700 font-medium">Benachrichtigungen aktiviert</span>
            <input
              type="checkbox"
              checked={settings.notificationSettings.enabled}
              onChange={(e) => settings.updateNotificationSettings({ enabled: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300"
            />
          </label>

          {settings.notificationSettings.enabled && (
            <>
              <label className="flex items-center justify-between p-3 bg-white rounded-xl hover:bg-gray-50 transition-all duration-200">
                <span className="text-sm text-gray-700">Meeting-Erinnerungen</span>
                <input
                  type="checkbox"
                  checked={settings.notificationSettings.meetingReminders}
                  onChange={(e) => settings.updateNotificationSettings({ meetingReminders: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300"
                />
              </label>

              {settings.notificationSettings.meetingReminders && (
                <div className="p-3 bg-white rounded-xl">
                  <label className="block text-xs text-gray-500 mb-2">Erinnern vor Meeting</label>
                  <div className="flex flex-wrap gap-2">
                    {[30, 15, 10, 5, 1].map((minutes) => (
                      <button
                        key={minutes}
                        onClick={() => toggleReminderInterval(minutes)}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                          settings.notificationSettings.reminderIntervals.includes(minutes)
                            ? 'bg-gray-900 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
      </section>

      {/* Intelligente Hinweise — einfacher Toggle */}
      <section className="bg-gray-50 rounded-2xl p-5">
        <label className="flex items-center justify-between cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-violet-100 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Intelligente Hinweise</h3>
              <p className="text-xs text-gray-500">Verschobene Aufgaben, Deadlines, Kundenerkennung</p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={isAnyPatternEnabled()}
            onChange={(e) => setAllPatternsEnabled(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 ml-3"
          />
        </label>
        {settings.expertModeSettings?.enabled && isAnyPatternEnabled() && (
          <p className="text-xs text-gray-400 mt-3 ml-12">
            Einzelne Muster konfigurieren: Experten-Tools → Hinweise
          </p>
        )}
      </section>
    </div>
  );

  const renderPrivacyTab = () => (
    <div className="space-y-6">
      {/* DSGVO Übersicht */}
      <section className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-5 border border-indigo-100">
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
              <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">Lokale Datenspeicherung</p>
              <p className="text-xs text-gray-500 mt-0.5">Alle deine Daten werden ausschließlich lokal auf deinem Mac in der App gespeichert. Es findet keine Übertragung an Server statt.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-white/70 rounded-xl">
            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">Keine Registrierung erforderlich</p>
              <p className="text-xs text-gray-500 mt-0.5">Tally benötigt kein Konto. Du musst keine persönlichen Daten angeben, um die App zu nutzen.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-white/70 rounded-xl">
            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">Kein Tracking oder Analytics</p>
              <p className="text-xs text-gray-500 mt-0.5">Tally sammelt keine Nutzungsdaten, erstellt keine Profile und trackt dein Verhalten nicht.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-white/70 rounded-xl">
            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">Volle Datenkontrolle</p>
              <p className="text-xs text-gray-500 mt-0.5">Du kannst deine Daten jederzeit exportieren oder vollständig löschen. Die Kontrolle liegt bei dir.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Externe Dienste */}
      <section className="bg-gray-50 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center">
            <Globe className="w-5 h-5 text-amber-600" />
          </div>
          <h3 className="font-medium text-gray-900">Externe Dienste (Opt-in)</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Folgende optionale Funktionen erfordern eine Verbindung zu externen Diensten. Diese sind standardmäßig deaktiviert und können nur mit deiner ausdrücklichen Zustimmung aktiviert werden.
        </p>
        <div className="space-y-4">
          {/* External Logos Toggle */}
          <div className="p-4 bg-white rounded-xl border border-gray-200">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.privacySettings?.allowExternalLogos ?? false}
                onChange={(e) => settings.updatePrivacySettings({ allowExternalLogos: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 mt-0.5"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-700">Firmenlogos automatisch laden</span>
                <p className="text-xs text-gray-500 mt-1">
                  Lädt Logos basierend auf der Website-Domain deiner Kunden.
                </p>
              </div>
            </label>

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
          <div className="p-4 bg-white rounded-xl border border-gray-200">
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
      </section>

      {/* Code Splitting Info */}
      <section className="bg-gray-50 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
            <Info className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="font-medium text-gray-900">Lokales Code-Splitting</h3>
        </div>
        <p className="text-sm text-gray-600 mb-3">
          Um die initiale Ladezeit zu verkürzen, werden einige Funktionen erst bei Bedarf geladen:
        </p>
        <div className="space-y-2">
          <div className="flex items-start gap-3 p-3 bg-white rounded-xl">
            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
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
      </section>

      {/* Deine Rechte */}
      <section className="bg-gray-50 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
            <Info className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="font-medium text-gray-900">Deine Rechte nach DSGVO</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 bg-white rounded-xl">
            <p className="text-sm font-medium text-gray-700">Auskunftsrecht</p>
            <p className="text-xs text-gray-500 mt-0.5">Du kannst jederzeit deine Daten über den JSON-Export einsehen.</p>
          </div>
          <div className="p-3 bg-white rounded-xl">
            <p className="text-sm font-medium text-gray-700">Recht auf Löschung</p>
            <p className="text-xs text-gray-500 mt-0.5">Du kannst alle Daten jederzeit vollständig löschen.</p>
          </div>
          <div className="p-3 bg-white rounded-xl">
            <p className="text-sm font-medium text-gray-700">Recht auf Datenübertragbarkeit</p>
            <p className="text-xs text-gray-500 mt-0.5">Exportiere deine Daten als JSON oder CSV.</p>
          </div>
          <div className="p-3 bg-white rounded-xl">
            <p className="text-sm font-medium text-gray-700">Widerrufsrecht</p>
            <p className="text-xs text-gray-500 mt-0.5">Einwilligungen können jederzeit widerrufen werden.</p>
          </div>
        </div>
      </section>

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
        <section className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-5 border border-amber-100">
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
        </section>

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
                          • {daysLeft === 0 ? 'Wird heute gelöscht' : `${daysLeft} ${daysLeft === 1 ? 'Tag' : 'Tage'} verbleibend`}
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
      <section className="bg-gray-50 rounded-2xl p-5">
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
          <div className="flex items-center justify-between p-3 bg-white rounded-xl">
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
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all text-sm font-medium text-gray-700"
          >
            <RefreshCw className="w-4 h-4" />
            Nach Updates suchen
          </button>
        </div>
      </section>

      {/* Onboarding */}
      <section className="bg-gray-50 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-cyan-100 rounded-xl flex items-center justify-center">
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
      </section>

      {/* Feedback */}
      <section className="bg-gray-50 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-pink-100 rounded-xl flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-pink-600" />
          </div>
          <h3 className="font-medium text-gray-900">Feedback & Support</h3>
        </div>
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Hast du Ideen, Probleme oder Wünsche? Dein Feedback hilft uns, Tally besser zu machen!
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <a
              href="mailto:feedback@querbox.de?subject=Tally%20Feedback%20-%20Idee&body=Hallo%20Tally-Team%2C%0A%0AIch%20habe%20folgende%20Idee%3A%0A%0A"
              className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-xl hover:bg-amber-50 hover:border-amber-200 transition-all text-sm font-medium text-gray-700 group"
            >
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <span>Feature-Idee</span>
            </a>
            <a
              href="mailto:feedback@querbox.de?subject=Tally%20Feedback%20-%20Bug&body=Hallo%20Tally-Team%2C%0A%0AIch%20habe%20folgenden%20Bug%20gefunden%3A%0A%0ABeschreibung%3A%0A%0ASchritte%20zum%20Reproduzieren%3A%0A1.%0A2.%0A3.%0A%0AErwartetes%20Verhalten%3A%0A%0ATally%20Version%3A%20"
              className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-xl hover:bg-red-50 hover:border-red-200 transition-all text-sm font-medium text-gray-700 group"
            >
              <Bug className="w-4 h-4 text-red-500" />
              <span>Bug melden</span>
            </a>
            <a
              href="mailto:feedback@querbox.de?subject=Tally%20Feedback%20-%20Allgemein&body=Hallo%20Tally-Team%2C%0A%0A"
              className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-xl hover:bg-pink-50 hover:border-pink-200 transition-all text-sm font-medium text-gray-700 group"
            >
              <Heart className="w-4 h-4 text-pink-500" />
              <span>Feedback</span>
            </a>
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
      </section>

      {/* Keyboard Shortcuts - dynamisch aus zentraler Config */}
      <section className="bg-gray-50 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-gray-200 rounded-xl flex items-center justify-center">
            <Keyboard className="w-5 h-5 text-gray-600" />
          </div>
          <h3 className="font-medium text-gray-900">Tastaturkürzel</h3>
        </div>
        <div className="space-y-2">
          {getShortcutsForSettings().map((shortcut) => (
            <div
              key={shortcut.id}
              className="flex items-center justify-between p-3 bg-white rounded-xl"
            >
              <span className="text-sm text-gray-700">{shortcut.label}</span>
              <kbd className="px-2 py-1 text-xs font-mono bg-gray-100 border border-gray-200 rounded text-gray-600">
                {shortcut.displayKey}
              </kbd>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3 text-center">
          Drücke <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded">?</kbd> um alle Kürzel anzuzeigen
        </p>
      </section>
    </div>
  );

  const renderExpertTab = () => (
    <div className="space-y-6">
      {/* Info Banner */}
      <section className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-5 border border-purple-100">
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
          Aktiviere oder deaktiviere einzelne Features unter "Allgemein → Experten-Modus".
        </p>
      </section>

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
        <section className="bg-gray-50 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-violet-100 rounded-xl flex items-center justify-center">
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
                <div key={type} className="p-3 bg-white rounded-xl">
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
                            : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
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
        </section>
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
            Gehe zu "Allgemein → Experten-Modus" um Features zu aktivieren
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

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center animate-fade-in"
      style={{ zIndex: 9999 }}
    >
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-scale-in mx-6">
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

        {/* Tab Navigation */}
        <div className="px-6 pt-4 border-b border-gray-100">
          <div className="flex gap-1 overflow-x-auto pb-4">
            {TABS
              .filter(tab => !tab.expertOnly || settings.expertModeSettings?.enabled)
              .map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                      activeTab === tab.id
                        ? tab.expertOnly ? 'bg-purple-600 text-white' : 'bg-gray-900 text-white'
                        : tab.expertOnly ? 'text-purple-600 hover:bg-purple-50' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderTabContent()}
        </div>
      </div>

      {/* Update Modal */}
      {showUpdateModal && (
        <UpdateModal onClose={() => setShowUpdateModal(false)} />
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
