import { useMemo } from 'react';
import { useTaskStore } from '../stores/taskStore';
import type { Client, Tag, TaskPriority } from '../types';

/**
 * Optimized selectors for task data
 * These prevent unnecessary re-renders by using stable selectors
 */

// Priority order for sorting
const PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Get tasks for a specific date with memoization
 */
export function useTasksForDate(date: string) {
  const tasks = useTaskStore((s) => s.tasks);

  return useMemo(() => {
    return tasks.filter((task) => task.scheduledDate === date);
  }, [tasks, date]);
}

/**
 * Get tasks for today
 */
export function useTodayTasks() {
  const tasks = useTaskStore((s) => s.tasks);
  const today = useMemo(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }, []);

  return useMemo(() => {
    return tasks.filter((task) => task.scheduledDate === today);
  }, [tasks, today]);
}

/**
 * Get incomplete tasks for today (for focus mode, etc.)
 */
export function useIncompleteTodayTasks() {
  const todayTasks = useTodayTasks();

  return useMemo(() => {
    return todayTasks
      .filter((t) => t.status !== 'completed' && !t.isMeeting)
      .sort((a, b) => {
        const pa = PRIORITY_ORDER[a.priority || 'medium'];
        const pb = PRIORITY_ORDER[b.priority || 'medium'];
        return pb - pa;
      });
  }, [todayTasks]);
}

/**
 * Get a client by ID with memoization
 */
export function useClientById(clientId: string | undefined): Client | undefined {
  const clients = useTaskStore((s) => s.clients);

  return useMemo(() => {
    if (!clientId) return undefined;
    return clients.find((c) => c.id === clientId);
  }, [clients, clientId]);
}

/**
 * Get multiple clients by IDs
 */
export function useClientsByIds(clientIds: string[]): Map<string, Client> {
  const clients = useTaskStore((s) => s.clients);

  return useMemo(() => {
    const map = new Map<string, Client>();
    for (const client of clients) {
      if (clientIds.includes(client.id)) {
        map.set(client.id, client);
      }
    }
    return map;
  }, [clients, clientIds]);
}

/**
 * Get tags by IDs with memoization
 */
export function useTagsByIds(tagIds: string[]): Tag[] {
  const tags = useTaskStore((s) => s.tags);

  return useMemo(() => {
    if (tagIds.length === 0) return [];
    return tags.filter((t) => tagIds.includes(t.id));
  }, [tags, tagIds]);
}

/**
 * Calculate statistics for today's tasks
 */
export function useTodayStats() {
  const todayTasks = useTodayTasks();

  return useMemo(() => {
    const meetings = todayTasks.filter((t) => t.isMeeting);
    const tasks = todayTasks.filter((t) => !t.isMeeting);
    const completedTasks = tasks.filter((t) => t.status === 'completed');
    const pendingTasks = tasks.filter((t) => t.status !== 'completed');

    const totalTime = todayTasks.reduce((acc, task) => {
      return acc + task.timeEntries.reduce((sum, entry) => sum + (entry.duration || 0), 0);
    }, 0);

    return {
      totalTasks: tasks.length,
      completedTasks: completedTasks.length,
      pendingTasks: pendingTasks.length,
      meetings: meetings.length,
      completionRate: tasks.length > 0 ? (completedTasks.length / tasks.length) * 100 : 0,
      totalTime,
    };
  }, [todayTasks]);
}

/**
 * Get tasks with overdue status (scheduled before today, not completed)
 */
export function useOverdueTasks() {
  const tasks = useTaskStore((s) => s.tasks);

  return useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return tasks.filter(
      (task) =>
        task.scheduledDate < today &&
        task.status !== 'completed' &&
        !task.isMeeting
    );
  }, [tasks]);
}

/**
 * Get active clients (for dropdowns, etc.)
 */
export function useActiveClients() {
  const clients = useTaskStore((s) => s.clients);

  return useMemo(() => {
    return clients.filter((c) => c.isActive);
  }, [clients]);
}

/**
 * Search tasks by query
 */
export function useTaskSearch(query: string) {
  const tasks = useTaskStore((s) => s.tasks);

  return useMemo(() => {
    if (!query.trim()) return [];

    const lowerQuery = query.toLowerCase();
    return tasks.filter((task) =>
      task.title.toLowerCase().includes(lowerQuery) ||
      (task.description && task.description.toLowerCase().includes(lowerQuery))
    );
  }, [tasks, query]);
}
