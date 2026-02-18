import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Plus, Check, Clock, Circle, Trash2,
  ZoomIn, ZoomOut, Maximize2, GripVertical,
  MessageSquare, ChevronDown, Copy, Palette,
  Layout, Map, Undo2, Redo2, Search, Download,
  MousePointer2, Hand, StickyNote, Link2,
  Grid3X3, MoreHorizontal, Network, LayoutGrid,
  ChevronRight, ImageDown
} from 'lucide-react';
import { useTaskStore } from '../../stores/taskStore';
import { generateId } from '../../utils/idUtils';
import type { Subtask } from '../../types';

// ============ TYPES ============
interface WhiteboardNode {
  id: string;
  subtaskId?: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed';
  notes: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  parentId: string | null;
}

interface WhiteboardData {
  nodes: WhiteboardNode[];
  zoom: number;
  panX: number;
  panY: number;
}

interface WhiteboardProps {
  taskId: string;
  taskTitle: string;
  onClose: () => void;
}

interface HistoryState {
  past: WhiteboardData[];
  present: WhiteboardData;
  future: WhiteboardData[];
}

interface ContextMenuState {
  show: boolean;
  x: number;
  y: number;
  nodeId: string | null;
}

type ToolType = 'select' | 'pan' | 'add';
type ViewMode = 'canvas' | 'sitemap';

// ============ CONSTANTS ============
const STORAGE_KEY = 'tally-whiteboards-v4';
const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
  '#6366F1', '#14B8A6', '#84CC16', '#F43F5E',
];
const MIN_NODE_WIDTH = 150;
const MIN_NODE_HEIGHT = 60;
const MAX_HISTORY = 50;

const STATUS_CONFIG = {
  pending: { icon: Circle, label: 'Ausstehend', bg: '#f3f4f6', text: '#6b7280' },
  in_progress: { icon: Clock, label: 'In Bearbeitung', bg: '#dbeafe', text: '#2563eb' },
  completed: { icon: Check, label: 'Erledigt', bg: '#dcfce7', text: '#16a34a' },
};

// ============ HELPERS ============
function subtaskToNode(subtask: Subtask, parentNodeId: string, index: number, existingNode?: WhiteboardNode): WhiteboardNode {
  return {
    id: existingNode?.id || generateId(),
    subtaskId: subtask.id,
    title: subtask.title,
    status: subtask.isCompleted ? 'completed' : 'pending',
    notes: existingNode?.notes || '',
    x: existingNode?.x ?? 400 + ((index % 3) - 1) * 250,
    y: existingNode?.y ?? 220 + Math.floor(index / 3) * 120,
    width: existingNode?.width ?? 200,
    height: existingNode?.height ?? 80,
    color: existingNode?.color ?? COLORS[(index + 1) % COLORS.length],
    parentId: parentNodeId,
  };
}

function loadWhiteboard(taskId: string, taskTitle: string, subtasks: Subtask[]): WhiteboardData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const allData = JSON.parse(stored);
      if (allData[taskId]) {
        const existingData = allData[taskId] as WhiteboardData;

        // Wenn gespeicherte Daten existieren, verwende sie direkt
        // und aktualisiere nur fehlende Subtasks
        let rootNode = existingData.nodes.find(n => n.parentId === null);
        if (!rootNode) {
          rootNode = {
            id: generateId(),
            title: taskTitle,
            status: 'in_progress',
            notes: '',
            x: 400,
            y: 80,
            width: 240,
            height: 100,
            color: COLORS[0],
            parentId: null,
          };
        }

        // Behalte alle existierenden Nodes
        const existingNodes = [...existingData.nodes];

        // Prüfe ob neue Subtasks hinzugefügt wurden (die noch nicht im Whiteboard sind)
        const newSubtaskNodes: WhiteboardNode[] = [];
        subtasks.forEach((subtask, index) => {
          const existsInWhiteboard = existingNodes.some(n => n.subtaskId === subtask.id);
          if (!existsInWhiteboard) {
            // Neue Subtask wurde in der Task-Ansicht hinzugefügt
            newSubtaskNodes.push(subtaskToNode(subtask, rootNode!.id, existingNodes.length + index));
          }
        });

        // Falls kein rootNode in existingNodes, füge ihn hinzu
        if (!existingNodes.some(n => n.parentId === null)) {
          existingNodes.unshift(rootNode);
        }

        return {
          ...existingData,
          nodes: [...existingNodes, ...newSubtaskNodes],
        };
      }
    }
  } catch (e) {
    console.error('Error loading whiteboard:', e);
  }

  // Keine gespeicherten Daten - erstelle neues Whiteboard
  const rootId = generateId();
  const rootNode: WhiteboardNode = {
    id: rootId,
    title: taskTitle,
    status: 'in_progress',
    notes: '',
    x: 400,
    y: 80,
    width: 240,
    height: 100,
    color: COLORS[0],
    parentId: null,
  };

  const subtaskNodes = subtasks.map((subtask, index) =>
    subtaskToNode(subtask, rootId, index)
  );

  return {
    nodes: [rootNode, ...subtaskNodes],
    zoom: 1,
    panX: 0,
    panY: 0,
  };
}

function saveWhiteboard(taskId: string, data: WhiteboardData) {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const allData = stored ? JSON.parse(stored) : {};
    allData[taskId] = data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allData));
  } catch (e) {
    console.error('Error saving whiteboard:', e);
  }
}

