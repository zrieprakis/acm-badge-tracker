import { env } from '../config/env.js';
import type { AcmClient } from '../acm/AcmClient.js';
import { getAcmClient } from '../acm/acmClientFactory.js';
import { teamMemberRepository } from '../repositories/teamMemberRepository.js';
import { accessEventRepository } from '../repositories/accessEventRepository.js';
import { syncMetadataRepository } from '../repositories/syncMetadataRepository.js';
import { pruneOldHistory } from './historyCleanup.js';

/** Bounds the very first poll (before sync_metadata has a last-success timestamp). */
const INITIAL_LOOKBACK_MS = 24 * 60 * 60 * 1000;

export interface PollCycleResult {
  success: boolean;
  recordedEventCount: number;
  error?: string;
}

/**
 * Orchestrates one poll: fetch recent ACM access events, match them against
 * the active team roster by cardholder ID, upsert the "last seen" cache +
 * append-only history for matches, and update sync_metadata either way.
 */
export async function runPollCycle(acmClient: AcmClient = getAcmClient()): Promise<PollCycleResult> {
  await syncMetadataRepository.recordPollStarted();

  try {
    await acmClient.authenticate();

    const metadata = await syncMetadataRepository.get();
    const since = metadata.lastSuccessfulPollAt
      ? new Date(metadata.lastSuccessfulPollAt)
      : new Date(Date.now() - INITIAL_LOOKBACK_MS);

    const activeMembers = await teamMemberRepository.findActive();
    const events = await acmClient.getRecentAccessEvents(
      activeMembers.map((member) => member.acmCardholderId),
      since,
    );

    const teamMemberIdByCardholderId = new Map(
      activeMembers.map((member) => [member.acmCardholderId, member.id]),
    );

    let recordedEventCount = 0;
    for (const event of events) {
      const teamMemberId = teamMemberIdByCardholderId.get(event.cardholderId);
      if (teamMemberId === undefined) continue;

      const wasRecorded = await accessEventRepository.recordEventIfNewer({
        teamMemberId,
        doorName: event.doorName,
        doorId: event.doorId,
        eventType: event.eventType,
        eventTimestamp: event.timestamp,
        rawEventId: event.rawEventId,
      });
      if (wasRecorded) recordedEventCount++;
    }

    await pruneOldHistory(env.HISTORY_RETENTION_DAYS);
    await syncMetadataRepository.recordPollSuccess();

    return { success: true, recordedEventCount };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await syncMetadataRepository.recordPollFailure(message);
    return { success: false, recordedEventCount: 0, error: message };
  }
}
