import { accessEventRepository } from '../repositories/accessEventRepository.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function pruneOldHistory(retentionDays: number): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * MS_PER_DAY).toISOString();
  return accessEventRepository.pruneHistoryOlderThan(cutoff);
}
