import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useSettingsStore } from '@/store/settings';
import correctSound from '../../assets/sounds/correct.wav';
import incorrectSound from '../../assets/sounds/incorrect.wav';
import completeSound from '../../assets/sounds/complete.wav';

/**
 * Short UI feedback: the correct/incorrect/complete sounds and the haptic
 * pulses that go with them. Separate from `services/audio.ts`, which plays
 * lesson content — these are fixed clips bundled with the app, not fetched
 * per-lesson, and both respect the settings the store already exposed
 * (`hapticsEnabled`, `soundEffectsEnabled`) before anything used them.
 */

const clips = {
  correct: correctSound,
  incorrect: incorrectSound,
  complete: completeSound,
} as const;

type ClipName = keyof typeof clips;

let audioModeReady: Promise<void> | null = null;
const players = new Map<ClipName, AudioPlayer>();

function ensureAudioMode(): Promise<void> {
  if (!audioModeReady) {
    audioModeReady = setAudioModeAsync({
      playsInSilentMode: true,
      shouldRouteThroughEarpiece: false,
      allowsRecording: false,
    });
  }
  return audioModeReady;
}

function playerFor(name: ClipName): AudioPlayer {
  let player = players.get(name);
  if (!player) {
    player = createAudioPlayer(clips[name]);
    players.set(name, player);
  }
  return player;
}

async function playClip(name: ClipName): Promise<void> {
  if (!useSettingsStore.getState().soundEffectsEnabled) return;
  try {
    await ensureAudioMode();
    const player = playerFor(name);
    await player.seekTo(0);
    player.play();
  } catch {
    // A missing audio device or a background app state losing focus is not
    // worth surfacing — silence just means no chime, not a broken lesson.
  }
}

function haptic(kind: 'light' | 'success' | 'warning'): void {
  if (!useSettingsStore.getState().hapticsEnabled) return;
  if (Platform.OS === 'web') return; // no vibration API path expo-haptics can use on web
  switch (kind) {
    case 'light':
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    case 'success':
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    case 'warning':
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }
}

/** A card or other non-Button pressable was tapped — Button handles its own. */
export function feedbackTap(): void {
  haptic('light');
}

/** An answer was marked correct. */
export function feedbackCorrect(): void {
  haptic('success');
  void playClip('correct');
}

/** An answer was marked incorrect. */
export function feedbackIncorrect(): void {
  haptic('warning');
  void playClip('incorrect');
}

/** A lesson was finished. */
export function feedbackLessonComplete(): void {
  haptic('success');
  void playClip('complete');
}
