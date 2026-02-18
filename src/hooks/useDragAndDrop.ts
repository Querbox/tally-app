import { useState, useCallback, useRef, useEffect } from 'react';
import type { Task } from '../types';

export interface DragState {
  isDragging: boolean;
  draggedTask: Task | null;
  dragOverTarget: string | null; // 'today' | 'tomorrow' | 'completed' | task-id
}

interface UseDragAndDropOptions {
  onDrop: (task: Task, target: string) => void;
}

export function useDragAndDrop({ onDrop }: UseDragAndDropOptions) {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedTask: null,
    dragOverTarget: null,
  });

  const dragTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Start dragging a task
  const handleDragStart = useCallback((task: Task, e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);

    // Delay state update to allow drag image to render
    dragTimeoutRef.current = setTimeout(() => {
      setDragState({
        isDragging: true,
        draggedTask: task,
        dragOverTarget: null,
      });
    }, 0);
  }, []);

  // End dragging
  const handleDragEnd = useCallback(() => {
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
    }
    setDragState({
      isDragging: false,
      draggedTask: null,
      dragOverTarget: null,
    });
  }, []);

  // Drag over a drop target
  const handleDragOver = useCallback((target: string, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragState((prev) => ({
      ...prev,
      dragOverTarget: target,
    }));
  }, []);

  // Leave a drop target
  const handleDragLeave = useCallback(() => {
    setDragState((prev) => ({
      ...prev,
      dragOverTarget: null,
    }));
  }, []);

  // Drop on a target
  const handleDrop = useCallback((target: string, e: React.DragEvent) => {
    e.preventDefault();
    const { draggedTask } = dragState;

    if (draggedTask) {
      onDrop(draggedTask, target);
    }

    setDragState({
      isDragging: false,
      draggedTask: null,
      dragOverTarget: null,
    });
  }, [dragState, onDrop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current);
      }
    };
  }, []);

  return {
    dragState,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}

// Drop zone component helpers
export interface DropZoneProps {
  target: string;
  label: string;
  isActive: boolean;
  isDraggedOver: boolean;
  onDragOver: (target: string, e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (target: string, e: React.DragEvent) => void;
}
