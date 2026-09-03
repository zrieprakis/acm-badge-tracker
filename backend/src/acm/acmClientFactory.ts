import { env } from '../config/env.js';
import type { AcmClient } from './AcmClient.js';
import { MockAcmClient } from './MockAcmClient.js';
import { AvigilonAcmClient } from './AvigilonAcmClient.js';

let cachedClient: AcmClient | undefined;

export function getAcmClient(): AcmClient {
  if (cachedClient) return cachedClient;

  if (env.ACM_CLIENT_MODE === 'live') {
    if (!env.ACM_BASE_URL || !env.ACM_API_USERNAME || !env.ACM_API_PASSWORD) {
      throw new Error(
        'ACM_CLIENT_MODE=live requires ACM_BASE_URL, ACM_API_USERNAME, and ACM_API_PASSWORD to be set.',
      );
    }
    cachedClient = new AvigilonAcmClient({
      baseUrl: env.ACM_BASE_URL,
      username: env.ACM_API_USERNAME,
      password: env.ACM_API_PASSWORD,
      rejectUnauthorized: env.ACM_TLS_REJECT_UNAUTHORIZED,
    });
  } else {
    cachedClient = new MockAcmClient();
  }

  return cachedClient;
}
