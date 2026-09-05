import type { Cefr } from '../cefr/levels';
import type { Skill } from '../skills/skills';
import type { ActivityType } from '../activities/types';
import type { Currency } from '../pricing/currency';
import type { BillingInterval, PlanCode } from '../pricing/plans';

/**
 * The complete analytics contract (brief §70).
 *
 * `track()` accepts only this union, so a typo is a compile error and every
 * event's payload is documented by its type. Nothing here may carry lesson
 * text, message bodies, essay content, audio, email or precise location.
 */

export type AuthMethod = 'email' | 'apple' | 'google' | 'magic_link';
export type AiKind = 'conversation' | 'roleplay' | 'coach' | 'evaluation';
export type Platform = 'ios' | 'android' | 'web';

export type AnalyticsEvent =
  | { name: 'signup_completed'; props: { method: AuthMethod } }
  | { name: 'onboarding_completed'; props: { languageCode: string; variantCode?: string; goalMinutes: number } }
  | { name: 'language_selected'; props: { languageCode: string; variantCode?: string } }
  | { name: 'placement_started'; props: { languageCode: string; selfReport: string } }
  | { name: 'placement_completed'; props: { languageCode: string; estimatedCefr: Cefr; itemCount: number; confidence: number } }
  | { name: 'placement_skipped'; props: { languageCode: string } }
  | { name: 'lesson_started'; props: { lessonId: string; unitId: string; cefr: Cefr } }
  | { name: 'lesson_completed'; props: { lessonId: string; cefr: Cefr; accuracy: number; durationMs: number; xp: number } }
  | { name: 'lesson_abandoned'; props: { lessonId: string; atActivityIndex: number } }
  | { name: 'activity_completed'; props: { activityType: ActivityType; skill: Skill; cefr: Cefr; correct: boolean; hintsUsed: number; responseMs: number } }
  | { name: 'level_completed'; props: { languageCode: string; cefr: Cefr } }
  | { name: 'checkpoint_completed'; props: { languageCode: string; cefr: Cefr; score: number; verdict: string } }
  | { name: 'review_session_completed'; props: { itemCount: number; accuracy: number; durationMs: number } }
  | { name: 'ai_practice_started'; props: { kind: AiKind; cefr: Cefr; scenarioKey?: string } }
  | { name: 'ai_practice_completed'; props: { kind: AiKind; cefr: Cefr; turns: number; goalsAchieved: number; durationMs: number } }
  | { name: 'ai_limit_reached'; props: { kind: AiKind; plan: PlanCode } }
  | { name: 'teacher_search'; props: { filters: string[]; resultCount: number } }
  | { name: 'teacher_view'; props: { teacherId: string; source: 'search' | 'recommended' | 'deeplink' | 'message' } }
  | { name: 'booking_started'; props: { teacherId: string; priceCents: number; currency: Currency; isPackage: boolean } }
  | { name: 'booking_completed'; props: { teacherId: string; bookingId: string; priceCents: number; currency: Currency; isPackage: boolean } }
  | { name: 'booking_cancelled'; props: { bookingId: string; byRole: 'learner' | 'teacher' | 'admin'; hoursBefore: number } }
  | { name: 'lesson_attended'; props: { bookingId: string; minutes: number } }
  | { name: 'assignment_completed'; props: { assignmentId: string; kind: string } }
  | { name: 'paywall_viewed'; props: { source: string; plan?: PlanCode } }
  | { name: 'subscription_started'; props: { plan: PlanCode; interval: BillingInterval; platform: Platform; trial: boolean } }
  | { name: 'subscription_cancelled'; props: { plan: PlanCode; platform: Platform; daysActive: number } }
  | { name: 'review_submitted'; props: { rating: number } }
  | { name: 'referral_created'; props: { code: string } }
  | { name: 'referral_converted'; props: { code: string } }
  | { name: 'teacher_application_started'; props: Record<string, never> }
  | { name: 'teacher_application_submitted'; props: { languages: number; specialties: number } }
  | { name: 'notification_opened'; props: { kind: string } }
  | { name: 'share_created'; props: { kind: 'streak' | 'level' | 'words' | 'course' | 'milestone' } };

export type AnalyticsEventName = AnalyticsEvent['name'];

export type PropsOf<N extends AnalyticsEventName> = Extract<AnalyticsEvent, { name: N }>['props'];

/** Envelope written to `analytics.events`. */
export interface AnalyticsEnvelope {
  readonly name: AnalyticsEventName;
  readonly props: Record<string, unknown>;
  readonly ts: number;
  readonly sessionId: string;
  readonly appVersion: string;
  readonly platform: Platform;
}

/** Keys that must never appear in a payload; asserted in tests and at ingest. */
export const FORBIDDEN_PROP_KEYS: readonly string[] = [
  'email',
  'phone',
  'password',
  'name',
  'fullName',
  'address',
  'latitude',
  'longitude',
  'ip',
  'deviceId',
  'advertisingId',
  'text',
  'transcript',
  'message',
  'answer',
  'essay',
];

export function assertNoPii(props: Record<string, unknown>): void {
  for (const key of Object.keys(props)) {
    if (FORBIDDEN_PROP_KEYS.includes(key)) {
      throw new Error(`Analytics payload may not contain "${key}"`);
    }
  }
}
