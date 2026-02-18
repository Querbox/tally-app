import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import type { Task, Client, Tag, TaskPriority, RecurrenceRule, TaskTemplate, RecurringMeeting } from '../types';
import { createFileStorage, STORAGE_FILES, isTauri } from '../lib/fileStorage';
import { generateId } from '../utils/idUtils';

// Priority order for sorting (higher = more important)
const PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

// Geloeschte Task mit Timestamp
export interface DeletedTask extends Task {
  deletedAt: string;
}

interface TaskStore {
  tasks: Task[];
  deletedTasks: DeletedTask[]; // Papierkorb
  clients: Client[];
  tags: Tag[];
  templates: TaskTemplate[];
  recurringMeetings: RecurringMeeting[];

  // Task Actions
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'postponeCount' | 'priority'> & { priority?: TaskPriority }) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  restoreTask: (id: string) => void;
  permanentlyDeleteTask: (id: string) => void;
  emptyTrash: () => void;
  cleanupOldDeletedTasks: () => void; // Entfernt Tasks aelter als 7 Tage
  setTaskPriority: (id: string, priority: TaskPriority) => void;

  // Recurring Task Actions
  generateRecurringInstances: (date: string) => void;

  // Client Actions
  addClient: (client: Omit<Client, 'id' | 'createdAt'>) => void;
  updateClient: (id: string, updates: Partial<Client>) => void;
  deleteClient: (id: string) => void;

  // Tag Actions
  addTag: (tag: Omit<Tag, 'id'>) => void;
  updateTag: (id: string, updates: Partial<Tag>) => void;
  deleteTag: (id: string) => void;

  // Template Actions
  addTemplate: (template: Omit<TaskTemplate, 'id' | 'createdAt'>) => void;
  updateTemplate: (id: string, updates: Partial<TaskTemplate>) => void;
  deleteTemplate: (id: string) => void;
  createTaskFromTemplate: (templateId: string, scheduledDate: string) => void;

  // Recurring Meeting Actions
  addRecurringMeeting: (meeting: Omit<RecurringMeeting, 'id' | 'createdAt'>) => void;
  updateRecurringMeeting: (id: string, updates: Partial<RecurringMeeting>) => void;
  deleteRecurringMeeting: (id: string) => void;
  getRecurringMeetingsForDate: (date: string) => RecurringMeeting[];
  generateMeetingInstancesForDate: (date: string) => void;
  generateMeetingInstancesForDates: (dates: string[]) => void; // Batch version for performance

  // Cleanup Actions
  cleanupOldRecurringInstances: () => void; // Remove old completed/missed meeting instances

  // Day Logic
  processEndOfDay: (date: string) => void;
  getTasksForDate: (date: string) => Task[];
  getTasksForDateSorted: (date: string) => Task[];
  getUnfinishedTasksBeforeDate: (date: string) => Task[];
}

// Sort tasks by priority (highest first), then by meeting time, then by creation date
function sortTasksByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    // Meetings always come first, sorted by time
    if (a.isMeeting && b.isMeeting) {
      const aTime = a.meetingTime?.start || '';
      const bTime = b.meetingTime?.start || '';
      return aTime.localeCompare(bTime);
    }
    if (a.isMeeting) return -1;
    if (b.isMeeting) return 1;

    // Then sort by priority
    const priorityA = PRIORITY_ORDER[a.priority || 'medium'];
    const priorityB = PRIORITY_ORDER[b.priority || 'medium'];
    if (priorityA !== priorityB) {
      return priorityB - priorityA; // Higher priority first
    }

    // Same priority: sort by creation date
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

function getNextDate(dateString: string): string {
  const date = new Date(dateString);
  date.setDate(date.getDate() + 1);
  return date.toISOString().split('T')[0];
}

