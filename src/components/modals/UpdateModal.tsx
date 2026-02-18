import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSettingsStore } from '../../stores/settingsStore';
import { Download, X, Sparkles, RefreshCw } from 'lucide-react';

// Update-Server URL (GitHub Raw)
const UPDATE_URL = 'https://raw.githubusercontent.com/Querbox/tally-app/main/update/latest.json';

interface UpdateInfo {
  version: string;
  releaseDate: string;
  changelog: string[];
  downloadUrl: string;
  minimumVersion?: string;
}

interface UpdateModalProps {
  onClose: () => void;
}

// Vergleicht zwei Versionsnummern (z.B. "1.0.0" vs "1.1.0")
function compareVersions(current: string, latest: string): number {
  const currentParts = current.split('.').map(Number);
  const latestParts = latest.split('.').map(Number);

  for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
    const c = currentParts[i] || 0;
    const l = latestParts[i] || 0;
    if (l > c) return 1; // Update verfügbar
    if (l < c) return -1; // Aktuelle Version ist neuer
  }
  return 0; // Gleiche Version
}

export function UpdateModal({ onClose }: UpdateModalProps) {
  const appVersion = useSettingsStore((s) => s.appVersion);
  const dismissedVersion = useSettingsStore((s) => s.dismissedVersion);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkForUpdates();
  }, []);

  const checkForUpdates = async () => {
    setChecking(true);
    setError(null);

    try {
      // Füge Timestamp hinzu um Cache zu umgehen
      const url = `${UPDATE_URL}?t=${Date.now()}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Server antwortete mit Status ${response.status}`);
      }

      const data: UpdateInfo = await response.json();

      // Prüfe ob Update verfügbar ist
      const comparison = compareVersions(appVersion, data.version);

      if (comparison > 0) {
        // Prüfe ob diese Version bereits abgelehnt wurde
        if (dismissedVersion === data.version) {
          setUpdateInfo(null); // Bereits abgelehnt
        } else {
          setUpdateInfo(data);
        }
      } else {
        setUpdateInfo(null); // Kein Update verfügbar
      }
    } catch (err) {
      console.error('Update check failed:', err);
      // Bei Fehler zeigen wir "Alles aktuell" an statt einen Fehler
      // Das ist benutzerfreundlicher
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('Keine Internetverbindung');
      } else {
        // Stille Fehlerbehandlung - zeige einfach "Alles aktuell"
        setUpdateInfo(null);
      }
    } finally {
      setChecking(false);
      updateSettings({ lastUpdateCheck: new Date().toISOString() });
    }
  };

  const handleDismiss = () => {
    if (updateInfo) {
      updateSettings({ dismissedVersion: updateInfo.version });
    }
    onClose();
  };

  const handleDownload = () => {
    if (updateInfo?.downloadUrl) {
      setDownloading(true);
      // Öffne Download-URL im Browser
      window.open(updateInfo.downloadUrl, '_blank');
      setTimeout(() => {
        setDownloading(false);
        onClose();
      }, 1000);
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center animate-fade-in"
      style={{ zIndex: 9999 }}
      onClick={onClose}
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
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-all duration-200 btn-press"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {checking ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-gray-500">Suche nach Updates...</p>
            </div>
          ) : error ? (
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
          ) : updateInfo ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    Version {updateInfo.version} verfügbar!
                  </h3>
                  <p className="text-xs text-gray-500">
                    Veröffentlicht am{' '}
                    {new Date(updateInfo.releaseDate).toLocaleDateString('de-DE', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full animate-pulse">
                  Neu
                </span>
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Was ist neu?</h4>
                <ul className="space-y-1.5">
                  {updateInfo.changelog.map((item, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-green-500 mt-0.5">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleDismiss}
                  className="flex-1 px-4 py-3 text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200 text-sm font-medium btn-press"
                >
                  Später
                </button>
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="flex-1 px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all duration-200 text-sm font-medium flex items-center justify-center gap-2 btn-press disabled:opacity-50"
                >
                  {downloading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Herunterladen
                    </>
                  )}
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
        {!checking && !updateInfo && !error && (
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

// Exportiere auch eine Funktion für den automatischen Check beim App-Start
export async function checkForUpdatesInBackground(): Promise<UpdateInfo | null> {
  try {
    const { appVersion, dismissedVersion, updateSettings } = useSettingsStore.getState();

    const url = `${UPDATE_URL}?t=${Date.now()}`;
    const response = await fetch(url);

    if (!response.ok) return null;

    const data: UpdateInfo = await response.json();
    const comparison = compareVersions(appVersion, data.version);

    updateSettings({ lastUpdateCheck: new Date().toISOString() });

    if (comparison > 0 && dismissedVersion !== data.version) {
      return data;
    }

    return null;
  } catch {
    return null;
  }
}
