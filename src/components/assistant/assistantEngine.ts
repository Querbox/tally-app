/**
 * Tally Assistant Engine V1
 *
 * PURE FUNCTIONS ONLY.
 * Kein React-Import. Keine Hooks. Keine Side-Effects.
 * Wird ausschliesslich aus Event-Handlern aufgerufen.
 */

import type { Task, TaskPriority, RecurrenceRule, TaskTemplate, DetectedPattern, PatternPreference } from '../../types';
import { addDays } from '../../utils/dateUtils';

// ============================================================
// TYPES
// ============================================================

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  isConfirmation?: boolean;
}

/** Konversationsgedaechtnis – wird in FloatingAssistant als State gehalten (kein Store). */
export interface ConversationContext {
  /** Letzte 5 ausgefuehrte Intents (neuester zuerst) */
  recentIntents: Intent[];
  /** Task-ID der zuletzt referenzierten/bearbeiteten Aufgabe */
  lastReferencedTaskId: string | null;
  /** Client-ID des zuletzt referenzierten Kunden */
  lastReferencedClientId: string | null;
}

export const EMPTY_CONVERSATION_CONTEXT: ConversationContext = {
  recentIntents: [],
  lastReferencedTaskId: null,
  lastReferencedClientId: null,
};

export interface ParseContext {
  today: string;
  clients: Array<{ id: string; name: string }>;
  expertMode: boolean;
  conversationContext: ConversationContext;
}

export interface StoreAccess {
  tasks: Task[];
  clients: Array<{ id: string; name: string }>;
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'postponeCount' | 'priority'> & { priority?: TaskPriority }) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  setTaskPriority: (id: string, priority: TaskPriority) => void;
  addTemplate: (template: Omit<TaskTemplate, 'id' | 'createdAt'>) => void;
  getNetWorkTime: (date: string) => number;
  getWeeklyWorkTime: (date: string) => number;
  getMonthlyWorkTime: (date: string) => number;
  getTasksForDateSorted: (date: string) => Task[];
  getUnfinishedTasksBeforeDate: (date: string) => Task[];
  today: string;
  // Pattern-Daten (read-only Snapshot, kein Store-Zugriff)
  activePatterns: DetectedPattern[];
  patternPreferences: PatternPreference[];
  // Pattern-Aktionen (nach Confirmation ausgefuehrt)
  acceptPattern: (patternId: string) => void;
}

export interface ExecutionResult {
  success: boolean;
  message: string;
}

// --- Intent Types ---

interface CreateTaskIntent {
  type: 'create_task';
  confidence: number;
  title: string;
  date: string;
  priority?: TaskPriority;
  isMeeting: boolean;
  meetingTime?: { start: string; end: string };
  clientId?: string;
}

interface CreateRecurringTaskIntent {
  type: 'create_recurring_task';
  confidence: number;
  title: string;
  date: string;
  recurrence: RecurrenceRule;
  isMeeting: boolean;
}

interface MoveTasksIntent {
  type: 'move_tasks';
  confidence: number;
  scope: 'all_open' | 'last' | 'by_title' | 'by_id';
  titleQuery?: string;
  taskId?: string;
  toDate: string;
}

interface SetPriorityIntent {
  type: 'set_priority';
  confidence: number;
  scope: 'last' | 'by_title' | 'by_id';
  titleQuery?: string;
  taskId?: string;
  priority: TaskPriority;
}

interface DeleteTaskIntent {
  type: 'delete_task';
  confidence: number;
  scope: 'last' | 'by_title' | 'by_id';
  titleQuery?: string;
  taskId?: string;
}

interface StatsQueryIntent {
  type: 'stats_query';
  confidence: number;
  queryType:
    | 'today_summary' | 'weekly_work_time' | 'monthly_work_time' | 'completion_rate' | 'overdue_count'
    | 'tasks_today' | 'tasks_tomorrow' | 'tasks_week' | 'meetings_today'
    | 'overdue_tasks' | 'last_completed' | 'current_client' | 'client_list'
    | 'weekly_completion' | 'high_priority';
}

interface CreateTemplateIntent {
  type: 'create_template';
  confidence: number;
  scope: 'last' | 'by_title' | 'by_id';
  titleQuery?: string;
  taskId?: string;
}

interface PatternQueryIntent {
  type: 'pattern_query';
  confidence: number;
  queryType: 'explain_pattern' | 'list_patterns' | 'pattern_settings';
  /** Falls auf eine bestimmte Task bezogen (via Kontext) */
  taskId?: string;
}

interface PatternActionIntent {
  type: 'pattern_action';
  confidence: number;
  action: 'mark_optional' | 'deprioritize' | 'accept_client';
  /** Betroffene Task-ID (via Kontext oder explizit) */
  taskId?: string;
  /** Pattern-ID fuer acceptPattern() */
  patternId?: string;
}

interface ExplainCapabilitiesIntent {
  type: 'explain_capabilities';
  confidence: number;
  expertMode: boolean;
}

interface UnknownIntent {
  type: 'unknown';
  confidence: number;
  rawInput: string;
}

/** Intent mit confidence < CONFIDENCE_THRESHOLD -> Rueckfrage */
export interface SuggestIntent {
  type: 'suggest';
  confidence: number;
  suggestions: Array<{ label: string; intent: Intent }>;
  rawInput: string;
}

/** Mehrere Tasks passen -> User muss waehlen */
export interface DisambiguateIntent {
  type: 'disambiguate';
  confidence: number;
  /** Der urspruengliche Intent, der nach Auswahl mit konkreter Task-ID ausgefuehrt wird */
  originalAction: 'move' | 'delete' | 'priority' | 'template';
  candidates: Array<{ taskId: string; title: string }>;
  /** Zusaetzliche Daten die fuer die Ausfuehrung noetig sind */
  actionData: Record<string, unknown>;
  rawInput: string;
}

export type Intent =
  | CreateTaskIntent
  | CreateRecurringTaskIntent
  | MoveTasksIntent
  | SetPriorityIntent
  | DeleteTaskIntent
  | StatsQueryIntent
  | CreateTemplateIntent
  | ExplainCapabilitiesIntent
  | PatternQueryIntent
  | PatternActionIntent
  | UnknownIntent
  | SuggestIntent
  | DisambiguateIntent;

const CONFIDENCE_THRESHOLD = 0.6;

// ============================================================
// SYNONYM MAPPING
// ============================================================

/** Synonym-Gruppen: Schluessel -> Array von Synonymen (lowercase) */
const SYNONYMS: Record<string, string[]> = {
  // Aktionen
  'erstellen':   ['erstell', 'erstelle', 'erstellen', 'anlegen', 'leg an', 'neue', 'neues', 'neuer', 'neuen', 'hinzufügen', 'hinzufuegen', 'add'],
  'verschieben': ['verschieb', 'verschiebe', 'verschieben', 'move', 'leg auf', 'verlegen', 'verleg'],
  'löschen':     ['lösch', 'lösche', 'löschen', 'loeschen', 'loesch', 'entferne', 'entfernen', 'delete', 'remove'],
  'priorität':   ['priorität', 'prioritaet', 'wichtig', 'dringend', 'urgent', 'markiere', 'markieren', 'setze', 'setzen'],
  'vorlage':     ['vorlage', 'template', 'muster', 'mach daraus'],

  // Abfragen
  'statistik':   ['statistik', 'statistiken', 'stats', 'überblick', 'ueberblick', 'zusammenfassung', 'status'],
  'arbeitszeit': ['gearbeitet', 'arbeitszeit', 'arbeitsstunden', 'stunden', 'work time'],
  'aufgaben':    ['aufgabe', 'aufgaben', 'task', 'tasks', 'todo', 'todos'],
  'meetings':    ['meeting', 'meetings', 'termin', 'termine', 'besprechung', 'besprechungen', 'call', 'calls'],
  'kunde':       ['kunde', 'kunden', 'client', 'clients', 'mandant', 'auftraggeber'],
  'erledigt':    ['erledigt', 'fertig', 'geschafft', 'abgeschlossen', 'done', 'completed'],
  'überfällig':  ['überfällig', 'ueberfaellig', 'liegengeblieben', 'verpasst', 'versäumt', 'versaeumt', 'overdue'],

  // Zeit
  'heute':       ['heute', 'today', 'heut'],
  'morgen':      ['morgen', 'tomorrow'],
  'woche':       ['woche', 'wöchentlich', 'woechentlich', 'wochenplan', 'diese woche'],
  'monat':       ['monat', 'monatlich', 'diesen monat', 'dieses monat', 'dieser monat'],

  // Wiederkehrend
  'wiederkehrend': ['jeden', 'jede', 'jedes', 'täglich', 'taeglich', 'wöchentlich', 'woechentlich', 'monatlich', 'alle'],

  // Meta
  'hilfe':       ['hilfe', 'help', 'was kannst du', 'was bist du', 'wie funktioniert'],
};

/**
 * Prueft ob ein Wort/Phrase in einer Synonym-Gruppe enthalten ist.
 * Gibt true zurueck wenn mindestens ein Synonym im Input vorkommt.
 */
function matchesSynonymGroup(input: string, groupKey: string): boolean {
  const synonyms = SYNONYMS[groupKey];
  if (!synonyms) return false;
  return synonyms.some(s => input.includes(s));
}

/**
 * Zaehlt wie viele Synonym-Gruppen im Input matchen.
 * Hilfsfunktion fuer Score-Berechnung.
 */
function countMatchingGroups(input: string, groupKeys: string[]): number {
  return groupKeys.filter(key => matchesSynonymGroup(input, key)).length;
}