// ============ COLOR PICKER ============
function ColorPicker({
  currentColor,
  onSelect,
  onClose,
}: {
  currentColor: string;
  onSelect: (color: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleClick = () => onClose();
    setTimeout(() => document.addEventListener('click', handleClick), 0);
    return () => document.removeEventListener('click', handleClick);
  }, [onClose]);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        marginTop: '4px',
        backgroundColor: 'white',
        borderRadius: '10px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
        border: '1px solid #e5e7eb',
        padding: '8px',
        zIndex: 99999,
        width: '140px',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
        {COLORS.map((color) => (
          <button
            key={color}
            onClick={() => { onSelect(color); onClose(); }}
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '6px',
              backgroundColor: color,
              border: currentColor === color ? '3px solid #111' : '2px solid transparent',
              cursor: 'pointer',
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ============ CONTEXT MENU ============
function ContextMenu({
  x,
  y,
  isRoot,
  onClose,
  onAddChild,
  onDuplicate,
  onDelete,
  onChangeColor,
  onChangeStatus,
  onStartReconnect,
}: {
  x: number;
  y: number;
  isRoot: boolean;
  onClose: () => void;
  onAddChild: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onChangeColor: () => void;
  onChangeStatus: (status: 'pending' | 'in_progress' | 'completed') => void;
  onStartReconnect: () => void;
}) {
  useEffect(() => {
    const handleClick = () => onClose();
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    setTimeout(() => {
      document.addEventListener('click', handleClick);
      document.addEventListener('keydown', handleEscape);
    }, 0);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const menuItems = [
    { icon: Plus, label: 'Unterkarte hinzufügen', action: onAddChild, show: true },
    { icon: Copy, label: 'Duplizieren', action: onDuplicate, show: !isRoot },
    { icon: Link2, label: 'Neu verbinden...', action: onStartReconnect, show: !isRoot },
    { icon: Palette, label: 'Farbe ändern', action: onChangeColor, show: true },
    { divider: true, show: true },
    { icon: Circle, label: 'Ausstehend', action: () => onChangeStatus('pending'), show: true, color: '#6b7280' },
    { icon: Clock, label: 'In Bearbeitung', action: () => onChangeStatus('in_progress'), show: true, color: '#2563eb' },
    { icon: Check, label: 'Erledigt', action: () => onChangeStatus('completed'), show: true, color: '#16a34a' },
    { divider: true, show: !isRoot },
    { icon: Trash2, label: 'Löschen', action: onDelete, show: !isRoot, danger: true },
  ];

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
        border: '1px solid #e5e7eb',
        padding: '6px',
        zIndex: 999999,
        minWidth: '180px',
      }}
    >
      {menuItems.filter(item => item.show).map((item, index) => {
        if ('divider' in item && item.divider) {
          return <div key={index} style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '4px 0' }} />;
        }
        const Icon = item.icon!;
        return (
          <button
            key={index}
            onClick={(e) => { e.stopPropagation(); item.action!(); onClose(); }}
            style={{
              width: '100%',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              border: 'none',
              backgroundColor: 'transparent',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              color: 'danger' in item && item.danger ? '#ef4444' : ('color' in item ? item.color : '#374151'),
              textAlign: 'left',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Icon style={{ width: '16px', height: '16px' }} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ============ TOOLKIT BAR ============
function ToolkitBar({
  activeTool,
  onToolChange,
  onAutoLayout,
  onFitToScreen,
  showGrid,
  onToggleGrid,
  viewMode,
  onViewModeChange,
}: {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  onAutoLayout: () => void;
  onFitToScreen: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}) {
  const tools: { id: ToolType; icon: typeof MousePointer2; label: string }[] = [
    { id: 'select', icon: MousePointer2, label: 'Auswählen (V)' },
    { id: 'pan', icon: Hand, label: 'Verschieben (H)' },
    { id: 'add', icon: StickyNote, label: 'Karte hinzufügen (N)' },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        left: '16px',
        top: '50%',
        transform: 'translateY(-50%)',
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        border: '1px solid #e5e7eb',
        padding: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        zIndex: 50,
      }}
    >
      {/* View Mode Toggle */}
      <button
        onClick={() => onViewModeChange(viewMode === 'canvas' ? 'sitemap' : 'canvas')}
        title={viewMode === 'canvas' ? 'Sitemap-Ansicht' : 'Canvas-Ansicht'}
        style={{
          width: '40px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          backgroundColor: '#f0fdf4',
          color: '#16a34a',
        }}
      >
        {viewMode === 'canvas' ? <Network style={{ width: '20px', height: '20px' }} /> : <LayoutGrid style={{ width: '20px', height: '20px' }} />}
      </button>

      <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '4px 0' }} />

      {tools.map((tool) => {
        const Icon = tool.icon;
        const isActive = activeTool === tool.id;
        return (
          <button
            key={tool.id}
            onClick={() => onToolChange(tool.id)}
            title={tool.label}
            style={{
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              backgroundColor: isActive ? '#3b82f6' : 'transparent',
              color: isActive ? 'white' : '#4b5563',
            }}
          >
            <Icon style={{ width: '20px', height: '20px' }} />
          </button>
        );
      })}

      <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '4px 0' }} />

      <button onClick={onAutoLayout} title="Auto-Layout" style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: '8px', cursor: 'pointer', backgroundColor: 'transparent', color: '#4b5563' }}>
        <Layout style={{ width: '20px', height: '20px' }} />
      </button>
      <button onClick={onFitToScreen} title="Anpassen" style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: '8px', cursor: 'pointer', backgroundColor: 'transparent', color: '#4b5563' }}>
        <Maximize2 style={{ width: '20px', height: '20px' }} />
      </button>
      <button onClick={onToggleGrid} title={showGrid ? 'Raster aus' : 'Raster an'} style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: '8px', cursor: 'pointer', backgroundColor: showGrid ? '#eff6ff' : 'transparent', color: showGrid ? '#3b82f6' : '#4b5563' }}>
        <Grid3X3 style={{ width: '20px', height: '20px' }} />
      </button>
    </div>
  );
}

