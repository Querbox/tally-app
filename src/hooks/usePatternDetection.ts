import { useEffect, useRef } from 'react';
import { useTaskStore } from '../stores/taskStore';
import { usePatternStore } from '../stores/patternStore';
import { generateId } from '../utils/idUtils';
import type { DetectedPattern } from '../types';

/**
 * Globaler Pattern-Detection Hook
 *
 * Läuft bei App-Start, alle 5 Minuten und debounced bei Task-Änderungen.
 * V1-Kern: Postpone + Deadline-Warnung (AutoClient default off, Expert-Feature).
 *
 * Bewusst einfache binäre Schwellen — kein Over-Engineering für 2 aktive Patterns.
 *
 * WICHTIG: runDetection liest ALLE Daten via getState() um instabile
 * React-Dependencies zu vermeiden (verhindert Re-Render-Loops).
 */

const DETECTION_INTERVAL_MS = 5 * 60 * 1000;
const DEBOUNCE_MS = 2000;

export function usePatternDetection() {
  // Nur tasks.length subscriben für Debounce-Trigger (primitiver Wert, stabil)
  const taskCount = useTaskStore((s) => s.tasks.length);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const runDetectionRef = useRef(runDetection);
  runDetectionRef.current = runDetection;

  // Initialer Lauf + Intervall (stabile deps, läuft nur 1x)
  useEffect(() => {
    const initialTimer = setTimeout(() => runDetectionRef.current(), 1000);
    const interval = setInterval(() => runDetectionRef.current(), DETECTION_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  // Re-run bei Task-Änderungen (debounced, nur wenn sich Anzahl ändert)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runDetectionRef.current(), DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [taskCount]);
}

/**
 * Reine Funktion: liest alle Daten direkt aus den Stores via getState().
 * Keine React-Dependencies, keine Hooks, keine Re-Render-Probleme.
 */
function runDetection() {
  const { getPreference, canShowPattern, replaceActivePatterns, recordPatternShown } =
    usePatternStore.getState();
  const { tasks, clients, updateTask } = useTaskStore.getState();

  const now = new Date();
  const detected: DetectedPattern[] = [];

  // =============================================
  // POSTPONE: Oft verschobene Aufgaben
  // Schwelle: postponeCount >= 3
  // =============================================
  const postponePref = getPreference('postpone');
  const postponeThreshold = postponePref.threshold ?? 3;

  if (postponePref.autonomy !== 'off') {
    const chronicPostponers = tasks.filter(
      (t) =>
        t.status !== 'completed' &&
        !t.isMeeting &&
        !t.isOptional &&
        t.postponeCount >= postponeThreshold
    );

    for (const task of chronicPostponers) {
      if (!canShowPattern('postpone', task.id)) continue;

      // Auto-Modus: direkt als optional markieren
      if (postponePref.autonomy === 'auto' && !task.isOptional) {
        updateTask(task.id, { isOptional: true });
        recordPatternShown();

        detected.push({
          id: generateId(),
          patternType: 'postpone',
          taskIds: [task.id],
          title: `"${task.title}" automatisch als optional markiert`,
          description: `Schon ${task.postponeCount}x verschoben. Wurde als optional eingestuft.`,
          detectedAt: now.toISOString(),
          renderTarget: 'toast',
          priority: 'medium',
          payload: {
            type: 'postpone',
            taskId: task.id,
            postponeCount: task.postponeCount,
            originalDate: task.originalDate || task.scheduledDate,
            suggestedActions: ['markOptional'],
          },
        });
        continue;
      }

      // Ask-Modus: Nutzer fragen
      detected.push({
        id: generateId(),
        patternType: 'postpone',
        taskIds: [task.id],
        title: `"${task.title}" wurde ${task.postponeCount}x verschoben`,
        description:
          'Soll die Aufgabe als optional markiert, verschoben oder gelöscht werden?',
        detectedAt: now.toISOString(),
        renderTarget: 'inline',
        priority: task.postponeCount >= 5 ? 'high' : 'medium',
        payload: {
          type: 'postpone',
          taskId: task.id,
          postponeCount: task.postponeCount,
          originalDate: task.originalDate || task.scheduledDate,
          suggestedActions: ['markOptional', 'reschedule', 'delete', 'deprioritize'],
        },
      });
    }
  }

  // =============================================
  // DEADLINE: Warnung ohne Fortschritt
  // Schwelle: daysRemaining <= threshold UND progress < 50%
  // Schließt überfällige Tasks ein
  // =============================================
  const deadlinePref = getPreference('deadlineWarning');
  const deadlineDaysThreshold = deadlinePref.threshold ?? 2;

  if (deadlinePref.autonomy !== 'off') {
    const tasksWithDeadline = tasks.filter(
      (t) => t.deadline && t.status !== 'completed' && !t.isMeeting
    );

    for (const task of tasksWithDeadline) {
      const deadline = new Date(task.deadline!);
      const daysRemaining = Math.ceil(
        (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysRemaining > deadlineDaysThreshold) continue;

      const subtasksCompleted = task.subtasks.filter((s) => s.isCompleted).length;
      const subtasksTotal = task.subtasks.length;
      const hasTimeTracked =
        task.timeEntries.length > 0 &&
        task.timeEntries.some((e) => (e.duration || 0) > 0);

      const hasProgress =
        subtasksTotal > 0
          ? subtasksCompleted / subtasksTotal > 0.5
          : hasTimeTracked;

      // Überfällige Tasks immer anzeigen, sonst nur ohne Fortschritt
      if (daysRemaining >= 0 && hasProgress) continue;
      if (!canShowPattern('deadlineWarning', task.id)) continue;

      const daysLabel =
        daysRemaining < 0
          ? `${Math.abs(daysRemaining)} Tag${Math.abs(daysRemaining) !== 1 ? 'e' : ''} überfällig`
          : daysRemaining === 0
            ? 'heute'
            : daysRemaining === 1
              ? 'morgen'
              : `in ${daysRemaining} Tagen`;

      detected.push({
        id: generateId(),
        patternType: 'deadlineWarning',
        taskIds: [task.id],
        title: daysRemaining < 0
          ? `"${task.title}" ist ${daysLabel}!`
          : `Deadline für "${task.title}" ${daysLabel}`,
        description:
          subtasksTotal > 0
            ? `Erst ${subtasksCompleted} von ${subtasksTotal} Teilaufgaben erledigt.`
            : hasTimeTracked
              ? 'Wenig Fortschritt bei erfasster Zeit.'
              : 'Noch kein Fortschritt erkennbar.',
        detectedAt: now.toISOString(),
        renderTarget: 'inline',
        priority: daysRemaining <= 0 ? 'high' : 'medium',
        payload: {
          type: 'deadline',
          taskId: task.id,
          deadline: task.deadline!,
          daysRemaining,
          subtasksCompleted,
          subtasksTotal,
          hasTimeTracked,
        },
      });
    }
  }

  // =============================================
  // AUTOCLIENT: Kundenname im Titel erkannt
  // Default: off (Expert-Feature)
  // =============================================
  const autoClientPref = getPreference('autoClient');

  if (autoClientPref.autonomy !== 'off' && clients.length > 0) {
    const activeClients = clients.filter((c) => c.isActive && c.name.length >= 3);
    const tasksWithoutClient = tasks.filter(
      (t) => !t.clientId && t.status !== 'completed' && !t.isMeeting
    );

    for (const task of tasksWithoutClient) {
      const titleLower = task.title.toLowerCase();
      let matchedClient: { id: string; name: string } | null = null;

      for (const client of activeClients) {
        const nameLower = client.name.toLowerCase();
        const matchIndex = titleLower.indexOf(nameLower);
        if (matchIndex === -1) continue;

        // Wortgrenzen prüfen
        const charBefore = matchIndex > 0 ? titleLower[matchIndex - 1] : ' ';
        const charAfter =
          matchIndex + nameLower.length < titleLower.length
            ? titleLower[matchIndex + nameLower.length]
            : ' ';
        const isBoundary = (ch: string) => /[\s\-_.:,;!?()[\]/]/.test(ch);
        const leftOk = matchIndex === 0 || isBoundary(charBefore);
        const rightOk =
          matchIndex + nameLower.length === titleLower.length || isBoundary(charAfter);

        if (leftOk && rightOk) {
          matchedClient = { id: client.id, name: client.name };
          break;
        }
      }

      if (!matchedClient) continue;
      if (!canShowPattern('autoClient', task.id)) continue;

      if (autoClientPref.autonomy === 'auto') {
        updateTask(task.id, { clientId: matchedClient.id });
        recordPatternShown();
        detected.push({
          id: generateId(),
          patternType: 'autoClient',
          taskIds: [task.id],
          title: `"${task.title}" → ${matchedClient.name}`,
          description: `Kunde "${matchedClient.name}" automatisch zugeordnet.`,
          detectedAt: now.toISOString(),
          renderTarget: 'toast',
          priority: 'low',
          payload: {
            type: 'autoClient',
            taskId: task.id,
            suggestedClientId: matchedClient.id,
            suggestedClientName: matchedClient.name,
          },
        });
        continue;
      }

      detected.push({
        id: generateId(),
        patternType: 'autoClient',
        taskIds: [task.id],
        title: `"${matchedClient.name}" erkannt`,
        description: `Kunde "${matchedClient.name}" im Titel erkannt. Zuordnen?`,
        detectedAt: now.toISOString(),
        renderTarget: 'inline',
        priority: 'low',
        payload: {
          type: 'autoClient',
          taskId: task.id,
          suggestedClientId: matchedClient.id,
          suggestedClientName: matchedClient.name,
        },
      });
    }
  }

  // Vermeide unnötige Store-Updates: nur ersetzen wenn sich Patterns geändert haben
  const currentPatterns = usePatternStore.getState().activePatterns;
  const hasChanged =
    detected.length !== currentPatterns.length ||
    detected.some((d, i) => {
      const c = currentPatterns[i];
      return !c || d.patternType !== c.patternType || d.taskIds[0] !== c.taskIds[0];
    });

  if (hasChanged) {
    replaceActivePatterns(detected);
  }
}
