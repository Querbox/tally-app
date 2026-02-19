import { useMemo, useEffect, useState, useCallback } from 'react';
import { useTaskStore } from '../stores/taskStore';
import { useSettingsStore, type TaskSortOption } from '../stores/settingsStore';
import { useShallow } from 'zustand/react/shallow';
import { TaskItem } from '../components/tasks/TaskItem';
import { QuickAddTask } from '../components/tasks/QuickAddTask';
import { EmptyState } from '../components/common/EmptyState';
import { FloatingDropZones } from '../components/tasks/DropZone';
import { BulkOperationsBar } from '../components/expert/BulkOperationsBar';
import { formatDuration } from '../utils/timeUtils';
import { getTodayString, formatDateGerman, addDays } from '../utils/dateUtils';
import { playGlobalSound } from '../hooks/useSounds';
import { useToast } from '../components/common/Toast';
import { Clock, Moon, Filter, Flag, X, Plus, ArrowUpDown, ArrowUp, ArrowDown, SortAsc, Target, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Task, TaskPriority } from '../types';

/**
 * HEUTE-ANSICHT: "FOKUS + KONTEXT"
 * =================================
 *
 * Design-Prinzipien:
 * - Fokus-Aufgabe prominent oben (wenn gesetzt)
 * - Meetings mit Countdown als Zeitanker
 * - Aufgaben als flexibler Pool
 * - Keine ablenkenden Statistiken
 * - Erledigt standardmäßig versteckt
 */

type PriorityFilter = 'all' | TaskPriority;

const FILTER_OPTIONS: { value: PriorityFilter; label: string; color: string }[] = [
  { value: 'all', label: 'Alle', color: '#6b7280' },
  { value: 'urgent', label: 'Dringend', color: '#dc2626' },
  { value: 'high', label: 'Hoch', color: '#ea580c' },
  { value: 'medium', label: 'Normal', color: '#2563eb' },
  { value: 'low', label: 'Niedrig', color: '#9ca3af' },
];

// Sortieroptionen
const SORT_OPTIONS: { value: TaskSortOption; label: string; icon: typeof ArrowUp }[] = [
  { value: 'newest', label: 'Neueste zuerst', icon: ArrowDown },
  { value: 'oldest', label: 'Älteste zuerst', icon: ArrowUp },
  { value: 'priority', label: 'Priorität', icon: Flag },
  { value: 'alphabetical', label: 'Alphabetisch', icon: SortAsc },
];

