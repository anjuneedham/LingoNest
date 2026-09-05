import { describe, expect, it } from 'vitest';
import {
  formatInZone,
  isoDateInZone,
  timeInZone,
  timeZoneOffsetMs,
  utcToZonedParts,
  zonedTimeToUtc,
} from '../src/booking/timezone';
import {
  expandAvailability,
  groupSlotsByViewerDay,
  hoursUntil,
  slotIsAvailable,
  type AvailabilityRule,
} from '../src/booking/availability';
import {
  canJoinRoom,
  canTransition,
  assertTransition,
  cancellationContext,
  isReservationExpired,
  noShowVerdict,
} from '../src/booking/lifecycle';

const HOUR = 3_600_000;

describe('timezone handling', () => {
  it('converts wall-clock time in a zone to an instant', () => {
    // 18:00 in Madrid on 15 January is 17:00 UTC (CET, UTC+1).
    expect(zonedTimeToUtc('Europe/Madrid', 2026, 1, 15, 18, 0)).toBe(Date.UTC(2026, 0, 15, 17, 0));
  });

  it('respects daylight saving on both sides of a transition', () => {
    // Madrid moves to CEST (UTC+2) on the last Sunday of March 2026 (29 March).
    const winter = zonedTimeToUtc('Europe/Madrid', 2026, 3, 20, 18, 0);
    const summer = zonedTimeToUtc('Europe/Madrid', 2026, 4, 10, 18, 0);
    expect(timeInZone(winter, 'Europe/Madrid')).toBe('18:00');
    expect(timeInZone(summer, 'Europe/Madrid')).toBe('18:00');
    // The same wall-clock hour is a different UTC instant across the transition.
    expect(timeZoneOffsetMs(winter, 'Europe/Madrid')).toBe(HOUR);
    expect(timeZoneOffsetMs(summer, 'Europe/Madrid')).toBe(2 * HOUR);
  });

  it('renders the same instant correctly for both participants', () => {
    const instant = zonedTimeToUtc('Europe/Madrid', 2026, 6, 10, 18, 0); // 16:00 UTC
    expect(timeInZone(instant, 'Europe/Madrid')).toBe('18:00');
    expect(timeInZone(instant, 'America/Chicago')).toBe('11:00');
    expect(timeInZone(instant, 'Asia/Tokyo')).toBe('01:00');
    expect(isoDateInZone(instant, 'Asia/Tokyo')).toBe('2026-06-11');
  });

  it('reads wall-clock parts including the weekday', () => {
    const parts = utcToZonedParts(Date.UTC(2026, 0, 15, 12, 0), 'UTC');
    expect(parts).toMatchObject({ year: 2026, month: 1, day: 15, hour: 12, weekday: 4 }); // Thursday
  });

  it('formats for a viewer without leaking the server timezone', () => {
    const instant = Date.UTC(2026, 2, 17, 18, 0);
    expect(formatInZone(instant, 'America/New_York', 'en-US')).toContain('2:00');
  });
});

