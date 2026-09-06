import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

/**
 * Plan limits, enforced server-side.
 *
 * The client shows how many AI sessions are left, but the number that matters
 * is this one: a modified client cannot grant itself unlimited practice
 * because the counter and the check both live here.
 */

export type AiKind = 'conversation' | 'roleplay' | 'coach' | 'evaluation' | 'content_assistant';

export interface Entitlements {
  readonly planCode: string;
  readonly aiConversationsPerMonth: number | null;
  readonly aiEvaluationsPerMonth: number | null;
  readonly dailyLessonLimit: number | null;
  readonly speakingPractice: boolean;
  readonly aiStudyCoach: boolean;
  readonly tutorDiscountBps: number;
}

const FREE_FALLBACK: Entitlements = {
  planCode: 'free',
  aiConversationsPerMonth: 5,
  aiEvaluationsPerMonth: 10,
  dailyLessonLimit: 3,
  speakingPractice: false,
  aiStudyCoach: false,
  tutorDiscountBps: 0,
};

const ENTITLING_STATUSES = new Set(['active', 'trialing', 'past_due']);

export async function entitlementsFor(db: SupabaseClient, userId: string): Promise<Entitlements> {
  const { data: subscription } = await db
    .from('subscriptions')
    .select('plan_code, status, current_period_end')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing', 'past_due'])
    .maybeSingle();

  if (!subscription || !ENTITLING_STATUSES.has(subscription.status)) return FREE_FALLBACK;
  if (subscription.current_period_end && new Date(subscription.current_period_end) < new Date()) {
    return FREE_FALLBACK;
  }

  const { data: plan } = await db
    .from('subscription_plans')
    .select('code, entitlements')
    .eq('code', subscription.plan_code)
    .maybeSingle();

  if (!plan) return FREE_FALLBACK;
  const e = (plan.entitlements ?? {}) as Record<string, unknown>;

  return {
    planCode: plan.code,
    aiConversationsPerMonth: (e.aiConversationsPerMonth as number | null) ?? null,
    aiEvaluationsPerMonth: (e.aiEvaluationsPerMonth as number | null) ?? null,
    dailyLessonLimit: (e.dailyLessonLimit as number | null) ?? null,
    speakingPractice: Boolean(e.speakingPractice),
    aiStudyCoach: Boolean(e.aiStudyCoach),
    tutorDiscountBps: (e.tutorDiscountBps as number) ?? 0,
  };
}

function periodStart(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

export interface UsageCheck {
  readonly allowed: boolean;
  readonly used: number;
  readonly limit: number | null;
}

/** Read the counter without incrementing it. */
export async function checkAiUsage(
  db: SupabaseClient,
  userId: string,
  kind: AiKind,
  entitlements: Entitlements,
): Promise<UsageCheck> {
  const limit =
    kind === 'evaluation'
      ? entitlements.aiEvaluationsPerMonth
      : entitlements.aiConversationsPerMonth;

  const { data } = await db
    .from('ai_usage_counters')
    .select('count')
    .eq('user_id', userId)
    .eq('period_start', periodStart())
    .eq('kind', kind)
    .maybeSingle();

  const used = data?.count ?? 0;
  if (limit === null) return { allowed: true, used, limit: null };
  return { allowed: used < limit, used, limit };
}

/** Increment after a successful call, so a failed request costs nothing. */
export async function recordAiUsage(db: SupabaseClient, userId: string, kind: AiKind): Promise<void> {
  const period = periodStart();
  const { data } = await db
    .from('ai_usage_counters')
    .select('id, count')
    .eq('user_id', userId)
    .eq('period_start', period)
    .eq('kind', kind)
    .maybeSingle();

  if (data) {
    await db.from('ai_usage_counters').update({ count: data.count + 1 }).eq('id', data.id);
  } else {
    await db.from('ai_usage_counters').insert({ user_id: userId, period_start: period, kind, count: 1 });
  }
}
