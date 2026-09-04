import { XMLParser } from 'fast-xml-parser';
import type { AcmClient } from './AcmClient.js';
import type { AcmAccessEvent, AcmCardholder } from './types.js';
import { AvigilonHttpClient } from './avigilonHttp.js';
import { parseAcmTimestamp } from './avigilonTimestamp.js';

export interface AvigilonAcmClientOptions {
  baseUrl: string;
  username: string;
  password: string;
  rejectUnauthorized: boolean;
}

interface ParsedIdentity {
  dn?: string;
  plasecId?: string;
  plasecName?: string;
}

interface ParsedToken {
  plasecInternalnumber?: string;
  plasecLastdoor?: string;
  plasecLasttime?: string;
}

interface ParsedDoor {
  dn?: string;
  plasecName?: string;
}

/**
 * Doors and tokens only ever appear as repeated elements in these
 * responses, but fast-xml-parser only produces an array when it sees more
 * than one - forcing these three tag names to always parse as arrays means
 * a single-match response doesn't need special-casing everywhere below.
 * parseTagValue is disabled so badge/token numbers stay strings (a numeric
 * auto-parse would silently drop leading zeros).
 */
const xmlParser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  isArray: (tagName) => tagName === 'identity' || tagName === 'token' || tagName === 'door',
});

/** Doors rarely change; avoid re-fetching the full door list every poll cycle. */
const DOOR_CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Real Avigilon ACM REST API client, built from the official
 * "Access Control Manager REST API" guide (v6.44, June 2023) plus live
 * verification against a real appliance. Key facts that shaped this
 * implementation (see CLAUDE.md for the full writeup):
 *
 * - Auth is HTTP Basic on every request; there is no login/session endpoint.
 * - There is no "recent access events" feed. Each Token record (not the
 *   Identity record) carries its own current plasecLastdoor (a door DN)
 *   and plasecLasttime. We resolve a badge number to its owning identity
 *   via an "advanced search" on /identities.xml, then read that
 *   identity's tokens off /tokens.xml. Plain LDAP `filter=` queries do
 *   not reach into nested token attributes - only the adv_search_*
 *   mechanism does.
 * - A person can hold multiple active badges/tokens, each independently
 *   tracking its own plasecLastdoor/plasecLasttime (confirmed live: a
 *   real badge-in via a second token left the first token's data
 *   unchanged). So the roster's stored badge number is only used to
 *   resolve *who* the person is - we then check every token on their
 *   identity and use whichever has the most recent plasecLasttime as
 *   their true last-known door, not just the one specific badge on file.
 * - plasecLastdoor is a door DN, not a name - resolved against a cached
 *   /doors.xml listing.
 * - Timestamps are ACM's own format (YYYYMMDDHHMMSS + Z or ±HHMM), not
 *   ISO 8601 - see avigilonTimestamp.ts.
 */
export class AvigilonAcmClient implements AcmClient {
  private readonly http: AvigilonHttpClient;
  private readonly badgeToIdentityCn = new Map<string, string>();
  private doorNameByDn: Map<string, string> | undefined;
  private doorMapFetchedAt = 0;
  /** Shared by concurrent callers so a cold/stale cache triggers one
   * /doors.xml fetch, not one per badge being resolved in parallel. */
  private doorMapFetchPromise: Promise<Map<string, string>> | undefined;

  constructor(options: AvigilonAcmClientOptions) {
    this.http = new AvigilonHttpClient(options);
  }

