import type { Document } from '../../types';
import { useTaskStore } from '../../stores/taskStore';
import { FileText, Link2, Clock } from 'lucide-react';

interface DocumentCardProps {
  document: Document;
  onClick: () => void;
}

// Extrahiert den ersten Text aus dem TipTap JSON
function extractPreview(content: string, maxLength: number = 100): string {
  try {
    const parsed = JSON.parse(content);
    const extractText = (node: { type?: string; content?: unknown[]; text?: string }): string => {
      if (node.type === 'text') return node.text || '';
      if (node.content) {
        return node.content
          .map((n) => extractText(n as { type?: string; content?: unknown[]; text?: string }))
          .join(' ');
      }
      return '';
    };

    const text = extractText(parsed).trim();
    if (text.length > maxLength) {
      return text.substring(0, maxLength) + '...';
    }
    return text || 'Kein Inhalt';
  } catch {
    return 'Kein Inhalt';
  }
}

// Formatiert das Datum relativ
function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Gerade eben';
  if (diffMins < 60) return `Vor ${diffMins} Min.`;
  if (diffHours < 24) return `Vor ${diffHours} Std.`;
  if (diffDays < 7) return `Vor ${diffDays} Tagen`;

  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function DocumentCard({ document, onClick }: DocumentCardProps) {
  const tasks = useTaskStore((s) => s.tasks);
  const clients = useTaskStore((s) => s.clients);
  const linkedTask = document.taskId
    ? tasks.find((t) => t.id === document.taskId)
    : undefined;
  const client = clients.find((c) => c.id === document.clientId);

  const preview = extractPreview(document.content);

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 hover:shadow-sm transition-all card-hover group"
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: client?.color || '#6b7280' }}
        >
          <FileText className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">
            {document.title || 'Unbenannt'}
          </h3>
          {linkedTask && (
            <div className="flex items-center gap-1 text-xs text-blue-600 mt-0.5">
              <Link2 className="w-3 h-3" />
              <span className="truncate">{linkedTask.title}</span>
            </div>
          )}
        </div>
      </div>

      {/* Preview */}
      <p className="text-sm text-gray-500 line-clamp-2 mb-3">{preview}</p>

      {/* Footer */}
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <Clock className="w-3 h-3" />
        <span>{formatRelativeDate(document.updatedAt)}</span>
        {document.syncTaskDescription && (
          <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-xs ml-auto">
            Sync
          </span>
        )}
      </div>
    </button>
  );
}
