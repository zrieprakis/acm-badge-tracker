/**
 * The dashboard's clock and "present today" shading are both pinned to the
 * school's own local time zone, not the viewer's browser - this dashboard
 * is about who is physically at the school, which shouldn't shift based on
 * where someone happens to be viewing it from. Hammond, IN is in Lake
 * County, part of the Chicago metro area, and observes Central Time
 * (confirmed with the user) despite most of Indiana being Eastern.
 */
export const SCHOOL_TIME_ZONE = 'America/Chicago';

const PRESENT_WINDOW_START_HOUR = 5; // 5am inclusive
const PRESENT_WINDOW_END_HOUR = 17; // 5pm exclusive

function getPartsInSchoolTimeZone(date: Date): { dateKey: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SCHOOL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';

  return {
    dateKey: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')),
  };
}

export function formatSchoolClock(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: SCHOOL_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

/** A swipe timestamp for display in a report row, e.g. "9:03 AM". */
export function formatSchoolTime(eventTimestamp: string): string {
  return formatSchoolClock(new Date(eventTimestamp));
}

/** A swipe timestamp with its date for the dashboard cards, e.g. "09:03am  09/08/26". */
export function formatSchoolTimeWithDate(eventTimestamp: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SCHOOL_TIME_ZONE,
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(new Date(eventTimestamp));

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';

  return `${get('hour')}:${get('minute')}${get('dayPeriod').toLowerCase()}  ${get('month')}/${get('day')}/${get('year')}`;
}

/** A report's YYYY-MM-DD bucket key for display, e.g. "Tue, Sep 8, 2026". */
export function formatSchoolDateKey(dateKey: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${dateKey}T00:00:00.000Z`));
}

/** Today's date (YYYY-MM-DD) in the school's time zone - for defaulting a report's date range. */
export function todaySchoolDateKey(now: Date = new Date()): string {
  return getPartsInSchoolTimeZone(now).dateKey;
}

/** Adds (or subtracts, if negative) whole days to a YYYY-MM-DD key. */
export function addDaysToDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * True if `eventTimestamp` falls on today's date (in the school's time
 * zone) and between 5am-5pm. A swipe from a prior day never counts, even
 * if its time-of-day would otherwise match - this is meant to answer
 * "is this person at work today", not "did they ever swipe in daylight".
 */
export function isWithinSchoolHoursToday(
  eventTimestamp: string | null,
  now: Date = new Date(),
): boolean {
  if (!eventTimestamp) return false;

  const event = getPartsInSchoolTimeZone(new Date(eventTimestamp));
  const today = getPartsInSchoolTimeZone(now);

  if (event.dateKey !== today.dateKey) return false;
  return event.hour >= PRESENT_WINDOW_START_HOUR && event.hour < PRESENT_WINDOW_END_HOUR;
}
