import express, { type Express } from 'express';
import cors from 'cors';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { sessionMiddleware } from './auth/sessionMiddleware.js';
import { requireAuth } from './auth/requireAuth.js';
import { authRoutes } from './routes/authRoutes.js';
import { dashboardRoutes } from './routes/dashboardRoutes.js';
import { teamRoutes } from './routes/teamRoutes.js';
import { healthRoutes } from './routes/healthRoutes.js';

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(requestLogger);
  app.use(sessionMiddleware);

  app.get('/api/health/ping', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api', authRoutes);
  app.use('/api', requireAuth, dashboardRoutes);
  app.use('/api', requireAuth, teamRoutes);
  app.use('/api', requireAuth, healthRoutes);

  app.use(errorHandler);

  return app;
}
