import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Users, Tag, FileText, CheckCircle2, Circle, Calendar } from 'lucide-react';
import { useTaskStore } from '../../stores/taskStore';
import { useShallow } from 'zustand/react/shallow';
import { extractPlainTextFromTipTap } from '../tasks/TaskDescriptionEditor';
import type { Task, Client, TaskPriority } from '../../types';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTask: (task: Task) => void;
  onSelectClient: (client: Client) => void;
}

type SearchResultType = 'task' | 'client' | 'tag';
type FilterType = 'all' | 'task' | 'client' | 'tag';
type StatusFilter = 'all' | 'open' | 'completed';

interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  color?: string;
  data: Task | Client;
  status?: 'todo' | 'in_progress' | 'completed';
  priority?: TaskPriority;
}

export function SearchModal({ isOpen, onClose, onSelectTask, onSelectClient }: SearchModalProps) {
  const [inputValue, setInputValue] = useState(''); // Immediate input value
  const [query, setQuery] = useState(''); // Debounced search query
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search query (150ms delay for responsive feel)
  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
    setSelectedIndex(0);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      setQuery(value);
    }, 150);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Optimized selectors with shallow comparison
  const { tasks, clients, tags } = useTaskStore(
    useShallow((s) => ({
      tasks: s.tasks,
      clients: s.clients,
      tags: s.tags,
    }))
  );

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setInputValue('');
      setQuery('');
      setSelectedIndex(0);
      setTypeFilter('all');
      setStatusFilter('all');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            handleSelect(results[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current) {
      const selectedEl = resultsRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      selectedEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Search results with early exit optimization
  const results = useMemo((): SearchResult[] => {
    const lowerQuery = query.toLowerCase().trim();
    const searchResults: SearchResult[] = [];
    const MAX_RESULTS = 15; // Early exit limit

    // Filter tasks
    if (typeFilter === 'all' || typeFilter === 'task') {
      let filteredTasks = tasks;

      // Apply status filter
      if (statusFilter === 'open') {
        filteredTasks = filteredTasks.filter((t) => t.status !== 'completed');
      } else if (statusFilter === 'completed') {
        filteredTasks = filteredTasks.filter((t) => t.status === 'completed');
      }

      // Sort by createdAt descending first so we get the most recent matches
      const sortedTasks = [...filteredTasks].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      for (const task of sortedTasks) {
        // Early exit: stop searching if we have enough task results
        if (searchResults.length >= MAX_RESULTS) break;

        // Lazy text search: check title first, only parse description if needed
        const titleLower = task.title.toLowerCase();
        const titleMatches = !lowerQuery || titleLower.includes(lowerQuery);

        // Only extract description text if title doesn't match and we have a query
        let matches = titleMatches;
        if (!matches && lowerQuery && task.description) {
          const descriptionText = extractPlainTextFromTipTap(task.description);
          matches = descriptionText.toLowerCase().includes(lowerQuery);
        }

        if (matches) {
          const client = clients.find((c) => c.id === task.clientId);
          const statusIcon =
            task.status === 'completed' ? (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            ) : task.isMeeting ? (
              <Calendar className="w-4 h-4" />
            ) : (
              <Circle className="w-4 h-4" />
            );

          searchResults.push({
            id: task.id,
            type: 'task',
            title: task.title,
            subtitle: client ? client.name : task.scheduledDate,
            icon: statusIcon,
            color: client?.color,
            data: task,
            status: task.status,
            priority: task.priority,
          });
        }
      }
    }

    // Search clients
    if (typeFilter === 'all' || typeFilter === 'client') {
      clients.forEach((client) => {
        if (!lowerQuery || client.name.toLowerCase().includes(lowerQuery)) {
          const taskCount = tasks.filter((t) => t.clientId === client.id && t.status !== 'completed').length;
          searchResults.push({
            id: client.id,
            type: 'client',
            title: client.name,
            subtitle: `${taskCount} offene Aufgaben`,
            icon: <Users className="w-4 h-4" />,
            color: client.color,
            data: client,
          });
        }
      });
    }

    // Search tags
    if (typeFilter === 'all' || typeFilter === 'tag') {
      tags.forEach((tag) => {
        if (!lowerQuery || tag.name.toLowerCase().includes(lowerQuery)) {
          const taskCount = tasks.filter((t) => t.tagIds.includes(tag.id)).length;
          searchResults.push({
            id: tag.id,
            type: 'tag',
            title: tag.name,
            subtitle: `${taskCount} Aufgaben`,
            icon: <Tag className="w-4 h-4" />,
            color: tag.color,
            data: tag as unknown as Task,
          });
        }
      });
    }

    // Results are already sorted: tasks by date (pre-sorted), then clients, then tags
    // No need to sort again since we add tasks first, then clients, then tags
    return searchResults.slice(0, MAX_RESULTS);
  }, [query, tasks, clients, tags, typeFilter, statusFilter]);

  const handleSelect = (result: SearchResult) => {
    if (result.type === 'task') {
      onSelectTask(result.data as Task);
    } else if (result.type === 'client') {
      onSelectClient(result.data as Client);
    }
    onClose();
  };

  const getTypeLabel = (type: SearchResultType) => {
    switch (type) {
      case 'task':
        return 'Aufgabe';
      case 'client':
        return 'Kunde';
      case 'tag':
        return 'Tag';
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-xl bg-[#1c1c1e] rounded-xl shadow-2xl border border-[#3a3a3c] overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#3a3a3c]">
          <Search className="w-5 h-5 text-[#8e8e93]" />
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Aufgaben, Kunden oder Tags suchen..."
            className="flex-1 bg-transparent text-white text-base placeholder-[#636366] focus:outline-none"
          />
          {inputValue && (
            <button
              onClick={() => {
                setInputValue('');
                setQuery('');
              }}
              className="p-1 hover:bg-[#3a3a3c] rounded transition-colors"
            >
              <X className="w-4 h-4 text-[#8e8e93]" />
            </button>
          )}
        </div>

        {/* Filter Chips */}
        <div className="px-4 py-2 border-b border-[#3a3a3c] flex items-center gap-2 overflow-x-auto">
          {/* Type Filters */}
          <div className="flex items-center gap-1">
            {[
              { value: 'all' as FilterType, label: 'Alle' },
              { value: 'task' as FilterType, label: 'Aufgaben', icon: FileText },
              { value: 'client' as FilterType, label: 'Kunden', icon: Users },
              { value: 'tag' as FilterType, label: 'Tags', icon: Tag },
            ].map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => {
                  setTypeFilter(value);
                  setSelectedIndex(0);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                  typeFilter === value
                    ? 'bg-[#0a84ff] text-white'
                    : 'bg-[#2c2c2e] text-[#aeaeb2] hover:bg-[#3a3a3c]'
                }`}
              >
                {Icon && <Icon className="w-3 h-3" />}
                {label}
              </button>
            ))}
          </div>

          <div className="w-px h-4 bg-[#3a3a3c]" />

          {/* Status Filters (only for tasks) */}
          <div className="flex items-center gap-1">
            {[
              { value: 'all' as StatusFilter, label: 'Alle Status' },
              { value: 'open' as StatusFilter, label: 'Offen' },
              { value: 'completed' as StatusFilter, label: 'Erledigt' },
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => {
                  setStatusFilter(value);
                  setSelectedIndex(0);
                }}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                  statusFilter === value
                    ? 'bg-[#30d158]/20 text-[#30d158]'
                    : 'bg-[#2c2c2e] text-[#aeaeb2] hover:bg-[#3a3a3c]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div ref={resultsRef} className="max-h-[50vh] overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-[#8e8e93]">
              {query || typeFilter !== 'all' || statusFilter !== 'all'
                ? 'Keine Ergebnisse gefunden'
                : 'Beginne zu tippen oder wähle einen Filter...'}
            </div>
          ) : (
            <div className="py-2">
              {!query && typeFilter === 'all' && statusFilter === 'all' && (
                <div className="px-4 py-1.5 text-xs text-[#8e8e93] uppercase tracking-wide font-medium">
                  Zuletzt
                </div>
              )}
              {(query || typeFilter !== 'all' || statusFilter !== 'all') && (
                <div className="px-4 py-1.5 text-xs text-[#8e8e93]">
                  {results.length} Ergebnis{results.length !== 1 ? 'se' : ''}
                </div>
              )}
              {results.map((result, index) => (
                <button
                  key={`${result.type}-${result.id}`}
                  data-index={index}
                  onClick={() => handleSelect(result)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    index === selectedIndex
                      ? 'bg-[#0a84ff]/20'
                      : 'hover:bg-[#2c2c2e]'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      result.color ? '' : 'bg-[#2c2c2e]'
                    }`}
                    style={result.color ? { backgroundColor: `${result.color}25`, color: result.color } : { color: '#aeaeb2' }}
                  >
                    {result.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white truncate">{result.title}</div>
                    {result.subtitle && (
                      <div className="text-sm text-[#8e8e93] truncate">{result.subtitle}</div>
                    )}
                  </div>
                  <div className="text-xs text-[#aeaeb2] px-2 py-0.5 bg-[#2c2c2e] rounded font-medium">
                    {getTypeLabel(result.type)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-[#3a3a3c] flex items-center gap-4 text-xs text-[#8e8e93]">
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-[#2c2c2e] text-[#aeaeb2] rounded font-medium">↑↓</kbd>
            Navigieren
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-[#2c2c2e] text-[#aeaeb2] rounded font-medium">↵</kbd>
            Öffnen
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-[#2c2c2e] text-[#aeaeb2] rounded font-medium">esc</kbd>
            Schließen
          </span>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
