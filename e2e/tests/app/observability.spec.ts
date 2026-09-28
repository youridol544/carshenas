import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { createServer as createHttpServer, type Server } from 'node:http';
import { createServer as createNetServer, type AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { expect, test } from '../../fixtures/test';

// Logging and error reporting end to end (CS-30, ADR-0016). This spec starts its own production server from the
// build the suite made, with the diagnostics routes switched on, debug logging, an OpenTelemetry collector of its
// own and its standard output captured, then checks what a visitor sees against what the log says.

const APP_DIR = fileURLToPath(new URL('../../../apps/web', import.meta.url));
const SECRET = 'not-a-real-secret';
const PHONE = '09120000000';
const MESSAGE = 'diagnostic failure on purpose';

type LogLine = Record<string, unknown>;

test.skip(
  Boolean(process.env.E2E_BASE_URL),
  'needs the production build this suite makes and its server output',
);
test.skip(({ isMobile }) => !isMobile, 'one production server is enough; it runs in the phone project');
test.describe.configure({ mode: 'serial' });
// These tests make pages fail on purpose.
test.use({ failOnBrowserErrors: false });

let app: ChildProcess | undefined;
let collector: Server | undefined;
let base = '';
const output: string[] = [];
const traceExports: string[] = [];

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createNetServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as AddressInfo;
      probe.close(() => {
        resolve(port);
      });
    });
  });
}

function jsonLines(): LogLine[] {
  return output.filter((line) => line.startsWith('{')).map((line) => JSON.parse(line) as LogLine);
}

async function lineWhere(matches: (line: LogLine) => boolean): Promise<LogLine> {
  let found: LogLine | undefined;
  await expect.poll(() => (found = jsonLines().find(matches)), { timeout: 10_000 }).toBeTruthy();
  if (!found) throw new Error('no such log line');
  return found;
}

/** The reference code the error screen shows, in Latin digits. */
async function shownReference(page: Page): Promise<string> {
  const line = page.getByText(/کد پیگیری/);
  await expect(line).toBeVisible();
  const text = (await line.textContent()) ?? '';
  return text.replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0)).replace(/\D/g, '');
}

test.beforeAll(async () => {
  if (!existsSync(path.join(APP_DIR, '.next', 'BUILD_ID')))
    throw new Error('apps/web has no production build');
  collector = createHttpServer((request, response) => {
    let body = '';
    request.on('data', (chunk: Buffer) => (body += chunk.toString()));
    request.on('end', () => {
      traceExports.push(`${request.url ?? ''} ${body}`);
      response.writeHead(200, { 'content-type': 'application/json' }).end('{}');
    });
  });
  const collectorPort = await freePort();
  await new Promise<void>((resolve) => collector?.listen(collectorPort, '127.0.0.1', resolve));
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--port', String(port)], {
    cwd: APP_DIR,
    env: {
      ...process.env,
      CARSHENAS_DIAGNOSTICS: '1',
      LOG_LEVEL: 'debug',
      OTEL_EXPORTER_OTLP_ENDPOINT: `http://127.0.0.1:${collectorPort}`,
      NEXT_TELEMETRY_DISABLED: '1',
    },
  });
  let pending = '';
  app.stdout?.on('data', (chunk: Buffer) => {
    const text = pending + chunk.toString();
    const lines = text.split('\n');
    pending = lines.pop() ?? '';
    output.push(...lines.filter((line) => line.trim() !== ''));
  });
  await lineWhere((line) => line.msg === 'server started');
});

test.afterAll(async ({}, testInfo) => {
  app?.kill('SIGTERM');
  collector?.close();
  // What the server wrote, next to the other results, for reading a failure.
  await writeFile(testInfo.outputPath('server-output.log'), output.join('\n'));
});

