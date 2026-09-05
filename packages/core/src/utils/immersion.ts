/**
 * Immersion mode (brief §81).
 *
 * The learner chooses how much of the interface and instruction appears in the
 * target language. This is deterministic per key so the same element does not
 * flip languages between renders — a UI that changes language on every re-render
 * is unusable.
 */

export const IMMERSION_LEVELS = [0, 25, 50, 75, 100] as const;
export type ImmersionPercent = (typeof IMMERSION_LEVELS)[number];

/** Stable 32-bit hash so a given key always resolves the same way. */
function hash(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export function shouldShowInTargetLanguage(key: string, immersionPercent: number): boolean {
  if (immersionPercent <= 0) return false;
  if (immersionPercent >= 100) return true;
  return hash(key) < immersionPercent / 100;
}

/**
 * Categories that stay in the learner's own language regardless of immersion:
 * anything where a misunderstanding is costly.
 */
const ALWAYS_NATIVE = new Set([
  'error',
  'payment',
  'booking',
  'settings.privacy',
  'settings.account',
  'legal',
  'auth',
]);

export function immersionAllowed(namespace: string): boolean {
  return ![...ALWAYS_NATIVE].some((prefix) => namespace.startsWith(prefix));
}

/** Suggested immersion for a level: more target language as ability grows. */
export function suggestedImmersion(cefrOrdinal: number): ImmersionPercent {
  if (cefrOrdinal >= 50) return 100;
  if (cefrOrdinal >= 40) return 75;
  if (cefrOrdinal >= 30) return 50;
  if (cefrOrdinal >= 20) return 25;
  return 0;
}
