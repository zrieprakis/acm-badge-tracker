import { Router } from 'express';
import { dashboardService } from '../services/dashboardService.js';

export const healthRoutes = Router();

healthRoutes.get('/health', async (_req, res, next) => {
  try {
    res.json(await dashboardService.getHealthStatus());
  } catch (err) {
    next(err);
  }
});
