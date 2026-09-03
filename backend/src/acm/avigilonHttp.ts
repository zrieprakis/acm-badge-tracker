import https from 'node:https';
import { URL } from 'node:url';

export interface AvigilonHttpOptions {
  baseUrl: string;
  username: string;
  password: string;
  /** Avigilon ACM appliances typically use a self-signed cert; see env.ts. */
  rejectUnauthorized: boolean;
}

export interface AvigilonHttpResponse {
  status: number;
  body: string;
}

/**
 * Thin HTTP Basic Auth client for the Avigilon ACM REST API. ACM has no
 * separate login/session endpoint - credentials are sent on every request.
 * Paths are passed through as raw strings (not re-encoded via URL) since
 * ACM's own LDAP-filter query syntax uses characters like `(` and `)`
 * literally in the query string, exactly as shown in Avigilon's own sample
 * client code.
 */
export class AvigilonHttpClient {
  private readonly agent: https.Agent;
  private readonly authHeader: string;
  private readonly hostname: string;
  private readonly port: number;

  constructor(options: AvigilonHttpOptions) {
    const url = new URL(options.baseUrl);
    this.hostname = url.hostname;
    this.port = url.port ? Number(url.port) : 443;
    this.agent = new https.Agent({ rejectUnauthorized: options.rejectUnauthorized });
    this.authHeader = `Basic ${Buffer.from(`${options.username}:${options.password}`).toString('base64')}`;
  }

  get(pathAndQuery: string): Promise<AvigilonHttpResponse> {
    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: this.hostname,
          port: this.port,
          path: pathAndQuery,
          method: 'GET',
          agent: this.agent,
          headers: {
            Authorization: this.authHeader,
            'Content-Type': 'application/xml',
            Accept: 'application/xml',
          },
        },
        (res) => {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (chunk: string) => {
            body += chunk;
          });
          res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
        },
      );
      req.on('error', reject);
      req.end();
    });
  }
}
