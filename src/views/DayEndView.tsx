import { useMemo, useState, useEffect } from 'react';
import { useTaskStore } from '../stores/taskStore';
import { useSettingsStore } from '../stores/settingsStore';
import { formatDateGerman, getTodayString } from '../utils/dateUtils';
import { formatDuration } from '../utils/timeUtils';
import { CheckCircle, Clock, TrendingUp, ArrowRight, ArrowLeft, X, Copy, Check } from 'lucide-react';

interface DayEndViewProps {
  onClose: () => void;
  onEndDay: () => void;
}

export function DayEndView({ onClose, onEndDay }: DayEndViewProps) {
  const tasks = useTaskStore((s) => s.tasks);
  const clients = useTaskStore((s) => s.clients);
  const processEndOfDay = useTaskStore((s) => s.processEndOfDay);
  const endDay = useSettingsStore((s) => s.endDay);
  const autoCarryOverTasks = useSettingsStore((s) => s.autoCarryOverTasks);

  const today = getTodayString();
  const [animationStep, setAnimationStep] = useState(0);
  const [isEnding, setIsEnding] = useState(false);
  const [currentPage, setCurrentPage] = useState(0); // 0 = stats, 1 = completed, 2 = unfinished, 3 = end
  const [copiedCompleted, setCopiedCompleted] = useState(false);
  const [copiedUnfinished, setCopiedUnfinished] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  const todayTasks = useMemo(() => {
    return tasks.filter((task) => task.scheduledDate === today && !task.isMeeting);
  }, [tasks, today]);

  const completedTasks = todayTasks.filter((t) => t.status === 'completed');
  const unfinishedTasks = todayTasks.filter((t) => t.status !== 'completed');

  const totalTimeTracked = useMemo(() => {
    return todayTasks.reduce((acc, task) => {
      return acc + task.timeEntries.reduce((t, e) => t + (e.duration || 0), 0);
    }, 0);
  }, [todayTasks]);

  const getClientById = (id?: string) => clients.find((c) => c.id === id);

  // Calculate total pages (stats always, completed if any, unfinished if any, end always)
  const pages = useMemo(() => {
    const p: ('stats' | 'completed' | 'unfinished' | 'end')[] = ['stats'];
    if (completedTasks.length > 0) p.push('completed');
    if (unfinishedTasks.length > 0) p.push('unfinished');
    p.push('end');
    return p;
  }, [completedTasks.length, unfinishedTasks.length]);

  const currentPageType = pages[currentPage];
  const totalPages = pages.length;

  const copyTasksToClipboard = (taskList: typeof completedTasks, isCompleted: boolean) => {
    const text = taskList.map((task) => {
      const client = getClientById(task.clientId);
      const clientSuffix = client ? ` (${client.name})` : '';
      const prefix = isCompleted ? '✅' : '⬚';
      return `${prefix} ${task.title}${clientSuffix}`;
    }).join('\n');

    navigator.clipboard.writeText(text);
    if (isCompleted) {
      setCopiedCompleted(true);
      setTimeout(() => setCopiedCompleted(false), 2000);
    } else {
      setCopiedUnfinished(true);
      setTimeout(() => setCopiedUnfinished(false), 2000);
    }
  };

  const copyAllToClipboard = () => {
    const dateStr = formatDateGerman(today);
    let text = `📋 Tagesübersicht ${dateStr}\n\n`;

    if (completedTasks.length > 0) {
      text += `✅ Erledigt (${completedTasks.length}):\n`;
      text += completedTasks.map((task) => {
        const client = getClientById(task.clientId);
        const clientSuffix = client ? ` (${client.name})` : '';
        return `• ${task.title}${clientSuffix}`;
      }).join('\n');
    }

    if (unfinishedTasks.length > 0) {
      if (completedTasks.length > 0) text += '\n\n';
      text += `⬚ Offen (${unfinishedTasks.length}):\n`;
      text += unfinishedTasks.map((task) => {
        const client = getClientById(task.clientId);
        const clientSuffix = client ? ` (${client.name})` : '';
        return `• ${task.title}${clientSuffix}`;
      }).join('\n');
    }

    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const nextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Animation sequence
  useEffect(() => {
    const timers = [
      setTimeout(() => setAnimationStep(1), 300),
      setTimeout(() => setAnimationStep(2), 800),
      setTimeout(() => setAnimationStep(3), 1300),
      setTimeout(() => setAnimationStep(4), 1800),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const handleEndDay = () => {
    setIsEnding(true);
    setTimeout(() => {
      if (autoCarryOverTasks) {
        processEndOfDay(today);
      }
      endDay(today);
      onEndDay();
    }, 500);
  };

  return (
    <div
      className={`fixed inset-0 bg-gray-900 flex items-center justify-center z-50 transition-opacity duration-500 ${
        isEnding ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <button
        onClick={onClose}
        className="absolute top-6 right-6 p-3 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200 btn-press"
      >
        <X className="w-6 h-6" />
      </button>

      <div className="w-full max-w-2xl px-6 flex flex-col" style={{ maxHeight: 'calc(100vh - 100px)' }}>
        {/* Header */}
        <div
          className={`text-center mb-8 flex-shrink-0 transition-all duration-700 ${
            animationStep >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <p className="text-gray-400 mb-2">Tagesruckblick</p>
          <h1 className="text-3xl font-semibold text-white">{formatDateGerman(today)}</h1>
          {/* Page indicator */}
          <div className="flex items-center justify-center gap-2 mt-4">
            {pages.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index === currentPage ? 'bg-white w-6' : 'bg-gray-600'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-hidden">
          {/* Stats Page */}
          {currentPageType === 'stats' && (
            <div
              className={`transition-all duration-500 ${
                animationStep >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
            >
              <div className="grid grid-cols-3 gap-6 mb-6">
                {/* Completed */}
                <div className="bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 text-center">
                  <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-6 h-6 text-green-400" />
                  </div>
                  <div className="text-3xl font-semibold text-white mb-1">{completedTasks.length}</div>
                  <div className="text-sm text-gray-400">Erledigt</div>
                </div>

                {/* Time Tracked */}
                <div className="bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 text-center">
                  <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-6 h-6 text-blue-400" />
                  </div>
                  <div className="text-3xl font-semibold text-white mb-1">
                    {totalTimeTracked > 0 ? formatDuration(totalTimeTracked) : '0:00'}
                  </div>
                  <div className="text-sm text-gray-400">Zeit erfasst</div>
                </div>

                {/* Tasks Overview - neutral, keine Prozentrate */}
                <div className="bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 text-center">
                  <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <TrendingUp className="w-6 h-6 text-purple-400" />
                  </div>
                  <div className="text-3xl font-semibold text-white mb-1">{todayTasks.length}</div>
                  <div className="text-sm text-gray-400">Aufgaben heute</div>
                </div>
              </div>

              {/* Copy All Button */}
              {(completedTasks.length > 0 || unfinishedTasks.length > 0) && (
                <button
                  onClick={copyAllToClipboard}
                  className={`w-full py-4 rounded-2xl font-medium transition-all duration-200 flex items-center justify-center gap-3 btn-press ${
                    copiedAll
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-gray-800/80 text-white hover:bg-gray-700/80 border border-gray-700'
                  }`}
                >
                  {copiedAll ? (
                    <>
                      <Check className="w-5 h-5" />
                      <span>Für Teams kopiert!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5" />
                      <span>Tagesübersicht für Teams kopieren</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Completed Tasks Page */}
          {currentPageType === 'completed' && (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-400">
                  Erledigte Aufgaben ({completedTasks.length})
                </h3>
                <button
                  onClick={() => copyTasksToClipboard(completedTasks, true)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200"
                >
                  {copiedCompleted ? (
                    <>
                      <Check className="w-4 h-4 text-green-400" />
                      <span className="text-green-400">Kopiert!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Kopieren</span>
                    </>
                  )}
                </button>
              </div>
              <div className="space-y-2 overflow-y-auto flex-1 pr-2" style={{ maxHeight: 'calc(100vh - 350px)' }}>
                {completedTasks.map((task) => {
                  const client = getClientById(task.clientId);
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 p-3 bg-gray-800/50 backdrop-blur-sm rounded-xl"
                    >
                      <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                      <span className="text-sm text-white flex-1 truncate">{task.title}</span>
                      {client && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: `${client.color}30`, color: client.color }}
                        >
                          {client.name}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Unfinished Tasks Page - neutral, ohne Wertung */}
          {currentPageType === 'unfinished' && (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-400">
                  Offen ({unfinishedTasks.length})
                </h3>
                <button
                  onClick={() => copyTasksToClipboard(unfinishedTasks, false)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200"
                >
                  {copiedUnfinished ? (
                    <>
                      <Check className="w-4 h-4 text-green-400" />
                      <span className="text-green-400">Kopiert!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Kopieren</span>
                    </>
                  )}
                </button>
              </div>
              <div className="space-y-2 overflow-y-auto flex-1 pr-2" style={{ maxHeight: 'calc(100vh - 350px)' }}>
                {unfinishedTasks.map((task) => {
                  const client = getClientById(task.clientId);
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 p-3 bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-700/50"
                    >
                      <div className="w-5 h-5 rounded-full border-2 border-gray-600 flex-shrink-0" />
                      <span className="text-sm text-gray-400 flex-1 truncate">{task.title}</span>
                      {client && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full opacity-60 flex-shrink-0"
                          style={{ backgroundColor: `${client.color}30`, color: client.color }}
                        >
                          {client.name}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* End Page - ruhig, ohne Bewertung */}
          {currentPageType === 'end' && (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="text-center mb-8">
                <div className="text-6xl mb-4">✨</div>
                <h2 className="text-2xl font-semibold text-white mb-2">Tag abgeschlossen</h2>
                <p className="text-gray-400">
                  {completedTasks.length > 0
                    ? `${completedTasks.length} Aufgaben erledigt.`
                    : 'Bereit für morgen.'}
                  {unfinishedTasks.length > 0 && ` ${unfinishedTasks.length} warten im Backlog.`}
                </p>
              </div>
              <button
                onClick={handleEndDay}
                className="w-full max-w-md py-4 bg-white text-gray-900 rounded-2xl font-medium hover:bg-gray-100 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg btn-press"
              >
                Tag abschliessen
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div
          className={`flex items-center justify-between mt-8 flex-shrink-0 transition-all duration-700 ${
            animationStep >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <button
            onClick={prevPage}
            disabled={currentPage === 0}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 btn-press ${
              currentPage === 0
                ? 'text-gray-600 cursor-not-allowed'
                : 'text-white bg-gray-800 hover:bg-gray-700'
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
            Zuruck
          </button>

          {currentPageType !== 'end' && (
            <button
              onClick={nextPage}
              className="flex items-center gap-2 px-6 py-3 bg-white text-gray-900 rounded-xl font-medium hover:bg-gray-100 transition-all duration-200 btn-press"
            >
              Weiter
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
