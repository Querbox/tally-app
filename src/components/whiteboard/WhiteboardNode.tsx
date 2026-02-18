import { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Check,
  Clock,
  Circle,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Palette,
} from 'lucide-react';
import type { WhiteboardNode as NodeType } from '../../stores/whiteboardStore';

interface WhiteboardNodeProps {
  node: NodeType;
  isRoot: boolean;
  hasChildren: boolean;
  onUpdate: (updates: Partial<NodeType>) => void;
  onDelete: () => void;
  onAddChild: () => void;
  onDragStart: (e: React.MouseEvent) => void;
}

const STATUS_CONFIG = {
  pending: {
    icon: Circle,
    label: 'Ausstehend',
    bgClass: 'bg-gray-100',
    textClass: 'text-gray-600',
  },
  in_progress: {
    icon: Clock,
    label: 'In Bearbeitung',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-600',
  },
  completed: {
    icon: Check,
    label: 'Abgeschlossen',
    bgClass: 'bg-green-100',
    textClass: 'text-green-600',
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

export default function WhiteboardNode({
  node,
  isRoot,
  hasChildren,
  onUpdate,
  onDelete,
  onAddChild,
  onDragStart,
}: WhiteboardNodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(node.title);
  const [showNotes, setShowNotes] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleTitleSubmit = () => {
    if (editTitle.trim()) {
      onUpdate({ title: editTitle.trim() });
    } else {
      setEditTitle(node.title);
    }
    setIsEditing(false);
  };

  const StatusIcon = STATUS_CONFIG[node.status].icon;
  const statusConfig = STATUS_CONFIG[node.status];

  return (
    <div
      ref={nodeRef}
      className="absolute select-none"
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        zIndex: isEditing || showColorPicker || showStatusMenu ? 100 : 1,
      }}
    >
      {/* Main Card */}
      <div
        className={`relative bg-white rounded-xl shadow-lg border-2 transition-all duration-200 hover:shadow-xl ${
          node.status === 'completed' ? 'opacity-75' : ''
        }`}
        style={{ borderColor: node.color }}
      >
        {/* Color Bar */}
        <div
          className="h-2 rounded-t-lg"
          style={{ backgroundColor: node.color }}
        />

        {/* Header with drag handle */}
        <div className="flex items-center gap-1 px-3 pt-2 pb-1">
          <button
            onMouseDown={onDragStart}
            className="p-1 -ml-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="w-4 h-4" />
          </button>

          {/* Collapse toggle */}
          {hasChildren && (
            <button
              onClick={() => onUpdate({ collapsed: !node.collapsed })}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              {node.collapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          )}

          {/* Status Button */}
          <div className="relative">
            <button
              onClick={() => setShowStatusMenu(!showStatusMenu)}
              className={`p-1.5 rounded-lg transition-colors ${statusConfig.bgClass}`}
              title={statusConfig.label}
            >
              <StatusIcon className={`w-4 h-4 ${statusConfig.textClass}`} />
            </button>

            {showStatusMenu && (
              <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 min-w-[140px]">
                {Object.entries(STATUS_CONFIG).map(([status, config]) => {
                  const Icon = config.icon;
                  return (
                    <button
                      key={status}
                      onClick={() => {
                        onUpdate({ status: status as NodeType['status'] });
                        setShowStatusMenu(false);
                      }}
                      className={`w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-50 ${
                        node.status === status ? 'bg-gray-50' : ''
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${config.textClass}`} />
                      <span className="text-sm text-gray-700">{config.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex-1" />

          {/* Action Buttons */}
          <div className="flex items-center gap-0.5">
            {/* Color Picker */}
            <div className="relative">
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Farbe ändern"
              >
                <Palette className="w-4 h-4" />
              </button>

              {showColorPicker && (
                <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 p-2 z-50">
                  <div className="grid grid-cols-4 gap-1">
                    {NODE_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => {
                          onUpdate({ color });
                          setShowColorPicker(false);
                        }}
                        className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${
                          node.color === color ? 'ring-2 ring-offset-2 ring-gray-400' : ''
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Notes Toggle */}
            <button
              onClick={() => setShowNotes(!showNotes)}
              className={`p-1.5 rounded-lg transition-colors ${
                showNotes || node.notes
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
              title="Notizen"
            >
              <MessageSquare className="w-4 h-4" />
            </button>

            {/* Add Child */}
            <button
              onClick={onAddChild}
              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title="Unterseite hinzufügen"
            >
              <Plus className="w-4 h-4" />
            </button>

            {/* Delete (not for root) */}
            {!isRoot && (
              <button
                onClick={onDelete}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Löschen"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Title */}
        <div className="px-3 pb-3">
          {isEditing ? (
            <input
              ref={inputRef}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTitleSubmit();
                if (e.key === 'Escape') {
                  setEditTitle(node.title);
                  setIsEditing(false);
                }
              }}
              className="w-full px-2 py-1 text-sm font-medium border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <h3
              onClick={() => setIsEditing(true)}
              className={`text-sm font-medium cursor-text hover:bg-gray-50 rounded px-1 py-0.5 -mx-1 ${
                node.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-900'
              }`}
            >
              {node.title}
            </h3>
          )}
        </div>

        {/* Notes Section */}
        {showNotes && (
          <div className="px-3 pb-3 border-t border-gray-100 pt-2">
            <textarea
              value={node.notes}
              onChange={(e) => onUpdate({ notes: e.target.value })}
              placeholder="Notizen hinzufügen..."
              className="w-full text-xs text-gray-600 bg-gray-50 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[60px]"
            />
          </div>
        )}

        {/* Progress indicator for parent nodes */}
        {hasChildren && !node.collapsed && (
          <div className="px-3 pb-2">
            <div className="text-xs text-gray-500 flex items-center gap-1">
              <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all duration-300"
                  style={{ width: '0%' }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Collapsed indicator */}
      {node.collapsed && hasChildren && (
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full">
          ...
        </div>
      )}
    </div>
  );
}