// Priority order for sorting (higher = more important)
const PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function sortTasks(tasks: Task[], sortOption: TaskSortOption): Task[] {
  return [...tasks].sort((a, b) => {
    switch (sortOption) {
      case 'newest':
        // Neueste zuerst (nach Erstellungsdatum)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

      case 'oldest':
        // Älteste zuerst (nach Erstellungsdatum)
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

      case 'priority':
        // Nach Priorität (höchste zuerst), dann nach Erstellungsdatum
        const priorityA = PRIORITY_ORDER[a.priority || 'medium'];
        const priorityB = PRIORITY_ORDER[b.priority || 'medium'];
        if (priorityA !== priorityB) {
          return priorityB - priorityA;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

      case 'alphabetical':
        // Alphabetisch nach Titel
        return a.title.localeCompare(b.title, 'de');

      default:
        return 0;
    }
  });
}

interface DayViewProps {
  onEndDay: () => void;
  externalPriorityFilter?: PriorityFilter;
  onPriorityFilterChange?: (filter: PriorityFilter) => void;
  focusTaskId?: string | null;
  onFocusTask?: (task: Task | null) => void;
}

export function DayView({ onEndDay, externalPriorityFilter, onPriorityFilterChange, focusTaskId, onFocusTask }: DayViewProps) {
  // Optimized selectors - only re-render when these specific values change
  const { tasks, clients, tags, updateTask, generateMeetingInstancesForDate } = useTaskStore(
    useShallow((s) => ({
      tasks: s.tasks,
      clients: s.clients,
      tags: s.tags,
      updateTask: s.updateTask,
      generateMeetingInstancesForDate: s.generateMeetingInstancesForDate,
    }))
  );
  const { showCompletedTasks, taskSortOption, updateSettings, expertMode, bulkOperationsEnabled } = useSettingsStore(
    useShallow((s) => ({
      showCompletedTasks: s.showCompletedTasks,
      taskSortOption: s.taskSortOption,
      updateSettings: s.updateSettings,
      expertMode: s.expertModeSettings?.enabled ?? false,
      bulkOperationsEnabled: s.expertModeSettings?.enabled && s.expertModeSettings?.bulkOperations,
    }))
  );

  const { toast } = useToast();

  const [internalPriorityFilter, setInternalPriorityFilter] = useState<PriorityFilter>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);

  // Bulk selection state (only used when expert mode bulk operations enabled)
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

  // Use external filter if provided, otherwise use internal state
  const priorityFilter = externalPriorityFilter ?? internalPriorityFilter;
  const setPriorityFilter = onPriorityFilterChange ?? setInternalPriorityFilter;

  // Sync internal state with external filter
  useEffect(() => {
    if (externalPriorityFilter !== undefined) {
      setInternalPriorityFilter(externalPriorityFilter);
    }
  }, [externalPriorityFilter]);

  const today = getTodayString();
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const isViewingToday = selectedDate === today;

  // Drag and drop handlers
  const handleDragStart = useCallback((task: Task, e: React.DragEvent) => {
    // Setze Drag-Daten
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.setData('application/x-task-id', task.id);

    // Speichere Task-ID im State (als Backup falls dataTransfer nicht funktioniert)
    setDraggedTaskId(task.id);

    // Kurze Verzögerung damit das Drag-Bild korrekt erscheint
    requestAnimationFrame(() => {
      setIsDragging(true);
    });
  }, []);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setDraggedTaskId(null);
    setDragOverTarget(null);
  }, []);

  const handleDragOver = useCallback((target: string, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTarget(target);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverTarget(null);
  }, []);

  const handleDrop = useCallback((target: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // PRIORITÄT: State-basierter Fallback (zuverlässiger in Tauri/WebView)
    // Dann versuche dataTransfer als Backup
    let taskId = draggedTaskId;

    if (!taskId) {
      try {
        taskId = e.dataTransfer.getData('text/plain') ||
                 e.dataTransfer.getData('text') ||
                 e.dataTransfer.getData('application/x-task-id');
      } catch {
        console.log('dataTransfer.getData failed');
      }
    }

    if (taskId) {
      // Find task name for toast
      const task = tasks.find(t => t.id === taskId);
      const taskName = task?.title || 'Aufgabe';

      switch (target) {
        case 'today':
          updateTask(taskId, { scheduledDate: today, isOptional: false });
          toast(`"${taskName}" auf Heute verschoben`);
          break;
        case 'optional':
          updateTask(taskId, { scheduledDate: today, isOptional: true });
          toast(`"${taskName}" als optional markiert`);
          break;
        case 'tomorrow':
          updateTask(taskId, { scheduledDate: addDays(today, 1) });
          toast(`"${taskName}" auf Morgen verschoben`);
          break;
        case 'completed':
          updateTask(taskId, {
            status: 'completed',
            completedAt: new Date().toISOString(),
          });
          playGlobalSound('taskComplete');
          toast(`"${taskName}" erledigt!`);
          break;
      }
    }

    setIsDragging(false);
    setDraggedTaskId(null);
    setDragOverTarget(null);
  }, [today, updateTask, tasks, toast, draggedTaskId]);

  // Generate recurring meeting instances for selected date
  useEffect(() => {
    generateMeetingInstancesForDate(selectedDate);
  }, [selectedDate, generateMeetingInstancesForDate]);

  // Combined filtering, grouping, sorting and stats in ONE useMemo for efficiency
  const {
    dayTasks,
    openTasks,
    optionalTasks,
    meetings,
    completedTasks,
    filteredOpenTasks,
    filteredOptionalTasks,
    filteredCompletedTasks,
    stats,
  } = useMemo(() => {
    // Step 1: Filter tasks for selected date
    const todayTasks = tasks.filter((task) => task.scheduledDate === selectedDate);

    // Step 2: Group tasks in single pass
    const open: Task[] = [];
    const optional: Task[] = [];
    const meetingsList: Task[] = [];
    const completed: Task[] = [];
    let totalTime = 0;
    let nonMeetingTotal = 0;
    let nonMeetingCompleted = 0;

    todayTasks.forEach((task) => {
      // Accumulate time
      totalTime += task.timeEntries.reduce((t, e) => t + (e.duration || 0), 0);

      if (task.status === 'completed') {
        completed.push(task);
        if (!task.isMeeting) nonMeetingCompleted++;
      } else if (task.isMeeting) {
        meetingsList.push(task);
      } else if (task.isOptional) {
        optional.push(task);
      } else {
        open.push(task);
      }

      if (!task.isMeeting) nonMeetingTotal++;
    });

    // Step 3: Sort
    meetingsList.sort((a, b) => {
      if (!a.meetingTime || !b.meetingTime) return 0;
      return a.meetingTime.start.localeCompare(b.meetingTime.start);
    });
    const sortedOpen = sortTasks(open, taskSortOption || 'newest');
    const sortedOptional = sortTasks(optional, taskSortOption || 'newest');
    const sortedCompleted = sortTasks(completed, taskSortOption || 'newest');

    // Step 4: Apply priority filter
    const filteredOpen = priorityFilter === 'all'
      ? sortedOpen
      : sortedOpen.filter((task) => (task.priority || 'medium') === priorityFilter);

    const filteredOptional = priorityFilter === 'all'
      ? sortedOptional
      : sortedOptional.filter((task) => (task.priority || 'medium') === priorityFilter);

    const filteredCompleted = priorityFilter === 'all'
      ? sortedCompleted
      : sortedCompleted.filter((task) => !task.isMeeting && (task.priority || 'medium') === priorityFilter);

    return {
      dayTasks: todayTasks,
      openTasks: sortedOpen,
      optionalTasks: sortedOptional,
      meetings: meetingsList,
      completedTasks: sortedCompleted,
      filteredOpenTasks: filteredOpen,
      filteredOptionalTasks: filteredOptional,
      filteredCompletedTasks: filteredCompleted,
      stats: {
        total: nonMeetingTotal,
        completed: nonMeetingCompleted,
        totalTime,
      },
    };
  }, [tasks, selectedDate, taskSortOption, priorityFilter]);

  const activeFilter = FILTER_OPTIONS.find((f) => f.value === priorityFilter);
  const activeSort = SORT_OPTIONS.find((s) => s.value === (taskSortOption || 'newest'));

  const getClientById = (id?: string) => clients.find((c) => c.id === id);
  const getTagsByIds = (ids: string[]) => tags.filter((t) => ids.includes(t.id));

  // Fokus-Aufgabe finden
  const focusTask = focusTaskId ? tasks.find((t) => t.id === focusTaskId) : null;

  // Handler für Fokus setzen/aufheben (toggle)
  const handleSetFocus = useCallback((task: Task) => {
    if (onFocusTask) {
      // Wenn dieselbe Aufgabe, Fokus aufheben
      if (focusTaskId === task.id) {
        onFocusTask(null);
      } else {
        onFocusTask(task);
      }
    }
  }, [onFocusTask, focusTaskId]);

  // Bulk selection handlers
  const handleToggleTaskSelection = useCallback((taskId: string) => {
    setSelectedTaskIds(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedTaskIds([]);
  }, []);

  // All selectable tasks (non-meetings, non-completed)
  const selectableTasks = useMemo(() => {
    return [...openTasks, ...optionalTasks];
  }, [openTasks, optionalTasks]);

  const handleSelectAll = useCallback(() => {
    setSelectedTaskIds(selectableTasks.map(t => t.id));
  }, [selectableTasks]);

  const allTasksSelected = selectableTasks.length > 0 && selectedTaskIds.length === selectableTasks.length;

  return (
    <div className="flex-1 bg-[#f5f5f7] h-full flex flex-col overflow-hidden">
      {/* Header - ruhig, nur essenzielle Infos */}
      <header className="bg-white/80 glass border-b border-gray-200/50 flex-shrink-0 relative z-30">
        <div className="px-6 py-5">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between animate-fade-in">
              <div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSelectedDate(addDays(selectedDate, -1))}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-all btn-press"
                    title="Vorheriger Tag"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-500" />
                  </button>
                  <h1 className="text-xl font-semibold text-gray-900 px-1">
                    {isViewingToday ? formatDateGerman(selectedDate) : formatDateGerman(selectedDate)}
                  </h1>
                  <button
                    onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-all btn-press"
                    title="Nächster Tag"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                  </button>
                  {!isViewingToday && (
                    <button
                      onClick={() => setSelectedDate(today)}
                      className="ml-2 px-3 py-1.5 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-all btn-press"
                    >
                      Heute
                    </button>
                  )}
                </div>
                {/* Nur Zeit-Tracking anzeigen - keine Aufgaben-Statistiken */}
                {stats.totalTime > 0 && (
                  <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
                    <Clock className="w-3.5 h-3.5" />
                    {formatDuration(stats.totalTime)}
                  </div>
                )}
              </div>

            <div className="flex items-center gap-2">
              {/* Sort & Filter: Expert-Mode zeigt immer, sonst nur bei vielen Aufgaben (Progressive Disclosure) */}
              {(expertMode || openTasks.length > 7) && (
                <>
                  {/* Sort Button */}
                  <div className="relative">
                    <button
                      onClick={() => setShowSortMenu(!showSortMenu)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200 btn-press"
                      title="Reihenfolge ändern"
                    >
                      <ArrowUpDown className="w-4 h-4" />
                      <span className="hidden sm:inline">{activeSort?.label}</span>
                    </button>

                    {/* Sort Menu */}
                    {showSortMenu && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowSortMenu(false)}
                        />
                        <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-gray-200 py-1 min-w-[180px] z-50 animate-scale-in">
                          {SORT_OPTIONS.map((option) => {
                            const Icon = option.icon;
                            return (
                              <button
                                key={option.value}
                                onClick={() => {
                                  updateSettings({ taskSortOption: option.value });
                                  setShowSortMenu(false);
                                }}
                                className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors ${
                                  (taskSortOption || 'newest') === option.value ? 'bg-gray-50' : ''
                                }`}
                              >
                                <Icon className="w-4 h-4 text-gray-400" />
                                <span>{option.label}</span>
                                {(taskSortOption || 'newest') === option.value && (
                                  <span className="ml-auto text-gray-400">✓</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Filter Button */}
                  <div className="relative">
                    <button
                      onClick={() => setShowFilterMenu(!showFilterMenu)}
                      className={`flex items-center gap-2 px-3 py-2 text-sm rounded-xl transition-all duration-200 btn-press ${
                        priorityFilter !== 'all'
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                      title="Nach Priorität filtern"
                    >
                      <Filter className="w-4 h-4" />
                      {priorityFilter !== 'all' && (
                        <span>{activeFilter?.label}</span>
                      )}
                    </button>

                    {/* Filter Menu */}
                    {showFilterMenu && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowFilterMenu(false)}
                        />
                        <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-gray-200 py-1 min-w-[160px] z-50 animate-scale-in">
                          {FILTER_OPTIONS.map((option) => (
                            <button
                              key={option.value}
                              onClick={() => {
                                setPriorityFilter(option.value);
                                setShowFilterMenu(false);
                              }}
                              className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors ${
                                priorityFilter === option.value ? 'bg-gray-50' : ''
                              }`}
                            >
                              {option.value !== 'all' ? (
                                <Flag
                                  className="w-4 h-4"
                                  style={{ color: option.color }}
                                  fill={option.value === 'urgent' ? option.color : 'none'}
                                />
                              ) : (
                                <div className="w-4 h-4" />
                              )}
                              <span style={{ color: option.value !== 'all' ? option.color : undefined }}>
                                {option.label}
                              </span>
                              {priorityFilter === option.value && (
                                <span className="ml-auto text-gray-400">✓</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Clear Filter */}
                  {priorityFilter !== 'all' && (
                    <button
                      onClick={() => setPriorityFilter('all')}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                      title="Filter zurücksetzen"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </>
              )}

              {/* End Day Button - only when viewing today */}
              {isViewingToday && (
                <button
                  onClick={onEndDay}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200 btn-press"
                >
                  <Moon className="w-4 h-4" />
                  Tag beenden
                </button>
              )}
            </div>
          </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
        {/* Quick Add */}
        <div className="animate-fade-in-up opacity-0" style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}>
          <QuickAddTask date={selectedDate} />
        </div>

        {/* HEUTE ZUERST - wenn manuell gesetzt */}
        {focusTask && focusTask.status !== 'completed' && (
          <section className="mt-6 animate-fade-in-up opacity-0" style={{ animationDelay: '0.12s', animationFillMode: 'forwards' }}>
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-gray-900" />
              <h2 className="text-xs font-medium text-gray-900 uppercase tracking-wide">
                Fokus-Aufgabe
              </h2>
            </div>
            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-900/5 p-1">
              <TaskItem
                task={focusTask}
                client={getClientById(focusTask.clientId)}
                tags={getTagsByIds(focusTask.tagIds)}
                draggable={true}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                isDragging={draggedTaskId === focusTask.id}
                onSetFocus={handleSetFocus}
                isFocused={true}
                expertMode={expertMode}
              />
            </div>
          </section>
        )}

        {/* MEETINGS - TaskItem zeigt Countdown bereits intern */}
        {meetings.length > 0 && (
          <section className="mt-6 animate-fade-in-up opacity-0" style={{ animationDelay: '0.15s', animationFillMode: 'forwards' }}>
            <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
              Termine
            </h2>
            <div className="space-y-2">
              {meetings.map((task, index) => (
                <div
                  key={task.id}
                  className="animate-fade-in-up opacity-0"
                  style={{ animationDelay: `${0.2 + index * 0.05}s`, animationFillMode: 'forwards' }}
                >
                  <TaskItem
                    task={task}
                    client={getClientById(task.clientId)}
                    tags={getTagsByIds(task.tagIds)}
                    expertMode={expertMode}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* AUFGABEN - flexibler Pool (ohne Fokus-Aufgabe) */}
        {(() => {
          // Fokus-Aufgabe aus der Liste filtern, damit sie nicht doppelt erscheint
          const tasksWithoutFocus = focusTaskId
            ? filteredOpenTasks.filter((t) => t.id !== focusTaskId)
            : filteredOpenTasks;

          if (tasksWithoutFocus.length === 0) return null;

          return (
            <section className="mt-6 animate-fade-in-up opacity-0" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Aufgaben
                  {priorityFilter !== 'all' && (
                    <span className="ml-2 text-gray-300">
                      ({tasksWithoutFocus.length} von {openTasks.length - (focusTaskId ? 1 : 0)})
                    </span>
                  )}
                </h2>
              </div>
              <div className="space-y-2">
                {tasksWithoutFocus.map((task, index) => (
                  <div
                    key={task.id}
                    className="animate-fade-in-up opacity-0"
                    style={{ animationDelay: `${0.25 + index * 0.05}s`, animationFillMode: 'forwards' }}
                  >
                    <TaskItem
                      task={task}
                      client={getClientById(task.clientId)}
                      tags={getTagsByIds(task.tagIds)}
                      draggable={true}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      isDragging={draggedTaskId === task.id}
                      onSetFocus={handleSetFocus}
                      isFocused={focusTaskId === task.id}
                      expertMode={expertMode}
                      showSelectionCheckbox={bulkOperationsEnabled}
                      isSelected={selectedTaskIds.includes(task.id)}
                      onToggleSelection={handleToggleTaskSelection}
                    />
                  </div>
                ))}
              </div>
            </section>
          );
        })()}

        {/* HEUTE OPTIONAL - immer anzeigen, ausgegraut wenn leer */}
        <section className="mt-6 animate-fade-in-up opacity-0" style={{ animationDelay: '0.25s', animationFillMode: 'forwards' }}>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className={`w-4 h-4 ${filteredOptionalTasks.length > 0 ? 'text-amber-500' : 'text-gray-300'}`} />
            <h2 className={`text-xs font-medium uppercase tracking-wide ${filteredOptionalTasks.length > 0 ? 'text-amber-600' : 'text-gray-300'}`}>
              Heute Optional
              {priorityFilter !== 'all' && optionalTasks.length > 0 && (
                <span className="ml-2 text-amber-400">
                  ({filteredOptionalTasks.length} von {optionalTasks.length})
                </span>
              )}
            </h2>
          </div>
          {filteredOptionalTasks.length > 0 ? (
            <div className="space-y-2">
              {filteredOptionalTasks.map((task, index) => (
                <div
                  key={task.id}
                  className="animate-fade-in-up opacity-0"
                  style={{ animationDelay: `${0.3 + index * 0.05}s`, animationFillMode: 'forwards' }}
                >
                  <TaskItem
                    task={task}
                    client={getClientById(task.clientId)}
                    tags={getTagsByIds(task.tagIds)}
                    draggable={true}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    isDragging={draggedTaskId === task.id}
                    onSetFocus={handleSetFocus}
                    isFocused={focusTaskId === task.id}
                    expertMode={expertMode}
                    showSelectionCheckbox={bulkOperationsEnabled}
                    isSelected={selectedTaskIds.includes(task.id)}
                    onToggleSelection={handleToggleTaskSelection}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-300 text-sm border-2 border-dashed border-gray-200 rounded-xl">
              Aufgaben hierhin ziehen oder per Rechtsklick als optional markieren
            </div>
          )}
        </section>

        {/* No tasks matching filter */}
        {priorityFilter !== 'all' && filteredOpenTasks.length === 0 && filteredOptionalTasks.length === 0 && openTasks.length + optionalTasks.length > 0 && (
          <EmptyState
            type="filtered"
            title={`Keine "${activeFilter?.label}" Aufgaben`}
            description="Es gibt keine Aufgaben mit dieser Priorität."
            action={{
              label: 'Filter zuruecksetzen',
              onClick: () => setPriorityFilter('all'),
              icon: X,
            }}
            className="mt-6"
          />
        )}

        {/* Completed Tasks */}
        {showCompletedTasks && filteredCompletedTasks.length > 0 && (
          <section className="mt-6 animate-fade-in-up opacity-0" style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}>
            <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
              Erledigt
              {priorityFilter !== 'all' && (
                <span className="ml-2 text-gray-300">
                  ({filteredCompletedTasks.length} von {completedTasks.length})
                </span>
              )}
            </h2>
            <div className="space-y-2">
              {filteredCompletedTasks.map((task, index) => (
                <div
                  key={task.id}
                  className="animate-fade-in-up opacity-0"
                  style={{ animationDelay: `${0.35 + index * 0.05}s`, animationFillMode: 'forwards' }}
                >
                  <TaskItem
                    task={task}
                    client={getClientById(task.clientId)}
                    tags={getTagsByIds(task.tagIds)}
                    draggable={true}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    isDragging={draggedTaskId === task.id}
                    expertMode={expertMode}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Empty State */}
        {dayTasks.length === 0 && (
          <EmptyState
            type="tasks"
            action={{
              label: 'Aufgabe erstellen',
              onClick: () => {
                // Focus the quick add input
                const input = document.querySelector('input[placeholder*="Aufgabe"]') as HTMLInputElement;
                input?.focus();
              },
              icon: Plus,
            }}
          />
        )}
        </div>
      </main>

      {/* Floating Drop Zones */}
      <FloatingDropZones
        isVisible={isDragging}
        currentDate={today}
        dragOverTarget={dragOverTarget}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      />

      {/* Bulk Operations Bar (only when expert mode bulk operations enabled) */}
      {bulkOperationsEnabled && (
        <BulkOperationsBar
          selectedTasks={selectedTaskIds}
          onClearSelection={handleClearSelection}
          onSelectAll={handleSelectAll}
          allTasksSelected={allTasksSelected}
          totalTasks={selectableTasks.length}
        />
      )}

    </div>
  );
}
