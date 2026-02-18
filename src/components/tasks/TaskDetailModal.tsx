import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Task, TimeEntry } from '../../types';
import { useTaskStore } from '../../stores/taskStore';
import { formatDuration } from '../../utils/timeUtils';
import { generateId } from '../../utils/idUtils';
import { playGlobalSound } from '../../hooks/useSounds';
import { useClickOutside } from '../../hooks/useClickOutside';
import { X, Plus, Trash2, Clock, Calendar, Tag, User, PlusCircle, ChevronDown, Check, Layers, ChevronRight, FileText, Info } from 'lucide-react';
import { DocumentList } from '../documents/DocumentList';
import Whiteboard from '../whiteboard/Whiteboard';
import { TaskDescriptionEditor } from './TaskDescriptionEditor';

// Whiteboard Node Interface für Hierarchie
interface WhiteboardNode {
  id: string;
  subtaskId?: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed';
  parentId: string | null;
  color: string;
}

// Hilfsfunktion um Whiteboard-Daten zu laden
function loadWhiteboardNodes(taskId: string): WhiteboardNode[] {
  try {
    const stored = localStorage.getItem('tally-whiteboards-v4');
    if (!stored) return [];
    const data = JSON.parse(stored);
    const whiteboard = data[taskId];
    if (!whiteboard?.nodes) return [];
    return whiteboard.nodes;
  } catch {
    return [];
  }
}

interface TaskDetailModalProps {
  task: Task;
  onClose: () => void;
}