// ============================================================
// SCORING INFRASTRUCTURE
// ============================================================

interface ScoredCandidate {
  intent: Intent;
  score: number;
}

/**
 * Berechnet einen normalisierten Score basierend auf Regex-Matches.
 * baseScore: Grundwert wenn Haupt-Pattern matcht (0.5 - 0.9)
 * bonusPatterns: Zusaetzliche Patterns die den Score erhoehen
 * synonymGroups: Synonym-Gruppen die zum Bonus beitragen
 */
function computeScore(
  input: string,
  baseScore: number,
  bonusPatterns: RegExp[],
  synonymGroups: string[] = [],
): number {
  let score = baseScore;
  // Bonus fuer zusaetzliche Pattern-Matches (je 0.05)
  for (const pattern of bonusPatterns) {
    if (pattern.test(input)) {
      score += 0.05;
    }
  }
  // Bonus fuer Synonym-Gruppen-Matches (je 0.03)
  const synonymMatches = countMatchingGroups(input, synonymGroups);
  score += synonymMatches * 0.03;
  // Auf 1.0 deckeln
  return Math.min(score, 1.0);
}

// ============================================================
// DATE RESOLUTION (Pure Helper)
// ============================================================

const WEEKDAY_MAP: Record<string, number> = {
  'sonntag': 0, 'montag': 1, 'dienstag': 2, 'mittwoch': 3,
  'donnerstag': 4, 'freitag': 5, 'samstag': 6,
};

const WEEKDAY_NAMES: Record<number, string> = {
  0: 'Sonntag', 1: 'Montag', 2: 'Dienstag', 3: 'Mittwoch',
  4: 'Donnerstag', 5: 'Freitag', 6: 'Samstag',
};

function getNextWeekday(today: string, targetDay: number): string {
  const date = new Date(today);
  const currentDay = date.getDay();
  let daysAhead = targetDay - currentDay;
  if (daysAhead <= 0) daysAhead += 7;
  return addDays(today, daysAhead);
}

export function resolveDate(text: string, today: string): { date: string; consumed: string } {
  const lower = text.toLowerCase().trim();

  // "heute"
  if (/\bheute\b/.test(lower)) {
    return { date: today, consumed: 'heute' };
  }

  // "morgen"
  if (/\bmorgen\b/.test(lower) && !/\bübermorgen\b/.test(lower)) {
    return { date: addDays(today, 1), consumed: 'morgen' };
  }

  // "übermorgen" / "uebermorgen"
  if (/\b[uü]bermorgen\b/.test(lower)) {
    return { date: addDays(today, 2), consumed: lower.match(/[uü]bermorgen/)?.[0] || 'übermorgen' };
  }

  // "nächste woche" / "naechste woche"
  if (/\bn[aä]chste\s*woche\b/.test(lower)) {
    const nextMonday = getNextWeekday(today, 1);
    return { date: nextMonday, consumed: lower.match(/n[aä]chste\s*woche/)?.[0] || 'nächste woche' };
  }

  // Wochentage: "montag", "dienstag", etc.
  for (const [name, day] of Object.entries(WEEKDAY_MAP)) {
    const regex = new RegExp(`\\b${name}\\b`, 'i');
    if (regex.test(lower)) {
      return { date: getNextWeekday(today, day), consumed: name };
    }
  }

  // ISO-Datum (2026-02-17)
  const isoMatch = lower.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch) {
    return { date: isoMatch[1], consumed: isoMatch[1] };
  }

  // Kein Datum erkannt -> heute
  return { date: today, consumed: '' };
}

// ============================================================
// TIME RESOLUTION
// ============================================================

