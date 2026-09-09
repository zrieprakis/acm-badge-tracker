/**
 * Server-side counterpart to frontend/src/utils/schoolTime.ts's day-bucketing
 * technique - reports need to group swipes by the school's own local
 * calendar day (America/Chicago), not UTC or the server host's time zone.
 */
export const SCHOOL_TIME_ZONE = 'America/Chicago';

/** The school-local calendar date (YYYY-MM-DD) that a UTC timestamp falls on. */
export function getSchoolDateKey(isoTimestamp: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SCHOOL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(isoTimestamp));

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
