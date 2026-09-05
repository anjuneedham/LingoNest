import { describe, expect, it } from 'vitest';
import { formatMoney, splitAmount, toMajorUnits, toMinorUnits } from '../src/pricing/currency';
import {
  DEFAULT_PLANS,
  annualSavingBps,
  checkAiConversationLimit,
  checkLessonLimit,
  entitlementsFor,
  planPrice,
} from '../src/pricing/plans';
import {
  DEFAULT_COMMISSION_TIERS,
  applyTutorDiscount,
  commissionBpsFor,
  lessonEarnings,
  packagePerLessonMinor,
  packageSavingBps,
  summariseEarnings,
} from '../src/pricing/commission';
import { DEFAULT_REFUND_POLICY, describeRefund, refundOutcome } from '../src/pricing/refund';
import { evaluateReferral } from '../src/pricing/referrals';

describe('currency', () => {
  it('handles zero-decimal currencies', () => {
    expect(toMinorUnits(1500, 'JPY')).toBe(1500);
    expect(toMinorUnits(12.5, 'USD')).toBe(1250);
    expect(toMajorUnits(1250, 'USD')).toBe(12.5);
  });

  it('formats money for display', () => {
    expect(formatMoney(999, 'USD', 'en-US')).toBe('$9.99');
    expect(formatMoney(1500, 'JPY', 'en-US')).toBe('¥1,500');
  });

  it('never loses a cent when splitting, and rounds in the teacher’s favour', () => {
    for (const total of [1, 7, 999, 2501, 12_345]) {
      const { feeMinor, netMinor } = splitAmount(total, 2000);
      expect(feeMinor + netMinor).toBe(total);
      expect(feeMinor).toBeLessThanOrEqual(Math.round((total * 2000) / 10_000));
    }
  });

  it('rejects nonsense inputs', () => {
    expect(() => splitAmount(-1, 2000)).toThrow();
    expect(() => splitAmount(100, 20_000)).toThrow();
  });
});

describe('plans and entitlements', () => {
  it('falls back to free with no subscription', () => {
    const e = entitlementsFor(null);
    expect(e.dailyLessonLimit).toBe(3);
    expect(e.speakingPractice).toBe(false);
  });

  it('grants premium entitlements while active', () => {
    const e = entitlementsFor({ planCode: 'premium', status: 'active', currentPeriodEnd: null, cancelAtPeriodEnd: false });
    expect(e.dailyLessonLimit).toBeNull();
    expect(e.offlineDownloads).toBe(true);
  });

  it('keeps access briefly while past due rather than cutting a paying learner off', () => {
    const e = entitlementsFor({ planCode: 'premium', status: 'past_due', currentPeriodEnd: null, cancelAtPeriodEnd: false });
    expect(e.adFree).toBe(true);
  });

  it('drops to free once the period has expired', () => {
    const e = entitlementsFor(
      { planCode: 'premium', status: 'active', currentPeriodEnd: 1000, cancelAtPeriodEnd: false },
      DEFAULT_PLANS,
      5000,
    );
    expect(e.dailyLessonLimit).toBe(3);
  });

  it('prices per currency and falls back to USD', () => {
    expect(planPrice(DEFAULT_PLANS.premium, 'USD', 'month').amountMinor).toBe(999);
    expect(planPrice(DEFAULT_PLANS.premium, 'JPY', 'year').amountMinor).toBe(12_000);
    const missing = planPrice({ ...DEFAULT_PLANS.premium, prices: { USD: { month: 999 } } }, 'BRL', 'month');
    expect(missing.currency).toBe('USD');
  });

  it('computes the annual saving shown on the paywall', () => {
    expect(annualSavingBps(DEFAULT_PLANS.premium, 'USD')).toBeGreaterThan(3000);
  });

  it('enforces AI limits server-side per plan', () => {
    const free = entitlementsFor(null);
    const usage = { aiConversationsThisMonth: 5, aiEvaluationsThisMonth: 0, lessonsToday: 0 };
    const check = checkAiConversationLimit(free, usage);
    expect(check.allowed).toBe(false);
    if (!check.allowed) expect(check.limit).toBe(5);
  });

  it('treats unlimited entitlements as unlimited', () => {
    const plus = entitlementsFor({ planCode: 'premium_plus', status: 'active', currentPeriodEnd: null, cancelAtPeriodEnd: false });
    const check = checkAiConversationLimit(plus, { aiConversationsThisMonth: 9999, aiEvaluationsThisMonth: 0, lessonsToday: 0 });
    expect(check.allowed).toBe(true);
  });

  it('limits free lessons per day', () => {
    const free = entitlementsFor(null);
    expect(checkLessonLimit(free, { aiConversationsThisMonth: 0, aiEvaluationsThisMonth: 0, lessonsToday: 3 }).allowed).toBe(false);
    expect(checkLessonLimit(free, { aiConversationsThisMonth: 0, aiEvaluationsThisMonth: 0, lessonsToday: 1 }).allowed).toBe(true);
  });
});

