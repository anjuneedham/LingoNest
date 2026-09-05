import { CEFR_LEVELS, cefrLadder, cefrOrdinal, type Cefr, type LadderOptions } from '../cefr/levels';
import { OVERALL_WEIGHTS, SKILLS, type Skill } from './skills';

/**
 * A single piece of evidence about a learner's ability at a point in time.
 * Evidence is append-only; a level estimate is always derivable from it, which
 * is what lets the app answer "why does it say my writing is A2+?".
 */
export interface SkillEvidence {
  readonly skill: Skill;
  /** The CEFR level of the material the learner was working with. */
  readonly cefr: Cefr;
  /** Normalised performance on that material, 0..1. */
  readonly score: number;
  /** Where it came from — different sources carry different trust. */
  readonly source: EvidenceSource;
  /** Epoch milliseconds. */
  readonly at: number;
  /** Optional per-item weight (e.g. a 12-item checkpoint outweighs one activity). */
  readonly weight?: number;
}

export type EvidenceSource =
  | 'placement'
  | 'checkpoint'
  | 'lesson'
  | 'activity'
  | 'review'
  | 'ai_evaluation'
  | 'teacher';

/** How much each source counts before recency decay. */
const SOURCE_WEIGHT: Record<EvidenceSource, number> = {
  placement: 3,
  checkpoint: 5,
  teacher: 4,
  lesson: 2,
  ai_evaluation: 1.5,
  activity: 1,
  review: 0.75,
};

/** Evidence older than this contributes nothing. */
const MAX_AGE_DAYS = 180;
/** Weight halves every this many days. */
const HALF_LIFE_DAYS = 45;

/** Minimum accumulated weight before we are willing to report a level at all. */
export const MIN_WEIGHT_FOR_ESTIMATE = 6;
/** Performance at or above this on level-N material counts as evidence *for* level N. */
export const PASS_THRESHOLD = 0.7;
/** Performance at or below this on level-N material is evidence *against* it. */
export const FAIL_THRESHOLD = 0.45;

export interface SkillEstimate {
  readonly skill: Skill;
  readonly level: Cefr | null;
  /** 0..1 — how much we trust this estimate. Drives "estimated" vs "provisional" copy. */
  readonly confidence: number;
  /** Total decayed evidence weight behind the estimate. */
  readonly weight: number;
  /** The highest level with enough passing evidence, before confidence gating. */
  readonly supportedLevel: Cefr | null;
}

function decayedWeight(e: SkillEvidence, now: number): number {
  const ageDays = (now - e.at) / 86_400_000;
  if (ageDays > MAX_AGE_DAYS) return 0;
  const decay = Math.pow(0.5, Math.max(0, ageDays) / HALF_LIFE_DAYS);
  return (e.weight ?? 1) * SOURCE_WEIGHT[e.source] * decay;
}

/**
 * Estimate one skill's level from its evidence.
 *
 * The rule: a level is *supported* when the weighted pass rate on material at
 * that level (or above) clears PASS_THRESHOLD with enough weight behind it. We
 * walk the ladder upward and keep the highest supported level. A single good
 * quiz can never move a level on its own — that is the point of the weighting.
 */
export function estimateSkillLevel(
  skill: Skill,
  evidence: readonly SkillEvidence[],
  options: LadderOptions & { now?: number } = {},
): SkillEstimate {
  const now = options.now ?? Date.now();
  const relevant = evidence.filter((e) => e.skill === skill);
  const ladder = cefrLadder(options);

  let totalWeight = 0;
  for (const e of relevant) totalWeight += decayedWeight(e, now);

  if (totalWeight < MIN_WEIGHT_FOR_ESTIMATE) {
    return { skill, level: null, confidence: 0, weight: totalWeight, supportedLevel: null };
  }

  // Walk the ladder upward. A level is judged on material *at that level*:
  // passing it moves the estimate up, failing it stops the climb. Levels with
  // too little evidence are skipped rather than treated as failures, because
  // clearing B1 material already implies A2 competence.
  let supported: Cefr | null = null;
  for (const level of ladder) {
    let w = 0;
    let weightedScore = 0;
    for (const e of relevant) {
      if (e.cefr !== level) continue;
      const dw = decayedWeight(e, now);
      w += dw;
      weightedScore += dw * e.score;
    }
    if (w < MIN_WEIGHT_FOR_ESTIMATE / 2) continue; // not enough material at this level yet
    const rate = weightedScore / w;
    if (rate >= PASS_THRESHOLD) supported = level;
    else if (rate <= FAIL_THRESHOLD || supported !== null) break;
  }

  // Confidence grows with evidence volume and with spread across sources.
  const distinctSources = new Set(relevant.map((e) => e.source)).size;
  const volume = Math.min(1, totalWeight / (MIN_WEIGHT_FOR_ESTIMATE * 4));
  const breadth = Math.min(1, distinctSources / 3);
  const confidence = Number((0.6 * volume + 0.4 * breadth).toFixed(3));

  return { skill, level: supported, confidence, weight: Number(totalWeight.toFixed(3)), supportedLevel: supported };
}

