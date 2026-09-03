import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const adminUsers = sqliteTable('admin_users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at').notNull(),
  lastLoginAt: text('last_login_at'),
});

export const teamMembers = sqliteTable('team_members', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  displayName: text('display_name').notNull(),
  acmCardholderId: text('acm_cardholder_id').notNull().unique(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

/** One row per team member - the "current state" cache the dashboard reads. */
export const lastAccessEvents = sqliteTable('last_access_events', {
  teamMemberId: integer('team_member_id')
    .primaryKey()
    .references(() => teamMembers.id, { onDelete: 'cascade' }),
  doorName: text('door_name'),
  doorId: text('door_id'),
  eventType: text('event_type'),
  eventTimestamp: text('event_timestamp'),
  rawEventId: text('raw_event_id'),
  updatedAt: text('updated_at').notNull(),
});

/** Bounded append-only audit log, pruned by historyCleanup on a retention window. */
export const accessEventHistory = sqliteTable('access_event_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  teamMemberId: integer('team_member_id')
    .notNull()
    .references(() => teamMembers.id, { onDelete: 'cascade' }),
  doorName: text('door_name'),
  doorId: text('door_id'),
  eventType: text('event_type'),
  eventTimestamp: text('event_timestamp').notNull(),
  rawEventId: text('raw_event_id'),
  createdAt: text('created_at').notNull(),
});

/** Single-row table (id is always 1) tracking ACM polling health. */
export const syncMetadata = sqliteTable('sync_metadata', {
  id: integer('id').primaryKey(),
  lastPollStartedAt: text('last_poll_started_at'),
  lastPollCompletedAt: text('last_poll_completed_at'),
  lastPollSuccess: integer('last_poll_success', { mode: 'boolean' }),
  lastPollError: text('last_poll_error'),
  lastSuccessfulPollAt: text('last_successful_poll_at'),
  consecutiveFailureCount: integer('consecutive_failure_count').notNull().default(0),
});

export const sessions = sqliteTable('sessions', {
  sid: text('sid').primaryKey(),
  data: text('data').notNull(),
  expiresAt: integer('expires_at').notNull(),
});
