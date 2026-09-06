import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

/**
 * Commission and refund arithmetic, mirroring @lingonest/core.
 *
 * The app and the server must agree exactly on what a teacher earns, so the
 * rules live in core and are re-implemented here against the same configuration
 * rows. The unit tests in packages/core are the specification; the assertions
 * in supabase/test check the database side.
 */

export interface CommissionTier {
  readonly min_lessons: number;
  readonly max_lessons: number | null;
  readonly bps: number;
}

export async function commissionTiers(db: SupabaseClient): Promise<CommissionTier[]> {
  const { data } = await db
    .from('commission_tiers')
    .select('min_lessons, max_lessons, bps')
    .eq('active', true)
    .order('min_lessons', { ascending: true });
  return (
    data ?? [
      { min_lessons: 0, max_lessons: 10, bps: 2500 },
      { min_lessons: 11, max_lessons: 50, bps: 2000 },
      { min_lessons: 51, max_lessons: 150, bps: 1800 },
      { min_lessons: 151, max_lessons: null, bps: 1500 },
    ]
  );
}

export function commissionBpsFor(lessonsTaught: number, tiers: readonly CommissionTier[]): number {
  let applicable = tiers[0]?.bps ?? 2000;
  for (const tier of tiers) {
    if (lessonsTaught >= tier.min_lessons && (tier.max_lessons === null || lessonsTaught <= tier.max_lessons)) {
      applicable = tier.bps;
    }
  }
  return applicable;
}

/** The remainder always goes to the teacher, never to the platform. */
export function splitAmount(totalMinor: number, feeBps: number): { feeMinor: number; netMinor: number } {
  const feeMinor = Math.floor((totalMinor * feeBps) / 10_000);
  return { feeMinor, netMinor: totalMinor - feeMinor };
}

export interface RefundWindow {
  readonly minHoursBefore: number;
  readonly learnerRefundBps: number;
  readonly teacherCompensationBps: number;
}

export interface RefundPolicy {
  readonly learnerCancellation: readonly RefundWindow[];
  readonly teacherCancellationRefundBps: number;
  readonly teacherCancellationCreditBps: number;
  readonly learnerNoShowRefundBps: number;
  readonly teacherNoShowRefundBps: number;
  readonly technicalFailureRefundBps: number;
}

export const DEFAULT_REFUND_POLICY: RefundPolicy = {
  learnerCancellation: [
    { minHoursBefore: 24, learnerRefundBps: 10_000, teacherCompensationBps: 0 },
    { minHoursBefore: 12, learnerRefundBps: 5_000, teacherCompensationBps: 5_000 },
    { minHoursBefore: 0, learnerRefundBps: 0, teacherCompensationBps: 10_000 },
  ],
  teacherCancellationRefundBps: 10_000,
  teacherCancellationCreditBps: 1_000,
  learnerNoShowRefundBps: 0,
  teacherNoShowRefundBps: 10_000,
  technicalFailureRefundBps: 10_000,
};

export async function refundPolicy(db: SupabaseClient): Promise<RefundPolicy> {
  const { data } = await db.from('remote_config').select('value').eq('key', 'refundPolicy').maybeSingle();
  const value = data?.value as Partial<RefundPolicy> | undefined;
  if (!value?.learnerCancellation?.length) return DEFAULT_REFUND_POLICY;
  return { ...DEFAULT_REFUND_POLICY, ...value } as RefundPolicy;
}

export type CancellationReason =
  | 'learner_cancelled'
  | 'teacher_cancelled'
  | 'learner_no_show'
  | 'teacher_no_show'
  | 'technical_failure';

export interface RefundOutcome {
  readonly refundMinor: number;
  readonly teacherPayoutMinor: number;
  readonly platformFeeMinor: number;
  readonly learnerCreditMinor: number;
  readonly policyApplied: string;
}

function bps(amount: number, rate: number): number {
  return Math.floor((amount * rate) / 10_000);
}

export function refundOutcome(input: {
  priceMinor: number;
  teacherEarningsMinor: number;
  hoursBefore: number;
  reason: CancellationReason;
  policy: RefundPolicy;
}): RefundOutcome {
  const { priceMinor: price, teacherEarningsMinor: earnings, policy } = input;
  let refundBps = 0;
  let teacherBps = 0;
  let creditBps = 0;
  let policyApplied: string;

  switch (input.reason) {
    case 'teacher_cancelled':
      refundBps = policy.teacherCancellationRefundBps;
      creditBps = policy.teacherCancellationCreditBps;
      policyApplied = 'teacher_cancelled';
      break;
    case 'teacher_no_show':
      refundBps = policy.teacherNoShowRefundBps;
      creditBps = policy.teacherCancellationCreditBps;
      policyApplied = 'teacher_no_show';
      break;
    case 'learner_no_show':
      refundBps = policy.learnerNoShowRefundBps;
      teacherBps = 10_000;
      policyApplied = 'learner_no_show';
      break;
    case 'technical_failure':
      refundBps = policy.technicalFailureRefundBps;
      teacherBps = 10_000;
      policyApplied = 'technical_failure';
      break;
    default: {
      const windows = [...policy.learnerCancellation].sort((a, b) => b.minHoursBefore - a.minHoursBefore);
      const window = windows.find((w) => input.hoursBefore >= w.minHoursBefore) ?? windows[windows.length - 1]!;
      refundBps = window.learnerRefundBps;
      teacherBps = window.teacherCompensationBps;
      policyApplied = `learner_cancelled_${window.minHoursBefore}h`;
    }
  }

  const refundMinor = bps(price, refundBps);
  const teacherPayoutMinor = bps(earnings, teacherBps);
  return {
    refundMinor,
    teacherPayoutMinor,
    platformFeeMinor: Math.max(0, price - refundMinor - teacherPayoutMinor),
    learnerCreditMinor: bps(price, creditBps),
    policyApplied,
  };
}
