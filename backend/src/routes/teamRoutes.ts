import { Router } from 'express';
import {
  createTeamMemberSchema,
  DuplicateCardholderIdError,
  teamService,
  updateTeamMemberSchema,
} from '../services/teamService.js';

export const teamRoutes = Router();

function parseId(rawId: string): number | undefined {
  const id = Number(rawId);
  return Number.isInteger(id) ? id : undefined;
}

teamRoutes.get('/team', async (_req, res, next) => {
  try {
    res.json(await teamService.listAll());
  } catch (err) {
    next(err);
  }
});

teamRoutes.post('/team', async (req, res, next) => {
  const parsed = createTeamMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
    return;
  }

  try {
    const created = await teamService.create(parsed.data);
    res.status(201).json(created);
  } catch (err) {
    if (err instanceof DuplicateCardholderIdError) {
      res.status(409).json({ error: err.message });
      return;
    }
    next(err);
  }
});

teamRoutes.put('/team/:id', async (req, res, next) => {
  const id = parseId(req.params.id);
  if (id === undefined) {
    res.status(400).json({ error: 'Invalid team member id' });
    return;
  }

  const parsed = updateTeamMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
    return;
  }

  try {
    const updated = await teamService.update(id, parsed.data);
    if (!updated) {
      res.status(404).json({ error: 'Team member not found' });
      return;
    }
    res.json(updated);
  } catch (err) {
    if (err instanceof DuplicateCardholderIdError) {
      res.status(409).json({ error: err.message });
      return;
    }
    next(err);
  }
});

/**
 * By default, soft-deletes: sets isActive=false rather than removing the
 * row, preserving event history. Pass ?hard=true to permanently remove
 * the team member (and, via ON DELETE CASCADE, their cached/history
 * rows) - intended for correcting mistaken roster entries, not routine
 * offboarding.
 */
teamRoutes.delete('/team/:id', async (req, res, next) => {
  const id = parseId(req.params.id);
  if (id === undefined) {
    res.status(400).json({ error: 'Invalid team member id' });
    return;
  }

  try {
    if (req.query.hard === 'true') {
      const deleted = await teamService.remove(id);
      if (!deleted) {
        res.status(404).json({ error: 'Team member not found' });
        return;
      }
      res.status(204).end();
      return;
    }

    const updated = await teamService.update(id, { isActive: false });
    if (!updated) {
      res.status(404).json({ error: 'Team member not found' });
      return;
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
});