function resolveTime(text: string): { start: string; end: string } | null {
  // "um 15 Uhr", "um 15:30", "15 Uhr", "15:30 Uhr"
  const timeMatch = text.match(/\b(?:um\s+)?(\d{1,2})(?::(\d{2}))?\s*(?:uhr)?\b/i);
  if (timeMatch) {
    const hour = parseInt(timeMatch[1]);
    const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      const start = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      // Default: 1 Stunde
      const endHour = Math.min(hour + 1, 23);
      const end = `${endHour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      return { start, end };
    }
  }
  return null;
}

// ============================================================
// TASK RESOLUTION
// ============================================================

function resolveTask(
  scope: 'last' | 'by_title' | 'by_id',
  tasks: Task[],
  today: string,
  titleQuery?: string,
  taskId?: string,
): Task | null {
  if (scope === 'by_id' && taskId) {
    return tasks.find(t => t.id === taskId && t.status !== 'completed') || null;
  }

  if (scope === 'last') {
    // Letzter erstellter Task (heute, nicht abgeschlossen)
    const todayTasks = tasks
      .filter(t => t.scheduledDate === today && t.status !== 'completed')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return todayTasks[0] || null;
  }

  if (scope === 'by_title' && titleQuery) {
    const query = titleQuery.toLowerCase();
    return tasks.find(t =>
      t.title.toLowerCase().includes(query) && t.status !== 'completed'
    ) || null;
  }

  return null;
}

// ============================================================
// CLIENT RESOLUTION
// ============================================================

function resolveClient(
  text: string,
  clients: Array<{ id: string; name: string }>
): { id: string; name: string } | null {
  const lower = text.toLowerCase();
  for (const client of clients) {
    const clientLower = client.name.toLowerCase();
    // Wortgrenzen pruefen
    const regex = new RegExp(`(?:^|[\\s\\-_.:,;!?()\\[\\]/])${escapeRegex(clientLower)}(?:$|[\\s\\-_.:,;!?()\\[\\]/])`, 'i');
    if (regex.test(` ${lower} `)) {
      return client;
    }
  }
  return null;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================
// REFERENCE RESOLUTION
// ============================================================

/**
 * Aktualisiert den ConversationContext nach einer Aktion.
 * Pure Function – gibt neuen Context zurueck.
 */
export function updateConversationContext(
  prev: ConversationContext,
  executedIntent: Intent,
  resolvedTaskId?: string,
): ConversationContext {
  const recentIntents = [executedIntent, ...prev.recentIntents].slice(0, 5);

  let lastReferencedTaskId = prev.lastReferencedTaskId;
  let lastReferencedClientId = prev.lastReferencedClientId;

  // Task-Referenz aktualisieren
  if (resolvedTaskId) {
    lastReferencedTaskId = resolvedTaskId;
  }

  // Client-Referenz aus Intent extrahieren
  if (executedIntent.type === 'create_task' && executedIntent.clientId) {
    lastReferencedClientId = executedIntent.clientId;
  }

  return { recentIntents, lastReferencedTaskId, lastReferencedClientId };
}

/**
 * Extrahiert die betroffene Task-ID aus einem Intent + StoreAccess.
 * Wird nach executeIntent aufgerufen um den Kontext zu aktualisieren.
 */
export function extractTaskIdFromIntent(intent: Intent, stores: StoreAccess): string | null {
  switch (intent.type) {
    case 'move_tasks': {
      if (intent.scope === 'by_id' && intent.taskId) return intent.taskId;
      if (intent.scope === 'last') {
        const task = resolveTask('last', stores.tasks, stores.today);
        return task?.id || null;
      }
      if (intent.scope === 'by_title' && intent.titleQuery) {
        const task = resolveTask('by_title', stores.tasks, stores.today, intent.titleQuery);
        return task?.id || null;
      }
      return null;
    }
    case 'delete_task':
    case 'set_priority':
    case 'create_template': {
      if (intent.scope === 'by_id' && intent.taskId) return intent.taskId;
      if (intent.scope === 'last') {
        const task = resolveTask('last', stores.tasks, stores.today);
        return task?.id || null;
      }
      if (intent.scope === 'by_title' && intent.titleQuery) {
        const task = resolveTask('by_title', stores.tasks, stores.today, intent.titleQuery);
        return task?.id || null;
      }
      return null;
    }
    case 'create_task': {
      // Bei create_task: zuletzt erstellte Aufgabe wird referenziert
      // Die Task-ID ist erst nach dem Erstellen bekannt -> wird von der UI gesetzt
      return null;
    }
    default:
      return null;
  }
}

// ============================================================
// PARSE INTENT
// ============================================================

export function parseIntent(input: string, context: ParseContext): Intent {
  const trimmed = input.trim();
  if (!trimmed) return { type: 'unknown', confidence: 0, rawInput: input };

  const lower = trimmed.toLowerCase();

  // Alle Scorer ausfuehren, Kandidaten sammeln
  const candidates: ScoredCandidate[] = [];

  const push = (c: ScoredCandidate | null) => { if (c) candidates.push(c); };

  push(scoreExplainCapabilities(lower, context));
  push(scorePatternQuery(lower, context));
  push(scorePatternAction(lower, context));
  push(scoreStatsQuery(lower));
  push(scoreRecurring(trimmed, lower, context));
  push(scoreMove(trimmed, lower, context.today));
  push(scorePriority(trimmed, lower));
  push(scoreDelete(trimmed, lower));
  push(scoreTemplate(trimmed, lower));
  push(scoreCreateTask(trimmed, lower, context));

  // Keine Kandidaten -> Unknown
  if (candidates.length === 0) {
    return { type: 'unknown', confidence: 0, rawInput: input };
  }

  // Nach Score absteigend sortieren
  candidates.sort((a, b) => b.score - a.score);

  const best = candidates[0];

  // Ueber Schwellenwert -> Referenz-Aufloesung anwenden
  if (best.score >= CONFIDENCE_THRESHOLD) {
    return applyContextResolution(best.intent, lower, context);
  }

  // Unter Schwellenwert: Rueckfrage mit Top-Vorschlaegen
  const suggestions = candidates
    .slice(0, 3)
    .filter(c => c.score > 0.2)
    .map(c => ({
      label: intentLabel(c.intent),
      intent: c.intent,
    }));

  if (suggestions.length > 0) {
    return {
      type: 'suggest',
      confidence: best.score,
      suggestions,
      rawInput: input,
    };
  }

  return { type: 'unknown', confidence: 0, rawInput: input };
}

/**
 * Wendet Kontext-Auflosung auf einen Intent an.
 * Wenn der User "das" oder "diese Aufgabe" sagt und wir eine
 * lastReferencedTaskId haben, wird scope auf 'by_id' gesetzt.
 *
 * Gibt ggf. einen DisambiguateIntent zurueck wenn mehrere Tasks matchen.
 */
function applyContextResolution(
  intent: Intent,
  lower: string,
  context: ParseContext,
): Intent {
  const conv = context.conversationContext;

  // Nur Mutations-Intents mit Referenz-Potential
  if (
    intent.type !== 'move_tasks' &&
    intent.type !== 'delete_task' &&
    intent.type !== 'set_priority' &&
    intent.type !== 'create_template'
  ) {
    return intent;
  }

  // Pruefe auf Pronomen-Referenz im Input
  const hasPronoun =
    /\b(das|dies[es]?)\b/.test(lower)
    || /\b(diese[ns]?\s+(aufgabe|task))\b/.test(lower)
    || /\b(die|den)\s+(letzte[ns]?)\b/.test(lower);

  if (!hasPronoun) return intent;

  // Haben wir eine Task-Referenz im Kontext?
  if (conv.lastReferencedTaskId) {
    // Scope auf by_id setzen (wird in buildConfirmation/executeIntent aufgeloest)
    return enrichWithContextTaskId(intent, conv.lastReferencedTaskId);
  }

  // Kein Kontext -> Intent unveraendert lassen (faellt auf scope: 'last' zurueck)
  return intent;
}

/**
 * Setzt scope auf 'by_id' und fuegt taskId hinzu.
 */
function enrichWithContextTaskId(intent: Intent, taskId: string): Intent {
  switch (intent.type) {
    case 'move_tasks':
      return { ...intent, scope: 'by_id', taskId };
    case 'delete_task':
      return { ...intent, scope: 'by_id', taskId };
    case 'set_priority':
      return { ...intent, scope: 'by_id', taskId };
    case 'create_template':
      return { ...intent, scope: 'by_id', taskId };
    default:
      return intent;
  }
}

/**
 * Menschenlesbare Kurzbezeichnung fuer einen Intent.
 * Wird in "Meintest du...?" Rueckfragen verwendet.
 */
function intentLabel(intent: Intent): string {
  switch (intent.type) {
    case 'create_task':
      return `Aufgabe "${intent.title}" erstellen`;
    case 'create_recurring_task':
      return `Wiederkehrende Aufgabe "${intent.title}" erstellen`;
    case 'move_tasks':
      return intent.scope === 'all_open'
        ? 'Alle offenen Aufgaben verschieben'
        : `Aufgabe verschieben`;
    case 'set_priority':
      return `Priorität setzen (${formatPriority(intent.priority)})`;
    case 'delete_task':
      return 'Aufgabe löschen';
    case 'stats_query':
      return statsQueryLabel(intent.queryType);
    case 'create_template':
      return 'Vorlage erstellen';
    case 'explain_capabilities':
      return 'Was ich kann';
    case 'pattern_query':
      return 'Pattern-Info';
    case 'pattern_action':
      return intent.action === 'mark_optional' ? 'Als optional markieren'
        : intent.action === 'accept_client' ? 'Kunde zuordnen'
        : 'Pattern-Aktion';
    case 'suggest':
      return 'Vorschlag';
    case 'disambiguate':
      return 'Aufgabe auswählen';
    case 'unknown':
      return 'Unbekannt';
  }
}

function statsQueryLabel(queryType: StatsQueryIntent['queryType']): string {
  const labels: Record<StatsQueryIntent['queryType'], string> = {
    today_summary: 'Tagesübersicht',
    weekly_work_time: 'Wochenarbeitszeit',
    monthly_work_time: 'Monatsarbeitszeit',
    completion_rate: 'Erledigungsrate',
    overdue_count: 'Offene Aufgaben',
    tasks_today: 'Aufgaben heute',
    tasks_tomorrow: 'Aufgaben morgen',
    tasks_week: 'Aufgaben diese Woche',
    meetings_today: 'Meetings heute',
    overdue_tasks: 'Überfällige Aufgaben',
    last_completed: 'Zuletzt erledigt',
    current_client: 'Aktueller Kunde',
    client_list: 'Kundenliste',
    weekly_completion: 'Wochenfortschritt',
    high_priority: 'Dringende Aufgaben',
  };
  return labels[queryType] || 'Statistik';
}

// --- Explain Capabilities (Scorer) ---

function scoreExplainCapabilities(lower: string, context: ParseContext): ScoredCandidate | null {
  // Direkte Fragen -> hoher Score
  if (/\bwas\s+(kannst|bist|machst)\s+du\b/.test(lower)) {
    return { intent: { type: 'explain_capabilities', confidence: 0.95, expertMode: context.expertMode }, score: 0.95 };
  }
  if (/\bwas\s+kannst\s+du\s+alles\b/.test(lower)) {
    return { intent: { type: 'explain_capabilities', confidence: 0.95, expertMode: context.expertMode }, score: 0.95 };
  }
  if (/\bwie\s+funktioniert\s+(das|das\s+hier)\b/.test(lower)) {
    return { intent: { type: 'explain_capabilities', confidence: 0.85, expertMode: context.expertMode }, score: 0.85 };
  }
  if (/\bwobei\s+kannst\s+du\s+helfen\b/.test(lower)) {
    return { intent: { type: 'explain_capabilities', confidence: 0.90, expertMode: context.expertMode }, score: 0.90 };
  }
  // Einfache Keywords -> etwas niedriger
  if (/\bhilfe\b/.test(lower) || /\bhelp\b/.test(lower)) {
    const score = computeScore(lower, 0.70, [], ['hilfe']);
    return { intent: { type: 'explain_capabilities', confidence: score, expertMode: context.expertMode }, score };
  }
  return null;
}

// --- Pattern Query (Scorer) ---

function scorePatternQuery(lower: string, context: ParseContext): ScoredCandidate | null {
  // "Warum wird mir das als optional vorgeschlagen?"
  if (/\bwarum\b.*\b(vorgeschlagen|optional|vorschlag|muster|pattern)\b/.test(lower)
    || /\b(vorgeschlagen|vorschlag)\b.*\bwarum\b/.test(lower)) {
    const score = computeScore(lower, 0.88, [], []);
    const taskId = context.conversationContext.lastReferencedTaskId || undefined;
    return { intent: { type: 'pattern_query', confidence: score, queryType: 'explain_pattern', taskId }, score };
  }

  // "Wieso wird diese Aufgabe markiert / hervorgehoben?"
  if (/\b(wieso|warum|weshalb)\b.*\b(markiert|hervorgehoben|angezeigt|hinweis|warnung)\b/.test(lower)) {
    const score = computeScore(lower, 0.85, [], []);
    const taskId = context.conversationContext.lastReferencedTaskId || undefined;
    return { intent: { type: 'pattern_query', confidence: score, queryType: 'explain_pattern', taskId }, score };
  }

  // "Welche Muster / Patterns sind aktiv?"
  if (/\b(welche|aktive|aktuelle)\b.*\b(muster|pattern|vorschl[aä]ge|hinweise)\b/.test(lower)
    || /\b(muster|pattern|vorschl[aä]ge)\b.*\b(aktiv|gibt|zeig|list)\b/.test(lower)) {
    const score = computeScore(lower, 0.85, [], []);
    return { intent: { type: 'pattern_query', confidence: score, queryType: 'list_patterns' }, score };
  }

  // "Wie oft wurde X verschoben?"
  if (/\bwie\s+oft\b.*\bverschoben\b/.test(lower)) {
    const score = computeScore(lower, 0.85, [], []);
    const taskId = context.conversationContext.lastReferencedTaskId || undefined;
    return { intent: { type: 'pattern_query', confidence: score, queryType: 'explain_pattern', taskId }, score };
  }

  // "Pattern Einstellungen / Muster Konfiguration"
  if (/\b(muster|pattern)\b.*\b(einstell|konfigur|settings)\b/.test(lower)
    || /\b(einstell|konfigur)\b.*\b(muster|pattern)\b/.test(lower)) {
    const score = computeScore(lower, 0.82, [], []);
    return { intent: { type: 'pattern_query', confidence: score, queryType: 'pattern_settings' }, score };
  }

  return null;
}

// --- Pattern Action (Scorer) ---

function scorePatternAction(lower: string, context: ParseContext): ScoredCandidate | null {
  const taskId = context.conversationContext.lastReferencedTaskId || undefined;

  // "Mach das optional" / "Als optional markieren"
  if (/\b(mach|markier|setz)\b.*\boptional\b/.test(lower)
    || /\boptional\b.*\b(machen|markieren|setzen)\b/.test(lower)) {
    const score = computeScore(lower, 0.88, [], []);
    return { intent: { type: 'pattern_action', confidence: score, action: 'mark_optional', taskId }, score };
  }

  // "Niedrige Priorität setzen" (im Pattern-Kontext – nur wenn es ein Pattern gibt)
  // Dies wird als normaler Priority-Intent erkannt, nicht hier.

  // "Kunde zuordnen" / "Client akzeptieren" (fuer autoClient Pattern)
  if (/\b(kunde[n]?|client)\b.*\b(zuordnen|akzeptieren|annehmen|übernehmen|uebernehmen)\b/.test(lower)
    || /\b(zuordnen|akzeptieren)\b.*\b(kunde|client)\b/.test(lower)) {
    const score = computeScore(lower, 0.85, [], ['kunde']);
    return { intent: { type: 'pattern_action', confidence: score, action: 'accept_client', taskId }, score };
  }

  return null;
}

// --- Stats (Scorer) ---

function scoreStatsQuery(lower: string): ScoredCandidate | null {
  let best: ScoredCandidate | null = null;

  const candidate = (queryType: StatsQueryIntent['queryType'], score: number) => {
    const c: ScoredCandidate = {
      intent: { type: 'stats_query', confidence: score, queryType },
      score,
    };
    if (!best || c.score > best.score) best = c;
  };

  // --- Arbeitszeit (spezifisch -> allgemein) ---
  if (/wie\s*(viel|lange)\b.*\b(gearbeitet|arbeit)\b.*\b(woche|diese\s*woche)\b/.test(lower)) {
    candidate('weekly_work_time', computeScore(lower, 0.90, [], ['arbeitszeit', 'woche']));
  }
  if (/wie\s*(viel|lange)\b.*\b(gearbeitet|arbeit)\b.*\b(monat|diese[mn]?\s*monat)\b/.test(lower)) {
    candidate('monthly_work_time', computeScore(lower, 0.90, [], ['arbeitszeit', 'monat']));
  }
  if (/wie\s*(viel|lange)\b.*\b(gearbeitet|arbeit)\b/.test(lower)) {
    candidate('today_summary', computeScore(lower, 0.80, [], ['arbeitszeit', 'heute']));
  }

  // --- Wochen-Completion ---
  if (/\bwoche\b.*\b(erledigt|geschafft|abgeschlossen|fertig)\b/.test(lower)) {
    candidate('weekly_completion', computeScore(lower, 0.88, [], ['woche', 'erledigt']));
  }
  if (/wie\s*viele?\b.*\b(erledigt|fertig|geschafft|abgeschlossen)\b/.test(lower)) {
    candidate('completion_rate', computeScore(lower, 0.85, [], ['erledigt']));
  }

  // --- Aufgaben diese Woche ---
  if (/\b(wochenplan)\b/.test(lower)) {
    candidate('tasks_week', 0.92);
  }
  if (/\bwoche\b.*\b(aufgaben?|machen|tun|an|offen|noch)\b/.test(lower)
    || /\b(aufgaben?|was)\b.*\bwoche\b/.test(lower)) {
    candidate('tasks_week', computeScore(lower, 0.82, [], ['woche', 'aufgaben']));
  }

  // --- Aufgaben morgen ---
  if (/\bmorgen\b.*\b(an|aufgaben?|tun|vor|geplant)\b/.test(lower)
    || /\b(aufgaben?|was)\b.*\bmorgen\b/.test(lower)) {
    candidate('tasks_tomorrow', computeScore(lower, 0.85, [], ['morgen', 'aufgaben']));
  }

  // --- Meetings heute ---
  if (/\b(meetings?|termine?|besprechung)\b.*\bheute\b/.test(lower)
    || /\bheute\b.*\b(meetings?|termine?|besprechung)\b/.test(lower)
    || /\bhabe\s+ich\b.*\b(meetings?|termine?)\b/.test(lower)) {
    candidate('meetings_today', computeScore(lower, 0.88, [], ['meetings', 'heute']));
  }

  // --- Aufgaben heute ---
  if (/\bheute\b.*\b(an|aufgaben?|tun|vor|geplant)\b/.test(lower)
    || /\b(aufgaben?|was)\b.*\bheute\b/.test(lower)
    || /\bmein(en?)?\s+tag\b/.test(lower)
    || /\bwas\s+steht\s+(heute\s+)?an\b/.test(lower)
    || /\bwas\s+habe?\s+ich\s+heute\b/.test(lower)) {
    candidate('tasks_today', computeScore(lower, 0.85, [], ['heute', 'aufgaben']));
  }

  // --- Ueberfaellig (detaillierte Liste) ---
  if (/\b[uü]berf[aä]llig\b/.test(lower)
    || /\bliegengeblieben\b/.test(lower)
    || /\bverpasst(e|en)?\b.*\baufgaben?\b/.test(lower)
    || /\bvers[aä]umt\b/.test(lower)) {
    candidate('overdue_tasks', computeScore(lower, 0.88, [], ['überfällig']));
  }

  // --- Offen/Ausstehend (Anzahl) ---
  if (/wie\s*viele?\b.*\b(offen|unerledigt|ausstehend)\b/.test(lower)) {
    candidate('overdue_count', computeScore(lower, 0.85, [], ['aufgaben']));
  }

  // --- Zuletzt erledigt ---
  if (/\b(zuletzt|letzte[ns]?)\b.*\b(erledigt|fertig|abgeschlossen|aufgabe)\b/.test(lower)
    || /\bwas\s+habe?\s+ich\s+(zuletzt\s+)?erledigt\b/.test(lower)) {
    candidate('last_completed', computeScore(lower, 0.85, [], ['erledigt']));
  }

  // --- Aktueller Kunde ---
  if (/\b(welche[rnms]?|aktuell\w*|gerade)\b.*\bkunde\b/.test(lower)
    || /\bf[uü]r\s+wen\b.*\b(arbeit|gerade)\b/.test(lower)
    || /\bkunde\b.*\b(gerade|aktuell)\b/.test(lower)) {
    candidate('current_client', computeScore(lower, 0.85, [], ['kunde']));
  }

  // --- Kundenliste ---
  if (/\bkunden\b.*\b(liste|alle|welche|meine|zeig)\b/.test(lower)
    || /\b(welche|meine|zeig|alle)\b.*\bkunden\b/.test(lower)
    || /\bkundenliste\b/.test(lower)) {
    candidate('client_list', computeScore(lower, 0.85, [], ['kunde']));
  }

  // --- Dringend/Wichtig ---
  if (/\b(dringend\w*|wichtig\w*)\b.*\b(aufgaben?|was|gibt)\b/.test(lower)
    || /\b(aufgaben?|was)\b.*\b(dringend|wichtig)\b/.test(lower)
    || /\bwas\s+ist\s+(dringend|wichtig)\b/.test(lower)) {
    candidate('high_priority', computeScore(lower, 0.85, [], ['priorität', 'aufgaben']));
  }

  // --- Fallback: Statistik/Ueberblick ---
  if (/\b(statistik|zusammenfassung|[uü]berblick|status)\b/.test(lower)) {
    candidate('today_summary', computeScore(lower, 0.65, [], ['statistik']));
  }

  return best;
}

// --- Recurring (Scorer) ---

function scoreRecurring(original: string, lower: string, context: ParseContext): ScoredCandidate | null {
  let recurrence: RecurrenceRule | null = null;
  let consumedPhrase = '';
  let baseScore = 0;

  // "jeden Montag", "jeden Dienstag", etc. -> hoher Score
  const weekdayMatch = lower.match(/\bjeden?\s+(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b/);
  if (weekdayMatch) {
    const day = WEEKDAY_MAP[weekdayMatch[1]];
    recurrence = { type: 'weekly', interval: 1, weekDays: [day] };
    consumedPhrase = weekdayMatch[0];
    baseScore = 0.90;
  }

  // "täglich" / "taeglich"
  if (!recurrence && /\bt[aä]glich\b/.test(lower)) {
    recurrence = { type: 'daily', interval: 1 };
    consumedPhrase = lower.match(/t[aä]glich/)?.[0] || '';
    baseScore = 0.88;
  }

  // "wöchentlich" / "woechentlich"
  if (!recurrence && /\bw[oö]chentlich\b/.test(lower)) {
    recurrence = { type: 'weekly', interval: 1 };
    consumedPhrase = lower.match(/w[oö]chentlich/)?.[0] || '';
    baseScore = 0.88;
  }

  // "monatlich"
  if (!recurrence && /\bmonatlich\b/.test(lower)) {
    recurrence = { type: 'monthly', interval: 1 };
    consumedPhrase = 'monatlich';
    baseScore = 0.88;
  }

  // "alle X Tage/Wochen/Monate"
  if (!recurrence) {
    const intervalMatch = lower.match(/\balle\s+(\d+)\s+(tage?|wochen?|monate?)\b/);
    if (intervalMatch) {
      const interval = parseInt(intervalMatch[1]);
      const unit = intervalMatch[2].toLowerCase();
      if (unit.startsWith('tag')) {
        recurrence = { type: 'custom', interval: 1, customDays: interval };
      } else if (unit.startsWith('woche')) {
        recurrence = { type: 'weekly', interval };
      } else if (unit.startsWith('monat')) {
        recurrence = { type: 'monthly', interval };
      }
      consumedPhrase = intervalMatch[0];
      baseScore = 0.85;
    }
  }

  if (!recurrence) return null;

  // Titel extrahieren: Recurrence-Phrase entfernen
  let title = original;
  if (consumedPhrase) {
    const idx = lower.indexOf(consumedPhrase.toLowerCase());
    if (idx >= 0) {
      title = (original.substring(0, idx) + original.substring(idx + consumedPhrase.length)).trim();
    }
  }
  title = cleanTitle(title);
  if (!title) return null;

  const score = computeScore(lower, baseScore, [], ['wiederkehrend', 'erstellen']);

  return {
    intent: {
      type: 'create_recurring_task',
      confidence: score,
      title,
      date: context.today,
      recurrence,
      isMeeting: /\b(meeting|call|termin|besprechung)\b/i.test(title),
    },
    score,
  };
}

// --- Move (Scorer) ---

function scoreMove(_original: string, lower: string, today: string): ScoredCandidate | null {
  // Pruefe auf Verschieben-Synonyme
  if (!matchesSynonymGroup(lower, 'verschieben') && !/\bbeweg/.test(lower)) return null;

  const moveMatch = lower.match(/\b(verschieb(?:e|en)?|beweg(?:e|en)?|verleg(?:e|en)?|move)\b\s+(.+?)\s+\bauf\s+(.+)/);
  if (!moveMatch) {
    // Schwacher Match: Hat Verschieben-Keyword aber kein "auf <datum>" Muster
    if (matchesSynonymGroup(lower, 'verschieben')) {
      return {
        intent: { type: 'move_tasks', confidence: 0.45, scope: 'all_open', toDate: today },
        score: 0.45,
      };
    }
    return null;
  }

  const subjectPart = moveMatch[2].trim();
  const datePart = moveMatch[3].trim();
  const { date: toDate } = resolveDate(datePart, today);

  const baseScore = 0.88;
  let scope: MoveTasksIntent['scope'] = 'all_open';
  let titleQuery: string | undefined;

  if (/\balle\s*(offenen?)?\b/.test(subjectPart)) {
    scope = 'all_open';
  } else if (/\b(die\s+)?letzte\b/.test(subjectPart)) {
    scope = 'last';
  } else {
    titleQuery = subjectPart
      .replace(/\b(die|das|den|dem|der|eine?n?|aufgabe|task)\b/gi, '')
      .trim();
    if (titleQuery) {
      scope = 'by_title';
    }
  }

  const score = computeScore(lower, baseScore, [], ['verschieben', 'aufgaben']);

  return {
    intent: { type: 'move_tasks', confidence: score, scope, titleQuery, toDate },
    score,
  };
}

// --- Priority (Scorer) ---

function scorePriority(original: string, lower: string): ScoredCandidate | null {
  let priority: TaskPriority | null = null;

  if (/\b(dringend|urgent)\b/.test(lower)) priority = 'urgent';
  else if (/\b(wichtig|hoch|high)\b/.test(lower)) priority = 'high';
  else if (/\b(niedrig|unwichtig|low)\b/.test(lower)) priority = 'low';
  else if (/\b(mittel|medium|normal)\b/.test(lower)) priority = 'medium';

  if (!priority) return null;

  // Braucht ein Action-Verb -> mit Verb: hoher Score, ohne: niedriger
  const hasActionVerb = /\b(markiere?|setze?|mach|als)\b/.test(lower);
  if (!hasActionVerb) return null;

  let scope: SetPriorityIntent['scope'] = 'last';
  let titleQuery: string | undefined;

  if (/\b(die\s+)?letzte\b/.test(lower) || /\bdas\b/.test(lower)) {
    scope = 'last';
  } else {
    titleQuery = extractSubject(original, lower, [
      /\b(markiere?|setze?|mach)\b/gi,
      /\b(als|auf)\b/gi,
      /\b(dringend|urgent|wichtig|hoch|high|niedrig|unwichtig|low|mittel|medium|normal)\b/gi,
    ]);
    if (titleQuery) {
      scope = 'by_title';
    }
  }

  const score = computeScore(lower, 0.85, [/\b(markiere?|setze?)\b/], ['priorität']);

  return {
    intent: { type: 'set_priority', confidence: score, scope, titleQuery, priority },
    score,
  };
}

// --- Delete (Scorer) ---

function scoreDelete(original: string, lower: string): ScoredCandidate | null {
  if (!matchesSynonymGroup(lower, 'löschen')) return null;

  let scope: DeleteTaskIntent['scope'] = 'last';
  let titleQuery: string | undefined;

  if (/\b(die\s+)?letzte\b/.test(lower)) {
    scope = 'last';
  } else {
    titleQuery = extractSubject(original, lower, [
      /\b(l[oö]sch(?:e|en)?|entfern(?:e|en)?|delete|remove)\b/gi,
      /\b(die|das|den|dem|der|eine?n?|aufgabe|task)\b/gi,
    ]);
    if (titleQuery) {
      scope = 'by_title';
    }
  }

  const score = computeScore(lower, 0.85, [/\b(l[oö]sch|entfern)/], ['löschen', 'aufgaben']);

  return {
    intent: { type: 'delete_task', confidence: score, scope, titleQuery },
    score,
  };
}

// --- Template (Scorer) ---

function scoreTemplate(original: string, lower: string): ScoredCandidate | null {
  if (!matchesSynonymGroup(lower, 'vorlage')) return null;

  let scope: CreateTemplateIntent['scope'] = 'last';
  let titleQuery: string | undefined;

  const extracted = extractSubject(original, lower, [
    /\b(vorlage|template|mach\s*daraus|als|eine?|speicher(?:e|n)?|erstell(?:e|en)?)\b/gi,
  ]);
  if (extracted) {
    scope = 'by_title';
    titleQuery = extracted;
  }

  const score = computeScore(lower, 0.85, [], ['vorlage']);

  return {
    intent: { type: 'create_template', confidence: score, scope, titleQuery },
    score,
  };
}

// --- Create Task (Scorer / Fallback) ---

function scoreCreateTask(original: string, lower: string, context: ParseContext): ScoredCandidate | null {
  let title = original;
  let isExplicit = false;
  let baseScore = 0.50; // Implizit: niedrigerer Score (Fallback)

  // Explizite Erstellung: "Erstelle ...", "Neue Aufgabe: ..."
  const explicitMatch = lower.match(/\b(erstell(?:e|en)?|neue?(?:s|r)?)\s+(?:aufgabe|task|meeting)?[:\s]*(.*)/);
  if (explicitMatch) {
    title = original.substring(original.toLowerCase().indexOf(explicitMatch[2].trim().charAt(0) || '') || 0);
    if (explicitMatch[2].trim()) {
      title = explicitMatch[2].trim();
      const idx = original.toLowerCase().indexOf(title.toLowerCase());
      if (idx >= 0) title = original.substring(idx, idx + title.length);
    }
    isExplicit = true;
    baseScore = 0.82; // Explizit: hoeher
  }

  // Ohne explizites Keyword: Nur wenn Text sinnvoll ist (mind. 3 Zeichen)
  if (!isExplicit && title.length < 3) return null;

  // Datum und Zeit extrahieren
  const { date, consumed: dateConsumed } = resolveDate(title, context.today);
  const meetingTime = resolveTime(title);

  if (dateConsumed) {
    const dateIdx = title.toLowerCase().indexOf(dateConsumed.toLowerCase());
    if (dateIdx >= 0) {
      title = (title.substring(0, dateIdx) + title.substring(dateIdx + dateConsumed.length)).trim();
    }
  }

  title = title.replace(/\b(?:um\s+)?\d{1,2}(?::\d{2})?\s*(?:uhr)?\b/gi, '').trim();
  title = title.replace(/\bf[uü]r\s*/gi, '').trim();

  const client = resolveClient(title, context.clients);
  const isMeeting = /\b(meeting|call|termin|besprechung)\b/i.test(title);

  title = cleanTitle(title);
  if (!title) return null;

  let priority: TaskPriority | undefined;
  if (/\b(dringend|urgent)\b/i.test(title)) {
    priority = 'urgent';
    title = title.replace(/\b(dringend|urgent)\b/gi, '').trim();
  } else if (/\bwichtig\b/i.test(title)) {
    priority = 'high';
    title = title.replace(/\bwichtig\b/gi, '').trim();
  }

  title = cleanTitle(title);
  if (!title) return null;

  // Score-Bonus fuer kontextuelle Hinweise
  const bonusPatterns: RegExp[] = [];
  if (dateConsumed) bonusPatterns.push(/./); // Datum erkannt -> +0.05
  if (client) bonusPatterns.push(/./); // Client erkannt -> +0.05
  if (isMeeting) bonusPatterns.push(/./); // Meeting erkannt -> +0.05

  const score = computeScore(lower, baseScore, bonusPatterns, ['erstellen']);

  return {
    intent: {
      type: 'create_task',
      confidence: score,
      title,
      date,
      priority,
      isMeeting,
      meetingTime: meetingTime || undefined,
      clientId: client?.id,
    },
    score,
  };
}

// ============================================================
// HELPERS
// ============================================================

function cleanTitle(title: string): string {
  return title
    .replace(/^[\s\-:.,;!?]+/, '')
    .replace(/[\s\-:.,;!?]+$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function extractSubject(original: string, _lower: string, removePatterns: RegExp[]): string {
  let result = original;
  for (const pattern of removePatterns) {
    result = result.replace(pattern, '');
  }
  result = cleanTitle(result);
  // Restliche Fuellwoerter
  result = result.replace(/\b(die|das|den|dem|der)\b/gi, '').trim();
  return cleanTitle(result);
}

// ============================================================
// BUILD CONFIRMATION
// ============================================================

export function buildConfirmation(intent: Intent, stores: StoreAccess): string | null {
  const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr);
    const dayName = WEEKDAY_NAMES[d.getDay()] || '';
    const day = d.getDate();
    const month = d.toLocaleDateString('de-DE', { month: 'long' });
    return `${dayName}, ${day}. ${month}`;
  };

  switch (intent.type) {
    case 'create_task': {
      const dateStr = formatDate(intent.date);
      const priorityStr = intent.priority ? ` (${formatPriority(intent.priority)})` : '';
      return `Aufgabe "${intent.title}" für ${dateStr} erstellen${priorityStr}?`;
    }

    case 'create_recurring_task': {
      const recStr = formatRecurrence(intent.recurrence);
      return `Wiederkehrende Aufgabe "${intent.title}" ${recStr} erstellen?`;
    }

    case 'move_tasks': {
      const dateStr = formatDate(intent.toDate);
      if (intent.scope === 'all_open') {
        const count = stores.tasks.filter(
          t => t.scheduledDate === stores.today && t.status !== 'completed'
        ).length;
        return `Alle ${count} offenen Aufgaben auf ${dateStr} verschieben?`;
      }
      if (intent.scope === 'by_id') {
        const task = resolveTask('by_id', stores.tasks, stores.today, undefined, intent.taskId);
        if (!task) return 'Keine Aufgabe gefunden.';
        return `"${task.title}" auf ${dateStr} verschieben?`;
      }
      if (intent.scope === 'last') {
        const task = resolveTask('last', stores.tasks, stores.today);
        if (!task) return 'Keine Aufgabe gefunden.';
        return `"${task.title}" auf ${dateStr} verschieben?`;
      }
      return `Aufgaben mit "${intent.titleQuery}" auf ${dateStr} verschieben?`;
    }

    case 'set_priority': {
      const task = intent.scope === 'by_id'
        ? resolveTask('by_id', stores.tasks, stores.today, undefined, intent.taskId)
        : resolveTask(intent.scope, stores.tasks, stores.today, intent.titleQuery);
      if (!task) return 'Keine Aufgabe gefunden.';
      return `"${task.title}" als ${formatPriority(intent.priority)} markieren?`;
    }

    case 'delete_task': {
      const task = intent.scope === 'by_id'
        ? resolveTask('by_id', stores.tasks, stores.today, undefined, intent.taskId)
        : resolveTask(intent.scope, stores.tasks, stores.today, intent.titleQuery);
      if (!task) return 'Keine Aufgabe gefunden.';
      return `"${task.title}" löschen? (Papierkorb)`;
    }

    case 'create_template': {
      const task = intent.scope === 'by_id'
        ? resolveTask('by_id', stores.tasks, stores.today, undefined, intent.taskId)
        : resolveTask(intent.scope, stores.tasks, stores.today, intent.titleQuery);
      if (!task) return 'Keine Aufgabe gefunden.';
      return `Vorlage aus "${task.title}" erstellen?`;
    }

    case 'stats_query':
      return null; // Kein Confirmation noetig

    case 'explain_capabilities':
      return null; // Reine Textantwort, kein Confirmation noetig

    case 'pattern_query':
      return null; // Read-only, kein Confirmation noetig

    case 'pattern_action': {
      // Guard: Task-ID muss vorhanden sein
      if (!intent.taskId) return 'Keine Aufgabe referenziert. Nenne die Aufgabe oder waehle sie zuerst aus.';
      const task = stores.tasks.find(t => t.id === intent.taskId);
      if (!task) return 'Aufgabe nicht gefunden.';
      // Guard: Task bereits erledigt?
      if (task.status === 'completed') return `"${task.title}" ist bereits erledigt.`;
      switch (intent.action) {
        case 'mark_optional': {
          if (task.isOptional) return `"${task.title}" ist bereits optional.`;
          return `"${task.title}" als optional markieren?`;
        }
        case 'deprioritize': {
          if (task.priority === 'low') return `"${task.title}" hat bereits niedrige Priorität.`;
          return `"${task.title}" auf niedrige Priorität setzen?`;
        }
        case 'accept_client': {
          // Pattern mit autoClient fuer diese Task finden
          const pattern = stores.activePatterns.find(
            p => p.patternType === 'autoClient' && p.taskIds.includes(intent.taskId!)
          );
          if (!pattern || pattern.payload.type !== 'autoClient') return 'Kein Kunden-Vorschlag für diese Aufgabe.';
          return `"${task.title}" dem Kunden "${pattern.payload.suggestedClientName}" zuordnen?`;
        }
      }
      return null;
    }

    case 'suggest':
      return null; // Wird in UI als Rueckfrage gehandelt

    case 'disambiguate':
      return null; // Wird in UI als Auswahl gehandelt

    case 'unknown':
      return null;
  }
}

// ============================================================
// EXECUTE INTENT
// ============================================================

export function executeIntent(intent: Intent, stores: StoreAccess): ExecutionResult {
  switch (intent.type) {
    case 'create_task': {
      stores.addTask({
        title: intent.title,
        status: 'todo',
        scheduledDate: intent.date,
        tagIds: [],
        subtasks: [],
        isSpontaneous: true,
        isMeeting: intent.isMeeting,
        meetingTime: intent.meetingTime,
        clientId: intent.clientId,
        timeEntries: [],
        priority: intent.priority,
        isOptional: false,
      });
      return { success: true, message: `Aufgabe "${intent.title}" erstellt.` };
    }

    case 'create_recurring_task': {
      stores.addTask({
        title: intent.title,
        status: 'todo',
        scheduledDate: intent.date,
        tagIds: [],
        subtasks: [],
        isSpontaneous: false,
        isMeeting: intent.isMeeting,
        timeEntries: [],
        recurrence: intent.recurrence,
        isOptional: false,
      });
      return { success: true, message: `Wiederkehrende Aufgabe "${intent.title}" erstellt.` };
    }

    case 'move_tasks': {
      if (intent.scope === 'all_open') {
        const tasksToMove = stores.tasks.filter(
          t => t.scheduledDate === stores.today && t.status !== 'completed'
        );
        if (tasksToMove.length === 0) {
          return { success: false, message: 'Keine offenen Aufgaben zum Verschieben gefunden.' };
        }
        for (const task of tasksToMove) {
          stores.updateTask(task.id, {
            scheduledDate: intent.toDate,
            originalDate: task.originalDate || task.scheduledDate,
            postponeCount: task.postponeCount + 1,
          });
        }
        return { success: true, message: `${tasksToMove.length} Aufgaben verschoben.` };
      }

      if (intent.scope === 'by_id') {
        const task = resolveTask('by_id', stores.tasks, stores.today, undefined, intent.taskId);
        if (!task) return { success: false, message: 'Keine passende Aufgabe gefunden.' };
        stores.updateTask(task.id, {
          scheduledDate: intent.toDate,
          originalDate: task.originalDate || task.scheduledDate,
          postponeCount: task.postponeCount + 1,
        });
        return { success: true, message: `"${task.title}" verschoben.` };
      }

      if (intent.scope === 'last' || intent.scope === 'by_title') {
        const task = resolveTask(intent.scope, stores.tasks, stores.today, intent.titleQuery);
        if (!task) return { success: false, message: 'Keine passende Aufgabe gefunden.' };
        stores.updateTask(task.id, {
          scheduledDate: intent.toDate,
          originalDate: task.originalDate || task.scheduledDate,
          postponeCount: task.postponeCount + 1,
        });
        return { success: true, message: `"${task.title}" verschoben.` };
      }

      return { success: false, message: 'Konnte Aufgaben nicht verschieben.' };
    }

    case 'set_priority': {
      const task = intent.scope === 'by_id'
        ? resolveTask('by_id', stores.tasks, stores.today, undefined, intent.taskId)
        : resolveTask(intent.scope, stores.tasks, stores.today, intent.titleQuery);
      if (!task) return { success: false, message: 'Keine passende Aufgabe gefunden.' };
      stores.setTaskPriority(task.id, intent.priority);
      return { success: true, message: `"${task.title}" als ${formatPriority(intent.priority)} markiert.` };
    }

    case 'delete_task': {
      const task = intent.scope === 'by_id'
        ? resolveTask('by_id', stores.tasks, stores.today, undefined, intent.taskId)
        : resolveTask(intent.scope, stores.tasks, stores.today, intent.titleQuery);
      if (!task) return { success: false, message: 'Keine passende Aufgabe gefunden.' };
      stores.deleteTask(task.id);
      return { success: true, message: `"${task.title}" gelöscht.` };
    }

    case 'create_template': {
      const task = intent.scope === 'by_id'
        ? resolveTask('by_id', stores.tasks, stores.today, undefined, intent.taskId)
        : resolveTask(intent.scope, stores.tasks, stores.today, intent.titleQuery);
      if (!task) return { success: false, message: 'Keine passende Aufgabe gefunden.' };
      stores.addTemplate({
        name: task.title,
        title: task.title,
        description: task.description,
        priority: task.priority,
        clientId: task.clientId,
        tagIds: task.tagIds,
        subtasks: task.subtasks.map(s => ({ title: s.title })),
        isMeeting: task.isMeeting,
      });
      return { success: true, message: `Vorlage "${task.title}" erstellt.` };
    }

    case 'stats_query': {
      return executeStatsQuery(intent, stores);
    }

    case 'explain_capabilities': {
      let message =
        'Hallo! Ich bin Tally, dein Assistent.\n' +
        'Hier ist, was ich alles kann:\n\n' +
        '📋 Aufgaben\n' +
        '  „Erstelle eine Aufgabe für morgen"\n' +
        '  „Lösche die letzte Aufgabe"\n' +
        '  „Verschiebe alle auf Montag"\n' +
        '  „Verschiebe Report auf Freitag"\n' +
        '  „Markiere das als wichtig"\n\n' +
        '🔁 Wiederkehrend\n' +
        '  „Jeden Dienstag Standup"\n' +
        '  „Täglich Mails checken"\n' +
        '  „Alle 2 Wochen Reporting"\n\n' +
        '📊 Abfragen\n' +
        '  „Was steht heute an?"\n' +
        '  „Habe ich heute Meetings?"\n' +
        '  „Wie viel habe ich diese Woche gearbeitet?"\n' +
        '  „Welche Aufgaben sind überfällig?"\n' +
        '  „Was ist dringend?"\n' +
        '  „Welche Kunden habe ich?"\n\n' +
        '🔍 Muster & Hinweise\n' +
        '  „Warum wird das als optional vorgeschlagen?"\n' +
        '  „Welche Muster sind aktiv?"\n' +
        '  „Mach das optional"\n\n' +
        '💬 Kontext\n' +
        '  Ich merke mir die letzte Aufgabe.\n' +
        '  „Verschiebe das auf morgen" bezieht\n' +
        '  sich auf die zuletzt bearbeitete Aufgabe.';

      if (intent.expertMode) {
        message += '\n\n⚡ Erweiterter Modus aktiv\n' +
          '  Komplexe Filter, Batch-Aktionen\n' +
          '  und einfache Automatisierungen.';
      }

      message +=
        '\n\n─────────────────\n' +
        'Ich führe nur aus, was du sagst.\n' +
        'Keine Hintergrundanalyse, keine\n' +
        'eigenen Entscheidungen.';

      return { success: true, message };
    }

    case 'pattern_query': {
      return executePatternQuery(intent, stores);
    }

    case 'pattern_action': {
      return executePatternAction(intent, stores);
    }

    case 'suggest': {
      const lines = intent.suggestions.map((s, i) => `${i + 1}. ${s.label}`);
      return {
        success: false,
        message: `Meintest du:\n${lines.join('\n')}`,
      };
    }

    case 'disambiguate': {
      const lines = intent.candidates.map((c, i) => `${i + 1}. ${c.title}`);
      return {
        success: false,
        message: `Welche Aufgabe meinst du?\n${lines.join('\n')}`,
      };
    }

    case 'unknown': {
      return {
        success: false,
        message: 'Das habe ich nicht verstanden.\n\n' +
          'Beispiele:\n' +
          '• „Erstelle eine Aufgabe für morgen"\n' +
          '• „Verschiebe alle auf Montag"\n' +
          '• „Was steht heute an?"\n' +
          '• „Markiere das als wichtig"\n\n' +
          'Sag „Was kannst du?" für alle Funktionen.',
      };
    }
  }
}

// ============================================================
// PATTERN QUERY EXECUTION
// ============================================================

function executePatternQuery(intent: PatternQueryIntent, stores: StoreAccess): ExecutionResult {
  switch (intent.queryType) {
    case 'explain_pattern': {
      // Erklaerung warum ein Pattern vorgeschlagen wurde
      if (intent.taskId) {
        const task = stores.tasks.find(t => t.id === intent.taskId);
        if (!task) return { success: false, message: 'Aufgabe nicht gefunden.' };

        // Alle Patterns fuer diese Task
        const taskPatterns = stores.activePatterns.filter(p => p.taskIds.includes(intent.taskId!));
        if (taskPatterns.length === 0) {
          // Kein aktives Pattern, aber vielleicht trotzdem nuetzliche Info
          if (task.postponeCount > 0) {
            return {
              success: true,
              message: `"${task.title}" wurde ${task.postponeCount}x verschoben.` +
                (task.originalDate ? ` Ursprünglich geplant für ${task.originalDate}.` : ''),
            };
          }
          return { success: true, message: `Kein aktives Muster für "${task.title}".` };
        }

        const explanations: string[] = [];
        for (const pattern of taskPatterns) {
          if (pattern.payload.type === 'postpone') {
            explanations.push(
              `Oft verschoben: "${task.title}" wurde ${pattern.payload.postponeCount}x verschoben` +
              ` (ursprünglich ${pattern.payload.originalDate}).`
            );
          } else if (pattern.payload.type === 'deadline') {
            const days = pattern.payload.daysRemaining;
            const status = days < 0
              ? `${Math.abs(days)} Tage überfällig`
              : days === 0 ? 'Deadline ist heute'
              : `noch ${days} Tag${days > 1 ? 'e' : ''} bis zur Deadline`;
            explanations.push(`Deadline-Warnung: ${status}.`);
          } else if (pattern.payload.type === 'autoClient') {
            explanations.push(
              `Kundenerkennung: "${pattern.payload.suggestedClientName}" wurde im Titel erkannt.`
            );
          }
        }
        return { success: true, message: explanations.join('\n') };
      }

      return { success: true, message: 'Nenne eine Aufgabe, zu der ich Muster erklären soll.' };
    }

    case 'list_patterns': {
      const patterns = stores.activePatterns;
      if (patterns.length === 0) {
        return { success: true, message: 'Keine aktiven Muster-Hinweise.' };
      }
      const lines = patterns.map(p => {
        const taskName = stores.tasks.find(t => t.id === p.taskIds[0])?.title || 'Unbekannt';
        const typeLabel = p.patternType === 'postpone' ? 'Verschoben'
          : p.patternType === 'deadlineWarning' ? 'Deadline'
          : 'Kunde';
        return `- [${typeLabel}] ${taskName}: ${p.description}`;
      });
      return {
        success: true,
        message: `${patterns.length} aktive Muster:\n${lines.join('\n')}`,
      };
    }

    case 'pattern_settings': {
      const prefs = stores.patternPreferences;
      const lines = prefs.map(p => {
        const label = p.patternType === 'postpone' ? 'Oft verschoben'
          : p.patternType === 'deadlineWarning' ? 'Deadline-Warnung'
          : 'Kundenerkennung';
        const mode = p.autonomy === 'auto' ? 'Automatisch'
          : p.autonomy === 'ask' ? 'Fragen'
          : 'Aus';
        const threshold = p.threshold ? ` (Schwellwert: ${p.threshold})` : '';
        return `- ${label}: ${mode}${threshold}`;
      });
      return {
        success: true,
        message: `Muster-Einstellungen:\n${lines.join('\n')}\n\nÄnderungen können in den Einstellungen vorgenommen werden.`,
      };
    }
  }
}

// ============================================================
// PATTERN ACTION EXECUTION
// ============================================================

function executePatternAction(intent: PatternActionIntent, stores: StoreAccess): ExecutionResult {
  // Guard: Task-ID erforderlich
  if (!intent.taskId) {
    return { success: false, message: 'Keine Aufgabe referenziert.' };
  }

  const task = stores.tasks.find(t => t.id === intent.taskId);
  if (!task) return { success: false, message: 'Aufgabe nicht gefunden.' };

  // Guard: Task bereits erledigt?
  if (task.status === 'completed') {
    return { success: false, message: `"${task.title}" ist bereits erledigt.` };
  }

  switch (intent.action) {
    case 'mark_optional': {
      // Guard: Bereits optional?
      if (task.isOptional) {
        return { success: false, message: `"${task.title}" ist bereits optional.` };
      }
      stores.updateTask(task.id, { isOptional: true });
      // Pattern akzeptieren falls vorhanden
      const pattern = stores.activePatterns.find(
        p => p.patternType === 'postpone' && p.taskIds.includes(task.id)
      );
      if (pattern) stores.acceptPattern(pattern.id);
      return { success: true, message: `"${task.title}" als optional markiert.` };
    }

    case 'deprioritize': {
      // Guard: Bereits niedrig?
      if (task.priority === 'low') {
        return { success: false, message: `"${task.title}" hat bereits niedrige Priorität.` };
      }
      stores.setTaskPriority(task.id, 'low');
      // Pattern akzeptieren falls vorhanden
      const pattern = stores.activePatterns.find(
        p => p.patternType === 'postpone' && p.taskIds.includes(task.id)
      );
      if (pattern) stores.acceptPattern(pattern.id);
      return { success: true, message: `"${task.title}" auf niedrige Priorität gesetzt.` };
    }

    case 'accept_client': {
      // Pattern mit autoClient fuer diese Task finden
      const pattern = stores.activePatterns.find(
        p => p.patternType === 'autoClient' && p.taskIds.includes(task.id)
      );
      if (!pattern || pattern.payload.type !== 'autoClient') {
        return { success: false, message: 'Kein Kunden-Vorschlag für diese Aufgabe.' };
      }
      // Guard: Task hat bereits Client?
      if (task.clientId) {
        return { success: false, message: `"${task.title}" ist bereits einem Kunden zugeordnet.` };
      }
      stores.updateTask(task.id, { clientId: pattern.payload.suggestedClientId });
      stores.acceptPattern(pattern.id);
      return { success: true, message: `"${task.title}" dem Kunden "${pattern.payload.suggestedClientName}" zugeordnet.` };
    }
  }
}

// ============================================================
// STATS EXECUTION
// ============================================================

function executeStatsQuery(intent: StatsQueryIntent, stores: StoreAccess): ExecutionResult {
  const today = stores.today;

  switch (intent.queryType) {
    case 'today_summary': {
      const todayTasks = stores.tasks.filter(t => t.scheduledDate === today);
      const completed = todayTasks.filter(t => t.status === 'completed').length;
      const total = todayTasks.filter(t => !t.isMeeting).length;
      const meetings = todayTasks.filter(t => t.isMeeting).length;
      const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
      const workTime = stores.getNetWorkTime(today);
      const workStr = formatDuration(workTime);

      return {
        success: true,
        message: `Heute: ${completed}/${total} Aufgaben erledigt (${rate}%)` +
          (meetings > 0 ? `, ${meetings} Meeting${meetings > 1 ? 's' : ''}` : '') +
          (workTime > 0 ? `\nArbeitszeit: ${workStr}` : ''),
      };
    }

    case 'weekly_work_time': {
      const weekTime = stores.getWeeklyWorkTime(today);
      return {
        success: true,
        message: `Arbeitszeit diese Woche: ${formatDuration(weekTime)}`,
      };
    }

    case 'monthly_work_time': {
      const monthTime = stores.getMonthlyWorkTime(today);
      return {
        success: true,
        message: `Arbeitszeit diesen Monat: ${formatDuration(monthTime)}`,
      };
    }

    case 'completion_rate': {
      const todayTasks = stores.tasks.filter(t => t.scheduledDate === today && !t.isMeeting);
      const completed = todayTasks.filter(t => t.status === 'completed').length;
      const total = todayTasks.length;
      const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
      return {
        success: true,
        message: `${completed} von ${total} Aufgaben erledigt (${rate}%).`,
      };
    }

    case 'overdue_count': {
      const overdue = stores.tasks.filter(
        t => t.scheduledDate < today && t.status !== 'completed' && !t.isMeeting
      );
      if (overdue.length === 0) {
        return { success: true, message: 'Keine überfälligen Aufgaben.' };
      }
      return {
        success: true,
        message: `${overdue.length} überfällige Aufgabe${overdue.length > 1 ? 'n' : ''}.`,
      };
    }

    // --- Neue Queries ---

    case 'tasks_today': {
      const tasks = stores.getTasksForDateSorted(today).filter(t => t.status !== 'completed');
      if (tasks.length === 0) {
        return { success: true, message: 'Heute stehen keine Aufgaben an.' };
      }
      const lines = tasks.map(t => {
        const prefix = t.isMeeting && t.meetingTime ? `${t.meetingTime.start} ` : '';
        const prio = t.priority === 'urgent' || t.priority === 'high' ? ` [${formatPriority(t.priority)}]` : '';
        return `- ${prefix}${t.title}${prio}`;
      });
      return {
        success: true,
        message: `Heute stehen ${tasks.length} Aufgaben an:\n${lines.join('\n')}`,
      };
    }

    case 'tasks_tomorrow': {
      const tomorrow = addDays(today, 1);
      const tasks = stores.getTasksForDateSorted(tomorrow).filter(t => t.status !== 'completed');
      if (tasks.length === 0) {
        return { success: true, message: 'Morgen stehen keine Aufgaben an.' };
      }
      const lines = tasks.map(t => {
        const prefix = t.isMeeting && t.meetingTime ? `${t.meetingTime.start} ` : '';
        return `- ${prefix}${t.title}`;
      });
      return {
        success: true,
        message: `Morgen hast du ${tasks.length} Aufgaben:\n${lines.join('\n')}`,
      };
    }

    case 'tasks_week': {
      const todayDate = new Date(today);
      const dayOfWeek = todayDate.getDay();
      // Tage bis Freitag (oder Sonntag falls schon Wochenende)
      const daysUntilEnd = dayOfWeek === 0 ? 0 : Math.max(5 - dayOfWeek, 0);
      let totalOpen = 0;
      const dayLines: string[] = [];
      for (let i = 0; i <= daysUntilEnd; i++) {
        const date = addDays(today, i);
        const tasks = stores.getTasksForDateSorted(date).filter(t => t.status !== 'completed' && !t.isMeeting);
        if (tasks.length > 0) {
          const d = new Date(date);
          const dayName = WEEKDAY_NAMES[d.getDay()] || '';
          dayLines.push(`${dayName}: ${tasks.length} Aufgabe${tasks.length > 1 ? 'n' : ''}`);
          totalOpen += tasks.length;
        }
      }
      if (totalOpen === 0) {
        return { success: true, message: 'Diese Woche sind keine offenen Aufgaben mehr.' };
      }
      return {
        success: true,
        message: `Diese Woche noch ${totalOpen} offene Aufgaben:\n${dayLines.join('\n')}`,
      };
    }

    case 'meetings_today': {
      const meetings = stores.getTasksForDateSorted(today).filter(t => t.isMeeting && t.status !== 'completed');
      if (meetings.length === 0) {
        return { success: true, message: 'Keine Meetings heute.' };
      }
      const lines = meetings.map(t => {
        const time = t.meetingTime ? ` (${t.meetingTime.start}–${t.meetingTime.end})` : '';
        return `- ${t.title}${time}`;
      });
      return {
        success: true,
        message: `${meetings.length} Meeting${meetings.length > 1 ? 's' : ''} heute:\n${lines.join('\n')}`,
      };
    }

    case 'overdue_tasks': {
      const overdue = stores.getUnfinishedTasksBeforeDate(today).filter(t => !t.isMeeting);
      if (overdue.length === 0) {
        return { success: true, message: 'Keine überfälligen Aufgaben.' };
      }
      const lines = overdue.slice(0, 10).map(t => {
        const d = new Date(t.scheduledDate);
        const dayName = WEEKDAY_NAMES[d.getDay()] || '';
        return `- ${t.title} (${dayName}, ${d.getDate()}.)`;
      });
      const more = overdue.length > 10 ? `\n...und ${overdue.length - 10} weitere.` : '';
      return {
        success: true,
        message: `${overdue.length} überfällige Aufgabe${overdue.length > 1 ? 'n' : ''}:\n${lines.join('\n')}${more}`,
      };
    }

    case 'last_completed': {
      const completed = stores.tasks
        .filter(t => t.status === 'completed' && t.completedAt)
        .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));
      if (completed.length === 0) {
        return { success: true, message: 'Noch keine Aufgaben erledigt.' };
      }
      const last = completed[0];
      return {
        success: true,
        message: `Zuletzt erledigt: "${last.title}"`,
      };
    }

    case 'current_client': {
      const inProgress = stores.tasks.filter(t => t.status === 'in_progress');
      if (inProgress.length === 0) {
        return { success: true, message: 'Gerade keine Aufgabe in Bearbeitung.' };
      }
      const task = inProgress[0];
      const client = task.clientId
        ? stores.clients.find(c => c.id === task.clientId)
        : null;
      const clientStr = client ? ` (${client.name})` : '';
      return {
        success: true,
        message: `Du arbeitest gerade an: "${task.title}"${clientStr}`,
      };
    }

    case 'client_list': {
      if (stores.clients.length === 0) {
        return { success: true, message: 'Keine Kunden angelegt.' };
      }
      const lines = stores.clients.map(c => `- ${c.name}`);
      return {
        success: true,
        message: `Deine Kunden:\n${lines.join('\n')}`,
      };
    }

    case 'weekly_completion': {
      const todayDate = new Date(today);
      const dayOfWeek = todayDate.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = addDays(today, mondayOffset);
      let completedCount = 0;
      let totalCount = 0;
      for (let i = 0; i < 7; i++) {
        const date = addDays(monday, i);
        const tasks = stores.tasks.filter(t => t.scheduledDate === date && !t.isMeeting);
        totalCount += tasks.length;
        completedCount += tasks.filter(t => t.status === 'completed').length;
      }
      const rate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
      return {
        success: true,
        message: `Diese Woche: ${completedCount} von ${totalCount} Aufgaben erledigt (${rate}%).`,
      };
    }

    case 'high_priority': {
      const urgent = stores.tasks.filter(
        t => (t.priority === 'urgent' || t.priority === 'high') && t.status !== 'completed'
      );
      if (urgent.length === 0) {
        return { success: true, message: 'Keine dringenden oder wichtigen Aufgaben.' };
      }
      const lines = urgent.slice(0, 10).map(t => {
        const prio = formatPriority(t.priority);
        return `- ${t.title} [${prio}]`;
      });
      const more = urgent.length > 10 ? `\n...und ${urgent.length - 10} weitere.` : '';
      return {
        success: true,
        message: `${urgent.length} dringende/wichtige Aufgabe${urgent.length > 1 ? 'n' : ''}:\n${lines.join('\n')}${more}`,
      };
    }
  }
}

// ============================================================
// FORMAT HELPERS
// ============================================================

function formatDuration(ms: number): string {
  if (ms <= 0) return '0 Min';
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} Min`;
  if (minutes === 0) return `${hours} Std`;
  return `${hours} Std ${minutes} Min`;
}

function formatPriority(priority: TaskPriority): string {
  switch (priority) {
    case 'urgent': return 'Dringend';
    case 'high': return 'Wichtig';
    case 'medium': return 'Mittel';
    case 'low': return 'Niedrig';
  }
}

function formatRecurrence(rule: RecurrenceRule): string {
  switch (rule.type) {
    case 'daily':
      return rule.interval === 1 ? 'täglich' : `alle ${rule.interval} Tage`;
    case 'weekly':
      if (rule.weekDays && rule.weekDays.length > 0) {
        const days = rule.weekDays.map(d => WEEKDAY_NAMES[d] || '').join(', ');
        return rule.interval === 1 ? `jeden ${days}` : `alle ${rule.interval} Wochen (${days})`;
      }
      return rule.interval === 1 ? 'wöchentlich' : `alle ${rule.interval} Wochen`;
    case 'monthly':
      return rule.interval === 1 ? 'monatlich' : `alle ${rule.interval} Monate`;
    case 'yearly':
      return 'jährlich';
    case 'custom':
      return `alle ${rule.customDays} Tage`;
    default:
      return '';
  }
}
