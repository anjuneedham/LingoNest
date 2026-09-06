import { Platform } from 'react-native';

/**
 * Speech recognition.
 *
 * Availability is a real question, not an assumption: a device may have no
 * recogniser, no permission, or no offline model for the target language. The
 * app asks first and degrades honestly — a speaking activity without a
 * recogniser becomes listen-and-compare, recorded but unscored, and says so
 * (brief §24).
 */

export interface SpeechResult {
  readonly transcript: string;
  readonly confidence?: number;
  /** True when no recogniser was available and the learner self-assessed. */
  readonly selfReported: boolean;
}

export type SpeechAvailability =
  | { readonly available: true }
  | { readonly available: false; readonly reason: 'unsupported_platform' | 'no_permission' | 'language_unsupported' };

/**
 * Native speech recognition needs a config plugin and a dev build; Expo Go
 * cannot provide it. Rather than pretend, the module reports what it can do and
 * the UI adapts.
 */
interface SpeechModule {
  isAvailable(languageTag: string): Promise<boolean>;
  requestPermission(): Promise<boolean>;
  start(languageTag: string, onPartial?: (text: string) => void): Promise<void>;
  stop(): Promise<SpeechResult>;
  cancel(): Promise<void>;
}

let module: SpeechModule | null = null;

/** Registered at startup by a native build that includes a recogniser. */
export function registerSpeechModule(implementation: SpeechModule): void {
  module = implementation;
}

export async function checkAvailability(languageTag: string): Promise<SpeechAvailability> {
  if (!module) return { available: false, reason: 'unsupported_platform' };
  if (Platform.OS === 'web') return { available: false, reason: 'unsupported_platform' };

  const permitted = await module.requestPermission();
  if (!permitted) return { available: false, reason: 'no_permission' };

  const supported = await module.isAvailable(languageTag);
  if (!supported) return { available: false, reason: 'language_unsupported' };

  return { available: true };
}

export async function startListening(
  languageTag: string,
  onPartial?: (text: string) => void,
): Promise<void> {
  if (!module) throw new Error('speech recognition is not available on this device');
  await module.start(languageTag, onPartial);
}

export async function stopListening(): Promise<SpeechResult> {
  if (!module) return { transcript: '', selfReported: true };
  return module.stop();
}

export async function cancelListening(): Promise<void> {
  await module?.cancel();
}

/** BCP-47 tag for a language plus regional variant, e.g. es-MX. */
export function speechTagFor(languageCode: string, variantCode?: string | null): string {
  if (variantCode && variantCode.includes('-')) return variantCode;
  const defaults: Record<string, string> = {
    es: 'es-419',
    en: 'en-US',
    fr: 'fr-FR',
    ja: 'ja-JP',
    de: 'de-DE',
    pt: 'pt-BR',
    it: 'it-IT',
    ko: 'ko-KR',
    zh: 'zh-CN',
  };
  return defaults[languageCode] ?? languageCode;
}
