import { createServer, type Server } from 'node:http';
import type { HealthReport } from './health.ts';

// GET /health on the loopback interface, for a supervisor (Docker's healthcheck, systemd) and for
// `pnpm worker:health`: 200 with the report when the worker can work, 503 when it cannot. Nothing else is served.

export type HealthServer = { readonly port: number; close(): Promise<void> };

export async function startHealthServer(
  port: number,
  check: () => Promise<HealthReport>,
): Promise<HealthServer> {
  const server: Server = createServer((request, response) => {
    if (request.method !== 'GET' || request.url !== '/health') {
      response.writeHead(404, { 'content-type': 'application/json' }).end('{"status":"not found"}');
      return;
    }
    check().then(
      (report) => {
        response
          .writeHead(report.status === 'ok' ? 200 : 503, {
            'content-type': 'application/json',
            'cache-control': 'no-store',
          })
          .end(JSON.stringify(report));
      },
      () => {
        response.writeHead(503, { 'content-type': 'application/json' }).end('{"status":"unavailable"}');
      },
    );
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  return {
    port: typeof address === 'object' && address ? address.port : port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      }),
  };
}
