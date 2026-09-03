/**
 * Avigilon ACM timestamps observed live are 14 digits (YYYYMMDDHHMMSS)
 * followed by either "Z" (LDAP generalized time, UTC - seen on identity
 * createTimestamp/modifyTimestamp) or a signed 4-digit UTC offset like
 * "-0500" (seen on plasecLasttime). Neither is valid ISO 8601 as-is.
 */
const ACM_TIMESTAMP_PATTERN = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(Z|[+-]\d{4})$/;

export function parseAcmTimestamp(raw: string): Date {
  const match = ACM_TIMESTAMP_PATTERN.exec(raw.trim());
  if (!match) {
    throw new Error(`Unrecognized ACM timestamp format: "${raw}"`);
  }

  const [, year, month, day, hour, minute, second, offset] = match;
  const isoOffset = offset === 'Z' ? 'Z' : `${offset.slice(0, 3)}:${offset.slice(3)}`;
  const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}${isoOffset}`;

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Failed to parse ACM timestamp "${raw}" (built ISO string "${iso}")`);
  }
  return date;
}
