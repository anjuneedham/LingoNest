/**
 * CEFR reference levels used as an *instructional* framework.
 *
 * The Council of Europe defines six common reference levels (A1–C2) described
 * through "can-do" descriptors. We add a Pre-A1 preparatory band for absolute
 * beginners and optional "plus" bands (A2+, B1+, B2+) that a language team may
 * enable to smooth the transition between major levels.
 *
 * Nothing here implies certification. Levels reported to a learner are always
 * *estimates* derived from evidence — see `skills/estimate.ts`.
 */

export const CEFR_LEVELS = [
  'PRE_A1',
  'A1',
  'A2',
  'A2_PLUS',
  'B1',
  'B1_PLUS',
  'B2',
  'B2_PLUS',
  'C1',
  'C2',
] as const;

export type Cefr = (typeof CEFR_LEVELS)[number];

/** The six major bands plus Pre-A1; excludes the optional plus bands. */
export const MAJOR_CEFR_LEVELS = [
  'PRE_A1',
  'A1',
  'A2',
  'B1',
  'B2',
  'C1',
  'C2',
] as const satisfies readonly Cefr[];

export type MajorCefr = (typeof MAJOR_CEFR_LEVELS)[number];

export const PLUS_LEVELS = ['A2_PLUS', 'B1_PLUS', 'B2_PLUS'] as const satisfies readonly Cefr[];
export type PlusCefr = (typeof PLUS_LEVELS)[number];

const ORDINALS: Record<Cefr, number> = {
  PRE_A1: 0,
  A1: 10,
  A2: 20,
  A2_PLUS: 25,
  B1: 30,
  B1_PLUS: 35,
  B2: 40,
  B2_PLUS: 45,
  C1: 50,
  C2: 60,
};

const DISPLAY: Record<Cefr, string> = {
  PRE_A1: 'Pre-A1',
  A1: 'A1',
  A2: 'A2',
  A2_PLUS: 'A2+',
  B1: 'B1',
  B1_PLUS: 'B1+',
  B2: 'B2',
  B2_PLUS: 'B2+',
  C1: 'C1',
  C2: 'C2',
};

/** Maps a plus band to the major band it belongs to. */
const MAJOR_OF: Record<Cefr, MajorCefr> = {
  PRE_A1: 'PRE_A1',
  A1: 'A1',
  A2: 'A2',
  A2_PLUS: 'A2',
  B1: 'B1',
  B1_PLUS: 'B1',
  B2: 'B2',
  B2_PLUS: 'B2',
  C1: 'C1',
  C2: 'C2',
};

export function cefrOrdinal(level: Cefr): number {
  return ORDINALS[level];
}

export function cefrDisplay(level: Cefr): string {
  return DISPLAY[level];
}

export function majorOf(level: Cefr): MajorCefr {
  return MAJOR_OF[level];
}

export function isPlusLevel(level: Cefr): level is PlusCefr {
  return (PLUS_LEVELS as readonly Cefr[]).includes(level);
}

/** Negative when `a` is below `b`, 0 when equal, positive when above. */
export function compareCefr(a: Cefr, b: Cefr): number {
  return ORDINALS[a] - ORDINALS[b];
}

export function maxCefr(a: Cefr, b: Cefr): Cefr {
  return compareCefr(a, b) >= 0 ? a : b;
}

export function minCefr(a: Cefr, b: Cefr): Cefr {
  return compareCefr(a, b) <= 0 ? a : b;
}

export interface LadderOptions {
  /** Plus bands enabled for this language/course. Defaults to none. */
  readonly plusLevels?: readonly PlusCefr[];
  /** Highest level offered; content above it is not shown. Defaults to C2. */
  readonly highest?: Cefr;
}

/** The ordered ladder a learner walks for a given language configuration. */
export function cefrLadder(options: LadderOptions = {}): Cefr[] {
  const enabledPlus = new Set<Cefr>(options.plusLevels ?? []);
  const ceiling = ORDINALS[options.highest ?? 'C2'];
  return CEFR_LEVELS.filter(
    (l) => ORDINALS[l] <= ceiling && (!isPlusLevel(l) || enabledPlus.has(l)),
  );
}

/** The next level on the configured ladder, or null at the top. */
export function nextCefr(level: Cefr, options: LadderOptions = {}): Cefr | null {
  const ladder = cefrLadder(options);
  const index = ladder.indexOf(level);
  if (index === -1) {
    // `level` is a plus band that is not enabled: fall forward to the next major band.
    const next = CEFR_LEVELS.find((l) => ORDINALS[l] > ORDINALS[level] && ladder.includes(l));
    return next ?? null;
  }
  return ladder[index + 1] ?? null;
}

export function previousCefr(level: Cefr, options: LadderOptions = {}): Cefr | null {
  const ladder = cefrLadder(options);
  const index = ladder.indexOf(level);
  if (index <= 0) return null;
  return ladder[index - 1] ?? null;
}

/** Distance in ladder steps, used to decide whether content is "close enough". */
export function cefrDistance(a: Cefr, b: Cefr): number {
  return Math.abs(ORDINALS[a] - ORDINALS[b]) / 10;
}

export function parseCefr(value: string): Cefr | null {
  const normalised = value.trim().toUpperCase().replace(/[-\s]/g, '_').replace(/\+$/, '_PLUS');
  return (CEFR_LEVELS as readonly string[]).includes(normalised) ? (normalised as Cefr) : null;
}
