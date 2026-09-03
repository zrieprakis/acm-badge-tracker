import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { syncMetadata } from '../db/schema.js';

const SINGLETON_ID = 1;

export type SyncMetadataRow = typeof syncMetadata.$inferSelect;

async function ensureRow(): Promise<SyncMetadataRow> {
  const existing = await db.select().from(syncMetadata).where(eq(syncMetadata.id, SINGLETON_ID));
  if (existing[0]) return existing[0];

  const inserted = await db
    .insert(syncMetadata)
    .values({ id: SINGLETON_ID, consecutiveFailureCount: 0 })
    .returning();
  return inserted[0];
}

export const syncMetadataRepository = {
  async get(): Promise<SyncMetadataRow> {
    return ensureRow();
  },

  async recordPollStarted(): Promise<void> {
    await ensureRow();
    await db
      .update(syncMetadata)
      .set({ lastPollStartedAt: new Date().toISOString() })
      .where(eq(syncMetadata.id, SINGLETON_ID));
  },

  async recordPollSuccess(): Promise<void> {
    const now = new Date().toISOString();
    await db
      .update(syncMetadata)
      .set({
        lastPollCompletedAt: now,
        lastPollSuccess: true,
        lastPollError: null,
        lastSuccessfulPollAt: now,
        consecutiveFailureCount: 0,
      })
      .where(eq(syncMetadata.id, SINGLETON_ID));
  },

  async recordPollFailure(errorMessage: string): Promise<void> {
    const current = await ensureRow();
    await db
      .update(syncMetadata)
      .set({
        lastPollCompletedAt: new Date().toISOString(),
        lastPollSuccess: false,
        lastPollError: errorMessage,
        consecutiveFailureCount: current.consecutiveFailureCount + 1,
      })
      .where(eq(syncMetadata.id, SINGLETON_ID));
  },
};