describe('marketplace commission', () => {
  it('resolves the tier from lifetime lessons taught', () => {
    expect(commissionBpsFor(0)).toBe(2500);
    expect(commissionBpsFor(10)).toBe(2500);
    expect(commissionBpsFor(11)).toBe(2000);
    expect(commissionBpsFor(50)).toBe(2000);
    expect(commissionBpsFor(51)).toBe(1800);
    expect(commissionBpsFor(151)).toBe(1500);
    expect(commissionBpsFor(100_000)).toBe(1500);
  });

  it('splits a $25 lesson at 20% into $20 teacher / $5 platform', () => {
    const earnings = lessonEarnings({ priceMinor: 2500, currency: 'USD', lessonsTaught: 20 });
    expect(earnings.commissionBps).toBe(2000);
    expect(earnings.teacherEarningsMinor).toBe(2000);
    expect(earnings.platformFeeMinor).toBe(500);
  });

  it('honours a negotiated per-teacher override', () => {
    const earnings = lessonEarnings({ priceMinor: 5000, currency: 'USD', lessonsTaught: 0, overrideBps: 1000 });
    expect(earnings.teacherEarningsMinor).toBe(4500);
  });

  it('accepts configured tiers rather than hardcoding them', () => {
    const custom = [{ minLessons: 0, maxLessons: null, bps: 500 }];
    expect(commissionBpsFor(500, custom)).toBe(500);
  });

  it('never leaks a cent in the split', () => {
    for (const price of [1, 333, 999, 2501, 7777]) {
      const e = lessonEarnings({ priceMinor: price, currency: 'USD', lessonsTaught: 5 });
      expect(e.platformFeeMinor + e.teacherEarningsMinor).toBe(price);
    }
  });

  it('prices packages and reports the saving', () => {
    const pkg = { id: 'p5', lessonCount: 5, priceMinor: 11_500, currency: 'USD' as const };
    expect(packagePerLessonMinor(pkg)).toBe(2300);
    expect(packageSavingBps(pkg, 2500)).toBe(800); // 8% off five single lessons
  });

  it('applies a subscriber tutor discount', () => {
    expect(applyTutorDiscount(2500, 1000)).toBe(2250);
    expect(applyTutorDiscount(2500, 0)).toBe(2500);
  });

  it('tells a teacher what their next commission tier is', () => {
    const summary = summariseEarnings({
      pendingMinor: 5000,
      availableMinor: 12_000,
      lifetimeMinor: 250_000,
      thisMonthMinor: 40_000,
      currency: 'USD',
      lessonsThisMonth: 16,
      lessonsTaught: 45,
    });
    expect(summary.nextTierAtLessons).toBe(51);
    expect(summary.nextTierBps).toBe(1800);
  });

  it('reports no next tier at the top', () => {
    const summary = summariseEarnings({
      pendingMinor: 0,
      availableMinor: 0,
      lifetimeMinor: 0,
      thisMonthMinor: 0,
      currency: 'USD',
      lessonsThisMonth: 0,
      lessonsTaught: 400,
      tiers: DEFAULT_COMMISSION_TIERS,
    });
    expect(summary.nextTierAtLessons).toBeNull();
  });
});

