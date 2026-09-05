import { z } from 'zod';
import { DEFAULT_COMMISSION_TIERS } from '../pricing/commission';
import { DEFAULT_REFUND_POLICY } from '../pricing/refund';
import { DEFAULT_PLANS } from '../pricing/plans';
import { DEFAULT_RANKING_WEIGHTS } from '../marketplace/ranking';
import { DEFAULT_BADGE_THRESHOLDS } from '../marketplace/badges';
import { DEFAULT_REFERRAL_CONFIG } from '../pricing/referrals';
import { DEFAULT_SRS_SETTINGS } from '../srs/scheduler';

/**
 * Everything that must be tunable without shipping a release (brief §37, §38,
 * §40, §69). The client fetches this, validates it, and falls back to the
 * compiled defaults when the payload is malformed — a bad config edit degrades
 * to known-good behaviour instead of breaking the app.
 */

const commissionTierSchema = z.object({
  minLessons: z.number().int().nonnegative(),
  maxLessons: z.number().int().positive().nullable(),
  bps: z.number().int().min(0).max(10_000),
});

const refundWindowSchema = z.object({
  minHoursBefore: z.number().nonnegative(),
  learnerRefundBps: z.number().int().min(0).max(10_000),
  teacherCompensationBps: z.number().int().min(0).max(10_000),
});

export const remoteConfigSchema = z.object({
  version: z.number().int().nonnegative(),
  plans: z.record(z.string(), z.unknown()).optional(),
  commissionTiers: z.array(commissionTierSchema).min(1),
  teacherCommissionOverrideAllowed: z.boolean().default(true),
  refundPolicy: z.object({
    learnerCancellation: z.array(refundWindowSchema).min(1),
    teacherCancellationRefundBps: z.number().int().min(0).max(10_000),
    teacherCancellationCreditBps: z.number().int().min(0).max(10_000),
    learnerNoShowRefundBps: z.number().int().min(0).max(10_000),
    teacherNoShowRefundBps: z.number().int().min(0).max(10_000),
    technicalFailureRefundBps: z.number().int().min(0).max(10_000),
  }),
  referral: z.object({
    refereeTrialDays: z.number().int().nonnegative(),
    referrerRewardDays: z.number().int().nonnegative(),
    qualifyingLessons: z.number().int().nonnegative(),
    qualifyingDistinctDays: z.number().int().nonnegative(),
    monthlyRewardCap: z.number().int().nonnegative(),
    sameDeviceLimit: z.number().int().nonnegative(),
  }),
  ranking: z.object({
    rating: z.number(),
    reliability: z.number(),
    responsiveness: z.number(),
    availability: z.number(),
    priceFit: z.number(),
    newTeacherBoost: z.number(),
    specialtyMatch: z.number(),
  }),
  badgeThresholds: z.object({
    experiencedMinLessons: z.number().int().nonnegative(),
    experiencedMinRating: z.number().min(0).max(5),
    experiencedMinReviews: z.number().int().nonnegative(),
  }),
  booking: z.object({
    slotMinutes: z.number().int().positive(),
    bufferMinutes: z.number().int().nonnegative(),
    leadTimeMinutes: z.number().int().nonnegative(),
    maxPerDay: z.number().int().positive().nullable(),
    payoutHoldHours: z.number().int().nonnegative(),
  }),
  srs: z.object({
    learningStepsMinutes: z.array(z.number().positive()).min(1),
    graduatingIntervalDays: z.number().positive(),
    easyIntervalDays: z.number().positive(),
    masteredIntervalDays: z.number().positive(),
    leechThreshold: z.number().int().positive(),
    maxIntervalDays: z.number().positive(),
  }),
  ai: z.object({
    conversationModel: z.string(),
    evaluationModel: z.string(),
    maxTurnsPerSession: z.number().int().positive(),
    rateLimitPerMinute: z.number().int().positive(),
  }),
  features: z.record(z.string(), z.boolean()).default({}),
});

export type RemoteConfig = z.infer<typeof remoteConfigSchema>;

export const DEFAULT_REMOTE_CONFIG: RemoteConfig = {
  version: 0,
  plans: DEFAULT_PLANS as unknown as Record<string, unknown>,
  commissionTiers: DEFAULT_COMMISSION_TIERS.map((t) => ({ ...t })),
  teacherCommissionOverrideAllowed: true,
  refundPolicy: {
    learnerCancellation: DEFAULT_REFUND_POLICY.learnerCancellation.map((w) => ({ ...w })),
    teacherCancellationRefundBps: DEFAULT_REFUND_POLICY.teacherCancellationRefundBps,
    teacherCancellationCreditBps: DEFAULT_REFUND_POLICY.teacherCancellationCreditBps,
    learnerNoShowRefundBps: DEFAULT_REFUND_POLICY.learnerNoShowRefundBps,
    teacherNoShowRefundBps: DEFAULT_REFUND_POLICY.teacherNoShowRefundBps,
    technicalFailureRefundBps: DEFAULT_REFUND_POLICY.technicalFailureRefundBps,
  },
  referral: { ...DEFAULT_REFERRAL_CONFIG },
  ranking: { ...DEFAULT_RANKING_WEIGHTS },
  badgeThresholds: { ...DEFAULT_BADGE_THRESHOLDS },
  booking: {
    slotMinutes: 30,
    bufferMinutes: 10,
    leadTimeMinutes: 120,
    maxPerDay: 10,
    payoutHoldHours: 24,
  },
  srs: {
    learningStepsMinutes: [...DEFAULT_SRS_SETTINGS.learningStepsMinutes],
    graduatingIntervalDays: DEFAULT_SRS_SETTINGS.graduatingIntervalDays,
    easyIntervalDays: DEFAULT_SRS_SETTINGS.easyIntervalDays,
    masteredIntervalDays: DEFAULT_SRS_SETTINGS.masteredIntervalDays,
    leechThreshold: DEFAULT_SRS_SETTINGS.leechThreshold,
    maxIntervalDays: DEFAULT_SRS_SETTINGS.maxIntervalDays,
  },
  ai: {
    conversationModel: 'claude-sonnet-5',
    evaluationModel: 'claude-sonnet-5',
    maxTurnsPerSession: 40,
    rateLimitPerMinute: 20,
  },
  features: {
    community: true,
    offlineDownloads: true,
    immersionMode: true,
    leaderboards: false,
  },
};

/** Parse a fetched payload, falling back to defaults on any problem. */
export function parseRemoteConfig(payload: unknown): { config: RemoteConfig; usedFallback: boolean } {
  const result = remoteConfigSchema.safeParse(payload);
  if (!result.success) return { config: DEFAULT_REMOTE_CONFIG, usedFallback: true };
  return { config: result.data, usedFallback: false };
}

export function featureEnabled(config: RemoteConfig, key: string, fallback = false): boolean {
  return config.features[key] ?? fallback;
}
