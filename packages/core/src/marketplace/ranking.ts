import type { Currency } from '../pricing/currency';

/**
 * Search ranking for the teacher marketplace.
 *
 * Weights live in remote config so ranking can be tuned without a release;
 * these are the defaults. The rating term is Bayesian-adjusted so one 5★ review
 * cannot outrank two hundred reviews at 4.8.
 */

export interface RankingWeights {
  readonly rating: number;
  readonly reliability: number;
  readonly responsiveness: number;
  readonly availability: number;
  readonly priceFit: number;
  readonly newTeacherBoost: number;
  readonly specialtyMatch: number;
}

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  rating: 0.32,
  reliability: 0.18,
  responsiveness: 0.12,
  availability: 0.18,
  priceFit: 0.1,
  newTeacherBoost: 0.05,
  specialtyMatch: 0.05,
};

/** Prior used by the Bayesian rating average. */
export const RATING_PRIOR = { mean: 4.5, weight: 12 };

export function bayesianRating(ratingAvg: number, ratingCount: number): number {
  const { mean, weight } = RATING_PRIOR;
  return (ratingAvg * ratingCount + mean * weight) / (ratingCount + weight);
}

export interface TeacherRankingInput {
  readonly teacherId: string;
  readonly ratingAvg: number;
  readonly ratingCount: number;
  /** Completed / (completed + teacher cancellations + teacher no-shows), 0..1. */
  readonly reliability: number;
  /** Fraction of messages answered within 24 h, 0..1. */
  readonly responseRate: number;
  /** Bookable slots in the next seven days. */
  readonly slotsNext7Days: number;
  readonly hourlyRateMinor: number;
  readonly currency: Currency;
  readonly lessonsTaught: number;
  readonly specialties: readonly string[];
  readonly createdAt: number;
}

export interface RankingContext {
  /** Learner's requested price ceiling, if any. */
  readonly maxPriceMinor?: number;
  readonly desiredSpecialties?: readonly string[];
  readonly weights?: RankingWeights;
  readonly now?: number;
}

const NEW_TEACHER_WINDOW_DAYS = 45;

/** Score in 0..1; higher ranks first. */
export function scoreTeacher(teacher: TeacherRankingInput, context: RankingContext = {}): number {
  const w = context.weights ?? DEFAULT_RANKING_WEIGHTS;
  const now = context.now ?? Date.now();

  const rating = (bayesianRating(teacher.ratingAvg, teacher.ratingCount) - 1) / 4; // 1..5 → 0..1
  const reliability = clamp01(teacher.reliability);
  const responsiveness = clamp01(teacher.responseRate);
  const availability = clamp01(teacher.slotsNext7Days / 20);

  let priceFit = 0.5;
  if (context.maxPriceMinor !== undefined && context.maxPriceMinor > 0) {
    priceFit = teacher.hourlyRateMinor <= context.maxPriceMinor
      ? 1
      : clamp01(1 - (teacher.hourlyRateMinor - context.maxPriceMinor) / context.maxPriceMinor);
  }

  const ageDays = (now - teacher.createdAt) / 86_400_000;
  const newBoost = teacher.lessonsTaught < 10 && ageDays <= NEW_TEACHER_WINDOW_DAYS ? 1 : 0;

  const desired = context.desiredSpecialties ?? [];
  const specialtyMatch =
    desired.length === 0
      ? 0.5
      : clamp01(desired.filter((s) => teacher.specialties.includes(s)).length / desired.length);

  const score =
    w.rating * rating +
    w.reliability * reliability +
    w.responsiveness * responsiveness +
    w.availability * availability +
    w.priceFit * priceFit +
    w.newTeacherBoost * newBoost +
    w.specialtyMatch * specialtyMatch;

  return Math.round(score * 10_000) / 10_000;
}

export function rankTeachers<T extends TeacherRankingInput>(
  teachers: readonly T[],
  context: RankingContext = {},
): T[] {
  return [...teachers].sort((a, b) => scoreTeacher(b, context) - scoreTeacher(a, context));
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Teacher specialties offered as marketplace filters (brief §32). */
export const TEACHER_SPECIALTIES = [
  'conversation',
  'business',
  'exam_preparation',
  'children',
  'teenagers',
  'adults',
  'travel',
  'grammar',
  'pronunciation',
  'writing',
  'academic',
  'medical',
  'legal',
  'interview_preparation',
  'beginners',
  'advanced',
] as const;

export type TeacherSpecialty = (typeof TEACHER_SPECIALTIES)[number];
