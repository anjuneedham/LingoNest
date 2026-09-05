/**
 * Text normalisation used by deterministic grading.
 *
 * Language learning answers are graded on *meaning and form*, not on incidental
 * typography. A learner who writes "me llamo ana" instead of "Me llamo Ana"
 * has answered correctly; one who writes "Me llamo Anna" has not.
 */

export interface NormalizeOptions {
  readonly caseSensitive?: boolean;
  readonly stripPunctuation?: boolean;
  readonly collapseWhitespace?: boolean;
  /** Fold accents (á→a). Used to *detect* accent-only differences, not to ignore them silently. */
  readonly foldAccents?: boolean;
  /** Words that may be omitted or added without changing correctness (e.g. articles). */
  readonly optionalWords?: readonly string[];
  /** Contraction/variant expansions applied before comparison, e.g. "don't" → "do not". */
  readonly expansions?: Readonly<Record<string, string>>;
}

const DEFAULTS: Required<Pick<NormalizeOptions, 'caseSensitive' | 'stripPunctuation' | 'collapseWhitespace' | 'foldAccents'>> = {
  caseSensitive: false,
  stripPunctuation: true,
  collapseWhitespace: true,
  foldAccents: false,
};

/** Punctuation stripped before comparison; keeps intra-word apostrophes and hyphens. */
const PUNCTUATION = /[.,!?;:"“”«»„…()[\]{}]/g;

export function foldAccents(input: string): string {
  return input.normalize('NFD').replace(/\p{Diacritic}/gu, '').normalize('NFC');
}

export function normalizeText(input: string, options: NormalizeOptions = {}): string {
  const opts = { ...DEFAULTS, ...options };
  let out = input.normalize('NFC').trim();

  if (!opts.caseSensitive) out = out.toLocaleLowerCase();

  if (opts.expansions) {
    for (const [from, to] of Object.entries(opts.expansions)) {
      out = out.replace(new RegExp(`\\b${escapeRegExp(from.toLocaleLowerCase())}\\b`, 'g'), to.toLocaleLowerCase());
    }
  }

  if (opts.stripPunctuation) out = out.replace(PUNCTUATION, ' ');
  if (opts.foldAccents) out = foldAccents(out);
  if (opts.collapseWhitespace) out = out.replace(/\s+/g, ' ').trim();

  if (opts.optionalWords?.length) {
    const optional = new Set(opts.optionalWords.map((w) => w.toLocaleLowerCase()));
    out = out
      .split(' ')
      .filter((w) => !optional.has(w))
      .join(' ')
      .trim();
  }

  return out;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Levenshtein distance, capped for performance on long free-text answers. */
export function editDistance(a: string, b: string, cap = 64): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;

  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let previous = new Array<number>(n + 1);
  let current = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) previous[j] = j;

  for (let i = 1; i <= m; i++) {
    current[0] = i;
    let rowMin = current[0]!;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + cost);
      current[j] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > cap) return cap + 1;
    const swap = previous;
    previous = current;
    current = swap;
  }
  return previous[n]!;
}

/** 0..1 similarity derived from edit distance, length-normalised. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 1;
  return Math.max(0, 1 - editDistance(a, b) / longest);
}

/** Content words shared between two strings — used to sanity-check AI verdicts. */
export function contentWordOverlap(a: string, b: string, stopWords: ReadonlySet<string>): number {
  const wordsOf = (s: string) =>
    new Set(
      normalizeText(s, { foldAccents: true })
        .split(' ')
        .filter((w) => w.length > 1 && !stopWords.has(w)),
    );
  const setA = wordsOf(a);
  const setB = wordsOf(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let shared = 0;
  for (const w of setA) if (setB.has(w)) shared += 1;
  return shared / Math.min(setA.size, setB.size);
}

export function tokenize(input: string): string[] {
  return normalizeText(input).split(' ').filter(Boolean);
}
