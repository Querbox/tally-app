import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSettingsStore } from '../../stores/settingsStore';
import { Download, X, Sparkles, RefreshCw, CheckCircle } from 'lucide-react';
import { isTauri } from '../../lib/fileStorage';

interface UpdateModalProps {
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UpdateModal({ onClose }: UpdateModalProps) {
  const appVersion = useSettingsStore((s) => s.appVersion);
  const dismissedVersion = useSettingsStore((s) => s.dismissedVersion);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [update, setUpdate] = useState<any>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadTotal, setDownloadTotal] = useState(0);
  const [downloadPhase, setDownloadPhase] = useState<'downloading' | 'installing' | 'done'>('downloading');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateRef = useRef<any>(null);

  useEffect(() => {
    checkForUpdates();
    return () => {
      if (updateRef.current) {
        updateRef.current.close?.().catch(() => {});
      }
    };
  }, []);

  const checkForUpdates = async () => {
    setChecking(true);
    setError(null);

    try {
      if (!isTauri()) {
        setUpdate(null);
        setChecking(false);
        updateSettings({ lastUpdateCheck: new Date().toISOString() });
        return;
      }

      const { check } = await import('@tauri-apps/plugin-updater');
      const result = await check();

      if (result) {
        if (dismissedVersion === result.version) {
          setUpdate(null);
        } else {
          setUpdate(result);
          updateRef.current = result;
        }
      } else {
        setUpdate(null);
      }
    } catch (err) {
      console.error('Update check failed:', err);
      const message = err instanceof Error ? err.message : '';
      if (message.includes('fetch') || message.includes('network') || message.includes('connect')) {
        setError('Keine Internetverbindung');
      } else {
        setUpdate(null);
      }
    } finally {
      setChecking(false);
      updateSettings({ lastUpdateCheck: new Date().toISOString() });
    }
  };

  const handleDismiss = () => {
    if (update) {
      updateSettings({ dismissedVersion: update.version });
    }
    onClose();
  };

  const handleDownload = async () => {
    if (!update) return;

    setDownloading(true);
    setDownloadProgress(0);
    setDownloadTotal(0);
    setDownloadPhase('downloading');
    setError(null);

    try {
      await update.downloadAndInstall((event: { event: string; data: { contentLength?: number; chunkLength?: number } }) => {
        switch (event.event) {
          case 'Started':
            setDownloadTotal(event.data.contentLength ?? 0);
            break;
          case 'Progress':
            setDownloadProgress((prev: number) => prev + (event.data.chunkLength ?? 0));
            break;
          case 'Finished':
            setDownloadPhase('installing');
            break;
        }
      });

      setDownloadPhase('done');

      const { relaunch } = await import('@tauri-apps/plugin-process');
      setTimeout(async () => {
        await relaunch();
      }, 1500);
    } catch (err) {
      console.error('Update download/install failed:', err);
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
      setDownloading(false);
      setDownloadPhase('downloading');

      if (message.includes('signature')) {
        setError('Update-Signatur ungültig. Bitte versuche es später erneut.');
      } else if (message.includes('network') || message.includes('fetch')) {
        setError('Download fehlgeschlagen. Prüfe deine Internetverbindung.');
      } else {
        setError(`Update fehlgeschlagen: ${message}`);
      }
    }
  };

  const progressPercent = downloadTotal > 0
    ? Math.min(100, Math.round((downloadProgress / downloadTotal) * 100))
    : null;

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center animate-fade-in"
      style={{ zIndex: 9999 }}
      onClick={downloading ? undefined : onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Updates</h2>
              <p className="text-xs text-gray-500">Aktuelle Version: {appVersion}</p>
            </div>
          </div>
          {!downloading && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-xl transition-all duration-200 btn-press"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {checking ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-gray-500">Suche nach Updates...</p>
            </div>
          ) : error && !downloading ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <RefreshCw className="w-8 h-8 text-yellow-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Verbindungsproblem</h3>
              <p className="text-sm text-gray-500 mb-4">{error}</p>
              <button
                onClick={checkForUpdates}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
              >
                Erneut versuchen
              </button>
            </div>
          ) : downloading ? (
            <div className="space-y-4 py-4">
              <div className="text-center">
                {downloadPhase === 'done' ? (
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                ) : (
                  <div className="w-12 h-12 border-3 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
                )}
                <h3 className="font-semibold text-gray-900">
                  {downloadPhase === 'downloading'
                    ? 'Update wird heruntergeladen...'
                    : downloadPhase === 'installing'
                      ? 'Update wird installiert...'
                      : 'Update installiert!'}
                </h3>
                {downloadPhase === 'done' && (
                  <p className="text-sm text-gray-500 mt-1">
                    Tally wird neu gestartet...
                  </p>
                )}
              </div>

              {downloadPhase === 'downloading' && (
                <>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-purple-600 h-full rounded-full transition-all duration-300 ease-out"
                      style={{
                        width: progressPercent !== null ? `${progressPercent}%` : '30%',
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>{formatBytes(downloadProgress)}</span>
                    {downloadTotal > 0 && (
                      <span>{progressPercent}% von {formatBytes(downloadTotal)}</span>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : update ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    Version {update.version} verfügbar!
                  </h3>
                  {update.date && (
                    <p className="text-xs text-gray-500">
                      Veröffentlicht am{' '}
                      {new Date(update.date).toLocaleDateString('de-DE', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  )}
                </div>
                <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full animate-pulse">
                  Neu
                </span>
              </div>

              {update.body && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Was ist neu?</h4>
                  <p className="text-sm text-gray-600">{update.body}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleDismiss}
                  className="flex-1 px-4 py-3 text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200 text-sm font-medium btn-press"
                >
                  Später
                </button>
                <button
                  onClick={handleDownload}
                  className="flex-1 px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all duration-200 text-sm font-medium flex items-center justify-center gap-2 btn-press"
                >
                  <Download className="w-4 h-4" />
                  Installieren
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Alles aktuell!</h3>
              <p className="text-sm text-gray-500">
                Du verwendest bereits die neueste Version von Tally.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {!checking && !update && !error && !downloading && (
          <div className="px-6 pb-6 space-y-2">
            <button
              onClick={checkForUpdates}
              className="w-full px-4 py-3 text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200 text-sm font-medium btn-press flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Erneut prüfen
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

// Hintergrund-Check beim App-Start (gibt true zurück wenn Update verfügbar)
export async function checkForUpdatesInBackground(): Promise<boolean> {
  try {
    if (!isTauri()) return false;

    const { dismissedVersion, updateSettings } = useSettingsStore.getState();
    const { check } = await import('@tauri-apps/plugin-updater');

    const result = await check();

    updateSettings({ lastUpdateCheck: new Date().toISOString() });

    if (result && dismissedVersion !== result.version) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
