import type { Currency } from './currency';
import { DEFAULT_CURRENCY } from './currency';

/**
 * Subscription plans (brief §37).
 *
 * These defaults exist so the app works before remote config loads. Production
 * prices and entitlements come from `subscription_plans` in the database and are
 * remotely configurable — nothing here is a hardcoded business rule.
 */

export const PLAN_CODES = ['free', 'premium', 'premium_plus'] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export type BillingInterval = 'month' | 'year';

export interface PlanEntitlements {
  /** Lessons per day; null means unlimited. */
  readonly dailyLessonLimit: number | null;
  /** AI conversation sessions per month; null means unlimited. */
  readonly aiConversationsPerMonth: number | null;
  /** AI evaluation calls (writing/speaking feedback) per month. */
  readonly aiEvaluationsPerMonth: number | null;
  readonly speakingPractice: boolean;
  readonly advancedReview: boolean;
  readonly personalizedLearning: boolean;
  readonly offlineDownloads: boolean;
  readonly adFree: boolean;
  readonly aiStudyCoach: boolean;
  readonly learningReports: boolean;
  /** Discount applied to marketplace lessons, in basis points. */
  readonly tutorDiscountBps: number;
  readonly immersionMode: boolean;
}

export interface Plan {
  readonly code: PlanCode;
  readonly nameKey: string;
  readonly descriptionKey: string;
  /** Minor units keyed by currency then interval. */
  readonly prices: Partial<Record<Currency, Partial<Record<BillingInterval, number>>>>;
  readonly entitlements: PlanEntitlements;
  readonly trialDays: number;
}

export const DEFAULT_PLANS: Readonly<Record<PlanCode, Plan>> = {
  free: {
    code: 'free',
    nameKey: 'plan.free.name',
    descriptionKey: 'plan.free.description',
    prices: { USD: { month: 0, year: 0 } },
    trialDays: 0,
    entitlements: {
      dailyLessonLimit: 3,
      aiConversationsPerMonth: 5,
      aiEvaluationsPerMonth: 10,
      speakingPractice: false,
      advancedReview: false,
      personalizedLearning: false,
      offlineDownloads: false,
      adFree: false,
      aiStudyCoach: false,
      learningReports: false,
      tutorDiscountBps: 0,
      immersionMode: false,
    },
  },
  premium: {
    code: 'premium',
    nameKey: 'plan.premium.name',
    descriptionKey: 'plan.premium.description',
    prices: {
      USD: { month: 999, year: 7999 },
      CAD: { month: 1399, year: 10999 },
      GBP: { month: 899, year: 6999 },
      EUR: { month: 999, year: 7999 },
      AUD: { month: 1599, year: 11999 },
      JPY: { month: 1500, year: 12000 },
      MXN: { month: 19900, year: 159900 },
      BRL: { month: 4990, year: 39900 },
    },
    trialDays: 7,
    entitlements: {
      dailyLessonLimit: null,
      aiConversationsPerMonth: 40,
      aiEvaluationsPerMonth: 200,
      speakingPractice: true,
      advancedReview: true,
      personalizedLearning: true,
      offlineDownloads: true,
      adFree: true,
      aiStudyCoach: false,
      learningReports: false,
      tutorDiscountBps: 0,
      immersionMode: true,
    },
  },
  premium_plus: {
    code: 'premium_plus',
    nameKey: 'plan.premium_plus.name',
    descriptionKey: 'plan.premium_plus.description',
    prices: {
      USD: { month: 1999, year: 15999 },
      CAD: { month: 2699, year: 21999 },
      GBP: { month: 1799, year: 13999 },
      EUR: { month: 1999, year: 15999 },
      AUD: { month: 2999, year: 23999 },
      JPY: { month: 2900, year: 23000 },
      MXN: { month: 39900, year: 319900 },
      BRL: { month: 9990, year: 79900 },
    },
    trialDays: 7,
    entitlements: {
      dailyLessonLimit: null,
      aiConversationsPerMonth: null,
      aiEvaluationsPerMonth: null,
      speakingPractice: true,
      advancedReview: true,
      personalizedLearning: true,
      offlineDownloads: true,
      adFree: true,
      aiStudyCoach: true,
      learningReports: true,
      tutorDiscountBps: 1000, // 10% off marketplace lessons
      immersionMode: true,
    },
  },
};

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'expired'
  | 'paused'
  | 'none';

