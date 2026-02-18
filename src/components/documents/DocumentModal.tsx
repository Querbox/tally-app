import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { DocumentEditor } from './DocumentEditor';
import { useDocumentStore, DocumentSizeError } from '../../stores/documentStore';
import { useTaskStore } from '../../stores/taskStore';
import type { Document } from '../../types';
import {
  X,
  FileText,
  Save,
  Trash2,
  Unlink,
  Link2,
  Check,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { TaskDescriptionEditor } from '../tasks/TaskDescriptionEditor';

interface DocumentModalProps {
  doc: Document | null; // null = neues Dokument
  clientId: string; // Vorausgewählter Kunde
  taskId?: string; // Optional: vorverknüpfte Aufgabe
  onClose: () => void;
  isNew?: boolean;
}

export function DocumentModal({
  doc,
  clientId,
  taskId: initialTaskId,
  onClose,
  isNew = false,
}: DocumentModalProps) {
  const addDocument = useDocumentStore((s) => s.addDocument);
  const updateDocument = useDocumentStore((s) => s.updateDocument);
  const deleteDocument = useDocumentStore((s) => s.deleteDocument);
  const clients = useTaskStore((s) => s.clients);
  const tasks = useTaskStore((s) => s.tasks);
  const updateTask = useTaskStore((s) => s.updateTask);

  // Form state
  const [title, setTitle] = useState(doc?.title || '');
  const [content, setContent] = useState(doc?.content || '');
  const [selectedClientId, setSelectedClientId] = useState(
    doc?.clientId || clientId
  );
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>(
    doc?.taskId || initialTaskId
  );
  const [syncTaskDescription, setSyncTaskDescription] = useState(
    doc?.syncTaskDescription ?? false
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [sizeError, setSizeError] = useState<string | null>(null);

  // Separate state for synchronized task description section
  const [taskDescriptionContent, setTaskDescriptionContent] = useState('');
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadRef = useRef(true);
  const lastSavedContentRef = useRef('');
  const lastKnownTaskDescriptionRef = useRef(''); // Track external changes

  // Get client and task info
  const client = clients.find((c) => c.id === selectedClientId);
  const linkedTask = selectedTaskId
    ? tasks.find((t) => t.id === selectedTaskId)
    : undefined;

  // Get tasks for this client (for linking)
  const clientTasks = tasks.filter(
    (t) => t.clientId === selectedClientId && t.status !== 'completed'
  );

  // Load task description when task is linked and sync is enabled
  // Use a smarter sync that detects conflicts
  useEffect(() => {
    if (syncTaskDescription && selectedTaskId && linkedTask?.description !== undefined) {
      const externalDescription = linkedTask.description || '';

      // First load or task switch: always take external value
      if (initialLoadRef.current || lastKnownTaskDescriptionRef.current === '') {
        setTaskDescriptionContent(externalDescription);
        lastSavedContentRef.current = externalDescription;
        lastKnownTaskDescriptionRef.current = externalDescription;
        initialLoadRef.current = false;
        return;
      }

      // Detect external change (from another component/source)
      // Only update if the external change wasn't caused by our own save
      if (externalDescription !== lastKnownTaskDescriptionRef.current &&
          externalDescription !== lastSavedContentRef.current) {
        // External change detected - update our local state
        setTaskDescriptionContent(externalDescription);
        lastSavedContentRef.current = externalDescription;
        lastKnownTaskDescriptionRef.current = externalDescription;
      }
    } else if (!syncTaskDescription) {
      setTaskDescriptionContent('');
      lastSavedContentRef.current = '';
      lastKnownTaskDescriptionRef.current = '';
    }
  }, [syncTaskDescription, selectedTaskId, linkedTask?.description]);

  // Auto-save task description with debounce - much faster now
  useEffect(() => {
    // Skip if initial load
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      return;
    }

    // Skip if sync disabled or no task
    if (!syncTaskDescription || !selectedTaskId) {
      return;
    }

    // Skip if content hasn't actually changed
    if (taskDescriptionContent === lastSavedContentRef.current) {
      return;
    }

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    setAutoSaveStatus('saving');

    // Faster debounce: 300ms
    autoSaveTimeoutRef.current = setTimeout(() => {
      updateTask(selectedTaskId, { description: taskDescriptionContent });
      lastSavedContentRef.current = taskDescriptionContent;
      lastKnownTaskDescriptionRef.current = taskDescriptionContent; // Track what we saved
      setLastSavedTime(new Date());
      setAutoSaveStatus('saved');

      // Keep "saved" status visible for 3 seconds
      setTimeout(() => setAutoSaveStatus('idle'), 3000);
    }, 300);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [taskDescriptionContent, syncTaskDescription, selectedTaskId, updateTask]);

  // Track unsaved changes
  useEffect(() => {
    if (isNew) {
      setHasUnsavedChanges(title.trim() !== '' || content !== '' || taskDescriptionContent !== '');
    } else if (doc) {
      const taskDescriptionChanged = syncTaskDescription && linkedTask?.description !== taskDescriptionContent;
      setHasUnsavedChanges(
        title !== doc.title ||
          content !== doc.content ||
          selectedClientId !== doc.clientId ||
          selectedTaskId !== doc.taskId ||
          syncTaskDescription !== doc.syncTaskDescription ||
          taskDescriptionChanged
      );
    }
  }, [
    title,
    content,
    taskDescriptionContent,
    selectedClientId,
    selectedTaskId,
    syncTaskDescription,
    linkedTask?.description,
    doc,
    isNew,
  ]);

  // Handle save
  const handleSave = useCallback(() => {
    if (!title.trim() || !selectedClientId) return;

    // Clear previous error
    setSizeError(null);

    const docData = {
      title: title.trim(),
      content,
      clientId: selectedClientId,
      taskId: selectedTaskId,
      syncTaskDescription,
    };

    try {
      if (isNew) {
        addDocument(docData);
      } else if (doc) {
        updateDocument(doc.id, docData);
      }

      // Task description is auto-saved, but save one final time to ensure latest changes
      if (syncTaskDescription && selectedTaskId && taskDescriptionContent) {
        updateTask(selectedTaskId, { description: taskDescriptionContent });
      }

      onClose();
    } catch (error) {
      if (error instanceof DocumentSizeError) {
        setSizeError(error.message);
      } else {
        setSizeError('Ein unbekannter Fehler ist aufgetreten. Bitte versuche es erneut.');
        console.error('Document save error:', error);
      }
    }
  }, [
    title,
    content,
    selectedClientId,
    selectedTaskId,
    syncTaskDescription,
    taskDescriptionContent,
    isNew,
    doc,
    addDocument,
    updateDocument,
    updateTask,
    onClose,
  ]);

  // Handle delete
  const handleDelete = useCallback(() => {
    if (doc) {
      deleteDocument(doc.id);
      onClose();
    }
  }, [doc, deleteDocument, onClose]);

  // Handle close with unsaved changes warning
  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      if (
        window.confirm(
          'Du hast ungespeicherte Änderungen. Wirklich schliessen?'
        )
      ) {
        onClose();
      }
    } else {
      onClose();
    }
  }, [hasUnsavedChanges, onClose]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleClose]);


  const modalContent = (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center animate-fade-in"
      style={{ zIndex: 10000 }}
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-scale-in mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: client?.color || '#6b7280' }}
            >
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Dokumenttitel..."
                className="text-lg font-semibold bg-transparent border-none outline-none w-full placeholder-gray-400"
                autoFocus={isNew}
              />
              <div className="text-xs text-gray-500">
                {client?.name || 'Kein Kunde'}
                {linkedTask && (
                  <>
                    {' '}
                    &bull;{' '}
                    <span className="text-blue-600">{linkedTask.title}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar for linking */}
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 text-sm">
          {/* Client selector */}
          <select
            value={selectedClientId}
            onChange={(e) => {
              setSelectedClientId(e.target.value);
              setSelectedTaskId(undefined); // Reset task when client changes
            }}
            className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm"
          >
            {clients
              .filter((c) => c.isActive)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>

          {/* Task linker */}
          <div className="flex items-center gap-1">
            <select
              value={selectedTaskId || ''}
              onChange={(e) => setSelectedTaskId(e.target.value || undefined)}
              className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm"
            >
              <option value="">Keine Aufgabe</option>
              {clientTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>

            {selectedTaskId && (
              <button
                onClick={() => setSelectedTaskId(undefined)}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                title="Verknüpfung entfernen"
              >
                <Unlink className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Sync toggle */}
          {selectedTaskId && (
            <div className="flex items-center gap-2 ml-auto">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncTaskDescription}
                  onChange={(e) => setSyncTaskDescription(e.target.checked)}
                  className="rounded"
                />
                <span className="text-gray-600">Mit Aufgabe synchronisieren</span>
              </label>
              <RefreshCw className={`w-4 h-4 ${syncTaskDescription ? 'text-blue-600' : 'text-gray-300'}`} />
            </div>
          )}
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-y-auto">
          {/* Synchronized Task Description Section */}
          {syncTaskDescription && selectedTaskId && (
            <div className="border-b-2 border-blue-200 bg-blue-50/30">
              <div className="px-4 py-2 flex items-center justify-between text-xs border-b border-blue-100">
                <div className="flex items-center gap-2 text-blue-600">
                  <Link2 className="w-3 h-3" />
                  <span className="font-medium">Aufgabenbeschreibung</span>
                </div>
                <div className="flex items-center gap-2">
                  {autoSaveStatus === 'saving' && (
                    <span className="text-amber-600 flex items-center gap-1.5 bg-amber-50 px-2 py-1 rounded-full">
                      <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                      Speichert...
                    </span>
                  )}
                  {autoSaveStatus === 'saved' && (
                    <span className="text-green-600 flex items-center gap-1.5 bg-green-50 px-2 py-1 rounded-full">
                      <Check className="w-3 h-3" />
                      Gespeichert
                      {lastSavedTime && (
                        <span className="text-green-500 text-[10px]">
                          {lastSavedTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </span>
                  )}
                  {autoSaveStatus === 'idle' && lastSavedTime && (
                    <span className="text-gray-400 flex items-center gap-1.5">
                      <RefreshCw className="w-3 h-3" />
                      Zuletzt: {lastSavedTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>
              <div className="p-4">
                <TaskDescriptionEditor
                  content={taskDescriptionContent}
                  onChange={setTaskDescriptionContent}
                  placeholder="Aufgabenbeschreibung eingeben..."
                />
              </div>
            </div>
          )}

          {/* Main Document Content */}
          <DocumentEditor
            content={content}
            onChange={setContent}
            placeholder={syncTaskDescription
              ? "Dokument-Inhalt (wird nicht mit Aufgabe synchronisiert)..."
              : "Beginne zu schreiben... Verwende Markdown wie # für Überschriften"
            }
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
          <div>
            {isNew ? (
              // Bei neuem Dokument: Verwerfen-Button
              <button
                onClick={onClose}
                className="px-3 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all text-sm"
              >
                Verwerfen
              </button>
            ) : (
              // Bei bestehendem Dokument: Löschen-Button
              <>
                {showDeleteConfirm ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-red-600">
                      Wirklich löschen?
                    </span>
                    <button
                      onClick={handleDelete}
                      className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
                    >
                      Ja
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300 transition-colors"
                    >
                      Nein
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-xl transition-all text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    Löschen
                  </button>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            {sizeError && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-1.5 rounded-lg">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{sizeError}</span>
              </div>
            )}
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-all text-sm"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              disabled={!title.trim() || !selectedClientId}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm btn-press"
            >
              <Save className="w-4 h-4" />
              {isNew ? 'Erstellen' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
