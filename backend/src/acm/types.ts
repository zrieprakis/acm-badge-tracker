/**
 * ACM-shaped DTOs. These describe Avigilon ACM's own data shapes and are
 * intentionally kept separate from our internal DB schema - only
 * polling/pollService.ts is allowed to map between the two, so ACM's real
 * field names never leak past the acm/ folder.
 */

export interface AcmCardholder {
  cardholderId: string;
  name: string;
}

export interface AcmAccessEvent {
  cardholderId: string;
  doorName: string | null;
  doorId: string | null;
  eventType: string | null;
  /** ISO 8601 timestamp of when the badge event occurred, per ACM. */
  timestamp: string;
  /** ACM's own event identifier, used for de-duplication where available. */
  rawEventId: string | null;
}
