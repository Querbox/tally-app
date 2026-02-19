import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Loader2, Lightbulb, Bug, Heart, CheckCircle } from 'lucide-react';
import { isTauri } from '../../lib/fileStorage';
import { CURRENT_VERSION } from '../../data/releases';
import { useToast } from '../common/Toast';

type FeedbackType = 'feature' | 'bug' | 'feedback';

interface FeedbackModalProps {
  feedbackType: FeedbackType;
  onClose: () => void;
}

interface FeedbackResult {
  success: boolean;
  issue_number?: number;
  issue_url?: string;
  error?: string;
}

const FEEDBACK_CONFIG = {
  feature: {
    label: 'Feature-Idee',
    icon: Lightbulb,
    iconColor: 'text-amber-500',
    bgColor: 'bg-amber-100',
    titlePrefix: '[Feature] ',
    placeholder: 'Beschreibe deine Idee...',
    template: '',
  },
  bug: {
    label: 'Bug melden',
    icon: Bug,
    iconColor: 'text-red-500',
    bgColor: 'bg-red-100',
    titlePrefix: '[Bug] ',
    placeholder: 'Beschreibe den Bug...',
    template: `**Beschreibung:**


**Schritte zum Reproduzieren:**
1.
2.
3.

**Erwartetes Verhalten:**


**Tatsächliches Verhalten:**

`,
  },
  feedback: {
    label: 'Feedback',
    icon: Heart,
    iconColor: 'text-pink-500',
    bgColor: 'bg-pink-100',
    titlePrefix: '[Feedback] ',
    placeholder: 'Dein Feedback...',
    template: '',
  },
} as const;

export function FeedbackModal({ feedbackType, onClose }: FeedbackModalProps) {
  const config = FEEDBACK_CONFIG[feedbackType];
  const Icon = config.icon;
  const { success: toastSuccess, error: toastError } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState<string>(config.template);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose, isSubmitting]);

  const handleSubmit = async () => {
    if (!title.trim()) return;

    if (!isTauri()) {
      // Fallback für Browser-Dev-Modus
      const subject = encodeURIComponent(`Tally ${config.label}: ${title}`);
      const body = encodeURIComponent(description);
      window.open(`mailto:feedback@querbox.de?subject=${subject}&body=${body}`, '_blank');
      onClose();
      return;
    }

    setIsSubmitting(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<FeedbackResult>('submit_feedback', {
        feedbackType,
        title: `${config.titlePrefix}${title}`,
        description,
        appVersion: CURRENT_VERSION,
      });

      if (result.success) {
        setSubmitted(true);
        toastSuccess('Feedback gesendet – vielen Dank!');
        setTimeout(() => onClose(), 1500);
      } else {
        toastError(result.error || 'Feedback konnte nicht gesendet werden.');
        setIsSubmitting(false);
      }
    } catch {
      toastError('Keine Verbindung möglich. Bitte versuche es später erneut.');
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center animate-fade-in"
      style={{ zIndex: 9999 }}
      onClick={isSubmitting ? undefined : onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-in mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 ${config.bgColor} rounded-xl flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${config.iconColor}`} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{config.label}</h2>
              <p className="text-xs text-gray-500">Wird als GitHub Issue erstellt</p>
            </div>
          </div>
          {!isSubmitting && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-xl transition-all duration-200 btn-press"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {submitted ? (
            <div className="text-center py-6">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-1">Danke für dein Feedback!</h3>
              <p className="text-sm text-gray-500">Dein Feedback wurde erfolgreich gesendet.</p>
            </div>
          ) : (
            <>
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titel</label>
                <input
                  ref={titleRef}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={feedbackType === 'feature' ? 'Meine Feature-Idee...' : feedbackType === 'bug' ? 'Kurze Beschreibung des Bugs...' : 'Betreff...'}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300 transition-all"
                  disabled={isSubmitting}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && title.trim()) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={config.placeholder}
                  rows={feedbackType === 'bug' ? 10 : 5}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300 transition-all resize-none"
                  disabled={isSubmitting}
                />
              </div>

              {/* Privacy note */}
              <p className="text-xs text-gray-400">
                Dein Feedback wird als GitHub Issue erstellt. Es werden nur der Titel, die Beschreibung und die App-Version übertragen.
              </p>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200 text-sm font-medium btn-press"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !title.trim()}
                  className="flex-1 px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-sm font-medium flex items-center justify-center gap-2 btn-press"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Senden...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Absenden
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
