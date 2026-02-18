import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { createFileStorage, STORAGE_FILES, isTauri } from '../lib/fileStorage';
import { generateId } from '../utils/idUtils';

export interface WhiteboardNode {
  id: string;
  taskId: string;
  parentId: string | null;
  title: string;
  status: 'pending' | 'in_progress' | 'completed';
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  collapsed: boolean;
  notes: string;
}

export interface WhiteboardConnection {
  id: string;
  fromId: string;
  toId: string;
}

export interface Whiteboard {
  id: string;
  taskId: string;
  nodes: WhiteboardNode[];
  connections: WhiteboardConnection[];
  zoom: number;
  panX: number;
  panY: number;
  createdAt: number;
  updatedAt: number;
}

interface WhiteboardStore {
  whiteboards: Record<string, Whiteboard>;

  getWhiteboard: (taskId: string) => Whiteboard | null;
  createWhiteboard: (taskId: string, taskTitle: string) => Whiteboard;
  clearAllWhiteboards: () => void;

  addNode: (taskId: string, node: Omit<WhiteboardNode, 'id'>) => void;
  updateNode: (taskId: string, nodeId: string, updates: Partial<WhiteboardNode>) => void;
  deleteNode: (taskId: string, nodeId: string) => void;

  addConnection: (taskId: string, fromId: string, toId: string) => void;
  deleteConnection: (taskId: string, connectionId: string) => void;

  updateViewport: (taskId: string, zoom: number, panX: number, panY: number) => void;
}

// Definiere den State-Typ separat fuer den Storage-Adapter
interface WhiteboardStoreState {
  whiteboards: Record<string, Whiteboard>;
}

// Erstelle den File-Storage-Adapter fuer Tauri
const fileStorage = createFileStorage<WhiteboardStoreState>(STORAGE_FILES.whiteboard);

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

const NODE_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
];

export const useWhiteboardStore = create<WhiteboardStore>()(
  persist(
    (set, get) => ({
      whiteboards: {},

      getWhiteboard: (taskId: string) => {
        return get().whiteboards[taskId] || null;
      },

      createWhiteboard: (taskId: string, taskTitle: string) => {
        const existing = get().whiteboards[taskId];
        // Only return existing if it has nodes
        if (existing && existing.nodes && existing.nodes.length > 0) return existing;

        const rootNode: WhiteboardNode = {
          id: generateId(),
          taskId,
          parentId: null,
          title: taskTitle,
          status: 'in_progress',
          color: NODE_COLORS[0],
          x: 0,
          y: 0,
          width: 220,
          height: 80,
          collapsed: false,
          notes: '',
        };

        const whiteboard: Whiteboard = {
          id: generateId(),
          taskId,
          nodes: [rootNode],
          connections: [],
          zoom: 1,
          panX: 0,
          panY: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        set((state) => ({
          whiteboards: {
            ...state.whiteboards,
            [taskId]: whiteboard,
          },
        }));

        return whiteboard;
      },

      addNode: (taskId: string, node: Omit<WhiteboardNode, 'id'>) => {
        const id = generateId();
        set((state) => {
          const whiteboard = state.whiteboards[taskId];
          if (!whiteboard) return state;

          const newNode: WhiteboardNode = { ...node, id };

          // Auto-create connection if parentId exists
          const newConnections = [...whiteboard.connections];
          if (node.parentId) {
            newConnections.push({
              id: generateId(),
              fromId: node.parentId,
              toId: id,
            });
          }

          return {
            whiteboards: {
              ...state.whiteboards,
              [taskId]: {
                ...whiteboard,
                nodes: [...whiteboard.nodes, newNode],
                connections: newConnections,
                updatedAt: Date.now(),
              },
            },
          };
        });
      },

      updateNode: (taskId: string, nodeId: string, updates: Partial<WhiteboardNode>) => {
        set((state) => {
          const whiteboard = state.whiteboards[taskId];
          if (!whiteboard) return state;

          return {
            whiteboards: {
              ...state.whiteboards,
              [taskId]: {
                ...whiteboard,
                nodes: whiteboard.nodes.map((n) =>
                  n.id === nodeId ? { ...n, ...updates } : n
                ),
                updatedAt: Date.now(),
              },
            },
          };
        });
      },

      deleteNode: (taskId: string, nodeId: string) => {
        set((state) => {
          const whiteboard = state.whiteboards[taskId];
          if (!whiteboard) return state;

          // Get all descendant node IDs
          const getDescendants = (id: string): string[] => {
            const children = whiteboard.nodes.filter((n) => n.parentId === id);
            return children.flatMap((c) => [c.id, ...getDescendants(c.id)]);
          };
          const toDelete = new Set([nodeId, ...getDescendants(nodeId)]);

          return {
            whiteboards: {
              ...state.whiteboards,
              [taskId]: {
                ...whiteboard,
                nodes: whiteboard.nodes.filter((n) => !toDelete.has(n.id)),
                connections: whiteboard.connections.filter(
                  (c) => !toDelete.has(c.fromId) && !toDelete.has(c.toId)
                ),
                updatedAt: Date.now(),
              },
            },
          };
        });
      },

      addConnection: (taskId: string, fromId: string, toId: string) => {
        set((state) => {
          const whiteboard = state.whiteboards[taskId];
          if (!whiteboard) return state;

          // Check if connection already exists
          const exists = whiteboard.connections.some(
            (c) => c.fromId === fromId && c.toId === toId
          );
          if (exists) return state;

          return {
            whiteboards: {
              ...state.whiteboards,
              [taskId]: {
                ...whiteboard,
                connections: [
                  ...whiteboard.connections,
                  { id: generateId(), fromId, toId },
                ],
                updatedAt: Date.now(),
              },
            },
          };
        });
      },

      deleteConnection: (taskId: string, connectionId: string) => {
        set((state) => {
          const whiteboard = state.whiteboards[taskId];
          if (!whiteboard) return state;

          return {
            whiteboards: {
              ...state.whiteboards,
              [taskId]: {
                ...whiteboard,
                connections: whiteboard.connections.filter((c) => c.id !== connectionId),
                updatedAt: Date.now(),
              },
            },
          };
        });
      },

      updateViewport: (taskId: string, zoom: number, panX: number, panY: number) => {
        set((state) => {
          const whiteboard = state.whiteboards[taskId];
          if (!whiteboard) return state;

          return {
            whiteboards: {
              ...state.whiteboards,
              [taskId]: {
                ...whiteboard,
                zoom,
                panX,
                panY,
              },
            },
          };
        });
      },

      clearAllWhiteboards: () => {
        set({ whiteboards: {} });
      },
    }),
    {
      name: 'whiteboard-storage',
      storage: createJSONStorage(() => storage),
    }
  )
);

