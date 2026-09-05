import type { Cefr } from '../cefr/levels';
import type { Skill } from '../skills/skills';
import { SKILLS } from '../skills/skills';

/**
 * Progression rules (brief §31, §53).
 *
 * XP measures engagement. Mastery measures learning. They are deliberately
 * separate numbers, and only mastery unlocks the next level.
 */

export interface LevelCriteria {
  /** Fraction of the level's lessons completed, 0..1. */
  readonly lessonCompletion: number;
  /** Fraction of the level's vocabulary at `review` or better. */
  readonly vocabularyMastery: number;
  /** Weighted accuracy across the level's activities, 0..1. */
  readonly accuracy: number;
  /** Minimum per-skill accuracy that must be met for the listed skills. */
  readonly perSkillAccuracy: Partial<Record<Skill, number>>;
  /** Checkpoint assessment score required, 0..1. */
  readonly checkpointScore: number;
  /** Speaking tasks that must have been attempted (not necessarily perfect). */
  readonly speakingTasks: number;
  /** Distinct days of activity — consistency, not cramming. */
  readonly activeDays: number;
}

/** Defaults tighten as the level rises; a language may override in content. */
export const DEFAULT_LEVEL_CRITERIA: Record<string, LevelCriteria> = {
  PRE_A1: {
    lessonCompletion: 0.9,
    vocabularyMastery: 0.6,
    accuracy: 0.7,
    perSkillAccuracy: { listening: 0.65, pronunciation: 0.5 },
    checkpointScore: 0.7,
    speakingTasks: 3,
    activeDays: 3,
  },
  A1: {
    lessonCompletion: 0.9,
    vocabularyMastery: 0.7,
    accuracy: 0.75,
    perSkillAccuracy: { listening: 0.7, speaking: 0.6, reading: 0.7, writing: 0.6 },
    checkpointScore: 0.75,
    speakingTasks: 8,
    activeDays: 8,
  },
  A2: {
    lessonCompletion: 0.9,
    vocabularyMastery: 0.7,
    accuracy: 0.75,
    perSkillAccuracy: { listening: 0.7, speaking: 0.65, reading: 0.72, writing: 0.65, grammar: 0.7 },
    checkpointScore: 0.75,
    speakingTasks: 12,
    activeDays: 12,
  },
  B1: {
    lessonCompletion: 0.9,
    vocabularyMastery: 0.72,
    accuracy: 0.78,
    perSkillAccuracy: { listening: 0.72, speaking: 0.7, reading: 0.75, writing: 0.7, grammar: 0.72, interaction: 0.65 },
    checkpointScore: 0.78,
    speakingTasks: 16,
    activeDays: 16,
  },
  B2: {
    lessonCompletion: 0.9,
    vocabularyMastery: 0.75,
    accuracy: 0.8,
    perSkillAccuracy: { listening: 0.75, speaking: 0.72, reading: 0.78, writing: 0.72, grammar: 0.75, interaction: 0.7 },
    checkpointScore: 0.8,
    speakingTasks: 20,
    activeDays: 20,
  },
  C1: {
    lessonCompletion: 0.9,
    vocabularyMastery: 0.78,
    accuracy: 0.82,
    perSkillAccuracy: { listening: 0.78, speaking: 0.75, reading: 0.8, writing: 0.75, mediation: 0.7 },
    checkpointScore: 0.82,
    speakingTasks: 24,
    activeDays: 24,
  },
  C2: {
    lessonCompletion: 0.9,
    vocabularyMastery: 0.8,
    accuracy: 0.85,
    perSkillAccuracy: { listening: 0.82, speaking: 0.8, reading: 0.85, writing: 0.8, mediation: 0.75 },
    checkpointScore: 0.85,
    speakingTasks: 30,
    activeDays: 30,
  },
};

