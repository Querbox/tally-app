/**
 * Floating Assistant "Tally" V1
 *
 * LOOP-SICHER:
 * - Kein useEffect
 * - Keine Store-Subscriptions
 * - Nur getState() in Event-Handlern
 * - Keine Timer
 * - Keine window.addEventListener
 */

import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, X, Send, Check, XCircle } from 'lucide-react';
import { useTaskStore } from '../../stores/taskStore';
import { useWorkTimeStore } from '../../stores/workTimeStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { usePatternStore } from '../../stores/patternStore';
import { getTodayString } from '../../utils/dateUtils';
import { generateId } from '../../utils/idUtils';
import {
  parseIntent,
  buildConfirmation,
  executeIntent,
  resolveDate,
  updateConversationContext,
  extractTaskIdFromIntent,
  EMPTY_CONVERSATION_CONTEXT,
  type AssistantMessage,
  type Intent,
  type SuggestIntent,
  type DisambiguateIntent,
  type ConversationContext,
  type StoreAccess,
  type ParseContext,
} from './assistantEngine';

function buildStoreAccess(): StoreAccess {
  const taskState = useTaskStore.getState();
  const workTimeState = useWorkTimeStore.getState();
  const patternState = usePatternStore.getState();
  const today = getTodayString();

  return {
    tasks: taskState.tasks,
    clients: taskState.clients.filter(c => c.isActive).map(c => ({ id: c.id, name: c.name })),
    addTask: taskState.addTask,
    updateTask: taskState.updateTask,
    deleteTask: taskState.deleteTask,
    setTaskPriority: taskState.setTaskPriority,
    addTemplate: taskState.addTemplate,
    getNetWorkTime: workTimeState.getNetWorkTime,
    getWeeklyWorkTime: workTimeState.getWeeklyWorkTime,
    getMonthlyWorkTime: workTimeState.getMonthlyWorkTime,
    getTasksForDateSorted: taskState.getTasksForDateSorted,
    getUnfinishedTasksBeforeDate: taskState.getUnfinishedTasksBeforeDate,
    today,
    // Pattern-Daten (read-only Snapshot)
    activePatterns: patternState.activePatterns,
    patternPreferences: patternState.preferences,
    acceptPattern: patternState.acceptPattern,
  };
}

function buildParseContext(conversationContext: ConversationContext): ParseContext {
  const taskState = useTaskStore.getState();
  const settingsState = useSettingsStore.getState();
  const today = getTodayString();
  return {
    today,
    clients: taskState.clients.filter(c => c.isActive).map(c => ({ id: c.id, name: c.name })),
    expertMode: settingsState.expertModeSettings.enabled,
    conversationContext,
  };
}

function addMessage(
  prev: AssistantMessage[],
  role: 'user' | 'assistant',
  text: string,
  isConfirmation?: boolean
): AssistantMessage[] {
  return [...prev, {
    id: generateId(),
    role,
    text,
    timestamp: Date.now(),
    isConfirmation,
  }];
}

// ============================================================
// WIZARD (Quick Actions)
// ============================================================

type WizardType = 'create_task' | 'move_tasks';

interface WizardState {
  type: WizardType;
  step: number;
  collected: Record<string, string>;
}

interface WizardStepDef {
  key: string;
  question: string;
}

interface WizardDef {
  type: WizardType;
  label: string;
  steps: WizardStepDef[];
}

const WIZARD_DEFS: WizardDef[] = [
  {
    type: 'create_task',
    label: 'Aufgabe erstellen',
    steps: [
      { key: 'title', question: 'Wie soll die Aufgabe heissen?' },
      { key: 'date', question: 'Für wann? (z.B. heute, morgen, Montag)' },
    ],
  },
  {
    type: 'move_tasks',
    label: 'Aufgaben verschieben',
    steps: [
      { key: 'date', question: 'Auf welchen Tag verschieben? (z.B. morgen, Montag)' },
    ],
  },
];

function buildWizardIntent(
  type: WizardType,
  collected: Record<string, string>,
): Intent | null {
  const today = getTodayString();

  switch (type) {
    case 'create_task': {
      const title = collected.title?.trim();
      if (!title) return null;
      const { date } = resolveDate(collected.date || '', today);
      return {
        type: 'create_task',
        confidence: 1.0,
        title,
        date,
        isMeeting: /\b(meeting|call|termin|besprechung)\b/i.test(title),
        meetingTime: undefined,
        clientId: undefined,
        priority: undefined,
      };
    }

    case 'move_tasks': {
      const { date } = resolveDate(collected.date || '', today);
      return {
        type: 'move_tasks',
        confidence: 1.0,
        scope: 'all_open',
        toDate: date,
      };
    }

    default:
      return null;
  }
}

// ============================================================
// COMPONENT
// ============================================================