export interface SkillProfile {
  readonly overall: Cefr | null;
  readonly bySkill: Record<Skill, SkillEstimate>;
  readonly confidence: number;
}

/**
 * Build the full nine-skill profile plus a weighted overall estimate.
 * Overall is deliberately conservative: it is the weighted average ordinal
 * rounded *down* to a ladder level, so the headline never overstates ability.
 */
export function estimateProfile(
  evidence: readonly SkillEvidence[],
  options: LadderOptions & { now?: number } = {},
): SkillProfile {
  const bySkill = {} as Record<Skill, SkillEstimate>;
  for (const skill of SKILLS) bySkill[skill] = estimateSkillLevel(skill, evidence, options);

  const ladder = cefrLadder(options);
  let weightSum = 0;
  let ordinalSum = 0;
  let confidenceSum = 0;
  let confidenceWeight = 0;

  for (const skill of SKILLS) {
    const est = bySkill[skill];
    const w = OVERALL_WEIGHTS[skill];
    confidenceWeight += w;
    confidenceSum += w * est.confidence;
    if (est.level === null) continue;
    weightSum += w;
    ordinalSum += w * cefrOrdinal(est.level);
  }

  let overall: Cefr | null = null;
  if (weightSum > 0) {
    const avg = ordinalSum / weightSum;
    // Round down to the highest ladder level at or below the weighted average.
    for (const level of ladder) {
      if (cefrOrdinal(level) <= avg + 1e-9) overall = level;
    }
  }

  return {
    overall,
    bySkill,
    confidence: confidenceWeight > 0 ? Number((confidenceSum / confidenceWeight).toFixed(3)) : 0,
  };
}

/**
 * Skills that trail the learner's strongest ability.
 *
 * The reference is the strongest assessed skill rather than the overall
 * estimate: the overall figure is deliberately dragged down by a weak skill, so
 * comparing against it would hide the very gap we are looking for. Returned
 * strongest-gap first. Skills with no estimate yet are *not* lagging — they are
 * unknown, and `unassessedSkills` reports those separately.
 */
export function laggingSkills(profile: SkillProfile, options: LadderOptions = {}): Skill[] {
  const ladder = cefrLadder(options);
  const assessed = SKILLS.map((skill) => ({ skill, level: profile.bySkill[skill].level })).filter(
    (entry): entry is { skill: Skill; level: Cefr } => entry.level !== null,
  );
  if (assessed.length === 0) return [];

  const referenceIndex = Math.max(...assessed.map((entry) => ladder.indexOf(entry.level)));

  const gaps = SKILLS.map((skill) => {
    const level = profile.bySkill[skill].level;
    if (level === null) return { skill, gap: 0 };
    const index = ladder.indexOf(level);
    return { skill, gap: index >= 0 ? referenceIndex - index : 0 };
  }).filter((entry) => entry.gap > 0);

  return gaps.sort((a, b) => b.gap - a.gap).map((entry) => entry.skill);
}

/** Skills we have not gathered enough evidence about to estimate. */
export function unassessedSkills(profile: SkillProfile): Skill[] {
  return SKILLS.filter((skill) => profile.bySkill[skill].level === null);
}

/** Human-readable justification for a level, for the "why?" panel. */
export function explainEstimate(
  estimate: SkillEstimate,
  evidence: readonly SkillEvidence[],
  now = Date.now(),
): { source: EvidenceSource; count: number; averageScore: number }[] {
  const relevant = evidence.filter((e) => e.skill === estimate.skill && decayedWeight(e, now) > 0);
  const bySource = new Map<EvidenceSource, { count: number; total: number }>();
  for (const e of relevant) {
    const entry = bySource.get(e.source) ?? { count: 0, total: 0 };
    entry.count += 1;
    entry.total += e.score;
    bySource.set(e.source, entry);
  }
  return [...bySource.entries()]
    .map(([source, { count, total }]) => ({
      source,
      count,
      averageScore: Number((total / count).toFixed(3)),
    }))
    .sort((a, b) => b.count - a.count);
}

export const ALL_CEFR_FOR_TEST = CEFR_LEVELS;