describe('refund policy', () => {
  const lesson = { priceMinor: 2500, currency: 'USD' as const, teacherEarningsMinor: 2000 };

  it('refunds in full more than 24 hours out', () => {
    const outcome = refundOutcome({ ...lesson, hoursBefore: 48, reason: 'learner_cancelled' });
    expect(outcome.refundMinor).toBe(2500);
    expect(outcome.teacherPayoutMinor).toBe(0);
    expect(outcome.policyApplied).toBe('learner_cancelled_24h');
  });

  it('refunds half between 12 and 24 hours', () => {
    const outcome = refundOutcome({ ...lesson, hoursBefore: 18, reason: 'learner_cancelled' });
    expect(outcome.refundMinor).toBe(1250);
    expect(outcome.teacherPayoutMinor).toBe(1000);
  });

  it('refunds nothing inside 12 hours and pays the teacher', () => {
    const outcome = refundOutcome({ ...lesson, hoursBefore: 3, reason: 'learner_cancelled' });
    expect(outcome.refundMinor).toBe(0);
    expect(outcome.teacherPayoutMinor).toBe(2000);
  });

  it('always refunds the learner when the teacher cancels, with goodwill credit', () => {
    const outcome = refundOutcome({ ...lesson, hoursBefore: 1, reason: 'teacher_cancelled' });
    expect(outcome.refundMinor).toBe(2500);
    expect(outcome.teacherPayoutMinor).toBe(0);
    expect(outcome.learnerCreditMinor).toBeGreaterThan(0);
  });

  it('pays the teacher when the learner does not show up', () => {
    const outcome = refundOutcome({ ...lesson, hoursBefore: 0, reason: 'learner_no_show' });
    expect(outcome.refundMinor).toBe(0);
    expect(outcome.teacherPayoutMinor).toBe(2000);
  });

  it('refunds the learner and pays the teacher on a technical failure, funded by the platform', () => {
    const outcome = refundOutcome({ ...lesson, hoursBefore: 0, reason: 'technical_failure' });
    expect(outcome.refundMinor).toBe(2500);
    expect(outcome.teacherPayoutMinor).toBe(2000);
    expect(outcome.platformFeeMinor).toBe(0);
  });

  it('never pays out more than was collected, except platform-funded goodwill', () => {
    for (const hours of [0, 6, 13, 25, 100]) {
      for (const reason of ['learner_cancelled', 'teacher_cancelled', 'learner_no_show', 'teacher_no_show'] as const) {
        const o = refundOutcome({ ...lesson, hoursBefore: hours, reason });
        expect(o.refundMinor + o.teacherPayoutMinor + o.platformFeeMinor).toBeLessThanOrEqual(lesson.priceMinor);
      }
    }
  });

  it('accepts a configured policy', () => {
    const strict = {
      ...DEFAULT_REFUND_POLICY,
      learnerCancellation: [{ minHoursBefore: 0, learnerRefundBps: 0, teacherCompensationBps: 10_000 }],
    };
    const outcome = refundOutcome({ ...lesson, hoursBefore: 200, reason: 'learner_cancelled', policy: strict });
    expect(outcome.refundMinor).toBe(0);
  });

  it('tells the learner the outcome before they confirm', () => {
    expect(describeRefund(48).messageKey).toBe('booking.cancel.fullRefund');
    expect(describeRefund(18).messageKey).toBe('booking.cancel.partialRefund');
    expect(describeRefund(2).messageKey).toBe('booking.cancel.noRefund');
  });
});

describe('referral abuse prevention', () => {
  const base = {
    lessonsCompleted: 3,
    distinctActiveDays: 2,
    sameDeviceAsReferrer: false,
    sharedDeviceReferralCount: 0,
    referrerRewardsThisMonth: 0,
    refereeAccountAgeHours: 72,
  };

  it('qualifies a genuine referral', () => {
    expect(evaluateReferral(base).qualifies).toBe(true);
  });

  it('withholds the reward until the referee actually uses the product', () => {
    const result = evaluateReferral({ ...base, lessonsCompleted: 0, distinctActiveDays: 0 });
    expect(result.qualifies).toBe(false);
    expect(result.reasons.some((r) => r.startsWith('needs_lessons'))).toBe(true);
  });

  it('holds same-device referrals for review', () => {
    const result = evaluateReferral({ ...base, sameDeviceAsReferrer: true });
    expect(result.holdForReview).toBe(true);
  });

  it('caps rewards per month', () => {
    expect(evaluateReferral({ ...base, referrerRewardsThisMonth: 10 }).qualifies).toBe(false);
  });
});
