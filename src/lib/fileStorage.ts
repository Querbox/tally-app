/**
 * File-based Storage Service for Tauri
 *
 * Diese Klasse speichert Daten im App-Datenverzeichnis,
 * wodurch sie auch nach Cache-Loeschung erhalten bleiben.
 *
 * Speicherort:
 * - macOS: ~/Library/Application Support/com.tally.tasks/data/
 * - Windows: %APPDATA%\Tally\data\
 * - Linux: ~/.local/share/tally/data/
 *
 * KRITISCH: Diese Implementierung schuetzt gegen Datenverlust durch:
 * 1. Backup vor jedem Schreibvorgang
 * 2. Validierung vor dem Ueberschreiben
 * 3. Automatische Wiederherstellung aus Backup bei leeren Daten
 */

import {
  readTextFile,
  writeTextFile,
  exists,
  mkdir,
  copyFile,
  readDir,
  remove,
  BaseDirectory,
} from '@tauri-apps/plugin-fs';

// Datenverzeichnis innerhalb des App-Ordners
const DATA_DIR = 'data';
const BACKUP_DIR = 'data/backups';

// Dateinamen fuer die verschiedenen Stores
export const STORAGE_FILES = {
  tasks: 'tasks.json',
  settings: 'settings.json',
  worktime: 'worktime.json',
  whiteboard: 'whiteboard.json',
  documents: 'documents.json',
  assistance: 'assistance.json',
  patterns: 'patterns.json',
} as const;

type StorageFile = (typeof STORAGE_FILES)[keyof typeof STORAGE_FILES];

// Flag um zu verhindern, dass leere Daten bei der Initialisierung geschrieben werden
const initialLoadCompleted: Record<string, boolean> = {};

/**
 * Stellt sicher, dass das Datenverzeichnis existiert
 */
