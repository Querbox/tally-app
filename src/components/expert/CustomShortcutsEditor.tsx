import { useState } from 'react';
import { useSettingsStore, type CustomShortcut } from '../../stores/settingsStore';
import { SHORTCUTS, type ShortcutDefinition } from '../../config/shortcuts';
import { Keyboard, Plus, Trash2, Check, X, AlertTriangle } from 'lucide-react';

// Verfügbare Aktionen für Custom Shortcuts
const AVAILABLE_ACTIONS = [
  { id: 'newTask', label: 'Neue Aufgabe', defaultKey: 'n' },
  { id: 'newMeeting', label: 'Neues Meeting', defaultKey: 't' },
  { id: 'search', label: 'Suche öffnen', defaultKey: 'e' },
  { id: 'settings', label: 'Einstellungen', defaultKey: 'g' },
  { id: 'startFocus', label: 'Fokus-Modus', defaultKey: 'f' },
  { id: 'stats', label: 'Statistiken', defaultKey: 's' },
  { id: 'dayView', label: 'Tagesansicht', defaultKey: 'd' },
  { id: 'calendarView', label: 'Kalenderansicht', defaultKey: 'c' },
  { id: 'help', label: 'Tastenkürzel anzeigen', defaultKey: '?' },
] as const;

interface ShortcutEditorRowProps {
  shortcut: CustomShortcut;
  onUpdate: (updates: Partial<CustomShortcut>) => void;
  onDelete: () => void;
  existingShortcuts: CustomShortcut[];
  defaultShortcuts: ShortcutDefinition[];
}

