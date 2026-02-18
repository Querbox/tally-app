import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import type { WorkDay, WorkBlock, BreakEntry } from '../types';
import { createFileStorage, STORAGE_FILES, isTauri } from '../lib/fileStorage';
import { generateId } from '../utils/idUtils';

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

function getWeekDates(date: string): string[] {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(d.setDate(diff));

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const current = new Date(monday);
    current.setDate(monday.getDate() + i);
    dates.push(current.toISOString().split('T')[0]);
  }
  return dates;
}

function getMonthDates(date: string): string[] {
  const d = new Date(date);
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

interface WorkTimeStore {
  workDays: WorkDay[];

  // Getters
  getTodayWorkDay: () => WorkDay | undefined;
  getWorkDay: (date: string) => WorkDay | undefined;
  getWorkDaysInRange: (startDate: string, endDate: string) => WorkDay[];

  // Work Actions
  startWork: () => void;
  stopWork: () => void;

  // Break Actions
  startBreak: () => void;
  endBreak: () => void;

  // Edit Actions
  updateWorkBlock: (date: string, blockId: string, updates: Partial<WorkBlock>) => void;
  deleteWorkBlock: (date: string, blockId: string) => void;
  addWorkBlock: (date: string, startTime: string, endTime: string) => void;
  updateBreak: (date: string, breakId: string, updates: Partial<BreakEntry>) => void;
  deleteBreak: (date: string, breakId: string) => void;
  addBreak: (date: string, startTime: string, endTime: string) => void;

  // Computed
  getTotalWorkTime: (date: string) => number;
  getTotalBreakTime: (date: string) => number;
  getNetWorkTime: (date: string) => number;
  getWeeklyWorkTime: (date: string) => number;
  getMonthlyWorkTime: (date: string) => number;
}

// Migrate data from old FlowsApp storage to new Tally storage
function migrateFromFlowsApp() {
  const oldStorage = localStorage.getItem('flows-app-worktime');
  const newStorage = localStorage.getItem('tally-worktime');

  if (oldStorage && !newStorage) {
    localStorage.setItem('tally-worktime', oldStorage);
    localStorage.removeItem('flows-app-worktime');
  }
}

// Run migration on module load
migrateFromFlowsApp();

// Definiere den State-Typ separat fuer den Storage-Adapter
interface WorkTimeStoreState {
  workDays: WorkDay[];
}

// Erstelle den File-Storage-Adapter fuer Tauri
const fileStorage = createFileStorage<WorkTimeStoreState>(STORAGE_FILES.worktime);

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

export const useWorkTimeStore = create<WorkTimeStore>()(
  persist(
    (set, get) => ({
      workDays: [],

      getTodayWorkDay: () => {
        const today = getTodayString();
        return get().workDays.find((wd) => wd.date === today);
      },

      getWorkDay: (date: string) => {
        return get().workDays.find((wd) => wd.date === date);
      },

      getWorkDaysInRange: (startDate: string, endDate: string) => {
        return get().workDays.filter(
          (wd) => wd.date >= startDate && wd.date <= endDate
        );
      },

      startWork: () => {
        const today = getTodayString();
        const now = new Date().toISOString();

        set((state) => {
          const existingDay = state.workDays.find((wd) => wd.date === today);

          if (existingDay) {
            return {
              workDays: state.workDays.map((wd) =>
                wd.date === today
                  ? {
                      ...wd,
                      workBlocks: [
                        ...wd.workBlocks,
                        { id: generateId(), startTime: now },
                      ],
                      isWorking: true,
                    }
                  : wd
              ),
            };
          } else {
            const newWorkDay: WorkDay = {
              date: today,
              workBlocks: [{ id: generateId(), startTime: now }],
              breaks: [],
              isWorking: true,
              isOnBreak: false,
            };
            return {
              workDays: [...state.workDays, newWorkDay],
            };
          }
        });
      },

      stopWork: () => {
        const today = getTodayString();
        const now = new Date().toISOString();

        set((state) => ({
          workDays: state.workDays.map((wd) => {
            if (wd.date !== today) return wd;

            const updatedBreaks = wd.breaks.map((b) =>
              !b.endTime ? { ...b, endTime: now } : b
            );

            const updatedBlocks = wd.workBlocks.map((block, index) =>
              index === wd.workBlocks.length - 1 && !block.endTime
                ? { ...block, endTime: now }
                : block
            );

            return {
              ...wd,
              workBlocks: updatedBlocks,
              breaks: updatedBreaks,
              isWorking: false,
              isOnBreak: false,
            };
          }),
        }));
      },

      startBreak: () => {
        const today = getTodayString();
        const now = new Date().toISOString();

        set((state) => ({
          workDays: state.workDays.map((wd) =>
            wd.date === today
              ? {
                  ...wd,
                  breaks: [...wd.breaks, { id: generateId(), startTime: now }],
                  isOnBreak: true,
                }
              : wd
          ),
        }));
      },

      endBreak: () => {
        const today = getTodayString();
        const now = new Date().toISOString();

        set((state) => ({
          workDays: state.workDays.map((wd) => {
            if (wd.date !== today) return wd;

            const updatedBreaks = wd.breaks.map((b, index) =>
              index === wd.breaks.length - 1 && !b.endTime
                ? { ...b, endTime: now }
                : b
            );

            return {
              ...wd,
              breaks: updatedBreaks,
              isOnBreak: false,
            };
          }),
        }));
      },

      updateWorkBlock: (date: string, blockId: string, updates: Partial<WorkBlock>) => {
        set((state) => ({
          workDays: state.workDays.map((wd) =>
            wd.date === date
              ? {
                  ...wd,
                  workBlocks: wd.workBlocks.map((block) =>
                    block.id === blockId ? { ...block, ...updates } : block
                  ),
                }
              : wd
          ),
        }));
      },

      deleteWorkBlock: (date: string, blockId: string) => {
        set((state) => ({
          workDays: state.workDays.map((wd) =>
            wd.date === date
              ? {
                  ...wd,
                  workBlocks: wd.workBlocks.filter((block) => block.id !== blockId),
                }
              : wd
          ),
        }));
      },

      addWorkBlock: (date: string, startTime: string, endTime: string) => {
        set((state) => {
          const existingDay = state.workDays.find((wd) => wd.date === date);

          if (existingDay) {
            return {
              workDays: state.workDays.map((wd) =>
                wd.date === date
                  ? {
                      ...wd,
                      workBlocks: [
                        ...wd.workBlocks,
                        { id: generateId(), startTime, endTime },
                      ],
                    }
                  : wd
              ),
            };
          } else {
            const newWorkDay: WorkDay = {
              date,
              workBlocks: [{ id: generateId(), startTime, endTime }],
              breaks: [],
              isWorking: false,
              isOnBreak: false,
            };
            return {
              workDays: [...state.workDays, newWorkDay],
            };
          }
        });
      },

      updateBreak: (date: string, breakId: string, updates: Partial<BreakEntry>) => {
        set((state) => ({
          workDays: state.workDays.map((wd) =>
            wd.date === date
              ? {
                  ...wd,
                  breaks: wd.breaks.map((b) =>
                    b.id === breakId ? { ...b, ...updates } : b
                  ),
                }
              : wd
          ),
        }));
      },

      deleteBreak: (date: string, breakId: string) => {
        set((state) => ({
          workDays: state.workDays.map((wd) =>
            wd.date === date
              ? {
                  ...wd,
                  breaks: wd.breaks.filter((b) => b.id !== breakId),
                }
              : wd
          ),
        }));
      },

      addBreak: (date: string, startTime: string, endTime: string) => {
        set((state) => {
          const existingDay = state.workDays.find((wd) => wd.date === date);

          if (existingDay) {
            return {
              workDays: state.workDays.map((wd) =>
                wd.date === date
                  ? {
                      ...wd,
                      breaks: [
                        ...wd.breaks,
                        { id: generateId(), startTime, endTime },
                      ],
                    }
                  : wd
              ),
            };
          }
          return state;
        });
      },

      getTotalWorkTime: (date: string) => {
        const workDay = get().workDays.find((wd) => wd.date === date);
        if (!workDay) return 0;

        return workDay.workBlocks.reduce((total, block) => {
          const start = new Date(block.startTime).getTime();
          const end = block.endTime
            ? new Date(block.endTime).getTime()
            : Date.now();
          return total + (end - start);
        }, 0);
      },

      getTotalBreakTime: (date: string) => {
        const workDay = get().workDays.find((wd) => wd.date === date);
        if (!workDay) return 0;

        return workDay.breaks.reduce((total, breakEntry) => {
          const start = new Date(breakEntry.startTime).getTime();
          const end = breakEntry.endTime
            ? new Date(breakEntry.endTime).getTime()
            : Date.now();
          return total + (end - start);
        }, 0);
      },

      getNetWorkTime: (date: string) => {
        const totalWork = get().getTotalWorkTime(date);
        const totalBreak = get().getTotalBreakTime(date);
        return Math.max(0, totalWork - totalBreak);
      },

      getWeeklyWorkTime: (date: string) => {
        const weekDates = getWeekDates(date);
        return weekDates.reduce((total, d) => total + get().getNetWorkTime(d), 0);
      },

      getMonthlyWorkTime: (date: string) => {
        const monthDates = getMonthDates(date);
        return monthDates.reduce((total, d) => total + get().getNetWorkTime(d), 0);
      },
    }),
    {
      name: 'tally-worktime',
      storage: createJSONStorage(() => storage),
    }
  )
);
