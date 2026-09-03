import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DB_PATH: z.string().default('./data/acm-tracker.db'),
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 characters'),
  ACM_CLIENT_MODE: z.enum(['mock', 'live']).default('mock'),
  ACM_BASE_URL: z.string().optional(),
  ACM_API_USERNAME: z.string().optional(),
  ACM_API_PASSWORD: z.string().optional(),
  // Avigilon ACM appliances typically present a self-signed certificate;
  // Avigilon's own sample REST client code disables verification for this
  // reason. Defaults to skipping verification - set to "true" once a
  // proper internal CA cert is installed on the appliance.
  ACM_TLS_REJECT_UNAUTHORIZED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  POLL_INTERVAL_SECONDS: z.coerce.number().int().positive().default(30),
  HISTORY_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment configuration:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