function ShortcutEditorRow({
  shortcut,
  onUpdate,
  onDelete,
  existingShortcuts,
  defaultShortcuts
}: ShortcutEditorRowProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [tempKey, setTempKey] = useState('');
  const [tempModifiers, setTempModifiers] = useState<('ctrl' | 'alt' | 'shift' | 'meta')[]>([]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isRecording) return;

    e.preventDefault();
    e.stopPropagation();

    // Ignoriere reine Modifier-Tasten
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
      const mods: ('ctrl' | 'alt' | 'shift' | 'meta')[] = [];
      if (e.ctrlKey) mods.push('ctrl');
      if (e.altKey) mods.push('alt');
      if (e.shiftKey) mods.push('shift');
      if (e.metaKey) mods.push('meta');
      setTempModifiers(mods);
      return;
    }

    const mods: ('ctrl' | 'alt' | 'shift' | 'meta')[] = [];
    if (e.ctrlKey) mods.push('ctrl');
    if (e.altKey) mods.push('alt');
    if (e.shiftKey) mods.push('shift');
    if (e.metaKey) mods.push('meta');

    setTempKey(e.key.toLowerCase());
    setTempModifiers(mods);
  };

  const saveShortcut = () => {
    if (!tempKey) return;

    onUpdate({
      key: tempKey,
      modifiers: tempModifiers,
    });
    setIsRecording(false);
    setTempKey('');
    setTempModifiers([]);
  };

  const cancelRecording = () => {
    setIsRecording(false);
    setTempKey('');
    setTempModifiers([]);
  };

  const formatShortcut = (key: string, modifiers: ('ctrl' | 'alt' | 'shift' | 'meta')[]) => {
    const parts: string[] = [];
    if (modifiers.includes('meta')) parts.push('⌘');
    if (modifiers.includes('ctrl')) parts.push('Ctrl');
    if (modifiers.includes('alt')) parts.push('⌥');
    if (modifiers.includes('shift')) parts.push('⇧');

    // Sondertasten formatieren
    const keyDisplay = key === ' ' ? 'Space'
      : key === 'arrowleft' ? '←'
      : key === 'arrowright' ? '→'
      : key === 'arrowup' ? '↑'
      : key === 'arrowdown' ? '↓'
      : key === 'escape' ? 'Esc'
      : key === 'enter' ? '↵'
      : key.toUpperCase();

    parts.push(keyDisplay);
    return parts.join('');
  };

  // Prüfe auf Konflikte
  const hasConflict = () => {
    const currentKey = isRecording ? tempKey : shortcut.key;
    const currentMods = isRecording ? tempModifiers : shortcut.modifiers;

    if (!currentKey) return false;

    // Prüfe gegen andere Custom Shortcuts
    const customConflict = existingShortcuts.some(s =>
      s.id !== shortcut.id &&
      s.key === currentKey &&
      JSON.stringify(s.modifiers.sort()) === JSON.stringify(currentMods.sort())
    );

    // Prüfe gegen Default Shortcuts
    const defaultConflict = defaultShortcuts.some(s => {
      const defaultMods: string[] = [];
      if (s.meta) defaultMods.push('meta');
      if (s.ctrl) defaultMods.push('ctrl');
      if (s.alt) defaultMods.push('alt');
      if (s.shift) defaultMods.push('shift');

      return s.key === currentKey &&
        JSON.stringify(defaultMods.sort()) === JSON.stringify(currentMods.sort());
    });

    return customConflict || defaultConflict;
  };

  const actionLabel = AVAILABLE_ACTIONS.find(a => a.id === shortcut.action)?.label || shortcut.action;

  return (
    <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 group">
      {/* Action Name */}
      <div className="flex-1">
        <span className="text-sm font-medium text-gray-700">{actionLabel}</span>
      </div>

      {/* Shortcut Display/Editor */}
      <div className="flex items-center gap-2">
        {isRecording ? (
          <>
            <div
              className="min-w-[100px] px-3 py-1.5 bg-purple-50 border-2 border-purple-300 rounded-lg text-center focus:outline-none"
              onKeyDown={handleKeyDown}
              tabIndex={0}
              autoFocus
            >
              {tempKey ? (
                <span className="text-sm font-mono text-purple-700">
                  {formatShortcut(tempKey, tempModifiers)}
                </span>
              ) : (
                <span className="text-xs text-purple-500">Drücke Taste...</span>
              )}
            </div>
            <button
              onClick={saveShortcut}
              disabled={!tempKey}
              className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={cancelRecording}
              className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setIsRecording(true)}
              className={`min-w-[80px] px-3 py-1.5 rounded-lg text-sm font-mono transition-all ${
                hasConflict()
                  ? 'bg-red-50 border border-red-200 text-red-700'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              {shortcut.key ? formatShortcut(shortcut.key, shortcut.modifiers) : 'Setzen'}
            </button>
            {hasConflict() && (
              <AlertTriangle className="w-4 h-4 text-red-500" />
            )}
          </>
        )}

        {/* Enable/Disable Toggle */}
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={shortcut.enabled}
            onChange={(e) => onUpdate({ enabled: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-500"></div>
        </label>

        {/* Delete Button */}
        <button
          onClick={onDelete}
          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function CustomShortcutsEditor() {
  const customShortcuts = useSettingsStore((s) => s.customShortcuts);
  const addCustomShortcut = useSettingsStore((s) => s.addCustomShortcut);
  const updateCustomShortcut = useSettingsStore((s) => s.updateCustomShortcut);
  const deleteCustomShortcut = useSettingsStore((s) => s.deleteCustomShortcut);

  const [showAddMenu, setShowAddMenu] = useState(false);

  // Finde Aktionen die noch nicht zugewiesen sind
  const availableActions = AVAILABLE_ACTIONS.filter(
    action => !customShortcuts.some(s => s.action === action.id)
  );

  const handleAddShortcut = (actionId: string) => {
    const action = AVAILABLE_ACTIONS.find(a => a.id === actionId);
    if (!action) return;

    addCustomShortcut({
      action: actionId,
      key: action.defaultKey,
      modifiers: [],
      enabled: true,
    });
    setShowAddMenu(false);
  };

  return (
    <section className="bg-gray-50 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center">
            <Keyboard className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Eigene Tastenkürzel</h3>
            <p className="text-xs text-gray-500">Passe Shortcuts an deine Arbeitsweise an</p>
          </div>
        </div>

        {/* Add Button */}
        <div className="relative">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            disabled={availableActions.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-all"
          >
            <Plus className="w-4 h-4" />
            Hinzufügen
          </button>

          {/* Dropdown Menu */}
          {showAddMenu && availableActions.length > 0 && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 py-1 z-10">
              {availableActions.map(action => (
                <button
                  key={action.id}
                  onClick={() => handleAddShortcut(action.id)}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Shortcuts List */}
      {customShortcuts.length === 0 ? (
        <div className="text-center py-8">
          <Keyboard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Noch keine eigenen Shortcuts definiert</p>
          <p className="text-xs text-gray-400 mt-1">
            Klicke auf "Hinzufügen" um loszulegen
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {customShortcuts.map(shortcut => (
            <ShortcutEditorRow
              key={shortcut.id}
              shortcut={shortcut}
              onUpdate={(updates) => updateCustomShortcut(shortcut.id, updates)}
              onDelete={() => deleteCustomShortcut(shortcut.id)}
              existingShortcuts={customShortcuts}
              defaultShortcuts={SHORTCUTS}
            />
          ))}
        </div>
      )}

      {/* Info */}
      <div className="mt-4 p-3 bg-purple-50 rounded-lg">
        <p className="text-xs text-purple-700">
          <strong>Tipp:</strong> Klicke auf einen Shortcut um ihn neu zu belegen.
          Drücke die gewünschte Tastenkombination und bestätige mit dem Häkchen.
        </p>
      </div>
    </section>
  );
}
