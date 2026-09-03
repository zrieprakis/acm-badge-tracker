import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

// Precomputed once so failed-login timing is the same whether the username
// exists or not - otherwise a missing user short-circuits before bcrypt
// runs, letting an attacker enumerate valid usernames by response time.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password-used-for-timing-safety', SALT_ROUNDS);

export const passwordService = {
  hash(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  },

  compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  },

  compareAgainstHashOrDummy(password: string, hash: string | undefined): Promise<boolean> {
    return bcrypt.compare(password, hash ?? DUMMY_HASH);
  },
};