export interface LevelStats {
  readonly lessonsTotal: number;
  readonly lessonsCompleted: number;
  readonly vocabularyTotal: number;
  readonly vocabularyMastered: number;
  readonly accuracy: number;
  readonly accuracyBySkill: Partial<Record<Skill, number>>;
  readonly checkpointScore: number | null;
  readonly speakingTasksCompleted: number;
  readonly activeDays: number;
}

export interface UnmetCriterion {
  readonly criterion: string;
  readonly required: number;
  readonly actual: number;
  /** i18n key for the learner-facing explanation of what to do about it. */
  readonly messageKey: string;
}

export interface LevelReadiness {
  readonly cefr: Cefr;
  readonly ready: boolean;
  /** 0..1 overall completeness against the criteria, for the progress bar. */
  readonly progress: number;
  readonly unmet: readonly UnmetCriterion[];
}

/**
 * Decide whether a learner has earned the next level.
 *
 * Completing the lessons is not enough — the brief is explicit that mastery,
 * not attendance, unlocks progression. The returned `unmet` list is what the
 * Learn screen shows instead of a bare padlock.
 */
export function evaluateLevelReadiness(
  cefr: Cefr,
  stats: LevelStats,
  criteria: LevelCriteria = DEFAULT_LEVEL_CRITERIA[cefr] ?? DEFAULT_LEVEL_CRITERIA['A1']!,
): LevelReadiness {
  const unmet: UnmetCriterion[] = [];
  const ratios: number[] = [];

  const push = (
    criterion: string,
    required: number,
    actual: number,
    messageKey: string,
  ) => {
    ratios.push(required === 0 ? 1 : Math.min(1, actual / required));
    if (actual + 1e-9 < required) unmet.push({ criterion, required, actual, messageKey });
  };

  const lessonRatio = stats.lessonsTotal === 0 ? 0 : stats.lessonsCompleted / stats.lessonsTotal;
  push('lessonCompletion', criteria.lessonCompletion, lessonRatio, 'progress.unmet.lessons');

  const vocabRatio = stats.vocabularyTotal === 0 ? 1 : stats.vocabularyMastered / stats.vocabularyTotal;
  push('vocabularyMastery', criteria.vocabularyMastery, vocabRatio, 'progress.unmet.vocabulary');

  push('accuracy', criteria.accuracy, stats.accuracy, 'progress.unmet.accuracy');

  for (const skill of SKILLS) {
    const required = criteria.perSkillAccuracy[skill];
    if (required === undefined) continue;
    push(`skill:${skill}`, required, stats.accuracyBySkill[skill] ?? 0, `progress.unmet.skill.${skill}`);
  }

  push('checkpoint', criteria.checkpointScore, stats.checkpointScore ?? 0, 'progress.unmet.checkpoint');
  push('speakingTasks', criteria.speakingTasks, stats.speakingTasksCompleted, 'progress.unmet.speaking');
  push('activeDays', criteria.activeDays, stats.activeDays, 'progress.unmet.consistency');

  const progress = ratios.length === 0 ? 0 : ratios.reduce((a, b) => a + b, 0) / ratios.length;

  return {
    cefr,
    ready: unmet.length === 0,
    progress: Math.round(progress * 1000) / 1000,
    unmet,
  };
}

/**
 * A qualitative label for a completed checkpoint, e.g. "Strong A1".
 * Never a certification claim — the i18n layer renders these as estimates.
 */
export type CheckpointVerdict = 'not_yet' | 'developing' | 'solid' | 'strong';

export function checkpointVerdict(score: number): CheckpointVerdict {
  if (score >= 0.9) return 'strong';
  if (score >= 0.75) return 'solid';
  if (score >= 0.6) return 'developing';
  return 'not_yet';
}

/** Weighted lesson accuracy from individual activity scores. */
export function lessonAccuracy(attempts: readonly { score: number; points: number }[]): number {
  const totalPoints = attempts.reduce((sum, a) => sum + a.points, 0);
  if (totalPoints === 0) return 0;
  const earned = attempts.reduce((sum, a) => sum + a.score * a.points, 0);
  return Math.round((earned / totalPoints) * 1000) / 1000;
}
