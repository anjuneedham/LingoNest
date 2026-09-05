import { hoursUntil } from './availability';

/** Booking states (brief §11). */
export const BOOKING_STATUSES = [
  'pending_payment',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled_by_learner',
  'cancelled_by_teacher',
  'no_show_learner',
  'no_show_teacher',
  'expired',
  'disputed',
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** Legal transitions. Anything else is rejected by the database and the API. */
const TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  pending_payment: ['confirmed', 'expired', 'cancelled_by_learner'],
  confirmed: ['in_progress', 'cancelled_by_learner', 'cancelled_by_teacher', 'no_show_learner', 'no_show_teacher'],
  in_progress: ['completed', 'no_show_learner', 'no_show_teacher', 'disputed'],
  completed: ['disputed'],
  cancelled_by_learner: [],
  cancelled_by_teacher: [],
  no_show_learner: ['disputed'],
  no_show_teacher: ['disputed'],
  expired: [],
  disputed: ['completed', 'cancelled_by_learner', 'cancelled_by_teacher'],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: BookingStatus, to: BookingStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal booking transition: ${from} → ${to}`);
  }
}

export interface JoinWindow {
  /** Minutes before the start when the room opens. */
  readonly openBeforeMinutes: number;
  /** Minutes after the scheduled end when the room closes. */
  readonly closeAfterMinutes: number;
}

export const DEFAULT_JOIN_WINDOW: JoinWindow = { openBeforeMinutes: 10, closeAfterMinutes: 15 };

export function canJoinRoom(
  booking: { startsAt: number; durationMinutes: number; status: BookingStatus },
  now = Date.now(),
  window: JoinWindow = DEFAULT_JOIN_WINDOW,
): boolean {
  if (booking.status !== 'confirmed' && booking.status !== 'in_progress') return false;
  const opensAt = booking.startsAt - window.openBeforeMinutes * 60_000;
  const closesAt = booking.startsAt + (booking.durationMinutes + window.closeAfterMinutes) * 60_000;
  return now >= opensAt && now <= closesAt;
}

/** Minutes after the start before an absence counts as a no-show. */
export const NO_SHOW_GRACE_MINUTES = 10;

export function noShowVerdict(
  booking: { startsAt: number; durationMinutes: number },
  attendance: { learnerJoinedAt: number | null; teacherJoinedAt: number | null },
  now = Date.now(),
): 'none' | 'learner' | 'teacher' | 'both' {
  const deadline = booking.startsAt + NO_SHOW_GRACE_MINUTES * 60_000;
  if (now < deadline) return 'none';
  const learnerMissing = attendance.learnerJoinedAt === null || attendance.learnerJoinedAt > deadline;
  const teacherMissing = attendance.teacherJoinedAt === null || attendance.teacherJoinedAt > deadline;
  if (learnerMissing && teacherMissing) return 'both';
  if (learnerMissing) return 'learner';
  if (teacherMissing) return 'teacher';
  return 'none';
}

/** Whether a learner may still cancel, and what they should be told first. */
export function cancellationContext(
  booking: { startsAt: number; status: BookingStatus },
  now = Date.now(),
): { allowed: boolean; hoursBefore: number; reasonKey?: string } {
  const hours = hoursUntil(booking.startsAt, now);
  if (booking.status !== 'confirmed' && booking.status !== 'pending_payment') {
    return { allowed: false, hoursBefore: hours, reasonKey: 'booking.cancel.notCancellable' };
  }
  if (hours < 0) {
    return { allowed: false, hoursBefore: hours, reasonKey: 'booking.cancel.alreadyStarted' };
  }
  return { allowed: true, hoursBefore: hours };
}

/** How long an unpaid booking may hold a teacher's slot. */
export const PAYMENT_HOLD_MINUTES = 15;

export function isReservationExpired(
  booking: { status: BookingStatus; createdAt: number },
  now = Date.now(),
): boolean {
  return booking.status === 'pending_payment' && now - booking.createdAt > PAYMENT_HOLD_MINUTES * 60_000;
}
