import { useState, useMemo } from 'react';
import { useSettingsStore, type AutomationRule, type AutomationTrigger, type AutomationAction, type FilterCondition } from '../../stores/settingsStore';
import { useTaskStore } from '../../stores/taskStore';
import { usePatternStore } from '../../stores/patternStore';
import { Zap, Plus, Trash2, Save, X, ChevronDown, Play, Pause, Lightbulb, Sparkles } from 'lucide-react';

const TRIGGER_OPTIONS = [
  { value: 'taskCreated', label: 'Aufgabe erstellt', description: 'Wenn eine neue Aufgabe erstellt wird' },
  { value: 'taskCompleted', label: 'Aufgabe erledigt', description: 'Wenn eine Aufgabe als erledigt markiert wird' },
  { value: 'dayStart', label: 'Tag startet', description: 'Wenn der Arbeitstag beginnt' },
  { value: 'dayEnd', label: 'Tag endet', description: 'Wenn der Arbeitstag endet' },
] as const;

const ACTION_OPTIONS = [
  { value: 'setPriority', label: 'Priorität setzen', needsConfig: true },
  { value: 'setClient', label: 'Kunde zuweisen', needsConfig: true },
  { value: 'addTag', label: 'Tag hinzufügen', needsConfig: true },
  { value: 'markOptional', label: 'Als optional markieren', needsConfig: false },
  { value: 'notify', label: 'Benachrichtigung senden', needsConfig: true },
] as const;

const CONDITION_FIELDS = [
  { value: 'priority', label: 'Priorität' },
  { value: 'client', label: 'Kunde' },
  { value: 'tag', label: 'Tag' },
  { value: 'hasDeadline', label: 'Hat Deadline' },
];

interface RuleEditorProps {
  rule?: AutomationRule;
  onSave: (rule: Omit<AutomationRule, 'id' | 'createdAt' | 'triggerCount'>) => void;
  onCancel: () => void;
}

