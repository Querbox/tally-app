import { X } from 'lucide-react';
import { getShortcutsGrouped } from '../../config/shortcuts';

/**
 * KEYBOARD SHORTCUTS MODAL
 * ========================
 *
 * Zeigt alle verfügbaren Tastenkürzel.
 * Liest dynamisch aus der zentralen Shortcut-Config.
 *
 * So bleibt die Anzeige immer aktuell,
 * wenn neue Shortcuts hinzugefügt werden.
 */

interface KeyboardShortcutsModalProps {
  onClose: () => void;
}

export function KeyboardShortcutsModal({ onClose }: KeyboardShortcutsModalProps) {
  // Dynamisch aus zentraler Config laden
  const shortcutGroups = getShortcutsGrouped();

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Tastaturkürzel</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - dynamisch generiert */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {shortcutGroups.map((group) => (
            <div key={group.category} className="mb-6 last:mb-0">
              <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
                {group.label}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.id}
                    className="flex items-center justify-between py-2"
                  >
                    <span className="text-sm text-gray-700">{shortcut.label}</span>
                    <kbd className="px-2 py-1 text-xs font-mono bg-gray-100 border border-gray-200 rounded text-gray-600">
                      {shortcut.displayKey}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100">
          <p className="text-xs text-gray-500 text-center">
            Drücke{' '}
            <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-gray-600">
              ?
            </kbd>{' '}
            um diese Hilfe anzuzeigen
          </p>
        </div>
      </div>
    </div>
  );
}