  async authenticate(): Promise<void> {
    const res = await this.http.get(
      '/identities.xml?adv_search_exec_search=true&adv_search_field_0=plasecLname' +
        '&adv_search_val_0=__acm_tracker_auth_check__&adv_search_and_or=&adv_search_cnt=0',
    );
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `ACM authentication failed (HTTP ${res.status}). Check ACM_API_USERNAME/ACM_API_PASSWORD.`,
      );
    }
    if (res.status !== 200) {
      throw new Error(`ACM connectivity check failed (HTTP ${res.status}).`);
    }
  }

  /**
   * Best-effort only - nothing in this codebase currently depends on this.
   * Returns identity name/id pairs, but note plasecId here is ACM's
   * internal identity GUID, not a badge/token number. Roster admins should
   * enter the person's actual badge/token internal number (found via
   * ACM's own token management UI) as the team member's ACM Cardholder ID.
   */
  async listCardholders(): Promise<AcmCardholder[]> {
    const res = await this.http.get('/identities.xml?filter=(plasecLname=*)');
    const parsed = xmlParser.parse(res.body) as { identities?: { identity?: ParsedIdentity[] } };
    const identities = parsed.identities?.identity ?? [];
    return identities.map((identity) => ({
      cardholderId: identity.plasecId ?? identity.dn ?? '',
      name: identity.plasecName ?? '',
    }));
  }

  /**
   * `since` is intentionally unused here: unlike the mock's growing event
   * log, real ACM has no historical stream to filter - each badge only
   * ever has a single "current" last-door/last-time. We always return
   * that current state for every requested cardholder, and rely entirely
   * on accessEventRepository.recordEventIfNewer() (which compares against
   * what's already cached in *our* DB for that specific person) to decide
   * whether it's new. Filtering here by a global "since last poll"
   * cutoff would wrongly hide a person's real last-known door whenever it
   * predates when they were added to the tracked roster.
   */
  async getRecentAccessEvents(cardholderIds: string[], _since: Date): Promise<AcmAccessEvent[]> {
    // Each badge's own lookup is a couple of sequential requests (resolve
    // identity, then fetch its tokens), but different badges are fully
    // independent - running them in parallel rather than one at a time
    // keeps a poll cycle well under the poll interval regardless of roster
    // size. No concurrency cap: tens of badges is well within what a
    // single ACM appliance and Node's default outbound connections handle
    // comfortably - worth revisiting only if the roster ever grows into
    // the hundreds.
    const results = await Promise.all(
      cardholderIds.map(async (badgeNumber) => {
        try {
          return await this.getLastEventForBadge(badgeNumber);
        } catch (err) {
          console.warn(
            `ACM: failed to fetch access state for badge "${badgeNumber}":`,
            err instanceof Error ? err.message : err,
          );
          return undefined;
        }
      }),
    );

    return results.filter((event): event is AcmAccessEvent => event !== undefined);
  }

  /**
   * A person can hold multiple active badges/tokens (a primary badge, a
   * spare, a mobile credential, etc.), each with its own independent
   * plasecLastdoor/plasecLasttime - confirmed live when a real person
   * badged in via a different token than the one on file, and the
   * tracked token's own last-door didn't change. `badgeNumber` here is
   * only used to resolve *which person* we're looking at (any one of
   * their known badge numbers works); once resolved, every token on
   * their identity is checked and whichever has the most recent
   * plasecLasttime wins - that's the person's true last-known door,
   * regardless of which physical badge they used.
   */
  private async getLastEventForBadge(badgeNumber: string): Promise<AcmAccessEvent | undefined> {
    const identityCn = await this.resolveIdentityCn(badgeNumber);
    if (!identityCn) return undefined;

    const res = await this.http.get(`/identities/${encodeURIComponent(identityCn)}/tokens.xml`);
    if (res.status !== 200) {
      throw new Error(`Fetching tokens for identity "${identityCn}" failed (HTTP ${res.status}).`);
    }

    const parsed = xmlParser.parse(res.body) as { tokens?: { token?: ParsedToken[] } };
    const tokens = parsed.tokens?.token ?? [];

    let mostRecent: { doorDn: string; timestamp: Date } | undefined;
    for (const token of tokens) {
      if (!token.plasecLastdoor || !token.plasecLasttime) continue;

      let timestamp: Date;
      try {
        timestamp = parseAcmTimestamp(token.plasecLasttime);
      } catch (err) {
        console.warn(
          `ACM: skipping token with unparseable plasecLasttime "${token.plasecLasttime}" ` +
            `for identity "${identityCn}":`,
          err instanceof Error ? err.message : err,
        );
        continue;
      }

      if (!mostRecent || timestamp > mostRecent.timestamp) {
        mostRecent = { doorDn: token.plasecLastdoor, timestamp };
      }
    }

    if (!mostRecent) return undefined;

    const doorNameByDn = await this.getDoorNameMap();

    return {
      cardholderId: badgeNumber,
      doorName: doorNameByDn.get(mostRecent.doorDn) ?? null,
      doorId: mostRecent.doorDn,
      eventType: null,
      timestamp: mostRecent.timestamp.toISOString(),
      rawEventId: null,
    };
  }

  private async resolveIdentityCn(badgeNumber: string): Promise<string | undefined> {
    const cached = this.badgeToIdentityCn.get(badgeNumber);
    if (cached) return cached;

    const res = await this.http.get(
      '/identities.xml?adv_search_exec_search=true&adv_search_field_0=plasecInternalnumber' +
        `&adv_search_val_0=${encodeURIComponent(badgeNumber)}&adv_search_and_or=&adv_search_cnt=0`,
    );
    if (res.status !== 200) {
      throw new Error(`ACM identity lookup for badge "${badgeNumber}" failed (HTTP ${res.status}).`);
    }

    const parsed = xmlParser.parse(res.body) as { identities?: { identity?: ParsedIdentity[] } };
    const identity = parsed.identities?.identity?.[0];
    const dn = identity?.dn;
    if (!dn) return undefined;

    // dn looks like "cn=eb7a945620124c27,ou=identities,dc=plasec" - the
    // leading cn= value is what /identities/<cn>/tokens.xml expects.
    const cn = dn.split(',')[0]?.replace(/^cn=/i, '');
    if (!cn) return undefined;

    this.badgeToIdentityCn.set(badgeNumber, cn);
    return cn;
  }

  private async getDoorNameMap(): Promise<Map<string, string>> {
    if (this.doorNameByDn && Date.now() - this.doorMapFetchedAt < DOOR_CACHE_TTL_MS) {
      return this.doorNameByDn;
    }

    if (!this.doorMapFetchPromise) {
      this.doorMapFetchPromise = this.fetchDoorNameMap().finally(() => {
        this.doorMapFetchPromise = undefined;
      });
    }

    return this.doorMapFetchPromise;
  }

  private async fetchDoorNameMap(): Promise<Map<string, string>> {
    const res = await this.http.get('/doors.xml');
    if (res.status !== 200) {
      throw new Error(`Failed to fetch ACM doors list (HTTP ${res.status}).`);
    }

    const parsed = xmlParser.parse(res.body) as { doors?: { door?: ParsedDoor[] } };
    const doors = parsed.doors?.door ?? [];

    const map = new Map<string, string>();
    for (const door of doors) {
      if (door.dn && door.plasecName) {
        map.set(door.dn, door.plasecName);
      }
    }

    this.doorNameByDn = map;
    this.doorMapFetchedAt = Date.now();
    return map;
  }
}
