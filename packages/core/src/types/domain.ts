import type { Cefr } from '../cefr/levels';
import type { Skill } from '../skills/skills';
import type { Currency } from '../pricing/currency';
import type { PlanCode, SubscriptionStatus } from '../pricing/plans';
import type { BookingStatus } from '../booking/lifecycle';
import type { SrsState } from '../srs/scheduler';

export type UserRole = 'learner' | 'teacher' | 'admin' | 'moderator' | 'content_editor';

export type AccountType = 'adult' | 'teen' | 'child';

export interface Profile {
  readonly id: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly country: string | null;
  readonly timezone: string;
  readonly uiLocale: string;
  readonly accountType: AccountType;
  readonly isMinor: boolean;
  readonly guardianEmail: string | null;
  readonly roles: readonly UserRole[];
  readonly onboardingCompletedAt: string | null;
  readonly analyticsConsent: boolean;
}

export type LearningGoal = 'travel' | 'work' | 'family' | 'exam' | 'culture' | 'school' | 'moving' | 'curiosity';

export interface UserLanguage {
  readonly languageCode: string;
  readonly variantCode: string;
  readonly isActive: boolean;
  readonly goal: LearningGoal;
  readonly dailyGoalMinutes: number;
  /** 0, 25, 50, 75 or 100 — how much of the interface is in the target language. */
  readonly immersionPercent: number;
  readonly startedAt: string;
}

export interface SkillProfileRecord {
  readonly languageCode: string;
  readonly overall: Cefr | null;
  readonly bySkill: Partial<Record<Skill, Cefr | null>>;
  readonly confidence: number;
  readonly updatedAt: string;
}

export interface UserVocabularyRecord {
  readonly vocabularyId: string;
  readonly state: SrsState;
  readonly ease: number;
  readonly intervalDays: number;
  readonly repetitions: number;
  readonly lapses: number;
  readonly dueAt: string;
  readonly lastReviewedAt: string | null;
}

export type TeacherStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'suspended';

export interface TeacherProfile {
  readonly userId: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly headline: string;
  readonly bio: string;
  readonly country: string;
  readonly timezone: string;
  readonly introVideoUrl: string | null;
  readonly teachingLanguages: readonly { languageCode: string; variantCode?: string; isNative: boolean }[];
  readonly speaksLanguages: readonly { languageCode: string; cefr: Cefr | 'native' }[];
  readonly specialties: readonly string[];
  readonly hourlyRateMinor: number;
  readonly trialRateMinor: number | null;
  readonly currency: Currency;
  readonly status: TeacherStatus;
  readonly ratingAvg: number;
  readonly ratingCount: number;
  readonly lessonsTaught: number;
  readonly responseRate: number;
  readonly reliability: number;
  readonly payoutEnabled: boolean;
  readonly createdAt: string;
}

export interface Booking {
  readonly id: string;
  readonly learnerId: string;
  readonly teacherId: string;
  readonly languageCode: string;
  /** ISO 8601 UTC. */
  readonly startsAt: string;
  readonly durationMinutes: number;
  readonly status: BookingStatus;
  readonly priceMinor: number;
  readonly currency: Currency;
  readonly commissionBps: number;
  readonly teacherEarningsMinor: number;
  readonly packagePurchaseId: string | null;
  readonly videoRoomId: string | null;
  readonly learnerNotes: string | null;
  readonly focusAreas: readonly string[];
}

export interface Subscription {
  readonly planCode: PlanCode;
  readonly status: SubscriptionStatus;
  readonly currentPeriodEnd: string | null;
  readonly cancelAtPeriodEnd: boolean;
  readonly platform: 'ios' | 'android' | 'web';
}

export type AssignmentKind = 'lesson' | 'review' | 'vocabulary' | 'speaking' | 'writing' | 'conversation';

export interface TeacherAssignment {
  readonly id: string;
  readonly teacherId: string;
  readonly teacherName: string;
  readonly learnerId: string;
  readonly kind: AssignmentKind;
  readonly targetRef: string | null;
  readonly title: string;
  readonly instructions: string | null;
  readonly dueAt: string | null;
  readonly status: 'assigned' | 'in_progress' | 'completed' | 'skipped';
}

export interface NotificationPreferences {
  readonly reviewReminders: boolean;
  readonly streakReminders: boolean;
  readonly lessonReminders: boolean;
  readonly bookingReminders: boolean;
  readonly messages: boolean;
  readonly marketing: boolean;
  /** `HH:mm` in the user's timezone; no notifications are sent inside this window. */
  readonly quietHoursStart: string | null;
  readonly quietHoursEnd: string | null;
}

/** Learning modes offered on the Practice screen (brief §80). */
export const LEARNING_MODES = [
  'guided',
  'quick_practice',
  'immersion',
  'conversation',
  'review',
  'exam',
  'tutor',
] as const;

export type LearningMode = (typeof LEARNING_MODES)[number];
