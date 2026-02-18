import { useState, useEffect, useRef } from 'react';
import { useTaskStore } from '../../stores/taskStore';
import { getTodayString } from '../../utils/dateUtils';
import { X, Calendar, Clock, User, Repeat, ChevronDown, ChevronUp } from 'lucide-react';
import type { RecurrenceType, RecurrenceRule } from '../../types';

interface QuickAddModalProps {
  onClose: () => void;
  isMeeting?: boolean;
}

export function QuickAddModal({ onClose, isMeeting = false }: QuickAddModalProps) {
  const addTask = useTaskStore((s) => s.addTask);
  const clients = useTaskStore((s) => s.clients);

  const [title, setTitle] = useState('');
  const [selectedClient, setSelectedClient] = useState<string | undefined>();
  const [meetingStart, setMeetingStart] = useState('09:00');
  const [meetingEnd, setMeetingEnd] = useState('10:00');
  const [scheduledDate, setScheduledDate] = useState(getTodayString());
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('none');
  const [showOptions, setShowOptions] = useState(false); // Progressive Disclosure

  const inputRef = useRef<HTMLInputElement>(null);

  // Validierung: Endzeit muss nach Startzeit liegen
  const isTimeValid = (() => {
    if (!isMeeting) return true;
    const [startHours, startMinutes] = meetingStart.split(':').map(Number);
    const [endHours, endMinutes] = meetingEnd.split(':').map(Number);
    const startTotal = startHours * 60 + startMinutes;
    const endTotal = endHours * 60 + endMinutes;
    return endTotal > startTotal;
  })();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Auto-adjust end time when start time changes (30 min intervals)
  const handleStartTimeChange = (newStart: string) => {
    setMeetingStart(newStart);

    // Parse start time and add 30 minutes for end time
    const [hours, minutes] = newStart.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + 30;

    const endHours = Math.floor(endMinutes / 60) % 24;
    const endMins = endMinutes % 60;

    const newEnd = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
    setMeetingEnd(newEnd);
  };

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (isMeeting && !isTimeValid) return;

    const recurrence: RecurrenceRule | undefined =
      recurrenceType !== 'none'
        ? {
            type: recurrenceType,
            interval: 1,
            weekDays: recurrenceType === 'weekly' ? [new Date(scheduledDate).getDay()] : undefined,
            monthDay: recurrenceType === 'monthly' ? new Date(scheduledDate).getDate() : undefined,
          }
        : undefined;

    addTask({
      title: title.trim(),
      status: 'todo',
      scheduledDate,
      tagIds: [],
      subtasks: [],
      isSpontaneous: true,
      isMeeting,
      meetingTime: isMeeting ? { start: meetingStart, end: meetingEnd } : undefined,
      clientId: selectedClient,
      timeEntries: [],
      recurrence,
    });

    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[20vh] z-50 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex items-center gap-3 p-4 border-b border-gray-100">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isMeeting ? 'bg-purple-100' : 'bg-blue-100'}`}>
              {isMeeting ? (
                <Calendar className={`w-5 h-5 text-purple-600`} />
              ) : (
                <Clock className={`w-5 h-5 text-blue-600`} />
              )}
            </div>
            <div className="flex-1">
              <input
                ref={inputRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={isMeeting ? 'Meeting-Titel...' : 'Aufgabentitel...'}
                className="w-full text-lg font-medium text-gray-900 placeholder-gray-400 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Meeting Time - immer sichtbar für Meetings */}
          {isMeeting && (
            <div className="px-4 pt-4 space-y-1">
              <div className="flex items-center gap-3">
                <Clock className={`w-4 h-4 ${isTimeValid ? 'text-gray-400' : 'text-red-400'}`} />
                <input
                  type="time"
                  value={meetingStart}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
                  className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                />
                <span className="text-gray-400">bis</span>
                <input
                  type="time"
                  value={meetingEnd}
                  onChange={(e) => setMeetingEnd(e.target.value)}
                  className={`px-3 py-2 bg-gray-50 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                    isTimeValid
                      ? 'border-gray-200 focus:ring-gray-900/10'
                      : 'border-red-300 focus:ring-red-500/20 bg-red-50'
                  }`}
                />
              </div>
              {!isTimeValid && (
                <p className="text-xs text-red-500 ml-7">
                  Endzeit muss nach Startzeit liegen
                </p>
              )}
            </div>
          )}

          {/* Mehr Optionen - collapsed by default (Progressive Disclosure) */}
          <div className="px-4 py-3">
            <button
              type="button"
              onClick={() => setShowOptions(!showOptions)}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              {showOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Mehr Optionen
            </button>

            {showOptions && (
              <div className="mt-3 space-y-3 animate-fade-in">
                {/* Date */}
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  />
                </div>

                {/* Client */}
                {clients.length > 0 && (
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-gray-400" />
                    <select
                      value={selectedClient || ''}
                      onChange={(e) => setSelectedClient(e.target.value || undefined)}
                      className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                    >
                      <option value="">Kein Kunde</option>
                      {clients.filter((c) => c.isActive).map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Recurrence - nur für Aufgaben, nicht Meetings */}
                {!isMeeting && (
                  <div className="flex items-center gap-3">
                    <Repeat className="w-4 h-4 text-gray-400" />
                    <select
                      value={recurrenceType}
                      onChange={(e) => setRecurrenceType(e.target.value as RecurrenceType)}
                      className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                    >
                      <option value="none">Nicht wiederholen</option>
                      <option value="daily">Täglich</option>
                      <option value="weekly">Wöchentlich</option>
                      <option value="monthly">Monatlich</option>
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 bg-gray-50 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-gray-600">Enter</kbd> zum Speichern
            </p>
            <button
              type="submit"
              disabled={!title.trim() || (isMeeting && !isTimeValid)}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              {isMeeting ? 'Meeting erstellen' : 'Aufgabe erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
