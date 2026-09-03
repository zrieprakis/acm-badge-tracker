import type { DashboardEntryDTO, HealthStatusDTO } from '@acm-tracker/shared';
import { env } from '../config/env.js';
import { accessEventRepository } from '../repositories/accessEventRepository.js';
import { syncMetadataRepository } from '../repositories/syncMetadataRepository.js';

export const dashboardService = {
  async getDashboardEntries(): Promise<DashboardEntryDTO[]> {
    const rows = await accessEventRepository.getDashboardRows();
    const previousByMemberId = await accessEventRepository.getPreviousEvents(
      rows.map((row) => row.teamMemberId),
    );

    return rows.map((row) => {
      const previous = previousByMemberId.get(row.teamMemberId);
      return {
        teamMemberId: row.teamMemberId,
        displayName: row.displayName,
        doorName: row.doorName,
        doorId: row.doorId,
        eventType: row.eventType,
        eventTimestamp: row.eventTimestamp,
        updatedAt: row.updatedAt,
        previousDoorName: previous?.doorName ?? null,
        previousEventTimestamp: previous?.eventTimestamp ?? null,
      };
    });
  },

  async getHealthStatus(): Promise<HealthStatusDTO> {
    const metadata = await syncMetadataRepository.get();
    return {
      lastPollStartedAt: metadata.lastPollStartedAt,
      lastPollCompletedAt: metadata.lastPollCompletedAt,
      lastPollSuccess: metadata.lastPollSuccess,
      lastPollError: metadata.lastPollError,
      lastSuccessfulPollAt: metadata.lastSuccessfulPollAt,
      consecutiveFailureCount: metadata.consecutiveFailureCount,
      pollIntervalSeconds: env.POLL_INTERVAL_SECONDS,
    };
  },
};
