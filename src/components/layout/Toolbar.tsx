import { Search } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';

interface ToolbarProps {
  onOpenSearch: () => void;
}

export function Toolbar({ onOpenSearch }: ToolbarProps) {
  const handleMouseDown = async (e: React.MouseEvent) => {
    // Only start dragging on left mouse button and not on interactive elements
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;

    try {
      await getCurrentWindow().startDragging();
    } catch {
      // Ignore errors (e.g., when not running in Tauri)
    }
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      className="h-11 flex items-center justify-center px-4 bg-[#38383a] border-b border-[#2a2a2c] select-none"
    >
      {/* Left spacer for traffic lights */}
      <div className="w-20 flex-shrink-0" />

      {/* Search trigger button */}
      <button
        onClick={onOpenSearch}
        className="flex-1 max-w-sm flex items-center gap-2 px-3 py-1.5 bg-[#252527] text-[#98989d] text-sm rounded-md border border-[#4a4a4c] hover:border-[#5a5a5c] hover:bg-[#2a2a2c] transition-colors"
      >
        <Search className="w-3.5 h-3.5 text-[#98989d]" />
        <span>Suchen</span>
        <span className="ml-auto text-xs text-[#6e6e73]">⌘E</span>
      </button>

      {/* Right spacer */}
      <div className="w-20 flex-shrink-0" />
    </div>
  );
}