// ============ SITEMAP VIEW ============
function SitemapView({
  nodes,
  onUpdateNode,
  onAddChild,
  onDeleteNode,
  onAttachTo,
}: {
  nodes: WhiteboardNode[];
  onUpdateNode: (nodeId: string, updates: Partial<WhiteboardNode>) => void;
  onAddChild: (parentId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onAttachTo: (nodeId: string, newParentId: string) => void;
}) {
  const [attachingNode, setAttachingNode] = useState<string | null>(null);

  // Alle Root-Nodes finden (Nodes ohne Parent)
  const rootNodes = nodes.filter(n => n.parentId === null);
  if (rootNodes.length === 0) return null;

  // Finde den ursprünglichen Root (erster Node) und andere entkoppelte Nodes
  const mainRoot = rootNodes[0];
  const detachedRoots = rootNodes.slice(1);

  const renderNode = (node: WhiteboardNode, level: number = 0, isMainTree: boolean = true): JSX.Element => {
    const children = nodes.filter(n => n.parentId === node.id);
    const StatusIcon = STATUS_CONFIG[node.status].icon;
    const statusConfig = STATUS_CONFIG[node.status];
    const isAttaching = attachingNode !== null;
    const canAttachHere = isAttaching && attachingNode !== node.id && !isDescendant(attachingNode, node.id);

    // Hilfsfunktion: Prüft ob nodeId ein Nachkomme von potentialParentId ist
    function isDescendant(nodeId: string, potentialParentId: string): boolean {
      const childNodes = nodes.filter(n => n.parentId === potentialParentId);
      for (const child of childNodes) {
        if (child.id === nodeId || isDescendant(nodeId, child.id)) return true;
      }
      return false;
    }

    return (
      <div key={node.id} style={{ marginLeft: level * 24 }}>
        <div
          onClick={() => {
            if (canAttachHere && attachingNode) {
              onAttachTo(attachingNode, node.id);
              setAttachingNode(null);
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 16px',
            backgroundColor: canAttachHere ? '#dcfce7' : 'white',
            borderRadius: '10px',
            border: `2px solid ${canAttachHere ? '#22c55e' : node.color}`,
            marginBottom: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            cursor: canAttachHere ? 'pointer' : 'default',
            transition: 'all 0.2s ease',
          }}
        >
          {children.length > 0 && (
            <ChevronRight style={{ width: '16px', height: '16px', color: '#9ca3af' }} />
          )}
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: node.color,
              flexShrink: 0,
            }}
          />
          {node.subtaskId && (
            <Link2 style={{ width: '14px', height: '14px', color: '#3b82f6' }} />
          )}
          <span
            style={{
              flex: 1,
              fontWeight: level === 0 ? 600 : 500,
              fontSize: level === 0 ? '15px' : '14px',
              color: node.status === 'completed' ? '#9ca3af' : '#111827',
              textDecoration: node.status === 'completed' ? 'line-through' : 'none',
            }}
          >
            {node.title}
          </span>
          {!isAttaching && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const newStatus = node.status === 'completed' ? 'pending' : node.status === 'pending' ? 'in_progress' : 'completed';
                  onUpdateNode(node.id, { status: newStatus });
                }}
                style={{
                  padding: '4px 8px',
                  backgroundColor: statusConfig.bg,
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  color: statusConfig.text,
                }}
              >
                <StatusIcon style={{ width: '12px', height: '12px' }} />
                {statusConfig.label}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onAddChild(node.id); }}
                style={{
                  padding: '4px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  color: '#22c55e',
                  display: 'flex',
                }}
                title="Unterkarte hinzufügen"
              >
                <Plus style={{ width: '16px', height: '16px' }} />
              </button>
              {/* Verbinden-Button für entkoppelte Nodes */}
              {!isMainTree && level === 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setAttachingNode(node.id); }}
                  style={{
                    padding: '4px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    color: '#8b5cf6',
                    display: 'flex',
                  }}
                  title="Mit anderem Node verbinden"
                >
                  <Link2 style={{ width: '16px', height: '16px' }} />
                </button>
              )}
              {(level > 0 || !isMainTree) && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteNode(node.id); }}
                  style={{
                    padding: '4px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    color: '#ef4444',
                    display: 'flex',
                  }}
                  title="Löschen"
                >
                  <Trash2 style={{ width: '16px', height: '16px' }} />
                </button>
              )}
            </>
          )}
        </div>
        {children.length > 0 && (
          <div style={{ borderLeft: `2px solid ${node.color}20`, marginLeft: '12px', paddingLeft: '12px' }}>
            {children.map(child => renderNode(child, level + 1, isMainTree))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: '24px', overflowY: 'auto', height: '100%' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Hinweis wenn im Verbindungsmodus */}
        {attachingNode && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: '#fef3c7',
            borderRadius: '10px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '13px', color: '#92400e' }}>
              Klicke auf einen Node, um "{nodes.find(n => n.id === attachingNode)?.title}" als Unterseite hinzuzufügen
            </span>
            <button
              onClick={() => setAttachingNode(null)}
              style={{
                padding: '4px 8px',
                backgroundColor: 'white',
                border: '1px solid #d97706',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                color: '#92400e',
              }}
            >
              Abbrechen
            </button>
          </div>
        )}

        {/* Hauptbaum */}
        {renderNode(mainRoot, 0, true)}

        {/* Entkoppelte Zweige */}
        {detachedRoots.length > 0 && (
          <>
            <div style={{
              marginTop: '24px',
              marginBottom: '16px',
              padding: '8px 12px',
              backgroundColor: '#f3f4f6',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 500,
              color: '#6b7280',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <Network style={{ width: '14px', height: '14px' }} />
              Entkoppelte Zweige ({detachedRoots.length})
            </div>
            {detachedRoots.map(root => renderNode(root, 0, false))}
          </>
        )}
      </div>
    </div>
  );
}

// ============ MINIMAP ============
function Minimap({
  nodes,
  zoom,
  panX,
  panY,
  canvasWidth,
  canvasHeight,
  onNavigate,
}: {
  nodes: WhiteboardNode[];
  zoom: number;
  panX: number;
  panY: number;
  canvasWidth: number;
  canvasHeight: number;
  onNavigate: (x: number, y: number) => void;
}) {
  const minimapRef = useRef<HTMLDivElement>(null);
  const MINIMAP_WIDTH = 160;
  const MINIMAP_HEIGHT = 100;

  const bounds = useMemo(() => {
    if (nodes.length === 0) return { minX: 0, minY: 0, maxX: 1000, maxY: 800 };
    const padding = 100;
    return {
      minX: Math.min(...nodes.map(n => n.x)) - padding,
      minY: Math.min(...nodes.map(n => n.y)) - padding,
      maxX: Math.max(...nodes.map(n => n.x + n.width)) + padding,
      maxY: Math.max(...nodes.map(n => n.y + n.height)) + padding,
    };
  }, [nodes]);

  const contentWidth = bounds.maxX - bounds.minX;
  const contentHeight = bounds.maxY - bounds.minY;
  const scale = Math.min(MINIMAP_WIDTH / contentWidth, MINIMAP_HEIGHT / contentHeight);

  const viewportX = (-panX / zoom - bounds.minX) * scale;
  const viewportY = (-panY / zoom - bounds.minY) * scale;
  const viewportW = (canvasWidth / zoom) * scale;
  const viewportH = (canvasHeight / zoom) * scale;

  const handleClick = (e: React.MouseEvent) => {
    if (!minimapRef.current) return;
    const rect = minimapRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    onNavigate(bounds.minX + clickX / scale, bounds.minY + clickY / scale);
  };

  return (
    <div
      ref={minimapRef}
      onClick={handleClick}
      style={{
        position: 'absolute',
        bottom: '16px',
        right: '16px',
        width: MINIMAP_WIDTH,
        height: MINIMAP_HEIGHT,
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderRadius: '10px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        border: '1px solid #e5e7eb',
        overflow: 'hidden',
        cursor: 'pointer',
        zIndex: 50,
      }}
    >
      {nodes.map((node) => (
        <div
          key={node.id}
          style={{
            position: 'absolute',
            left: (node.x - bounds.minX) * scale,
            top: (node.y - bounds.minY) * scale,
            width: Math.max(4, node.width * scale),
            height: Math.max(3, node.height * scale),
            backgroundColor: node.color,
            borderRadius: '2px',
            opacity: node.status === 'completed' ? 0.5 : 0.8,
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          left: Math.max(0, viewportX),
          top: Math.max(0, viewportY),
          width: Math.min(viewportW, MINIMAP_WIDTH - viewportX),
          height: Math.min(viewportH, MINIMAP_HEIGHT - viewportY),
          border: '2px solid #3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderRadius: '2px',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

// ============ CANVAS NODE ============
function CanvasNode({
  node,
  isHighlighted,
  isReconnectTarget,
  onUpdate,
  onDragStart,
  onResizeStart,
  onAddChild,
  onContextMenu,
  onClick,
}: {
  node: WhiteboardNode;
  isHighlighted: boolean;
  isReconnectTarget?: boolean;
  onUpdate: (updates: Partial<WhiteboardNode>) => void;
  onDragStart: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent) => void;
  onAddChild: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onClick?: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(node.title);
  const [showNotes, setShowNotes] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (showStatusMenu) {
      const handleClick = () => setShowStatusMenu(false);
      setTimeout(() => document.addEventListener('click', handleClick), 0);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [showStatusMenu]);

  const handleTitleSave = () => {
    if (editTitle.trim()) {
      onUpdate({ title: editTitle.trim() });
    } else {
      setEditTitle(node.title);
    }
    setIsEditing(false);
  };

  const handleAddChildClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onAddChild();
  };

  const StatusIcon = STATUS_CONFIG[node.status].icon;
  const statusConfig = STATUS_CONFIG[node.status];

  return (
    <div
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
        width: node.width,
        minHeight: node.height,
      }}
      onContextMenu={onContextMenu}
      onClick={onClick}
    >
      <div
        style={{
          backgroundColor: isReconnectTarget ? '#dcfce7' : 'white',
          borderRadius: '12px',
          boxShadow: isHighlighted
            ? '0 0 0 4px rgba(59, 130, 246, 0.5), 0 4px 12px rgba(0,0,0,0.15)'
            : isReconnectTarget
            ? '0 0 0 3px rgba(34, 197, 94, 0.5), 0 4px 12px rgba(0,0,0,0.15)'
            : '0 4px 12px rgba(0,0,0,0.15)',
          border: `3px solid ${isReconnectTarget ? '#22c55e' : node.color}`,
          overflow: (showStatusMenu || showColorPicker) ? 'visible' : 'hidden',
          opacity: node.status === 'completed' ? 0.7 : 1,
          position: 'relative',
          minHeight: node.height,
          cursor: isReconnectTarget ? 'pointer' : 'default',
          transition: 'all 0.2s ease',
        }}
      >
        {/* Color bar */}
        <div onMouseDown={onDragStart} style={{ height: '6px', backgroundColor: node.color, cursor: 'grab' }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 10px 4px' }}>
          <div onMouseDown={onDragStart} style={{ cursor: 'grab', padding: '4px', color: '#9ca3af', display: 'flex' }}>
            <GripVertical style={{ width: '14px', height: '14px' }} />
          </div>

          {node.subtaskId && (
            <div title="Verknüpft mit Unteraufgabe" style={{ padding: '4px', color: '#3b82f6', display: 'flex' }}>
              <Link2 style={{ width: '12px', height: '12px' }} />
            </div>
          )}

          {/* Status */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowStatusMenu(!showStatusMenu); setShowColorPicker(false); }}
              style={{
                padding: '4px 6px',
                backgroundColor: statusConfig.bg,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <StatusIcon style={{ width: '12px', height: '12px', color: statusConfig.text }} />
              <ChevronDown style={{ width: '10px', height: '10px', color: statusConfig.text }} />
            </button>

            {showStatusMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '4px',
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                  border: '1px solid #e5e7eb',
                  padding: '4px',
                  zIndex: 99999,
                  minWidth: '140px',
                }}
              >
                {Object.entries(STATUS_CONFIG).map(([status, config]) => {
                  const Icon = config.icon;
                  return (
                    <button
                      key={status}
                      onClick={(e) => { e.stopPropagation(); onUpdate({ status: status as WhiteboardNode['status'] }); setShowStatusMenu(false); }}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        border: 'none',
                        backgroundColor: node.status === status ? '#f3f4f6' : 'transparent',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        color: '#374151',
                      }}
                    >
                      <Icon style={{ width: '14px', height: '14px', color: config.text }} />
                      <span>{config.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Color */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowColorPicker(!showColorPicker); setShowStatusMenu(false); }}
              style={{ padding: '4px', backgroundColor: 'transparent', border: 'none', borderRadius: '4px', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}
              title="Farbe ändern"
            >
              <Palette style={{ width: '14px', height: '14px' }} />
            </button>
            {showColorPicker && (
              <ColorPicker currentColor={node.color} onSelect={(color) => onUpdate({ color })} onClose={() => setShowColorPicker(false)} />
            )}
          </div>

          <div style={{ flex: 1 }} />

          <button
            onClick={() => setShowNotes(!showNotes)}
            style={{
              padding: '4px',
              backgroundColor: showNotes || node.notes ? '#eff6ff' : 'transparent',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              color: showNotes || node.notes ? '#2563eb' : '#9ca3af',
              display: 'flex',
            }}
            title="Notizen"
          >
            <MessageSquare style={{ width: '14px', height: '14px' }} />
          </button>

          <button
            onClick={handleAddChildClick}
            style={{ padding: '4px', backgroundColor: 'transparent', border: 'none', borderRadius: '4px', cursor: 'pointer', color: '#22c55e', display: 'flex' }}
            title="Unterkarte hinzufügen"
          >
            <Plus style={{ width: '14px', height: '14px' }} />
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); onContextMenu(e); }}
            style={{ padding: '4px', backgroundColor: 'transparent', border: 'none', borderRadius: '4px', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}
            title="Mehr Optionen"
          >
            <MoreHorizontal style={{ width: '14px', height: '14px' }} />
          </button>
        </div>

        {/* Title */}
        <div style={{ padding: '4px 12px 10px' }}>
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTitleSave();
                if (e.key === 'Escape') { setEditTitle(node.title); setIsEditing(false); }
              }}
              style={{ width: '100%', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '14px', fontWeight: 500, outline: 'none' }}
            />
          ) : (
            <div
              onClick={() => setIsEditing(true)}
              style={{
                fontSize: '14px',
                fontWeight: 500,
                color: node.status === 'completed' ? '#9ca3af' : '#111827',
                textDecoration: node.status === 'completed' ? 'line-through' : 'none',
                cursor: 'text',
                padding: '4px 0',
              }}
            >
              {node.title}
            </div>
          )}
        </div>

        {/* Notes */}
        {showNotes && (
          <div style={{ padding: '0 12px 10px' }}>
            <textarea
              value={node.notes}
              onChange={(e) => onUpdate({ notes: e.target.value })}
              placeholder="Notizen..."
              style={{ width: '100%', padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '12px', resize: 'none', minHeight: '60px', outline: 'none', backgroundColor: '#fafafa' }}
            />
          </div>
        )}

        {/* Resize */}
        <div
          onMouseDown={onResizeStart}
          style={{ position: 'absolute', right: 0, bottom: 0, width: '16px', height: '16px', cursor: 'se-resize', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" style={{ opacity: 0.3 }}>
            <path d="M9 1L1 9M9 5L5 9M9 9L9 9" stroke="#666" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
      </div>
    </div>
  );
}

// ============ MAIN ============
export default function Whiteboard({ taskId, taskTitle, onClose }: WhiteboardProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const tasks = useTaskStore((s) => s.tasks);
  const updateTask = useTaskStore((s) => s.updateTask);
  const task = tasks.find(t => t.id === taskId);
  const subtasks = task?.subtasks || [];

  const [history, setHistory] = useState<HistoryState>(() => {
    const initialData = loadWhiteboard(taskId, taskTitle, subtasks);
    return { past: [], present: initialData, future: [] };
  });

  const data = history.present;

  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizingNode, setResizingNode] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [showMinimap, setShowMinimap] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [showGrid, setShowGrid] = useState(true);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ show: false, x: 0, y: 0, nodeId: null });
  const [viewMode, setViewMode] = useState<ViewMode>('canvas');
  const [reconnectingNode, setReconnectingNode] = useState<string | null>(null);

  const setData = useCallback((updater: (prev: WhiteboardData) => WhiteboardData, skipHistory = false) => {
    setHistory(prev => {
      const newPresent = updater(prev.present);
      if (skipHistory) return { ...prev, present: newPresent };
      return { past: [...prev.past.slice(-MAX_HISTORY), prev.present], present: newPresent, future: [] };
    });
  }, []);

  // Sync to subtasks - debounced
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      if (!task) return;

      const nodesWithParent = data.nodes.filter(n => n.parentId !== null);
      const newSubtasks: Subtask[] = nodesWithParent.map((n, index) => ({
        id: n.subtaskId || n.id,
        title: n.title,
        isCompleted: n.status === 'completed',
        order: index,
      }));

      // Link nodes to subtasks
      const unlinkedNodes = nodesWithParent.filter(n => !n.subtaskId);
      if (unlinkedNodes.length > 0) {
        setData(prev => ({
          ...prev,
          nodes: prev.nodes.map(n => {
            if (!n.subtaskId && n.parentId !== null) {
              return { ...n, subtaskId: n.id };
            }
            return n;
          }),
        }), true);
      }

      if (JSON.stringify(newSubtasks) !== JSON.stringify(task.subtasks)) {
        updateTask(taskId, { subtasks: newSubtasks });
      }
    }, 300);

    return () => { if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current); };
  }, [data.nodes, task, taskId, updateTask, setData]);

  // Save whiteboard
  useEffect(() => {
    saveWhiteboard(taskId, data);
  }, [taskId, data]);

  const undo = useCallback(() => {
    setHistory(prev => {
      if (prev.past.length === 0) return prev;
      return { past: prev.past.slice(0, -1), present: prev.past[prev.past.length - 1], future: [prev.present, ...prev.future] };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory(prev => {
      if (prev.future.length === 0) return prev;
      return { past: [...prev.past, prev.present], present: prev.future[0], future: prev.future.slice(1) };
    });
  }, []);

  useEffect(() => {
    if (canvasRef.current) {
      const updateSize = () => {
        if (canvasRef.current) setCanvasSize({ width: canvasRef.current.clientWidth, height: canvasRef.current.clientHeight });
      };
      updateSize();
      window.addEventListener('resize', updateSize);
      return () => window.removeEventListener('resize', updateSize);
    }
  }, []);

  useEffect(() => {
    if (highlightedNodeId) {
      const timer = setTimeout(() => setHighlightedNodeId(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [highlightedNodeId]);

  const stats = useMemo(() => ({
    total: data.nodes.length,
    completed: data.nodes.filter(n => n.status === 'completed').length,
    inProgress: data.nodes.filter(n => n.status === 'in_progress').length,
    pending: data.nodes.filter(n => n.status === 'pending').length,
  }), [data.nodes]);

  const completionPercent = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  const handleZoom = useCallback((delta: number) => {
    setData(prev => ({ ...prev, zoom: Math.max(0.3, Math.min(2, prev.zoom + delta)) }), true);
  }, [setData]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); handleZoom(e.deltaY > 0 ? -0.1 : 0.1); }
  }, [handleZoom]);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (contextMenu.show) { setContextMenu({ show: false, x: 0, y: 0, nodeId: null }); return; }

    const target = e.target as HTMLElement;
    const isOnNode = target.closest('[data-node]');

    if (activeTool === 'add' && !isOnNode && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - data.panX) / data.zoom;
      const y = (e.clientY - rect.top - data.panY) / data.zoom;
      const rootNode = data.nodes.find(n => n.parentId === null);
      if (rootNode) {
        const newNode: WhiteboardNode = {
          id: generateId(),
          title: 'Neue Karte',
          status: 'pending',
          notes: '',
          x: x - 100,
          y: y - 40,
          width: 200,
          height: 80,
          color: COLORS[data.nodes.length % COLORS.length],
          parentId: rootNode.id,
        };
        setData(prev => ({ ...prev, nodes: [...prev.nodes, newNode] }));
      }
      return;
    }

    if (!isOnNode && (activeTool === 'pan' || activeTool === 'select')) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - data.panX, y: e.clientY - data.panY });
    }
  }, [activeTool, contextMenu.show, data.panX, data.panY, data.zoom, data.nodes, setData]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setData(prev => ({ ...prev, panX: e.clientX - panStart.x, panY: e.clientY - panStart.y }), true);
    } else if (draggedNode && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - data.panX) / data.zoom - dragOffset.x;
      const y = (e.clientY - rect.top - data.panY) / data.zoom - dragOffset.y;
      setData(prev => ({ ...prev, nodes: prev.nodes.map(n => n.id === draggedNode ? { ...n, x: Math.max(0, x), y: Math.max(0, y) } : n) }), true);
    } else if (resizingNode) {
      const deltaX = (e.clientX - resizeStart.x) / data.zoom;
      const deltaY = (e.clientY - resizeStart.y) / data.zoom;
      setData(prev => ({
        ...prev,
        nodes: prev.nodes.map(n => n.id === resizingNode ? { ...n, width: Math.max(MIN_NODE_WIDTH, resizeStart.width + deltaX), height: Math.max(MIN_NODE_HEIGHT, resizeStart.height + deltaY) } : n),
      }), true);
    }
  }, [isPanning, panStart, draggedNode, dragOffset, resizingNode, resizeStart, data.panX, data.panY, data.zoom, setData]);

  const handleMouseUp = useCallback(() => {
    if (draggedNode || resizingNode) {
      setHistory(prev => ({ past: [...prev.past.slice(-MAX_HISTORY), prev.present], present: prev.present, future: [] }));
    }
    setIsPanning(false);
    setDraggedNode(null);
    setResizingNode(null);
  }, [draggedNode, resizingNode]);

  const handleNodeDragStart = useCallback((nodeId: string, e: React.MouseEvent) => {
    if (activeTool === 'pan') return;
    e.stopPropagation();
    e.preventDefault();
    const node = data.nodes.find(n => n.id === nodeId);
    if (node && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setDragOffset({ x: (e.clientX - rect.left - data.panX) / data.zoom - node.x, y: (e.clientY - rect.top - data.panY) / data.zoom - node.y });
      setDraggedNode(nodeId);
    }
  }, [activeTool, data.nodes, data.panX, data.panY, data.zoom]);

  const handleResizeStart = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const node = data.nodes.find(n => n.id === nodeId);
    if (node) {
      setResizeStart({ x: e.clientX, y: e.clientY, width: node.width, height: node.height });
      setResizingNode(nodeId);
    }
  }, [data.nodes]);

  const handleContextMenu = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ show: true, x: e.clientX, y: e.clientY, nodeId });
  }, []);

  const handleAddChild = useCallback((parentId: string) => {
    const parent = data.nodes.find(n => n.id === parentId);
    if (!parent) return;
    const siblings = data.nodes.filter(n => n.parentId === parentId);
    const newNode: WhiteboardNode = {
      id: generateId(),
      title: 'Neue Karte',
      status: 'pending',
      notes: '',
      x: parent.x + (siblings.length % 2 === 0 ? -130 : 130),
      y: parent.y + parent.height + 60,
      width: 200,
      height: 80,
      color: COLORS[data.nodes.length % COLORS.length],
      parentId,
    };
    setData(prev => ({ ...prev, nodes: [...prev.nodes, newNode] }));
  }, [data.nodes, setData]);

  const handleDuplicate = useCallback((nodeId: string) => {
    const node = data.nodes.find(n => n.id === nodeId);
    if (!node) return;
    const newNode: WhiteboardNode = { ...node, id: generateId(), subtaskId: undefined, x: node.x + 30, y: node.y + 30, title: node.title + ' (Kopie)' };
    setData(prev => ({ ...prev, nodes: [...prev.nodes, newNode] }));
  }, [data.nodes, setData]);

  const handleUpdateNode = useCallback((nodeId: string, updates: Partial<WhiteboardNode>) => {
    setData(prev => ({ ...prev, nodes: prev.nodes.map(n => n.id === nodeId ? { ...n, ...updates } : n) }));
  }, [setData]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    const getDescendants = (id: string): string[] => {
      const children = data.nodes.filter(n => n.parentId === id);
      return children.flatMap(c => [c.id, ...getDescendants(c.id)]);
    };
    const toDelete = new Set([nodeId, ...getDescendants(nodeId)]);
    setData(prev => ({ ...prev, nodes: prev.nodes.filter(n => !toDelete.has(n.id)) }));
  }, [data.nodes, setData]);

  const handleDetachNode = useCallback((nodeId: string) => {
    // Entkoppeln: Node wird ein eigenständiger Zweig (parentId bleibt aber erhalten für die Verbindung)
    // Wir setzen parentId auf null, damit der Node eigenständig wird
    const node = data.nodes.find(n => n.id === nodeId);
    if (!node || node.parentId === null) return;

    // Verschiebe den Node etwas, damit er nicht überlappt
    setData(prev => ({
      ...prev,
      nodes: prev.nodes.map(n =>
        n.id === nodeId
          ? { ...n, parentId: null, x: n.x + 100, y: n.y - 50 }
          : n
      )
    }));
  }, [data.nodes, setData]);

  const handleAttachTo = useCallback((nodeId: string, newParentId: string) => {
    // Verbinde einen Node mit einem neuen Parent
    const node = data.nodes.find(n => n.id === nodeId);
    const newParent = data.nodes.find(n => n.id === newParentId);
    if (!node || !newParent) return;

    // Positioniere den Node unter dem neuen Parent
    const siblings = data.nodes.filter(n => n.parentId === newParentId);
    setData(prev => ({
      ...prev,
      nodes: prev.nodes.map(n =>
        n.id === nodeId
          ? {
              ...n,
              parentId: newParentId,
              x: newParent.x + (siblings.length % 2 === 0 ? -130 : 130),
              y: newParent.y + newParent.height + 60,
            }
          : n
      )
    }));
  }, [data.nodes, setData]);

  const fitToScreen = useCallback(() => {
    if (!canvasRef.current || data.nodes.length === 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const padding = 100;
    const minX = Math.min(...data.nodes.map(n => n.x));
    const maxX = Math.max(...data.nodes.map(n => n.x + n.width));
    const minY = Math.min(...data.nodes.map(n => n.y));
    const maxY = Math.max(...data.nodes.map(n => n.y + n.height));
    const contentWidth = maxX - minX + padding * 2;
    const contentHeight = maxY - minY + padding * 2;
    const newZoom = Math.min(rect.width / contentWidth, rect.height / contentHeight, 1);
    setData(prev => ({ ...prev, zoom: newZoom, panX: rect.width / 2 - ((minX + maxX) / 2) * newZoom, panY: rect.height / 2 - ((minY + maxY) / 2) * newZoom }), true);
  }, [data.nodes, setData]);

  const autoLayout = useCallback(() => {
    const root = data.nodes.find(n => n.parentId === null);
    if (!root) return;
    const HORIZONTAL_GAP = 50;
    const VERTICAL_GAP = 80;
    const getChildren = (parentId: string) => data.nodes.filter(n => n.parentId === parentId);
    const calculateSubtreeWidth = (nodeId: string): number => {
      const children = getChildren(nodeId);
      if (children.length === 0) return data.nodes.find(n => n.id === nodeId)?.width || 200;
      return Math.max(data.nodes.find(n => n.id === nodeId)?.width || 200, children.reduce((sum, c) => sum + calculateSubtreeWidth(c.id), 0) + (children.length - 1) * HORIZONTAL_GAP);
    };
    const positionNode = (nodeId: string, x: number, y: number): WhiteboardNode[] => {
      const node = data.nodes.find(n => n.id === nodeId);
      if (!node) return [];
      const result: WhiteboardNode[] = [{ ...node, x, y }];
      const children = getChildren(nodeId);
      if (children.length > 0) {
        const subtreeWidth = calculateSubtreeWidth(nodeId);
        let childX = x + node.width / 2 - subtreeWidth / 2;
        children.forEach(child => {
          const childWidth = calculateSubtreeWidth(child.id);
          result.push(...positionNode(child.id, childX + childWidth / 2 - child.width / 2, y + node.height + VERTICAL_GAP));
          childX += childWidth + HORIZONTAL_GAP;
        });
      }
      return result;
    };
    const positioned = positionNode(root.id, 400, 100);
    const byId: Record<string, WhiteboardNode> = {};
    positioned.forEach(n => { byId[n.id] = n; });
    setData(prev => ({ ...prev, nodes: prev.nodes.map(n => byId[n.id] || n) }));
  }, [data.nodes, setData]);

  const handleMinimapNavigate = useCallback((targetX: number, targetY: number) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setData(prev => ({ ...prev, panX: rect.width / 2 - targetX * prev.zoom, panY: rect.height / 2 - targetY * prev.zoom }), true);
  }, [setData]);

  const handleSelectNode = useCallback((node: WhiteboardNode) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setData(prev => ({ ...prev, panX: rect.width / 2 - (node.x + node.width / 2) * prev.zoom, panY: rect.height / 2 - (node.y + node.height / 2) * prev.zoom }), true);
    setHighlightedNodeId(node.id);
    setShowSearch(false);
    setSearchQuery('');
  }, [setData]);

  const exportData = useCallback(() => {
    const blob = new Blob([JSON.stringify({ title: taskTitle, exportedAt: new Date().toISOString(), nodes: data.nodes }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `whiteboard-${taskTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`;
    a.click();
  }, [data.nodes, taskTitle]);

  // Export Whiteboard als PNG Bild
  const [isExporting, setIsExporting] = useState(false);
  const exportAsImage = useCallback(async () => {
    if (data.nodes.length === 0) return;
    setIsExporting(true);

    try {
      // Berechne Bounds aller Nodes
      const padding = 40;
      const minX = Math.min(...data.nodes.map(n => n.x)) - padding;
      const minY = Math.min(...data.nodes.map(n => n.y)) - padding;
      const maxX = Math.max(...data.nodes.map(n => n.x + n.width)) + padding;
      const maxY = Math.max(...data.nodes.map(n => n.y + n.height)) + padding;
      const width = maxX - minX;
      const height = maxY - minY;

      // Erstelle Canvas
      const canvas = document.createElement('canvas');
      const scale = 2; // Retina-Qualität
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      // Skaliere für Retina
      ctx.scale(scale, scale);

      // Hintergrund
      ctx.fillStyle = '#f9fafb';
      ctx.fillRect(0, 0, width, height);

      // Zeichne Raster
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 0.5;
      const gridSize = 24;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.arc(x, 0, 1, 0, Math.PI * 2);
        for (let y = 0; y < height; y += gridSize) {
          ctx.moveTo(x + 1, y);
          ctx.arc(x, y, 1, 0, Math.PI * 2);
        }
        ctx.fillStyle = '#d1d5db';
        ctx.fill();
      }

      // Zeichne Verbindungen (Bezier-Kurven)
      data.nodes.filter(n => n.parentId).forEach(node => {
        const parent = data.nodes.find(n => n.id === node.parentId);
        if (!parent) return;

        const fromX = parent.x + parent.width / 2 - minX;
        const fromY = parent.y + parent.height - minY;
        const toX = node.x + node.width / 2 - minX;
        const toY = node.y - minY;
        const midY = (fromY + toY) / 2;

        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.bezierCurveTo(fromX, midY, toX, midY, toX, toY);
        ctx.strokeStyle = parent.color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
      });

      // Zeichne Nodes
      for (const node of data.nodes) {
        const x = node.x - minX;
        const y = node.y - minY;

        // Schatten
        ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 4;

        // Card Background
        ctx.fillStyle = node.status === 'completed' ? 'rgba(255, 255, 255, 0.7)' : 'white';
        ctx.beginPath();
        ctx.roundRect(x, y, node.width, node.height, 12);
        ctx.fill();

        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        // Border
        ctx.strokeStyle = node.color;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Color bar
        ctx.fillStyle = node.color;
        ctx.beginPath();
        ctx.roundRect(x, y, node.width, 6, [12, 12, 0, 0]);
        ctx.fill();

        // Status icon
        const statusConfig = STATUS_CONFIG[node.status];
        ctx.fillStyle = statusConfig.bg;
        ctx.beginPath();
        ctx.roundRect(x + 10, y + 14, 24, 18, 4);
        ctx.fill();

        // Status dot
        ctx.fillStyle = statusConfig.text;
        ctx.beginPath();
        ctx.arc(x + 22, y + 23, 4, 0, Math.PI * 2);
        ctx.fill();

        // Title
        ctx.fillStyle = node.status === 'completed' ? '#9ca3af' : '#111827';
        ctx.font = '500 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        const titleMaxWidth = node.width - 24;
        let title = node.title;
        while (ctx.measureText(title).width > titleMaxWidth && title.length > 3) {
          title = title.slice(0, -4) + '...';
        }
        ctx.fillText(title, x + 12, y + 50);

        // Strikethrough wenn completed
        if (node.status === 'completed') {
          const titleWidth = Math.min(ctx.measureText(node.title).width, titleMaxWidth);
          ctx.strokeStyle = '#9ca3af';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x + 12, y + 46);
          ctx.lineTo(x + 12 + titleWidth, y + 46);
          ctx.stroke();
        }

        // Notes indicator
        if (node.notes) {
          ctx.fillStyle = '#2563eb';
          ctx.beginPath();
          ctx.arc(x + node.width - 16, y + 23, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Titel und Datum hinzufügen
      ctx.fillStyle = 'white';
      ctx.fillRect(0, height - 40, width, 40);
      ctx.fillStyle = '#6b7280';
      ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`${taskTitle} • Exportiert am ${new Date().toLocaleDateString('de-DE')} • ${data.nodes.length} Karten`, 16, height - 16);

      // Download
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `whiteboard-${taskTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.png`;
      a.click();
    } catch (error) {
      console.error('Error exporting image:', error);
      alert('Fehler beim Exportieren des Bildes');
    } finally {
      setIsExporting(false);
    }
  }, [data.nodes, taskTitle]);

  // State für gehoverter Verbindung
  const [hoveredConnection, setHoveredConnection] = useState<string | null>(null);

  const renderConnections = () => {
    return data.nodes.filter(n => n.parentId).map(node => {
      const parent = data.nodes.find(n => n.id === node.parentId);
      if (!parent) return null;
      const fromX = parent.x + parent.width / 2;
      const fromY = parent.y + parent.height;
      const toX = node.x + node.width / 2;
      const toY = node.y;
      const midY = (fromY + toY) / 2;

      // Mittelpunkt der Kurve für das Scissors-Symbol
      const centerX = (fromX + toX) / 2;
      const centerY = midY;

      const isHovered = hoveredConnection === node.id;
      const buttonSize = 28 / data.zoom;

      return (
        <g key={`conn-${node.id}`}>
          {/* Unsichtbarer breiterer Pfad für besseres Hovern */}
          <path
            d={`M ${fromX} ${fromY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`}
            fill="none"
            stroke="transparent"
            strokeWidth={20 / data.zoom}
            style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
            onMouseEnter={() => setHoveredConnection(node.id)}
            onMouseLeave={() => setHoveredConnection(null)}
          />
          {/* Sichtbarer Pfad */}
          <path
            d={`M ${fromX} ${fromY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`}
            fill="none"
            stroke={isHovered ? '#ef4444' : parent.color}
            strokeWidth={(isHovered ? 3 : 2) / data.zoom}
            strokeOpacity={isHovered ? 0.9 : 0.5}
            style={{
              transition: 'stroke 0.2s ease, stroke-width 0.2s ease',
              pointerEvents: 'none',
            }}
          />
          {/* Scissors Button in der Mitte */}
          {isHovered && (
            <g
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                handleDetachNode(node.id);
                setHoveredConnection(null);
              }}
              onMouseEnter={() => setHoveredConnection(node.id)}
            >
              <circle
                cx={centerX}
                cy={centerY}
                r={buttonSize / 2}
                fill="white"
                stroke="#ef4444"
                strokeWidth={2 / data.zoom}
                style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
              />
              <g transform={`translate(${centerX - buttonSize/3}, ${centerY - buttonSize/3}) scale(${(buttonSize * 0.65) / 24})`}>
                <path
                  d="M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            </g>
          )}
        </g>
      );
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape') {
        if (contextMenu.show) setContextMenu({ show: false, x: 0, y: 0, nodeId: null });
        else if (showSearch) { setShowSearch(false); setSearchQuery(''); }
        else onClose();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); setShowSearch(true); }
      if (e.key === 'v' || e.key === 'V') setActiveTool('select');
      if (e.key === 'h' || e.key === 'H') setActiveTool('pan');
      if (e.key === 'n' || e.key === 'N') setActiveTool('add');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, showSearch, contextMenu.show, undo, redo]);

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  const filteredNodes = data.nodes.filter(n => n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.notes.toLowerCase().includes(searchQuery.toLowerCase()));

  const content = (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2147483647 }} onClick={onClose}>
      <div style={{ width: '95vw', height: '90vh', backgroundColor: '#f9fafb', borderRadius: '16px', boxShadow: '0 25px 50px rgba(0, 0, 0, 0.4)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#111827' }}>{taskTitle}</h2>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b7280' }}>
                {viewMode === 'canvas' ? 'Canvas' : 'Sitemap'} • {data.nodes.filter(n => n.subtaskId).length} Unteraufgaben
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '4px 10px', backgroundColor: '#f3f4f6', borderRadius: '6px' }}>
              <span style={{ color: '#6b7280' }}>⚪ {stats.pending}</span>
              <span style={{ color: '#2563eb' }}>🔵 {stats.inProgress}</span>
              <span style={{ color: '#16a34a' }}>✅ {stats.completed}</span>
              <div style={{ width: '1px', height: '12px', backgroundColor: '#d1d5db', margin: '0 4px' }} />
              <span style={{ fontWeight: 500, color: '#374151' }}>{completionPercent}%</span>
            </div>
            <div style={{ width: '1px', height: '24px', backgroundColor: '#e5e7eb' }} />
            <button onClick={undo} disabled={!canUndo} style={{ padding: '6px', background: 'none', border: 'none', cursor: canUndo ? 'pointer' : 'not-allowed', color: canUndo ? '#4b5563' : '#d1d5db', display: 'flex', borderRadius: '6px' }} title="Rückgängig"><Undo2 style={{ width: '18px', height: '18px' }} /></button>
            <button onClick={redo} disabled={!canRedo} style={{ padding: '6px', background: 'none', border: 'none', cursor: canRedo ? 'pointer' : 'not-allowed', color: canRedo ? '#4b5563' : '#d1d5db', display: 'flex', borderRadius: '6px' }} title="Wiederholen"><Redo2 style={{ width: '18px', height: '18px' }} /></button>
            <div style={{ width: '1px', height: '24px', backgroundColor: '#e5e7eb' }} />
            <button onClick={() => setShowSearch(!showSearch)} style={{ padding: '6px', background: showSearch ? '#eff6ff' : 'none', border: 'none', cursor: 'pointer', color: showSearch ? '#2563eb' : '#4b5563', display: 'flex', borderRadius: '6px' }} title="Suchen"><Search style={{ width: '18px', height: '18px' }} /></button>
            <button onClick={() => setShowMinimap(!showMinimap)} style={{ padding: '6px', background: showMinimap ? '#eff6ff' : 'none', border: 'none', cursor: 'pointer', color: showMinimap ? '#2563eb' : '#4b5563', display: 'flex', borderRadius: '6px' }} title="Minimap"><Map style={{ width: '18px', height: '18px' }} /></button>
            <button onClick={exportData} style={{ padding: '6px', background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563', display: 'flex', borderRadius: '6px' }} title="Als JSON exportieren"><Download style={{ width: '18px', height: '18px' }} /></button>
            <button onClick={exportAsImage} disabled={isExporting} style={{ padding: '6px', background: isExporting ? '#eff6ff' : 'none', border: 'none', cursor: isExporting ? 'wait' : 'pointer', color: isExporting ? '#2563eb' : '#4b5563', display: 'flex', borderRadius: '6px' }} title="Als Bild speichern (PNG)"><ImageDown style={{ width: '18px', height: '18px' }} /></button>
            <div style={{ width: '1px', height: '24px', backgroundColor: '#e5e7eb' }} />
            {/* View Mode Toggle - immer sichtbar */}
            <button
              onClick={() => setViewMode(viewMode === 'canvas' ? 'sitemap' : 'canvas')}
              style={{
                padding: '6px 10px',
                background: '#f0fdf4',
                border: 'none',
                cursor: 'pointer',
                color: '#16a34a',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
              }}
              title={viewMode === 'canvas' ? 'Zur Sitemap-Ansicht' : 'Zur Canvas-Ansicht'}
            >
              {viewMode === 'canvas' ? <Network style={{ width: '16px', height: '16px' }} /> : <LayoutGrid style={{ width: '16px', height: '16px' }} />}
              {viewMode === 'canvas' ? 'Sitemap' : 'Canvas'}
            </button>
            {viewMode === 'canvas' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#f3f4f6', borderRadius: '8px', padding: '4px' }}>
                <button onClick={() => handleZoom(-0.1)} style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563', display: 'flex' }}><ZoomOut style={{ width: '16px', height: '16px' }} /></button>
                <span style={{ width: '40px', textAlign: 'center', fontSize: '12px', color: '#4b5563' }}>{Math.round(data.zoom * 100)}%</span>
                <button onClick={() => handleZoom(0.1)} style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563', display: 'flex' }}><ZoomIn style={{ width: '16px', height: '16px' }} /></button>
              </div>
            )}
            <button onClick={onClose} style={{ padding: '6px', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', display: 'flex', marginLeft: '8px' }}><X style={{ width: '20px', height: '20px' }} /></button>
          </div>
        </div>

        {/* Content */}
        {viewMode === 'sitemap' ? (
          <SitemapView nodes={data.nodes} onUpdateNode={handleUpdateNode} onAddChild={handleAddChild} onDeleteNode={handleDeleteNode} onAttachTo={handleAttachTo} />
        ) : (
          <div
            ref={canvasRef}
            style={{
              flex: 1,
              position: 'relative',
              overflow: 'hidden',
              cursor: activeTool === 'pan' ? (isPanning ? 'grabbing' : 'grab') : activeTool === 'add' ? 'crosshair' : 'default',
              backgroundImage: showGrid ? 'radial-gradient(circle, #d1d5db 1px, transparent 1px)' : 'none',
              backgroundSize: `${24 * data.zoom}px ${24 * data.zoom}px`,
              backgroundPosition: `${data.panX}px ${data.panY}px`,
              backgroundColor: showGrid ? '#f9fafb' : '#ffffff',
            }}
            onWheel={handleWheel}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <ToolkitBar activeTool={activeTool} onToolChange={setActiveTool} onAutoLayout={autoLayout} onFitToScreen={fitToScreen} showGrid={showGrid} onToggleGrid={() => setShowGrid(!showGrid)} viewMode={viewMode} onViewModeChange={setViewMode} />

            {showSearch && (
              <div style={{ position: 'absolute', top: '16px', left: '80px', width: '300px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', border: '1px solid #e5e7eb', overflow: 'hidden', zIndex: 100 }}>
                <div style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Search style={{ width: '16px', height: '16px', color: '#9ca3af' }} />
                    <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Karten suchen..." style={{ flex: 1, border: 'none', outline: 'none', fontSize: '14px' }} autoFocus />
                    <button onClick={() => { setShowSearch(false); setSearchQuery(''); }} style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X style={{ width: '16px', height: '16px' }} /></button>
                  </div>
                </div>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {filteredNodes.length === 0 ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>Keine Karten gefunden</div>
                  ) : filteredNodes.map((node) => (
                    <button key={node.id} onClick={() => handleSelectNode(node)} style={{ width: '100%', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: node.color, flexShrink: 0 }} />
                      <div style={{ flex: 1, fontSize: '13px', fontWeight: 500, color: '#111827' }}>{node.title}</div>
                      <div style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: STATUS_CONFIG[node.status].bg, fontSize: '10px', color: STATUS_CONFIG[node.status].text }}>{STATUS_CONFIG[node.status].label}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ position: 'absolute', left: 0, top: 0, transform: `translate(${data.panX}px, ${data.panY}px) scale(${data.zoom})`, transformOrigin: '0 0', width: '10000px', height: '10000px' }}>
              {/* SVG Container für alle Verbindungen */}
              <svg style={{ position: 'absolute', top: 0, left: 0, width: '10000px', height: '10000px', overflow: 'visible', pointerEvents: 'none' }}>
                <g style={{ pointerEvents: 'auto' }}>
                  {renderConnections()}
                </g>
              </svg>
              {data.nodes.map(node => {
                // Prüfe ob dieser Node ein gültiges Ziel für Reconnect ist
                const isValidReconnectTarget = reconnectingNode !== null &&
                  node.id !== reconnectingNode &&
                  !isDescendantOf(reconnectingNode, node.id);

                // Hilfsfunktion: Prüft ob nodeId ein Nachkomme von parentId ist
                function isDescendantOf(nodeId: string, potentialParentId: string): boolean {
                  const children = data.nodes.filter(n => n.parentId === potentialParentId);
                  for (const child of children) {
                    if (child.id === nodeId || isDescendantOf(nodeId, child.id)) return true;
                  }
                  return false;
                }

                return (
                  <div key={node.id} data-node="true">
                    <CanvasNode
                      node={node}
                      isHighlighted={node.id === highlightedNodeId}
                      isReconnectTarget={isValidReconnectTarget}
                      onUpdate={(updates) => handleUpdateNode(node.id, updates)}
                      onDragStart={(e) => reconnectingNode ? undefined : handleNodeDragStart(node.id, e)}
                      onResizeStart={(e) => handleResizeStart(node.id, e)}
                      onAddChild={() => handleAddChild(node.id)}
                      onContextMenu={(e) => handleContextMenu(node.id, e)}
                      onClick={isValidReconnectTarget ? () => {
                        handleAttachTo(reconnectingNode!, node.id);
                        setReconnectingNode(null);
                      } : undefined}
                    />
                  </div>
                );
              })}
            </div>

            {contextMenu.show && contextMenu.nodeId && (
              <ContextMenu
                x={contextMenu.x}
                y={contextMenu.y}
                isRoot={data.nodes.find(n => n.id === contextMenu.nodeId)?.parentId === null}
                onClose={() => setContextMenu({ show: false, x: 0, y: 0, nodeId: null })}
                onAddChild={() => handleAddChild(contextMenu.nodeId!)}
                onDuplicate={() => handleDuplicate(contextMenu.nodeId!)}
                onDelete={() => handleDeleteNode(contextMenu.nodeId!)}
                onStartReconnect={() => {
                  setReconnectingNode(contextMenu.nodeId);
                  setContextMenu({ show: false, x: 0, y: 0, nodeId: null });
                }}
                onChangeColor={() => {
                  const node = data.nodes.find(n => n.id === contextMenu.nodeId);
                  if (node) handleUpdateNode(contextMenu.nodeId!, { color: COLORS[(COLORS.indexOf(node.color) + 1) % COLORS.length] });
                }}
                onChangeStatus={(status) => handleUpdateNode(contextMenu.nodeId!, { status })}
              />
            )}

            {showMinimap && canvasSize.width > 0 && (
              <Minimap nodes={data.nodes} zoom={data.zoom} panX={data.panX} panY={data.panY} canvasWidth={canvasSize.width} canvasHeight={canvasSize.height} onNavigate={handleMinimapNavigate} />
            )}

            {/* Reconnect-Modus Overlay */}
            {reconnectingNode && (
              <div style={{
                position: 'absolute',
                top: '16px',
                left: '50%',
                transform: 'translateX(-50%)',
                padding: '12px 20px',
                backgroundColor: '#fef3c7',
                borderRadius: '10px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                zIndex: 100,
              }}>
                <span style={{ fontSize: '13px', color: '#92400e' }}>
                  Klicke auf eine Karte, um "{data.nodes.find(n => n.id === reconnectingNode)?.title}" damit zu verbinden
                </span>
                <button
                  onClick={() => setReconnectingNode(null)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: 'white',
                    border: '1px solid #d97706',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: '#92400e',
                  }}
                >
                  Abbrechen
                </button>
              </div>
            )}

            <div style={{ position: 'absolute', bottom: '16px', left: '80px', fontSize: '11px', color: '#9ca3af', zIndex: 10, backgroundColor: 'rgba(255,255,255,0.9)', padding: '6px 10px', borderRadius: '6px' }}>
              V Auswählen • H Verschieben • N Hinzufügen • Rechtsklick für Optionen
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
