import { env } from './config/env.js';
import { createApp } from './app.js';
import { runMigrations } from './db/migrate.js';
import { startPollingScheduler } from './polling/scheduler.js';

async function main() {
  await runMigrations();
  startPollingScheduler();

  const app = createApp();

  app.listen(env.PORT, () => {
    console.log(`ACM tracker backend listening on port ${env.PORT} (${env.NODE_ENV})`);
  });
}

main().catch((err) => {
  console.error('Failed to start backend:', err);
  process.exit(1);
});
