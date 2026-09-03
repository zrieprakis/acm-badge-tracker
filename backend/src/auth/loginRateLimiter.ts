interface AttemptRecord {
  failureCount: number;
  lockedUntil: number | null;
}

export interface LoginRateLimiterOptions {
  maxFailedAttempts: number;
  lockoutDurationMs: number;
}

export interface LockoutStatus {
  locked: boolean;
  retryAfterSeconds?: number;
}

/**
 * Per-username failed-login lockout. In-memory (not persisted to the DB),
 * so it resets on process restart - an accepted tradeoff for this scale
 * rather than adding a table just for this. Keyed by username rather than
 * source IP: this app has a small, fixed set of admin accounts, so
 * protecting the credential itself is what matters, and it can't be
 * bypassed by an attacker rotating IPs.
 */
export class LoginRateLimiter {
  private readonly attempts = new Map<string, AttemptRecord>();

  constructor(private readonly options: LoginRateLimiterOptions) {}

  checkLockout(username: string): LockoutStatus {
    const record = this.attempts.get(username);
    if (!record?.lockedUntil) return { locked: false };

    const remainingMs = record.lockedUntil - Date.now();
    if (remainingMs <= 0) {
      this.attempts.delete(username);
      return { locked: false };
    }

    return { locked: true, retryAfterSeconds: Math.ceil(remainingMs / 1000) };
  }

  recordFailure(username: string): void {
    const record = this.attempts.get(username) ?? { failureCount: 0, lockedUntil: null };
    record.failureCount += 1;
    if (record.failureCount >= this.options.maxFailedAttempts) {
      record.lockedUntil = Date.now() + this.options.lockoutDurationMs;
    }
    this.attempts.set(username, record);
  }

  clear(username: string): void {
    this.attempts.delete(username);
  }
}

export const loginRateLimiter = new LoginRateLimiter({
  maxFailedAttempts: 3,
  lockoutDurationMs: 5 * 60 * 1000,
});
