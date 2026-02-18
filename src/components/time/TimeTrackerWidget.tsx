import { useState, useEffect } from 'react';
import { useWorkTimeStore } from '../../stores/workTimeStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { Play, Square, Coffee, Clock, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';

interface TimeTrackerWidgetProps {
  collapsed?: boolean;
  onOpenDetail?: () => void;
  isWidgetCollapsed?: boolean;
  onToggleWidget?: () => void;
}

export function TimeTrackerWidget({ collapsed = false, onOpenDetail, isWidgetCollapsed = false, onToggleWidget }: TimeTrackerWidgetProps) {
  const getTodayWorkDay = useWorkTimeStore((s) => s.getTodayWorkDay);
  const startWork = useWorkTimeStore((s) => s.startWork);
  const stopWork = useWorkTimeStore((s) => s.stopWork);
  const startBreak = useWorkTimeStore((s) => s.startBreak);
  const endBreak = useWorkTimeStore((s) => s.endBreak);
  const getTotalBreakTime = useWorkTimeStore((s) => s.getTotalBreakTime);
  const getNetWorkTime = useWorkTimeStore((s) => s.getNetWorkTime);
  const getWeeklyWorkTime = useWorkTimeStore((s) => s.getWeeklyWorkTime);

  const weeklyWorkHours = useSettingsStore((s) => s.weeklyWorkHours);

  const [, setTick] = useState(0);
  const today = new Date().toISOString().split('T')[0];
  const workDay = getTodayWorkDay();

  // Update every second when working
  useEffect(() => {
    if (workDay?.isWorking) {
      const interval = setInterval(() => setTick((t) => t + 1), 1000);
      return () => clearInterval(interval);
    }
  }, [workDay?.isWorking]);

  const formatTime = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatTimeShort = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  const isWorking = workDay?.isWorking ?? false;
  const isOnBreak = workDay?.isOnBreak ?? false;
  const netWorkTime = getNetWorkTime(today);
  const totalBreakTime = getTotalBreakTime(today);
  const weeklyTime = getWeeklyWorkTime(today);
  const weeklyTarget = weeklyWorkHours * 60 * 60 * 1000;
  const weeklyProgress = Math.min(100, (weeklyTime / weeklyTarget) * 100);

  // Collapsed view
  if (collapsed) {
    return (
      <div className="px-2 py-3">
        <div className="flex flex-col items-center gap-2">
          {/* Status indicator */}
          <div
            className={`w-3 h-3 rounded-full ${
              isOnBreak
                ? 'bg-amber-400 animate-pulse'
                : isWorking
                ? 'bg-green-400 animate-pulse'
                : 'bg-gray-300'
            }`}
          />

          {/* Quick actions */}
          {!isWorking ? (
            <button
              onClick={startWork}
              className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-all btn-press"
              title="Arbeit starten"
            >
              <Play className="w-4 h-4" />
            </button>
          ) : (
            <>
              {!isOnBreak ? (
                <button
                  onClick={startBreak}
                  className="p-2 bg-amber-100 text-amber-600 rounded-lg hover:bg-amber-200 transition-all btn-press"
                  title="Pause starten"
                >
                  <Coffee className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={endBreak}
                  className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-all btn-press"
                  title="Pause beenden"
                >
                  <Play className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={stopWork}
                className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all btn-press"
                title="Feierabend"
              >
                <Square className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // Full view
  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl border border-gray-100 overflow-hidden">
      {/* Collapsible Header */}
      <button
        onClick={onToggleWidget}
        className="w-full p-3 flex items-center justify-between hover:bg-gray-100/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-500" />
          <span className="text-xs font-medium text-gray-600">Arbeitszeit</span>
          {isWidgetCollapsed && (
            <span className="text-xs font-mono text-gray-900 font-medium ml-1">
              {formatTime(netWorkTime)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              isOnBreak
                ? 'bg-amber-100 text-amber-700'
                : isWorking
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            {isOnBreak ? 'Pause' : isWorking ? 'Aktiv' : 'Inaktiv'}
          </div>
          {isWidgetCollapsed ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Collapsible Content */}
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isWidgetCollapsed ? 'max-h-0 opacity-0' : 'max-h-96 opacity-100'
        }`}
      >
        <div className="px-3 pb-3">
          {/* Timer Display */}
          <div className="text-center mb-3">
            <div className="text-2xl font-bold text-gray-900 font-mono">
              {formatTime(netWorkTime)}
            </div>
            {totalBreakTime > 0 && (
              <div className="text-xs text-gray-400 mt-0.5">
                Pause: {formatTimeShort(totalBreakTime)}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mb-3">
            {!isWorking ? (
              <button
                onClick={startWork}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all btn-press text-sm font-medium"
              >
                <Play className="w-4 h-4" />
                Starten
              </button>
            ) : (
              <>
                {!isOnBreak ? (
                  <button
                    onClick={startBreak}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-all btn-press text-sm font-medium"
                  >
                    <Coffee className="w-4 h-4" />
                    Pause
                  </button>
                ) : (
                  <button
                    onClick={endBreak}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-all btn-press text-sm font-medium"
                  >
                    <Play className="w-4 h-4" />
                    Weiter
                  </button>
                )}
                <button
                  onClick={stopWork}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all btn-press text-sm font-medium"
                >
                  <Square className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          {/* Weekly Progress */}
          <div className="pt-2 border-t border-gray-200/50">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
              <span>Diese Woche</span>
              <span>{formatTimeShort(weeklyTime)} / {weeklyWorkHours}h</span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  weeklyProgress >= 100 ? 'bg-green-500' : 'bg-gray-900'
                }`}
                style={{ width: `${weeklyProgress}%` }}
              />
            </div>
          </div>

          {/* Detail Link */}
          {onOpenDetail && (
            <button
              onClick={onOpenDetail}
              className="w-full mt-3 pt-2 border-t border-gray-200/50 flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              Details anzeigen
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
