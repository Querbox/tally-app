import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { Client, Task } from '../../types';
import { useTaskStore } from '../../stores/taskStore';
import { formatDuration } from '../../utils/timeUtils';
import { generateId } from '../../utils/idUtils';
import { playGlobalSound } from '../../hooks/useSounds';
import { ClientAvatar } from '../clients/ClientAvatar';
import {
  X,
  Mail,
  Phone,
  User,
  FileText,
  Euro,
  Trash2,
  Clock,
  CheckCircle2,
  ListTodo,
  TrendingUp,
  Plus,
  ChevronRight,
  ExternalLink,
  BarChart3,
  CalendarDays,
  Play,
  Square,
  Zap,
  Receipt,
  Download,
  Copy,
  Check,
  Globe,
} from 'lucide-react';
import { PRESET_COLORS } from '../../constants/colors';
import { DocumentList } from '../documents/DocumentList';

interface ClientDetailModalProps {
  client: Client | null;
  onClose: () => void;
  isNew?: boolean;
}

type TabType = 'overview' | 'tasks' | 'time' | 'invoice' | 'documents' | 'details';
type TaskFilter = 'all' | 'open' | 'completed';
type TimeRange = '7d' | '14d' | '30d';
type InvoicePeriod = 'thisMonth' | 'lastMonth' | 'custom';

