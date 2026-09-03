import { Router } from 'express';
import { z } from 'zod';
import { adminUserRepository } from '../repositories/adminUserRepository.js';
import { passwordService } from '../auth/passwordService.js';
import { requireAuth } from '../auth/requireAuth.js';
import { loginRateLimiter } from '../auth/loginRateLimiter.js';

export const authRoutes = Router();

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12, 'New password must be at least 12 characters'),
});

authRoutes.post('/auth/login', async (req, res, next) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'username and password are required' });
    return;
  }

  const { username, password } = parsed.data;

  const lockout = loginRateLimiter.checkLockout(username);
  if (lockout.locked) {
    res.status(429).json({
      error: `Too many failed login attempts. Try again in ${lockout.retryAfterSeconds}s.`,
    });
    return;
  }

  try {
    const user = await adminUserRepository.findByUsername(username);
    const isValid = await passwordService.compareAgainstHashOrDummy(password, user?.passwordHash);

    if (!user || !isValid) {
      loginRateLimiter.recordFailure(username);
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    loginRateLimiter.clear(username);
    req.session.userId = user.id;
    req.session.username = user.username;
    await adminUserRepository.recordLogin(user.id);

    res.json({ username: user.username });
  } catch (err) {
    next(err);
  }
});

authRoutes.post('/auth/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      next(err);
      return;
    }
    res.clearCookie('acm_tracker_sid');
    res.status(204).end();
  });
});

authRoutes.get('/auth/me', (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  res.json({ username: req.session.username });
});

authRoutes.put('/auth/password', requireAuth, async (req, res, next) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
    return;
  }

  try {
    const userId = req.session.userId!;
    const user = await adminUserRepository.findByUsername(req.session.username!);
    const isCurrentValid = await passwordService.compareAgainstHashOrDummy(
      parsed.data.currentPassword,
      user?.passwordHash,
    );

    if (!user || !isCurrentValid) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    const newHash = await passwordService.hash(parsed.data.newPassword);
    await adminUserRepository.updatePasswordHash(userId, newHash);

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