export function TaskDetailModal({ task, onClose }: TaskDetailModalProps) {
  const updateTask = useTaskStore((s) => s.updateTask);
  const deleteTask = useTaskStore((s) => s.deleteTask);
  const clients = useTaskStore((s) => s.clients);
  const tags = useTaskStore((s) => s.tags);

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [status, setStatus] = useState(task.status);
  const [scheduledDate, setScheduledDate] = useState(task.scheduledDate);
  const [deadline, setDeadline] = useState(task.deadline || '');
  const [clientId, setClientId] = useState(task.clientId || '');
  const [selectedTags, setSelectedTags] = useState<string[]>(task.tagIds);
  const [isMeeting, setIsMeeting] = useState(task.isMeeting);
  const [meetingStart, setMeetingStart] = useState(task.meetingTime?.start || '09:00');
  const [meetingEnd, setMeetingEnd] = useState(task.meetingTime?.end || '10:00');
  const [subtasks, setSubtasks] = useState(task.subtasks);
  const [newSubtask, setNewSubtask] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>(task.timeEntries);
  const [showAddTime, setShowAddTime] = useState(false);
  const [manualHours, setManualHours] = useState('0');
  const [manualMinutes, setManualMinutes] = useState('0');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [whiteboardRefreshKey, setWhiteboardRefreshKey] = useState(0);
  const clientDropdownRef = useRef<HTMLDivElement>(null);

  const totalTime = timeEntries.reduce((acc, entry) => acc + (entry.duration || 0), 0);
  const selectedClient = clients.find(c => c.id === clientId);

  // Whiteboard-Nodes für Hierarchie-Anzeige laden - aktualisiert sich bei whiteboardRefreshKey
  const whiteboardNodes = useMemo(() => loadWhiteboardNodes(task.id), [task.id, whiteboardRefreshKey]);
  const hasWhiteboardHierarchy = whiteboardNodes.length > 1; // Mehr als nur Root-Node

  // Callback wenn Whiteboard geschlossen wird - synchronisiere Subtasks
  const handleWhiteboardClose = useCallback(() => {
    // Lade aktuelle Whiteboard-Daten
    const nodes = loadWhiteboardNodes(task.id);
    if (nodes.length > 0) {
      // Synchronisiere Subtasks mit Whiteboard-Nodes
      const nodesWithParent = nodes.filter(n => n.parentId !== null);
      const updatedSubtasks = nodesWithParent.map((node, index) => {
        // Finde existierende Subtask oder erstelle neue
        const existingSubtask = subtasks.find(s => s.id === node.subtaskId || s.id === node.id);
        return {
          id: node.subtaskId || node.id,
          title: node.title, // Titel aus Whiteboard übernehmen
          isCompleted: node.status === 'completed', // Status aus Whiteboard übernehmen
          order: existingSubtask?.order ?? index,
        };
      });

      // Aktualisiere Subtasks State
      setSubtasks(updatedSubtasks);
    }

    // Erhöhe Refresh-Key für useMemo
    setWhiteboardRefreshKey(prev => prev + 1);
    setShowWhiteboard(false);
  }, [task.id, subtasks]);

  // Close client dropdown when clicking outside
  const closeClientDropdown = useCallback(() => setShowClientDropdown(false), []);
  useClickOutside(clientDropdownRef, closeClientDropdown, showClientDropdown);

  const handleSave = () => {
    // Validate deadline is not before scheduled date
    const validDeadline = deadline && scheduledDate && deadline < scheduledDate
      ? scheduledDate
      : deadline;

    // Validate meeting end time is after start time
    let validMeetingTime = isMeeting ? { start: meetingStart, end: meetingEnd } : undefined;
    if (isMeeting && meetingStart && meetingEnd && meetingEnd <= meetingStart) {
      // Auto-correct: set end time to 1 hour after start
      const [hours, mins] = meetingStart.split(':').map(Number);
      const endHours = Math.min(hours + 1, 23);
      validMeetingTime = {
        start: meetingStart,
        end: `${endHours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
      };
    }

    updateTask(task.id, {
      title,
      description: description || undefined,
      status,
      scheduledDate,
      deadline: validDeadline || undefined,
      clientId: clientId || undefined,
      tagIds: selectedTags,
      isMeeting,
      meetingTime: validMeetingTime,
      subtasks,
      timeEntries,
      completedAt: status === 'completed' && task.status !== 'completed' ? new Date().toISOString() : task.completedAt,
    });
    onClose();
  };

  const handleAddManualTime = () => {
    const hours = parseInt(manualHours) || 0;
    const minutes = parseInt(manualMinutes) || 0;
    const durationSeconds = (hours * 60 + minutes) * 60; // Duration in seconds

    if (durationSeconds <= 0) return;

    const now = new Date();
    const startTime = new Date(now.getTime() - durationSeconds * 1000);

    const newEntry: TimeEntry = {
      id: generateId(),
      taskId: task.id,
      startTime: startTime.toISOString(),
      endTime: now.toISOString(),
      duration: durationSeconds, // Store in seconds to match formatDuration
    };

    setTimeEntries([...timeEntries, newEntry]);
    setManualHours('0');
    setManualMinutes('0');
    setShowAddTime(false);
  };

  const handleQuickAddTime = (minutesToAdd: number) => {
    const hours = parseInt(manualHours) || 0;
    const minutes = parseInt(manualMinutes) || 0;
    const totalMinutes = hours * 60 + minutes + minutesToAdd;

    if (totalMinutes < 0) {
      setManualHours('0');
      setManualMinutes('0');
      return;
    }

    const newHours = Math.floor(totalMinutes / 60);
    const newMinutes = totalMinutes % 60;
    setManualHours(newHours.toString());
    setManualMinutes(newMinutes.toString());
  };

  const handleDeleteTimeEntry = (entryId: string) => {
    setTimeEntries(timeEntries.filter((e) => e.id !== entryId));
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    playGlobalSound('taskDelete');
    deleteTask(task.id);
    onClose();
  };

  const handleAddSubtask = () => {
    if (!newSubtask.trim()) return;
    setSubtasks([
      ...subtasks,
      { id: generateId(), title: newSubtask.trim(), isCompleted: false, order: subtasks.length },
    ]);
    setNewSubtask('');
  };

  const handleToggleSubtask = (id: string) => {
    setSubtasks(subtasks.map((s) => (s.id === id ? { ...s, isCompleted: !s.isCompleted } : s)));
  };

  const handleDeleteSubtask = (id: string) => {
    setSubtasks(subtasks.filter((s) => s.id !== id));
  };

  const handleTagToggle = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // If whiteboard is open, show only whiteboard (full screen)
  if (showWhiteboard) {
    return (
      <Whiteboard
        taskId={task.id}
        taskTitle={task.title}
        onClose={handleWhiteboardClose}
      />
    );
  }

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center animate-fade-in"
      style={{ zIndex: 9999 }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-scale-in mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">Aufgabe bearbeiten</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowWhiteboard(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-200 btn-press shadow-md hover:shadow-lg"
            >
              <Layers className="w-4 h-4" />
              Whiteboard
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-all duration-200 btn-press">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Titel</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Beschreibung</label>
            <TaskDescriptionEditor
              content={description}
              onChange={setDescription}
              placeholder="Notizen, Details, Links..."
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <div className="flex gap-2">
              {(['todo', 'in_progress', 'completed'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 btn-press ${
                    status === s
                      ? s === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : s === 'in_progress'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-200 text-gray-700'
                      : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {s === 'todo' ? 'To Do' : s === 'in_progress' ? 'In Arbeit' : 'Erledigt'}
                </button>
              ))}
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Geplant fur
              </label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Deadline</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                min={scheduledDate} // Deadline can't be before scheduled date
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  deadline && scheduledDate && deadline < scheduledDate
                    ? 'border-red-300 focus:ring-red-500 bg-red-50'
                    : 'border-gray-200 focus:ring-gray-900'
                }`}
              />
              {deadline && scheduledDate && deadline < scheduledDate && (
                <p className="text-xs text-red-600 mt-1">
                  Deadline muss nach dem geplanten Datum sein
                </p>
              )}
            </div>
          </div>

          {/* Meeting Toggle */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isMeeting}
                onChange={(e) => setIsMeeting(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Als Meeting markieren</span>
            </label>
            {isMeeting && (
              <div className="mt-3 ml-7">
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={meetingStart}
                    onChange={(e) => setMeetingStart(e.target.value)}
                    className={`px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      meetingStart && meetingEnd && meetingEnd <= meetingStart
                        ? 'border-red-300 focus:ring-red-500 bg-red-50'
                        : 'border-gray-200 focus:ring-gray-900'
                    }`}
                  />
                  <span className="text-gray-400">bis</span>
                  <input
                    type="time"
                    value={meetingEnd}
                    onChange={(e) => setMeetingEnd(e.target.value)}
                    className={`px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      meetingStart && meetingEnd && meetingEnd <= meetingStart
                        ? 'border-red-300 focus:ring-red-500 bg-red-50'
                        : 'border-gray-200 focus:ring-gray-900'
                    }`}
                  />
                </div>
                {meetingStart && meetingEnd && meetingEnd <= meetingStart && (
                  <p className="text-xs text-red-600 mt-1">
                    Endzeit muss nach der Startzeit liegen
                  </p>
                )}
                {/* Intelligente Assistenz: Meeting ohne Zeit Hinweis */}
                {(!meetingStart || !meetingEnd) && (
                  <div className="mt-2 flex items-start gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
                    <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-blue-700">
                      Meetings brauchen eine Uhrzeit, um im Kalender zu erscheinen.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Client */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <User className="w-4 h-4" />
              Kunde / Projekt
            </label>
            <div className="relative" ref={clientDropdownRef}>
              <button
                type="button"
                onClick={() => setShowClientDropdown(!showClientDropdown)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-white text-left flex items-center justify-between hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {selectedClient ? (
                    <>
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: selectedClient.color }}
                      />
                      <span className="text-gray-900">{selectedClient.name}</span>
                    </>
                  ) : (
                    <span className="text-gray-400">Kein Kunde</span>
                  )}
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showClientDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown - opens upward */}
              {showClientDropdown && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden animate-scale-in z-50">
                  <div className="max-h-48 overflow-y-auto py-1">
                    {/* Client Options first (reverse order for upward dropdown) */}
                    {clients.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => {
                          setClientId(client.id);
                          setShowClientDropdown(false);
                        }}
                        className={`w-full px-3 py-2.5 text-left flex items-center justify-between hover:bg-gray-50 transition-colors ${
                          clientId === client.id ? 'bg-gray-50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: client.color }}
                          />
                          <span className="text-gray-900">{client.name}</span>
                        </div>
                        {clientId === client.id && <Check className="w-4 h-4 text-gray-900" />}
                      </button>
                    ))}

                    {clients.length > 0 && <div className="border-t border-gray-100 my-1" />}

                    {/* No Client Option */}
                    <button
                      type="button"
                      onClick={() => {
                        setClientId('');
                        setShowClientDropdown(false);
                      }}
                      className={`w-full px-3 py-2.5 text-left flex items-center justify-between hover:bg-gray-50 transition-colors ${
                        !clientId ? 'bg-gray-50' : ''
                      }`}
                    >
                      <span className="text-gray-500">Kein Kunde</span>
                      {!clientId && <Check className="w-4 h-4 text-gray-900" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Tags
            </label>
            <div className="flex flex-wrap gap-2">
              {tags.length === 0 ? (
                <p className="text-sm text-gray-400">Keine Tags vorhanden. Erstelle welche in den Einstellungen.</p>
              ) : (
                tags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => handleTagToggle(tag.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      selectedTags.includes(tag.id) ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    style={selectedTags.includes(tag.id) ? { backgroundColor: tag.color } : undefined}
                  >
                    {tag.name}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Subtasks */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Unteraufgaben
              {hasWhiteboardHierarchy && (
                <span className="ml-2 text-xs font-normal text-gray-500">(Hierarchie im Whiteboard)</span>
              )}
            </label>
            <div className="space-y-2 mb-3">
              {hasWhiteboardHierarchy ? (
                // Hierarchische Anzeige aus Whiteboard-Daten
                (() => {
                  const rootNode = whiteboardNodes.find(n => n.parentId === null);
                  if (!rootNode) return null;

                  const renderHierarchy = (parentId: string, level: number = 0): React.ReactNode => {
                    const children = whiteboardNodes.filter(n => n.parentId === parentId);
                    if (children.length === 0) return null;

                    return children.map(node => {
                      const matchingSubtask = subtasks.find(s => s.id === node.subtaskId || s.id === node.id);
                      const isCompleted = matchingSubtask?.isCompleted || node.status === 'completed';
                      const nodeChildren = whiteboardNodes.filter(n => n.parentId === node.id);

                      return (
                        <div key={node.id} style={{ marginLeft: level * 16 }}>
                          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg mb-1"
                               style={{ borderLeft: `3px solid ${node.color}` }}>
                            {nodeChildren.length > 0 && (
                              <ChevronRight className="w-3 h-3 text-gray-400" />
                            )}
                            <input
                              type="checkbox"
                              checked={isCompleted}
                              onChange={() => {
                                if (matchingSubtask) {
                                  handleToggleSubtask(matchingSubtask.id);
                                }
                              }}
                              className="w-4 h-4 rounded border-gray-300"
                              disabled={!matchingSubtask}
                            />
                            <span
                              className={`flex-1 text-sm ${isCompleted ? 'line-through text-gray-400' : 'text-gray-700'}`}
                            >
                              {node.title}
                            </span>
                            {matchingSubtask && (
                              <button
                                onClick={() => handleDeleteSubtask(matchingSubtask.id)}
                                className="p-1 text-gray-400 hover:text-red-500"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          {renderHierarchy(node.id, level + 1)}
                        </div>
                      );
                    });
                  };

                  return renderHierarchy(rootNode.id);
                })()
              ) : (
                // Flache Anzeige (Standard)
                subtasks.map((subtask) => (
                  <div key={subtask.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                    <input
                      type="checkbox"
                      checked={subtask.isCompleted}
                      onChange={() => handleToggleSubtask(subtask.id)}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span
                      className={`flex-1 text-sm ${subtask.isCompleted ? 'line-through text-gray-400' : 'text-gray-700'}`}
                    >
                      {subtask.title}
                    </span>
                    <button
                      onClick={() => handleDeleteSubtask(subtask.id)}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                placeholder="Neue Unteraufgabe"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
              />
              <button
                onClick={handleAddSubtask}
                disabled={!newSubtask.trim()}
                className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                <Plus className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Documents */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Dokumente
            </label>
            {clientId ? (
              <DocumentList
                clientId={clientId}
                taskId={task.id}
                compact
                showCreateButton
              />
            ) : (
              <p className="text-sm text-gray-400 italic">
                Wähle einen Kunden aus, um Dokumente zu erstellen.
              </p>
            )}
          </div>

          {/* Time Tracking */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Zeiterfassung
              {totalTime > 0 && (
                <span className="text-gray-500 font-normal">
                  (Gesamt: {formatDuration(totalTime)})
                </span>
              )}
            </label>

            {/* Time Entries List */}
            {timeEntries.length > 0 && (
              <div className="space-y-2 mb-3">
                {timeEntries.map((entry) => {
                  const startDate = new Date(entry.startTime);
                  const duration = entry.duration || 0;
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-gray-500">
                          {startDate.toLocaleDateString('de-DE', {
                            day: '2-digit',
                            month: '2-digit',
                          })}
                        </span>
                        <span className="text-gray-700 font-medium">
                          {formatDuration(duration)}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteTimeEntry(entry.id)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Time Form */}
            {showAddTime ? (
              <div className="p-4 bg-gray-50 rounded-2xl space-y-4">
                {/* Time Display */}
                <div className="flex items-center justify-center gap-3">
                  <span className="text-sm text-gray-500">Erfasste Zeit:</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="23"
                      value={manualHours}
                      onChange={(e) => setManualHours(e.target.value)}
                      className="w-14 px-2 py-2 bg-white border border-gray-200 rounded-xl text-center text-lg font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                    <span className="text-sm text-gray-400">h</span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={manualMinutes}
                      onChange={(e) => setManualMinutes(e.target.value)}
                      className="w-14 px-2 py-2 bg-white border border-gray-200 rounded-xl text-center text-lg font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                    <span className="text-sm text-gray-400">m</span>
                  </div>
                </div>

                {/* Quick Buttons */}
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  {[-15, -5, 5, 15, 30, 60].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => handleQuickAddTime(mins)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-150 btn-press ${
                        mins < 0
                          ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-100'
                          : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-100'
                      }`}
                    >
                      {mins > 0 ? '+' : ''}{Math.abs(mins) === 60 ? '1h' : `${mins}m`}
                    </button>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => setShowAddTime(false)}
                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-xl transition-colors"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={handleAddManualTime}
                    disabled={(parseInt(manualHours) || 0) === 0 && (parseInt(manualMinutes) || 0) === 0}
                    className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Hinzufügen
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddTime(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors w-full"
              >
                <PlusCircle className="w-4 h-4" />
                Zeit manuell hinzufügen
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-100 flex-shrink-0">
          {showDeleteConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-red-600">Wirklich löschen?</span>
              <button
                onClick={confirmDelete}
                className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
              >
                Ja
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300 transition-colors"
              >
                Nein
              </button>
            </div>
          ) : (
            <button
              onClick={handleDelete}
              className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 text-sm btn-press"
            >
              Löschen
            </button>
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200 btn-press"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              disabled={!title.trim()}
              className="px-4 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-all duration-200 btn-press"
            >
              Speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
