import { Router } from 'express';
import { dashboardService } from '../services/dashboardService.js';

export const dashboardRoutes = Router();

dashboardRoutes.get('/dashboard', async (_req, res, next) => {
  try {
    res.json(await dashboardService.getDashboardEntries());
  } catch (err) {
    next(err);
  }
});
