// Kunde/Projekt
export interface Client {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
  description?: string;
  website?: string; // Für automatisches Logo-Laden
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  hourlyRate?: number;
  notes?: string;
  createdAt: string;
}

// Tags für Aufgabentypen
export interface Tag {
  id: string;
  name: string;
  color: string;
  icon?: string;
}

// Zeiterfassungs-Eintrag
export interface TimeEntry {
  id: string;
  taskId: string;
  startTime: string;
  endTime?: string;
  duration?: number;
}

// Unteraufgabe
export interface Subtask {
  id: string;
  title: string;
  isCompleted: boolean;
  order: number;
}

// Priorität
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

// Wiederholungstyp
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export interface RecurrenceRule {
  type: RecurrenceType;
  interval: number; // Alle X Tage/Wochen/Monate
  weekDays?: number[]; // Für wöchentlich: 0=So, 1=Mo, etc.
  monthDay?: number; // Für monatlich: Tag des Monats
  endDate?: string; // Optional: Enddatum
  customDays?: number; // Für benutzerdefiniert: Alle X Tage
}

// Wiederkehrendes Meeting
export interface RecurringMeeting {
  id: string;
  title: string;
  description?: string;
  clientId?: string;
  meetingTime: { start: string; end: string };
  recurrence: RecurrenceRule;
  startDate: string; // Erstes Vorkommen
  createdAt: string;
}

// Hauptaufgabe
export interface Task {
  id: string;
  title: string;
  description?: string;

  // Status
  status: 'todo' | 'in_progress' | 'completed';

  // Priorität
  priority: TaskPriority;

  // Zeitliche Zuordnung
  scheduledDate: string;
  deadline?: string;

  // Kategorisierung
  clientId?: string;
  tagIds: string[];

  // Hierarchie
  subtasks: Subtask[];

  // Metadaten
  isSpontaneous: boolean;
  isMeeting: boolean;
  meetingTime?: { start: string; end: string };

  // Wiederkehrende Aufgaben
  recurrence?: RecurrenceRule;
  recurrenceParentId?: string; // ID der ursprünglichen wiederkehrenden Aufgabe

  // Tracking
  timeEntries: TimeEntry[];
  createdAt: string;
  completedAt?: string;

  // Für automatische Übernahme
  originalDate?: string;
  postponeCount: number;

  // Optional-Aufgabe (kein Pflicht-Charakter, wandert automatisch weiter)
  isOptional?: boolean;
}

// Aufgaben-Template
export interface TaskTemplate {
  id: string;
  name: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  clientId?: string;
  tagIds: string[];
  subtasks: { title: string }[];
  isMeeting: boolean;
  meetingDuration?: number; // in minutes
  estimatedMinutes?: number; // Geschätzte Zeit in Minuten
  createdAt: string;
}

// Tagesübersicht
export interface DaySummary {
  date: string;
  totalTasks: number;
  completedTasks: number;
  totalTimeTracked: number;
  tasksPostponed: number;
}

// Arbeitszeit-Block (z.B. 8:00-12:00)
export interface WorkBlock {
  id: string;
  startTime: string; // ISO timestamp
  endTime?: string; // ISO timestamp, undefined wenn noch aktiv
}

// Pause
export interface BreakEntry {
  id: string;
  startTime: string;
  endTime?: string;
}

// Tägliche Arbeitszeiterfassung
export interface WorkDay {
  date: string;
  workBlocks: WorkBlock[];
  breaks: BreakEntry[];
  isWorking: boolean;
  isOnBreak: boolean;
}

// Dokument
export interface Document {
  id: string;
  title: string;
  content: string; // TipTap JSON als String
  clientId: string; // Pflicht: jedes Dokument gehört zu einem Kunden
  taskId?: string; // Optional: Verknüpfung zu Aufgabe
  syncTaskDescription: boolean; // Erste Sektion synced mit task.description
  createdAt: string;
  updatedAt: string;
}

// === Pattern Intelligence System ===

/** Erkennbare Muster (V1-Kern) */
export type PatternType =
  | 'postpone'           // Oft verschobene Aufgaben (auto/ask/off)
  | 'deadlineWarning'    // Deadline-Warnung ohne Fortschritt
  | 'autoClient';        // Kundenname im Titel erkannt

/** Autonomie-Level pro Muster */
export type PatternAutonomy = 'auto' | 'ask' | 'off';

/** Nutzer-Präferenz pro Muster-Typ */
export interface PatternPreference {
  patternType: PatternType;
  autonomy: PatternAutonomy;
  /** Optionaler Schwellwert (z.B. Anzahl Verschiebungen) */
  threshold?: number;
}

/** Wo ein erkanntes Muster gerendert werden soll */
export type PatternRenderTarget = 'inline' | 'toast';

/** Ein erkanntes Muster, bereit für Anzeige oder Auto-Aktion */
export interface DetectedPattern {
  id: string;
  patternType: PatternType;
  /** Betroffene Task-IDs */
  taskIds: string[];
  title: string;
  description: string;
  detectedAt: string;
  renderTarget: PatternRenderTarget;
  priority: 'high' | 'medium' | 'low';
  payload: PatternPayload;
}

/** Discriminated Union für pattern-spezifische Daten */
export type PatternPayload =
  | PostponePayload
  | DeadlinePayload
  | AutoClientPayload;

export interface PostponePayload {
  type: 'postpone';
  taskId: string;
  postponeCount: number;
  originalDate: string;
  suggestedActions: ('markOptional' | 'delete' | 'reschedule' | 'deprioritize')[];
}

export interface DeadlinePayload {
  type: 'deadline';
  taskId: string;
  deadline: string;
  daysRemaining: number;
  subtasksCompleted: number;
  subtasksTotal: number;
  hasTimeTracked: boolean;
}

export interface AutoClientPayload {
  type: 'autoClient';
  taskId: string;
  suggestedClientId: string;
  suggestedClientName: string;
}

/** Abgelehntes Muster */
export interface DismissedPattern {
  patternType: PatternType;
  taskId?: string;
  dismissedAt: string;
  permanent: boolean;
}

