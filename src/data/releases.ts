/**
 * RELEASE DEFINITIONS
 * ====================
 *
 * Zentrale Quelle für alle Release-Informationen.
 *
 * Pflege-Regeln:
 * 1. Maximal 2-3 Highlights pro Version
 * 2. Kurze, klare Sätze (keine Marketing-Sprache)
 * 3. Fokus auf "Was kann ich jetzt tun?" statt "Was haben wir gebaut?"
 * 4. Alte Releases (>5 Versionen) können entfernt werden
 *
 * Tonalität:
 * - Ruhig, nicht aufgeregt
 * - Vertrauensvoll, nicht werblich
 * - Praktisch, nicht technisch
 */

export interface ReleaseHighlight {
  /** Kurze Beschreibung (max 60 Zeichen) */
  text: string;
  /** Optional: Emoji als visueller Anker */
  emoji?: string;
}

export interface Release {
  version: string;
  date: string;
  /** Optionaler Titel (z.B. "Stabilität") - kurz und beschreibend */
  title?: string;
  /** 2-3 Highlights, maximal */
  highlights: ReleaseHighlight[];
}

/**
 * Aktuelle und vergangene Releases.
 * Neueste Version zuerst.
 *
 * WICHTIG: Bei jedem Release:
 * 1. Neue Version hier eintragen
 * 2. appVersion in settingsStore.ts aktualisieren
 * 3. tauri.conf.json Version aktualisieren
 */
export const RELEASES: Release[] = [
  {
    version: '1.3.0',
    date: '2026-02-17',
    title: 'Intelligente Hinweise',
    highlights: [
      { text: 'Hinweise bei oft verschobenen Aufgaben und Deadlines', emoji: '💡' },
      { text: 'Kundenerkennung im Aufgabentitel (Expert-Modus)', emoji: '🏷️' },
      { text: 'Automatische Updates direkt in der App', emoji: '🔄' },
    ],
  },
  {
    version: '1.2.3',
    date: '2025-02-09',
    title: 'Kleine Verbesserungen',
    highlights: [
      { text: 'Fortschrittsbalken im Tagesheader', emoji: '📊' },
      { text: 'Meeting-Countdown zeigt verbleibende Zeit', emoji: '⏰' },
      { text: 'Focus Mode fragt vor dem Beenden', emoji: '🎯' },
    ],
  },
  {
    version: '1.2.2',
    date: '2025-02-08',
    highlights: [
      { text: 'Fehler beim Speichern behoben', emoji: '💾' },
      { text: 'Stabilere Datenmigration', emoji: '🔧' },
    ],
  },
  {
    version: '1.2.1',
    date: '2025-02-04',
    title: 'Datenschutz-Fix',
    highlights: [
      { text: 'Kritischer Bug behoben: Daten bleiben erhalten', emoji: '🛡️' },
      { text: 'Automatische Backups vor dem Speichern', emoji: '💾' },
    ],
  },
  {
    version: '1.2.0',
    date: '2025-02-04',
    title: 'Archiv & Papierkorb',
    highlights: [
      { text: 'Gelöschte Aufgaben können wiederhergestellt werden', emoji: '🗑️' },
      { text: 'Archiv für erledigte Aufgaben', emoji: '📦' },
      { text: 'Erweiterte Suche mit Filtern', emoji: '🔍' },
    ],
  },
  {
    version: '1.1.0',
    date: '2025-02-04',
    title: 'Sichere Speicherung',
    highlights: [
      { text: 'Daten bleiben nach Cache-Löschung erhalten', emoji: '💾' },
      { text: 'What\'s New bei Updates', emoji: '✨' },
    ],
  },
  {
    version: '1.0.0',
    date: '2025-02-03',
    title: 'Erste Version',
    highlights: [
      { text: 'Aufgaben, Meetings, Zeiterfassung', emoji: '✅' },
      { text: 'Alles lokal, kein Cloud-Zwang', emoji: '🔒' },
    ],
  },
];

/**
 * Aktuelle App-Version (muss mit settingsStore übereinstimmen)
 */
export const CURRENT_VERSION = '1.3.0';

/**
 * Vergleicht zwei Versionsnummern.
 * @returns 1 wenn v2 neuer, -1 wenn v1 neuer, 0 wenn gleich
 */
export function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p2 > p1) return 1;
    if (p2 < p1) return -1;
  }
  return 0;
}

/**
 * Gibt alle Releases zurück, die neuer sind als die angegebene Version.
 */
export function getNewReleases(lastSeenVersion: string | null): Release[] {
  if (!lastSeenVersion) {
    // Erststart: Zeige nur aktuelle Version
    return RELEASES.filter(r => r.version === CURRENT_VERSION);
  }

  return RELEASES.filter(r => compareVersions(lastSeenVersion, r.version) > 0);
}

/**
 * Gibt das Release für eine bestimmte Version zurück.
 */
export function getRelease(version: string): Release | undefined {
  return RELEASES.find(r => r.version === version);
}
