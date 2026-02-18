import { useEffect, useRef } from 'react';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { useTaskStore } from '../stores/taskStore';
import { useSettingsStore } from '../stores/settingsStore';
import { playGlobalSound, initGlobalSounds } from './useSounds';
import { getTodayString } from '../utils/dateUtils';
import type { Task } from '../types';

/**
 * Meeting-Benachrichtigungen.
 *
 * Gleiche Stabilisierungsstrategie wie usePatternDetection:
 * - checkMeetings ist eine reine Funktion, liest Store-Daten via getState()
 * - useEffect hat nur primitive/stabile Dependencies
 * - Interval wird nur 1x erstellt, nicht bei jeder Task-Änderung neu
 */
export function useNotifications() {
  const notificationsEnabled = useSettingsStore((s) => s.notificationSettings.enabled);
  const meetingReminders = useSettingsStore((s) => s.notificationSettings.meetingReminders);
  const notifiedMeetingsRef = useRef<Set<string>>(new Set());
  const permissionGrantedRef = useRef(false);

  // Request notification permission on mount
  useEffect(() => {
    async function checkPermission() {
      try {
        let granted = await isPermissionGranted();
        if (!granted) {
          const permission = await requestPermission();
          granted = permission === 'granted';
        }
        permissionGrantedRef.current = granted;
      } catch {
        // Not running in Tauri or permission denied
        permissionGrantedRef.current = false;
      }
    }

    checkPermission();
    initGlobalSounds();
  }, []);

  // Check for upcoming meetings every 30 seconds
  // Stabile Dependencies: nur primitive Booleans, kein Objekt/Array/Funktion
  useEffect(() => {
    if (!notificationsEnabled || !meetingReminders) {
      return;
    }

    const checkMeetings = () => {
      // Lese aktuelle Daten direkt aus den Stores (stabil, keine React-Deps)
      const tasks = useTaskStore.getState().tasks;
      const notificationSettings = useSettingsStore.getState().notificationSettings;

      const now = new Date();
      const todayStr = getTodayString();
      const reminderIntervals = notificationSettings.reminderIntervals;

      const todayMeetings = tasks.filter(
        (task: Task) =>
          task.isMeeting &&
          task.meetingTime &&
          task.scheduledDate === todayStr &&
          task.status !== 'completed'
      );

      todayMeetings.forEach((meeting: Task) => {
        if (!meeting.meetingTime) return;

        const [hours, minutes] = meeting.meetingTime.start.split(':').map(Number);
        const meetingTime = new Date(now);
        meetingTime.setHours(hours, minutes, 0, 0);

        const diffMinutes = Math.round(
          (meetingTime.getTime() - now.getTime()) / 60000
        );

        reminderIntervals.forEach((interval) => {
          const notificationKey = `${meeting.id}-${interval}`;

          if (
            diffMinutes <= interval &&
            diffMinutes > interval - 1 &&
            !notifiedMeetingsRef.current.has(notificationKey)
          ) {
            notifiedMeetingsRef.current.add(notificationKey);

            let timeText: string;
            if (interval === 1) {
              timeText = 'in 1 Minute';
            } else {
              timeText = `in ${interval} Minuten`;
            }

            sendMeetingNotificationFn(
              permissionGrantedRef.current,
              `Meeting: ${meeting.title}`,
              `Startet ${timeText} um ${meeting.meetingTime!.start} Uhr`
            );
          }
        });

        const startingNowKey = `${meeting.id}-now`;
        if (
          diffMinutes <= 0 &&
          diffMinutes > -1 &&
          !notifiedMeetingsRef.current.has(startingNowKey)
        ) {
          notifiedMeetingsRef.current.add(startingNowKey);
          sendMeetingNotificationFn(
            permissionGrantedRef.current,
            `Meeting startet jetzt!`,
            `${meeting.title} - ${meeting.meetingTime!.start} Uhr`
          );
        }
      });

      // Clean up old notifications (older than 1 hour)
      const oneHourAgo = now.getTime() - 3600000;
      notifiedMeetingsRef.current.forEach((key) => {
        const meetingId = key.split('-')[0];
        const meeting = tasks.find((t: Task) => t.id === meetingId);
        if (meeting && meeting.meetingTime) {
          const [hours, minutes] = meeting.meetingTime.start.split(':').map(Number);
          const meetingTimeDate = new Date(now);
          meetingTimeDate.setHours(hours, minutes, 0, 0);
          if (meetingTimeDate.getTime() < oneHourAgo) {
            notifiedMeetingsRef.current.delete(key);
          }
        }
      });
    };

    // Initial check
    checkMeetings();

    // Check every 30 seconds
    const interval = setInterval(checkMeetings, 30000);

    return () => clearInterval(interval);
  }, [notificationsEnabled, meetingReminders]);
}

/** Reine Hilfsfunktion (kein Hook, keine React-Deps) */
async function sendMeetingNotificationFn(
  permissionGranted: boolean,
  title: string,
  body: string,
) {
  playGlobalSound('meetingReminder');

  const notificationSettings = useSettingsStore.getState().notificationSettings;
  if (permissionGranted && notificationSettings.enabled) {
    try {
      await sendNotification({ title, body });
    } catch {
      // Notification failed, sound still played
    }
  }
}
