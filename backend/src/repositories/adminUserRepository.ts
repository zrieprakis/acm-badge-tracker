import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { adminUsers } from '../db/schema.js';

export type AdminUserRow = typeof adminUsers.$inferSelect;

export const adminUserRepository = {
  async findByUsername(username: string): Promise<AdminUserRow | undefined> {
    const rows = await db.select().from(adminUsers).where(eq(adminUsers.username, username));
    return rows[0];
  },

  async create(username: string, passwordHash: string): Promise<AdminUserRow> {
    const rows = await db
      .insert(adminUsers)
      .values({ username, passwordHash, createdAt: new Date().toISOString() })
      .returning();
    return rows[0];
  },

  async recordLogin(id: number): Promise<void> {
    await db
      .update(adminUsers)
      .set({ lastLoginAt: new Date().toISOString() })
      .where(eq(adminUsers.id, id));
  },

  async updatePasswordHash(id: number, passwordHash: string): Promise<void> {
    await db.update(adminUsers).set({ passwordHash }).where(eq(adminUsers.id, id));
  },
};
