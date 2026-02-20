import { getCurrentWindow } from '@tauri-apps/api/window';

/**
 * Returns a mouseDown handler that starts window dragging via the Tauri API.
 * Skips dragging when clicking on interactive elements (buttons, inputs, textareas, selects, links).
 */
export function useWindowDrag() {
  const handleMouseDown = async (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, input, textarea, select, a, [role="button"]')) return;

    try {
      await getCurrentWindow().startDragging();
    } catch {
      // Ignore errors (e.g., when not running in Tauri)
    }
  };

  return handleMouseDown;
}
