/**
 * Spaced repetition scheduling (brief §20).
 *
 * An SM-2 derivative tuned for language vocabulary:
 *  - four learning steps before an item graduates, so a word seen once is not
 *    scheduled a week out;
 *  - response time nudges the recall grade, because a correct answer that took
 *    12 seconds is not the same as one that took two;
 *  - repeated failures mark an item a "leech" so the adaptive engine can
 *    surface it for explicit re-teaching instead of grinding it forever.
 */

export type SrsState = 'new' | 'learning' | 'review' | 'mastered' | 'leech';

export interface SrsCard {
  readonly state: SrsState;
  /** Ease factor; 1.3 is the floor, 2.5 the default for a new card. */
  readonly ease: number;
  /** Current interval in days (0 while in learning steps). */
  readonly intervalDays: number;
  /** Successful reviews since the last lapse. */
  readonly repetitions: number;
  /** Total times the card has been forgotten after graduating. */
  readonly lapses: number;
  /** Index into LEARNING_STEPS while state === 'learning'. */
  readonly step: number;
  /** Epoch ms when the card is next due. */
  readonly dueAt: number;
  readonly lastReviewedAt: number | null;
}

/** Learner-facing grade for a review. */
export type RecallGrade = 'again' | 'hard' | 'good' | 'easy';

export interface SrsSettings {
  /** Learning steps in minutes before graduation. */
  readonly learningStepsMinutes: readonly number[];
  /** Interval (days) on graduating from the learning steps. */
  readonly graduatingIntervalDays: number;
  /** Interval (days) when a card is graduated with "easy". */
  readonly easyIntervalDays: number;
  /** Interval multiplier applied after a lapse. */
  readonly lapseMultiplier: number;
  readonly minEase: number;
  readonly maxEase: number;
  readonly startingEase: number;
  /** Interval (days) at which a card is considered mastered. */
  readonly masteredIntervalDays: number;
  /** Lapses before a card is flagged as a leech. */
  readonly leechThreshold: number;
  /** Random spread applied to long intervals so reviews do not clump. */
  readonly fuzzRatio: number;
  /** Maximum interval in days. */
  readonly maxIntervalDays: number;
}

export const DEFAULT_SRS_SETTINGS: SrsSettings = {
  learningStepsMinutes: [1, 10, 60, 1440],
  graduatingIntervalDays: 1,
  easyIntervalDays: 4,
  lapseMultiplier: 0.5,
  minEase: 1.3,
  maxEase: 2.8,
  startingEase: 2.5,
  masteredIntervalDays: 60,
  leechThreshold: 6,
  fuzzRatio: 0.05,
  maxIntervalDays: 365,
};

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

export function newCard(now = Date.now(), settings: SrsSettings = DEFAULT_SRS_SETTINGS): SrsCard {
  return {
    state: 'new',
    ease: settings.startingEase,
    intervalDays: 0,
    repetitions: 0,
    lapses: 0,
    step: 0,
    dueAt: now,
    lastReviewedAt: null,
  };
}

export interface ReviewInput {
  readonly grade: RecallGrade;
  /** How long the learner took to answer, in ms. Optional. */
  readonly responseMs?: number;
  /** Median response time for this learner, used to calibrate. Optional. */
  readonly baselineMs?: number;
  readonly now?: number;
}

/**
 * Turn a correct/incorrect outcome plus timing into a recall grade.
 * Used when an activity grades an item automatically rather than asking the
 * learner to self-assess.
 */