test('a failing page shows only the Farsi error screen and its reference code; the log has the rest', async ({
  page,
  rtl,
  a11y,
}) => {
  await page.goto(`${base}/diagnostics/server-render`);
  // Next.js streams the page, so the status is sent before the page throws (the bundled streaming guide, "The HTTP
  // contract"): the error screen is kept out of search results with noindex instead.
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('مشکلی پیش آمد');
  const reference = await shownReference(page);
  await rtl.expectDocumentRtl();
  await rtl.expectPersianDigits(page.getByRole('main'));
  await rtl.expectNoHorizontalOverflow();
  await a11y.check();
  const html = await page.content();
  for (const leak of [MESSAGE, SECRET, PHONE, 'page.tsx']) expect(html).not.toContain(leak);

  const failed = await lineWhere(
    (line) => line.msg === 'request failed' && line['url.path'] === '/diagnostics/server-render',
  );
  expect(failed).toMatchObject({
    level: 'error',
    reference,
    'http.request.method': 'GET',
    'next.route_type': 'render',
    service: 'carshenas-web',
  });
  const err = failed.err as { type: string; message: string; stack: string };
  expect(err.message).toContain(MESSAGE);
  expect(err.message).toContain('[redacted]');
  expect(JSON.stringify(failed)).not.toContain(SECRET);
  expect(JSON.stringify(failed)).not.toContain(PHONE);
  // The stack names the TypeScript file and line that threw, not a bundle.
  expect(err.stack).toMatch(/src\/app\/diagnostics\/\[failure\]\/page\.tsx:\d+:\d+/);

  const completed = await lineWhere(
    (line) => line.msg === 'request completed' && line['url.path'] === '/diagnostics/server-render',
  );
  // The browser already had its status when the page threw; the completion line records the failure as a 500.
  expect(completed['http.response.status_code']).toBe(500);
  expect(completed.level).toBe('warn');
  expect(completed['http.route']).toBe('/diagnostics/[failure]');
  expect(typeof completed.duration_ms).toBe('number');
  expect(completed.trace_id).toBe(failed.trace_id);
  // One error line for the failure: Next.js's own print of it is dropped.
  const errors = jsonLines().filter(
    (line) => line.level === 'error' && JSON.stringify(line).includes('/diagnostics/server-render'),
  );
  expect(errors).toHaveLength(1);
});

test('a failing Route Handler answers 500 without a body, and the log has the error', async ({ request }) => {
  const response = await request.get(`${base}/api/diagnostics`);
  expect(response.status()).toBe(500);
  const body = await response.text();
  for (const leak of [MESSAGE, SECRET, 'route.ts']) expect(body).not.toContain(leak);
  const failed = await lineWhere(
    (line) => line.msg === 'request failed' && line['url.path'] === '/api/diagnostics',
  );
  expect(failed).toMatchObject({ level: 'error', 'next.route_type': 'route', 'http.request.method': 'GET' });
  expect((failed.err as { stack: string }).stack).toMatch(/src\/app\/api\/diagnostics\/route\.ts:\d+:\d+/);
});

