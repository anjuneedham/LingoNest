/**
 * Verification badges (brief §84).
 *
 * A badge is derived from verification records, never stored as a flag on the
 * profile. One implementation, used by the search card, the profile page and
 * the admin list, so a badge cannot appear in one place and not another — and
 * cannot be invented.
 */

export type VerificationKind = 'identity' | 'certification' | 'education' | 'language';
export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'expired';

export interface VerificationRecord {
  readonly kind: VerificationKind;
  readonly status: VerificationStatus;
  /** Epoch ms; null means it does not expire. */
  readonly expiresAt: number | null;
  readonly verifiedAt: number | null;
}

export type BadgeCode = 'identity_verified' | 'certification_verified' | 'experienced_teacher';

export interface Badge {
  readonly code: BadgeCode;
  readonly labelKey: string;
  readonly descriptionKey: string;
}

export interface BadgeThresholds {
  readonly experiencedMinLessons: number;
  readonly experiencedMinRating: number;
  readonly experiencedMinReviews: number;
}

export const DEFAULT_BADGE_THRESHOLDS: BadgeThresholds = {
  experiencedMinLessons: 100,
  experiencedMinRating: 4.6,
  experiencedMinReviews: 20,
};

function isActive(record: VerificationRecord, now: number): boolean {
  if (record.status !== 'verified') return false;
  if (record.verifiedAt === null) return false;
  if (record.expiresAt !== null && record.expiresAt <= now) return false;
  return true;
}

export function teacherBadges(
  input: {
    verifications: readonly VerificationRecord[];
    lessonsTaught: number;
    ratingAvg: number;
    ratingCount: number;
  },
  thresholds: BadgeThresholds = DEFAULT_BADGE_THRESHOLDS,
  now = Date.now(),
): Badge[] {
  const badges: Badge[] = [];

  if (input.verifications.some((v) => v.kind === 'identity' && isActive(v, now))) {
    badges.push({
      code: 'identity_verified',
      labelKey: 'teacher.badge.identity',
      descriptionKey: 'teacher.badge.identity.desc',
    });
  }

  if (input.verifications.some((v) => v.kind === 'certification' && isActive(v, now))) {
    badges.push({
      code: 'certification_verified',
      labelKey: 'teacher.badge.certification',
      descriptionKey: 'teacher.badge.certification.desc',
    });
  }

  if (
    input.lessonsTaught >= thresholds.experiencedMinLessons &&
    input.ratingCount >= thresholds.experiencedMinReviews &&
    input.ratingAvg >= thresholds.experiencedMinRating
  ) {
    badges.push({
      code: 'experienced_teacher',
      labelKey: 'teacher.badge.experienced',
      descriptionKey: 'teacher.badge.experienced.desc',
    });
  }

  return badges;
}