export function gradeFromOutcome(input: {
  correct: boolean;
  responseMs?: number;
  baselineMs?: number;
  hintsUsed?: number;
  partial?: boolean;
}): RecallGrade {
  if (!input.correct) return 'again';
  if ((input.hintsUsed ?? 0) > 0 || input.partial) return 'hard';
  const { responseMs, baselineMs } = input;
  if (responseMs !== undefined && baselineMs !== undefined && baselineMs > 0) {
    const ratio = responseMs / baselineMs;
    if (ratio <= 0.6) return 'easy';
    if (ratio >= 1.8) return 'hard';
  }
  return 'good';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function fuzz(days: number, ratio: number, seed: number): number {
  if (days < 3 || ratio <= 0) return days;
  // Deterministic jitter derived from the due date, so tests are stable and
  // reviews still spread across days.
  const pseudo = ((Math.sin(seed) + 1) / 2) * 2 - 1; // -1..1
  return Math.max(1, Math.round(days * (1 + pseudo * ratio)));
}

/** Apply a review outcome and return the next card state. */
export function reviewCard(
  card: SrsCard,
  input: ReviewInput,
  settings: SrsSettings = DEFAULT_SRS_SETTINGS,
): SrsCard {
  const now = input.now ?? Date.now();
  const grade = input.grade;
  const steps = settings.learningStepsMinutes;

  // --- failure -------------------------------------------------------------
  if (grade === 'again') {
    const wasGraduated = card.state === 'review' || card.state === 'mastered';
    const lapses = card.lapses + (wasGraduated ? 1 : 0);
    const ease = clamp(card.ease - 0.2, settings.minEase, settings.maxEase);
    const state: SrsState = lapses >= settings.leechThreshold ? 'leech' : 'learning';
    return {
      state,
      ease,
      intervalDays: wasGraduated ? Math.max(1, card.intervalDays * settings.lapseMultiplier) : 0,
      repetitions: 0,
      lapses,
      step: 0,
      dueAt: now + (steps[0] ?? 1) * MINUTE_MS,
      lastReviewedAt: now,
    };
  }

  // --- still in the learning steps ----------------------------------------
  if (card.state === 'new' || card.state === 'learning' || card.state === 'leech') {
    if (grade === 'easy') {
      const interval = settings.easyIntervalDays;
      return {
        state: 'review',
        ease: clamp(card.ease + 0.15, settings.minEase, settings.maxEase),
        intervalDays: interval,
        repetitions: card.repetitions + 1,
        lapses: card.lapses,
        step: 0,
        dueAt: now + interval * DAY_MS,
        lastReviewedAt: now,
      };
    }
    const nextStep = grade === 'hard' ? card.step : card.step + 1;
    if (nextStep < steps.length) {
      const minutes = steps[Math.min(nextStep, steps.length - 1)] ?? 1;
      return {
        ...card,
        state: 'learning',
        step: nextStep,
        repetitions: card.repetitions,
        dueAt: now + minutes * MINUTE_MS,
        lastReviewedAt: now,
      };
    }
    // graduated
    const interval = settings.graduatingIntervalDays;
    return {
      state: 'review',
      ease: card.ease,
      intervalDays: interval,
      repetitions: card.repetitions + 1,
      lapses: card.lapses,
      step: 0,
      dueAt: now + interval * DAY_MS,
      lastReviewedAt: now,
    };
  }

  // --- graduated review ----------------------------------------------------
  const easeDelta = grade === 'hard' ? -0.15 : grade === 'easy' ? 0.15 : 0;
  const ease = clamp(card.ease + easeDelta, settings.minEase, settings.maxEase);
  const multiplier = grade === 'hard' ? 1.2 : grade === 'easy' ? ease * 1.3 : ease;
  const raw = Math.max(1, card.intervalDays * multiplier);
  const capped = Math.min(settings.maxIntervalDays, raw);
  const intervalDays = fuzz(Math.round(capped), settings.fuzzRatio, card.dueAt / DAY_MS);
  const state: SrsState = intervalDays >= settings.masteredIntervalDays ? 'mastered' : 'review';

  return {
    state,
    ease,
    intervalDays,
    repetitions: card.repetitions + 1,
    lapses: card.lapses,
    step: 0,
    dueAt: now + intervalDays * DAY_MS,
    lastReviewedAt: now,
  };
}

export function isDue(card: SrsCard, now = Date.now()): boolean {
  return card.dueAt <= now && card.state !== 'mastered' ? true : card.dueAt <= now;
}

export interface QueueOptions {
  /** Maximum cards in a session. */
  readonly limit: number;
  /** Cap on brand-new cards so a session is not all new material. */
  readonly newCardLimit: number;
  readonly now?: number;
}

export interface QueueItem<T> {
  readonly item: T;
  readonly card: SrsCard;
}

/**
 * Build a review session: overdue cards first (most overdue leading), then
 * learning steps, then a capped number of new cards. Leeches are surfaced early
 * so they get attention while the learner is fresh.
 */
export function buildReviewQueue<T>(items: readonly QueueItem<T>[], options: QueueOptions): QueueItem<T>[] {
  const now = options.now ?? Date.now();
  const due = items.filter((i) => i.card.dueAt <= now);

  const leeches = due.filter((i) => i.card.state === 'leech');
  const reviews = due
    .filter((i) => i.card.state === 'review' || i.card.state === 'mastered')
    .sort((a, b) => a.card.dueAt - b.card.dueAt);
  const learning = due.filter((i) => i.card.state === 'learning').sort((a, b) => a.card.dueAt - b.card.dueAt);
  const fresh = items.filter((i) => i.card.state === 'new').slice(0, options.newCardLimit);

  return [...leeches, ...learning, ...reviews, ...fresh].slice(0, options.limit);
}

export function dueCount(cards: readonly SrsCard[], now = Date.now()): number {
  return cards.filter((c) => c.dueAt <= now).length;
}

/** Rough forecast of how many reviews fall on each of the next `days` days. */
export function reviewForecast(cards: readonly SrsCard[], days: number, now = Date.now()): number[] {
  const buckets = new Array<number>(days).fill(0);
  for (const card of cards) {
    const offset = Math.floor((card.dueAt - now) / DAY_MS);
    if (offset < 0) buckets[0] = (buckets[0] ?? 0) + 1;
    else if (offset < days) buckets[offset] = (buckets[offset] ?? 0) + 1;
  }
  return buckets;
}
