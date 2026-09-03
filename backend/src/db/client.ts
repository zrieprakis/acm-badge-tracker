import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { env } from '../config/env.js';
import * as schema from './schema.js';

mkdirSync(dirname(env.DB_PATH), { recursive: true });

export const libsqlClient: Client = createClient({ url: `file:${env.DB_PATH}` });
export const db = drizzle(libsqlClient, { schema });
