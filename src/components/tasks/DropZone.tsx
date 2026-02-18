import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, CalendarCheck, CheckCircle, Sparkles } from 'lucide-react';

interface DropZoneProps {
  target: 'today' | 'optional' | 'tomorrow' | 'completed';
  isActive: boolean;
  isDraggedOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}

const DROP_ZONE_CONFIG = {
  today: {
    label: 'Heute',
    icon: Calendar,
    color: 'blue',
    bgActive: 'bg-blue-50',
    bgHover: 'bg-blue-100',
    border: 'border-blue-300',
    text: 'text-blue-600',
  },
  optional: {
    label: 'Optional',
    icon: Sparkles,
    color: 'amber',
    bgActive: 'bg-amber-50',
    bgHover: 'bg-amber-100',
    border: 'border-amber-300',
    text: 'text-amber-600',
  },
  tomorrow: {
    label: 'Morgen',
    icon: CalendarCheck,
    color: 'purple',
    bgActive: 'bg-purple-50',
    bgHover: 'bg-purple-100',
    border: 'border-purple-300',
    text: 'text-purple-600',
  },
  completed: {
    label: 'Erledigt',
    icon: CheckCircle,
    color: 'green',
    bgActive: 'bg-green-50',
    bgHover: 'bg-green-100',
    border: 'border-green-300',
    text: 'text-green-600',
  },
};

export function DropZone({
  target,
  isActive,
  isDraggedOver,
  onDragOver,
  onDragLeave,
  onDrop,
}: DropZoneProps) {
  const config = DROP_ZONE_CONFIG[target];
  const Icon = config.icon;

  if (!isActive) return null;

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`
        flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed
        transition-all duration-200
        ${isDraggedOver
          ? `${config.bgHover} ${config.border} scale-[1.02]`
          : `${config.bgActive} border-gray-300`
        }
      `}
    >
      <Icon className={`w-5 h-5 ${isDraggedOver ? config.text : 'text-gray-400'}`} />
      <span className={`text-sm font-medium ${isDraggedOver ? config.text : 'text-gray-500'}`}>
        {isDraggedOver ? `Hierhin verschieben` : config.label}
      </span>
    </div>
  );
}

// Zone configuration
const ZONES = [
  {
    id: 'today',
    label: 'Heute',
    icon: Calendar,
    activeClass: 'bg-blue-500 text-white ring-4 ring-blue-300 shadow-xl shadow-blue-200',
    baseClass: 'bg-blue-50 text-blue-600 border-2 border-blue-200'
  },
  {
    id: 'optional',
    label: 'Optional',
    icon: Sparkles,
    activeClass: 'bg-amber-500 text-white ring-4 ring-amber-300 shadow-xl shadow-amber-200',
    baseClass: 'bg-amber-50 text-amber-600 border-2 border-amber-200'
  },
  {
    id: 'tomorrow',
    label: 'Morgen',
    icon: CalendarCheck,
    activeClass: 'bg-purple-500 text-white ring-4 ring-purple-300 shadow-xl shadow-purple-200',
    baseClass: 'bg-purple-50 text-purple-600 border-2 border-purple-200'
  },
  {
    id: 'completed',
    label: 'Erledigt',
    icon: CheckCircle,
    activeClass: 'bg-green-500 text-white ring-4 ring-green-300 shadow-xl shadow-green-200',
    baseClass: 'bg-green-50 text-green-600 border-2 border-green-200'
  },
];

// Floating drop zones that appear when dragging
interface FloatingDropZonesProps {
  isVisible: boolean;
  currentDate: string;
  dragOverTarget: string | null;
  onDragOver: (target: string, e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (target: string, e: React.DragEvent) => void;
}

export function FloatingDropZones({
  isVisible,
  currentDate: _currentDate,
  dragOverTarget,
  onDragOver,
  onDragLeave,
  onDrop,
}: FloatingDropZonesProps) {
  const zoneRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [localHoveredZone, setLocalHoveredZone] = useState<string | null>(null);

  // Funktion um zu prüfen welche Zone unter einer Position ist
  const getZoneAtPosition = useCallback((x: number, y: number): string | null => {
    for (const [zoneId, element] of zoneRefs.current.entries()) {
      const rect = element.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return zoneId;
      }
    }
    return null;
  }, []);

  // Document-level drag event handlers für zuverlässigeres Tracking
  useEffect(() => {
    if (!isVisible) {
      setLocalHoveredZone(null);
      return;
    }

    const handleDragOver = (e: DragEvent) => {
      // Prevent default to allow drop
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
      }

      const zone = getZoneAtPosition(e.clientX, e.clientY);
      setLocalHoveredZone(zone);

      if (zone) {
        onDragOver(zone, e as unknown as React.DragEvent);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const zone = getZoneAtPosition(e.clientX, e.clientY);
      if (zone) {
        onDrop(zone, e as unknown as React.DragEvent);
      }
      setLocalHoveredZone(null);
    };

    const handleDragLeave = (e: DragEvent) => {
      // Nur zurücksetzen wenn wir das Fenster verlassen
      if (!e.relatedTarget || (e.relatedTarget as Node).nodeName === 'HTML') {
        setLocalHoveredZone(null);
        onDragLeave();
      }
    };

    const handleDragEnd = () => {
      setLocalHoveredZone(null);
    };

    // Add listeners to document for global tracking
    document.addEventListener('dragover', handleDragOver, true);
    document.addEventListener('drop', handleDrop, true);
    document.addEventListener('dragleave', handleDragLeave, true);
    document.addEventListener('dragend', handleDragEnd, true);

    return () => {
      document.removeEventListener('dragover', handleDragOver, true);
      document.removeEventListener('drop', handleDrop, true);
      document.removeEventListener('dragleave', handleDragLeave, true);
      document.removeEventListener('dragend', handleDragEnd, true);
    };
  }, [isVisible, getZoneAtPosition, onDragOver, onDragLeave, onDrop]);

  if (!isVisible) return null;

  // Kombiniere lokalen hover state mit props
  const activeZone = localHoveredZone || dragOverTarget;

  // Render in Portal to ensure it's above all other elements
  return createPortal(
    <div
      className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-white/98 backdrop-blur-md p-5 rounded-3xl shadow-2xl border border-gray-200 animate-slide-up"
      style={{ zIndex: 99999 }}
    >
      <span className="text-sm text-gray-500 font-medium px-2">Verschieben nach:</span>

      {ZONES.map((zone) => {
        const Icon = zone.icon;
        const isOver = activeZone === zone.id;

        return (
          <div
            key={zone.id}
            ref={(el) => {
              if (el) {
                zoneRefs.current.set(zone.id, el);
              } else {
                zoneRefs.current.delete(zone.id);
              }
            }}
            className={`
              flex items-center gap-3 px-7 py-4 rounded-2xl cursor-default
              transition-all duration-150 ease-out select-none
              ${isOver
                ? `${zone.activeClass} scale-110 -translate-y-1`
                : `${zone.baseClass}`
              }
            `}
          >
            <Icon className={`w-6 h-6 ${isOver ? 'animate-pulse' : ''}`} />
            <span className="text-base font-semibold whitespace-nowrap">
              {isOver ? 'Hier ablegen' : zone.label}
            </span>
          </div>
        );
      })}
    </div>,
    document.body
  );
}
