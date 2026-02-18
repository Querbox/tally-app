import { useEffect, useMemo, useRef, useState } from 'react';
import { useTaskStore } from '../stores/taskStore';
import { useSettingsStore } from '../stores/settingsStore';
import { formatDateGerman, getTodayString } from '../utils/dateUtils';
import { Plus, ArrowRight, Inbox } from 'lucide-react';
import type { Task } from '../types';

interface DayStartViewProps {
  onStartDay: () => void;
}

export function DayStartView({ onStartDay }: DayStartViewProps) {
  const tasks = useTaskStore((s) => s.tasks);
  const clients = useTaskStore((s) => s.clients);
  const addTask = useTaskStore((s) => s.addTask);
  const updateTask = useTaskStore((s) => s.updateTask);
  const startDay = useSettingsStore((s) => s.startDay);

  const today = getTodayString();
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Generate recurring task instances for today on mount (einmalig)
  const recurringDoneRef = useRef(false);
  useEffect(() => {
    if (recurringDoneRef.current) return;
    recurringDoneRef.current = true;
    useTaskStore.getState().generateRecurringInstances(today);
  }, [today]);

  // Get unfinished tasks from previous days
  const carryOverTasks = useMemo(() => {
    return tasks.filter(
      (task) => task.scheduledDate < today && task.status !== 'completed' && !task.isMeeting
    );
  }, [tasks, today]);

  // Get tasks already scheduled for today
  const todayTasks = useMemo(() => {
    return tasks.filter((task) => task.scheduledDate === today);
  }, [tasks, today]);

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    addTask({
      title: newTaskTitle.trim(),
      status: 'todo',
      scheduledDate: today,
      tagIds: [],
      subtasks: [],
      isSpontaneous: false,
      isMeeting: false,
      timeEntries: [],
    });
    setNewTaskTitle('');
  };

  const handleCarryOverTask = (task: Task) => {
    updateTask(task.id, {
      scheduledDate: today,
      postponeCount: task.postponeCount + 1,
      originalDate: task.originalDate || task.scheduledDate,
    });
  };

  const handleCarryOverAll = () => {
    carryOverTasks.forEach((task) => {
      handleCarryOverTask(task);
    });
  };

  const handleStartDay = () => {
    startDay(today);
    onStartDay();
  };

  const getClientById = (id?: string) => clients.find((c) => c.id === id);

  // Get greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Guten Morgen';
    if (hour < 18) return 'Guten Tag';
    return 'Guten Abend';
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-6">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-10 animate-fade-in-up opacity-0" style={{ animationFillMode: 'forwards' }}>
          <p className="text-sm text-gray-400 mb-2">{getGreeting()}</p>
          <h1 className="text-4xl font-semibold text-gray-900 tracking-tight">
            {formatDateGerman(today)}
          </h1>
        </div>

        {/* Backlog Section - neutral, ohne Wertung */}
        {carryOverTasks.length > 0 && (
          <div
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4 animate-fade-in-up opacity-0"
            style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-gray-500">
                <Inbox className="w-4 h-4" />
                <h2 className="text-sm font-medium">Von gestern</h2>
                <span className="text-xs text-gray-400">({carryOverTasks.length})</span>
              </div>
              <button
                onClick={handleCarryOverAll}
                className="text-xs text-gray-500 hover:text-gray-700 font-medium btn-press"
              >
                Alle für heute
              </button>
            </div>
            <div className="space-y-2">
              {carryOverTasks.map((task, index) => {
                const client = getClientById(task.clientId);
                return (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-xl animate-fade-in-up opacity-0"
                    style={{ animationDelay: `${0.15 + index * 0.05}s`, animationFillMode: 'forwards' }}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-sm text-gray-700 truncate">{task.title}</span>
                      {client && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: `${client.color}15`, color: client.color }}
                        >
                          {client.name}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleCarryOverTask(task)}
                      className="text-xs text-gray-500 hover:text-gray-700 font-medium flex items-center gap-1 ml-3 btn-press"
                    >
                      Heute <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Today's Tasks */}
        <div
          className="bg-white rounded-2xl shadow-sm p-5 mb-4 animate-fade-in-up opacity-0"
          style={{ animationDelay: carryOverTasks.length > 0 ? '0.2s' : '0.1s', animationFillMode: 'forwards' }}
        >
          <h2 className="text-sm font-medium text-gray-400 mb-4">Heutige Aufgaben</h2>

          {todayTasks.length > 0 && (
            <div className="space-y-2 mb-4">
              {todayTasks.map((task, index) => {
                const client = getClientById(task.clientId);
                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl animate-fade-in-up opacity-0"
                    style={{ animationDelay: `${0.25 + index * 0.05}s`, animationFillMode: 'forwards' }}
                  >
                    <div className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" />
                    <span className="text-sm text-gray-900 flex-1 truncate">{task.title}</span>
                    {client && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: `${client.color}15`, color: client.color }}
                      >
                        {client.name}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Add Task Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Neue Aufgabe..."
              className="flex-1 px-4 py-3 bg-gray-50 border-0 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
            />
            <button
              onClick={handleAddTask}
              disabled={!newTaskTitle.trim()}
              className="px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all btn-press"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {todayTasks.length === 0 && !newTaskTitle && (
            <p className="text-sm text-gray-300 text-center mt-4">
              Keine Aufgaben geplant
            </p>
          )}
        </div>

        {/* Start Day Button */}
        <button
          onClick={handleStartDay}
          className="w-full py-4 bg-gray-900 text-white rounded-2xl font-medium hover:bg-gray-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-gray-900/20 btn-press animate-fade-in-up opacity-0"
          style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}
        >
          Tag starten
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
