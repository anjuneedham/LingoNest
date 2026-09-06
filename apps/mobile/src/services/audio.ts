import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';
import { supabase } from './supabase';

/**
 * Lesson audio.
 *
 * Recorded audio from the content library is preferred, because a real voice at
 * a controlled speed is better material than a synthesiser. Where a lesson has
 * no recording — a sentence an author wrote without commissioning audio — the
 * device speech synthesiser stands in rather than the activity silently having
 * no sound.
 */

let configured = false;
let current: AudioPlayer | null = null;

async function ensureAudioMode(): Promise<void> {
  if (configured) return;
  await setAudioModeAsync({
    playsInSilentMode: true, // a learner with their phone on silent still needs to hear the lesson
    shouldRouteThroughEarpiece: false,
    allowsRecording: false,
  });
  configured = true;
}

const urlCache = new Map<string, string>();

/** Resolves an asset key to a signed URL from private storage. */
export async function resolveAudioUrl(assetKey: string): Promise<string | null> {
  const cached = urlCache.get(assetKey);
  if (cached) return cached;

  const { data: asset } = await supabase
    .from('media_assets')
    .select('storage_path')
    .eq('key', assetKey)
    .maybeSingle();

  if (!asset) return null;

  const { data } = await supabase.storage.from('lesson-media').createSignedUrl(asset.storage_path, 3600);
  if (!data?.signedUrl) return null;

  urlCache.set(assetKey, data.signedUrl);
  return data.signedUrl;
}

export interface PlayOptions {
  /** Slows playback for beginners without needing a separate recording. */
  readonly rate?: number;
  /** Language tag, used when falling back to the speech synthesiser. */
  readonly languageTag?: string;
  /** Text to speak if there is no recording for this asset. */
  readonly fallbackText?: string;
}

export async function playAudio(assetKey: string | null, options: PlayOptions = {}): Promise<void> {
  await ensureAudioMode();
  stopAudio();

  const url = assetKey ? await resolveAudioUrl(assetKey) : null;

  if (!url) {
    if (options.fallbackText) {
      Speech.speak(options.fallbackText, {
        language: options.languageTag,
        rate: options.rate ?? 0.85,
      });
    }
    return;
  }

  const player = createAudioPlayer({ uri: url });
  current = player;
  if (options.rate && options.rate !== 1) {
    player.setPlaybackRate(options.rate);
  }
  player.play();
}

/** Speaks text directly — used for pronunciation models the library lacks. */
export async function speak(text: string, languageTag: string, rate = 0.85): Promise<void> {
  Speech.stop();
  Speech.speak(text, { language: languageTag, rate });
}

export function stopAudio(): void {
  Speech.stop();
  if (current) {
    current.remove();
    current = null;
  }
}

/** Playback rate for a listening speed, so one recording serves three levels. */
export function rateForSpeed(speed: 'slow' | 'normal' | 'natural'): number {
  return { slow: 0.75, normal: 1, natural: 1.15 }[speed];
}
