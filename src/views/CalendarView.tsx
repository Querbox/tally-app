import { useMemo, useState, useEffect, useCallback } from 'react';
import { useTaskStore } from '../stores/taskStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useShallow } from 'zustand/react/shallow';
import { getTodayString, addDays, formatDateGerman } from '../utils/dateUtils';
import { matchesShortcut, getShortcutById } from '../config/shortcuts';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Video,
  RefreshCw,
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { Task } from '../types';

/**
 * KALENDER-ANSICHT: "HEUTE + HORIZONT"
 * ====================================
 *
 * Design-Prinzipien:
 * - Heute ist der Fokus (große Darstellung)
 * - Die Woche ist Kontext, nicht Kontrolle
 * - Leere Tage sind neutral (kein "Keine Aufgaben")
 * - Keine Progress-Bars (reduziert Druck)
 * - Meetings immer oben (zeitkritisch)
 * - Drag & Drop: ruhig, stabil, vorhersehbar
 */

export function CalendarView() {
  const { tasks, clients, updateTask, generateMeetingInstancesForDates } = useTaskStore(
    useShallow((s) => ({
      tasks: s.tasks,
      clients: s.clients,
      updateTask: s.updateTask,
      generateMeetingInstancesForDates: s.generateMeetingInstancesForDates,
    }))
  );
  const showWeekends = useSettingsStore((s) => s.showWeekends);

  const today = getTodayString();

  // Week navigation
  const [weekStart, setWeekStart] = useState(() => {
    const todayDate = new Date();
    const day = todayDate.getDay();
    const diff = todayDate.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(todayDate.setDate(diff)).toISOString().split('T')[0];
  });

  // Expanded day (for mobile/compact view)
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  // Drag & Drop State - simplified, no rotation
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  // Keyboard move mode
  const [moveMode, setMoveMode] = useState<{
    active: boolean;
    taskId: string | null;
    previewDate: string | null;
  }>({ active: false, taskId: null, previewDate: null });

  // Selected task for keyboard navigation
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Calculate week days
  const weekDays = useMemo(() => {
    const days: string[] = [];
    const daysToShow = showWeekends ? 7 : 5;
    for (let i = 0; i < daysToShow; i++) {
      days.push(addDays(weekStart, i));
    }
    return days;
  }, [weekStart, showWeekends]);

  // Other days (not today) for the horizon
  const otherDays = useMemo(() => {
    return weekDays.filter((d) => d !== today);
  }, [weekDays, today]);

  // Is today in current week?
  const isTodayInWeek = weekDays.includes(today);

  // Generate recurring meetings
  useEffect(() => {
    generateMeetingInstancesForDates(weekDays);
  }, [weekDays, generateMeetingInstancesForDates]);

  // Helper functions
  const getTasksForDate = useCallback(
    (date: string) => {
      const dateTasks = tasks.filter((t) => t.scheduledDate === date);
      // Sort: Meetings first (by time), then other tasks
      return dateTasks.sort((a, b) => {
        if (a.isMeeting && !b.isMeeting) return -1;
        if (!a.isMeeting && b.isMeeting) return 1;
        if (a.isMeeting && b.isMeeting && a.meetingTime && b.meetingTime) {
          return a.meetingTime.start.localeCompare(b.meetingTime.start);
        }
        return 0;
      });
    },
    [tasks]
  );

  const getClientById = (id?: string) => clients.find((c) => c.id === id);

  const formatWeekRange = () => {
    const start = new Date(weekStart);
    const endOffset = showWeekends ? 6 : 4;
    const end = new Date(addDays(weekStart, endOffset));
    const startMonth = start.toLocaleDateString('de-DE', { month: 'short' });
    const endMonth = end.toLocaleDateString('de-DE', { month: 'short' });

    if (startMonth === endMonth) {
      return `${start.getDate()}. – ${end.getDate()}. ${endMonth}`;
    }
    return `${start.getDate()}. ${startMonth} – ${end.getDate()}. ${endMonth}`;
  };

  const goToCurrentWeek = () => {
    const todayDate = new Date();
    const day = todayDate.getDay();
    const diff = todayDate.getDate() - day + (day === 0 ? -6 : 1);
    setWeekStart(new Date(todayDate.setDate(diff)).toISOString().split('T')[0]);
  };

  const formatDayHeader = (date: string) => {
    const d = new Date(date);
    const dayName = d.toLocaleDateString('de-DE', { weekday: 'short' });
    const dayNum = d.getDate();
    return { dayName, dayNum };
  };

  // Drag & Drop Handlers - simplified, stable
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
    setDragOverDate(null);
  };

  const handleDragOver = (e: React.DragEvent, date: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverDate !== date) {
      setDragOverDate(date);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setDragOverDate(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetDate: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    const task = tasks.find((t) => t.id === taskId);

    if (task && task.scheduledDate !== targetDate) {
      updateTask(task.id, { scheduledDate: targetDate });
    }

    setDraggedTask(null);
    setDragOverDate(null);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if typing in input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Move mode shortcuts
      if (moveMode.active && moveMode.taskId) {
        const currentIndex = weekDays.indexOf(moveMode.previewDate || today);

        switch (e.key) {
          case 'ArrowLeft':
            e.preventDefault();
            if (currentIndex > 0) {
              setMoveMode({ ...moveMode, previewDate: weekDays[currentIndex - 1] });
            }
            break;
          case 'ArrowRight':
            e.preventDefault();
            if (currentIndex < weekDays.length - 1) {
              setMoveMode({ ...moveMode, previewDate: weekDays[currentIndex + 1] });
            }
            break;
          case 'Enter':
            e.preventDefault();
            if (moveMode.previewDate && moveMode.taskId) {
              const task = tasks.find((t) => t.id === moveMode.taskId);
              if (task && task.scheduledDate !== moveMode.previewDate) {
                updateTask(moveMode.taskId, { scheduledDate: moveMode.previewDate });
              }
            }
            setMoveMode({ active: false, taskId: null, previewDate: null });
            setSelectedTaskId(null);
            break;
          case 'Escape':
            e.preventDefault();
            setMoveMode({ active: false, taskId: null, previewDate: null });
            break;
        }
        return;
      }

      // Week navigation - using central config
      const prevWeekShortcut = getShortcutById('calendarPrevWeek');
      const nextWeekShortcut = getShortcutById('calendarNextWeek');
      const moveTaskShortcut = getShortcutById('calendarMoveTask');

      if (prevWeekShortcut && matchesShortcut(e, prevWeekShortcut)) {
        e.preventDefault();
        setWeekStart(addDays(weekStart, -7));
      } else if (nextWeekShortcut && matchesShortcut(e, nextWeekShortcut)) {
        e.preventDefault();
        setWeekStart(addDays(weekStart, 7));
      }

      // Start move mode for selected task - using central config
      if (moveTaskShortcut && matchesShortcut(e, moveTaskShortcut) && selectedTaskId) {
        e.preventDefault();
        const task = tasks.find((t) => t.id === selectedTaskId);
        if (task) {
          setMoveMode({
            active: true,
            taskId: selectedTaskId,
            previewDate: task.scheduledDate,
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moveMode, selectedTaskId, weekDays, today, tasks, updateTask, weekStart]);

  // Today's tasks
  const todayTasks = getTasksForDate(today);
  const todayMeetings = todayTasks.filter((t) => t.isMeeting);
  const todayRegularTasks = todayTasks.filter((t) => !t.isMeeting);

  return (
    <div className="flex-1 bg-[#f5f5f7] h-full flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white/80 glass border-b border-gray-200/50 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Woche</h1>
            <p className="text-sm text-gray-500 mt-0.5">{formatWeekRange()}</p>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setWeekStart(addDays(weekStart, -7))}
              className="p-2 hover:bg-gray-100 rounded-lg transition-all btn-press"
              title="Vorherige Woche (Alt+←)"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={goToCurrentWeek}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-all btn-press"
            >
              Heute
            </button>
            <button
              onClick={() => setWeekStart(addDays(weekStart, 7))}
              className="p-2 hover:bg-gray-100 rounded-lg transition-all btn-press"
              title="Nächste Woche (Alt+→)"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content: Heute + Horizont */}
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-6xl mx-auto">
          {/* Move Mode Indicator */}
          {moveMode.active && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
              <p className="text-sm text-blue-700">
                <span className="font-medium">Verschieben:</span> ← → zum Wählen, Enter
                zum Bestätigen, Esc zum Abbrechen
              </p>
            </div>
          )}

          <div className="flex gap-6">
            {/* HEUTE Panel - große Darstellung */}
            {isTodayInWeek && (
              <div className="w-1/2 flex-shrink-0">
                <div className="mb-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-8 h-8 bg-gray-900 text-white rounded-full text-sm font-semibold">
                      {new Date(today).getDate()}
                    </span>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Heute</h2>
                      <p className="text-xs text-gray-500">{formatDateGerman(today)}</p>
                    </div>
                  </div>
                </div>

                <div
                  onDragOver={(e) => handleDragOver(e, today)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, today)}
                  className={`
                    bg-white rounded-2xl shadow-lg ring-1 ring-gray-900/5 p-4 min-h-[400px]
                    transition-all duration-150
                    ${dragOverDate === today ? 'ring-2 ring-blue-400 bg-blue-50/30' : ''}
                    ${moveMode.previewDate === today ? 'ring-2 ring-blue-400' : ''}
                  `}
                >
                  {/* Meetings Section */}
                  {todayMeetings.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                        Termine
                      </p>
                      <div className="space-y-2">
                        {todayMeetings.map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            client={getClientById(task.clientId)}
                            isSelected={selectedTaskId === task.id}
                            isMovePreview={moveMode.taskId === task.id}
                            onSelect={() => setSelectedTaskId(task.id)}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            isDragging={draggedTask?.id === task.id}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tasks Section */}
                  {todayRegularTasks.length > 0 && (
                    <div>
                      {todayMeetings.length > 0 && (
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                          Aufgaben
                        </p>
                      )}
                      <div className="space-y-2">
                        {todayRegularTasks.map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            client={getClientById(task.clientId)}
                            isSelected={selectedTaskId === task.id}
                            isMovePreview={moveMode.taskId === task.id}
                            onSelect={() => setSelectedTaskId(task.id)}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            isDragging={draggedTask?.id === task.id}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty State - neutral, nicht wertend */}
                  {todayTasks.length === 0 && !dragOverDate && (
                    <div className="flex flex-col items-center justify-center h-48 text-gray-300">
                      <Calendar className="w-8 h-8 mb-2" />
                      <p className="text-sm">Freier Tag</p>
                    </div>
                  )}

                  {/* Drop Indicator */}
                  {dragOverDate === today && draggedTask?.scheduledDate !== today && (
                    <div className="mt-2 border-2 border-dashed border-blue-300 rounded-xl p-3 bg-blue-50/50">
                      <p className="text-sm text-blue-600 text-center">Hier ablegen</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* HORIZONT - kompakte Wochenkacheln */}
            <div className={isTodayInWeek ? 'flex-1' : 'w-full'}>
              <div className="mb-3">
                <h2 className="text-sm font-medium text-gray-500">
                  {isTodayInWeek ? 'Diese Woche' : 'Wochenübersicht'}
                </h2>
              </div>

              <div
                className={`grid gap-3 ${
                  isTodayInWeek
                    ? otherDays.length <= 4
                      ? 'grid-cols-2'
                      : 'grid-cols-3'
                    : showWeekends
                      ? 'grid-cols-7'
                      : 'grid-cols-5'
                }`}
              >
                {(isTodayInWeek ? otherDays : weekDays).map((date) => {
                  const dayTasks = getTasksForDate(date);
                  const { dayName, dayNum } = formatDayHeader(date);
                  const isPast = date < today;
                  const isExpanded = expandedDay === date;
                  const isDropTarget = dragOverDate === date;
                  const isMoveTarget = moveMode.previewDate === date;
                  const meetingCount = dayTasks.filter((t) => t.isMeeting).length;
                  const taskCount = dayTasks.filter((t) => !t.isMeeting).length;

                  return (
                    <div
                      key={date}
                      onDragOver={(e) => handleDragOver(e, date)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, date)}
                      className={`
                        rounded-xl p-3 transition-all duration-150 cursor-pointer
                        ${isPast ? 'bg-gray-100/60' : 'bg-white/80'}
                        ${isDropTarget ? 'ring-2 ring-blue-400 bg-blue-50/50' : ''}
                        ${isMoveTarget ? 'ring-2 ring-blue-400 bg-blue-50' : ''}
                        ${!isDropTarget && !isMoveTarget ? 'hover:bg-white hover:shadow-sm' : ''}
                        ${date === today && !isTodayInWeek ? 'ring-1 ring-gray-900/10 bg-white shadow-sm' : ''}
                      `}
                      onClick={() => setExpandedDay(isExpanded ? null : date)}
                    >
                      {/* Day Header */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-medium uppercase tracking-wide ${
                              isPast ? 'text-gray-400' : 'text-gray-500'
                            }`}
                          >
                            {dayName}
                          </span>
                          <span
                            className={`text-lg font-semibold ${
                              date === today
                                ? 'text-white bg-gray-900 w-7 h-7 rounded-full flex items-center justify-center text-sm'
                                : isPast
                                  ? 'text-gray-400'
                                  : 'text-gray-900'
                            }`}
                          >
                            {dayNum}
                          </span>
                        </div>
                        {dayTasks.length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedDay(isExpanded ? null : date);
                            }}
                            className="p-1 hover:bg-gray-100 rounded transition-all"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            )}
                          </button>
                        )}
                      </div>

                      {/* Task Summary */}
                      {!isExpanded && dayTasks.length > 0 && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          {meetingCount > 0 && (
                            <span className="flex items-center gap-1">
                              <Video className="w-3 h-3" />
                              {meetingCount}
                            </span>
                          )}
                          {taskCount > 0 && (
                            <span className="flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              {taskCount}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Expanded Task List */}
                      {isExpanded && (
                        <div className="mt-2 space-y-1.5">
                          {dayTasks.map((task) => (
                            <CompactTaskCard
                              key={task.id}
                              task={task}
                              client={getClientById(task.clientId)}
                              onDragStart={handleDragStart}
                              onDragEnd={handleDragEnd}
                              isDragging={draggedTask?.id === task.id}
                            />
                          ))}
                        </div>
                      )}

                      {/* Drop Indicator */}
                      {isDropTarget && draggedTask?.scheduledDate !== date && (
                        <div className="mt-2 border border-dashed border-blue-300 rounded-lg p-2 bg-blue-50/50">
                          <p className="text-xs text-blue-500 text-center">Ablegen</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// === Task Card Components ===

interface TaskCardProps {
  task: Task;
  client?: { name: string; color: string };
  isSelected?: boolean;
  isMovePreview?: boolean;
  onSelect?: () => void;
  onDragStart: (e: React.DragEvent, task: Task) => void;
  onDragEnd: () => void;
  isDragging?: boolean;
}

function TaskCard({
  task,
  client,
  isSelected,
  isMovePreview,
  onSelect,
  onDragStart,
  onDragEnd,
  isDragging,
}: TaskCardProps) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      className={`
        p-3 rounded-xl transition-all cursor-grab active:cursor-grabbing
        ${task.status === 'completed' ? 'bg-gray-50' : 'bg-gray-50 hover:bg-gray-100'}
        ${isSelected ? 'ring-2 ring-gray-900' : ''}
        ${isMovePreview ? 'ring-2 ring-blue-400 bg-blue-50' : ''}
        ${isDragging ? 'opacity-50' : ''}
      `}
    >
      <div className="flex items-start gap-3">
        {/* Status Indicator */}
        <div
          className={`
            w-5 h-5 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center
            ${task.status === 'completed' ? 'bg-gray-400 text-white' : 'border-2 border-gray-300'}
          `}
        >
          {task.status === 'completed' && <Check className="w-3 h-3" />}
        </div>

        <div className="flex-1 min-w-0">
          <p
            className={`text-sm ${
              task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-900'
            }`}
          >
            {task.title}
          </p>

          {/* Meeting Time */}
          {task.isMeeting && task.meetingTime && (
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
              <Video className="w-3 h-3" />
              {task.meetingTime.start}
              {task.recurrenceParentId && <RefreshCw className="w-3 h-3 text-blue-400" />}
            </p>
          )}

          {/* Client */}
          {client && (
            <span
              className="inline-block text-xs px-1.5 py-0.5 rounded mt-1.5"
              style={{ backgroundColor: `${client.color}15`, color: client.color }}
            >
              {client.name}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

interface CompactTaskCardProps {
  task: Task;
  client?: { name: string; color: string };
  onDragStart: (e: React.DragEvent, task: Task) => void;
  onDragEnd: () => void;
  isDragging?: boolean;
}

function CompactTaskCard({
  task,
  client,
  onDragStart,
  onDragEnd,
  isDragging,
}: CompactTaskCardProps) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        onDragStart(e, task);
      }}
      onDragEnd={onDragEnd}
      onClick={(e) => e.stopPropagation()}
      className={`
        p-2 rounded-lg bg-white border border-gray-100
        cursor-grab active:cursor-grabbing transition-all
        hover:border-gray-200 hover:shadow-sm
        ${isDragging ? 'opacity-50' : ''}
        ${task.status === 'completed' ? 'opacity-60' : ''}
      `}
    >
      <div className="flex items-center gap-2">
        {task.isMeeting && <Video className="w-3 h-3 text-gray-400 flex-shrink-0" />}
        {task.status === 'completed' && <Check className="w-3 h-3 text-gray-400 flex-shrink-0" />}
        <span
          className={`text-xs truncate flex-1 ${
            task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-700'
          }`}
        >
          {task.title}
        </span>
        {task.isMeeting && task.meetingTime && (
          <span className="text-xs text-gray-400 flex-shrink-0">{task.meetingTime.start}</span>
        )}
        {client && (
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: client.color }}
          />
        )}
      </div>
    </div>
  );
}
