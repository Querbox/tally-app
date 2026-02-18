import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Play, Pause, RotateCcw, Volume2, VolumeX, Coffee, Target } from 'lucide-react';
import type { Task } from '../../types';
import { useTaskStore } from '../../stores/taskStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { playGlobalSound } from '../../hooks/useSounds';

interface FocusModeProps {
  task: Task;
  onClose: () => void;
}

type TimerMode = 'focus' | 'shortBreak' | 'longBreak';

export function FocusMode({ task, onClose }: FocusModeProps) {
  const updateTask = useTaskStore((s) => s.updateTask);
  const clients = useTaskStore((s) => s.clients);
  const soundSettings = useSettingsStore((s) => s.soundSettings);
  const focusTimerSettings = useSettingsStore((s) => s.focusTimerSettings);

  const [mode, setMode] = useState<TimerMode>('focus');
  const [timeLeft, setTimeLeft] = useState(focusTimerSettings.focusDuration * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [totalFocusTime, setTotalFocusTime] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(soundSettings.enabled);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const intervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<Date | null>(null);

  const client = clients.find((c) => c.id === task.clientId);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get duration for current mode
  const getDuration = useCallback((m: TimerMode) => {
    switch (m) {
      case 'focus':
        return focusTimerSettings.focusDuration * 60;
      case 'shortBreak':
        return focusTimerSettings.shortBreakDuration * 60;
      case 'longBreak':
        return focusTimerSettings.longBreakDuration * 60;
    }
  }, [focusTimerSettings]);

  // Play notification sound
  const playNotification = useCallback(() => {
    if (soundEnabled) {
      playGlobalSound('notification');
    }
  }, [soundEnabled]);

  // Handle timer completion
  const handleTimerComplete = useCallback(() => {
    playNotification();
    setIsRunning(false);

    if (mode === 'focus') {
      const newSessions = completedSessions + 1;
      setCompletedSessions(newSessions);
      setTotalFocusTime((prev) => prev + focusTimerSettings.focusDuration * 60);

      // Add time entry to task
      if (startTimeRef.current) {
        const endTime = new Date().toISOString();
        const duration = focusTimerSettings.focusDuration * 60;
        const newEntry = {
          id: Math.random().toString(36).substring(2, 15),
          taskId: task.id,
          startTime: startTimeRef.current.toISOString(),
          endTime,
          duration,
        };
        updateTask(task.id, {
          timeEntries: [...task.timeEntries, newEntry],
        });
        startTimeRef.current = null;
      }

      // Determine next break type
      if (newSessions % focusTimerSettings.sessionsUntilLongBreak === 0) {
        setMode('longBreak');
        setTimeLeft(focusTimerSettings.longBreakDuration * 60);
        if (focusTimerSettings.autoStartBreaks) {
          setIsRunning(true);
        }
      } else {
        setMode('shortBreak');
        setTimeLeft(focusTimerSettings.shortBreakDuration * 60);
        if (focusTimerSettings.autoStartBreaks) {
          setIsRunning(true);
        }
      }
    } else {
      // Break completed, back to focus
      setMode('focus');
      setTimeLeft(focusTimerSettings.focusDuration * 60);
      if (focusTimerSettings.autoStartFocus) {
        startTimeRef.current = new Date();
        setIsRunning(true);
      }
    }
  }, [mode, completedSessions, focusTimerSettings, playNotification, task, updateTask]);

  // Timer tick
  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, handleTimerComplete]);

  // Update timeLeft when mode or settings change (but not while running)
  useEffect(() => {
    if (!isRunning) {
      setTimeLeft(getDuration(mode));
    }
  }, [mode, focusTimerSettings, getDuration, isRunning]);

  // Handle exit with confirmation if time was tracked
  const handleExit = useCallback(() => {
    // If we have unsaved focus time (timer running or sessions completed), confirm exit
    if (startTimeRef.current || totalFocusTime > 0 || isRunning) {
      setShowExitConfirm(true);
    } else {
      onClose();
    }
  }, [totalFocusTime, isRunning, onClose]);

  // Save and exit - saves any ongoing session
  const handleSaveAndExit = useCallback(() => {
    // If there's an active session, save it
    if (startTimeRef.current && mode === 'focus') {
      const endTime = new Date().toISOString();
      const startTime = startTimeRef.current.toISOString();
      const duration = Math.floor(
        (new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000
      );

      if (duration > 60) { // Only save if more than 1 minute
        const newEntry = {
          id: Math.random().toString(36).substring(2, 15),
          taskId: task.id,
          startTime,
          endTime,
          duration,
        };
        updateTask(task.id, {
          timeEntries: [...task.timeEntries, newEntry],
        });
      }
    }
    onClose();
  }, [mode, task, updateTask, onClose]);

  // Keyboard shortcuts: Space to toggle, R to reset, Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Handle exit confirm dialog
      if (showExitConfirm) {
        if (e.code === 'Escape' || e.code === 'KeyN') {
          e.preventDefault();
          setShowExitConfirm(false);
        } else if (e.code === 'Enter' || e.code === 'KeyY') {
          e.preventDefault();
          handleSaveAndExit();
        }
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          toggleTimer();
          break;
        case 'KeyR':
          e.preventDefault();
          resetTimer();
          break;
        case 'Escape':
          e.preventDefault();
          handleExit();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRunning, showExitConfirm, handleExit, handleSaveAndExit]); // toggleTimer/resetTimer depend on isRunning

  const toggleTimer = () => {
    if (!isRunning && mode === 'focus' && !startTimeRef.current) {
      startTimeRef.current = new Date();
    }
    setIsRunning(!isRunning);
    if (!isRunning) {
      playGlobalSound('timerStart');
    } else {
      playGlobalSound('timerStop');
    }
  };

  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(getDuration(mode));
    startTimeRef.current = null;
  };

  const switchMode = (newMode: TimerMode) => {
    setIsRunning(false);
    setMode(newMode);
    setTimeLeft(getDuration(newMode));
    startTimeRef.current = null;
  };

  // Progress percentage
  const progress = ((getDuration(mode) - timeLeft) / getDuration(mode)) * 100;

  // Background color based on mode
  const getBgColor = () => {
    switch (mode) {
      case 'focus':
        return 'from-gray-900 to-gray-800';
      case 'shortBreak':
        return 'from-green-900 to-green-800';
      case 'longBreak':
        return 'from-blue-900 to-blue-800';
    }
  };

  const getAccentColor = () => {
    switch (mode) {
      case 'focus':
        return 'text-white';
      case 'shortBreak':
        return 'text-green-400';
      case 'longBreak':
        return 'text-blue-400';
    }
  };

  return (
    <div className={`fixed inset-0 bg-gradient-to-br ${getBgColor()} flex flex-col items-center justify-center z-50 transition-all duration-500`}>
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-6">
        <div className="flex items-center gap-3">
          <Target className={`w-5 h-5 ${getAccentColor()}`} />
          <span className="text-white/60 text-sm">Focus Mode</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-3 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-all"
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
          <button
            onClick={handleExit}
            className="p-3 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Task Info */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-white mb-2">{task.title}</h2>
        {client && (
          <span
            className="text-sm px-3 py-1 rounded-full"
            style={{ backgroundColor: `${client.color}30`, color: client.color }}
          >
            {client.name}
          </span>
        )}
      </div>

      {/* Mode Selector */}
      <div className="flex items-center gap-2 mb-8 bg-white/10 rounded-full p-1">
        <button
          onClick={() => switchMode('focus')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
            mode === 'focus' ? 'bg-white text-gray-900' : 'text-white/60 hover:text-white'
          }`}
        >
          <Target className="w-4 h-4 inline mr-2" />
          Focus
        </button>
        <button
          onClick={() => switchMode('shortBreak')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
            mode === 'shortBreak' ? 'bg-green-400 text-gray-900' : 'text-white/60 hover:text-white'
          }`}
        >
          <Coffee className="w-4 h-4 inline mr-2" />
          Kurze Pause
        </button>
        <button
          onClick={() => switchMode('longBreak')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
            mode === 'longBreak' ? 'bg-blue-400 text-gray-900' : 'text-white/60 hover:text-white'
          }`}
        >
          <Coffee className="w-4 h-4 inline mr-2" />
          Lange Pause
        </button>
      </div>

      {/* Timer Display */}
      <div className="relative mb-8">
        {/* Progress Ring */}
        <svg className="w-72 h-72 transform -rotate-90">
          <circle
            cx="144"
            cy="144"
            r="136"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="8"
          />
          <circle
            cx="144"
            cy="144"
            r="136"
            fill="none"
            stroke={mode === 'focus' ? '#fff' : mode === 'shortBreak' ? '#4ade80' : '#60a5fa'}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 136}
            strokeDashoffset={2 * Math.PI * 136 * (1 - progress / 100)}
            className="transition-all duration-1000"
          />
        </svg>

        {/* Time Display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-7xl font-light ${getAccentColor()} font-mono`}>
            {formatTime(timeLeft)}
          </span>
          <span className="text-white/40 text-sm mt-2">
            {mode === 'focus' ? 'Fokussieren' : mode === 'shortBreak' ? 'Kurze Pause' : 'Lange Pause'}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={resetTimer}
          className="p-4 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-all"
        >
          <RotateCcw className="w-6 h-6" />
        </button>

        <button
          onClick={toggleTimer}
          className={`p-6 rounded-full transition-all shadow-lg ${
            isRunning
              ? 'bg-white/20 hover:bg-white/30'
              : 'bg-white hover:bg-gray-100'
          }`}
        >
          {isRunning ? (
            <Pause className={`w-8 h-8 ${isRunning ? 'text-white' : 'text-gray-900'}`} />
          ) : (
            <Play className={`w-8 h-8 ${isRunning ? 'text-white' : 'text-gray-900'} ml-1`} />
          )}
        </button>

        <div className="w-14" /> {/* Spacer for symmetry */}
      </div>

      {/* Session Stats */}
      <div className="absolute bottom-8 flex items-center gap-8 text-white/40 text-sm">
        <div className="text-center">
          <div className="text-2xl font-semibold text-white">{completedSessions}</div>
          <div>Sessions</div>
        </div>
        <div className="w-px h-8 bg-white/20" />
        <div className="text-center">
          <div className="text-2xl font-semibold text-white">
            {Math.floor(totalFocusTime / 60)}m
          </div>
          <div>Focus Zeit</div>
        </div>
      </div>

      {/* Keyboard shortcut hints */}
      <div className="absolute bottom-8 right-8 text-white/30 text-xs flex items-center gap-3">
        <span>
          <kbd className="px-2 py-1 bg-white/10 rounded">Space</kbd> {isRunning ? 'Pause' : 'Start'}
        </span>
        <span>
          <kbd className="px-2 py-1 bg-white/10 rounded">R</kbd> Reset
        </span>
        <span>
          <kbd className="px-2 py-1 bg-white/10 rounded">Esc</kbd> Schließen
        </span>
      </div>

      {/* Exit Confirmation Dialog */}
      {showExitConfirm && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
          <div className="bg-white rounded-2xl p-6 max-w-sm mx-4 shadow-2xl animate-scale-in">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Session beenden?
            </h3>
            <p className="text-gray-600 text-sm mb-4">
              {totalFocusTime > 0 ? (
                <>Du hast <strong>{Math.floor(totalFocusTime / 60)} Min</strong> fokussiert in {completedSessions} Session{completedSessions !== 1 ? 's' : ''}.</>
              ) : startTimeRef.current ? (
                <>Du hast eine laufende Session. Die Zeit wird gespeichert.</>
              ) : (
                <>Möchtest du den Focus Mode verlassen?</>
              )}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl transition-all text-sm font-medium"
              >
                Fortsetzen
              </button>
              <button
                onClick={handleSaveAndExit}
                className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all text-sm font-medium"
              >
                Speichern & Beenden
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
