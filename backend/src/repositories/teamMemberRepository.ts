import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { teamMembers } from '../db/schema.js';

export type TeamMemberRow = typeof teamMembers.$inferSelect;

export interface CreateTeamMemberData {
  displayName: string;
  acmCardholderId: string;
  notes?: string | null;
}

export interface UpdateTeamMemberData {
  displayName?: string;
  acmCardholderId?: string;
  notes?: string | null;
  isActive?: boolean;
}

export const teamMemberRepository = {
  async findAll(): Promise<TeamMemberRow[]> {
    return db.select().from(teamMembers).orderBy(teamMembers.displayName);
  },

  async findActive(): Promise<TeamMemberRow[]> {
    return db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.isActive, true))
      .orderBy(teamMembers.displayName);
  },

  async findById(id: number): Promise<TeamMemberRow | undefined> {
    const rows = await db.select().from(teamMembers).where(eq(teamMembers.id, id));
    return rows[0];
  },

  async findByCardholderId(acmCardholderId: string): Promise<TeamMemberRow | undefined> {
    const rows = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.acmCardholderId, acmCardholderId));
    return rows[0];
  },

  async create(data: CreateTeamMemberData): Promise<TeamMemberRow> {
    const now = new Date().toISOString();
    const rows = await db
      .insert(teamMembers)
      .values({
        displayName: data.displayName,
        acmCardholderId: data.acmCardholderId,
        notes: data.notes ?? null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return rows[0];
  },

  async update(id: number, data: UpdateTeamMemberData): Promise<TeamMemberRow | undefined> {
    const rows = await db
      .update(teamMembers)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(teamMembers.id, id))
      .returning();
    return rows[0];
  },

  async setActive(id: number, isActive: boolean): Promise<TeamMemberRow | undefined> {
    return this.update(id, { isActive });
  },

  async delete(id: number): Promise<void> {
    await db.delete(teamMembers).where(eq(teamMembers.id, id));
  },
};
