import type { AcmAccessEvent, AcmCardholder } from './types.js';

/**
 * Contract the rest of the system codes against. AvigilonAcmClient
 * implements this against the real Avigilon ACM REST API; MockAcmClient
 * implements it with simulated data so everything downstream (polling,
 * API, UI) can be built and tested independently of the live appliance.
 */
export interface AcmClient {
  /** Verifies credentials/connectivity. HTTP Basic Auth is sent on every
   * request (Avigilon ACM has no separate login/session endpoint), so this
   * just performs a lightweight authenticated request to fail fast on bad
   * credentials or an unreachable server. */
  authenticate(): Promise<void>;

  /** Lists cardholders known to ACM, for admin-side roster mapping assistance. */
  listCardholders(): Promise<AcmCardholder[]>;

  /**
   * Returns the current last-known access event for each of the given ACM
   * cardholder IDs (badge/token numbers). Real ACM has no "events since X"
   * feed - each badge/token record carries only its own current
   * last-door/last-time, so the caller must say which cardholders it
   * cares about and the client fetches each one's latest state, rather
   * than pulling a shared delta stream. `since` is honored as a filter by
   * implementations that have real history to filter (like the mock's
   * growing event log); implementations that only ever see "current
   * state" (like the real Avigilon client) ignore it and always return
   * each cardholder's latest known event - deduping against `since` would
   * incorrectly hide a person's real last-known door whenever it predates
   * `since`. Either way, the caller (pollService, via
   * accessEventRepository.recordEventIfNewer) is the actual source of
   * truth for whether a returned event is new.
   */
  getRecentAccessEvents(cardholderIds: string[], since: Date): Promise<AcmAccessEvent[]>;
}
