import { Router } from 'express';
import { firstLastSwipeReportQuerySchema, reportService } from '../services/reportService.js';

export const reportRoutes = Router();

reportRoutes.get('/reports/first-last-swipe', async (req, res, next) => {
  const parsed = firstLastSwipeReportQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
    return;
  }

  try {
    res.json(await reportService.getFirstLastSwipeReport(parsed.data));
  } catch (err) {
    next(err);
  }
});