describe('availability expansion', () => {
  // Tuesdays, 18:00-21:00 Madrid time.
  const rules: AvailabilityRule[] = [
    { weekday: 2, startTime: '18:00', endTime: '21:00', timezone: 'Europe/Madrid' },
  ];
  const teacherTimezone = 'Europe/Madrid';
  const now = Date.UTC(2026, 5, 8, 8, 0); // Monday 8 June 2026
  const options = {
    slotMinutes: 60,
    bufferMinutes: 0,
    leadTimeMinutes: 120,
    from: now,
    to: now + 7 * 24 * HOUR,
    now,
  };

  it('produces one slot per hour inside the window', () => {
    const slots = expandAvailability({ rules, teacherTimezone, options });
    expect(slots).toHaveLength(3);
    expect(slots.map((s) => timeInZone(s.startsAt, teacherTimezone))).toEqual(['18:00', '19:00', '20:00']);
  });

  it('keeps the teacher’s wall-clock hours across a DST change', () => {
    const octoberNow = Date.UTC(2026, 9, 20, 8, 0); // Tuesday 20 October 2026
    const slots = expandAvailability({
      rules,
      teacherTimezone,
      options: { ...options, from: octoberNow, to: octoberNow + 21 * 24 * HOUR, now: octoberNow },
    });
    // Madrid leaves summer time on 25 October; every Tuesday slot still starts at 18:00 locally.
    for (const slot of slots) {
      expect(timeInZone(slot.startsAt, teacherTimezone)).toMatch(/^(18|19|20):00$/);
    }
    expect(slots.length).toBeGreaterThanOrEqual(6);
  });

  it('respects the lead time', () => {
    const soon = zonedTimeToUtc('Europe/Madrid', 2026, 6, 9, 17, 30); // 30 min before a Tuesday window
    const slots = expandAvailability({
      rules,
      teacherTimezone,
      options: { ...options, from: soon, to: soon + 24 * HOUR, now: soon },
    });
    expect(slots.map((s) => timeInZone(s.startsAt, teacherTimezone))).toEqual(['20:00']);
  });

  it('subtracts existing bookings plus their buffer', () => {
    const tuesday18 = zonedTimeToUtc('Europe/Madrid', 2026, 6, 9, 18, 0);
    const slots = expandAvailability({
      rules,
      teacherTimezone,
      busy: [{ startsAt: tuesday18, endsAt: tuesday18 + HOUR }],
      options: { ...options, bufferMinutes: 15 },
    });
    const labels = slots.map((s) => timeInZone(s.startsAt, teacherTimezone));
    expect(labels).not.toContain('18:00');
    expect(labels).not.toContain('19:00'); // blocked by the 15-minute buffer
    expect(labels).toContain('20:00');
  });

  it('honours a whole-day block', () => {
    const slots = expandAvailability({
      rules,
      teacherTimezone,
      exceptions: [{ date: '2026-06-09', kind: 'block' }],
      options,
    });
    expect(slots).toHaveLength(0);
  });

  it('honours a partial block', () => {
    const slots = expandAvailability({
      rules,
      teacherTimezone,
      exceptions: [{ date: '2026-06-09', kind: 'block', startTime: '18:00', endTime: '19:00' }],
      options,
    });
    expect(slots.map((s) => timeInZone(s.startsAt, teacherTimezone))).toEqual(['19:00', '20:00']);
  });

  it('adds one-off extra availability', () => {
    const slots = expandAvailability({
      rules,
      teacherTimezone,
      exceptions: [{ date: '2026-06-10', kind: 'extra', startTime: '09:00', endTime: '11:00' }],
      options,
    });
    expect(slots.map((s) => isoDateInZone(s.startsAt, teacherTimezone))).toContain('2026-06-10');
  });

  it('offers an extra window even on a fully blocked day', () => {
    const slots = expandAvailability({
      rules,
      teacherTimezone,
      exceptions: [
        { date: '2026-06-09', kind: 'block' },
        { date: '2026-06-09', kind: 'extra', startTime: '09:00', endTime: '10:00' },
      ],
      options,
    });
    expect(slots.map((s) => timeInZone(s.startsAt, teacherTimezone))).toEqual(['09:00']);
  });

  it('respects rule validity dates', () => {
    const expired: AvailabilityRule[] = [{ ...rules[0]!, validTo: '2026-06-01' }];
    expect(expandAvailability({ rules: expired, teacherTimezone, options })).toHaveLength(0);
  });

  it('caps the teacher’s bookings per day', () => {
    const tuesday18 = zonedTimeToUtc('Europe/Madrid', 2026, 6, 9, 18, 0);
    const slots = expandAvailability({
      rules,
      teacherTimezone,
      busy: [{ startsAt: tuesday18 - 6 * HOUR, endsAt: tuesday18 - 5 * HOUR }],
      options: { ...options, maxPerDay: 1 },
    });
    expect(slots).toHaveLength(0);
  });

  it('handles a window that runs past midnight', () => {
    const lateRules: AvailabilityRule[] = [
      { weekday: 2, startTime: '22:00', endTime: '01:00', timezone: 'Europe/Madrid' },
    ];
    const slots = expandAvailability({ rules: lateRules, teacherTimezone, options });
    expect(slots.map((s) => timeInZone(s.startsAt, teacherTimezone))).toEqual(['22:00', '23:00', '00:00']);
  });

  it('validates a requested slot server-side', () => {
    const valid = zonedTimeToUtc('Europe/Madrid', 2026, 6, 9, 19, 0);
    const invalid = zonedTimeToUtc('Europe/Madrid', 2026, 6, 9, 22, 0);
    expect(slotIsAvailable(valid, { rules, teacherTimezone, options })).toBe(true);
    expect(slotIsAvailable(invalid, { rules, teacherTimezone, options })).toBe(false);
  });

  it('groups slots by the viewer’s calendar day, not the teacher’s', () => {
    const slots = expandAvailability({ rules, teacherTimezone, options });
    const byTokyo = groupSlotsByViewerDay(slots, 'Asia/Tokyo');
    // 18:00-21:00 Madrid on Tuesday is early Wednesday in Tokyo.
    expect(byTokyo[0]?.date).toBe('2026-06-10');
  });
});