export function ClientDetailModal({ client, onClose, isNew = false }: ClientDetailModalProps) {
  const addClient = useTaskStore((s) => s.addClient);
  const updateClient = useTaskStore((s) => s.updateClient);
  const deleteClient = useTaskStore((s) => s.deleteClient);
  const tasks = useTaskStore((s) => s.tasks);
  const addTask = useTaskStore((s) => s.addTask);
  const updateTask = useTaskStore((s) => s.updateTask);

  const [activeTab, setActiveTab] = useState<TabType>(isNew ? 'details' : 'overview');
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all');
  const [timeRange, setTimeRange] = useState<TimeRange>('14d');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddTitle, setQuickAddTitle] = useState('');
  const [showQuickTimer, setShowQuickTimer] = useState(false);
  const [quickTimerTitle, setQuickTimerTitle] = useState('');
  const [invoicePeriod, setInvoicePeriod] = useState<InvoicePeriod>('thisMonth');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);

  // Form state
  const [name, setName] = useState(client?.name || '');
  const [color, setColor] = useState(client?.color || PRESET_COLORS[0]);
  const [description, setDescription] = useState(client?.description || '');
  const [website, setWebsite] = useState(client?.website || '');
  const [contactName, setContactName] = useState(client?.contactName || '');
  const [contactEmail, setContactEmail] = useState(client?.contactEmail || '');
  const [contactPhone, setContactPhone] = useState(client?.contactPhone || '');
  const [hourlyRate, setHourlyRate] = useState(client?.hourlyRate?.toString() || '');
  const [notes, setNotes] = useState(client?.notes || '');
  const [isActive, setIsActive] = useState(client?.isActive ?? true);

  // Computed stats
  const clientTasks = useMemo(() =>
    client ? tasks.filter((t) => t.clientId === client.id) : [],
    [client, tasks]
  );

  const stats = useMemo(() => {
    const completed = clientTasks.filter((t) => t.status === 'completed');
    const open = clientTasks.filter((t) => t.status !== 'completed');
    const totalTimeSeconds = clientTasks.reduce((acc, task) => {
      return acc + task.timeEntries.reduce((t, e) => t + (e.duration || 0), 0);
    }, 0);

    // Get time tracked in last 7 days
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentTimeSeconds = clientTasks.reduce((acc, task) => {
      return acc + task.timeEntries
        .filter(e => new Date(e.startTime) >= weekAgo)
        .reduce((t, e) => t + (e.duration || 0), 0);
    }, 0);

    // Last activity
    const lastActivity = clientTasks
      .flatMap(t => t.timeEntries)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0];

    // Calculate estimated revenue
    const rate = client?.hourlyRate || 0;
    const estimatedRevenue = (totalTimeSeconds / 3600) * rate;

    return {
      total: clientTasks.length,
      completed: completed.length,
      open: open.length,
      totalTime: totalTimeSeconds,
      recentTime: recentTimeSeconds,
      lastActivity: lastActivity?.startTime,
      estimatedRevenue,
      completionRate: clientTasks.length > 0
        ? Math.round((completed.length / clientTasks.length) * 100)
        : 0,
    };
  }, [clientTasks, client?.hourlyRate]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    let filtered = clientTasks;
    if (taskFilter === 'open') {
      filtered = filtered.filter(t => t.status !== 'completed');
    } else if (taskFilter === 'completed') {
      filtered = filtered.filter(t => t.status === 'completed');
    }
    return filtered.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [clientTasks, taskFilter]);

  // Time per day for mini chart (last 7 days)
  const timePerDay = useMemo(() => {
    const days: { date: string; seconds: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const seconds = clientTasks.reduce((acc, task) => {
        return acc + task.timeEntries
          .filter(e => e.startTime.startsWith(dateStr))
          .reduce((t, e) => t + (e.duration || 0), 0);
      }, 0);

      days.push({ date: dateStr, seconds });
    }
    return days;
  }, [clientTasks]);

  const maxTimePerDay = Math.max(...timePerDay.map(d => d.seconds), 1);

  // Extended time data for detailed time view
  const extendedTimeData = useMemo(() => {
    const rangeDays = timeRange === '7d' ? 7 : timeRange === '14d' ? 14 : 30;
    const days: { date: string; seconds: number; dayName: string; isWeekend: boolean }[] = [];

    for (let i = rangeDays - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay();

      const seconds = clientTasks.reduce((acc, task) => {
        return acc + task.timeEntries
          .filter(e => e.startTime.startsWith(dateStr))
          .reduce((t, e) => t + (e.duration || 0), 0);
      }, 0);

      days.push({
        date: dateStr,
        seconds,
        dayName: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][dayOfWeek],
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      });
    }
    return days;
  }, [clientTasks, timeRange]);

  const maxExtendedTime = Math.max(...extendedTimeData.map(d => d.seconds), 1);

  // All time entries flattened with task info
  const allTimeEntries = useMemo(() => {
    return clientTasks
      .flatMap(task =>
        task.timeEntries
          .filter(e => e.duration && e.duration > 0)
          .map(entry => ({
            ...entry,
            taskTitle: task.title,
            taskId: task.id,
          }))
      )
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }, [clientTasks]);

  // Time stats by period
  const timeStats = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // This week (Monday to Sunday)
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + mondayOffset);
    const weekStartStr = weekStart.toISOString().split('T')[0];

    // This month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartStr = monthStart.toISOString().split('T')[0];

    const todaySeconds = allTimeEntries
      .filter(e => e.startTime.startsWith(todayStr))
      .reduce((acc, e) => acc + (e.duration || 0), 0);

    const weekSeconds = allTimeEntries
      .filter(e => e.startTime >= weekStartStr)
      .reduce((acc, e) => acc + (e.duration || 0), 0);

    const monthSeconds = allTimeEntries
      .filter(e => e.startTime >= monthStartStr)
      .reduce((acc, e) => acc + (e.duration || 0), 0);

    // Average per day (excluding days with 0)
    const daysWithTime = extendedTimeData.filter(d => d.seconds > 0).length;
    const totalInRange = extendedTimeData.reduce((acc, d) => acc + d.seconds, 0);
    const avgPerDay = daysWithTime > 0 ? totalInRange / daysWithTime : 0;

    return {
      today: todaySeconds,
      thisWeek: weekSeconds,
      thisMonth: monthSeconds,
      avgPerDay,
      daysWithTime,
    };
  }, [allTimeEntries, extendedTimeData]);

  // Invoice data calculation
  const invoiceData = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;
    let periodLabel: string;

    if (invoicePeriod === 'thisMonth') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      periodLabel = now.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    } else if (invoicePeriod === 'lastMonth') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0);
      periodLabel = startDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    } else {
      startDate = customStartDate ? new Date(customStartDate) : new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = customEndDate ? new Date(customEndDate) : now;
      periodLabel = `${startDate.toLocaleDateString('de-DE')} - ${endDate.toLocaleDateString('de-DE')}`;
    }

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // Filter entries by date range
    const periodEntries = allTimeEntries.filter(e => {
      const entryDate = e.startTime.split('T')[0];
      return entryDate >= startStr && entryDate <= endStr;
    });

    // Group by task
    const taskGroups: { [taskId: string]: { title: string; totalSeconds: number; entries: typeof periodEntries } } = {};

    periodEntries.forEach(entry => {
      if (!taskGroups[entry.taskId]) {
        taskGroups[entry.taskId] = {
          title: entry.taskTitle,
          totalSeconds: 0,
          entries: [],
        };
      }
      taskGroups[entry.taskId].totalSeconds += entry.duration || 0;
      taskGroups[entry.taskId].entries.push(entry);
    });

    const totalSeconds = periodEntries.reduce((acc, e) => acc + (e.duration || 0), 0);
    const totalHours = totalSeconds / 3600;
    const hourlyRate = client?.hourlyRate || 0;
    const totalAmount = totalHours * hourlyRate;

    return {
      startDate,
      endDate,
      periodLabel,
      entries: periodEntries,
      taskGroups: Object.values(taskGroups).sort((a, b) => b.totalSeconds - a.totalSeconds),
      totalSeconds,
      totalHours,
      hourlyRate,
      totalAmount,
    };
  }, [allTimeEntries, invoicePeriod, customStartDate, customEndDate, client?.hourlyRate]);

  const handleSave = () => {
    if (!name.trim()) return;

    const clientData = {
      name: name.trim(),
      color,
      isActive,
      description: description.trim() || undefined,
      website: website.trim() || undefined,
      contactName: contactName.trim() || undefined,
      contactEmail: contactEmail.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
      hourlyRate: hourlyRate ? parseFloat(hourlyRate) : undefined,
      notes: notes.trim() || undefined,
    };

    if (isNew) {
      addClient(clientData);
    } else if (client) {
      updateClient(client.id, clientData);
    }
    onClose();
  };

  const confirmDelete = () => {
    if (!client) return;
    playGlobalSound('taskDelete');
    deleteClient(client.id);
    onClose();
  };

  const handleQuickAddTask = () => {
    if (!quickAddTitle.trim() || !client) return;

    addTask({
      title: quickAddTitle.trim(),
      status: 'todo',
      scheduledDate: new Date().toISOString().split('T')[0],
      clientId: client.id,
      tagIds: [],
      subtasks: [],
      isSpontaneous: true,
      isMeeting: false,
      timeEntries: [],
    });

    setQuickAddTitle('');
    setShowQuickAdd(false);
    playGlobalSound('taskComplete');
  };

  // Start timer for client - creates a task and immediately starts the timer
  const handleStartQuickTimer = () => {
    if (!quickTimerTitle.trim() || !client) return;

    const newTaskId = generateId();
    const now = new Date().toISOString();

    addTask({
      title: quickTimerTitle.trim(),
      status: 'in_progress',
      scheduledDate: now.split('T')[0],
      clientId: client.id,
      tagIds: [],
      subtasks: [],
      isSpontaneous: true,
      isMeeting: false,
      timeEntries: [{
        id: generateId(),
        taskId: newTaskId,
        startTime: now,
      }],
    });

    setQuickTimerTitle('');
    setShowQuickTimer(false);
    playGlobalSound('timerStart');
  };

  // Check if there's a running timer for this client
  const runningTimerTask = useMemo(() => {
    return clientTasks.find(task =>
      task.timeEntries.some(entry => !entry.endTime)
    );
  }, [clientTasks]);

  // Stop the running timer
  const handleStopTimer = () => {
    if (!runningTimerTask) return;

    const activeEntry = runningTimerTask.timeEntries.find(e => !e.endTime);
    if (!activeEntry) return;

    const endTime = new Date().toISOString();
    const duration = Math.floor(
      (new Date(endTime).getTime() - new Date(activeEntry.startTime).getTime()) / 1000
    );

    const updatedEntries = runningTimerTask.timeEntries.map(entry =>
      entry.id === activeEntry.id ? { ...entry, endTime, duration } : entry
    );

    updateTask(runningTimerTask.id, {
      timeEntries: updatedEntries,
    });

    playGlobalSound('timerStop');
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Heute';
    if (diffDays === 1) return 'Gestern';
    if (diffDays < 7) return `Vor ${diffDays} Tagen`;
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const renderOverviewTab = () => (
    <div className="space-y-5">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 bg-blue-50 rounded-xl">
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <ListTodo className="w-4 h-4" />
            <span className="text-xs font-medium">Aufgaben</span>
          </div>
          <div className="text-2xl font-bold text-blue-700">{stats.total}</div>
          <div className="text-xs text-blue-500">{stats.open} offen</div>
        </div>

        <div className="p-4 bg-green-50 rounded-xl">
          <div className="flex items-center gap-2 text-green-600 mb-1">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-xs font-medium">Erledigt</span>
          </div>
          <div className="text-2xl font-bold text-green-700">{stats.completed}</div>
          <div className="text-xs text-green-500">{stats.completionRate}% Quote</div>
        </div>

        <div className="p-4 bg-purple-50 rounded-xl">
          <div className="flex items-center gap-2 text-purple-600 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-medium">Gesamtzeit</span>
          </div>
          <div className="text-2xl font-bold text-purple-700">
            {formatDuration(stats.totalTime)}
          </div>
          <div className="text-xs text-purple-500">
            {formatDuration(stats.recentTime)} diese Woche
          </div>
        </div>

        {client?.hourlyRate && stats.estimatedRevenue > 0 && (
          <div className="p-4 bg-amber-50 rounded-xl">
            <div className="flex items-center gap-2 text-amber-600 mb-1">
              <Euro className="w-4 h-4" />
              <span className="text-xs font-medium">Umsatz</span>
            </div>
            <div className="text-2xl font-bold text-amber-700">
              {stats.estimatedRevenue.toFixed(0)}€
            </div>
            <div className="text-xs text-amber-500">{client.hourlyRate}€/h</div>
          </div>
        )}
      </div>

      {/* Mini Time Chart */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700">Letzte 7 Tage</span>
          {stats.lastActivity && (
            <span className="text-xs text-gray-500">
              Letzte Aktivität: {formatRelativeTime(stats.lastActivity)}
            </span>
          )}
        </div>
        <div className="flex items-end gap-1 h-16">
          {timePerDay.map((day) => (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full bg-blue-400 rounded-t transition-all"
                style={{
                  height: `${Math.max((day.seconds / maxTimePerDay) * 100, 4)}%`,
                  opacity: day.seconds > 0 ? 1 : 0.3,
                }}
              />
              <span className="text-[10px] text-gray-400">
                {['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][new Date(day.date).getDay()]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-medium text-gray-700">Schnellaktionen</span>
        </div>

        {/* Running Timer Display */}
        {runningTimerTask && (
          <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-green-700">Timer läuft</span>
              </div>
              <button
                onClick={handleStopTimer}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-600 rounded-lg text-xs font-medium hover:bg-red-200 transition-colors"
              >
                <Square className="w-3 h-3" fill="currentColor" />
                Stoppen
              </button>
            </div>
            <p className="text-xs text-green-600 mt-1 truncate">{runningTimerTask.title}</p>
          </div>
        )}

        {/* Quick Timer Input */}
        {showQuickTimer ? (
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={quickTimerTitle}
              onChange={(e) => setQuickTimerTitle(e.target.value)}
              placeholder="Was arbeitest du?"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleStartQuickTimer()}
            />
            <button
              onClick={handleStartQuickTimer}
              disabled={!quickTimerTitle.trim()}
              className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm disabled:opacity-50 flex items-center gap-1"
            >
              <Play className="w-3 h-3" fill="currentColor" />
              Start
            </button>
            <button
              onClick={() => setShowQuickTimer(false)}
              className="px-3 py-2 bg-gray-200 text-gray-600 rounded-lg text-sm"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : showQuickAdd ? (
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={quickAddTitle}
              onChange={(e) => setQuickAddTitle(e.target.value)}
              placeholder="Neue Aufgabe..."
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleQuickAddTask()}
            />
            <button
              onClick={handleQuickAddTask}
              disabled={!quickAddTitle.trim()}
              className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm disabled:opacity-50"
            >
              Hinzufügen
            </button>
            <button
              onClick={() => setShowQuickAdd(false)}
              className="px-3 py-2 bg-gray-200 text-gray-600 rounded-lg text-sm"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            {!runningTimerTask && (
              <button
                onClick={() => setShowQuickTimer(true)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors"
              >
                <Play className="w-4 h-4" fill="currentColor" />
                Timer starten
              </button>
            )}
            <button
              onClick={() => setShowQuickAdd(true)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors ${runningTimerTask ? '' : ''}`}
            >
              <Plus className="w-4 h-4" />
              Neue Aufgabe
            </button>
          </div>
        )}
      </div>

      {/* Recent Tasks Preview */}
      {filteredTasks.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Letzte Aufgaben</span>
            <button
              onClick={() => setActiveTab('tasks')}
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Alle anzeigen
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {filteredTasks.slice(0, 3).map((task) => (
              <TaskPreviewItem key={task.id} task={task} />
            ))}
          </div>
        </div>
      )}

      {/* Contact Quick Links */}
      {(contactEmail || contactPhone) && (
        <div className="flex gap-2">
          {contactEmail && (
            <a
              href={`mailto:${contactEmail}`}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 rounded-xl text-sm text-gray-700 hover:bg-gray-200 transition-colors"
            >
              <Mail className="w-4 h-4" />
              E-Mail
              <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
            </a>
          )}
          {contactPhone && (
            <a
              href={`tel:${contactPhone}`}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 rounded-xl text-sm text-gray-700 hover:bg-gray-200 transition-colors"
            >
              <Phone className="w-4 h-4" />
              Anrufen
              <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
            </a>
          )}
        </div>
      )}
    </div>
  );

  const renderTasksTab = () => (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
        {[
          { key: 'all' as TaskFilter, label: 'Alle', count: clientTasks.length },
          { key: 'open' as TaskFilter, label: 'Offen', count: stats.open },
          { key: 'completed' as TaskFilter, label: 'Erledigt', count: stats.completed },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setTaskFilter(key)}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              taskFilter === key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      {/* Task List */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <ListTodo className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Keine Aufgaben gefunden</p>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <TaskListItem key={task.id} task={task} clientColor={color} />
          ))
        )}
      </div>

      {/* Add Task Button */}
      <button
        onClick={() => {
          setActiveTab('overview');
          setShowQuickAdd(true);
        }}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-gray-300 hover:text-gray-600 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Neue Aufgabe hinzufügen
      </button>
    </div>
  );

  const renderTimeTab = () => (
    <div className="space-y-5">
      {/* Time Period Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 bg-blue-50 rounded-xl text-center">
          <div className="text-xs font-medium text-blue-600 mb-1">Heute</div>
          <div className="text-lg font-bold text-blue-700">
            {formatDuration(timeStats.today)}
          </div>
        </div>
        <div className="p-3 bg-purple-50 rounded-xl text-center">
          <div className="text-xs font-medium text-purple-600 mb-1">Diese Woche</div>
          <div className="text-lg font-bold text-purple-700">
            {formatDuration(timeStats.thisWeek)}
          </div>
        </div>
        <div className="p-3 bg-green-50 rounded-xl text-center">
          <div className="text-xs font-medium text-green-600 mb-1">Dieser Monat</div>
          <div className="text-lg font-bold text-green-700">
            {formatDuration(timeStats.thisMonth)}
          </div>
        </div>
      </div>

      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <CalendarDays className="w-4 h-4" />
          Zeitverlauf
        </span>
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
          {[
            { key: '7d' as TimeRange, label: '7 Tage' },
            { key: '14d' as TimeRange, label: '14 Tage' },
            { key: '30d' as TimeRange, label: '30 Tage' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTimeRange(key)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                timeRange === key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Extended Bar Chart */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex items-end gap-0.5 h-32">
          {extendedTimeData.map((day, idx) => {
            const heightPercent = (day.seconds / maxExtendedTime) * 100;
            const showLabel = timeRange === '7d' || idx % 2 === 0 || timeRange === '30d' && idx % 5 === 0;

            return (
              <div
                key={day.date}
                className="flex-1 flex flex-col items-center gap-1 group relative"
              >
                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                    {new Date(day.date).toLocaleDateString('de-DE', {
                      weekday: 'short',
                      day: '2-digit',
                      month: '2-digit'
                    })}
                    : {formatDuration(day.seconds)}
                  </div>
                </div>
                {/* Bar */}
                <div
                  className={`w-full rounded-t transition-all ${
                    day.isWeekend ? 'bg-blue-300' : 'bg-blue-500'
                  } ${day.seconds === 0 ? 'opacity-20' : 'hover:opacity-80'}`}
                  style={{
                    height: `${Math.max(heightPercent, 2)}%`,
                  }}
                />
                {/* Label */}
                {showLabel && (
                  <span className={`text-[9px] ${day.isWeekend ? 'text-gray-400' : 'text-gray-500'}`}>
                    {timeRange === '30d'
                      ? new Date(day.date).getDate()
                      : day.dayName
                    }
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {/* Chart Summary */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
          <span className="text-xs text-gray-500">
            Ø {formatDuration(timeStats.avgPerDay)} / Tag
          </span>
          <span className="text-xs text-gray-500">
            {timeStats.daysWithTime} Tage mit Aktivität
          </span>
        </div>
      </div>

      {/* Revenue Estimate (if hourly rate set) */}
      {client?.hourlyRate && (
        <div className="p-4 bg-amber-50 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-amber-600 mb-1">Geschätzter Umsatz (Monat)</div>
              <div className="text-xl font-bold text-amber-700">
                {((timeStats.thisMonth / 3600) * client.hourlyRate).toFixed(2)}€
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-amber-600">bei {client.hourlyRate}€/h</div>
              <div className="text-sm text-amber-700 font-medium">
                {(timeStats.thisMonth / 3600).toFixed(1)}h
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Time Entries */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Letzte Zeiteinträge
        </h3>
        <div className="space-y-2 max-h-[200px] overflow-y-auto">
          {allTimeEntries.length === 0 ? (
            <div className="text-center py-6 text-gray-400">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Noch keine Zeiteinträge</p>
            </div>
          ) : (
            allTimeEntries.slice(0, 10).map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {entry.taskTitle}
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(entry.startTime).toLocaleDateString('de-DE', {
                      weekday: 'short',
                      day: '2-digit',
                      month: '2-digit',
                    })}{' '}
                    um{' '}
                    {new Date(entry.startTime).toLocaleTimeString('de-DE', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
                <div className="text-sm font-mono font-medium text-gray-700">
                  {formatDuration(entry.duration || 0)}
                </div>
              </div>
            ))
          )}
          {allTimeEntries.length > 10 && (
            <div className="text-center text-xs text-gray-400 py-2">
              +{allTimeEntries.length - 10} weitere Einträge
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Generate invoice text for clipboard/export
  const generateInvoiceText = () => {
    const lines: string[] = [];
    lines.push(`ZEITERFASSUNG - ${client?.name || 'Kunde'}`);
    lines.push(`Zeitraum: ${invoiceData.periodLabel}`);
    lines.push('');
    lines.push('─'.repeat(50));
    lines.push('');

    invoiceData.taskGroups.forEach(group => {
      const hours = (group.totalSeconds / 3600).toFixed(2);
      lines.push(`${group.title}`);
      lines.push(`  ${hours} Stunden`);
      lines.push('');
    });

    lines.push('─'.repeat(50));
    lines.push('');
    lines.push(`GESAMT: ${invoiceData.totalHours.toFixed(2)} Stunden`);

    if (invoiceData.hourlyRate > 0) {
      lines.push(`Stundensatz: ${invoiceData.hourlyRate.toFixed(2)} EUR`);
      lines.push(`BETRAG: ${invoiceData.totalAmount.toFixed(2)} EUR`);
    }

    return lines.join('\n');
  };

  // Generate CSV for export
  const generateCSV = () => {
    const lines: string[] = [];
    lines.push('Datum,Aufgabe,Startzeit,Dauer (Stunden),Betrag (EUR)');

    invoiceData.entries.forEach(entry => {
      const date = new Date(entry.startTime).toLocaleDateString('de-DE');
      const time = new Date(entry.startTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      const hours = ((entry.duration || 0) / 3600).toFixed(2);
      const amount = invoiceData.hourlyRate > 0 ? ((entry.duration || 0) / 3600 * invoiceData.hourlyRate).toFixed(2) : '-';
      lines.push(`"${date}","${entry.taskTitle}","${time}","${hours}","${amount}"`);
    });

    lines.push('');
    lines.push(`"GESAMT","","","${invoiceData.totalHours.toFixed(2)}","${invoiceData.hourlyRate > 0 ? invoiceData.totalAmount.toFixed(2) : '-'}"`);

    return lines.join('\n');
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generateInvoiceText());
      setCopiedToClipboard(true);
      playGlobalSound('taskComplete');
      setTimeout(() => setCopiedToClipboard(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = generateInvoiceText();
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedToClipboard(true);
      playGlobalSound('taskComplete');
      setTimeout(() => setCopiedToClipboard(false), 2000);
    }
  };

  const handleDownloadCSV = () => {
    const csv = generateCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const filename = `zeiterfassung_${client?.name?.replace(/\s+/g, '_') || 'kunde'}_${invoiceData.startDate.toISOString().split('T')[0]}.csv`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    playGlobalSound('taskComplete');
  };

  const renderInvoiceTab = () => (
    <div className="space-y-5">
      {/* Period Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Abrechnungszeitraum</label>
        <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
          {[
            { key: 'thisMonth' as InvoicePeriod, label: 'Dieser Monat' },
            { key: 'lastMonth' as InvoicePeriod, label: 'Letzter Monat' },
            { key: 'custom' as InvoicePeriod, label: 'Benutzerdefiniert' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setInvoicePeriod(key)}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                invoicePeriod === key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Custom Date Range */}
        {invoicePeriod === 'custom' && (
          <div className="flex gap-3 mt-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Von</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Bis</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
            </div>
          </div>
        )}
      </div>

      {/* Summary Card */}
      <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200">
        <div className="flex items-center gap-2 text-amber-700 mb-3">
          <Receipt className="w-5 h-5" />
          <span className="font-medium">{invoiceData.periodLabel}</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-amber-600">Stunden</div>
            <div className="text-2xl font-bold text-amber-800">
              {invoiceData.totalHours.toFixed(1)}h
            </div>
          </div>
          {invoiceData.hourlyRate > 0 && (
            <div>
              <div className="text-xs text-amber-600">Betrag</div>
              <div className="text-2xl font-bold text-amber-800">
                {invoiceData.totalAmount.toFixed(2)}€
              </div>
            </div>
          )}
        </div>
        {invoiceData.hourlyRate > 0 && (
          <div className="text-xs text-amber-600 mt-2">
            bei {invoiceData.hourlyRate}€/Stunde
          </div>
        )}
        {invoiceData.hourlyRate === 0 && (
          <div className="text-xs text-amber-600 mt-2">
            Stundensatz in Details hinterlegen für Betragsberechnung
          </div>
        )}
      </div>

      {/* Task Breakdown */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Aufschlüsselung nach Aufgaben</h3>
        <div className="space-y-2 max-h-[200px] overflow-y-auto">
          {invoiceData.taskGroups.length === 0 ? (
            <div className="text-center py-6 text-gray-400">
              <Receipt className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Keine Zeiteinträge im gewählten Zeitraum</p>
            </div>
          ) : (
            invoiceData.taskGroups.map((group) => {
              const hours = group.totalSeconds / 3600;
              const percentage = invoiceData.totalSeconds > 0
                ? (group.totalSeconds / invoiceData.totalSeconds) * 100
                : 0;

              return (
                <div
                  key={group.title}
                  className="p-3 bg-white rounded-xl border border-gray-100"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900 truncate flex-1">
                      {group.title}
                    </span>
                    <span className="text-sm font-mono text-gray-700 ml-2">
                      {hours.toFixed(1)}h
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-10 text-right">
                      {percentage.toFixed(0)}%
                    </span>
                  </div>
                  {invoiceData.hourlyRate > 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                      {(hours * invoiceData.hourlyRate).toFixed(2)}€
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Export Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleCopyToClipboard}
          disabled={invoiceData.entries.length === 0}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors"
        >
          {copiedToClipboard ? (
            <>
              <Check className="w-4 h-4 text-green-600" />
              Kopiert!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              In Zwischenablage
            </>
          )}
        </button>
        <button
          onClick={handleDownloadCSV}
          disabled={invoiceData.entries.length === 0}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 text-white rounded-xl text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
        >
          <Download className="w-4 h-4" />
          CSV Exportieren
        </button>
      </div>
    </div>
  );

  const renderDetailsTab = () => (
    <div className="space-y-5">
      {/* Name & Color */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Kundenname"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            autoFocus={isNew}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Farbe</label>
          <div className="flex gap-2 flex-wrap">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-lg transition-all ${
                  color === c ? 'ring-2 ring-offset-2 ring-gray-900 scale-110' : 'hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Beschreibung
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Projektbeschreibung, Details..."
          rows={2}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none"
        />
      </div>

      {/* Website (für Logo) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
          <Globe className="w-4 h-4" />
          Website
          <span className="text-xs text-gray-400 font-normal">(für automatisches Logo)</span>
        </label>
        <input
          type="text"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="example.com"
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/10"
        />
      </div>

      {/* Contact Info */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-500">Kontakt</h3>
        <div>
          <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
            <User className="w-3 h-3" />
            Ansprechpartner
          </label>
          <input
            type="text"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Max Mustermann"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/10 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
              <Mail className="w-3 h-3" />
              E-Mail
            </label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="email@example.com"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/10 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
              <Phone className="w-3 h-3" />
              Telefon
            </label>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="+49 123 456789"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/10 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Hourly Rate */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
          <Euro className="w-4 h-4" />
          Stundensatz
        </label>
        <div className="relative">
          <input
            type="number"
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)}
            placeholder="0"
            min="0"
            step="0.01"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/10 pr-16"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
            EUR/h
          </span>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Notizen</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Interne Notizen..."
          rows={2}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none"
        />
      </div>

      {/* Active Toggle */}
      <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 rounded-xl">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="w-4 h-4 rounded border-gray-300"
        />
        <span className="text-sm text-gray-700">Kunde ist aktiv</span>
      </label>
    </div>
  );

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center animate-fade-in"
      style={{ zIndex: 9999 }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-scale-in mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {client && !isNew ? (
              <ClientAvatar client={{ ...client, name, color, website }} size="lg" />
            ) : (
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${color}20` }}
              >
                <User className="w-5 h-5" style={{ color }} />
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {isNew ? 'Neuer Kunde' : name || 'Kunde'}
              </h2>
              {!isNew && stats.total > 0 && (
                <p className="text-xs text-gray-500">
                  {stats.total} Aufgaben · {formatDuration(stats.totalTime)}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-all btn-press"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs (only for existing clients) */}
        {!isNew && client && (
          <div className="flex border-b border-gray-100">
            {[
              { key: 'overview' as TabType, label: 'Übersicht', icon: TrendingUp },
              { key: 'tasks' as TabType, label: 'Aufgaben', icon: ListTodo },
              { key: 'documents' as TabType, label: 'Dokumente', icon: FileText },
              { key: 'time' as TabType, label: 'Zeit', icon: BarChart3 },
              { key: 'invoice' as TabType, label: 'Rechnung', icon: Receipt },
              { key: 'details' as TabType, label: 'Details', icon: User },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === key
                    ? 'text-gray-900 border-b-2 border-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {isNew || !client ? (
            renderDetailsTab()
          ) : activeTab === 'overview' ? (
            renderOverviewTab()
          ) : activeTab === 'tasks' ? (
            renderTasksTab()
          ) : activeTab === 'time' ? (
            renderTimeTab()
          ) : activeTab === 'invoice' ? (
            renderInvoiceTab()
          ) : activeTab === 'documents' ? (
            <DocumentList clientId={client.id} />
          ) : (
            renderDetailsTab()
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-gray-100">
          {!isNew && client ? (
            showDeleteConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-600">Wirklich löschen?</span>
                <button
                  onClick={confirmDelete}
                  className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
                >
                  Ja
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300"
                >
                  Nein
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl text-sm btn-press flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Löschen
              </button>
            )
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl btn-press"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim()}
              className="px-5 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 btn-press"
            >
              {isNew ? 'Erstellen' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

// Helper component for task preview
function TaskPreviewItem({ task }: { task: Task }) {
  const totalTime = task.timeEntries.reduce((acc, e) => acc + (e.duration || 0), 0);

  return (
    <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100">
      <div className={`w-2 h-2 rounded-full ${
        task.status === 'completed' ? 'bg-green-500' : 'bg-gray-300'
      }`} />
      <span className={`flex-1 text-sm truncate ${
        task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-700'
      }`}>
        {task.title}
      </span>
      {totalTime > 0 && (
        <span className="text-xs text-gray-400 font-mono">
          {formatDuration(totalTime)}
        </span>
      )}
    </div>
  );
}

// Helper component for task list item
function TaskListItem({ task, clientColor }: { task: Task; clientColor: string }) {
  const totalTime = task.timeEntries.reduce((acc, e) => acc + (e.duration || 0), 0);
  const completedSubtasks = task.subtasks.filter(s => s.isCompleted).length;

  return (
    <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
      <div className={`mt-1 w-3 h-3 rounded-full flex-shrink-0 ${
        task.status === 'completed' ? 'bg-green-500' : 'bg-gray-200'
      }`} />
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${
          task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-900'
        }`}>
          {task.title}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-gray-400">
            {new Date(task.scheduledDate).toLocaleDateString('de-DE', {
              day: '2-digit',
              month: '2-digit'
            })}
          </span>
          {task.subtasks.length > 0 && (
            <span className="text-xs text-gray-400">
              {completedSubtasks}/{task.subtasks.length} Unteraufgaben
            </span>
          )}
          {totalTime > 0 && (
            <span className="text-xs text-gray-400 font-mono flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDuration(totalTime)}
            </span>
          )}
        </div>
      </div>
      {task.status !== 'completed' && (
        <div
          className="w-1.5 h-full rounded-full self-stretch"
          style={{ backgroundColor: clientColor }}
        />
      )}
    </div>
  );
}
