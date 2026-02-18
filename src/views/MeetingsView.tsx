import { useState } from 'react';
import { useTaskStore } from '../stores/taskStore';
import {
  Plus,
  Video,
  Trash2,
  Calendar,
  Clock,
  RefreshCw,
  ChevronDown,
  X,
} from 'lucide-react';
import type { RecurringMeeting, RecurrenceType } from '../types';

interface MeetingsViewProps {
  onClose: () => void;
}

const RECURRENCE_OPTIONS: { value: RecurrenceType; label: string }[] = [
  { value: 'none', label: 'Wiederholt sich nicht' },
  { value: 'daily', label: 'Täglich wiederholen' },
  { value: 'weekly', label: 'Wöchentlich wiederholen' },
  { value: 'monthly', label: 'Monatlich wiederholen' },
  { value: 'yearly', label: 'Jährlich wiederholen' },
  { value: 'custom', label: 'Benutzerdefiniert' },
];

const WEEKDAYS = [
  { value: 1, label: 'Mo' },
  { value: 2, label: 'Di' },
  { value: 3, label: 'Mi' },
  { value: 4, label: 'Do' },
  { value: 5, label: 'Fr' },
  { value: 6, label: 'Sa' },
  { value: 0, label: 'So' },
];

export function MeetingsView({ onClose }: MeetingsViewProps) {
  const recurringMeetings = useTaskStore((s) => s.recurringMeetings);
  const clients = useTaskStore((s) => s.clients);
  const addRecurringMeeting = useTaskStore((s) => s.addRecurringMeeting);
  const deleteRecurringMeeting = useTaskStore((s) => s.deleteRecurringMeeting);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [clientId, setClientId] = useState<string | undefined>(undefined);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [startDate, setStartDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('weekly');
  const [weekDays, setWeekDays] = useState<number[]>([new Date().getDay()]);
  const [customDays, setCustomDays] = useState(7);
  const [endDate, setEndDate] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    addRecurringMeeting({
      title: title.trim(),
      description: description.trim() || undefined,
      clientId,
      meetingTime: { start: startTime, end: endTime },
      startDate,
      recurrence: {
        type: recurrenceType,
        interval: 1,
        weekDays: recurrenceType === 'weekly' ? weekDays : undefined,
        monthDay: recurrenceType === 'monthly' ? new Date(startDate).getDate() : undefined,
        customDays: recurrenceType === 'custom' ? customDays : undefined,
        endDate: endDate || undefined,
      },
    });

    // Reset form
    setTitle('');
    setDescription('');
    setClientId(undefined);
    setStartTime('09:00');
    setEndTime('10:00');
    setRecurrenceType('weekly');
    setWeekDays([new Date().getDay()]);
    setCustomDays(7);
    setEndDate('');
    setShowForm(false);
  };

  const toggleWeekDay = (day: number) => {
    if (weekDays.includes(day)) {
      setWeekDays(weekDays.filter((d) => d !== day));
    } else {
      setWeekDays([...weekDays, day]);
    }
  };

  // Auto-adjust end time when start time changes (30 min intervals)
  const handleStartTimeChange = (newStart: string) => {
    setStartTime(newStart);

    // Parse start time and add 30 minutes for end time
    const [hours, minutes] = newStart.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + 30;

    const endHours = Math.floor(endMinutes / 60) % 24;
    const endMins = endMinutes % 60;

    const newEnd = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
    setEndTime(newEnd);
  };

  const getRecurrenceLabel = (meeting: RecurringMeeting) => {
    const rule = meeting.recurrence;
    switch (rule.type) {
      case 'daily':
        return 'Täglich';
      case 'weekly': {
        if (rule.weekDays && rule.weekDays.length > 0) {
          const days = rule.weekDays
            .sort((a, b) => a - b)
            .map((d) => WEEKDAYS.find((wd) => wd.value === d)?.label)
            .join(', ');
          return `Wöchentlich (${days})`;
        }
        return 'Wöchentlich';
      }
      case 'monthly':
        return `Monatlich (${rule.monthDay || new Date(meeting.startDate).getDate()}.)`;
      case 'yearly':
        return 'Jährlich';
      case 'custom':
        return `Alle ${rule.customDays} Tage`;
      default:
        return 'Einmalig';
    }
  };

  const getClientById = (id?: string) => clients.find((c) => c.id === id);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl animate-scale-in flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Video className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Meetings</h2>
              <p className="text-sm text-gray-500">Wiederkehrende Meetings verwalten</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Meeting List */}
          {recurringMeetings.length > 0 && !showForm && (
            <div className="space-y-3 mb-6">
              {recurringMeetings.map((meeting) => {
                const client = getClientById(meeting.clientId);
                return (
                  <div
                    key={meeting.id}
                    className="bg-gray-50 rounded-xl p-4 flex items-center justify-between group hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <RefreshCw className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{meeting.title}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-sm text-gray-500 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {meeting.meetingTime.start} - {meeting.meetingTime.end}
                          </span>
                          <span className="text-sm text-gray-500 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {getRecurrenceLabel(meeting)}
                          </span>
                        </div>
                        {client && (
                          <span
                            className="inline-block text-xs px-2 py-0.5 rounded mt-2"
                            style={{
                              backgroundColor: `${client.color}15`,
                              color: client.color,
                            }}
                          >
                            {client.name}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteRecurringMeeting(meeting.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty State */}
          {recurringMeetings.length === 0 && !showForm && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Video className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-gray-900 font-medium mb-1">Keine wiederkehrenden Meetings</h3>
              <p className="text-sm text-gray-500 mb-4">
                Erstelle ein Meeting das sich automatisch wiederholt
              </p>
            </div>
          )}

          {/* Add Button */}
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 hover:border-gray-300 hover:text-gray-600 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              <span>Neues wiederkehrendes Meeting</span>
            </button>
          )}

          {/* Form */}
          {showForm && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Meeting-Titel
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  placeholder="z.B. Weekly Standup"
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Beschreibung (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
                  rows={2}
                  placeholder="Meeting-Details..."
                />
              </div>

              {/* Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Startzeit
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => handleStartTimeChange(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Endzeit
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Beginnt am
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>

              {/* Recurrence Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Wiederholung
                </label>
                <div className="relative">
                  <select
                    value={recurrenceType}
                    onChange={(e) => setRecurrenceType(e.target.value as RecurrenceType)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent appearance-none bg-white"
                  >
                    {RECURRENCE_OPTIONS.filter((o) => o.value !== 'none').map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Weekdays (for weekly) */}
              {recurrenceType === 'weekly' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    An welchen Tagen?
                  </label>
                  <div className="flex gap-2">
                    {WEEKDAYS.map((day) => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleWeekDay(day.value)}
                        className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                          weekDays.includes(day.value)
                            ? 'bg-gray-900 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom Days */}
              {recurrenceType === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Alle wie viele Tage?
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={customDays}
                    onChange={(e) => setCustomDays(parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                </div>
              )}

              {/* End Date (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Endet am (optional)
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>

              {/* Client */}
              {clients.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kunde (optional)
                  </label>
                  <div className="relative">
                    <select
                      value={clientId || ''}
                      onChange={(e) => setClientId(e.target.value || undefined)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent appearance-none bg-white"
                    >
                      <option value="">Kein Kunde</option>
                      {clients
                        .filter((c) => c.isActive)
                        .map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.name}
                          </option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2.5 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={!title.trim()}
                  className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Meeting erstellen
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
