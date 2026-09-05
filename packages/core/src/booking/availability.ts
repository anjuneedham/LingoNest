import {
  addDaysIso,
  isoDateInZone,
  minutesOfDay,
  parseIsoDate,
  zonedTimeToUtc,
} from './timezone';

/**
 * Availability expansion (brief §11 of the booking architecture).
 *
 * The same function runs on the client, to draw a calendar quickly, and inside
 * `booking-create`, where it is the authority. A slot the client offers is only
 * a hint; the server re-derives it before taking money.
 */

export interface AvailabilityRule {
  /** 0 = Sunday … 6 = Saturday, in the teacher's own timezone. */
  readonly weekday: number;
  /** `HH:mm` wall-clock in the teacher's timezone. */
  readonly startTime: string;
  readonly endTime: string;
  /** IANA zone the times are expressed in. */
  readonly timezone: string;
  /** ISO date the rule takes effect, inclusive. */
  readonly validFrom?: string;
  /** ISO date the rule stops applying, inclusive. */
  readonly validTo?: string;
}

export interface AvailabilityException {
  /** ISO date in the teacher's timezone. */
  readonly date: string;
  readonly kind: 'block' | 'extra';
  /** Omitted for a whole-day block. */
  readonly startTime?: string;
  readonly endTime?: string;
}

export interface BusyInterval {
  readonly startsAt: number;
  readonly endsAt: number;
}

export interface SlotOptions {
  readonly slotMinutes: number;
  /** Gap enforced between consecutive lessons. */
  readonly bufferMinutes: number;
  /** Earliest a lesson may be booked, relative to now. */
  readonly leadTimeMinutes: number;
  /** Maximum confirmed lessons per calendar day in the teacher's zone. */
  readonly maxPerDay?: number;
  /** Window start (epoch ms). */
  readonly from: number;
  /** Window end (epoch ms). */
  readonly to: number;
  readonly now?: number;
}

export interface Slot {
  readonly startsAt: number;
  readonly endsAt: number;
}

const MINUTE_MS = 60_000;

function ruleAppliesOn(rule: AvailabilityRule, isoDate: string): boolean {
  if (rule.validFrom && isoDate < rule.validFrom) return false;
  if (rule.validTo && isoDate > rule.validTo) return false;
  return true;
}

