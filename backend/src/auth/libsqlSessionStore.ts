import { Store, type SessionData } from 'express-session';
import { eq, lt } from 'drizzle-orm';
import { db } from '../db/client.js';
import { sessions } from '../db/schema.js';

const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * express-session Store backed by the app's own libsql database (the
 * `sessions` table in db/schema.ts), avoiding an extra native-dependent
 * package (e.g. connect-sqlite3/sqlite3) purely for session storage.
 * Fine for a single-instance deployment at this scale.
 */
export class LibsqlSessionStore extends Store {
  get(sid: string, callback: (err: unknown, session?: SessionData | null) => void): void {
    void (async () => {
      try {
        const rows = await db.select().from(sessions).where(eq(sessions.sid, sid));
        const row = rows[0];
        if (!row || row.expiresAt < Date.now()) {
          callback(null, null);
          return;
        }
        callback(null, JSON.parse(row.data) as SessionData);
      } catch (err) {
        callback(err);
      }
    })();
  }

  set(sid: string, session: SessionData, callback?: (err?: unknown) => void): void {
    void (async () => {
      try {
        const maxAge = session.cookie?.maxAge ?? DEFAULT_MAX_AGE_MS;
        const expiresAt = Date.now() + maxAge;
        const data = JSON.stringify(session);

        const existing = await db.select().from(sessions).where(eq(sessions.sid, sid));
        if (existing[0]) {
          await db.update(sessions).set({ data, expiresAt }).where(eq(sessions.sid, sid));
        } else {
          await db.insert(sessions).values({ sid, data, expiresAt });
        }
        callback?.();
      } catch (err) {
        callback?.(err);
      }
    })();
  }

  destroy(sid: string, callback?: (err?: unknown) => void): void {
    void (async () => {
      try {
        await db.delete(sessions).where(eq(sessions.sid, sid));
        callback?.();
      } catch (err) {
        callback?.(err);
      }
    })();
  }

  touch(sid: string, session: SessionData, callback?: (err?: unknown) => void): void {
    this.set(sid, session, callback);
  }

  async pruneExpired(): Promise<void> {
    await db.delete(sessions).where(lt(sessions.expiresAt, Date.now()));
  }
}
