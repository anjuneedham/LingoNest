import type { Cefr } from '../cefr/levels';
import { compareCefr } from '../cefr/levels';
import type { NormalizeOptions } from './normalize';

/**
 * Per-language grading behaviour. These are linguistic decisions, not code
 * decisions, so they live in one table that a language lead can reason about.
 *
 * Adding a language without an entry is safe: `DEFAULT_RULES` applies.
 */
export interface LanguageGradingRules {
  /**
   * How a missing/incorrect diacritic is treated. Spanish learners at A1 should
   * not be failed for "como" vs "cómo"; by B1 accuracy matters.
   */
  readonly accentStrictFrom: Cefr | 'always' | 'never';
  /** Words the learner may omit or add freely (typically articles at low levels). */
  readonly optionalWords: readonly string[];
  /** Expanded before comparison so both forms grade the same. */
  readonly expansions: Readonly<Record<string, string>>;
  /** Function words excluded when measuring content overlap. */
  readonly stopWords: readonly string[];
  /** Maximum edit distance, as a fraction of target length, still counted as a typo. */
  readonly typoTolerance: number;
  /** Scripts accepted as equivalent, e.g. kana for a kanji target before kanji is taught. */
  readonly equivalentScripts?: readonly (readonly [RegExp, string])[];
  /** Whether the language separates words with spaces (affects tokenised activities). */
  readonly spaceSeparated: boolean;
}

export const DEFAULT_RULES: LanguageGradingRules = {
  accentStrictFrom: 'B1',
  optionalWords: [],
  expansions: {},
  stopWords: ['the', 'a', 'an', 'of', 'to', 'and', 'is', 'are', 'in', 'it'],
  typoTolerance: 0.15,
  spaceSeparated: true,
};

export const LANGUAGE_RULES: Readonly<Record<string, LanguageGradingRules>> = {
  en: {
    ...DEFAULT_RULES,
    accentStrictFrom: 'never',
    expansions: {
      "don't": 'do not',
      "doesn't": 'does not',
      "can't": 'cannot',
      "i'm": 'i am',
      "it's": 'it is',
      "you're": 'you are',
      "they're": 'they are',
      "isn't": 'is not',
      "won't": 'will not',
    },
    stopWords: ['the', 'a', 'an', 'of', 'to', 'and', 'is', 'are', 'in', 'it', 'that', 'this'],
  },
  es: {
    ...DEFAULT_RULES,
    accentStrictFrom: 'B1',
    // Subject pronouns are usually dropped in Spanish; both forms are acceptable.
    optionalWords: ['yo', 'tú', 'él', 'ella', 'usted', 'nosotros', 'nosotras', 'ellos', 'ellas', 'ustedes'],
    expansions: { del: 'de el', al: 'a el' },
    stopWords: ['el', 'la', 'los', 'las', 'un', 'una', 'de', 'que', 'y', 'a', 'en', 'es'],
    typoTolerance: 0.15,
  },
  fr: {
    ...DEFAULT_RULES,
    accentStrictFrom: 'A2',
    expansions: { "j'ai": 'je ai', "c'est": 'ce est', "qu'": 'que ', "n'": 'ne ', "l'": 'le ' },
    stopWords: ['le', 'la', 'les', 'un', 'une', 'de', 'des', 'et', 'à', 'en', 'est', 'que'],
  },
  pt: {
    ...DEFAULT_RULES,
    accentStrictFrom: 'B1',
    optionalWords: ['eu', 'tu', 'ele', 'ela', 'nós', 'eles', 'elas'],
    stopWords: ['o', 'a', 'os', 'as', 'um', 'uma', 'de', 'que', 'e', 'em', 'é'],
  },
  de: {
    ...DEFAULT_RULES,
    accentStrictFrom: 'always', // umlauts change meaning (schwül vs schwul)
    expansions: { ae: 'ä', oe: 'ö', ue: 'ü', ss: 'ß' },
    stopWords: ['der', 'die', 'das', 'ein', 'eine', 'und', 'ist', 'in', 'zu', 'den'],
  },
  ja: {
    ...DEFAULT_RULES,
    accentStrictFrom: 'never',
    spaceSeparated: false,
    typoTolerance: 0.1,
    stopWords: ['は', 'が', 'を', 'に', 'で', 'の', 'と', 'も', 'です', 'ます'],
    // Full-width/half-width and long-vowel notation are graded as equivalent.
    equivalentScripts: [
      [/[！-～]/g, ''], // handled by NFKC in the evaluator; listed for documentation
    ],
  },
  zh: {
    ...DEFAULT_RULES,
    accentStrictFrom: 'never',
    spaceSeparated: false,
    typoTolerance: 0.1,
    stopWords: ['的', '了', '是', '在', '和', '我', '你', '他'],
  },
  ko: { ...DEFAULT_RULES, accentStrictFrom: 'never', typoTolerance: 0.1, stopWords: ['은', '는', '이', '가', '을', '를'] },
  it: { ...DEFAULT_RULES, accentStrictFrom: 'B1', stopWords: ['il', 'lo', 'la', 'un', 'di', 'che', 'e', 'in', 'è'] },
  ar: { ...DEFAULT_RULES, accentStrictFrom: 'never', stopWords: ['ال', 'في', 'من', 'على', 'و'] },
};

export function rulesFor(languageCode: string): LanguageGradingRules {
  const base = languageCode.split('-')[0]!.toLowerCase();
  return LANGUAGE_RULES[base] ?? DEFAULT_RULES;
}

/** Whether an accent-only difference should be marked wrong at this level. */
export function accentsAreStrict(rules: LanguageGradingRules, cefr: Cefr): boolean {
  if (rules.accentStrictFrom === 'always') return true;
  if (rules.accentStrictFrom === 'never') return false;
  return compareCefr(cefr, rules.accentStrictFrom) >= 0;
}

/** Normalisation options implied by a language's rules at a given level. */
export function normalizeOptionsFor(
  rules: LanguageGradingRules,
  cefr: Cefr,
  opts: { caseSensitive?: boolean; allowOptionalWords?: boolean } = {},
): NormalizeOptions {
  return {
    caseSensitive: opts.caseSensitive ?? false,
    stripPunctuation: true,
    collapseWhitespace: rules.spaceSeparated,
    foldAccents: false,
    expansions: rules.expansions,
    optionalWords: opts.allowOptionalWords === false ? [] : rules.optionalWords,
  };
}
