import { useState } from 'react';
import { useSettingsStore, type SavedFilter, type FilterCondition } from '../../stores/settingsStore';
import { useTaskStore } from '../../stores/taskStore';
import { Filter, Plus, Trash2, Save, X, ChevronDown } from 'lucide-react';

const FIELD_OPTIONS = [
  { value: 'priority', label: 'Priorität' },
  { value: 'status', label: 'Status' },
  { value: 'client', label: 'Kunde' },
  { value: 'tag', label: 'Tag' },
  { value: 'hasDeadline', label: 'Hat Deadline' },
] as const;

const OPERATOR_OPTIONS: Record<string, { value: string; label: string }[]> = {
  priority: [
    { value: 'equals', label: 'ist' },
    { value: 'notEquals', label: 'ist nicht' },
  ],
  status: [
    { value: 'equals', label: 'ist' },
    { value: 'notEquals', label: 'ist nicht' },
  ],
  client: [
    { value: 'equals', label: 'ist' },
    { value: 'notEquals', label: 'ist nicht' },
    { value: 'isEmpty', label: 'ist leer' },
    { value: 'isNotEmpty', label: 'ist nicht leer' },
  ],
  tag: [
    { value: 'contains', label: 'enthält' },
    { value: 'notEquals', label: 'enthält nicht' },
    { value: 'isEmpty', label: 'hat keine' },
    { value: 'isNotEmpty', label: 'hat mindestens einen' },
  ],
  hasDeadline: [
    { value: 'equals', label: 'ja' },
    { value: 'notEquals', label: 'nein' },
  ],
};

const PRIORITY_VALUES = [
  { value: 'urgent', label: 'Dringend' },
  { value: 'high', label: 'Hoch' },
  { value: 'medium', label: 'Normal' },
  { value: 'low', label: 'Niedrig' },
];

const STATUS_VALUES = [
  { value: 'todo', label: 'Offen' },
  { value: 'in_progress', label: 'In Arbeit' },
  { value: 'completed', label: 'Erledigt' },
];

interface ConditionRowProps {
  condition: FilterCondition;
  index: number;
  onChange: (index: number, condition: FilterCondition) => void;
  onRemove: (index: number) => void;
  clients: { id: string; name: string }[];
  tags: { id: string; name: string }[];
}

