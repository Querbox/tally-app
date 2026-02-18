import { useCallback } from 'react';
import { useTaskStore } from '../stores/taskStore';
import { useToast } from '../components/common/Toast';
import { playGlobalSound } from './useSounds';
import type { Task } from '../types';

/**
 * Hook for optimistic task updates with automatic rollback on error
 * Provides instant UI feedback while persisting in the background
 */
export function useOptimisticTask() {
  const updateTask = useTaskStore((s) => s.updateTask);
  const deleteTask = useTaskStore((s) => s.deleteTask);
  const restoreTask = useTaskStore((s) => s.restoreTask);
  const { error: showError, withUndo } = useToast();

  /**
   * Toggle task completion with optimistic update
   */
  const toggleComplete = useCallback((task: Task) => {
    const wasCompleted = task.status === 'completed';
    const newStatus = wasCompleted ? 'todo' : 'completed';

    // Optimistic update - happens immediately
    try {
      updateTask(task.id, {
        status: newStatus,
        completedAt: wasCompleted ? undefined : new Date().toISOString(),
      });

      // Play sound only when completing
      if (!wasCompleted) {
        playGlobalSound('taskComplete');
      }
    } catch {
      // Rollback on error
      showError('Fehler beim Aktualisieren der Aufgabe');
      updateTask(task.id, {
        status: wasCompleted ? 'completed' : 'todo',
        completedAt: wasCompleted ? task.completedAt : undefined,
      });
    }
  }, [updateTask, showError]);

  /**
   * Delete task with undo option
   */
  const deleteWithUndo = useCallback((task: Task) => {
    playGlobalSound('taskDelete');
    deleteTask(task.id);

    // Show toast with undo option
    withUndo(
      `"${task.title}" gelöscht`,
      () => {
        restoreTask(task.id);
      }
    );
  }, [deleteTask, restoreTask, withUndo]);

  /**
   * Move task to a different date with optimistic update
   */
  const moveToDate = useCallback((task: Task, newDate: string) => {
    const oldDate = task.scheduledDate;

    try {
      updateTask(task.id, { scheduledDate: newDate });
    } catch {
      // Rollback on error
      showError('Fehler beim Verschieben der Aufgabe');
      updateTask(task.id, { scheduledDate: oldDate });
    }
  }, [updateTask, showError]);

  /**
   * Update task priority with optimistic update
   */
  const updatePriority = useCallback((task: Task, newPriority: Task['priority']) => {
    const oldPriority = task.priority;

    try {
      updateTask(task.id, { priority: newPriority });
    } catch {
      // Rollback on error
      showError('Fehler beim Ändern der Priorität');
      updateTask(task.id, { priority: oldPriority });
    }
  }, [updateTask, showError]);

  return {
    toggleComplete,
    deleteWithUndo,
    moveToDate,
    updatePriority,
  };
}