export function FloatingAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [pendingIntent, setPendingIntent] = useState<Intent | null>(null);
  const [pendingSuggest, setPendingSuggest] = useState<SuggestIntent | null>(null);
  const [pendingDisambiguate, setPendingDisambiguate] = useState<DisambiguateIntent | null>(null);
  const [convContext, setConvContext] = useState<ConversationContext>(EMPTY_CONVERSATION_CONTEXT);
  const [wizard, setWizard] = useState<WizardState | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // =============================================
  // EVENT HANDLERS (einziger Store-Zugriff hier)
  // =============================================

  const handleQuickAction = (type: WizardType) => {
    const def = WIZARD_DEFS.find(d => d.type === type);
    if (!def || def.steps.length === 0) return;

    setWizard({ type, step: 0, collected: {} });
    setMessages(prev => addMessage(prev, 'assistant', def.steps[0].question));
    setTimeout(scrollToBottom, 0);
  };

  /** Fuehrt Intent aus und aktualisiert Kontext */
  const executeAndUpdateContext = (intent: Intent, stores: StoreAccess) => {
    // Task-ID VOR Ausfuehrung extrahieren (bei delete waere sie danach weg)
    const taskId = extractTaskIdFromIntent(intent, stores);
    const result = executeIntent(intent, stores);
    // Kontext aktualisieren
    if (result.success) {
      setConvContext(prev => updateConversationContext(prev, intent, taskId || undefined));
    }
    return result;
  };

  const handleTodaySummary = () => {
    const intent: Intent = { type: 'stats_query', confidence: 1.0, queryType: 'today_summary' };
    const stores = buildStoreAccess();
    const result = executeAndUpdateContext(intent, stores);
    setMessages(prev => {
      let updated = addMessage(prev, 'user', 'Tagesübersicht');
      updated = addMessage(updated, 'assistant', result.message);
      return updated;
    });
    setTimeout(scrollToBottom, 0);
  };

  const handleWizardInput = (userText: string) => {
    if (!wizard) return;

    // Abbrechen erkennen
    if (/^(abbrechen|abbruch|cancel|stop)$/i.test(userText.trim())) {
      setWizard(null);
      setMessages(prev => addMessage(prev, 'assistant', 'Abgebrochen.'));
      setTimeout(scrollToBottom, 0);
      return;
    }

    const def = WIZARD_DEFS.find(d => d.type === wizard.type);
    if (!def) return;

    const currentStep = def.steps[wizard.step];
    const newCollected = { ...wizard.collected, [currentStep.key]: userText };
    const nextStepIndex = wizard.step + 1;

    if (nextStepIndex < def.steps.length) {
      // Naechste Frage
      const nextStep = def.steps[nextStepIndex];
      setWizard({ ...wizard, step: nextStepIndex, collected: newCollected });
      setMessages(prev => addMessage(prev, 'assistant', nextStep.question));
      setTimeout(scrollToBottom, 0);
    } else {
      // Wizard fertig -> Intent bauen -> Confirmation
      setWizard(null);
      const intent = buildWizardIntent(wizard.type, newCollected);
      if (!intent) {
        setMessages(prev => addMessage(prev, 'assistant', 'Das hat nicht geklappt. Versuch es nochmal.'));
        setTimeout(scrollToBottom, 0);
        return;
      }

      const stores = buildStoreAccess();
      const confirmation = buildConfirmation(intent, stores);

      if (confirmation && !confirmation.startsWith('Keine')) {
        setPendingIntent(intent);
        setMessages(prev => addMessage(prev, 'assistant', confirmation, true));
      } else {
        setMessages(prev => addMessage(prev, 'assistant', confirmation || 'Keine Aufgabe gefunden.'));
      }
      setTimeout(scrollToBottom, 0);
    }
  };

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    // User-Nachricht hinzufuegen
    setMessages(prev => addMessage(prev, 'user', trimmed));
    setInput('');

    // Wizard aktiv? -> Input an Wizard weiterleiten
    if (wizard) {
      handleWizardInput(trimmed);
      return;
    }

    // One-Shot Store-Read
    const context = buildParseContext(convContext);
    const intent = parseIntent(trimmed, context);

    // Suggest: Rueckfrage mit Vorschlaegen
    if (intent.type === 'suggest') {
      setPendingSuggest(intent);
      const lines = intent.suggestions.map((s, i) => `${i + 1}. ${s.label}`);
      setMessages(prev => addMessage(prev, 'assistant', `Meintest du:\n${lines.join('\n')}`));
      setTimeout(scrollToBottom, 0);
      return;
    }

    // Disambiguate: Mehrere Tasks -> User muss waehlen
    if (intent.type === 'disambiguate') {
      setPendingDisambiguate(intent);
      const lines = intent.candidates.map((c, i) => `${i + 1}. ${c.title}`);
      setMessages(prev => addMessage(prev, 'assistant', `Welche Aufgabe meinst du?\n${lines.join('\n')}`));
      setTimeout(scrollToBottom, 0);
      return;
    }

    // Stats, ExplainCapabilities, PatternQuery: sofort ausfuehren (read-only)
    if (intent.type === 'stats_query' || intent.type === 'explain_capabilities' || intent.type === 'pattern_query') {
      const stores = buildStoreAccess();
      const result = executeAndUpdateContext(intent, stores);
      setMessages(prev => addMessage(prev, 'assistant', result.message));
      setTimeout(scrollToBottom, 0);
      return;
    }

    // Unknown: Hilfetext
    if (intent.type === 'unknown') {
      const stores = buildStoreAccess();
      const result = executeIntent(intent, stores);
      setMessages(prev => addMessage(prev, 'assistant', result.message));
      setTimeout(scrollToBottom, 0);
      return;
    }

    // Mutation: Bestaetigung einholen
    const stores = buildStoreAccess();
    const confirmation = buildConfirmation(intent, stores);

    if (confirmation && !confirmation.startsWith('Keine')) {
      setPendingIntent(intent);
      setMessages(prev => addMessage(prev, 'assistant', confirmation, true));
    } else {
      setMessages(prev => addMessage(prev, 'assistant', confirmation || 'Keine Aufgabe gefunden.'));
    }
    setTimeout(scrollToBottom, 0);
  };

  const handleSuggestionSelect = (selectedIntent: Intent) => {
    setPendingSuggest(null);

    // Read-only Intents: sofort ausfuehren
    if (selectedIntent.type === 'stats_query' || selectedIntent.type === 'explain_capabilities' || selectedIntent.type === 'pattern_query') {
      const stores = buildStoreAccess();
      const result = executeAndUpdateContext(selectedIntent, stores);
      setMessages(prev => addMessage(prev, 'assistant', result.message));
      setTimeout(scrollToBottom, 0);
      return;
    }

    // Mutation: Bestaetigung einholen
    const stores = buildStoreAccess();
    const confirmation = buildConfirmation(selectedIntent, stores);
    if (confirmation && !confirmation.startsWith('Keine')) {
      setPendingIntent(selectedIntent);
      setMessages(prev => addMessage(prev, 'assistant', confirmation, true));
    } else {
      setMessages(prev => addMessage(prev, 'assistant', confirmation || 'Keine Aufgabe gefunden.'));
    }
    setTimeout(scrollToBottom, 0);
  };

  const handleSuggestionDismiss = () => {
    setPendingSuggest(null);
    setMessages(prev => addMessage(prev, 'assistant', 'Abgebrochen. Versuch es nochmal oder formuliere anders.'));
    setTimeout(scrollToBottom, 0);
  };

  const handleDisambiguateSelect = (taskId: string) => {
    if (!pendingDisambiguate) return;
    setPendingDisambiguate(null);

    // Intent mit gewaehlter Task-ID bauen
    const { originalAction, actionData } = pendingDisambiguate;
    let intent: Intent;
    switch (originalAction) {
      case 'move':
        intent = { type: 'move_tasks', confidence: 1.0, scope: 'by_id', taskId, toDate: actionData.toDate as string };
        break;
      case 'delete':
        intent = { type: 'delete_task', confidence: 1.0, scope: 'by_id', taskId };
        break;
      case 'priority':
        intent = { type: 'set_priority', confidence: 1.0, scope: 'by_id', taskId, priority: actionData.priority as 'high' | 'medium' | 'low' };
        break;
      case 'template':
        intent = { type: 'create_template', confidence: 1.0, scope: 'by_id', taskId };
        break;
      default:
        return;
    }

    // Confirmation einholen
    const stores = buildStoreAccess();
    const confirmation = buildConfirmation(intent, stores);
    if (confirmation && !confirmation.startsWith('Keine')) {
      setPendingIntent(intent);
      setMessages(prev => addMessage(prev, 'assistant', confirmation, true));
    } else {
      setMessages(prev => addMessage(prev, 'assistant', confirmation || 'Aufgabe nicht gefunden.'));
    }
    setTimeout(scrollToBottom, 0);
  };

  const handleDisambiguateDismiss = () => {
    setPendingDisambiguate(null);
    setMessages(prev => addMessage(prev, 'assistant', 'Abgebrochen.'));
    setTimeout(scrollToBottom, 0);
  };

  const handleConfirm = () => {
    if (!pendingIntent) return;

    // Frischer Store-Read (Schutz gegen Stale-State)
    const stores = buildStoreAccess();
    const result = executeAndUpdateContext(pendingIntent, stores);

    setMessages(prev => addMessage(prev, 'assistant', result.message));
    setPendingIntent(null);
    setTimeout(scrollToBottom, 0);
  };

  const handleCancel = () => {
    setPendingIntent(null);
    setMessages(prev => addMessage(prev, 'assistant', 'Abgebrochen.'));
    setTimeout(scrollToBottom, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleToggle = () => {
    setIsOpen(prev => !prev);
  };

  // =============================================
  // RENDER
  // =============================================

  return createPortal(
    <>
      {/* Panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-6 w-96 max-h-[500px] z-40 flex flex-col rounded-2xl shadow-2xl border border-gray-200 bg-white overflow-hidden animate-scale-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-sm font-medium text-gray-700">Tally</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px] max-h-[360px]">
            {messages.length === 0 && (
              <div className="text-center text-gray-400 text-sm py-8">
                <p className="font-medium text-gray-500 mb-2">Hallo! Ich bin Tally.</p>
                <p className="mb-3">Was möchtest du tun?</p>
                <div className="flex flex-wrap justify-center gap-2 mb-4">
                  {WIZARD_DEFS.map((def) => (
                    <button
                      key={def.type}
                      onClick={() => handleQuickAction(def.type)}
                      className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200 transition-colors border border-gray-200"
                    >
                      {def.label}
                    </button>
                  ))}
                  <button
                    onClick={handleTodaySummary}
                    className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200 transition-colors border border-gray-200"
                  >
                    Tagesübersicht
                  </button>
                </div>
                <p className="text-xs text-gray-400">Oder tippe einfach los...</p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {msg.text}

                  {/* Ja/Nein Buttons bei Confirmation */}
                  {msg.isConfirmation && pendingIntent && msg.id === messages[messages.length - 1]?.id && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={handleConfirm}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 transition-colors"
                      >
                        <Check className="w-3 h-3" />
                        Ja
                      </button>
                      <button
                        onClick={handleCancel}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white text-gray-700 text-xs font-medium border border-gray-300 hover:bg-gray-50 transition-colors"
                      >
                        <XCircle className="w-3 h-3" />
                        Nein
                      </button>
                    </div>
                  )}

                  {/* Vorschlag-Buttons bei niedriger Confidence */}
                  {pendingSuggest && msg.id === messages[messages.length - 1]?.id && (
                    <div className="flex flex-col gap-1.5 mt-2">
                      {pendingSuggest.suggestions.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => handleSuggestionSelect(s.intent)}
                          className="text-left px-3 py-1.5 rounded-lg bg-white text-gray-700 text-xs font-medium border border-gray-300 hover:bg-gray-50 transition-colors"
                        >
                          {s.label}
                        </button>
                      ))}
                      <button
                        onClick={handleSuggestionDismiss}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white text-gray-400 text-xs border border-gray-200 hover:bg-gray-50 transition-colors"
                      >
                        <XCircle className="w-3 h-3" />
                        Keins davon
                      </button>
                    </div>
                  )}

                  {/* Disambiguierung: Task-Auswahl bei Mehrdeutigkeit */}
                  {pendingDisambiguate && msg.id === messages[messages.length - 1]?.id && (
                    <div className="flex flex-col gap-1.5 mt-2">
                      {pendingDisambiguate.candidates.map((c, i) => (
                        <button
                          key={c.taskId}
                          onClick={() => handleDisambiguateSelect(c.taskId)}
                          className="text-left px-3 py-1.5 rounded-lg bg-white text-gray-700 text-xs font-medium border border-gray-300 hover:bg-gray-50 transition-colors"
                        >
                          {i + 1}. {c.title}
                        </button>
                      ))}
                      <button
                        onClick={handleDisambiguateDismiss}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white text-gray-400 text-xs border border-gray-200 hover:bg-gray-50 transition-colors"
                      >
                        <XCircle className="w-3 h-3" />
                        Abbrechen
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={pendingIntent || pendingSuggest || pendingDisambiguate ? 'Warte auf Auswahl...' : wizard ? 'Antwort eingeben...' : 'Was soll ich tun?'}
                disabled={!!pendingIntent || !!pendingSuggest || !!pendingDisambiguate}
                className="flex-1 text-sm text-gray-900 placeholder-gray-400 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent disabled:opacity-50"
              />
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || !!pendingIntent || !!pendingSuggest || !!pendingDisambiguate}
                className="p-2 rounded-xl bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={handleToggle}
        className="fixed bottom-6 right-20 z-40 w-12 h-12 rounded-full bg-gray-900 text-white shadow-lg hover:bg-gray-800 hover:shadow-xl transition-all flex items-center justify-center animate-fade-in-scale"
        title="Tally Assistant"
      >
        {isOpen ? (
          <X className="w-5 h-5" />
        ) : (
          <MessageCircle className="w-5 h-5" />
        )}
      </button>
    </>,
    document.body
  );
}