// Check if a date matches a recurrence rule
function shouldRecurOnDate(rule: RecurrenceRule, startDate: string, targetDate: string): boolean {
  const start = new Date(startDate);
  const target = new Date(targetDate);

  // Check end date
  if (rule.endDate && target > new Date(rule.endDate)) return false;

  // For the start date itself, return true
  if (target.toISOString().split('T')[0] === start.toISOString().split('T')[0]) return true;

  // Don't create instances for dates before the start
  if (target < start) return false;

  switch (rule.type) {
    case 'daily': {
      const daysDiff = Math.floor((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return daysDiff % rule.interval === 0;
    }
    case 'weekly': {
      const dayOfWeek = target.getDay();
      if (rule.weekDays && rule.weekDays.length > 0) {
        if (!rule.weekDays.includes(dayOfWeek)) return false;
      }
      const weeksDiff = Math.floor((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7));
      return weeksDiff % rule.interval === 0;
    }
    case 'monthly': {
      const targetDay = rule.monthDay || start.getDate();
      if (target.getDate() !== targetDay) return false;
      const monthsDiff =
        (target.getFullYear() - start.getFullYear()) * 12 + (target.getMonth() - start.getMonth());
      return monthsDiff % rule.interval === 0;
    }
    case 'yearly': {
      if (target.getMonth() !== start.getMonth() || target.getDate() !== start.getDate()) return false;
      const yearsDiff = target.getFullYear() - start.getFullYear();
      return yearsDiff % rule.interval === 0;
    }
    case 'custom': {
      if (!rule.customDays) return false;
      const daysDiff = Math.floor((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return daysDiff % rule.customDays === 0;
    }
    default:
      return false;
  }
}

// Migrate data from old FlowsApp storage to new Tally storage
function migrateFromFlowsApp() {
  const oldStorage = localStorage.getItem('flows-app-storage');
  const newStorage = localStorage.getItem('tally-storage');

  if (oldStorage && !newStorage) {
    localStorage.setItem('tally-storage', oldStorage);
    localStorage.removeItem('flows-app-storage');
  }
}

// Run migration on module load
migrateFromFlowsApp();

// Definiere den State-Typ separat fuer den Storage-Adapter
interface TaskStoreState {
  tasks: Task[];
  deletedTasks: DeletedTask[];
  clients: Client[];
  tags: Tag[];
  templates: TaskTemplate[];
  recurringMeetings: RecurringMeeting[];
}

// Erstelle den File-Storage-Adapter fuer Tauri
const fileStorage = createFileStorage<TaskStoreState>(STORAGE_FILES.tasks);

// Verwende File-Storage in Tauri, ansonsten localStorage als Fallback
const storage: StateStorage = isTauri()
  ? fileStorage
  : {
      getItem: (name) => {
        const value = localStorage.getItem(name);
        return value ? Promise.resolve(value) : Promise.resolve(null);
      },
      setItem: (name, value) => {
        localStorage.setItem(name, value);
        return Promise.resolve();
      },
      removeItem: (name) => {
        localStorage.removeItem(name);
        return Promise.resolve();
      },
    };

export const useTaskStore = create<TaskStore>()(
  persist(
    (set, get) => ({
      tasks: [],
      deletedTasks: [],
      clients: [],
      tags: [],
      templates: [],
      recurringMeetings: [],

      addTask: (taskData) => {
        const newTask: Task = {
          ...taskData,
          id: generateId(),
          createdAt: new Date().toISOString(),
          postponeCount: 0,
          priority: taskData.priority || 'medium',
        };
        set((state) => ({ tasks: [...state.tasks, newTask] }));
      },

      updateTask: (id, updates) => {
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id ? { ...task, ...updates } : task
          ),
        }));
      },

      deleteTask: (id) => {
        set((state) => {
          const taskToDelete = state.tasks.find((task) => task.id === id);
          if (!taskToDelete) return state;

          const deletedTask: DeletedTask = {
            ...taskToDelete,
            deletedAt: new Date().toISOString(),
          };

          return {
            tasks: state.tasks.filter((task) => task.id !== id),
            deletedTasks: [...state.deletedTasks, deletedTask],
          };
        });
      },

      restoreTask: (id) => {
        set((state) => {
          const taskToRestore = state.deletedTasks.find((task) => task.id === id);
          if (!taskToRestore) return state;

          // Entferne deletedAt Property beim Wiederherstellen
          const { deletedAt: _, ...restoredTask } = taskToRestore;

          return {
            deletedTasks: state.deletedTasks.filter((task) => task.id !== id),
            tasks: [...state.tasks, restoredTask as Task],
          };
        });
      },

      permanentlyDeleteTask: (id) => {
        set((state) => ({
          deletedTasks: state.deletedTasks.filter((task) => task.id !== id),
        }));
      },

      emptyTrash: () => {
        set({ deletedTasks: [] });
      },

      cleanupOldDeletedTasks: () => {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        set((state) => ({
          deletedTasks: state.deletedTasks.filter(
            (task) => new Date(task.deletedAt) > sevenDaysAgo
          ),
        }));
      },

      setTaskPriority: (id, priority) => {
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id ? { ...task, priority } : task
          ),
        }));
      },

      generateRecurringInstances: (date: string) => {
        const state = get();
        const recurringTasks = state.tasks.filter(
          (task) => task.recurrence && task.recurrence.type !== 'none' && !task.recurrenceParentId
        );

        const newTasks: Task[] = [];

        for (const parentTask of recurringTasks) {
          if (!parentTask.recurrence) continue;

          // Check if we should create an instance for this date
          if (!shouldRecurOnDate(parentTask.recurrence, parentTask.scheduledDate, date)) {
            continue;
          }

          // Check if instance already exists for this date
          const existingInstance = state.tasks.find(
            (t) => t.recurrenceParentId === parentTask.id && t.scheduledDate === date
          );

          if (existingInstance) continue;

          // Create new instance
          const newTask: Task = {
            ...parentTask,
            id: generateId(),
            scheduledDate: date,
            status: 'todo',
            recurrenceParentId: parentTask.id,
            recurrence: undefined, // Instances don't have their own recurrence
            timeEntries: [],
            subtasks: parentTask.subtasks.map((s) => ({ ...s, isCompleted: false })),
            createdAt: new Date().toISOString(),
            completedAt: undefined,
            postponeCount: 0,
          };

          newTasks.push(newTask);
        }

        if (newTasks.length > 0) {
          set((state) => ({ tasks: [...state.tasks, ...newTasks] }));
        }
      },

      addClient: (clientData) => {
        const newClient: Client = {
          ...clientData,
          id: generateId(),
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ clients: [...state.clients, newClient] }));
      },

      updateClient: (id, updates) => {
        set((state) => ({
          clients: state.clients.map((client) =>
            client.id === id ? { ...client, ...updates } : client
          ),
        }));
      },

      deleteClient: (id) => {
        set((state) => ({
          clients: state.clients.filter((client) => client.id !== id),
          // Bereinige Referenzen in Tasks
          tasks: state.tasks.map((task) =>
            task.clientId === id ? { ...task, clientId: undefined } : task
          ),
          // Bereinige Referenzen in geloeschten Tasks
          deletedTasks: state.deletedTasks.map((task) =>
            task.clientId === id ? { ...task, clientId: undefined } : task
          ),
          // Bereinige Referenzen in Templates
          templates: state.templates.map((template) =>
            template.clientId === id ? { ...template, clientId: undefined } : template
          ),
          // Bereinige Referenzen in wiederkehrenden Meetings
          recurringMeetings: state.recurringMeetings.map((meeting) =>
            meeting.clientId === id ? { ...meeting, clientId: undefined } : meeting
          ),
        }));
      },

      addTag: (tagData) => {
        const newTag: Tag = {
          ...tagData,
          id: generateId(),
        };
        set((state) => ({ tags: [...state.tags, newTag] }));
      },

      updateTag: (id, updates) => {
        set((state) => ({
          tags: state.tags.map((tag) =>
            tag.id === id ? { ...tag, ...updates } : tag
          ),
        }));
      },

      deleteTag: (id) => {
        set((state) => ({
          tags: state.tags.filter((tag) => tag.id !== id),
          // Bereinige Referenzen in Tasks
          tasks: state.tasks.map((task) => ({
            ...task,
            tagIds: task.tagIds.filter((tagId) => tagId !== id),
          })),
          // Bereinige Referenzen in geloeschten Tasks
          deletedTasks: state.deletedTasks.map((task) => ({
            ...task,
            tagIds: task.tagIds.filter((tagId) => tagId !== id),
          })),
          // Bereinige Referenzen in Templates
          templates: state.templates.map((template) => ({
            ...template,
            tagIds: template.tagIds.filter((tagId) => tagId !== id),
          })),
        }));
      },

      addTemplate: (templateData) => {
        const newTemplate: TaskTemplate = {
          ...templateData,
          id: generateId(),
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ templates: [...state.templates, newTemplate] }));
      },

      updateTemplate: (id, updates) => {
        set((state) => ({
          templates: state.templates.map((template) =>
            template.id === id ? { ...template, ...updates } : template
          ),
        }));
      },

      deleteTemplate: (id) => {
        set((state) => ({
          templates: state.templates.filter((template) => template.id !== id),
        }));
      },

      createTaskFromTemplate: (templateId, scheduledDate) => {
        const template = get().templates.find((t) => t.id === templateId);
        if (!template) return;

        const newTask: Task = {
          id: generateId(),
          title: template.title,
          description: template.description,
          status: 'todo',
          priority: template.priority,
          scheduledDate,
          clientId: template.clientId,
          tagIds: template.tagIds,
          subtasks: template.subtasks.map((s, i) => ({
            id: generateId(),
            title: s.title,
            isCompleted: false,
            order: i,
          })),
          isSpontaneous: false,
          isMeeting: template.isMeeting,
          meetingTime: template.isMeeting && template.meetingDuration
            ? { start: '09:00', end: `${9 + Math.floor(template.meetingDuration / 60)}:${String(template.meetingDuration % 60).padStart(2, '0')}` }
            : undefined,
          timeEntries: [],
          createdAt: new Date().toISOString(),
          postponeCount: 0,
        };
        set((state) => ({ tasks: [...state.tasks, newTask] }));
      },

      // Recurring Meeting Actions
      addRecurringMeeting: (meetingData) => {
        const newMeeting: RecurringMeeting = {
          ...meetingData,
          id: generateId(),
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ recurringMeetings: [...state.recurringMeetings, newMeeting] }));
      },

      updateRecurringMeeting: (id, updates) => {
        set((state) => ({
          recurringMeetings: state.recurringMeetings.map((meeting) =>
            meeting.id === id ? { ...meeting, ...updates } : meeting
          ),
        }));
      },

      deleteRecurringMeeting: (id) => {
        set((state) => ({
          recurringMeetings: state.recurringMeetings.filter((meeting) => meeting.id !== id),
          // Also remove all generated instances
          tasks: state.tasks.filter((task) => task.recurrenceParentId !== id),
        }));
      },

      getRecurringMeetingsForDate: (date: string) => {
        const state = get();
        return state.recurringMeetings.filter((meeting) =>
          shouldRecurOnDate(meeting.recurrence, meeting.startDate, date)
        );
      },

      generateMeetingInstancesForDate: (date: string) => {
        const state = get();
        const newTasks: Task[] = [];

        for (const meeting of state.recurringMeetings) {
          if (!shouldRecurOnDate(meeting.recurrence, meeting.startDate, date)) {
            continue;
          }

          // Check if instance already exists for this date
          const existingInstance = state.tasks.find(
            (t) => t.recurrenceParentId === meeting.id && t.scheduledDate === date
          );

          if (existingInstance) continue;

          // Create new meeting instance
          const newTask: Task = {
            id: generateId(),
            title: meeting.title,
            description: meeting.description,
            status: 'todo',
            priority: 'medium',
            scheduledDate: date,
            clientId: meeting.clientId,
            tagIds: [],
            subtasks: [],
            isSpontaneous: false,
            isMeeting: true,
            meetingTime: meeting.meetingTime,
            recurrenceParentId: meeting.id,
            timeEntries: [],
            createdAt: new Date().toISOString(),
            postponeCount: 0,
          };

          newTasks.push(newTask);
        }

        if (newTasks.length > 0) {
          set((state) => ({ tasks: [...state.tasks, ...newTasks] }));
        }
      },

      // Batch version: Generate instances for multiple dates in one store update
      generateMeetingInstancesForDates: (dates: string[]) => {
        const state = get();
        const newTasks: Task[] = [];

        for (const date of dates) {
          for (const meeting of state.recurringMeetings) {
            if (!shouldRecurOnDate(meeting.recurrence, meeting.startDate, date)) {
              continue;
            }

            // Check if instance already exists for this date
            const existingInstance = state.tasks.find(
              (t) => t.recurrenceParentId === meeting.id && t.scheduledDate === date
            );

            if (existingInstance) continue;

            // Also check in newTasks (in case we're adding multiple for same meeting)
            const alreadyAdding = newTasks.find(
              (t) => t.recurrenceParentId === meeting.id && t.scheduledDate === date
            );

            if (alreadyAdding) continue;

            // Create new meeting instance
            const newTask: Task = {
              id: generateId(),
              title: meeting.title,
              description: meeting.description,
              status: 'todo',
              priority: 'medium',
              scheduledDate: date,
              clientId: meeting.clientId,
              tagIds: [],
              subtasks: [],
              isSpontaneous: false,
              isMeeting: true,
              meetingTime: meeting.meetingTime,
              recurrenceParentId: meeting.id,
              timeEntries: [],
              createdAt: new Date().toISOString(),
              postponeCount: 0,
            };

            newTasks.push(newTask);
          }
        }

        // Single store update for all dates
        if (newTasks.length > 0) {
          set((state) => ({ tasks: [...state.tasks, ...newTasks] }));
        }
      },

      // Cleanup old recurring instances to prevent storage bloat
      // Removes meeting instances that are:
      // - Generated from recurring meetings (have recurrenceParentId)
      // - Either completed or older than 30 days
      cleanupOldRecurringInstances: () => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];

        set((state) => {
          const tasksToKeep = state.tasks.filter((task) => {
            // Keep all non-recurring tasks
            if (!task.recurrenceParentId) return true;

            // Keep recurring task instances if they are:
            // - Not completed AND scheduled for within the last 30 days or in the future
            if (task.status !== 'completed' && task.scheduledDate >= cutoffDate) {
              return true;
            }

            // Remove completed instances older than 30 days
            if (task.status === 'completed' && task.scheduledDate < cutoffDate) {
              return false;
            }

            // Remove uncompleted instances older than 30 days (missed meetings)
            if (task.scheduledDate < cutoffDate) {
              return false;
            }

            return true;
          });

          const removedCount = state.tasks.length - tasksToKeep.length;
          if (removedCount > 0) {
            console.log(`[TaskStore] Cleaned up ${removedCount} old recurring instances`);
          }

          return { tasks: tasksToKeep };
        });
      },

      processEndOfDay: (date: string) => {
        const nextDate = getNextDate(date);

        set((state) => ({
          tasks: state.tasks.map((task) => {
            if (task.scheduledDate !== date) return task;
            if (task.status === 'completed') return task;
            if (task.isMeeting) return task;

            return {
              ...task,
              scheduledDate: nextDate,
              originalDate: task.originalDate || date,
              postponeCount: task.postponeCount + 1,
              status: 'todo' as const,
            };
          }),
        }));
      },

      getTasksForDate: (date: string) => {
        return get().tasks.filter((task) => task.scheduledDate === date);
      },

      getTasksForDateSorted: (date: string) => {
        const tasks = get().tasks.filter((task) => task.scheduledDate === date);
        return sortTasksByPriority(tasks);
      },

      getUnfinishedTasksBeforeDate: (date: string) => {
        return get().tasks.filter(
          (task) => task.scheduledDate < date && task.status !== 'completed' && !task.isMeeting
        );
      },
    }),
    {
      name: 'tally-storage',
      storage: createJSONStorage(() => storage),
    }
  )
);
