import { useState, useEffect, useMemo, memo } from 'react';
import type { Task } from '../../types';
import { useTaskStore } from '../../stores/taskStore';
import { formatDuration } from '../../utils/timeUtils';
import { generateId } from '../../utils/idUtils';
import { playGlobalSound } from '../../hooks/useSounds';
import { Play, Square } from 'lucide-react';

interface TimerProps {
  task: Task;
}

export const Timer = memo(function Timer({ task }: TimerProps) {
  const updateTask = useTaskStore((s) => s.updateTask);
  const [elapsed, setElapsed] = useState(0);

  const activeEntry = useMemo(
    () => task.timeEntries.find((e) => !e.endTime),
    [task.timeEntries]
  );
  const isRunning = !!activeEntry;

  // Memoize total time calculation to avoid recalculating on every tick
  const totalTime = useMemo(() => {
    return task.timeEntries.reduce((acc, entry) => {
      if (entry.duration) return acc + entry.duration;
      if (entry.endTime) {
        return acc + (new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime()) / 1000;
      }
      return acc;
    }, 0);
  }, [task.timeEntries]);

  useEffect(() => {
    if (!isRunning || !activeEntry) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const start = new Date(activeEntry.startTime).getTime();
      setElapsed(Math.floor((now - start) / 1000));
    }, 1000);

    // Initial calculation
    const now = new Date().getTime();
    const start = new Date(activeEntry.startTime).getTime();
    setElapsed(Math.floor((now - start) / 1000));

    return () => clearInterval(interval);
  }, [isRunning, activeEntry]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isRunning && activeEntry) {
      playGlobalSound('timerStop');
      const endTime = new Date().toISOString();
      const duration = Math.floor(
        (new Date(endTime).getTime() - new Date(activeEntry.startTime).getTime()) / 1000
      );

      const updatedEntries = task.timeEntries.map((entry) =>
        entry.id === activeEntry.id ? { ...entry, endTime, duration } : entry
      );

      updateTask(task.id, {
        timeEntries: updatedEntries,
        status: 'in_progress',
      });
      setElapsed(0);
    } else {
      playGlobalSound('timerStart');
      const newEntry = {
        id: generateId(),
        taskId: task.id,
        startTime: new Date().toISOString(),
      };

      updateTask(task.id, {
        timeEntries: [...task.timeEntries, newEntry],
        status: 'in_progress',
      });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-mono text-gray-500 min-w-[60px] text-right">
        {formatDuration(totalTime + elapsed)}
      </span>

      <button
        onClick={handleToggle}
        className={`
          w-8 h-8 rounded-full flex items-center justify-center
          transition-all
          ${
            isRunning
              ? 'bg-red-100 text-red-600 hover:bg-red-200'
              : 'bg-gray-100 text-gray-600 hover:bg-green-100 hover:text-green-600'
          }
        `}
      >
        {isRunning ? (
          <Square className="w-3 h-3" fill="currentColor" />
        ) : (
          <Play className="w-3 h-3 ml-0.5" fill="currentColor" />
        )}
      </button>
    </div>
  );
});