function ConditionRow({ condition, index, onChange, onRemove, clients, tags }: ConditionRowProps) {
  const operators = OPERATOR_OPTIONS[condition.field] || [];
  const needsValue = !['isEmpty', 'isNotEmpty'].includes(condition.operator);

  const getValueOptions = () => {
    switch (condition.field) {
      case 'priority':
        return PRIORITY_VALUES;
      case 'status':
        return STATUS_VALUES;
      case 'client':
        return clients.map(c => ({ value: c.id, label: c.name }));
      case 'tag':
        return tags.map(t => ({ value: t.id, label: t.name }));
      case 'hasDeadline':
        return [{ value: 'true', label: 'Ja' }, { value: 'false', label: 'Nein' }];
      default:
        return [];
    }
  };

  return (
    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
      {/* Field Select */}
      <select
        value={condition.field}
        onChange={(e) => onChange(index, {
          ...condition,
          field: e.target.value as FilterCondition['field'],
          operator: 'equals',
          value: '',
        })}
        className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      >
        {FIELD_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {/* Operator Select */}
      <select
        value={condition.operator}
        onChange={(e) => onChange(index, {
          ...condition,
          operator: e.target.value as FilterCondition['operator'],
        })}
        className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      >
        {operators.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {/* Value Select (if needed) */}
      {needsValue && (
        <select
          value={condition.value}
          onChange={(e) => onChange(index, { ...condition, value: e.target.value })}
          className="flex-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="">Auswählen...</option>
          {getValueOptions().map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}

      {/* Remove Button */}
      <button
        onClick={() => onRemove(index)}
        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

interface FilterEditorProps {
  filter?: SavedFilter;
  onSave: (filter: Omit<SavedFilter, 'id' | 'createdAt'>) => void;
  onCancel: () => void;
}

function FilterEditor({ filter, onSave, onCancel }: FilterEditorProps) {
  const clients = useTaskStore((s) => s.clients);
  const tags = useTaskStore((s) => s.tags);
  const [name, setName] = useState(filter?.name || '');
  const [logic, setLogic] = useState<'and' | 'or'>(filter?.logic || 'and');
  const [conditions, setConditions] = useState<FilterCondition[]>(
    filter?.conditions || [{ field: 'priority', operator: 'equals', value: '' }]
  );

  const handleAddCondition = () => {
    setConditions([...conditions, { field: 'priority', operator: 'equals', value: '' }]);
  };

  const handleUpdateCondition = (index: number, condition: FilterCondition) => {
    const updated = [...conditions];
    updated[index] = condition;
    setConditions(updated);
  };

  const handleRemoveCondition = (index: number) => {
    if (conditions.length > 1) {
      setConditions(conditions.filter((_, i) => i !== index));
    }
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), conditions, logic });
  };

  const isValid = name.trim() && conditions.every(c =>
    ['isEmpty', 'isNotEmpty'].includes(c.operator) || c.value
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      {/* Name Input */}
      <div>
        <label className="block text-xs text-gray-500 mb-1.5">Filtername</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z.B. Dringende ohne Kunde"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      {/* Logic Toggle */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">Bedingungen verknüpfen mit:</span>
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setLogic('and')}
            className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${
              logic === 'and' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            UND
          </button>
          <button
            onClick={() => setLogic('or')}
            className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${
              logic === 'or' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            ODER
          </button>
        </div>
      </div>

      {/* Conditions */}
      <div className="space-y-2">
        <label className="block text-xs text-gray-500">Bedingungen</label>
        {conditions.map((condition, index) => (
          <div key={index}>
            {index > 0 && (
              <div className="text-xs text-gray-400 text-center py-1">
                {logic === 'and' ? 'UND' : 'ODER'}
              </div>
            )}
            <ConditionRow
              condition={condition}
              index={index}
              onChange={handleUpdateCondition}
              onRemove={handleRemoveCondition}
              clients={clients.map(c => ({ id: c.id, name: c.name }))}
              tags={tags.map(t => ({ id: t.id, name: t.name }))}
            />
          </div>
        ))}
        <button
          onClick={handleAddCondition}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
        >
          <Plus className="w-4 h-4" />
          Bedingung hinzufügen
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
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <Save className="w-4 h-4" />
          Speichern
        </button>
      </div>
    </div>
  );
}

export function AdvancedFiltersEditor() {
  const savedFilters = useSettingsStore((s) => s.savedFilters);
  const addSavedFilter = useSettingsStore((s) => s.addSavedFilter);
  const deleteSavedFilter = useSettingsStore((s) => s.deleteSavedFilter);
  const [isEditing, setIsEditing] = useState(false);
  const [expandedFilter, setExpandedFilter] = useState<string | null>(null);

  const handleSave = (filter: Omit<SavedFilter, 'id' | 'createdAt'>) => {
    addSavedFilter(filter);
    setIsEditing(false);
  };

  const formatCondition = (condition: FilterCondition) => {
    const field = FIELD_OPTIONS.find(f => f.value === condition.field)?.label || condition.field;
    const operator = OPERATOR_OPTIONS[condition.field]?.find(o => o.value === condition.operator)?.label || condition.operator;

    if (['isEmpty', 'isNotEmpty'].includes(condition.operator)) {
      return `${field} ${operator}`;
    }

    let value = condition.value;
    if (condition.field === 'priority') {
      value = PRIORITY_VALUES.find(p => p.value === condition.value)?.label || value;
    } else if (condition.field === 'status') {
      value = STATUS_VALUES.find(s => s.value === condition.value)?.label || value;
    }

    return `${field} ${operator} "${value}"`;
  };

  return (
    <section className="bg-gray-50 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
            <Filter className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Gespeicherte Filter</h3>
            <p className="text-xs text-gray-500">Erstelle komplexe Filter für schnellen Zugriff</p>
          </div>
        </div>

        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium transition-all"
          >
            <Plus className="w-4 h-4" />
            Neuer Filter
          </button>
        )}
      </div>

      {/* Editor */}
      {isEditing && (
        <div className="mb-4">
          <FilterEditor
            onSave={handleSave}
            onCancel={() => setIsEditing(false)}
          />
        </div>
      )}

      {/* Saved Filters List */}
      {savedFilters.length === 0 && !isEditing ? (
        <div className="text-center py-8">
          <Filter className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Noch keine Filter gespeichert</p>
          <p className="text-xs text-gray-400 mt-1">
            Erstelle Filter um Aufgaben schnell zu filtern
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {savedFilters.map(filter => (
            <div
              key={filter.id}
              className="bg-white rounded-xl border border-gray-100 overflow-hidden group"
            >
              <div
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 transition-all"
                onClick={() => setExpandedFilter(expandedFilter === filter.id ? null : filter.id)}
              >
                <div className="flex items-center gap-3">
                  <Filter className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium text-gray-700">{filter.name}</span>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
                    {filter.conditions.length} {filter.conditions.length === 1 ? 'Bedingung' : 'Bedingungen'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSavedFilter(filter.id);
                    }}
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${
                    expandedFilter === filter.id ? 'rotate-180' : ''
                  }`} />
                </div>
              </div>

              {/* Expanded Details */}
              {expandedFilter === filter.id && (
                <div className="px-3 pb-3 pt-0 border-t border-gray-100">
                  <div className="text-xs text-gray-500 space-y-1 mt-2">
                    {filter.conditions.map((condition, index) => (
                      <div key={index} className="flex items-center gap-2">
                        {index > 0 && (
                          <span className="text-gray-400 font-medium">
                            {filter.logic === 'and' ? 'UND' : 'ODER'}
                          </span>
                        )}
                        <span className="bg-gray-50 px-2 py-1 rounded">
                          {formatCondition(condition)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Info */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-xs text-blue-700">
          <strong>Tipp:</strong> Gespeicherte Filter erscheinen im Filter-Dropdown der Tagesansicht.
          Kombiniere mehrere Bedingungen mit UND/ODER für präzise Ergebnisse.
        </p>
      </div>
    </section>
  );
}
