import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginRateLimiter } from '../../src/auth/loginRateLimiter.js';

describe('LoginRateLimiter', () => {
  let now: number;

  beforeEach(() => {
    now = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function newLimiter() {
    return new LoginRateLimiter({ maxFailedAttempts: 3, lockoutDurationMs: 5 * 60 * 1000 });
  }

  it('does not lock out before the threshold is reached', () => {
    const limiter = newLimiter();
    limiter.recordFailure('admin');
    limiter.recordFailure('admin');

    expect(limiter.checkLockout('admin')).toEqual({ locked: false });
  });

  it('locks out on the 3rd consecutive failure', () => {
    const limiter = newLimiter();
    limiter.recordFailure('admin');
    limiter.recordFailure('admin');
    limiter.recordFailure('admin');

    const status = limiter.checkLockout('admin');
    expect(status.locked).toBe(true);
    expect(status.retryAfterSeconds).toBe(300);
  });

  it('stays locked out until the lockout duration elapses', () => {
    const limiter = newLimiter();
    limiter.recordFailure('admin');
    limiter.recordFailure('admin');
    limiter.recordFailure('admin');

    now += 4 * 60 * 1000; // 4 minutes later - still within the 5-minute window
    expect(limiter.checkLockout('admin').locked).toBe(true);

    now += 61 * 1000; // just past the 5-minute window
    expect(limiter.checkLockout('admin')).toEqual({ locked: false });
  });

  it('tracks failures independently per username', () => {
    const limiter = newLimiter();
    limiter.recordFailure('admin');
    limiter.recordFailure('admin');
    limiter.recordFailure('admin');

    expect(limiter.checkLockout('someone-else').locked).toBe(false);
  });

  it('clear() resets the failure count, requiring the full threshold again', () => {
    const limiter = newLimiter();
    limiter.recordFailure('admin');
    limiter.recordFailure('admin');
    limiter.clear('admin');

    limiter.recordFailure('admin');
    limiter.recordFailure('admin');
    expect(limiter.checkLockout('admin').locked).toBe(false);
  });
});
