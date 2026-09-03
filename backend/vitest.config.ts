import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    env: {
      SESSION_SECRET: 'test-secret-at-least-16-chars',
      DB_PATH: ':memory:',
      ACM_CLIENT_MODE: 'mock',
    },
  },
});
