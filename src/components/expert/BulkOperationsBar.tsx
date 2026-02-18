import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTaskStore } from '../../stores/taskStore';
import type { Task, TaskPriority } from '../../types';
import {
  X,
  CheckSquare,
  Square,
  Calendar,
  CalendarPlus,
  Flag,
  Trash2,
  Sparkles,
  Tag,
  Users,
  ChevronUp
} from 'lucide-react';

interface BulkOperationsBarProps {
  selectedTasks: string[];
  onClearSelection: () => void;
  onSelectAll: () => void;
  allTasksSelected: boolean;
  totalTasks: number;
}

interface DropdownMenuProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  children: React.ReactNode;
}

function DropdownMenu({ isOpen, onClose, anchorRef, children }: DropdownMenuProps) {
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isOpen && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top - 8,
        left: rect.left + rect.width / 2,
      });
    }
  }, [isOpen, anchorRef]);

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60]"
        onClick={onClose}
      />
      {/* Menu */}
      <div
        className="fixed z-[61] bg-white rounded-xl shadow-2xl border border-gray-200 py-1.5 min-w-[160px] animate-scale-in origin-bottom"
        style={{
          bottom: `calc(100vh - ${position.top}px)`,
          left: position.left,
          transform: 'translateX(-50%)',
        }}
      >
        {children}
      </div>
    </>,
    document.body
  );
}

