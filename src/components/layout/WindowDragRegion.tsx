import { useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

const DRAG_HEIGHT = 44; // Toolbar height in px
const TRAFFIC_LIGHTS_WIDTH = 80; // macOS traffic lights area
const DRAG_THRESHOLD = 4; // Minimum px movement before starting a drag

const INTERACTIVE_SELECTOR = 'button, input, textarea, select, a, [role="button"], [data-no-drag]';

/**
 * Global window drag handler that enables dragging from the toolbar area,
 * even when overlays/modals are open.
 *
 * - Intercepts mousedown in the top 44px (capture phase)
 * - Waits for mouse movement beyond a threshold before starting native drag
 * - After a drag, suppresses the next click so overlays don't close on drop
 * - If the user just clicks (no drag), simulates a click on the original target
 *   so that "click outside to close" on overlays still works
 */
export function WindowDragRegion() {
  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let isDragCandidate = false;
    let dragTarget: HTMLElement | null = null;
    let didDrag = false;

    const handleMouseDown = (e: MouseEvent) => {
      // Only left mouse button
      if (e.button !== 0) return;

      // Only in the toolbar region (top 44px), right of traffic lights
      if (e.clientY > DRAG_HEIGHT || e.clientX < TRAFFIC_LIGHTS_WIDTH) return;

      // Don't intercept clicks on interactive elements
      const target = e.target as HTMLElement;
      if (target.closest(INTERACTIVE_SELECTOR)) return;

      startX = e.clientX;
      startY = e.clientY;
      isDragCandidate = true;
      didDrag = false;
      dragTarget = target;

      // Stop event so overlay backdrop onClick/onMouseDown don't fire
      e.preventDefault();
      e.stopPropagation();
    };

    const handleMouseMove = async (e: MouseEvent) => {
      if (!isDragCandidate) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (Math.abs(dx) >= DRAG_THRESHOLD || Math.abs(dy) >= DRAG_THRESHOLD) {
        isDragCandidate = false;
        didDrag = true;
        try {
          await getCurrentWindow().startDragging();
        } catch {
          // Ignore errors
        }
      }
    };

    const handleMouseUp = () => {
      if (isDragCandidate && !didDrag && dragTarget) {
        // Simple click (no drag) — simulate click so "click outside" closes overlay
        dragTarget.click();
      }

      if (didDrag) {
        // After a real drag, suppress the next click event so the overlay
        // doesn't close when the user drops the window
        const suppressClick = (e: MouseEvent) => {
          e.stopPropagation();
          e.preventDefault();
        };
        document.addEventListener('click', suppressClick, true);
        // Remove after a short delay (the click fires almost immediately after mouseup)
        setTimeout(() => {
          document.removeEventListener('click', suppressClick, true);
        }, 100);
      }

      isDragCandidate = false;
      didDrag = false;
      dragTarget = null;
    };

    document.addEventListener('mousedown', handleMouseDown, true);
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('mouseup', handleMouseUp, true);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true);
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('mouseup', handleMouseUp, true);
    };
  }, []);

  return null;
}
