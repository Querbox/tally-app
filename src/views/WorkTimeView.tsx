import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useWorkTimeStore } from '../stores/workTimeStore';
import { useSettingsStore } from '../stores/settingsStore';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Trash2,
  Edit3,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';

interface WorkTimeViewProps {
  onClose: () => void;
}

type ViewMode = 'week' | 'month';

export function WorkTimeView({ onClose }: WorkTimeViewProps) {
  const getWorkDay = useWorkTimeStore((s) => s.getWorkDay);
  const getNetWorkTime = useWorkTimeStore((s) => s.getNetWorkTime);
  const getWeeklyWorkTime = useWorkTimeStore((s) => s.getWeeklyWorkTime);
  const getMonthlyWorkTime = useWorkTimeStore((s) => s.getMonthlyWorkTime);
  const updateWorkBlock = useWorkTimeStore((s) => s.updateWorkBlock);
  const deleteWorkBlock = useWorkTimeStore((s) => s.deleteWorkBlock);
  const addWorkBlock = useWorkTimeStore((s) => s.addWorkBlock);
  const updateBreak = useWorkTimeStore((s) => s.updateBreak);
  const deleteBreak = useWorkTimeStore((s) => s.deleteBreak);

  const weeklyWorkHours = useSettingsStore((s) => s.weeklyWorkHours);
  const workDaysPerWeek = useSettingsStore((s) => s.workDaysPerWeek);

  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [editingBlock, setEditingBlock] = useState<{
    date: string;
    id: string;
    type: 'work' | 'break';
    startTime: string;
    endTime: string;
  } | null>(null);
  const [addingBlock, setAddingBlock] = useState<{
    date: string;
    startTime: string;
    endTime: string;
  } | null>(null);

  // Calculate dates for current view
  const viewDates = useMemo(() => {
    const d = new Date(currentDate);

    if (viewMode === 'week') {
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));

      const dates: string[] = [];
      for (let i = 0; i < 7; i++) {
        const current = new Date(monday);
        current.setDate(monday.getDate() + i);
        dates.push(current.toISOString().split('T')[0]);
      }
      return dates;
    } else {
      const year = d.getFullYear();
      const month = d.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);

      const dates: string[] = [];
      for (let day = firstDay.getDate(); day <= lastDay.getDate(); day++) {
        const current = new Date(year, month, day);
        dates.push(current.toISOString().split('T')[0]);
      }
      return dates;
    }
  }, [currentDate, viewMode]);

  // Navigation
  const navigatePrev = () => {
    const d = new Date(currentDate);
    if (viewMode === 'week') {
      d.setDate(d.getDate() - 7);
    } else {
      d.setMonth(d.getMonth() - 1);
    }
    setCurrentDate(d.toISOString().split('T')[0]);
  };

  const navigateNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'week') {
      d.setDate(d.getDate() + 7);
    } else {
      d.setMonth(d.getMonth() + 1);
    }
    setCurrentDate(d.toISOString().split('T')[0]);
  };

  const goToToday = () => {
    setCurrentDate(new Date().toISOString().split('T')[0]);
  };

  // Calculations
  const totalWorkTime = viewMode === 'week'
    ? getWeeklyWorkTime(currentDate)
    : getMonthlyWorkTime(currentDate);

  const targetWorkTime = viewMode === 'week'
    ? weeklyWorkHours * 60 * 60 * 1000
    : (weeklyWorkHours / workDaysPerWeek) * getWorkingDaysInMonth() * 60 * 60 * 1000;

  const overtime = totalWorkTime - targetWorkTime;

  function getWorkingDaysInMonth(): number {
    const d = new Date(currentDate);
    const year = d.getFullYear();
    const month = d.getMonth();
    let count = 0;
    const lastDay = new Date(year, month + 1, 0).getDate();

    for (let day = 1; day <= lastDay; day++) {
      const date = new Date(year, month, day);
      const dayOfWeek = date.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
    }
    return count;
  }

  // Formatting
  const formatDuration = (ms: number) => {
    const hours = Math.floor(Math.abs(ms) / 3600000);
    const minutes = Math.floor((Math.abs(ms) % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  const formatTimeInput = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  const parseTimeToISO = (date: string, time: string) => {
    const [hours, minutes] = time.split(':');
    const d = new Date(date);
    d.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    return d.toISOString();
  };

  const formatDateHeader = () => {
    const d = new Date(currentDate);
    if (viewMode === 'week') {
      const startOfWeek = new Date(viewDates[0]);
      const endOfWeek = new Date(viewDates[6]);
      return `${startOfWeek.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })} - ${endOfWeek.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    return d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  };

  // Save edits
  const handleSaveEdit = () => {
    if (!editingBlock) return;

    const startISO = parseTimeToISO(editingBlock.date, editingBlock.startTime);
    const endISO = parseTimeToISO(editingBlock.date, editingBlock.endTime);

    if (editingBlock.type === 'work') {
      updateWorkBlock(editingBlock.date, editingBlock.id, {
        startTime: startISO,
        endTime: endISO,
      });
    } else {
      updateBreak(editingBlock.date, editingBlock.id, {
        startTime: startISO,
        endTime: endISO,
      });
    }
    setEditingBlock(null);
  };

  const handleAddBlock = () => {
    if (!addingBlock) return;

    const startISO = parseTimeToISO(addingBlock.date, addingBlock.startTime);
    const endISO = parseTimeToISO(addingBlock.date, addingBlock.endTime);

    addWorkBlock(addingBlock.date, startISO, endISO);
    setAddingBlock(null);
  };

  const today = new Date().toISOString().split('T')[0];

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center animate-fade-in"
      style={{ zIndex: 9999 }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-scale-in mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-700" />
              <h2 className="text-lg font-semibold text-gray-900">Arbeitszeit</h2>
            </div>

            {/* View Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('week')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  viewMode === 'week'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Woche
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  viewMode === 'month'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Monat
              </button>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-all btn-press"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Navigation & Summary */}
        <div className="p-6 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={navigatePrev}
                className="p-2 hover:bg-gray-100 rounded-lg transition-all btn-press"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={goToToday}
                className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-all btn-press"
              >
                Heute
              </button>
              <button
                onClick={navigateNext}
                className="p-2 hover:bg-gray-100 rounded-lg transition-all btn-press"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <h3 className="text-lg font-medium text-gray-900">{formatDateHeader()}</h3>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-sm text-gray-500 mb-1">Gearbeitet</div>
              <div className="text-2xl font-bold text-gray-900">{formatDuration(totalWorkTime)}</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-sm text-gray-500 mb-1">Soll</div>
              <div className="text-2xl font-bold text-gray-900">{formatDuration(targetWorkTime)}</div>
            </div>
            <div
              className={`rounded-xl p-4 ${
                overtime >= 0 ? 'bg-green-50' : 'bg-red-50'
              }`}
            >
              <div className="text-sm text-gray-500 mb-1 flex items-center gap-1">
                {overtime >= 0 ? (
                  <>
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    Überstunden
                  </>
                ) : (
                  <>
                    <TrendingDown className="w-4 h-4 text-red-500" />
                    Minusstunden
                  </>
                )}
              </div>
              <div
                className={`text-2xl font-bold ${
                  overtime >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {overtime >= 0 ? '+' : '-'}{formatDuration(overtime)}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {viewDates.map((date) => {
              const workDay = getWorkDay(date);
              const dayTime = getNetWorkTime(date);
              const isToday = date === today;
              const dateObj = new Date(date);
              const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

              return (
                <div
                  key={date}
                  className={`rounded-xl border ${
                    isToday
                      ? 'border-gray-900 bg-gray-50'
                      : isWeekend
                      ? 'border-gray-100 bg-gray-50/50'
                      : 'border-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`text-sm font-medium ${
                          isToday ? 'text-gray-900' : 'text-gray-500'
                        }`}
                      >
                        {dateObj.toLocaleDateString('de-DE', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })}
                      </div>
                      {isToday && (
                        <span className="px-2 py-0.5 bg-gray-900 text-white text-xs rounded-full">
                          Heute
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`font-mono font-medium ${
                          dayTime > 0 ? 'text-gray-900' : 'text-gray-400'
                        }`}
                      >
                        {formatDuration(dayTime)}
                      </span>
                      <button
                        onClick={() =>
                          setAddingBlock({
                            date,
                            startTime: '09:00',
                            endTime: '17:00',
                          })
                        }
                        className="p-1.5 hover:bg-gray-200 rounded-lg transition-all"
                        title="Block hinzufügen"
                      >
                        <Plus className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  </div>

                  {/* Work Blocks */}
                  {workDay && workDay.workBlocks.length > 0 && (
                    <div className="px-4 pb-4 space-y-2">
                      {workDay.workBlocks.map((block) => (
                        <div
                          key={block.id}
                          className="flex items-center justify-between bg-white rounded-lg p-3 border border-gray-100"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-green-400 rounded-full" />
                            <span className="text-sm font-medium text-gray-700 font-mono">
                              {formatTimeInput(block.startTime)} -{' '}
                              {block.endTime ? formatTimeInput(block.endTime) : 'jetzt'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() =>
                                setEditingBlock({
                                  date,
                                  id: block.id,
                                  type: 'work',
                                  startTime: formatTimeInput(block.startTime),
                                  endTime: block.endTime
                                    ? formatTimeInput(block.endTime)
                                    : formatTimeInput(new Date().toISOString()),
                                })
                              }
                              className="p-1.5 hover:bg-gray-100 rounded-lg transition-all"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-gray-400" />
                            </button>
                            <button
                              onClick={() => deleteWorkBlock(date, block.id)}
                              className="p-1.5 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          </div>
                        </div>
                      ))}

                      {/* Breaks */}
                      {workDay.breaks.map((breakEntry) => (
                        <div
                          key={breakEntry.id}
                          className="flex items-center justify-between bg-amber-50 rounded-lg p-3 border border-amber-100"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-amber-400 rounded-full" />
                            <span className="text-sm font-medium text-amber-700 font-mono">
                              Pause: {formatTimeInput(breakEntry.startTime)} -{' '}
                              {breakEntry.endTime
                                ? formatTimeInput(breakEntry.endTime)
                                : 'jetzt'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() =>
                                setEditingBlock({
                                  date,
                                  id: breakEntry.id,
                                  type: 'break',
                                  startTime: formatTimeInput(breakEntry.startTime),
                                  endTime: breakEntry.endTime
                                    ? formatTimeInput(breakEntry.endTime)
                                    : formatTimeInput(new Date().toISOString()),
                                })
                              }
                              className="p-1.5 hover:bg-amber-100 rounded-lg transition-all"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-amber-500" />
                            </button>
                            <button
                              onClick={() => deleteBreak(date, breakEntry.id)}
                              className="p-1.5 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Empty state */}
                  {(!workDay || workDay.workBlocks.length === 0) && !isWeekend && (
                    <div className="px-4 pb-4">
                      <div className="text-sm text-gray-400 flex items-center gap-2">
                        <Minus className="w-4 h-4" />
                        Keine Einträge
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Edit Modal */}
        {editingBlock && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <div className="bg-white rounded-xl p-6 shadow-xl w-80">
              <h3 className="font-semibold text-gray-900 mb-4">
                {editingBlock.type === 'work' ? 'Arbeitsblock' : 'Pause'} bearbeiten
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Start</label>
                  <input
                    type="time"
                    value={editingBlock.startTime}
                    onChange={(e) =>
                      setEditingBlock({ ...editingBlock, startTime: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Ende</label>
                  <input
                    type="time"
                    value={editingBlock.endTime}
                    onChange={(e) =>
                      setEditingBlock({ ...editingBlock, endTime: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingBlock(null)}
                    className="flex-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-all"
                  >
                    Speichern
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Block Modal */}
        {addingBlock && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <div className="bg-white rounded-xl p-6 shadow-xl w-80">
              <h3 className="font-semibold text-gray-900 mb-4">Arbeitsblock hinzufügen</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Start</label>
                  <input
                    type="time"
                    value={addingBlock.startTime}
                    onChange={(e) =>
                      setAddingBlock({ ...addingBlock, startTime: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Ende</label>
                  <input
                    type="time"
                    value={addingBlock.endTime}
                    onChange={(e) =>
                      setAddingBlock({ ...addingBlock, endTime: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAddingBlock(null)}
                    className="flex-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={handleAddBlock}
                    className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-all"
                  >
                    Hinzufügen
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