export function BulkOperationsBar({
  selectedTasks,
  onClearSelection,
  onSelectAll,
  allTasksSelected,
  totalTasks
}: BulkOperationsBarProps) {
  const tasks = useTaskStore((s) => s.tasks);
  const updateTask = useTaskStore((s) => s.updateTask);
  const deleteTask = useTaskStore((s) => s.deleteTask);
  const clients = useTaskStore((s) => s.clients);
  const tags = useTaskStore((s) => s.tags);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const priorityRef = useRef<HTMLButtonElement>(null);
  const clientRef = useRef<HTMLButtonElement>(null);
  const tagRef = useRef<HTMLButtonElement>(null);
  const dateRef = useRef<HTMLButtonElement>(null);

  const selectedCount = selectedTasks.length;

  if (selectedCount === 0) return null;

  const handleBulkUpdate = (updates: Partial<Task>) => {
    selectedTasks.forEach(taskId => {
      updateTask(taskId, updates);
    });
    onClearSelection();
  };

  const handleBulkDelete = () => {
    if (confirm(`${selectedCount} Aufgaben wirklich löschen?`)) {
      selectedTasks.forEach(taskId => {
        deleteTask(taskId);
      });
      onClearSelection();
    }
  };

  const handleSetPriority = (priority: TaskPriority) => {
    handleBulkUpdate({ priority });
    setActiveMenu(null);
  };

  const handleSetClient = (clientId: string | undefined) => {
    handleBulkUpdate({ clientId });
    setActiveMenu(null);
  };

  const handleAddTag = (tagId: string) => {
    selectedTasks.forEach(taskId => {
      const task = tasks.find(t => t.id === taskId);
      if (task && !task.tagIds.includes(tagId)) {
        updateTask(taskId, { tagIds: [...task.tagIds, tagId] });
      }
    });
    setActiveMenu(null);
    onClearSelection();
  };

  const handleMoveToDate = (daysOffset: number) => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysOffset);
    const dateString = targetDate.toISOString().split('T')[0];
    handleBulkUpdate({ scheduledDate: dateString });
    setActiveMenu(null);
  };

  const handleMarkOptional = () => {
    const currentOptional = tasks
      .filter(t => selectedTasks.includes(t.id))
      .every(t => t.isOptional);
    handleBulkUpdate({ isOptional: !currentOptional });
  };

  const handleMarkComplete = () => {
    handleBulkUpdate({
      status: 'completed',
      completedAt: new Date().toISOString()
    });
  };

  const closeMenu = () => setActiveMenu(null);

  return createPortal(
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
      <div className="bg-gray-900/95 backdrop-blur-sm text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-2">
        {/* Selection Info */}
        <div className="flex items-center gap-2 pr-3 border-r border-white/10">
          <button
            onClick={allTasksSelected ? onClearSelection : onSelectAll}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-all"
            title={allTasksSelected ? 'Auswahl aufheben' : 'Alle auswählen'}
          >
            {allTasksSelected ? (
              <CheckSquare className="w-4 h-4 text-blue-400" />
            ) : (
              <Square className="w-4 h-4 text-white/60" />
            )}
          </button>
          <span className="text-sm font-medium tabular-nums">
            {selectedCount}<span className="text-white/40">/{totalTasks}</span>
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5">
          {/* Mark Complete */}
          <button
            onClick={handleMarkComplete}
            className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-white/10 rounded-lg transition-all text-sm"
            title="Als erledigt markieren"
          >
            <CheckSquare className="w-4 h-4 text-green-400" />
            <span className="hidden sm:inline text-white/90">Erledigt</span>
          </button>

          {/* Priority Menu */}
          <button
            ref={priorityRef}
            onClick={() => setActiveMenu(activeMenu === 'priority' ? null : 'priority')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all text-sm ${
              activeMenu === 'priority' ? 'bg-white/20' : 'hover:bg-white/10'
            }`}
            title="Priorität setzen"
          >
            <Flag className="w-4 h-4 text-orange-400" />
            <span className="hidden sm:inline text-white/90">Priorität</span>
            <ChevronUp className={`w-3 h-3 text-white/40 transition-transform ${activeMenu === 'priority' ? '' : 'rotate-180'}`} />
          </button>

          <DropdownMenu isOpen={activeMenu === 'priority'} onClose={closeMenu} anchorRef={priorityRef}>
            {[
              { value: 'urgent', label: 'Dringend', color: 'bg-red-500' },
              { value: 'high', label: 'Hoch', color: 'bg-orange-500' },
              { value: 'medium', label: 'Normal', color: 'bg-blue-500' },
              { value: 'low', label: 'Niedrig', color: 'bg-gray-400' },
            ].map(p => (
              <button
                key={p.value}
                onClick={() => handleSetPriority(p.value as TaskPriority)}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
              >
                <span className={`w-2.5 h-2.5 rounded-full ${p.color}`} />
                {p.label}
              </button>
            ))}
          </DropdownMenu>

          {/* Client Menu */}
          {clients.length > 0 && (
            <>
              <button
                ref={clientRef}
                onClick={() => setActiveMenu(activeMenu === 'client' ? null : 'client')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all text-sm ${
                  activeMenu === 'client' ? 'bg-white/20' : 'hover:bg-white/10'
                }`}
                title="Kunde zuweisen"
              >
                <Users className="w-4 h-4 text-purple-400" />
                <span className="hidden sm:inline text-white/90">Kunde</span>
                <ChevronUp className={`w-3 h-3 text-white/40 transition-transform ${activeMenu === 'client' ? '' : 'rotate-180'}`} />
              </button>

              <DropdownMenu isOpen={activeMenu === 'client'} onClose={closeMenu} anchorRef={clientRef}>
                <button
                  onClick={() => handleSetClient(undefined)}
                  className="w-full px-3 py-2 text-left text-sm text-gray-400 hover:bg-gray-50 transition-colors"
                >
                  Kein Kunde
                </button>
                <div className="h-px bg-gray-100 my-1" />
                {clients.map(c => (
                  <button
                    key={c.id}
                    onClick={() => handleSetClient(c.id)}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                    {c.name}
                  </button>
                ))}
              </DropdownMenu>
            </>
          )}

          {/* Tag Menu */}
          {tags.length > 0 && (
            <>
              <button
                ref={tagRef}
                onClick={() => setActiveMenu(activeMenu === 'tag' ? null : 'tag')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all text-sm ${
                  activeMenu === 'tag' ? 'bg-white/20' : 'hover:bg-white/10'
                }`}
                title="Tag hinzufügen"
              >
                <Tag className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline text-white/90">Tag</span>
                <ChevronUp className={`w-3 h-3 text-white/40 transition-transform ${activeMenu === 'tag' ? '' : 'rotate-180'}`} />
              </button>

              <DropdownMenu isOpen={activeMenu === 'tag'} onClose={closeMenu} anchorRef={tagRef}>
                {tags.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleAddTag(t.id)}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: t.color }}
                    />
                    {t.name}
                  </button>
                ))}
              </DropdownMenu>
            </>
          )}

          {/* Date Menu */}
          <button
            ref={dateRef}
            onClick={() => setActiveMenu(activeMenu === 'date' ? null : 'date')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all text-sm ${
              activeMenu === 'date' ? 'bg-white/20' : 'hover:bg-white/10'
            }`}
            title="Verschieben"
          >
            <Calendar className="w-4 h-4 text-blue-400" />
            <span className="hidden sm:inline text-white/90">Datum</span>
            <ChevronUp className={`w-3 h-3 text-white/40 transition-transform ${activeMenu === 'date' ? '' : 'rotate-180'}`} />
          </button>

          <DropdownMenu isOpen={activeMenu === 'date'} onClose={closeMenu} anchorRef={dateRef}>
            <button
              onClick={() => handleMoveToDate(0)}
              className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
            >
              <Calendar className="w-4 h-4 text-blue-500" />
              Heute
            </button>
            <button
              onClick={() => handleMoveToDate(1)}
              className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
            >
              <CalendarPlus className="w-4 h-4 text-purple-500" />
              Morgen
            </button>
            <button
              onClick={() => handleMoveToDate(7)}
              className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
            >
              <CalendarPlus className="w-4 h-4 text-gray-500" />
              In 1 Woche
            </button>
          </DropdownMenu>

          {/* Optional Toggle */}
          <button
            onClick={handleMarkOptional}
            className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-white/10 rounded-lg transition-all text-sm"
            title="Als optional markieren"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline text-white/90">Optional</span>
          </button>

          {/* Separator */}
          <div className="w-px h-5 bg-white/10 mx-1" />

          {/* Delete */}
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-red-500/20 rounded-lg transition-all text-sm text-red-400"
            title="Löschen"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Close Button */}
        <div className="pl-2 border-l border-white/10">
          <button
            onClick={onClearSelection}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-all"
            title="Auswahl aufheben"
          >
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
