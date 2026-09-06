/**
 * Server-side availability expansion.
 *
 * The client renders a calendar from the same rules, but that view is only a
 * hint: this is the authority that decides whether a slot may be booked, and it
 * runs again inside `booking-create` before any money moves.
 *
 * Mirrors @lingonest/core/booking/availability, including the DST handling.
 */

export interface AvailabilityRule {
  readonly weekday: number;
  readonly start_time: string;
  readonly end_time: string;
  readonly timezone: string;
  readonly valid_from: string | null;
  readonly valid_to: string | null;
}

export interface AvailabilityException {
  readonly date: string;
  readonly kind: 'block' | 'extra';
  readonly start_time: string | null;
  readonly end_time: string | null;
}

export interface BusyInterval {
  readonly startsAt: number;
  readonly endsAt: number;
}

const MINUTE_MS = 60_000;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

function partsIn(epochMs: number, timeZone: string) {
  const parts = formatterFor(timeZone).formatToParts(new Date(epochMs));
  const lookup: Record<string, string> = {};
  for (const part of parts) if (part.type !== 'literal') lookup[part.type] = part.value;
  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    hour: Number(lookup.hour) % 24,
    minute: Number(lookup.minute),
    second: Number(lookup.second),
  };
}

function offsetMs(epochMs: number, timeZone: string): number {
  const p = partsIn(epochMs, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(epochMs / 1000) * 1000;
}

/** Wall-clock time in a zone to an instant, correct across DST transitions. */
export function zonedTimeToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): number {
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0);
  const first = offsetMs(naive, timeZone);
  let candidate = naive - first;
  const second = offsetMs(candidate, timeZone);
  if (second !== first) candidate = naive - second;
  return candidate;
}

export function isoDateInZone(epochMs: number, timeZone: string): string {
  const p = partsIn(epochMs, timeZone);
  return `${String(p.year).padStart(4, '0')}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

function addDaysIso(iso: string, days: number): string {
  const date = new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)) + days));
  return date.toISOString().slice(0, 10);
}

function weekdayOf(iso: string): number {
  return new Date(
    Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))),
  ).getUTCDay();
}

function minutesOfDay(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

function windowFor(timeZone: string, isoDate: string, startTime: string, endTime: string) {
  const start = zonedTimeToUtc(
    timeZone,
    Number(isoDate.slice(0, 4)),
    Number(isoDate.slice(5, 7)),
    Number(isoDate.slice(8, 10)),
    Number(startTime.slice(0, 2)),
    Number(startTime.slice(3, 5)),
  );
  const crossesMidnight = minutesOfDay(endTime) <= minutesOfDay(startTime);
  const endIso = crossesMidnight ? addDaysIso(isoDate, 1) : isoDate;
  const end = zonedTimeToUtc(
    timeZone,
    Number(endIso.slice(0, 4)),
    Number(endIso.slice(5, 7)),
    Number(endIso.slice(8, 10)),
    Number(endTime.slice(0, 2)),
    Number(endTime.slice(3, 5)),
  );
  return { startsAt: start, endsAt: end };
}

export interface SlotOptions {
  readonly slotMinutes: number;
  readonly bufferMinutes: number;
  readonly leadTimeMinutes: number;
  readonly maxPerDay?: number | null;
  readonly from: number;
  readonly to: number;
  readonly now?: number;
}

export interface Slot {
  readonly startsAt: number;
  readonly endsAt: number;
}

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

  const startDate = addDaysIso(isoDateInZone(options.from, teacherTimezone), -1);
  const endDate = addDaysIso(isoDateInZone(options.to, teacherTimezone), 1);

  const windows: Slot[] = [];
  for (let date = startDate; date <= endDate; date = addDaysIso(date, 1)) {
    const weekday = weekdayOf(date);
    const dayExceptions = exceptions.filter((e) => e.date === date);
    const wholeDayBlock = dayExceptions.some((e) => e.kind === 'block' && !e.start_time);

    if (!wholeDayBlock) {
      for (const rule of rules) {
        if (rule.weekday !== weekday) continue;
        if (rule.valid_from && date < rule.valid_from) continue;
        if (rule.valid_to && date > rule.valid_to) continue;
        windows.push(windowFor(rule.timezone || teacherTimezone, date, rule.start_time, rule.end_time));
      }
    }
    for (const extra of dayExceptions.filter((e) => e.kind === 'extra' && e.start_time && e.end_time)) {
      windows.push(windowFor(teacherTimezone, date, extra.start_time!, extra.end_time!));
    }
  }

  const partialBlocks = exceptions
    .filter((e) => e.kind === 'block' && e.start_time && e.end_time)
    .map((e) => windowFor(teacherTimezone, e.date, e.start_time!, e.end_time!));

  const slotMs = options.slotMinutes * MINUTE_MS;
  const bufferMs = options.bufferMinutes * MINUTE_MS;

  const perDay = new Map<string, number>();
  for (const b of busy) {
    const day = isoDateInZone(b.startsAt, teacherTimezone);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }

  const overlaps = (a: Slot, b: { startsAt: number; endsAt: number }) =>
    a.startsAt < b.endsAt && b.startsAt < a.endsAt;

  const seen = new Set<number>();
  const slots: Slot[] = [];

  for (const window of windows.sort((a, b) => a.startsAt - b.startsAt)) {
    for (let start = window.startsAt; start + slotMs <= window.endsAt; start += slotMs) {
      const slot: Slot = { startsAt: start, endsAt: start + slotMs };
      if (slot.startsAt < earliest || slot.endsAt > options.to) continue;
      if (seen.has(slot.startsAt)) continue;
      if (partialBlocks.some((block) => overlaps(slot, block))) continue;
      if (busy.some((b) => overlaps({ startsAt: slot.startsAt - bufferMs, endsAt: slot.endsAt + bufferMs }, b))) continue;
      if (options.maxPerDay != null) {
        const day = isoDateInZone(slot.startsAt, teacherTimezone);
        if ((perDay.get(day) ?? 0) >= options.maxPerDay) continue;
      }
      seen.add(slot.startsAt);
      slots.push(slot);
    }
  }

  return slots.sort((a, b) => a.startsAt - b.startsAt);
}
