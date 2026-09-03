import session from 'express-session';
import { env } from '../config/env.js';
import { LibsqlSessionStore } from './libsqlSessionStore.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const sessionMiddleware = session({
  store: new LibsqlSessionStore(),
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  name: 'acm_tracker_sid',
  cookie: {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: ONE_DAY_MS,
  },
});
