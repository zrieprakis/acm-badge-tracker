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
