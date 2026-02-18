import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTaskStore } from '../stores/taskStore';
import { X, Archive, CheckCircle2, Calendar, Search, Clock, User } from 'lucide-react';
import type { Task } from '../types';

interface ArchiveViewProps {
  onClose: () => void;
  onSelectTask?: (task: Task) => void;
}

type TimeFilter = 'all' | 'today' | 'week' | 'month';
type SortBy = 'completed' | 'created' | 'title';

export function ArchiveView({ onClose, onSelectTask }: ArchiveViewProps) {
  const tasks = useTaskStore((s) => s.tasks);
  const clients = useTaskStore((s) => s.clients);

  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('completed');
  const [selectedClientId, setSelectedClientId] = useState<string | 'all'>('all');

  // Nur erledigte Aufgaben
  const completedTasks = useMemo(() => {
    let filtered = tasks.filter((t) => t.status === 'completed');

    // Zeit-Filter
    if (timeFilter !== 'all') {
      const now = new Date();
      const cutoff = new Date();

      if (timeFilter === 'today') {
        cutoff.setHours(0, 0, 0, 0);
      } else if (timeFilter === 'week') {
        cutoff.setDate(now.getDate() - 7);
      } else if (timeFilter === 'month') {
        cutoff.setMonth(now.getMonth() - 1);
      }

      filtered = filtered.filter((t) => {
        const completedDate = t.completedAt ? new Date(t.completedAt) : new Date(t.createdAt);
        return completedDate >= cutoff;
      });
    }

    // Kunden-Filter
    if (selectedClientId !== 'all') {
      filtered = filtered.filter((t) => t.clientId === selectedClientId);
    }

    // Suche
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query)
      );
    }

    // Sortierung
    filtered.sort((a, b) => {
      if (sortBy === 'completed') {
        const dateA = a.completedAt ? new Date(a.completedAt) : new Date(a.createdAt);
        const dateB = b.completedAt ? new Date(b.completedAt) : new Date(b.createdAt);
        return dateB.getTime() - dateA.getTime();
      } else if (sortBy === 'created') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else {
        return a.title.localeCompare(b.title);
      }
    });

    return filtered;
  }, [tasks, timeFilter, selectedClientId, searchQuery, sortBy]);

  // Statistiken
  const stats = useMemo(() => {
    const all = tasks.filter((t) => t.status === 'completed');
    const thisWeek = all.filter((t) => {
      const date = t.completedAt ? new Date(t.completedAt) : new Date(t.createdAt);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return date >= weekAgo;
    });

    const totalTime = all.reduce((acc, t) => {
      return acc + t.timeEntries.reduce((sum, e) => sum + (e.duration || 0), 0);
    }, 0);

    return {
      total: all.length,
      thisWeek: thisWeek.length,
      totalTime: Math.round(totalTime / 60), // in Minuten
    };
  }, [tasks]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Heute';
    if (diffDays === 1) return 'Gestern';
    if (diffDays < 7) return `vor ${diffDays} Tagen`;
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getClient = (clientId?: string) => {
    if (!clientId) return null;
    return clients.find((c) => c.id === clientId);
  };

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center animate-fade-in"
      style={{ zIndex: 9999 }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-scale-in mx-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
              <Archive className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Archiv</h2>
              <p className="text-sm text-gray-500">Erledigte Aufgaben</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-all"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Stats */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-xs text-gray-500">Gesamt erledigt</p>
            </div>
            <div className="bg-white rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600">{stats.thisWeek}</p>
              <p className="text-xs text-gray-500">Diese Woche</p>
            </div>
            <div className="bg-white rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{formatDuration(stats.totalTime)}</p>
              <p className="text-xs text-gray-500">Erfasste Zeit</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="px-6 py-4 border-b border-gray-100 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Aufgaben durchsuchen..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
          </div>

          {/* Filter Chips */}
          <div className="flex flex-wrap gap-2">
            {/* Zeit-Filter */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {[
                { value: 'all' as TimeFilter, label: 'Alle' },
                { value: 'today' as TimeFilter, label: 'Heute' },
                { value: 'week' as TimeFilter, label: '7 Tage' },
                { value: 'month' as TimeFilter, label: '30 Tage' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setTimeFilter(value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    timeFilter === value
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Kunden-Filter */}
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="px-3 py-1.5 bg-gray-100 border-0 rounded-lg text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            >
              <option value="all">Alle Kunden</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>

            {/* Sortierung */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="px-3 py-1.5 bg-gray-100 border-0 rounded-lg text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            >
              <option value="completed">Nach Abschluss</option>
              <option value="created">Nach Erstellung</option>
              <option value="title">Alphabetisch</option>
            </select>
          </div>
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto p-6">
          {completedTasks.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Archive className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm">
                {searchQuery || timeFilter !== 'all' || selectedClientId !== 'all'
                  ? 'Keine passenden Aufgaben gefunden'
                  : 'Noch keine erledigten Aufgaben'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-400 mb-3">
                {completedTasks.length} {completedTasks.length === 1 ? 'Aufgabe' : 'Aufgaben'}
              </p>
              {completedTasks.map((task) => {
                const client = getClient(task.clientId);
                const totalTime = task.timeEntries.reduce((sum, e) => sum + (e.duration || 0), 0);

                return (
                  <button
                    key={task.id}
                    onClick={() => onSelectTask?.(task)}
                    className="w-full flex items-center gap-4 p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all text-left group"
                  >
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {task.title}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        {client && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <User className="w-3 h-3" />
                            {client.name}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Calendar className="w-3 h-3" />
                          {formatDate(task.completedAt || task.createdAt)}
                        </span>
                        {totalTime > 0 && (
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Clock className="w-3 h-3" />
                            {formatDuration(Math.round(totalTime / 60))}
                          </span>
                        )}
                      </div>
                    </div>
                    {task.isMeeting && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-600 text-xs rounded-lg">
                        Meeting
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