function weekdayOf(isoDate: string): number {
  const { year, month, day } = parseIsoDate(isoDate);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function overlaps(a: { startsAt: number; endsAt: number }, b: { startsAt: number; endsAt: number }): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

/**
 * Expand weekly rules and exceptions into concrete bookable slots.
 *
 * Order of operations matters: build candidate windows from the rules, add the
 * `extra` exceptions, subtract the `block` exceptions, cut into slots, then drop
 * anything that collides with an existing booking (including its buffer), falls
 * inside the lead time, or exceeds the teacher's daily cap.
 */
export function expandAvailability(input: {
  rules: readonly AvailabilityRule[];
  exceptions?: readonly AvailabilityException[];
  busy?: readonly BusyInterval[];
  teacherTimezone: string;
  options: SlotOptions;
}): Slot[] {
  const { rules, teacherTimezone, options } = input;
  const exceptions = input.exceptions ?? [];
  const busy = input.busy ?? [];
  const now = options.now ?? Date.now();
  const earliest = Math.max(options.from, now + options.leadTimeMinutes * MINUTE_MS);
  if (earliest >= options.to) return [];

  // Walk calendar days in the teacher's zone, with a day of padding either side
  // so a window that straddles midnight in the viewer's zone is still found.
  const startDate = addDaysIso(isoDateInZone(options.from, teacherTimezone), -1);
  const endDate = addDaysIso(isoDateInZone(options.to, teacherTimezone), 1);

  const windows: Slot[] = [];
  for (let date = startDate; date <= endDate; date = addDaysIso(date, 1)) {
    const weekday = weekdayOf(date);
    const dayExceptions = exceptions.filter((e) => e.date === date);
    const wholeDayBlock = dayExceptions.some((e) => e.kind === 'block' && !e.startTime);
    if (wholeDayBlock) {
      // `extra` windows on a fully blocked day still count — a teacher may block
      // their normal hours and offer a one-off replacement slot.
      for (const extra of dayExceptions.filter((e) => e.kind === 'extra' && e.startTime && e.endTime)) {
        windows.push(windowFor(teacherTimezone, date, extra.startTime!, extra.endTime!));
      }
      continue;
    }

    for (const rule of rules) {
      if (rule.weekday !== weekday || !ruleAppliesOn(rule, date)) continue;
      windows.push(windowFor(rule.timezone || teacherTimezone, date, rule.startTime, rule.endTime));
    }
    for (const extra of dayExceptions.filter((e) => e.kind === 'extra' && e.startTime && e.endTime)) {
      windows.push(windowFor(teacherTimezone, date, extra.startTime!, extra.endTime!));
    }
  }

  const partialBlocks = exceptions
    .filter((e) => e.kind === 'block' && e.startTime && e.endTime)
    .map((e) => windowFor(teacherTimezone, e.date, e.startTime!, e.endTime!));

  const slotMs = options.slotMinutes * MINUTE_MS;
  const bufferMs = options.bufferMinutes * MINUTE_MS;
  const perDayCount = new Map<string, number>();
  for (const b of busy) {
    const day = isoDateInZone(b.startsAt, teacherTimezone);
    perDayCount.set(day, (perDayCount.get(day) ?? 0) + 1);
  }

  const slots: Slot[] = [];
  const seen = new Set<number>();

  for (const window of windows.sort((a, b) => a.startsAt - b.startsAt)) {
    for (let start = window.startsAt; start + slotMs <= window.endsAt; start += slotMs) {
      const slot: Slot = { startsAt: start, endsAt: start + slotMs };
      if (slot.startsAt < earliest || slot.endsAt > options.to) continue;
      if (seen.has(slot.startsAt)) continue;
      if (partialBlocks.some((block) => overlaps(slot, block))) continue;
      if (
        busy.some((b) =>
          overlaps({ startsAt: slot.startsAt - bufferMs, endsAt: slot.endsAt + bufferMs }, b),
        )
      ) {
        continue;
      }
      if (options.maxPerDay !== undefined) {
        const day = isoDateInZone(slot.startsAt, teacherTimezone);
        if ((perDayCount.get(day) ?? 0) >= options.maxPerDay) continue;
      }
      seen.add(slot.startsAt);
      slots.push(slot);
    }
  }

  return slots.sort((a, b) => a.startsAt - b.startsAt);
}

function windowFor(timeZone: string, isoDate: string, startTime: string, endTime: string): Slot {
  const { year, month, day } = parseIsoDate(isoDate);
  const start = zonedTimeToUtc(timeZone, year, month, day, ...timeParts(startTime));
  const endMinutes = minutesOfDay(endTime);
  // An end time of 00:00 (or earlier than the start) means the window runs past
  // midnight into the next day.
  const crossesMidnight = endMinutes <= minutesOfDay(startTime);
  const endDateIso = crossesMidnight ? addDaysIso(isoDate, 1) : isoDate;
  const endParts = parseIsoDate(endDateIso);
  const end = zonedTimeToUtc(timeZone, endParts.year, endParts.month, endParts.day, ...timeParts(endTime));
  return { startsAt: start, endsAt: end };
}

function timeParts(time: string): [number, number] {
  return [Number(time.slice(0, 2)), Number(time.slice(3, 5))];
}

/** Whether a specific requested slot is genuinely bookable. Used server-side. */
export function slotIsAvailable(
  requestedStart: number,
  input: Parameters<typeof expandAvailability>[0],
): boolean {
  const slots = expandAvailability({
    ...input,
    options: {
      ...input.options,
      from: Math.min(input.options.from, requestedStart - 1),
      to: Math.max(input.options.to, requestedStart + input.options.slotMinutes * MINUTE_MS + 1),
    },
  });
  return slots.some((s) => s.startsAt === requestedStart);
}

/** Group slots by calendar day in the *viewer's* zone, for the booking calendar. */
export function groupSlotsByViewerDay(
  slots: readonly Slot[],
  viewerTimezone: string,
): { date: string; slots: Slot[] }[] {
  const byDay = new Map<string, Slot[]>();
  for (const slot of slots) {
    const day = isoDateInZone(slot.startsAt, viewerTimezone);
    const list = byDay.get(day) ?? [];
    list.push(slot);
    byDay.set(day, list);
  }
  return [...byDay.entries()]
    .map(([date, list]) => ({ date, slots: list.sort((a, b) => a.startsAt - b.startsAt) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Hours until a lesson starts; negative once it has begun. */
export function hoursUntil(startsAt: number, now = Date.now()): number {
  return (startsAt - now) / 3_600_000;
}
