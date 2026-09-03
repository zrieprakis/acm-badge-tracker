import { desc, eq, lt } from 'drizzle-orm';
import { db } from '../db/client.js';
import { accessEventHistory, lastAccessEvents, teamMembers } from '../db/schema.js';

export interface AccessEventUpsert {
  teamMemberId: number;
  doorName: string | null;
  doorId: string | null;
  eventType: string | null;
  eventTimestamp: string;
  rawEventId: string | null;
}

export interface DashboardRow {
  teamMemberId: number;
  displayName: string;
  doorName: string | null;
  doorId: string | null;
  eventType: string | null;
  eventTimestamp: string | null;
  updatedAt: string | null;
}

export interface PreviousEvent {
  doorName: string | null;
  eventTimestamp: string;
}

export const accessEventRepository = {
  /**
   * Upserts the "current state" cache row and appends to the bounded
   * history log, but only when the event is newer than what's cached -
   * ACM's recent-events feed can return events we've already recorded.
   */
  async recordEventIfNewer(event: AccessEventUpsert): Promise<boolean> {
    const now = new Date().toISOString();
    const existing = await db
      .select()
      .from(lastAccessEvents)
      .where(eq(lastAccessEvents.teamMemberId, event.teamMemberId));

    const current = existing[0];
    if (current?.eventTimestamp && current.eventTimestamp >= event.eventTimestamp) {
      return false;
    }

    if (current) {
      await db
        .update(lastAccessEvents)
        .set({
          doorName: event.doorName,
          doorId: event.doorId,
          eventType: event.eventType,
          eventTimestamp: event.eventTimestamp,
          rawEventId: event.rawEventId,
          updatedAt: now,
        })
        .where(eq(lastAccessEvents.teamMemberId, event.teamMemberId));
    } else {
      await db.insert(lastAccessEvents).values({
        teamMemberId: event.teamMemberId,
        doorName: event.doorName,
        doorId: event.doorId,
        eventType: event.eventType,
        eventTimestamp: event.eventTimestamp,
        rawEventId: event.rawEventId,
        updatedAt: now,
      });
    }

    await db.insert(accessEventHistory).values({
      teamMemberId: event.teamMemberId,
      doorName: event.doorName,
      doorId: event.doorId,
      eventType: event.eventType,
      eventTimestamp: event.eventTimestamp,
      rawEventId: event.rawEventId,
      createdAt: now,
    });

    return true;
  },

  async getDashboardRows(): Promise<DashboardRow[]> {
    const rows = await db
      .select({
        teamMemberId: teamMembers.id,
        displayName: teamMembers.displayName,
        doorName: lastAccessEvents.doorName,
        doorId: lastAccessEvents.doorId,
        eventType: lastAccessEvents.eventType,
        eventTimestamp: lastAccessEvents.eventTimestamp,
        updatedAt: lastAccessEvents.updatedAt,
      })
      .from(teamMembers)
      .leftJoin(lastAccessEvents, eq(lastAccessEvents.teamMemberId, teamMembers.id))
      .where(eq(teamMembers.isActive, true))
      .orderBy(teamMembers.displayName);

    return rows;
  },

  /**
   * The second-most-recent recorded event per team member (the most recent
   * is a duplicate of last_access_events, since recordEventIfNewer always
   * writes both together). One query per member rather than a window
   * function - simplest option, and fine at this scale (a small tracked
   * team, called once per dashboard request).
   */
  async getPreviousEvents(teamMemberIds: number[]): Promise<Map<number, PreviousEvent>> {
    const result = new Map<number, PreviousEvent>();

    for (const teamMemberId of teamMemberIds) {
      const rows = await db
        .select({
          doorName: accessEventHistory.doorName,
          eventTimestamp: accessEventHistory.eventTimestamp,
        })
        .from(accessEventHistory)
        .where(eq(accessEventHistory.teamMemberId, teamMemberId))
        .orderBy(desc(accessEventHistory.eventTimestamp), desc(accessEventHistory.id))
        .limit(2);

      if (rows.length === 2) {
        result.set(teamMemberId, rows[1]);
      }
    }

    return result;
  },

  async pruneHistoryOlderThan(cutoffIso: string): Promise<number> {
    const result = await db
      .delete(accessEventHistory)
      .where(lt(accessEventHistory.eventTimestamp, cutoffIso));
    return result.rowsAffected ?? 0;
  },
};
