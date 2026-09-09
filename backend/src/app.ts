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
import { reportRoutes } from './routes/reportRoutes.js';

export function createApp(): Express {
  const app = express();

  // Backend is only ever reached through nginx (it's not published to the
  // host in docker-compose.yml), which terminates TLS and forwards
  // X-Forwarded-Proto. Without this, Express sees every request as plain
  // HTTP (the nginx->backend hop is unencrypted), so express-session's
  // secure cookie (cookie.secure=true in production - see
  // sessionMiddleware.ts) never actually gets sent to the browser: no
  // error, just a silently missing Set-Cookie header. "1" trusts exactly
  // one hop of proxying, matching this exact topology.
  app.set('trust proxy', 1);

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
  app.use('/api', requireAuth, reportRoutes);

  app.use(errorHandler);

  return app;
}
