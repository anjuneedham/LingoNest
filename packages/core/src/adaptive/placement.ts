import { CEFR_LEVELS, cefrLadder, cefrOrdinal, compareCefr, type Cefr, type LadderOptions } from '../cefr/levels';
import { SKILLS, type Skill } from '../skills/skills';

/**
 * Adaptive placement (brief §30).
 *
 * A five-question quiz must never decide a CEFR level. This runs an adaptive
 * ladder: start near the learner's self-report, move up on success and down on
 * failure, stop when the estimate stabilises or the item budget runs out, and
 * report a *range* with per-skill estimates and an explicit confidence.
 */

export interface PlacementItem {
  readonly id: string;
  readonly cefr: Cefr;
  readonly skill: Skill;
  /** How sharply this item separates learners at its level, 0..1. */
  readonly discrimination: number;
}

export interface PlacementResponse {
  readonly itemId: string;
  readonly cefr: Cefr;
  readonly skill: Skill;
  readonly correct: boolean;
  readonly responseMs?: number;
}

export interface PlacementConfig {
  readonly minItems: number;
  readonly maxItems: number;
  /** Consecutive failures at a level before we step down. */
  readonly stepDownAfterFailures: number;
  /** Consecutive successes at a level before we step up. */
  readonly stepUpAfterSuccesses: number;
  /** Fraction correct at a level that counts as "reached". */
  readonly passThreshold: number;
  readonly ladder: LadderOptions;
}

export const DEFAULT_PLACEMENT_CONFIG: PlacementConfig = {
  minItems: 12,
  maxItems: 30,
  stepDownAfterFailures: 2,
  stepUpAfterSuccesses: 3,
  passThreshold: 0.65,
  ladder: {},
};

export type SelfReport = 'never' | 'a_little' | 'some' | 'confident';

const SELF_REPORT_START: Record<SelfReport, Cefr> = {
  never: 'PRE_A1',
  a_little: 'A1',
  some: 'A2',
  confident: 'B1',
};

export interface PlacementState {
  readonly currentLevel: Cefr;
  readonly responses: readonly PlacementResponse[];
  readonly consecutiveCorrect: number;
  readonly consecutiveWrong: number;
  readonly finished: boolean;
}

export function startPlacement(selfReport: SelfReport): PlacementState {
  return {
    currentLevel: SELF_REPORT_START[selfReport],
    responses: [],
    consecutiveCorrect: 0,
    consecutiveWrong: 0,
    finished: false,
  };
}

/** Advance the ladder after a response and decide whether to continue. */
export function advancePlacement(
  state: PlacementState,
  response: PlacementResponse,
  config: PlacementConfig = DEFAULT_PLACEMENT_CONFIG,
): PlacementState {
  const responses = [...state.responses, response];
  const ladder = cefrLadder(config.ladder);
  const index = Math.max(0, ladder.indexOf(state.currentLevel));

  let consecutiveCorrect = response.correct ? state.consecutiveCorrect + 1 : 0;
  let consecutiveWrong = response.correct ? 0 : state.consecutiveWrong + 1;
  let currentLevel = state.currentLevel;

  if (consecutiveCorrect >= config.stepUpAfterSuccesses && index < ladder.length - 1) {
    currentLevel = ladder[index + 1]!;
    consecutiveCorrect = 0;
  } else if (consecutiveWrong >= config.stepDownAfterFailures && index > 0) {
    currentLevel = ladder[index - 1]!;
    consecutiveWrong = 0;
  }

  const finished =
    responses.length >= config.maxItems ||
    (responses.length >= config.minItems && hasStabilised(responses, config));

  return { currentLevel, responses, consecutiveCorrect, consecutiveWrong, finished };
}

/** Stable when the last six responses stay within one ladder step. */
function hasStabilised(responses: readonly PlacementResponse[], config: PlacementConfig): boolean {
  const recent = responses.slice(-6);
  if (recent.length < 6) return false;
  const ordinals = recent.map((r) => cefrOrdinal(r.cefr));
  const spread = Math.max(...ordinals) - Math.min(...ordinals);
  const accuracy = recent.filter((r) => r.correct).length / recent.length;
  return spread <= 10 && accuracy >= config.passThreshold - 0.15 && accuracy <= config.passThreshold + 0.25;
}

