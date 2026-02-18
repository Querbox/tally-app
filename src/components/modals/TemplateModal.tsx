import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTaskStore } from '../../stores/taskStore';
import { getTodayString } from '../../utils/dateUtils';
import { X, Plus, Trash2, FileText, Play } from 'lucide-react';
import type { TaskPriority } from '../../types';

interface TemplateModalProps {
  onClose: () => void;
}

export function TemplateModal({ onClose }: TemplateModalProps) {
  const templates = useTaskStore((s) => s.templates);
  const clients = useTaskStore((s) => s.clients);
  const tags = useTaskStore((s) => s.tags);
  const addTemplate = useTaskStore((s) => s.addTemplate);
  const deleteTemplate = useTaskStore((s) => s.deleteTemplate);
  const createTaskFromTemplate = useTaskStore((s) => s.createTaskFromTemplate);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    title: '',
    description: '',
    priority: 'medium' as TaskPriority,
    clientId: '',
    tagIds: [] as string[],
    subtasks: [] as { title: string }[],
    isMeeting: false,
    meetingDuration: 60,
  });
  const [newSubtask, setNewSubtask] = useState('');

  const handleCreateTemplate = () => {
    if (!newTemplate.name.trim() || !newTemplate.title.trim()) return;

    addTemplate({
      ...newTemplate,
      clientId: newTemplate.clientId || undefined,
    });

    setNewTemplate({
      name: '',
      title: '',
      description: '',
      priority: 'medium',
      clientId: '',
      tagIds: [],
      subtasks: [],
      isMeeting: false,
      meetingDuration: 60,
    });
    setShowCreateForm(false);
  };

  const handleAddSubtask = () => {
    if (!newSubtask.trim()) return;
    setNewTemplate((prev) => ({
      ...prev,
      subtasks: [...prev.subtasks, { title: newSubtask.trim() }],
    }));
    setNewSubtask('');
  };

  const handleRemoveSubtask = (index: number) => {
    setNewTemplate((prev) => ({
      ...prev,
      subtasks: prev.subtasks.filter((_, i) => i !== index),
    }));
  };

  const handleUseTemplate = (templateId: string) => {
    createTaskFromTemplate(templateId, getTodayString());
    onClose();
  };

  const toggleTag = (tagId: string) => {
    setNewTemplate((prev) => ({
      ...prev,
      tagIds: prev.tagIds.includes(tagId)
        ? prev.tagIds.filter((id) => id !== tagId)
        : [...prev.tagIds, tagId],
    }));
  };

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center animate-fade-in z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Vorlagen</h2>
              <p className="text-xs text-gray-500">Schnell wiederkehrende Aufgaben erstellen</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-all"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {!showCreateForm ? (
            <>
              {/* Template List */}
              {templates.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 mb-4">Noch keine Vorlagen erstellt</p>
                </div>
              ) : (
                <div className="space-y-2 mb-4">
                  {templates.map((template) => {
                    const client = clients.find((c) => c.id === template.clientId);
                    return (
                      <div
                        key={template.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-xl group hover:bg-gray-100 transition-all"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{template.name}</span>
                            {client && (
                              <span
                                className="text-xs px-2 py-0.5 rounded"
                                style={{ backgroundColor: `${client.color}15`, color: client.color }}
                              >
                                {client.name}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 truncate">{template.title}</p>
                          {template.subtasks.length > 0 && (
                            <p className="text-xs text-gray-400 mt-1">
                              {template.subtasks.length} Unteraufgaben
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleUseTemplate(template.id)}
                            className="p-2 text-violet-600 hover:bg-violet-100 rounded-lg transition-all"
                            title="Heute verwenden"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteTemplate(template.id)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add Button */}
              <button
                onClick={() => setShowCreateForm(true)}
                className="w-full flex items-center justify-center gap-2 p-3 bg-violet-100 text-violet-700 rounded-xl hover:bg-violet-200 transition-all font-medium"
              >
                <Plus className="w-5 h-5" />
                Neue Vorlage erstellen
              </button>
            </>
          ) : (
            /* Create Form */
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Vorlagenname</label>
                <input
                  type="text"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="z.B. Wöchentliches Meeting"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Aufgabentitel</label>
                <input
                  type="text"
                  value={newTemplate.title}
                  onChange={(e) => setNewTemplate((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Titel der Aufgabe"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Beschreibung (optional)</label>
                <textarea
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Beschreibung..."
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Priorität</label>
                  <select
                    value={newTemplate.priority}
                    onChange={(e) => setNewTemplate((prev) => ({ ...prev, priority: e.target.value as TaskPriority }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  >
                    <option value="low">Niedrig</option>
                    <option value="medium">Normal</option>
                    <option value="high">Hoch</option>
                    <option value="urgent">Dringend</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Kunde</label>
                  <select
                    value={newTemplate.clientId}
                    onChange={(e) => setNewTemplate((prev) => ({ ...prev, clientId: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  >
                    <option value="">Kein Kunde</option>
                    {clients.filter((c) => c.isActive).map((client) => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tags */}
              {tags.length > 0 && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => toggleTag(tag.id)}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                          newTemplate.tagIds.includes(tag.id)
                            ? 'text-white'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                        style={newTemplate.tagIds.includes(tag.id) ? { backgroundColor: tag.color } : undefined}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Subtasks */}
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Unteraufgaben</label>
                {newTemplate.subtasks.length > 0 && (
                  <div className="space-y-1 mb-2">
                    {newTemplate.subtasks.map((subtask, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-700">{subtask.title}</span>
                        <button
                          onClick={() => handleRemoveSubtask(index)}
                          className="p-1 text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    placeholder="Neue Unteraufgabe..."
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
                  />
                  <button
                    onClick={handleAddSubtask}
                    disabled={!newSubtask.trim()}
                    className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>

              {/* Meeting Toggle */}
              <label className="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer">
                <span className="text-sm text-gray-700">Ist Meeting</span>
                <input
                  type="checkbox"
                  checked={newTemplate.isMeeting}
                  onChange={(e) => setNewTemplate((prev) => ({ ...prev, isMeeting: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300"
                />
              </label>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all font-medium"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleCreateTemplate}
                  disabled={!newTemplate.name.trim() || !newTemplate.title.trim()}
                  className="flex-1 px-4 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:opacity-50 transition-all font-medium"
                >
                  Erstellen
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
