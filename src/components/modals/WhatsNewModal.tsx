import { createPortal } from 'react-dom';
import { X, Sparkles } from 'lucide-react';
import { RELEASES, getNewReleases, CURRENT_VERSION, type Release } from '../../data/releases';

/**
 * WHAT'S NEW MODAL
 * ================
 *
 * Zeigt Änderungen seit der letzten gesehenen Version.
 * Nutzt die zentrale Release-Definition aus data/releases.ts.
 *
 * Design-Prinzipien:
 * - Kompakt und übersichtlich
 * - Maximal 2-3 Highlights pro Version
 * - Kein Durchklicken durch einzelne Features
 * - Schnell schließbar
 *
 * Tonalität:
 * - Informativ, nicht werblich
 * - Kurz und prägnant
 * - Vertrauensvoll
 */

interface WhatsNewModalProps {
  onClose: () => void;
  currentVersion: string;
  lastSeenVersion: string | null;
}

function ReleaseCard({ release, isFirst }: { release: Release; isFirst: boolean }) {
  return (
    <div className={`${isFirst ? '' : 'pt-4 border-t border-gray-100'}`}>
      {/* Version Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-medium text-gray-400">
          v{release.version}
        </span>
        {release.title && (
          <>
            <span className="text-gray-300">·</span>
            <span className="text-xs text-gray-500">{release.title}</span>
          </>
        )}
        {isFirst && (
          <span className="ml-auto px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
            Neu
          </span>
        )}
      </div>

      {/* Highlights */}
      <ul className="space-y-2">
        {release.highlights.map((highlight, index) => (
          <li
            key={index}
            className="flex items-start gap-2.5 text-sm text-gray-600"
          >
            <span className="text-base leading-5 flex-shrink-0">
              {highlight.emoji || '✓'}
            </span>
            <span>{highlight.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WhatsNewModal({
  onClose,
  currentVersion: _currentVersion,
  lastSeenVersion,
}: WhatsNewModalProps) {
  // currentVersion wird für Abwärtskompatibilität akzeptiert, aber CURRENT_VERSION aus releases.ts verwendet
  void _currentVersion;
  // Hole neue Releases seit letzter gesehener Version
  const newReleases = getNewReleases(lastSeenVersion);

  // Fallback: Zeige aktuelle Version wenn keine neuen gefunden
  const releasesToShow = newReleases.length > 0
    ? newReleases.slice(0, 3) // Maximal 3 Versionen zeigen
    : RELEASES.filter(r => r.version === CURRENT_VERSION);

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center animate-fade-in"
      style={{ zIndex: 99999 }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-in mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative">
          <div className="h-24 bg-gradient-to-br from-violet-500 to-purple-600 relative overflow-hidden">
            {/* Decorative */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full" />
            <div className="absolute -bottom-16 -left-8 w-48 h-48 bg-white/5 rounded-full" />

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-all text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Icon */}
          <div className="absolute -bottom-6 left-6">
            <div className="w-12 h-12 bg-white rounded-xl shadow-lg flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-violet-600" />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="pt-10 px-6 pb-6">
          {/* Title */}
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-gray-900">
              Was ist neu?
            </h2>
            <p className="text-sm text-gray-500">
              {releasesToShow.length === 1
                ? `Version ${releasesToShow[0].version}`
                : `${releasesToShow.length} Updates seit deinem letzten Besuch`}
            </p>
          </div>

          {/* Releases */}
          <div className="space-y-4 max-h-[50vh] overflow-y-auto">
            {releasesToShow.map((release, index) => (
              <ReleaseCard
                key={release.version}
                release={release}
                isFirst={index === 0}
              />
            ))}
          </div>

          {/* Footer */}
          <div className="mt-6">
            <button
              onClick={onClose}
              className="w-full px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all text-sm font-medium btn-press"
            >
              Verstanden
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

// Re-export für Abwärtskompatibilität (falls irgendwo RELEASES importiert wird)
export { RELEASES };