test('a failing Server Action shows the error screen, and the log line carries the same reference', async ({
  page,
}) => {
  await page.goto(`${base}/diagnostics/server-action`);
  await page.getByRole('button', { name: 'خطا در کار سرور' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('مشکلی پیش آمد');
  const reference = await shownReference(page);
  const failed = await lineWhere((line) => line.msg === 'request failed' && line.reference === reference);
  expect(failed).toMatchObject({ 'next.route_type': 'action', 'http.request.method': 'POST' });
  expect((failed.err as { stack: string }).stack).toMatch(
    /src\/features\/diagnostics\/diagnostics-actions\.ts:\d+:\d+/,
  );
});

test('an error while rendering in the browser reaches the server log with the reference the screen shows', async ({
  page,
  rtl,
}) => {
  await page.goto(`${base}/diagnostics/browser`);
  await page.getByRole('button', { name: 'خطا هنگام نمایش' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('مشکلی پیش آمد');
  const reference = await shownReference(page);
  expect(reference).toMatch(/^\d{10}$/);
  await rtl.expectPersianDigits(page.getByRole('main'));
  const reported = await lineWhere((line) => line.msg === 'browser error' && line.reference === reference);
  expect(reported).toMatchObject({
    level: 'error',
    source: 'browser',
    kind: 'boundary',
    'url.path': '/diagnostics/browser',
  });
  expect(String(reported['user_agent.original'])).toContain('Android');
  const err = reported.err as { type: string; message: string; stack: string };
  expect(err.type).toBe('TypeError');
  expect(JSON.stringify(reported)).not.toContain(SECRET);
  // Symbolicated with the build's browser source maps.
  expect(err.stack).toMatch(/src\/features\/diagnostics\/components\/browser-failures\.tsx:\d+:\d+/);
});

test('an uncaught error and an unhandled rejection in the browser reach the server log', async ({ page }) => {
  await page.goto(`${base}/diagnostics/browser`);
  await page.getByRole('button', { name: 'خطای مهارنشده' }).click();
  await page.getByRole('button', { name: 'وعده‌ی ردشده' }).click();
  const uncaught = await lineWhere((line) => line.msg === 'browser error' && line.kind === 'uncaught');
  expect((uncaught.err as { type: string }).type).toBe('RangeError');
  const rejection = await lineWhere(
    (line) => line.msg === 'browser error' && line.kind === 'unhandledrejection',
  );
  expect((rejection.err as { type: string }).type).toBe('Error');
});

test('the browser error intake refuses reports from other sites, oversized bodies and malformed reports', async ({
  request,
}) => {
  const valid = {
    kind: 'uncaught',
    reference: '1234567890',
    path: '/',
    error: { type: 'Error', message: 'x' },
  };
  const post = (data: unknown, headers: Record<string, string> = {}) =>
    request.post(`${base}/api/client-errors`, {
      data,
      headers: { 'sec-fetch-site': 'same-origin', ...headers },
    });
  expect((await post(valid, { 'sec-fetch-site': 'cross-site' })).status()).toBe(403);
  expect((await post({ ...valid, error: { type: 'Error', message: 'x'.repeat(40_000) } })).status()).toBe(
    413,
  );
  expect((await post({ ...valid, reference: 'abc' })).status()).toBe(400);
  expect((await post(valid)).status()).toBe(204);
});

test('browser source maps exist on the server but are never served', async ({ page, request }) => {
  await page.goto(`${base}/diagnostics/browser`);
  const chunk = await page.locator('script[src*="/_next/static/chunks/"]').first().getAttribute('src');
  const chunkUrl = new URL(chunk ?? '', base);
  const script = await request.get(chunkUrl.href);
  expect(script.status()).toBe(200);
  // Turbopack gives each map its own name; the chunk's last line says which.
  const mapName = /\/\/# sourceMappingURL=(\S+)\s*$/.exec(await script.text())?.[1];
  expect(mapName).toBeTruthy();
  const mapUrl = new URL(mapName ?? '', chunkUrl);
  expect(
    existsSync(path.join(APP_DIR, '.next', decodeURIComponent(mapUrl.pathname).replace('/_next/', ''))),
  ).toBe(true);
  expect((await request.get(mapUrl.href)).status()).toBe(404);
});

test('every line after startup is one JSON object with time, level, message, service, version and environment', () => {
  const started = output.findIndex((line) => line.includes('"msg":"server started"'));
  expect(started).toBeGreaterThanOrEqual(0);
  const afterStartup = output.slice(started);
  expect(afterStartup.length).toBeGreaterThan(10);
  for (const text of afterStartup) {
    const line = JSON.parse(text) as LogLine;
    expect(String(line.time)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).toContain(line.level);
    expect(typeof line.msg).toBe('string');
    expect(line.service).toBe('carshenas-web');
    expect(String(line.version)).toMatch(/^[0-9a-f]{12}(-dirty)?$/);
    expect(line.env).toBe('production');
  }
});

test('setting OTEL_EXPORTER_OTLP_ENDPOINT alone exports the request spans', async () => {
  await expect
    .poll(
      () => traceExports.some((body) => body.includes('carshenas-web') && body.includes('/diagnostics/')),
      {
        timeout: 15_000,
      },
    )
    .toBe(true);
  expect(traceExports[0]).toMatch(/^\/v1\/traces /);
});