export interface SubscriptionState {
  readonly planCode: PlanCode;
  readonly status: SubscriptionStatus;
  readonly currentPeriodEnd: number | null;
  readonly cancelAtPeriodEnd: boolean;
}

const ENTITLED_STATUSES: ReadonlySet<SubscriptionStatus> = new Set(['active', 'trialing', 'past_due']);

/**
 * Resolve what a user may actually do.
 *
 * `past_due` keeps access briefly rather than cutting a paying learner off mid
 * lesson; the billing screen nags instead. Everything else falls back to free.
 */
export function entitlementsFor(
  subscription: SubscriptionState | null,
  plans: Readonly<Record<PlanCode, Plan>> = DEFAULT_PLANS,
  now = Date.now(),
): PlanEntitlements {
  if (!subscription) return plans.free.entitlements;
  const expired = subscription.currentPeriodEnd !== null && subscription.currentPeriodEnd < now;
  if (!ENTITLED_STATUSES.has(subscription.status) || expired) return plans.free.entitlements;
  return plans[subscription.planCode]?.entitlements ?? plans.free.entitlements;
}

export function planPrice(
  plan: Plan,
  currency: Currency,
  interval: BillingInterval,
): { amountMinor: number; currency: Currency } {
  const direct = plan.prices[currency]?.[interval];
  if (direct !== undefined) return { amountMinor: direct, currency };
  const fallback = plan.prices[DEFAULT_CURRENCY]?.[interval] ?? 0;
  return { amountMinor: fallback, currency: DEFAULT_CURRENCY };
}

/** Annual saving vs paying monthly, in basis points, for the paywall copy. */
export function annualSavingBps(plan: Plan, currency: Currency): number {
  const month = planPrice(plan, currency, 'month').amountMinor;
  const year = planPrice(plan, currency, 'year').amountMinor;
  if (month <= 0 || year <= 0) return 0;
  const monthlyTotal = month * 12;
  return Math.max(0, Math.round(((monthlyTotal - year) / monthlyTotal) * 10_000));
}

export interface UsageCounters {
  readonly aiConversationsThisMonth: number;
  readonly aiEvaluationsThisMonth: number;
  readonly lessonsToday: number;
}

export type LimitCheck =
  | { readonly allowed: true; readonly remaining: number | null }
  | { readonly allowed: false; readonly reason: 'limit_reached' | 'not_entitled'; readonly limit: number };

export function checkAiConversationLimit(e: PlanEntitlements, usage: UsageCounters): LimitCheck {
  const limit = e.aiConversationsPerMonth;
  if (limit === null) return { allowed: true, remaining: null };
  if (usage.aiConversationsThisMonth >= limit) return { allowed: false, reason: 'limit_reached', limit };
  return { allowed: true, remaining: limit - usage.aiConversationsThisMonth };
}

export function checkAiEvaluationLimit(e: PlanEntitlements, usage: UsageCounters): LimitCheck {
  const limit = e.aiEvaluationsPerMonth;
  if (limit === null) return { allowed: true, remaining: null };
  if (usage.aiEvaluationsThisMonth >= limit) return { allowed: false, reason: 'limit_reached', limit };
  return { allowed: true, remaining: limit - usage.aiEvaluationsThisMonth };
}

export function checkLessonLimit(e: PlanEntitlements, usage: UsageCounters): LimitCheck {
  const limit = e.dailyLessonLimit;
  if (limit === null) return { allowed: true, remaining: null };
  if (usage.lessonsToday >= limit) return { allowed: false, reason: 'limit_reached', limit };
  return { allowed: true, remaining: limit - usage.lessonsToday };
}
