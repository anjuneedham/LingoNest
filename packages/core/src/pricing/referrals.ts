/**
 * Referrals (brief §40). Rewards are configuration, and qualification requires
 * genuine activity so the programme cannot be farmed.
 */

export interface ReferralConfig {
  readonly refereeTrialDays: number;
  readonly referrerRewardDays: number;
  /** Lessons the referee must complete before either side is rewarded. */
  readonly qualifyingLessons: number;
  /** Spread over at least this many distinct days. */
  readonly qualifyingDistinctDays: number;
  /** Maximum rewards one account can earn per calendar month. */
  readonly monthlyRewardCap: number;
  /** Referrals from the same device/IP beyond this are held for review. */
  readonly sameDeviceLimit: number;
}

export const DEFAULT_REFERRAL_CONFIG: ReferralConfig = {
  refereeTrialDays: 7,
  referrerRewardDays: 7,
  qualifyingLessons: 3,
  qualifyingDistinctDays: 2,
  monthlyRewardCap: 10,
  sameDeviceLimit: 2,
};

export type ReferralState = 'created' | 'signed_up' | 'qualified' | 'rewarded' | 'rejected';

export interface ReferralActivity {
  readonly lessonsCompleted: number;
  readonly distinctActiveDays: number;
  readonly sameDeviceAsReferrer: boolean;
  readonly sharedDeviceReferralCount: number;
  readonly referrerRewardsThisMonth: number;
  readonly refereeAccountAgeHours: number;
}

export interface QualificationResult {
  readonly qualifies: boolean;
  readonly holdForReview: boolean;
  readonly reasons: readonly string[];
}

export function evaluateReferral(
  activity: ReferralActivity,
  config: ReferralConfig = DEFAULT_REFERRAL_CONFIG,
): QualificationResult {
  const reasons: string[] = [];
  let holdForReview = false;

  if (activity.lessonsCompleted < config.qualifyingLessons) {
    reasons.push(`needs_lessons:${config.qualifyingLessons - activity.lessonsCompleted}`);
  }
  if (activity.distinctActiveDays < config.qualifyingDistinctDays) {
    reasons.push(`needs_days:${config.qualifyingDistinctDays - activity.distinctActiveDays}`);
  }
  if (activity.referrerRewardsThisMonth >= config.monthlyRewardCap) {
    reasons.push('monthly_cap_reached');
  }
  if (activity.sameDeviceAsReferrer) {
    reasons.push('same_device');
    holdForReview = true;
  }
  if (activity.sharedDeviceReferralCount > config.sameDeviceLimit) {
    reasons.push('device_referral_limit');
    holdForReview = true;
  }

  return { qualifies: reasons.length === 0, holdForReview, reasons };
}
