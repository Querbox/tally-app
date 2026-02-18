import { useState, useMemo, lazy, Suspense } from 'react';
import { DocumentCard } from './DocumentCard';
import { useDocumentStore } from '../../stores/documentStore';
import type { Document } from '../../types';
import { Plus, FileText, ArrowUpDown, ArrowUp, ArrowDown, SortAsc, Loader2 } from 'lucide-react';

// Lazy load DocumentModal (enthält den schweren TipTap Editor)
const DocumentModal = lazy(() => import('./DocumentModal').then(m => ({ default: m.DocumentModal })));

// Loading-Spinner für das Modal
function ModalLoadingSpinner() {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center" style={{ zIndex: 10000 }}>
      <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl">
        <Loader2 className="w-8 h-8 text-gray-600 animate-spin" />
        <p className="text-sm text-gray-600">Editor wird geladen...</p>
      </div>
    </div>
  );
}

type SortOption = 'newest' | 'oldest' | 'alphabetical' | 'recently_updated';

const SORT_OPTIONS: { value: SortOption; label: string; icon: typeof ArrowUp }[] = [
  { value: 'recently_updated', label: 'Zuletzt bearbeitet', icon: ArrowDown },
  { value: 'newest', label: 'Neueste zuerst', icon: ArrowDown },
  { value: 'oldest', label: 'Älteste zuerst', icon: ArrowUp },
  { value: 'alphabetical', label: 'Alphabetisch', icon: SortAsc },
];

interface DocumentListProps {
  clientId?: string;
  taskId?: string;
  compact?: boolean;
  showCreateButton?: boolean;
}

export function DocumentList({
  clientId,
  taskId,
  compact = false,
  showCreateButton = true,
}: DocumentListProps) {
  const { documents } = useDocumentStore();
  const [sortOption, setSortOption] = useState<SortOption>('recently_updated');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [showNewDocument, setShowNewDocument] = useState(false);

  // Filter documents
  const filteredDocuments = useMemo(() => {
    let filtered = documents;

    if (clientId) {
      filtered = filtered.filter((d) => d.clientId === clientId);
    }

    if (taskId) {
      filtered = filtered.filter((d) => d.taskId === taskId);
    }

    return filtered;
  }, [documents, clientId, taskId]);

  // Sort documents
  const sortedDocuments = useMemo(() => {
    const sorted = [...filteredDocuments];

    switch (sortOption) {
      case 'newest':
        return sorted.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      case 'oldest':
        return sorted.sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      case 'alphabetical':
        return sorted.sort((a, b) => a.title.localeCompare(b.title, 'de'));
      case 'recently_updated':
      default:
        return sorted.sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
    }
  }, [filteredDocuments, sortOption]);

  const activeSort = SORT_OPTIONS.find((s) => s.value === sortOption);

  // Empty state
  if (sortedDocuments.length === 0 && !showNewDocument) {
    return (
      <div className={compact ? 'py-4' : 'py-8'}>
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
            <FileText className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-sm text-gray-500 mb-3">
            {taskId
              ? 'Keine Dokumente für diese Aufgabe'
              : 'Noch keine Dokumente'}
          </p>
          {showCreateButton && clientId && (
            <button
              onClick={() => setShowNewDocument(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all text-sm btn-press"
            >
              <Plus className="w-4 h-4" />
              Neues Dokument
            </button>
          )}
        </div>

        {/* New Document Modal - Lazy Loaded */}
        {showNewDocument && clientId && (
          <Suspense fallback={<ModalLoadingSpinner />}>
            <DocumentModal
              doc={null}
              clientId={clientId}
              taskId={taskId}
              onClose={() => setShowNewDocument(false)}
              isNew
            />
          </Suspense>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Header with sort and create */}
      {!compact && (
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-gray-500">
            {sortedDocuments.length} Dokument{sortedDocuments.length !== 1 ? 'e' : ''}
          </div>

          <div className="flex items-center gap-2">
            {/* Sort Button */}
            <div className="relative">
              <button
                onClick={() => setShowSortMenu(!showSortMenu)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
              >
                <ArrowUpDown className="w-4 h-4" />
                <span className="hidden sm:inline">{activeSort?.label}</span>
              </button>

              {showSortMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowSortMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-200 py-1 min-w-[180px] z-50 animate-scale-in">
                    {SORT_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      return (
                        <button
                          key={option.value}
                          onClick={() => {
                            setSortOption(option.value);
                            setShowSortMenu(false);
                          }}
                          className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors ${
                            sortOption === option.value ? 'bg-gray-50' : ''
                          }`}
                        >
                          <Icon className="w-4 h-4 text-gray-400" />
                          <span>{option.label}</span>
                          {sortOption === option.value && (
                            <span className="ml-auto text-gray-400">&#10003;</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Create Button */}
            {showCreateButton && clientId && (
              <button
                onClick={() => setShowNewDocument(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-all text-sm btn-press"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Neu</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Compact header for task view */}
      {compact && showCreateButton && clientId && (
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-500">
            {sortedDocuments.length} Dokument{sortedDocuments.length !== 1 ? 'e' : ''}
          </span>
          <button
            onClick={() => setShowNewDocument(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
          >
            <Plus className="w-3 h-3" />
            Hinzufügen
          </button>
        </div>
      )}

      {/* Document Grid/List */}
      <div
        className={
          compact
            ? 'space-y-2'
            : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
        }
      >
        {sortedDocuments.map((doc) => (
          <DocumentCard
            key={doc.id}
            document={doc}
            onClick={() => setSelectedDocument(doc)}
          />
        ))}
      </div>

      {/* Document Modal - Lazy Loaded */}
      {selectedDocument && (
        <Suspense fallback={<ModalLoadingSpinner />}>
          <DocumentModal
            doc={selectedDocument}
            clientId={selectedDocument.clientId}
            taskId={selectedDocument.taskId}
            onClose={() => setSelectedDocument(null)}
          />
        </Suspense>
      )}

      {/* New Document Modal - Lazy Loaded */}
      {showNewDocument && clientId && (
        <Suspense fallback={<ModalLoadingSpinner />}>
          <DocumentModal
            doc={null}
            clientId={clientId}
            taskId={taskId}
            onClose={() => setShowNewDocument(false)}
            isNew
          />
        </Suspense>
      )}
    </div>
  );
}
