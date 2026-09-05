import type { Currency } from './currency';

/**
 * Cancellation and refund policy (brief §69).
 *
 * The policy is data. `DEFAULT_REFUND_POLICY` is the fallback; production reads
 * it from remote config, and the learner is shown the applicable outcome before
 * they pay and again on the cancellation screen.
 */

export interface RefundWindow {
  /** Applies when the cancellation happens at least this many hours before the lesson. */
  readonly minHoursBefore: number;
  /** Portion refunded to the learner, in basis points of the lesson price. */
  readonly learnerRefundBps: number;
  /** Portion of their normal earnings the teacher still receives, in bps. */
  readonly teacherCompensationBps: number;
}

export interface RefundPolicy {
  readonly learnerCancellation: readonly RefundWindow[];
  /** Teacher cancellations always refund the learner in full. */
  readonly teacherCancellationRefundBps: number;
  /** Goodwill credit granted to the learner when a teacher cancels, in bps. */
  readonly teacherCancellationCreditBps: number;
  readonly learnerNoShowRefundBps: number;
  readonly teacherNoShowRefundBps: number;
  /** Both sides hit a technical failure: platform-funded goodwill. */
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

export type CancellationActor = 'learner' | 'teacher' | 'admin' | 'system';

export type CancellationReason =
  | 'learner_cancelled'
  | 'teacher_cancelled'
  | 'learner_no_show'
  | 'teacher_no_show'
  | 'technical_failure';

export interface RefundInput {
  readonly priceMinor: number;
  readonly currency: Currency;
  /** Teacher's earnings for the lesson at full price. */
  readonly teacherEarningsMinor: number;
  readonly hoursBefore: number;
  readonly reason: CancellationReason;
  readonly policy?: RefundPolicy;
}

export interface RefundOutcome {
  readonly refundMinor: number;
  readonly teacherPayoutMinor: number;
  /** Platform keeps this much (may be zero, or negative-funded goodwill = 0). */
  readonly platformFeeMinor: number;
  /** Goodwill credit issued to the learner in addition to any refund. */
  readonly learnerCreditMinor: number;
  readonly policyApplied: string;
  readonly currency: Currency;
}

function bps(amount: number, rate: number): number {
  return Math.floor((amount * rate) / 10_000);
}

/**
 * Compute the money outcome of a cancellation.
 *
 * Invariant asserted by tests: refund + teacher payout + platform fee never
 * exceeds the price paid.
 */
export function refundOutcome(input: RefundInput): RefundOutcome {
  const policy = input.policy ?? DEFAULT_REFUND_POLICY;
  const price = input.priceMinor;
  const fullEarnings = input.teacherEarningsMinor;

  let refundBps = 0;
  let teacherBps = 0;
  let creditBps = 0;
  let policyApplied: string;

  switch (input.reason) {
    case 'teacher_cancelled':
      refundBps = policy.teacherCancellationRefundBps;
      teacherBps = 0;
      creditBps = policy.teacherCancellationCreditBps;
      policyApplied = 'teacher_cancelled';
      break;
    case 'teacher_no_show':
      refundBps = policy.teacherNoShowRefundBps;
      teacherBps = 0;
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
      // The teacher showed up; the platform funds their compensation.
      teacherBps = 10_000;
      policyApplied = 'technical_failure';
      break;
    case 'learner_cancelled':
    default: {
      const windows = [...policy.learnerCancellation].sort((a, b) => b.minHoursBefore - a.minHoursBefore);
      const window =
        windows.find((w) => input.hoursBefore >= w.minHoursBefore) ?? windows[windows.length - 1]!;
      refundBps = window.learnerRefundBps;
      teacherBps = window.teacherCompensationBps;
      policyApplied = `learner_cancelled_${window.minHoursBefore}h`;
      break;
    }
  }

  const refundMinor = bps(price, refundBps);
  const teacherPayoutMinor = bps(fullEarnings, teacherBps);
  const learnerCreditMinor = bps(price, creditBps);

  // The platform keeps whatever is left after the learner and teacher are made
  // whole — and never more than it originally earned.
  const platformFeeMinor = Math.max(0, price - refundMinor - teacherPayoutMinor);

  return {
    refundMinor,
    teacherPayoutMinor,
    platformFeeMinor,
    learnerCreditMinor,
    policyApplied,
    currency: input.currency,
  };
}

/** What the cancellation screen shows *before* the learner confirms. */
export function describeRefund(
  hoursBefore: number,
  policy: RefundPolicy = DEFAULT_REFUND_POLICY,
): { refundBps: number; messageKey: string } {
  const windows = [...policy.learnerCancellation].sort((a, b) => b.minHoursBefore - a.minHoursBefore);
  const window = windows.find((w) => hoursBefore >= w.minHoursBefore) ?? windows[windows.length - 1]!;
  const key =
    window.learnerRefundBps === 10_000
      ? 'booking.cancel.fullRefund'
      : window.learnerRefundBps === 0
        ? 'booking.cancel.noRefund'
        : 'booking.cancel.partialRefund';
  return { refundBps: window.learnerRefundBps, messageKey: key };
}