export interface PlacementResult {
  /** Best single estimate, deliberately conservative. */
  readonly estimated: Cefr;
  /** The band we are actually confident about. */
  readonly range: { readonly low: Cefr; readonly high: Cefr };
  readonly confidence: number;
  readonly bySkill: Partial<Record<Skill, Cefr>>;
  /** Level the learner should actually start at (never above `estimated`). */
  readonly recommendedStart: Cefr;
  readonly itemsAnswered: number;
  /** Skills with too little evidence to estimate — assessed later through use. */
  readonly unassessedSkills: readonly Skill[];
}

/**
 * Estimate placement from the walked ladder.
 *
 * We take the highest level where the learner cleared the pass threshold with
 * at least two items, and start them one step below when confidence is low —
 * being placed slightly too low is recoverable in a session; being placed too
 * high makes the product feel impossible.
 */
export function estimatePlacement(
  responses: readonly PlacementResponse[],
  config: PlacementConfig = DEFAULT_PLACEMENT_CONFIG,
): PlacementResult {
  const ladder = cefrLadder(config.ladder);

  const byLevel = new Map<Cefr, { correct: number; total: number }>();
  for (const r of responses) {
    const entry = byLevel.get(r.cefr) ?? { correct: 0, total: 0 };
    entry.total += 1;
    if (r.correct) entry.correct += 1;
    byLevel.set(r.cefr, entry);
  }

  let highestPassed: Cefr = 'PRE_A1';
  let lowestFailed: Cefr | null = null;
  for (const level of ladder) {
    const stats = byLevel.get(level);
    if (!stats || stats.total < 2) continue;
    const rate = stats.correct / stats.total;
    if (rate >= config.passThreshold) {
      if (compareCefr(level, highestPassed) > 0) highestPassed = level;
    } else if (lowestFailed === null || compareCefr(level, lowestFailed) < 0) {
      lowestFailed = level;
    }
  }

  const bySkill: Partial<Record<Skill, Cefr>> = {};
  const unassessed: Skill[] = [];
  for (const skill of SKILLS) {
    const forSkill = responses.filter((r) => r.skill === skill);
    if (forSkill.length < 3) {
      unassessed.push(skill);
      continue;
    }
    let best: Cefr = 'PRE_A1';
    for (const level of ladder) {
      const atLevel = forSkill.filter((r) => r.cefr === level);
      if (atLevel.length === 0) continue;
      const rate = atLevel.filter((r) => r.correct).length / atLevel.length;
      if (rate >= config.passThreshold && compareCefr(level, best) > 0) best = level;
    }
    bySkill[skill] = best;
  }

  const answered = responses.length;
  const coverage = Math.min(1, answered / config.minItems);
  const distinctLevels = byLevel.size;
  const breadth = Math.min(1, distinctLevels / 3);
  const confidence = Math.round((0.6 * coverage + 0.4 * breadth) * 1000) / 1000;

  const highIndex = ladder.indexOf(highestPassed);
  const high = lowestFailed ?? ladder[Math.min(ladder.length - 1, highIndex + 1)] ?? highestPassed;
  const low = ladder[Math.max(0, highIndex - 1)] ?? 'PRE_A1';

  // Start one step below the estimate when we are not confident.
  const startIndex = confidence >= 0.7 ? highIndex : Math.max(0, highIndex - 1);
  const recommendedStart = ladder[startIndex] ?? 'PRE_A1';

  return {
    estimated: highestPassed,
    range: { low, high },
    confidence,
    bySkill,
    recommendedStart,
    itemsAnswered: answered,
    unassessedSkills: unassessed,
  };
}

/** Pick the next item to serve: at the current level, unseen, best discrimination. */
export function selectNextItem(
  state: PlacementState,
  pool: readonly PlacementItem[],
): PlacementItem | null {
  const seen = new Set(state.responses.map((r) => r.itemId));
  const skillCounts = new Map<Skill, number>();
  for (const r of state.responses) skillCounts.set(r.skill, (skillCounts.get(r.skill) ?? 0) + 1);

  const candidates = pool.filter((i) => !seen.has(i.id) && i.cefr === state.currentLevel);
  const searchSpace = candidates.length > 0 ? candidates : pool.filter((i) => !seen.has(i.id));
  if (searchSpace.length === 0) return null;

  // Prefer the least-sampled skill so the per-skill estimates are usable.
  return [...searchSpace].sort((a, b) => {
    const skillDiff = (skillCounts.get(a.skill) ?? 0) - (skillCounts.get(b.skill) ?? 0);
    if (skillDiff !== 0) return skillDiff;
    return b.discrimination - a.discrimination;
  })[0]!;
}

export const PLACEMENT_LEVELS_FOR_TEST = CEFR_LEVELS;
