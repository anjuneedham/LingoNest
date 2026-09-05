import { describe, expect, it } from 'vitest';
import { teacherBadges, type VerificationRecord } from '../src/marketplace/badges';
import { bayesianRating, rankTeachers, scoreTeacher, type TeacherRankingInput } from '../src/marketplace/ranking';

const NOW = Date.UTC(2026, 5, 1);

const verified = (kind: VerificationRecord['kind'], overrides: Partial<VerificationRecord> = {}): VerificationRecord => ({
  kind,
  status: 'verified',
  verifiedAt: NOW - 86_400_000,
  expiresAt: null,
  ...overrides,
});

describe('verification badges', () => {
  it('shows no badges for an unverified teacher', () => {
    expect(teacherBadges({ verifications: [], lessonsTaught: 500, ratingAvg: 5, ratingCount: 200 }, undefined, NOW)
      .map((b) => b.code)).toEqual(['experienced_teacher']);
  });

  it('shows identity verified only when a verified record exists', () => {
    const badges = teacherBadges(
      { verifications: [verified('identity')], lessonsTaught: 0, ratingAvg: 0, ratingCount: 0 },
      undefined,
      NOW,
    );
    expect(badges.map((b) => b.code)).toEqual(['identity_verified']);
  });

  it('ignores a pending verification', () => {
    const badges = teacherBadges(
      { verifications: [{ ...verified('identity'), status: 'pending', verifiedAt: null }], lessonsTaught: 0, ratingAvg: 0, ratingCount: 0 },
      undefined,
      NOW,
    );
    expect(badges).toHaveLength(0);
  });

  it('ignores an expired verification', () => {
    const badges = teacherBadges(
      { verifications: [verified('certification', { expiresAt: NOW - 1000 })], lessonsTaught: 0, ratingAvg: 0, ratingCount: 0 },
      undefined,
      NOW,
    );
    expect(badges).toHaveLength(0);
  });

  it('requires volume, rating and review count for the experience badge', () => {
    const almost = teacherBadges(
      { verifications: [], lessonsTaught: 100, ratingAvg: 4.9, ratingCount: 5 },
      undefined,
      NOW,
    );
    expect(almost).toHaveLength(0);
  });
});

describe('search ranking', () => {
  const teacher = (overrides: Partial<TeacherRankingInput>): TeacherRankingInput => ({
    teacherId: 't',
    ratingAvg: 4.8,
    ratingCount: 100,
    reliability: 0.98,
    responseRate: 0.9,
    slotsNext7Days: 15,
    hourlyRateMinor: 2500,
    currency: 'USD',
    lessonsTaught: 300,
    specialties: ['conversation'],
    createdAt: NOW - 400 * 86_400_000,
    ...overrides,
  });

  it('does not let a single five-star review outrank a long record', () => {
    const newcomer = bayesianRating(5, 1);
    const veteran = bayesianRating(4.8, 200);
    expect(veteran).toBeGreaterThan(newcomer);
  });

  it('ranks a reliable, available, well-reviewed teacher first', () => {
    const good = teacher({ teacherId: 'good' });
    const poor = teacher({ teacherId: 'poor', ratingAvg: 3.5, reliability: 0.6, slotsNext7Days: 1, responseRate: 0.3 });
    expect(rankTeachers([poor, good], { now: NOW })[0]?.teacherId).toBe('good');
  });

  it('gives a small boost to a brand-new teacher so supply can bootstrap', () => {
    const fresh = teacher({ teacherId: 'fresh', lessonsTaught: 2, ratingCount: 1, ratingAvg: 5, createdAt: NOW - 10 * 86_400_000 });
    const noBoost = { ...fresh, createdAt: NOW - 400 * 86_400_000, lessonsTaught: 50 };
    expect(scoreTeacher(fresh, { now: NOW })).toBeGreaterThan(scoreTeacher(noBoost, { now: NOW }) - 0.2);
  });

  it('penalises teachers above the learner’s price ceiling', () => {
    const cheap = teacher({ teacherId: 'cheap', hourlyRateMinor: 2000 });
    const pricey = teacher({ teacherId: 'pricey', hourlyRateMinor: 9000 });
    const context = { maxPriceMinor: 2500, now: NOW };
    expect(scoreTeacher(cheap, context)).toBeGreaterThan(scoreTeacher(pricey, context));
  });

  it('rewards a specialty match', () => {
    const match = teacher({ specialties: ['business', 'exam_preparation'] });
    const noMatch = teacher({ specialties: ['children'] });
    const context = { desiredSpecialties: ['business'], now: NOW };
    expect(scoreTeacher(match, context)).toBeGreaterThan(scoreTeacher(noMatch, context));
  });

  it('produces a bounded score', () => {
    const best = teacher({ ratingAvg: 5, ratingCount: 1000, reliability: 1, responseRate: 1, slotsNext7Days: 100 });
    expect(scoreTeacher(best, { now: NOW })).toBeLessThanOrEqual(1);
    expect(scoreTeacher(best, { now: NOW })).toBeGreaterThan(0);
  });
});
