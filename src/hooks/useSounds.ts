import { useCallback } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

// Sound effect types
export type SoundType =
  | 'taskComplete'
  | 'taskDelete'
  | 'timerStart'
  | 'timerStop'
  | 'meetingReminder'
  | 'notification';

// Audio context for generating sounds
let audioContext: AudioContext | null = null;
let masterGainNode: GainNode | null = null;

function getAudioContext(): AudioContext {
  // Check if context exists and is in a usable state
  if (audioContext && audioContext.state === 'closed') {
    // Context was closed, need to recreate
    audioContext = null;
    masterGainNode = null;
  }

  if (!audioContext) {
    audioContext = new AudioContext();
    masterGainNode = audioContext.createGain();
    masterGainNode.connect(audioContext.destination);
  }
  return audioContext;
}

function getMasterGain(): GainNode {
  getAudioContext();
  return masterGainNode!;
}

function setVolume(volume: number) {
  const gain = getMasterGain();
  const ctx = getAudioContext();
  gain.gain.setValueAtTime(volume, ctx.currentTime);
}

// Generate a pleasant "bling" sound for task completion
function playTaskCompleteSound() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  const master = getMasterGain();

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const localGain = ctx.createGain();

  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(880, now);
  osc1.frequency.setValueAtTime(1318.5, now + 0.1);

  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(1108.73, now);
  osc2.frequency.setValueAtTime(1760, now + 0.1);

  localGain.gain.setValueAtTime(0, now);
  localGain.gain.linearRampToValueAtTime(0.3, now + 0.02);
  localGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

  osc1.connect(localGain);
  osc2.connect(localGain);
  localGain.connect(master);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.4);
  osc2.stop(now + 0.4);
}

// Soft "whoosh" sound for task deletion
function playTaskDeleteSound() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  const master = getMasterGain();

  const osc = ctx.createOscillator();
  const localGain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(400, now);
  osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2000, now);
  filter.frequency.exponentialRampToValueAtTime(200, now + 0.2);

  localGain.gain.setValueAtTime(0.15, now);
  localGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

  osc.connect(filter);
  filter.connect(localGain);
  localGain.connect(master);

  osc.start(now);
  osc.stop(now + 0.25);
}

// Quick "click" sound for timer start
function playTimerStartSound() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  const master = getMasterGain();

  const osc = ctx.createOscillator();
  const localGain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(660, now);
  osc.frequency.setValueAtTime(880, now + 0.05);

  localGain.gain.setValueAtTime(0, now);
  localGain.gain.linearRampToValueAtTime(0.25, now + 0.01);
  localGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

  osc.connect(localGain);
  localGain.connect(master);

  osc.start(now);
  osc.stop(now + 0.15);
}

// Double "click" sound for timer stop
function playTimerStopSound() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  const master = getMasterGain();

  [0, 0.08].forEach((delay) => {
    const osc = ctx.createOscillator();
    const localGain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now + delay);
    osc.frequency.setValueAtTime(660, now + delay + 0.05);

    localGain.gain.setValueAtTime(0, now + delay);
    localGain.gain.linearRampToValueAtTime(0.2, now + delay + 0.01);
    localGain.gain.exponentialRampToValueAtTime(0.01, now + delay + 0.12);

    osc.connect(localGain);
    localGain.connect(master);

    osc.start(now + delay);
    osc.stop(now + delay + 0.12);
  });
}

// Generate a soft chime for meeting reminders
function playMeetingReminderSound() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  const master = getMasterGain();

  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5

  notes.forEach((freq, index) => {
    const osc = ctx.createOscillator();
    const localGain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    const startTime = now + index * 0.15;
    localGain.gain.setValueAtTime(0, startTime);
    localGain.gain.linearRampToValueAtTime(0.2, startTime + 0.05);
    localGain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.6);

    osc.connect(localGain);
    localGain.connect(master);

    osc.start(startTime);
    osc.stop(startTime + 0.6);
  });
}

// Generic notification sound
function playNotificationSound() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  const master = getMasterGain();

  const osc = ctx.createOscillator();
  const localGain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(587.33, now);
  osc.frequency.setValueAtTime(784, now + 0.1);

  localGain.gain.setValueAtTime(0, now);
  localGain.gain.linearRampToValueAtTime(0.25, now + 0.02);
  localGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

  osc.connect(localGain);
  localGain.connect(master);

  osc.start(now);
  osc.stop(now + 0.3);
}

async function playSoundByType(type: SoundType, volume: number) {
  try {
    // Ensure audio context exists
    const ctx = getAudioContext();

    // Resume audio context if suspended (must await!)
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // Double-check context is running
    if (ctx.state !== 'running') {
      console.warn('AudioContext not running, state:', ctx.state);
      return;
    }

    setVolume(volume);

    switch (type) {
      case 'taskComplete':
        playTaskCompleteSound();
        break;
      case 'taskDelete':
        playTaskDeleteSound();
        break;
      case 'timerStart':
        playTimerStartSound();
        break;
      case 'timerStop':
        playTimerStopSound();
        break;
      case 'meetingReminder':
        playMeetingReminderSound();
        break;
      case 'notification':
        playNotificationSound();
        break;
    }
  } catch (e) {
    console.warn('Could not play sound:', e);
  }
}

export function useSounds() {
  const soundSettings = useSettingsStore((state) => state.soundSettings);

  const playSound = useCallback(
    (type: SoundType) => {
      if (!soundSettings.enabled) return;

      const soundEnabled: Record<SoundType, boolean> = {
        taskComplete: soundSettings.taskComplete,
        taskDelete: soundSettings.taskDelete,
        timerStart: soundSettings.timerStart,
        timerStop: soundSettings.timerStop,
        meetingReminder: soundSettings.meetingReminder,
        notification: soundSettings.notification,
      };

      if (!soundEnabled[type]) return;

      playSoundByType(type, soundSettings.volume);
    },
    [soundSettings]
  );

  return { playSound };
}

// Initialize audio context (call on first user interaction)
export async function initGlobalSounds() {
  try {
    const ctx = getAudioContext();
    // Try to resume immediately if suspended
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    // Play a silent sound to fully unlock the audio context
    if (ctx.state === 'running') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime); // Silent
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.001);
    }
  } catch (e) {
    console.warn('Could not initialize AudioContext:', e);
  }
}

// Play sound globally (checks settings from store)
export function playGlobalSound(type: SoundType) {
  const soundSettings = useSettingsStore.getState().soundSettings;

  if (!soundSettings.enabled) return;

  const soundEnabled: Record<SoundType, boolean> = {
    taskComplete: soundSettings.taskComplete,
    taskDelete: soundSettings.taskDelete,
    timerStart: soundSettings.timerStart,
    timerStop: soundSettings.timerStop,
    meetingReminder: soundSettings.meetingReminder,
    notification: soundSettings.notification,
  };

  if (!soundEnabled[type]) return;

  playSoundByType(type, soundSettings.volume);
}
