import { beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AcmClient } from '../../src/acm/AcmClient.js';

// Point this test file's DB at an isolated temp file *before* importing any
// module that transitively loads db/client.ts, so each test file gets its
// own database instead of sharing state with other test files.
const testDbDir = mkdtempSync(join(tmpdir(), 'acm-tracker-test-'));
process.env.DB_PATH = join(testDbDir, 'test.db');

const { runMigrations } = await import('../../src/db/migrate.js');
const { runPollCycle } = await import('../../src/polling/pollService.js');
const { teamMemberRepository } = await import('../../src/repositories/teamMemberRepository.js');
const { accessEventRepository } = await import('../../src/repositories/accessEventRepository.js');
const { syncMetadataRepository } = await import('../../src/repositories/syncMetadataRepository.js');
const { MockAcmClient } = await import('../../src/acm/MockAcmClient.js');

beforeAll(async () => {
  await runMigrations();
});

describe('runPollCycle', () => {
  it('records new access events for tracked team members and updates sync metadata', async () => {
    const member = await teamMemberRepository.create({
      displayName: 'Test Person',
      acmCardholderId: 'CARD-TEST-1',
    });

    const mockClient = new MockAcmClient({
      cardholders: [{ cardholderId: member.acmCardholderId, name: member.displayName }],
      doors: ['Main Entrance'],
      eventProbabilityPerCardholder: 1,
    });

    const result = await runPollCycle(mockClient);

    expect(result.success).toBe(true);
    expect(result.recordedEventCount).toBe(1);

    const dashboardRows = await accessEventRepository.getDashboardRows();
    const row = dashboardRows.find((r) => r.teamMemberId === member.id);
    expect(row?.doorName).toBe('Main Entrance');
    expect(row?.eventTimestamp).toBeTruthy();

    const metadata = await syncMetadataRepository.get();
    expect(metadata.lastPollSuccess).toBe(true);
    expect(metadata.lastSuccessfulPollAt).toBeTruthy();
  });

  it('ignores access events for cardholder IDs not in the tracked roster', async () => {
    const mockClient = new MockAcmClient({
      cardholders: [{ cardholderId: 'CARD-UNTRACKED', name: 'Nobody We Track' }],
      eventProbabilityPerCardholder: 1,
    });

    const result = await runPollCycle(mockClient);

    expect(result.success).toBe(true);
    expect(result.recordedEventCount).toBe(0);
  });

  it('records a poll failure in sync_metadata when the ACM client throws', async () => {
    const failingClient: AcmClient = {
      authenticate: async () => {
        throw new Error('simulated ACM outage');
      },
      listCardholders: async () => [],
      getRecentAccessEvents: async () => [],
    };

    const result = await runPollCycle(failingClient);

    expect(result.success).toBe(false);
    expect(result.error).toContain('simulated ACM outage');

    const metadata = await syncMetadataRepository.get();
    expect(metadata.lastPollSuccess).toBe(false);
    expect(metadata.lastPollError).toContain('simulated ACM outage');
  });
});
