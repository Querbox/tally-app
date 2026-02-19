import { useState, useRef, memo, useCallback, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Task, Client, Tag, TaskPriority } from '../../types';
import { useTaskStore } from '../../stores/taskStore';
import { useShallow } from 'zustand/react/shallow';
import { useToast } from '../common/Toast';
import { formatDuration } from '../../utils/timeUtils';
import { addDays, getTodayString } from '../../utils/dateUtils';
import { Timer } from '../timer/Timer';
import { TaskDetailModal } from './TaskDetailModal';
import { FocusMode } from '../focus/FocusMode';
import { playGlobalSound } from '../../hooks/useSounds';
import { useClickOutside } from '../../hooks/useClickOutside';
import { extractPlainTextFromTipTap } from './TaskDescriptionEditor';
import { PatternSuggestion } from '../assistance/PatternSuggestion';
import { usePatternStore } from '../../stores/patternStore';
import {
  Check, Clock, Flag, Target, ListChecks, RefreshCw,
  Trash2, Calendar, CalendarPlus, Copy, CheckCircle, Circle, Edit3, Sparkles, FileText
} from 'lucide-react';
import { useDocumentStore } from '../../stores/documentStore';

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bgColor: string }> = {
  urgent: { label: 'Dringend', color: '#dc2626', bgColor: '#fef2f2' },
  high: { label: 'Hoch', color: '#ea580c', bgColor: '#fff7ed' },
  medium: { label: 'Normal', color: '#2563eb', bgColor: '#eff6ff' },
  low: { label: 'Niedrig', color: '#6b7280', bgColor: '#f9fafb' },
};

const PRIORITIES: TaskPriority[] = ['urgent', 'high', 'medium', 'low'];

interface TaskItemProps {
  task: Task;
  client?: Client;
  tags: Tag[];
  draggable?: boolean;
  onDragStart?: (task: Task, e: React.DragEvent) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  onSetFocus?: (task: Task) => void;
  isFocused?: boolean;
  expertMode?: boolean; // Expert-Mode: zeigt alle Prioritäten und Timer-Button
  // Bulk selection props
  isSelected?: boolean;
  onToggleSelection?: (taskId: string) => void;
  showSelectionCheckbox?: boolean;
}

// Custom comparison for memo - only re-render when relevant props change
function arePropsEqual(prevProps: TaskItemProps, nextProps: TaskItemProps): boolean {
  // Task-level changes
  if (prevProps.task.id !== nextProps.task.id) return false;
  if (prevProps.task.title !== nextProps.task.title) return false;
  if (prevProps.task.status !== nextProps.task.status) return false;
  if (prevProps.task.priority !== nextProps.task.priority) return false;
  if (prevProps.task.description !== nextProps.task.description) return false;
  if (prevProps.task.scheduledDate !== nextProps.task.scheduledDate) return false;
  if (prevProps.task.isOptional !== nextProps.task.isOptional) return false;
  if (prevProps.task.subtasks.length !== nextProps.task.subtasks.length) return false;
  if (prevProps.task.timeEntries.length !== nextProps.task.timeEntries.length) return false;
  if (prevProps.task.postponeCount !== nextProps.task.postponeCount) return false;

  // Check subtasks completion status
  const prevCompleted = prevProps.task.subtasks.filter(s => s.isCompleted).length;
  const nextCompleted = nextProps.task.subtasks.filter(s => s.isCompleted).length;
  if (prevCompleted !== nextCompleted) return false;

  // Selection state
  if (prevProps.isSelected !== nextProps.isSelected) return false;
  if (prevProps.showSelectionCheckbox !== nextProps.showSelectionCheckbox) return false;

  // Check total time
  const prevTime = prevProps.task.timeEntries.reduce((acc, e) => acc + (e.duration || 0), 0);
  const nextTime = nextProps.task.timeEntries.reduce((acc, e) => acc + (e.duration || 0), 0);
  if (prevTime !== nextTime) return false;

  // Client & tags
  if (prevProps.client?.id !== nextProps.client?.id) return false;
  if (prevProps.client?.name !== nextProps.client?.name) return false;
  if (prevProps.client?.color !== nextProps.client?.color) return false;
  if (prevProps.tags.length !== nextProps.tags.length) return false;

  // Drag state
  if (prevProps.isDragging !== nextProps.isDragging) return false;
  if (prevProps.draggable !== nextProps.draggable) return false;

  // Focus state
  if (prevProps.isFocused !== nextProps.isFocused) return false;
  if (!!prevProps.onSetFocus !== !!nextProps.onSetFocus) return false;

  // Expert mode
  if (prevProps.expertMode !== nextProps.expertMode) return false;

  return true;
}

