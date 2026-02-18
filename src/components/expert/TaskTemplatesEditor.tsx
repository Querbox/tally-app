import { useState } from 'react';
import { useTaskStore } from '../../stores/taskStore';
import type { TaskTemplate, TaskPriority } from '../../types';
import {
  FileText,
  Plus,
  Trash2,
  Edit3,
  Save,
  ChevronDown,
  Play,
  Copy
} from 'lucide-react';

interface TemplateEditorProps {
  template?: TaskTemplate;
  onSave: (template: Omit<TaskTemplate, 'id' | 'createdAt'>) => void;
  onCancel: () => void;
}

function TemplateEditor({ template, onSave, onCancel }: TemplateEditorProps) {
  const clients = useTaskStore((s) => s.clients);
  const tags = useTaskStore((s) => s.tags);

  const [name, setName] = useState(template?.name || '');
  const [title, setTitle] = useState(template?.title || '');
  const [description, setDescription] = useState(template?.description || '');
  const [priority, setPriority] = useState<TaskPriority>(template?.priority || 'medium');
  const [clientId, setClientId] = useState(template?.clientId || '');
  const [tagIds, setTagIds] = useState<string[]>(template?.tagIds || []);
  const [estimatedMinutes, setEstimatedMinutes] = useState(template?.estimatedMinutes || 30);

  const handleSave = () => {
    if (!name.trim() || !title.trim()) return;
    onSave({
      name: name.trim(),
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      clientId: clientId || undefined,
      tagIds,
      subtasks: [],
      isMeeting: false,
      estimatedMinutes,
    });
  };

  const toggleTag = (tagId: string) => {
    setTagIds(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const isValid = name.trim() && title.trim();

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      {/* Template Name */}
      <div>
        <label className="block text-xs text-gray-500 mb-1.5">Template-Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z.B. Wöchentlicher Report"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/20"
        />
      </div>

      {/* Task Title */}
      <div>
        <label className="block text-xs text-gray-500 mb-1.5">Aufgaben-Titel</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="z.B. Wöchentlichen Report erstellen"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/20"
        />
        <p className="text-xs text-gray-400 mt-1">
          Tipp: Verwende {'{datum}'} für das aktuelle Datum
        </p>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs text-gray-500 mb-1.5">Beschreibung (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Details zur Aufgabe..."
          rows={3}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/20 resize-none"
        />
      </div>

      {/* Priority & Estimated Time */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">Priorität</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/20"
          >
            <option value="urgent">Dringend</option>
            <option value="high">Hoch</option>
            <option value="medium">Normal</option>
            <option value="low">Niedrig</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">Geschätzte Zeit</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="5"
              max="480"
              step="5"
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(parseInt(e.target.value) || 30)}
              className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-pink-500/20"
            />
            <span className="text-sm text-gray-500">Minuten</span>
          </div>
        </div>
      </div>

      {/* Client */}
      <div>
        <label className="block text-xs text-gray-500 mb-1.5">Kunde (optional)</label>
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/20"
        >
          <option value="">Kein Kunde</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">Tags (optional)</label>
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  tagIds.includes(tag.id)
                    ? 'ring-2 ring-offset-1'
                    : 'opacity-60 hover:opacity-100'
                }`}
                style={{
                  backgroundColor: tag.color + '20',
                  color: tag.color,
                  borderColor: tag.color,
                }}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}

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
          className="flex items-center gap-1.5 px-4 py-2 bg-pink-500 text-white text-sm font-medium rounded-lg hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <Save className="w-4 h-4" />
          Speichern
        </button>
      </div>
    </div>
  );
}

export function TaskTemplatesEditor() {
  const templates = useTaskStore((s) => s.templates);
  const addTemplate = useTaskStore((s) => s.addTemplate);
  const updateTemplate = useTaskStore((s) => s.updateTemplate);
  const deleteTemplate = useTaskStore((s) => s.deleteTemplate);
  const addTask = useTaskStore((s) => s.addTask);
  const clients = useTaskStore((s) => s.clients);
  const tags = useTaskStore((s) => s.tags);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);

  const handleSave = (template: Omit<TaskTemplate, 'id' | 'createdAt'>) => {
    if (editingTemplate) {
      updateTemplate(editingTemplate.id, template);
    } else {
      addTemplate(template);
    }
    setIsEditing(false);
    setEditingTemplate(null);
  };

  const handleEdit = (template: TaskTemplate) => {
    setEditingTemplate(template);
    setIsEditing(true);
  };

  const handleUseTemplate = (template: TaskTemplate) => {
    const today = new Date().toISOString().split('T')[0];
    const dateFormatted = new Date().toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    // Ersetze Platzhalter
    const title = template.title.replace('{datum}', dateFormatted);
    const description = template.description?.replace('{datum}', dateFormatted);

    addTask({
      title,
      description,
      priority: template.priority,
      clientId: template.clientId,
      tagIds: template.tagIds,
      scheduledDate: today,
      status: 'todo',
      subtasks: template.subtasks.map((s, i) => ({
        id: crypto.randomUUID(),
        title: s.title,
        isCompleted: false,
        order: i,
      })),
      isSpontaneous: false,
      isMeeting: template.isMeeting,
      timeEntries: [],
    });
  };

  const getClientName = (clientId?: string) => {
    if (!clientId) return null;
    return clients.find(c => c.id === clientId)?.name;
  };

  const getTagNames = (tagIds: string[]) => {
    return tagIds
      .map(id => tags.find(t => t.id === id)?.name)
      .filter(Boolean);
  };

  const priorityColors: Record<TaskPriority, string> = {
    urgent: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-blue-100 text-blue-700',
    low: 'bg-gray-100 text-gray-700',
  };

  const priorityLabels: Record<TaskPriority, string> = {
    urgent: 'Dringend',
    high: 'Hoch',
    medium: 'Normal',
    low: 'Niedrig',
  };

  return (
    <section className="bg-gray-50 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-pink-100 rounded-xl flex items-center justify-center">
            <FileText className="w-5 h-5 text-pink-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Aufgaben-Templates</h3>
            <p className="text-xs text-gray-500">Vorlagen für wiederkehrende Aufgaben</p>
          </div>
        </div>

        {!isEditing && (
          <button
            onClick={() => {
              setEditingTemplate(null);
              setIsEditing(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-500 text-white rounded-lg hover:bg-pink-600 text-sm font-medium transition-all"
          >
            <Plus className="w-4 h-4" />
            Neues Template
          </button>
        )}
      </div>

      {/* Editor */}
      {isEditing && (
        <div className="mb-4">
          <TemplateEditor
            template={editingTemplate || undefined}
            onSave={handleSave}
            onCancel={() => {
              setIsEditing(false);
              setEditingTemplate(null);
            }}
          />
        </div>
      )}

      {/* Templates List */}
      {templates.length === 0 && !isEditing ? (
        <div className="text-center py-8">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Noch keine Templates</p>
          <p className="text-xs text-gray-400 mt-1">
            Erstelle Templates für Aufgaben die du oft erstellst
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(template => (
            <div
              key={template.id}
              className="bg-white rounded-xl border border-gray-100 overflow-hidden group"
            >
              <div
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 transition-all"
                onClick={() => setExpandedTemplate(expandedTemplate === template.id ? null : template.id)}
              >
                <div className="flex items-center gap-3">
                  <Copy className="w-4 h-4 text-pink-500" />
                  <span className="text-sm font-medium text-gray-700">{template.name}</span>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${priorityColors[template.priority]}`}>
                    {priorityLabels[template.priority]}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUseTemplate(template);
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-green-600 hover:bg-green-50 rounded-lg transition-all"
                    title="Template verwenden"
                  >
                    <Play className="w-3 h-3" />
                    Verwenden
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(template);
                    }}
                    className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Template wirklich löschen?')) {
                        deleteTemplate(template.id);
                      }
                    }}
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${
                    expandedTemplate === template.id ? 'rotate-180' : ''
                  }`} />
                </div>
              </div>

              {/* Expanded Details */}
              {expandedTemplate === template.id && (
                <div className="px-3 pb-3 pt-0 border-t border-gray-100">
                  <div className="text-xs space-y-2 mt-2">
                    <div>
                      <span className="text-gray-500">Titel: </span>
                      <span className="text-gray-700 font-medium">{template.title}</span>
                    </div>
                    {template.description && (
                      <div>
                        <span className="text-gray-500">Beschreibung: </span>
                        <span className="text-gray-700">{template.description}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {getClientName(template.clientId) && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                          {getClientName(template.clientId)}
                        </span>
                      )}
                      {getTagNames(template.tagIds).map((tagName, i) => (
                        <span key={i} className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                          {tagName}
                        </span>
                      ))}
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full">
                        ~{template.estimatedMinutes} Min
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
      <div className="mt-4 p-3 bg-pink-50 rounded-lg">
        <p className="text-xs text-pink-700">
          <strong>Tipp:</strong> Verwende <code className="bg-pink-100 px-1 rounded">{'{datum}'}</code> im Titel,
          um automatisch das aktuelle Datum einzufügen.
        </p>
      </div>
    </section>
  );
}
