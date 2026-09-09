import { z } from 'zod';
import type { FirstLastSwipeReportEntryDTO } from '@acm-tracker/shared';
import { accessEventRepository } from '../repositories/accessEventRepository.js';
import { getSchoolDateKey } from '../utils/schoolTimeZone.js';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be in YYYY-MM-DD format');

export const firstLastSwipeReportQuerySchema = z
  .object({
    start: dateSchema,
    end: dateSchema,
  })
  .refine((data) => data.start <= data.end, {
    message: 'start must be on or before end',
    path: ['start'],
  });

export const reportService = {
  async getFirstLastSwipeReport(
    query: z.infer<typeof firstLastSwipeReportQuerySchema>,
  ): Promise<FirstLastSwipeReportEntryDTO[]> {
    // access_event_history stores UTC timestamps, but a swipe near midnight
    // can fall on a different school-local calendar day than its UTC one -
    // pad the DB query a day on each side, then filter back down to the
    // requested range below using each row's actual school-local date.
    const rangeStart = new Date(`${query.start}T00:00:00.000Z`);
    rangeStart.setUTCDate(rangeStart.getUTCDate() - 1);
    const rangeEnd = new Date(`${query.end}T00:00:00.000Z`);
    rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 2);

    const rows = await accessEventRepository.getHistoryInRange(
      rangeStart.toISOString(),
      rangeEnd.toISOString(),
    );

    const buckets = new Map<string, FirstLastSwipeReportEntryDTO>();

    for (const row of rows) {
      const date = getSchoolDateKey(row.eventTimestamp);
      if (date < query.start || date > query.end) continue;

      const key = `${row.teamMemberId}|${date}`;
      const existing = buckets.get(key);
      if (!existing) {
        buckets.set(key, {
          teamMemberId: row.teamMemberId,
          displayName: row.displayName,
          date,
          firstEventTimestamp: row.eventTimestamp,
          firstDoorName: row.doorName,
          lastEventTimestamp: row.eventTimestamp,
          lastDoorName: row.doorName,
        });
        continue;
      }

      if (row.eventTimestamp < existing.firstEventTimestamp) {
        existing.firstEventTimestamp = row.eventTimestamp;
        existing.firstDoorName = row.doorName;
      }
      if (row.eventTimestamp > existing.lastEventTimestamp) {
        existing.lastEventTimestamp = row.eventTimestamp;
        existing.lastDoorName = row.doorName;
      }
    }

    return [...buckets.values()].sort(
      (a, b) => a.date.localeCompare(b.date) || a.displayName.localeCompare(b.displayName),
    );
  },
};
