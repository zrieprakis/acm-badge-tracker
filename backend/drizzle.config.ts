import { defineConfig } from 'drizzle-kit';

// Reads DB_PATH directly from process.env rather than the app's zod-validated
// env module, so `drizzle-kit generate` doesn't require the full runtime
// config (e.g. SESSION_SECRET) to be set.
const dbPath = process.env.DB_PATH ?? './data/acm-tracker.db';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dbCredentials: {
    url: `file:${dbPath}`,
  },
});