describe('booking lifecycle', () => {
  it('permits only legal transitions', () => {
    expect(canTransition('pending_payment', 'confirmed')).toBe(true);
    expect(canTransition('completed', 'confirmed')).toBe(false);
    expect(() => assertTransition('cancelled_by_learner', 'confirmed')).toThrow();
  });

  it('opens the room shortly before the lesson and closes it after', () => {
    const startsAt = Date.UTC(2026, 5, 9, 18, 0);
    const booking = { startsAt, durationMinutes: 60, status: 'confirmed' as const };
    expect(canJoinRoom(booking, startsAt - 30 * 60_000)).toBe(false);
    expect(canJoinRoom(booking, startsAt - 5 * 60_000)).toBe(true);
    expect(canJoinRoom(booking, startsAt + 70 * 60_000)).toBe(true);
    expect(canJoinRoom(booking, startsAt + 90 * 60_000)).toBe(false);
  });

  it('will not open the room for a cancelled booking', () => {
    const startsAt = Date.UTC(2026, 5, 9, 18, 0);
    expect(canJoinRoom({ startsAt, durationMinutes: 60, status: 'cancelled_by_teacher' }, startsAt)).toBe(false);
  });

  it('decides no-shows from join evidence after a grace period', () => {
    const startsAt = Date.UTC(2026, 5, 9, 18, 0);
    const booking = { startsAt, durationMinutes: 60 };
    expect(noShowVerdict(booking, { learnerJoinedAt: null, teacherJoinedAt: null }, startsAt + 60_000)).toBe('none');
    expect(noShowVerdict(booking, { learnerJoinedAt: startsAt, teacherJoinedAt: null }, startsAt + 15 * 60_000)).toBe('teacher');
    expect(noShowVerdict(booking, { learnerJoinedAt: null, teacherJoinedAt: startsAt }, startsAt + 15 * 60_000)).toBe('learner');
    expect(noShowVerdict(booking, { learnerJoinedAt: null, teacherJoinedAt: null }, startsAt + 15 * 60_000)).toBe('both');
  });

  it('blocks cancellation after the lesson has started', () => {
    const startsAt = Date.UTC(2026, 5, 9, 18, 0);
    const context = cancellationContext({ startsAt, status: 'confirmed' }, startsAt + 60_000);
    expect(context.allowed).toBe(false);
    expect(context.reasonKey).toBe('booking.cancel.alreadyStarted');
  });

  it('reports hours remaining for the refund preview', () => {
    const startsAt = Date.UTC(2026, 5, 9, 18, 0);
    const context = cancellationContext({ startsAt, status: 'confirmed' }, startsAt - 30 * HOUR);
    expect(context.allowed).toBe(true);
    expect(Math.round(context.hoursBefore)).toBe(30);
    expect(Math.round(hoursUntil(startsAt, startsAt - 2 * HOUR))).toBe(2);
  });

  it('releases an unpaid reservation so it cannot squat a teacher’s slot', () => {
    const createdAt = Date.UTC(2026, 5, 9, 12, 0);
    expect(isReservationExpired({ status: 'pending_payment', createdAt }, createdAt + 5 * 60_000)).toBe(false);
    expect(isReservationExpired({ status: 'pending_payment', createdAt }, createdAt + 20 * 60_000)).toBe(true);
    expect(isReservationExpired({ status: 'confirmed', createdAt }, createdAt + 20 * 60_000)).toBe(false);
  });
});
