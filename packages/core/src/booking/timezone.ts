/**
 * Timezone helpers built on the Intl database.
 *
 * Availability is authored in the teacher's wall-clock time and rendered in the
 * learner's. Fixed offsets are never used: a teacher who works 18:00–21:00 in
 * Madrid must still work 18:00–21:00 after the clocks change, and a learner in
 * Chicago must see that shift correctly.
 */

export interface ZonedParts {
  readonly year: number;
  readonly month: number; // 1-12
  readonly day: number; // 1-31
  readonly hour: number; // 0-23
  readonly minute: number;
  readonly second: number;
  /** 0 = Sunday … 6 = Saturday, matching `Date#getDay`. */
  readonly weekday: number;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
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
      weekday: 'short',
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Break an instant into wall-clock parts in the given zone. */
export function utcToZonedParts(epochMs: number, timeZone: string): ZonedParts {
  const parts = formatterFor(timeZone).formatToParts(new Date(epochMs));
  const lookup: Record<string, string> = {};
  for (const part of parts) if (part.type !== 'literal') lookup[part.type] = part.value;
  return {
    year: Number(lookup['year']),
    month: Number(lookup['month']),
    day: Number(lookup['day']),
    hour: Number(lookup['hour']) % 24,
    minute: Number(lookup['minute']),
    second: Number(lookup['second']),
    weekday: WEEKDAY_INDEX[lookup['weekday'] ?? 'Sun'] ?? 0,
  };
}

/** The zone's UTC offset in ms at a given instant (positive east of Greenwich). */
export function timeZoneOffsetMs(epochMs: number, timeZone: string): number {
  const p = utcToZonedParts(epochMs, timeZone);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asIfUtc - Math.floor(epochMs / 1000) * 1000;
}

/**
 * Convert a wall-clock time in a zone to an instant.
 *
 * Two passes handle the DST boundary: the first guess uses the offset at the
 * naive instant, the second corrects it if the guess landed on the other side
 * of a transition. Times that do not exist (the spring-forward gap) resolve to
 * the instant the clock jumps to, which is what a scheduler should do.
 */
export function zonedTimeToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): number {
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0);
  const firstOffset = timeZoneOffsetMs(naive, timeZone);
  let candidate = naive - firstOffset;
  const secondOffset = timeZoneOffsetMs(candidate, timeZone);
  if (secondOffset !== firstOffset) candidate = naive - secondOffset;
  return candidate;
}

/** `YYYY-MM-DD` for an instant, in the given zone. */
export function isoDateInZone(epochMs: number, timeZone: string): string {
  const p = utcToZonedParts(epochMs, timeZone);
  return `${p.year.toString().padStart(4, '0')}-${p.month.toString().padStart(2, '0')}-${p.day
    .toString()
    .padStart(2, '0')}`;
}

/** `HH:mm` for an instant, in the given zone. */
export function timeInZone(epochMs: number, timeZone: string): string {
  const p = utcToZonedParts(epochMs, timeZone);
  return `${p.hour.toString().padStart(2, '0')}:${p.minute.toString().padStart(2, '0')}`;
}

export function parseIsoDate(iso: string): { year: number; month: number; day: number } {
  return { year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)), day: Number(iso.slice(8, 10)) };
}

export function parseTime(time: string): { hour: number; minute: number } {
  return { hour: Number(time.slice(0, 2)), minute: Number(time.slice(3, 5)) };
}

export function minutesOfDay(time: string): number {
  const { hour, minute } = parseTime(time);
  return hour * 60 + minute;
}

/** Add whole days to an ISO date, staying in the calendar (not adding 24h). */
export function addDaysIso(iso: string, days: number): string {
  const { year, month, day } = parseIsoDate(iso);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

/** Format an instant for a viewer, e.g. "Tue 18 Mar, 6:00 PM". */
export function formatInZone(
  epochMs: number,
  timeZone: string,
  locale = 'en-US',
  options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  },
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(new Date(epochMs));
}

/** Short zone label for the "both timezones" confirmation line, e.g. "GMT+1". */
export function zoneLabel(epochMs: number, timeZone: string, locale = 'en-US'): string {
  const parts = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: 'shortOffset' }).formatToParts(
    new Date(epochMs),
  );
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? timeZone;
}