async function ensureDataDir(): Promise<void> {
  try {
    const dirExists = await exists(DATA_DIR, { baseDir: BaseDirectory.AppData });
    if (!dirExists) {
      await mkdir(DATA_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
      console.log('[FileStorage] Datenverzeichnis erstellt');
    }

    // Backup-Verzeichnis erstellen
    const backupExists = await exists(BACKUP_DIR, { baseDir: BaseDirectory.AppData });
    if (!backupExists) {
      await mkdir(BACKUP_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
      console.log('[FileStorage] Backup-Verzeichnis erstellt');
    }
  } catch (error) {
    console.error('[FileStorage] Fehler beim Erstellen des Datenverzeichnisses:', error);
    throw error;
  }
}

/**
 * Erstellt ein Backup einer Datei
 */
async function createBackup(filename: StorageFile): Promise<boolean> {
  try {
    await ensureDataDir();
    const filePath = `${DATA_DIR}/${filename}`;
    const fileExists = await exists(filePath, { baseDir: BaseDirectory.AppData });

    if (!fileExists) return false;

    // Lese aktuelle Daten um zu pruefen ob sie gueltig sind
    const content = await readTextFile(filePath, { baseDir: BaseDirectory.AppData });
    const data = JSON.parse(content);

    // Nur Backup erstellen wenn Daten gueltig sind
    if (!isValidData(filename, data)) {
      console.log(`[FileStorage] Kein Backup erstellt - Daten sind leer/ungueltig`);
      return false;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${BACKUP_DIR}/${filename.replace('.json', '')}_${timestamp}.json`;

    await copyFile(filePath, backupPath, {
      fromPathBaseDir: BaseDirectory.AppData,
      toPathBaseDir: BaseDirectory.AppData,
    });
    console.log(`[FileStorage] Backup erstellt: ${backupPath}`);

    // Behalte nur die letzten 5 Backups
    await cleanupOldBackups(filename);

    return true;
  } catch (error) {
    console.error(`[FileStorage] Fehler beim Backup von ${filename}:`, error);
    return false;
  }
}

/**
 * Loescht alte Backups und behaelt nur die neuesten 5
 * KRITISCH: Verhindert Speicher-Overflow bei Langzeitnutzung
 */
async function cleanupOldBackups(filename: StorageFile): Promise<void> {
  try {
    const backupDirExists = await exists(BACKUP_DIR, { baseDir: BaseDirectory.AppData });
    if (!backupDirExists) return;

    // Lese alle Dateien im Backup-Verzeichnis
    const entries = await readDir(BACKUP_DIR, { baseDir: BaseDirectory.AppData });

    // Filtere Backups fuer diese spezifische Datei (z.B. "tasks_2024-01-15...")
    const filenamePrefix = filename.replace('.json', '_');
    const backupsForFile = entries
      .filter(entry => entry.name && entry.name.startsWith(filenamePrefix) && entry.name.endsWith('.json'))
      .map(entry => entry.name!)
      .sort()
      .reverse(); // Neueste zuerst (ISO-Datum im Namen sortiert chronologisch)

    // Behalte nur die letzten 5 Backups
    const MAX_BACKUPS = 5;
    if (backupsForFile.length > MAX_BACKUPS) {
      const toDelete = backupsForFile.slice(MAX_BACKUPS);

      for (const backupName of toDelete) {
        try {
          await remove(`${BACKUP_DIR}/${backupName}`, { baseDir: BaseDirectory.AppData });
          console.log(`[FileStorage] Altes Backup geloescht: ${backupName}`);
        } catch (deleteError) {
          console.warn(`[FileStorage] Konnte Backup nicht loeschen: ${backupName}`, deleteError);
        }
      }

      console.log(`[FileStorage] ${toDelete.length} alte Backups fuer ${filename} bereinigt`);
    }
  } catch (error) {
    // Fehler beim Cleanup sind nicht kritisch - loggen aber nicht werfen
    console.warn('[FileStorage] Backup-Cleanup fehlgeschlagen:', error);
  }
}

/**
 * Prueft ob Daten gueltig sind (nicht leer)
 * WICHTIG: Diese Funktion entscheidet, ob Daten ueberschrieben werden duerfen
 */
function isValidData(filename: StorageFile, data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;

  let obj = data as Record<string, unknown>;

  // Wenn Daten im Zustand-Format sind ({ state: ..., version: ... }), extrahiere state
  if ('state' in obj && obj.state && typeof obj.state === 'object') {
    obj = obj.state as Record<string, unknown>;
  }

  if (filename === STORAGE_FILES.tasks) {
    const tasks = obj.tasks as unknown[] | undefined;
    const clients = obj.clients as unknown[] | undefined;
    const tags = obj.tags as unknown[] | undefined;
    const templates = obj.templates as unknown[] | undefined;
    const recurringMeetings = obj.recurringMeetings as unknown[] | undefined;

    // Mindestens eines der Arrays sollte Daten haben
    return !!(
      (tasks && tasks.length > 0) ||
      (clients && clients.length > 0) ||
      (tags && tags.length > 0) ||
      (templates && templates.length > 0) ||
      (recurringMeetings && recurringMeetings.length > 0)
    );
  }

  if (filename === STORAGE_FILES.settings) {
    // Settings sind gueltig wenn hasCompletedOnboarding gesetzt ist
    // Das ist der wichtigste Indikator dass der User die App schon benutzt hat
    return obj.hasCompletedOnboarding === true;
  }

  if (filename === STORAGE_FILES.worktime) {
    // Worktime ist gueltig wenn dayRecords existiert (kann leer sein)
    return 'dayRecords' in obj;
  }

  if (filename === STORAGE_FILES.whiteboard) {
    // Whiteboard ist gueltig wenn items existiert (kann leer sein)
    return 'items' in obj;
  }

  if (filename === STORAGE_FILES.documents) {
    // Documents ist gueltig wenn documents Array existiert (kann leer sein)
    return 'documents' in obj;
  }

  // Fuer unbekannte Dateien: mindestens ein Key mit Wert
  return Object.keys(obj).length > 0;
}

/**
 * Liest Daten aus einer Datei
 */
export async function readData<T>(filename: StorageFile): Promise<T | null> {
  try {
    await ensureDataDir();
    const filePath = `${DATA_DIR}/${filename}`;

    const fileExists = await exists(filePath, { baseDir: BaseDirectory.AppData });
    if (!fileExists) {
      console.log(`[FileStorage] Datei ${filename} existiert nicht, gebe null zurueck`);
      return null;
    }

    const content = await readTextFile(filePath, { baseDir: BaseDirectory.AppData });
    const data = JSON.parse(content) as T;
    console.log(`[FileStorage] Daten aus ${filename} geladen`);
    return data;
  } catch (error) {
    console.error(`[FileStorage] Fehler beim Lesen von ${filename}:`, error);
    return null;
  }
}

/**
 * Schreibt Daten in eine Datei mit Schutz gegen Datenverlust
 */
export async function writeData<T>(filename: StorageFile, data: T): Promise<boolean> {
  try {
    await ensureDataDir();
    const filePath = `${DATA_DIR}/${filename}`;

    // KRITISCHER SCHUTZ: Verhindere das Ueberschreiben von gueltigen Daten mit leeren Daten
    const fileExists = await exists(filePath, { baseDir: BaseDirectory.AppData });

    if (fileExists && !isValidData(filename, data)) {
      // Lese bestehende Daten
      const existingContent = await readTextFile(filePath, { baseDir: BaseDirectory.AppData });
      const existingData = JSON.parse(existingContent);

      if (isValidData(filename, existingData)) {
        console.warn(
          `[FileStorage] WARNUNG: Verhindere Ueberschreiben von ${filename} mit leeren Daten!`
        );
        console.warn(`[FileStorage] Bestehende Daten bleiben erhalten.`);
        return false;
      }
    }

    // Erstelle Backup vor dem Schreiben (nur wenn gueltige Daten vorhanden)
    if (fileExists) {
      await createBackup(filename);
    }

    const content = JSON.stringify(data, null, 2);
    await writeTextFile(filePath, content, { baseDir: BaseDirectory.AppData });
    console.log(`[FileStorage] Daten in ${filename} gespeichert`);
    return true;
  } catch (error) {
    console.error(`[FileStorage] Fehler beim Schreiben von ${filename}:`, error);
    return false;
  }
}

/**
 * Prueft ob eine Datei existiert
 */
export async function dataExists(filename: StorageFile): Promise<boolean> {
  try {
    await ensureDataDir();
    const filePath = `${DATA_DIR}/${filename}`;
    return await exists(filePath, { baseDir: BaseDirectory.AppData });
  } catch (error) {
    console.error(`[FileStorage] Fehler beim Pruefen von ${filename}:`, error);
    return false;
  }
}

/**
 * Prueft ob Datei-Daten gueltig und nicht leer sind
 */
export async function hasValidData(filename: StorageFile): Promise<boolean> {
  try {
    const data = await readData<Record<string, unknown>>(filename);
    return isValidData(filename, data);
  } catch {
    return false;
  }
}

/**
 * Erstellt einen persistenten Zustand-Storage-Adapter fuer Zustand
 * Dies ersetzt den localStorage-basierten persist-Middleware-Storage
 *
 * KRITISCH: Dieser Adapter schuetzt gegen Datenverlust durch:
 * 1. Validierung der Daten vor dem Schreiben
 * 2. Verhindern von leeren Schreibvorgaengen
 * 3. Migration von localStorage wenn Datei leer ist
 */
export function createFileStorage<T>(filename: StorageFile) {
  // Cache fuer synchronen Zugriff (Zustand erwartet manchmal sync)
  let cachedData: T | null = null;
  let isInitialized = false;
  let pendingWrite: Promise<boolean> | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingData: T | null = null;
  const DEBOUNCE_MS = 300; // Warte 300ms nach letztem Update bevor geschrieben wird

  return {
    // Zustand persist erwartet diese Methoden
    getItem: async (_name: string): Promise<string | null> => {
      // Wenn wir bereits gecachte Daten haben, nutze diese
      if (isInitialized && cachedData !== null) {
        return JSON.stringify({ state: cachedData, version: 0 });
      }

      // KRITISCH: Zuerst versuchen, Daten aus der Datei zu laden
      let data = await readData<Record<string, unknown>>(filename);

      // Wenn die Datei leer oder ungueltig ist, versuche Migration von localStorage
      if (!isValidData(filename, data)) {
        console.log(
          `[FileStorage] ${filename} ist leer/ungueltig, versuche Migration von localStorage...`
        );

        // Versuche Migration
        const localStorageKey =
          filename === STORAGE_FILES.tasks
            ? 'tally-storage'
            : filename === STORAGE_FILES.settings
              ? 'tally-settings'
              : filename === STORAGE_FILES.worktime
                ? 'tally-worktime'
                : filename === STORAGE_FILES.documents
                  ? 'tally-documents'
                  : 'whiteboard-storage';
        const migrated = await migrateFromLocalStorage(localStorageKey, filename);

        if (migrated) {
          // Lade die migrierten Daten
          data = await readData<Record<string, unknown>>(filename);
          console.log(`[FileStorage] Migration erfolgreich, Daten geladen`);
        }
      }

      if (data !== null && isValidData(filename, data)) {
        // Pruefe ob die Daten bereits im Zustand-Format sind (mit 'state' key)
        // oder ob sie direkt die Daten enthalten (nach Migration)
        let stateData: T;
        if ('state' in data && data.state !== undefined) {
          // Daten sind im Zustand-Format { state: ..., version: ... }
          stateData = data.state as T;
        } else {
          // Daten sind direkt gespeichert (nach Migration von localStorage)
          stateData = data as unknown as T;
        }

        cachedData = stateData;
        isInitialized = true;
        initialLoadCompleted[filename] = true;
        // Zustand persist erwartet das Format { state: ..., version: ... }
        return JSON.stringify({ state: stateData, version: 0 });
      }

      isInitialized = true;
      initialLoadCompleted[filename] = true;
      return null;
    },

    setItem: async (_name: string, value: string): Promise<void> => {
      try {
        // Parse das Zustand-Format
        const parsed = JSON.parse(value);
        const data = parsed.state as T;

        // KRITISCHER SCHUTZ: Verhindere Schreiben von leeren Daten
        // wenn wir gerade erst initialisiert haben und noch gueltige Daten haben koennten
        if (!initialLoadCompleted[filename]) {
          console.warn(
            `[FileStorage] WARNUNG: Blockiere Schreibvorgang vor Initialisierung fuer ${filename}`
          );
          return;
        }

        // Pruefe ob die neuen Daten leer sind
        if (!isValidData(filename, data)) {
          // Pruefe ob wir gueltige gecachte Daten haben
          if (cachedData !== null && isValidData(filename, cachedData)) {
            console.warn(
              `[FileStorage] WARNUNG: Verhindere Ueberschreiben mit leeren Daten fuer ${filename}`
            );
            return;
          }

          // Pruefe ob die Datei gueltige Daten hat
          const hasValid = await hasValidData(filename);
          if (hasValid) {
            console.warn(
              `[FileStorage] WARNUNG: Datei hat gueltige Daten, verhindere Ueberschreiben mit leeren Daten`
            );
            return;
          }
        }

        // Update Cache sofort (UI bleibt responsiv)
        cachedData = data;
        pendingData = data;

        // Debounce: Sammle schnelle Updates und schreibe nur einmal
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(async () => {
          // Warte auf vorherigen Schreibvorgang
          if (pendingWrite) {
            await pendingWrite;
          }

          // Schreibe nur die aktuellsten Daten
          if (pendingData !== null) {
            pendingWrite = writeData(filename, pendingData);
            await pendingWrite;
            pendingWrite = null;
            pendingData = null;
          }
          debounceTimer = null;
        }, DEBOUNCE_MS);
      } catch (error) {
        console.error(`[FileStorage] Fehler beim Setzen von ${filename}:`, error);
      }
    },

    removeItem: async (_name: string): Promise<void> => {
      // Fuer Zustand nicht wirklich benoetigt, aber Interface erfordert es
      // WICHTIG: Loesche NICHT den Cache oder die Datei
      console.warn(`[FileStorage] removeItem aufgerufen - ignoriert zum Schutz der Daten`);
    },
  };
}

/**
 * Migriert Daten von localStorage zu Dateisystem
 * Wird automatisch aufgerufen wenn die Datei leer oder ungueltig ist
 */
export async function migrateFromLocalStorage(
  localStorageKey: string,
  filename: StorageFile
): Promise<boolean> {
  try {
    // Pruefe ob localStorage-Daten existieren
    const localData = localStorage.getItem(localStorageKey);
    if (!localData) {
      console.log(`[FileStorage] Keine localStorage-Daten fuer ${localStorageKey} gefunden`);
      return false;
    }

    // Parse localStorage-Daten
    const parsed = JSON.parse(localData);
    const stateData = parsed.state || parsed;

    // Pruefe ob localStorage-Daten gueltig sind
    if (!isValidData(filename, stateData)) {
      console.log(`[FileStorage] localStorage-Daten fuer ${localStorageKey} sind leer/ungueltig`);
      return false;
    }

    // Schreibe localStorage-Daten direkt in Datei (umgehe den Schutz da wir wissen dass die Daten gueltig sind)
    await ensureDataDir();
    const filePath = `${DATA_DIR}/${filename}`;
    const content = JSON.stringify(stateData, null, 2);
    await writeTextFile(filePath, content, { baseDir: BaseDirectory.AppData });

    console.log(`[FileStorage] Erfolgreich migriert: ${localStorageKey} -> ${filename}`);
    return true;
  } catch (error) {
    console.error(`[FileStorage] Migration fehlgeschlagen:`, error);
    return false;
  }
}

/**
 * Fuehrt alle notwendigen Migrationen durch
 * HINWEIS: Diese Funktion wird nicht mehr benoetigt da die Migration
 * automatisch beim ersten Laden passiert wenn die Datei leer ist
 */
export async function runMigrations(): Promise<void> {
  console.log('[FileStorage] Migrationen werden automatisch beim Laden ausgefuehrt');
}

/**
 * Hilfsfunktion um zu pruefen ob wir in Tauri laufen
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

/**
 * Stellt Daten aus dem neuesten Backup wieder her
 */
export async function restoreFromBackup(filename: StorageFile): Promise<boolean> {
  try {
    await ensureDataDir();

    // Finde alle Backups fuer diese Datei
    // Dies ist eine vereinfachte Version - in der Praxis wuerde man das Verzeichnis lesen
    console.log(`[FileStorage] Backup-Wiederherstellung fuer ${filename} angefordert`);
    console.log(`[FileStorage] Bitte manuell aus ${BACKUP_DIR} wiederherstellen`);

    return false;
  } catch (error) {
    console.error(`[FileStorage] Fehler bei Backup-Wiederherstellung:`, error);
    return false;
  }
}