function RuleEditor({ rule, onSave, onCancel }: RuleEditorProps) {
  const clients = useTaskStore((s) => s.clients);
  const tags = useTaskStore((s) => s.tags);
  const [name, setName] = useState(rule?.name || '');
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [trigger, setTrigger] = useState<AutomationTrigger>(
    rule?.trigger || { type: 'taskCreated' }
  );
  const [conditions, setConditions] = useState<FilterCondition[]>(rule?.conditions || []);
  const [actions, setActions] = useState<AutomationAction[]>(
    rule?.actions || [{ type: 'setPriority', config: { priority: 'medium' } }]
  );

  const handleAddCondition = () => {
    setConditions([...conditions, { field: 'priority', operator: 'equals', value: '' }]);
  };

  const handleRemoveCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const handleUpdateCondition = (index: number, updates: Partial<FilterCondition>) => {
    const updated = [...conditions];
    updated[index] = { ...updated[index], ...updates };
    setConditions(updated);
  };

  const handleAddAction = () => {
    setActions([...actions, { type: 'notify', config: { message: '' } }]);
  };

  const handleRemoveAction = (index: number) => {
    if (actions.length > 1) {
      setActions(actions.filter((_, i) => i !== index));
    }
  };

  const handleUpdateAction = (index: number, updates: Partial<AutomationAction>) => {
    const updated = [...actions];
    updated[index] = { ...updated[index], ...updates };
    setActions(updated);
  };

  const handleSave = () => {
    if (!name.trim() || actions.length === 0) return;
    onSave({ name: name.trim(), enabled, trigger, conditions, actions });
  };

  const isValid = name.trim() && actions.length > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      {/* Name & Enable */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1.5">Regelname</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z.B. Neue Aufgaben → Hohe Priorität"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer mt-5">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300"
          />
          <span className="text-sm text-gray-600">Aktiv</span>
        </label>
      </div>

      {/* Trigger */}
      <div>
        <label className="block text-xs text-gray-500 mb-1.5">Auslöser (WENN)</label>
        <select
          value={trigger.type}
          onChange={(e) => setTrigger({ type: e.target.value as AutomationTrigger['type'] })}
          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
        >
          {TRIGGER_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <p className="text-xs text-gray-400 mt-1">
          {TRIGGER_OPTIONS.find(t => t.value === trigger.type)?.description}
        </p>
      </div>

      {/* Conditions (Optional) */}
      <div>
        <label className="block text-xs text-gray-500 mb-1.5">Bedingungen (optional)</label>
        {conditions.length > 0 && (
          <div className="space-y-2 mb-2">
            {conditions.map((condition, index) => (
              <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                <select
                  value={condition.field}
                  onChange={(e) => handleUpdateCondition(index, { field: e.target.value as FilterCondition['field'] })}
                  className="px-2 py-1 bg-white border border-gray-200 rounded text-sm"
                >
                  {CONDITION_FIELDS.map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
                <select
                  value={condition.operator}
                  onChange={(e) => handleUpdateCondition(index, { operator: e.target.value as FilterCondition['operator'] })}
                  className="px-2 py-1 bg-white border border-gray-200 rounded text-sm"
                >
                  <option value="equals">ist</option>
                  <option value="notEquals">ist nicht</option>
                  <option value="isEmpty">ist leer</option>
                </select>
                {!['isEmpty', 'isNotEmpty'].includes(condition.operator) && (
                  <input
                    type="text"
                    value={condition.value}
                    onChange={(e) => handleUpdateCondition(index, { value: e.target.value })}
                    placeholder="Wert..."
                    className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm"
                  />
                )}
                <button
                  onClick={() => handleRemoveCondition(index)}
                  className="p-1 text-gray-400 hover:text-red-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={handleAddCondition}
          className="text-xs text-green-600 hover:text-green-700"
        >
          + Bedingung hinzufügen
        </button>
      </div>

      {/* Actions */}
      <div>
        <label className="block text-xs text-gray-500 mb-1.5">Aktionen (DANN)</label>
        <div className="space-y-2">
          {actions.map((action, index) => (
            <div key={index} className="flex items-center gap-2 p-2 bg-green-50 rounded-lg">
              <select
                value={action.type}
                onChange={(e) => handleUpdateAction(index, {
                  type: e.target.value as AutomationAction['type'],
                  config: {}
                })}
                className="px-2 py-1 bg-white border border-green-200 rounded text-sm"
              >
                {ACTION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>

              {/* Action Config */}
              {action.type === 'setPriority' && (
                <select
                  value={(action.config.priority as string) || 'medium'}
                  onChange={(e) => handleUpdateAction(index, { config: { priority: e.target.value } })}
                  className="flex-1 px-2 py-1 bg-white border border-green-200 rounded text-sm"
                >
                  <option value="urgent">Dringend</option>
                  <option value="high">Hoch</option>
                  <option value="medium">Normal</option>
                  <option value="low">Niedrig</option>
                </select>
              )}

              {action.type === 'setClient' && (
                <select
                  value={(action.config.clientId as string) || ''}
                  onChange={(e) => handleUpdateAction(index, { config: { clientId: e.target.value } })}
                  className="flex-1 px-2 py-1 bg-white border border-green-200 rounded text-sm"
                >
                  <option value="">Kunde wählen...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}

              {action.type === 'addTag' && (
                <select
                  value={(action.config.tagId as string) || ''}
                  onChange={(e) => handleUpdateAction(index, { config: { tagId: e.target.value } })}
                  className="flex-1 px-2 py-1 bg-white border border-green-200 rounded text-sm"
                >
                  <option value="">Tag wählen...</option>
                  {tags.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}

              {action.type === 'notify' && (
                <input
                  type="text"
                  value={(action.config.message as string) || ''}
                  onChange={(e) => handleUpdateAction(index, { config: { message: e.target.value } })}
                  placeholder="Nachricht..."
                  className="flex-1 px-2 py-1 border border-green-200 rounded text-sm"
                />
              )}

              {actions.length > 1 && (
                <button
                  onClick={() => handleRemoveAction(index)}
                  className="p-1 text-gray-400 hover:text-red-500"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={handleAddAction}
          className="text-xs text-green-600 hover:text-green-700 mt-2"
        >
          + Weitere Aktion
        </button>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
        >
          Abbrechen
        </button>
        <button
          onClick={handleSave}
          disabled={!isValid}
          className="flex items-center gap-1.5 px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <Save className="w-4 h-4" />
          Speichern
        </button>
      </div>
    </div>
  );
}

// Vorgeschlagene Automatisierungen basierend auf Nutzungsmustern
interface SuggestedAutomation {
  id: string;
  name: string;
  description: string;
  rule: Omit<AutomationRule, 'id' | 'createdAt' | 'triggerCount'>;
}

export function AutomationsEditor() {
  const automationRules = useSettingsStore((s) => s.automationRules);
  const addAutomationRule = useSettingsStore((s) => s.addAutomationRule);
  const updateAutomationRule = useSettingsStore((s) => s.updateAutomationRule);
  const deleteAutomationRule = useSettingsStore((s) => s.deleteAutomationRule);
  const tasks = useTaskStore((s) => s.tasks);
  const clients = useTaskStore((s) => s.clients);
  const dismissedPatterns = usePatternStore((s) => s.dismissedPatterns);
  const [isEditing, setIsEditing] = useState(false);
  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);

  // Analysiere Nutzungsmuster und generiere Vorschläge
  const suggestedAutomations = useMemo((): SuggestedAutomation[] => {
    const suggestions: SuggestedAutomation[] = [];

    // 1. Wenn oft manuell Client zugeordnet wird → Automatisierung vorschlagen
    const clientAssignments = tasks.filter(t => t.clientId && t.status === 'completed');
    const clientCounts: Record<string, number> = {};
    clientAssignments.forEach(t => {
      if (t.clientId) {
        clientCounts[t.clientId] = (clientCounts[t.clientId] || 0) + 1;
      }
    });

    // Häufigster Client
    const mostUsedClient = Object.entries(clientCounts)
      .sort(([, a], [, b]) => b - a)[0];

    if (mostUsedClient && mostUsedClient[1] >= 5) {
      const client = clients.find(c => c.id === mostUsedClient[0]);
      if (client && !automationRules.some(r => r.actions.some(a => a.type === 'setClient'))) {
        suggestions.push({
          id: 'auto-client-default',
          name: `Neuen Aufgaben "${client.name}" zuweisen`,
          description: `${mostUsedClient[1]} deiner letzten Aufgaben wurden diesem Kunden zugewiesen.`,
          rule: {
            name: `Automatisch ${client.name} zuweisen`,
            enabled: true,
            trigger: { type: 'taskCreated' },
            conditions: [],
            actions: [{ type: 'setClient', config: { clientId: client.id } }],
          },
        });
      }
    }

    // 2. Wenn viele Aufgaben hohe Priorität bekommen → Vorschlag für Standard-Priorität
    const highPriorityTasks = tasks.filter(t => t.priority === 'high' || t.priority === 'urgent');
    if (highPriorityTasks.length >= 10 && !automationRules.some(r => r.actions.some(a => a.type === 'setPriority'))) {
      suggestions.push({
        id: 'auto-priority-high',
        name: 'Neue Aufgaben mit hoher Priorität',
        description: `${highPriorityTasks.length} Aufgaben haben hohe/dringende Priorität.`,
        rule: {
          name: 'Standard: Hohe Priorität',
          enabled: true,
          trigger: { type: 'taskCreated' },
          conditions: [],
          actions: [{ type: 'setPriority', config: { priority: 'high' } }],
        },
      });
    }

    return suggestions;
  }, [tasks, clients, automationRules]);

  // Filtere bereits abgelehnte Vorschläge
  const visibleSuggestions = suggestedAutomations.filter(
    s => !dismissedPatterns.some(d => d.taskId === s.id && d.permanent)
  );

  const handleSave = (rule: Omit<AutomationRule, 'id' | 'createdAt' | 'triggerCount'>) => {
    addAutomationRule(rule);
    setIsEditing(false);
  };

  const handleAcceptSuggestion = (suggestion: SuggestedAutomation) => {
    addAutomationRule(suggestion.rule);
  };

  const toggleRule = (id: string) => {
    const rule = automationRules.find(r => r.id === id);
    if (rule) {
      updateAutomationRule(id, { enabled: !rule.enabled });
    }
  };

  return (
    <section className="bg-gray-50 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center">
            <Zap className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Automatisierungen</h3>
            <p className="text-xs text-gray-500">Regeln für automatische Aktionen</p>
          </div>
        </div>

        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-medium transition-all"
          >
            <Plus className="w-4 h-4" />
            Neue Regel
          </button>
        )}
      </div>

      {/* Vorgeschlagene Automatisierungen */}
      {visibleSuggestions.length > 0 && showSuggestions && !isEditing && (
        <div className="mb-4 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl border border-amber-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium text-amber-800">Vorgeschlagen für dich</span>
            </div>
            <button
              onClick={() => setShowSuggestions(false)}
              className="p-1 text-amber-400 hover:text-amber-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {visibleSuggestions.map(suggestion => (
              <div
                key={suggestion.id}
                className="flex items-center justify-between p-3 bg-white rounded-lg border border-amber-100"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700">{suggestion.name}</p>
                  <p className="text-xs text-gray-500">{suggestion.description}</p>
                </div>
                <button
                  onClick={() => handleAcceptSuggestion(suggestion)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-200 transition-colors"
                >
                  <Sparkles className="w-3 h-3" />
                  Aktivieren
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Editor */}
      {isEditing && (
        <div className="mb-4">
          <RuleEditor
            onSave={handleSave}
            onCancel={() => setIsEditing(false)}
          />
        </div>
      )}

      {/* Rules List */}
      {automationRules.length === 0 && !isEditing ? (
        <div className="text-center py-8">
          <Zap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Noch keine Automatisierungen</p>
          <p className="text-xs text-gray-400 mt-1">
            Erstelle Regeln um wiederkehrende Aktionen zu automatisieren
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {automationRules.map(rule => (
            <div
              key={rule.id}
              className={`bg-white rounded-xl border overflow-hidden group transition-all ${
                rule.enabled ? 'border-green-200' : 'border-gray-100 opacity-60'
              }`}
            >
              <div
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 transition-all"
                onClick={() => setExpandedRule(expandedRule === rule.id ? null : rule.id)}
              >
                <div className="flex items-center gap-3">
                  <Zap className={`w-4 h-4 ${rule.enabled ? 'text-green-500' : 'text-gray-400'}`} />
                  <span className="text-sm font-medium text-gray-700">{rule.name}</span>
                  {rule.triggerCount > 0 && (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
                      {rule.triggerCount}× ausgeführt
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleRule(rule.id);
                    }}
                    className={`p-1.5 rounded-lg transition-all ${
                      rule.enabled
                        ? 'text-green-600 hover:bg-green-50'
                        : 'text-gray-400 hover:bg-gray-100'
                    }`}
                  >
                    {rule.enabled ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteAutomationRule(rule.id);
                    }}
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${
                    expandedRule === rule.id ? 'rotate-180' : ''
                  }`} />
                </div>
              </div>

              {/* Expanded Details */}
              {expandedRule === rule.id && (
                <div className="px-3 pb-3 pt-0 border-t border-gray-100">
                  <div className="text-xs space-y-2 mt-2">
                    <div>
                      <span className="text-gray-500">Auslöser: </span>
                      <span className="text-gray-700 font-medium">
                        {TRIGGER_OPTIONS.find(t => t.value === rule.trigger.type)?.label}
                      </span>
                    </div>
                    {rule.conditions.length > 0 && (
                      <div>
                        <span className="text-gray-500">Bedingungen: </span>
                        <span className="text-gray-700">
                          {rule.conditions.length} {rule.conditions.length === 1 ? 'Bedingung' : 'Bedingungen'}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-500">Aktionen: </span>
                      <span className="text-gray-700">
                        {rule.actions.map(a => ACTION_OPTIONS.find(o => o.value === a.type)?.label).join(', ')}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Info */}
      <div className="mt-4 p-3 bg-green-50 rounded-lg">
        <p className="text-xs text-green-700">
          <strong>Beispiel:</strong> "Wenn Aufgabe erstellt wird → Priorität auf Hoch setzen" automatisiert
          die Zuweisung von Prioritäten für alle neuen Aufgaben.
        </p>
      </div>
    </section>
  );
}
