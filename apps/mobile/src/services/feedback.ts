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

let webAudioUnlocked = false;

/**
 * Browsers reject `HTMLMediaElement.play()` unless it runs synchronously
 * inside a real user gesture — every sound here fires later, from a
 * `useEffect` after an async verdict check, so without this every play()
 * call would fail silently (the rejection happens inside expo-audio's web
 * player, a layer below anything this module can catch). Playing-and-
 * immediately-pausing each cached player once, directly inside a genuine
 * tap handler, unlocks those same elements for programmatic playback for
 * the rest of the session — call this from the earliest reliable tap.
 */
export function unlockWebAudio(): void {
  if (webAudioUnlocked || Platform.OS !== 'web') return;
  webAudioUnlocked = true;
  for (const name of Object.keys(clips) as ClipName[]) {
    try {
      const player = playerFor(name);
      player.play();
      player.pause();
    } catch {
      // Best-effort priming — a failure here just means the first real
      // chime might also be silent, not that anything is broken.
    }
  }
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
  unlockWebAudio();
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
