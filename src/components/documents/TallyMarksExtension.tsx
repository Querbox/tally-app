import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, Minus } from 'lucide-react';

// Tally Mark SVG Component - Echte Strichliste mit 5er-Gruppen
function TallyGroup({ count }: { count: number }) {
  // Eine 5er-Gruppe: 4 senkrechte Striche + 1 diagonaler
  const fullGroups = Math.floor(count / 5);
  const remainder = count % 5;

  return (
    <span className="inline-flex items-center gap-2">
      {/* Volle 5er-Gruppen */}
      {Array.from({ length: fullGroups }).map((_, groupIndex) => (
        <svg
          key={`group-${groupIndex}`}
          viewBox="0 0 40 30"
          className="h-6 w-10"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          {/* 4 senkrechte Striche */}
          <line x1="5" y1="5" x2="5" y2="25" />
          <line x1="13" y1="5" x2="13" y2="25" />
          <line x1="21" y1="5" x2="21" y2="25" />
          <line x1="29" y1="5" x2="29" y2="25" />
          {/* Diagonaler Strich über alle 4 */}
          <line x1="2" y1="22" x2="35" y2="8" strokeWidth="2.5" />
        </svg>
      ))}

      {/* Übrige Striche (1-4) */}
      {remainder > 0 && (
        <svg
          viewBox="0 0 40 30"
          className="h-6"
          style={{ width: `${remainder * 10 + 5}px` }}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          {Array.from({ length: remainder }).map((_, i) => (
            <line
              key={`line-${i}`}
              x1={5 + i * 8}
              y1="5"
              x2={5 + i * 8}
              y2="25"
            />
          ))}
        </svg>
      )}
    </span>
  );
}

// React Component für den Node View
function TallyMarksComponent(props: NodeViewProps) {
  const { node, updateAttributes, selected } = props;
  const count = (node.attrs.count as number) || 0;
  const label = node.attrs.label as string | undefined;
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(label || '');

  // Use refs to always have current values without re-registering listeners
  const countRef = useRef(count);
  const updateAttributesRef = useRef(updateAttributes);

  // Keep refs updated
  useEffect(() => {
    countRef.current = count;
  }, [count]);

  useEffect(() => {
    updateAttributesRef.current = updateAttributes;
  }, [updateAttributes]);

  const incrementRef = useRef<HTMLButtonElement>(null);
  const decrementRef = useRef<HTMLButtonElement>(null);

  // Native event listeners to bypass TipTap's event handling
  // Only register once on mount, use refs for current values
  useEffect(() => {
    const incrementBtn = incrementRef.current;
    const decrementBtn = decrementRef.current;

    const handleIncrement = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      // Use ref to get current count value
      updateAttributesRef.current({ count: countRef.current + 1 });
    };

    const handleDecrement = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      // Use ref to get current count value
      if (countRef.current > 0) {
        updateAttributesRef.current({ count: countRef.current - 1 });
      }
    };

    // Only use mousedown to prevent TipTap from intercepting the click
    // Don't use both mousedown AND click - that causes double-increment
    if (incrementBtn) {
      incrementBtn.addEventListener('mousedown', handleIncrement, true);
    }
    if (decrementBtn) {
      decrementBtn.addEventListener('mousedown', handleDecrement, true);
    }

    return () => {
      if (incrementBtn) {
        incrementBtn.removeEventListener('mousedown', handleIncrement, true);
      }
      if (decrementBtn) {
        decrementBtn.removeEventListener('mousedown', handleDecrement, true);
      }
    };
  }, []); // Empty deps - only run once on mount

  const handleLabelSave = useCallback(() => {
    updateAttributes({ label: editLabel || undefined });
    setIsEditing(false);
  }, [editLabel, updateAttributes]);

  return (
    <NodeViewWrapper className="tally-marks-wrapper">
      <div
        className={`inline-flex items-center gap-3 px-3 py-2 rounded-xl border transition-all my-1 ${
          selected
            ? 'border-blue-400 bg-blue-50 shadow-sm'
            : 'border-gray-200 bg-gray-50 hover:border-gray-300'
        }`}
        contentEditable={false}
      >
        {/* Label */}
        {isEditing ? (
          <input
            type="text"
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            onBlur={handleLabelSave}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                e.preventDefault();
                handleLabelSave();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                setIsEditing(false);
                setEditLabel(label || '');
              }
            }}
            placeholder="Bezeichnung..."
            className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-32"
            autoFocus
          />
        ) : (
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsEditing(true);
            }}
            className="text-sm text-gray-600 hover:text-gray-900 hover:underline min-w-[80px] text-left"
          >
            {label || 'Strichliste'}
          </button>
        )}

        {/* Tally Marks Display */}
        <div className="flex items-center text-gray-700">
          <TallyGroup count={count} />
        </div>

        {/* Count Display */}
        <span className="text-sm font-medium text-gray-500 min-w-[24px] text-center">
          {count}
        </span>

        {/* Controls */}
        <div className="flex items-center gap-1 ml-1">
          <button
            ref={decrementRef}
            type="button"
            disabled={count === 0}
            className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors active:scale-95"
            title="Verringern"
          >
            <Minus className="w-4 h-4 text-gray-600" />
          </button>
          <button
            ref={incrementRef}
            type="button"
            className="p-1.5 rounded-lg hover:bg-blue-100 hover:text-blue-600 transition-colors active:scale-95"
            title="Erhöhen (+1)"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </NodeViewWrapper>
  );
}

// TipTap Extension
export const TallyMarks = Node.create({
  name: 'tallyMarks',

  group: 'block',

  atom: true,

  addAttributes() {
    return {
      count: {
        default: 0,
      },
      label: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="tally-marks"]',
        getAttrs: (dom) => {
          const element = dom as HTMLElement;
          return {
            count: parseInt(element.getAttribute('data-count') || '0', 10),
            label: element.getAttribute('data-label') || null,
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'tally-marks',
        'data-count': String(node.attrs.count),
        'data-label': node.attrs.label || '',
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TallyMarksComponent);
  },

  addCommands() {
    return {
      insertTallyMarks:
        (attrs?: { count?: number; label?: string }) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              count: attrs?.count ?? 0,
              label: attrs?.label ?? null,
            },
          });
        },
    };
  },
});

// Tally Icon für das Slash Menu
export function TallyIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      {/* 4 senkrechte Striche */}
      <line x1="4" y1="6" x2="4" y2="18" />
      <line x1="8" y1="6" x2="8" y2="18" />
      <line x1="12" y1="6" x2="12" y2="18" />
      <line x1="16" y1="6" x2="16" y2="18" />
      {/* Diagonaler Strich */}
      <line x1="2" y1="16" x2="20" y2="8" />
    </svg>
  );
}
