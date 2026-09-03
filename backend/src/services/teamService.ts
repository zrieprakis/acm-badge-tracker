import { z } from 'zod';
import type { TeamMemberDTO } from '@acm-tracker/shared';
import {
  teamMemberRepository,
  type TeamMemberRow,
} from '../repositories/teamMemberRepository.js';

export const createTeamMemberSchema = z.object({
  displayName: z.string().trim().min(1, 'displayName is required'),
  acmCardholderId: z.string().trim().min(1, 'acmCardholderId is required'),
  notes: z.string().trim().nullable().optional(),
});

export const updateTeamMemberSchema = z.object({
  displayName: z.string().trim().min(1).optional(),
  acmCardholderId: z.string().trim().min(1).optional(),
  notes: z.string().trim().nullable().optional(),
  isActive: z.boolean().optional(),
});

export class DuplicateCardholderIdError extends Error {
  constructor(acmCardholderId: string) {
    super(`A team member with ACM cardholder ID "${acmCardholderId}" already exists.`);
    this.name = 'DuplicateCardholderIdError';
  }
}

function toDTO(row: TeamMemberRow): TeamMemberDTO {
  return {
    id: row.id,
    displayName: row.displayName,
    acmCardholderId: row.acmCardholderId,
    isActive: row.isActive,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const teamService = {
  async listAll(): Promise<TeamMemberDTO[]> {
    const rows = await teamMemberRepository.findAll();
    return rows.map(toDTO);
  },

  async create(input: z.infer<typeof createTeamMemberSchema>): Promise<TeamMemberDTO> {
    const existing = await teamMemberRepository.findByCardholderId(input.acmCardholderId);
    if (existing) throw new DuplicateCardholderIdError(input.acmCardholderId);

    const row = await teamMemberRepository.create({
      displayName: input.displayName,
      acmCardholderId: input.acmCardholderId,
      notes: input.notes ?? null,
    });
    return toDTO(row);
  },

  async update(
    id: number,
    input: z.infer<typeof updateTeamMemberSchema>,
  ): Promise<TeamMemberDTO | undefined> {
    if (input.acmCardholderId) {
      const existing = await teamMemberRepository.findByCardholderId(input.acmCardholderId);
      if (existing && existing.id !== id) {
        throw new DuplicateCardholderIdError(input.acmCardholderId);
      }
    }

    const row = await teamMemberRepository.update(id, input);
    return row ? toDTO(row) : undefined;
  },

  /** Permanently removes a team member. Returns false if no such member exists. */
  async remove(id: number): Promise<boolean> {
    const existing = await teamMemberRepository.findById(id);
    if (!existing) return false;

    await teamMemberRepository.delete(id);
    return true;
  },
};
