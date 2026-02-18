import { useState, useEffect, useRef } from 'react';
import {
  X,
  Calendar,
  Pause,
  Trash2,
  ArrowDown,
  AlertTriangle,
  Play,
  User,
} from 'lucide-react';
import { usePatternStore } from '../../stores/patternStore';
import type { DetectedPattern, PatternType } from '../../types';

interface PatternSuggestionProps {
  pattern: DetectedPattern;
  onAction: (patternId: string, action: string) => void;
}

/** Farben pro Muster-Typ */
const PATTERN_COLORS: Record<
  PatternType,
  { bg: string; border: string; text: string; textLight: string; btnBg: string; btnHover: string }
> = {
  postpone: {
    bg: 'bg-amber-50',
    border: 'border-amber-100',
    text: 'text-amber-700',
    textLight: 'text-amber-400',
    btnBg: 'bg-amber-100',
    btnHover: 'hover:bg-amber-200',
  },
  deadlineWarning: {
    bg: 'bg-red-50',
    border: 'border-red-100',
    text: 'text-red-700',
    textLight: 'text-red-400',
    btnBg: 'bg-red-100',
    btnHover: 'hover:bg-red-200',
  },
  autoClient: {
    bg: 'bg-purple-50',
    border: 'border-purple-100',
    text: 'text-purple-700',
    textLight: 'text-purple-400',
    btnBg: 'bg-purple-100',
    btnHover: 'hover:bg-purple-200',
  },
};

export function PatternSuggestion({ pattern, onAction }: PatternSuggestionProps) {
  const dismissPattern = usePatternStore((s) => s.dismissPattern);
  const acceptPattern = usePatternStore((s) => s.acceptPattern);
  const recordPatternShown = usePatternStore((s) => s.recordPatternShown);
  const [isVisible, setIsVisible] = useState(true);
  const hasRecordedRef = useRef(false);

  useEffect(() => {
    if (!hasRecordedRef.current) {
      hasRecordedRef.current = true;
      recordPatternShown();
    }
  }, [recordPatternShown]);

  if (!isVisible) return null;

  const colors = PATTERN_COLORS[pattern.patternType];

  const handleDismiss = () => {
    dismissPattern(pattern.id);
    setIsVisible(false);
  };

  const handleNeverAsk = () => {
    dismissPattern(pattern.id, true);
    setIsVisible(false);
  };

  const handleAccept = (action: string) => {
    acceptPattern(pattern.id);
    onAction(pattern.id, action);
    setIsVisible(false);
  };

  return (
    <div
      className={`mt-2 px-3 py-2.5 ${colors.bg} rounded-xl border ${colors.border} animate-fade-in`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <p className={`text-xs ${colors.text} leading-relaxed`}>
          {pattern.description}
        </p>
        <button
          onClick={handleDismiss}
          className={`p-0.5 ${colors.textLight} hover:${colors.text} transition-colors flex-shrink-0`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Aktionen */}
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <PatternActions
          pattern={pattern}
          colors={colors}
          onAccept={handleAccept}
        />
        <button
          onClick={handleNeverAsk}
          className={`ml-auto text-xs ${colors.textLight} hover:${colors.text} transition-colors`}
        >
          Nie fragen
        </button>
      </div>
    </div>
  );
}

/** Rendert die passenden Aktions-Buttons pro Muster-Typ */
function PatternActions({
  pattern,
  colors,
  onAccept,
}: {
  pattern: DetectedPattern;
  colors: (typeof PATTERN_COLORS)[PatternType];
  onAccept: (action: string) => void;
}) {
  const btnClass = `flex items-center gap-1 px-2 py-1 text-xs font-medium ${colors.text} ${colors.btnBg} ${colors.btnHover} rounded-lg transition-colors`;
  const secondaryClass = `px-2 py-1 text-xs ${colors.text} hover:${colors.btnBg} rounded-lg transition-colors`;

  switch (pattern.payload.type) {
    case 'postpone':
      return (
        <>
          <button onClick={() => onAccept('markOptional')} className={btnClass}>
            <Pause className="w-3 h-3" />
            Optional
          </button>
          <button onClick={() => onAccept('reschedule')} className={secondaryClass}>
            <Calendar className="w-3 h-3 inline mr-0.5" />
            Verschieben
          </button>
          <button onClick={() => onAccept('deprioritize')} className={secondaryClass}>
            <ArrowDown className="w-3 h-3 inline mr-0.5" />
            Niedrig
          </button>
          <button onClick={() => onAccept('delete')} className={secondaryClass}>
            <Trash2 className="w-3 h-3 inline mr-0.5" />
            Löschen
          </button>
        </>
      );

    case 'deadline':
      return (
        <>
          <button onClick={() => onAccept('setFocus')} className={btnClass}>
            <Play className="w-3 h-3" />
            Jetzt anfangen
          </button>
          <button onClick={() => onAccept('reschedule')} className={secondaryClass}>
            <AlertTriangle className="w-3 h-3 inline mr-0.5" />
            Verschieben
          </button>
        </>
      );

    case 'autoClient':
      return (
        <>
          <button onClick={() => onAccept('acceptClient')} className={btnClass}>
            <User className="w-3 h-3" />
            Zuordnen
          </button>
          <button onClick={() => onAccept('dismiss')} className={secondaryClass}>
            Nein
          </button>
        </>
      );

    default:
      return null;
  }
}