export const TaskItem = memo(function TaskItem({
  task,
  client,
  tags,
  draggable = true,
  onDragStart,
  onDragEnd,
  isDragging = false,
  onSetFocus,
  isFocused = false,
  expertMode = false,
  isSelected = false,
  onToggleSelection,
  showSelectionCheckbox = false,
}: TaskItemProps) {
  // Optimized: single store subscription instead of 5 separate ones
  const { updateTask, deleteTask, restoreTask, addTask, setTaskPriority } = useTaskStore(
    useShallow((s) => ({
      updateTask: s.updateTask,
      deleteTask: s.deleteTask,
      restoreTask: s.restoreTask,
      addTask: s.addTask,
      setTaskPriority: s.setTaskPriority,
    }))
  );
  const { withUndo } = useToast();
  const [showDetail, setShowDetail] = useState(false);
  const [showFocusMode, setShowFocusMode] = useState(false);
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ top: 0, left: 0 });
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const priorityMenuRef = useRef<HTMLDivElement>(null);
  const priorityButtonRef = useRef<HTMLButtonElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Check if task has linked documents
  const hasDocuments = useDocumentStore((s) => s.documents.some((doc) => doc.taskId === task.id));

  // Memoize expensive calculations
  const totalTime = useMemo(
    () => task.timeEntries.reduce((acc, entry) => acc + (entry.duration || 0), 0),
    [task.timeEntries]
  );

  const completedSubtasks = useMemo(
    () => task.subtasks.filter((s) => s.isCompleted).length,
    [task.subtasks]
  );
  const priority = task.priority || 'medium';
  const priorityConfig = PRIORITY_CONFIG[priority];

  // Pattern-Erkennung für intelligente Assistenz
  // Stabile Selektion: nur IDs extrahieren statt .filter() (erzeugt sonst neue Referenzen)
  const allActivePatterns = usePatternStore((s) => s.activePatterns);
  const activePatterns = useMemo(
    () => allActivePatterns.filter(
      (p) => p.taskIds.includes(task.id) && p.renderTarget === 'inline'
    ),
    [allActivePatterns, task.id]
  );

  const handlePatternAction = useCallback(
    (_patternId: string, action: string) => {
      switch (action) {
        case 'markOptional':
          updateTask(task.id, { isOptional: true });
          return;
        case 'deprioritize':
          updateTask(task.id, { priority: 'low' });
          return;
        case 'delete':
          deleteTask(task.id);
          return;
        case 'acceptClient': {
          const pattern = activePatterns.find(
            (p) => p.patternType === 'autoClient' && p.payload.type === 'autoClient'
          );
          if (pattern && pattern.payload.type === 'autoClient') {
            updateTask(task.id, { clientId: pattern.payload.suggestedClientId });
          }
          return;
        }
        case 'reschedule':
          setShowDetail(true);
          return;
        case 'setFocus':
          if (onSetFocus) onSetFocus(task);
          return;
      }
    },
    [task, activePatterns, updateTask, deleteTask, onSetFocus]
  );

  // Meeting urgency state - updates every minute
  const [minutesUntilMeeting, setMinutesUntilMeeting] = useState<number | null>(null);

  useEffect(() => {
    if (!task.isMeeting || !task.meetingTime || task.status === 'completed') {
      setMinutesUntilMeeting(null);
      return;
    }

    const calculateMinutes = () => {
      const now = new Date();
      const [hours, minutes] = task.meetingTime!.start.split(':').map(Number);
      const meetingTime = new Date();
      meetingTime.setHours(hours, minutes, 0, 0);

      const diffMs = meetingTime.getTime() - now.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      // Only show for meetings within 2 hours in future or 10 mins in past
      if (diffMins >= -10 && diffMins <= 120) {
        setMinutesUntilMeeting(diffMins);
      } else {
        setMinutesUntilMeeting(null);
      }
    };

    calculateMinutes();
    const interval = setInterval(calculateMinutes, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [task.isMeeting, task.meetingTime, task.status]);

  // Close menus when clicking outside
  const closePriorityMenu = useCallback(() => setShowPriorityMenu(false), []);
  const closeContextMenu = useCallback(() => setShowContextMenu(false), []);
  useClickOutside(priorityMenuRef, closePriorityMenu, showPriorityMenu);
  useClickOutside(contextMenuRef, closeContextMenu, showContextMenu);

  const handleToggleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    const wasNotCompleted = task.status !== 'completed';
    updateTask(task.id, {
      status: wasNotCompleted ? 'completed' : 'todo',
      completedAt: wasNotCompleted ? new Date().toISOString() : undefined,
    });
    // Play completion sound when marking as complete
    if (wasNotCompleted) {
      playGlobalSound('taskComplete');
    }
  };

  const handlePriorityClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!showPriorityMenu && priorityButtonRef.current) {
      const rect = priorityButtonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
    setShowPriorityMenu(!showPriorityMenu);
  };

  const handleSetPriority = (newPriority: TaskPriority) => {
    setTaskPriority(task.id, newPriority);
    setShowPriorityMenu(false);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPosition({ top: e.clientY, left: e.clientX });
    setShowContextMenu(true);
  };

  const handleDeleteTask = () => {
    playGlobalSound('taskDelete');
    deleteTask(task.id);
    setShowContextMenu(false);

    // Show toast with undo option
    withUndo(
      `"${task.title}" gelöscht`,
      () => {
        restoreTask(task.id);
      }
    );
  };

  const handleDuplicateTask = () => {
    addTask({
      title: task.title,
      description: task.description,
      status: 'todo',
      scheduledDate: task.scheduledDate,
      deadline: task.deadline,
      clientId: task.clientId,
      tagIds: task.tagIds,
      subtasks: task.subtasks.map((s, i) => ({
        id: Math.random().toString(36).substring(2, 15),
        title: s.title,
        isCompleted: false,
        order: i,
      })),
      isSpontaneous: task.isSpontaneous,
      isMeeting: task.isMeeting,
      meetingTime: task.meetingTime,
      timeEntries: [],
      priority: task.priority,
    });
    setShowContextMenu(false);
  };

  const handleMoveToTomorrow = () => {
    const tomorrow = addDays(getTodayString(), 1);
    updateTask(task.id, { scheduledDate: tomorrow });
    setShowContextMenu(false);
  };

  const handleMoveToToday = () => {
    updateTask(task.id, { scheduledDate: getTodayString(), isOptional: false });
    setShowContextMenu(false);
  };

  const handleToggleOptional = () => {
    updateTask(task.id, { isOptional: !task.isOptional });
    setShowContextMenu(false);
  };

  const handleSetAsFocus = () => {
    if (onSetFocus) {
      onSetFocus(task);
    }
    setShowContextMenu(false);
  };

  const handleMarkComplete = () => {
    updateTask(task.id, {
      status: 'completed',
      completedAt: new Date().toISOString(),
    });
    playGlobalSound('taskComplete');
    setShowContextMenu(false);
  };

  const handleMarkIncomplete = () => {
    updateTask(task.id, {
      status: 'todo',
      completedAt: undefined,
    });
    setShowContextMenu(false);
  };

  // Handle drag start - setzt die Task-ID in dataTransfer
  const handleDragStart = useCallback((e: React.DragEvent) => {
    // Wichtig: effectAllowed VOR setData setzen
    e.dataTransfer.effectAllowed = 'move';

    // Setze Daten in mehreren Formaten für maximale Kompatibilität
    try {
      e.dataTransfer.setData('text/plain', task.id);
      e.dataTransfer.setData('text', task.id);
      e.dataTransfer.setData('application/x-task-id', task.id);
    } catch {
      // Fallback für Umgebungen wo setData nicht funktioniert
      console.log('dataTransfer.setData not supported, using state fallback');
    }

    // Callback an Parent (DayView) - dieser speichert die ID im State als Backup
    if (onDragStart) {
      onDragStart(task, e);
    }
  }, [task, onDragStart]);

  return (
    <>
      <div
        draggable={draggable && !task.isMeeting}
        onDragStart={handleDragStart}
        onDragEnd={onDragEnd}
        onClick={() => setShowDetail(true)}
        onContextMenu={handleContextMenu}
        className={`
          group relative bg-white rounded-2xl border border-gray-100 shadow-sm
          p-4 transition-all duration-200 card-hover cursor-pointer select-none
          ${task.status === 'completed' ? 'opacity-60' : ''}
          ${isDragging ? 'opacity-50 scale-95 ring-2 ring-blue-400 shadow-lg' : ''}
          ${draggable && !task.isMeeting ? 'cursor-grab active:cursor-grabbing' : ''}
        `}
      >
        <div className="flex items-start gap-3">
          {/* Selection Checkbox (for bulk operations) */}
          {showSelectionCheckbox && onToggleSelection && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelection(task.id);
              }}
              className={`
                mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0
                transition-all duration-200 flex items-center justify-center
                ${isSelected
                  ? 'bg-blue-500 border-blue-500 text-white'
                  : 'border-gray-300 hover:border-blue-400'
                }
              `}
            >
              {isSelected && <Check className="w-3 h-3" />}
            </button>
          )}

          {/* Task Completion Checkbox */}
          <button
            onClick={handleToggleComplete}
            className={`
              mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0
              transition-all duration-200 flex items-center justify-center btn-press
              ${
                task.status === 'completed'
                  ? 'bg-gray-900 border-gray-900 text-white scale-100'
                  : 'border-gray-300 hover:border-gray-400 hover:scale-105'
              }
            `}
          >
            {task.status === 'completed' && <Check className="w-3 h-3" />}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {/* Priority Flag - Expert-Mode zeigt alle, sonst nur urgent/high */}
              {!task.isMeeting && (expertMode || priority === 'urgent' || priority === 'high') && (
                <div className="relative">
                  <button
                    ref={priorityButtonRef}
                    onClick={handlePriorityClick}
                    className="p-0.5 rounded hover:bg-gray-100 transition-all"
                    title={priority === 'urgent' ? 'Dringend' : 'Wichtig'}
                  >
                    <Flag
                      className="w-4 h-4"
                      style={{ color: priorityConfig.color }}
                      fill={priority === 'urgent' ? priorityConfig.color : 'none'}
                    />
                  </button>
                </div>
              )}

              <h3
                className={`
                  font-medium text-gray-900
                  ${task.status === 'completed' ? 'line-through text-gray-500' : ''}
                `}
              >
                {task.title}
              </h3>

              {task.isMeeting && task.meetingTime && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                    {task.meetingTime.start} - {task.meetingTime.end}
                    {task.recurrenceParentId && (
                      <span title="Wiederkehrendes Meeting">
                        <RefreshCw className="w-3 h-3 text-blue-500" />
                      </span>
                    )}
                  </span>
                  {/* Urgency Badge */}
                  {minutesUntilMeeting !== null && (
                    <span
                      className={`
                        text-xs font-medium px-2 py-0.5 rounded-full
                        ${minutesUntilMeeting <= 0
                          ? 'bg-red-100 text-red-700 animate-pulse'
                          : minutesUntilMeeting <= 15
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-blue-50 text-blue-600'
                        }
                      `}
                    >
                      {minutesUntilMeeting <= -5
                        ? 'Läuft'
                        : minutesUntilMeeting <= 0
                          ? 'Jetzt!'
                          : minutesUntilMeeting === 1
                            ? 'In 1 Min'
                            : `In ${minutesUntilMeeting} Min`
                      }
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Description Preview */}
            {task.description && (
              <p className="text-sm text-gray-500 mt-1 truncate">
                {extractPlainTextFromTipTap(task.description)}
              </p>
            )}

            {/* Meta Row */}
            <div className="flex items-center gap-3 mt-2">
              {client && (
                <span
                  className="text-xs px-2 py-0.5 rounded"
                  style={{ backgroundColor: `${client.color}15`, color: client.color }}
                >
                  {client.name}
                </span>
              )}
              {hasDocuments && (
                <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500 flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                </span>
              )}

              {tags.slice(0, 2).map((tag) => (
                <span
                  key={tag.id}
                  className="text-xs px-2 py-0.5 rounded"
                  style={{ backgroundColor: `${tag.color}15`, color: tag.color }}
                >
                  {tag.name}
                </span>
              ))}
              {tags.length > 2 && (
                <span className="text-xs text-gray-400">+{tags.length - 2}</span>
              )}

              {task.subtasks.length > 0 && (
                <span className="text-xs text-gray-400 flex items-center gap-1.5">
                  <ListChecks className="w-3 h-3" />
                  <span>{completedSubtasks}/{task.subtasks.length}</span>
                  <span className="w-12 h-1 bg-gray-200 rounded-full overflow-hidden">
                    <span
                      className="block h-full bg-gray-500 rounded-full transition-all"
                      style={{ width: `${(completedSubtasks / task.subtasks.length) * 100}%` }}
                    />
                  </span>
                </span>
              )}

              {/* Postpone-Counter entfernt - Details zeigen es bei Bedarf */}
            </div>
          </div>

          {/* Right Side: Quick Actions, Focus, Timer & Time */}
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {totalTime > 0 && (
              <span className="text-xs text-gray-400 font-mono flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDuration(totalTime)}
              </span>
            )}

            {/* Timer: Expert-Mode zeigt immer, sonst nur wenn bereits Zeit erfasst */}
            {!task.isMeeting && (expertMode || totalTime > 0) && <Timer task={task} />}
          </div>
        </div>

        {/* Intelligente Assistenz: Pattern-Suggestions */}
        {activePatterns.map((pattern) => (
          <PatternSuggestion
            key={pattern.id}
            pattern={pattern}
            onAction={handlePatternAction}
          />
        ))}
      </div>

      {showDetail && (
        <TaskDetailModal task={task} onClose={() => setShowDetail(false)} />
      )}

      {showFocusMode && createPortal(
        <FocusMode task={task} onClose={() => setShowFocusMode(false)} />,
        document.body
      )}

      {showPriorityMenu && createPortal(
        <div
          ref={priorityMenuRef}
          className="fixed bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[140px]"
          style={{ top: menuPosition.top, left: menuPosition.left, zIndex: 9999 }}
        >
          {PRIORITIES.map((p) => (
            <button
              key={p}
              onClick={(e) => {
                e.stopPropagation();
                handleSetPriority(p);
              }}
              className={`
                w-full px-3 py-1.5 text-left text-sm flex items-center gap-2
                hover:bg-gray-50 transition-colors
                ${p === priority ? 'bg-gray-50' : ''}
              `}
            >
              <Flag
                className="w-3.5 h-3.5"
                style={{ color: PRIORITY_CONFIG[p].color }}
                fill={p === 'urgent' ? PRIORITY_CONFIG[p].color : 'none'}
              />
              <span style={{ color: PRIORITY_CONFIG[p].color }}>
                {PRIORITY_CONFIG[p].label}
              </span>
            </button>
          ))}
        </div>,
        document.body
      )}

      {/* Context Menu */}
      {showContextMenu && createPortal(
        <div
          ref={contextMenuRef}
          className="fixed bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 min-w-[200px] animate-scale-in"
          style={{ top: contextMenuPosition.top, left: contextMenuPosition.left, zIndex: 9999 }}
        >
          {/* === GRUPPE 1: Hauptaktionen === */}
          {/* Edit */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowContextMenu(false);
              setShowDetail(true);
            }}
            className="w-full px-3 py-2 text-left text-sm flex items-center gap-3 hover:bg-gray-50 transition-colors text-gray-700"
          >
            <Edit3 className="w-4 h-4 text-gray-400" />
            Bearbeiten
          </button>

          {/* Duplicate */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDuplicateTask();
            }}
            className="w-full px-3 py-2 text-left text-sm flex items-center gap-3 hover:bg-gray-50 transition-colors text-gray-700"
          >
            <Copy className="w-4 h-4 text-gray-400" />
            Duplizieren
          </button>

          <div className="border-t border-gray-100 my-1.5" />

          {/* === GRUPPE 2: Status === */}
          {/* Set as Focus - nur für Nicht-Meetings und offene Aufgaben */}
          {onSetFocus && !task.isMeeting && task.status !== 'completed' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSetAsFocus();
              }}
              className={`w-full px-3 py-2 text-left text-sm flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                isFocused ? 'text-purple-600' : 'text-gray-700'
              }`}
            >
              <Target className={`w-4 h-4 ${isFocused ? 'text-purple-500' : 'text-gray-400'}`} />
              {isFocused ? 'Fokus aufheben' : 'Als Fokus setzen'}
            </button>
          )}

          {/* Complete/Incomplete */}
          {task.status === 'completed' ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleMarkIncomplete();
              }}
              className="w-full px-3 py-2 text-left text-sm flex items-center gap-3 hover:bg-gray-50 transition-colors text-gray-700"
            >
              <Circle className="w-4 h-4 text-gray-400" />
              Als offen markieren
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleMarkComplete();
              }}
              className="w-full px-3 py-2 text-left text-sm flex items-center gap-3 hover:bg-gray-50 transition-colors text-gray-700"
            >
              <CheckCircle className="w-4 h-4 text-green-500" />
              Als erledigt markieren
            </button>
          )}

          <div className="border-t border-gray-100 my-1.5" />

          {/* === GRUPPE 3: Zeitliche Verschiebung === */}
          {/* Move to Today (if not already today) */}
          {task.scheduledDate !== getTodayString() && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleMoveToToday();
              }}
              className="w-full px-3 py-2 text-left text-sm flex items-center gap-3 hover:bg-gray-50 transition-colors text-gray-700"
            >
              <Calendar className="w-4 h-4 text-blue-500" />
              Auf heute verschieben
            </button>
          )}

          {/* Move to Tomorrow */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleMoveToTomorrow();
            }}
            className="w-full px-3 py-2 text-left text-sm flex items-center gap-3 hover:bg-gray-50 transition-colors text-gray-700"
          >
            <CalendarPlus className="w-4 h-4 text-blue-500" />
            Auf morgen verschieben
          </button>

          {/* Toggle Optional - nur für Heute und Nicht-Meetings */}
          {task.scheduledDate === getTodayString() && !task.isMeeting && task.status !== 'completed' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleOptional();
              }}
              className={`w-full px-3 py-2 text-left text-sm flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                task.isOptional ? 'text-blue-600' : 'text-amber-600'
              }`}
            >
              {task.isOptional ? (
                <>
                  <Flag className="w-4 h-4 text-blue-500" />
                  Als Pflicht markieren
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Als optional markieren
                </>
              )}
            </button>
          )}

          <div className="border-t border-gray-100 my-1.5" />

          {/* === GRUPPE 4: Destruktiv === */}
          {/* Delete */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteTask();
            }}
            className="w-full px-3 py-2 text-left text-sm flex items-center gap-3 hover:bg-red-50 transition-colors text-red-600"
          >
            <Trash2 className="w-4 h-4" />
            Löschen
          </button>
        </div>,
        document.body
      )}
    </>
  );
}, arePropsEqual);
