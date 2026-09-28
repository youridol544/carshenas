import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { createServer as createHttpServer, type Server } from 'node:http';
import { createServer as createNetServer, type AddressInfo } from 'node:net';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { expect, test } from '../../fixtures/test';

// Logging and error reporting end to end (CS-30, ADR-0016). This spec starts its own production server from the
// build the suite made, with the diagnostics routes switched on, debug logging, an OpenTelemetry collector of its
// own and its standard output captured, then checks what a visitor sees against what the log says.

const REPOSITORY = fileURLToPath(new URL('../../..', import.meta.url));
const APP_DIR = path.join(REPOSITORY, 'apps', 'web');
const SECRET = 'not-a-real-secret';
const PHONE = '09120000000';
const MESSAGE = 'diagnostic failure on purpose';

type LogLine = Record<string, unknown>;

test.skip(
  Boolean(process.env.E2E_BASE_URL),
  'needs the production build this suite makes and its server output',
);
test.describe.configure({ mode: 'serial' });
// These tests make pages fail on purpose.
test.use({ failOnBrowserErrors: false });

let app: ChildProcess | undefined;
let collector: Server | undefined;
let base = '';
const output: string[] = [];
const errorOutput: string[] = [];
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

function collectLines(stream: Readable | null, into: string[]): void {
  let pending = '';
  stream?.on('data', (chunk: Buffer) => {
    const lines = (pending + chunk.toString()).split('\n');
    pending = lines.pop() ?? '';
    into.push(...lines.filter((line) => line.trim() !== ''));
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

/**
 * `file:line:` of the line of a file that contains `text`, as a mapped stack frame names it, read from the file
 * itself so that editing the file cannot make the check pass on a wrong line.
 */
function placeOf(file: string, text: string): string {
  const index = readFileSync(path.join(REPOSITORY, file), 'utf8')
    .split('\n')
    .findIndex((line) => line.includes(text));
  if (index === -1) throw new Error(`${file} has no line with ${text}`);
  return `${file}:${String(index + 1)}:`;
}

const BROWSER_FAILURES = 'apps/web/src/features/diagnostics/components/browser-failures.tsx';

/** The first `at …` line of a stack. */
function firstFrame(stack: string): string {
  return stack.split('\n').find((line) => line.trimStart().startsWith('at ')) ?? '';
}

/** The reference code the error screen shows, in Latin digits. */
async function shownReference(page: Page): Promise<string> {
  const line = page.getByText(/کد پیگیری/);
  await expect(line).toBeVisible();
  const text = (await line.textContent()) ?? '';
  return text.replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0)).replace(/\D/g, '');
}

test.beforeAll(async ({}, testInfo) => {
  // One production server is enough: the spec runs in the Android phone project only, whose browser report it reads
  // (Chrome's stack format, an Android user agent). Skipping here also keeps other projects from starting a server.
  test.skip(testInfo.project.name !== 'mobile', 'runs in the mobile project');
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
  collectLines(app.stdout, output);
  collectLines(app.stderr, errorOutput);
  await lineWhere((line) => line.msg === 'server started');
});

test.afterAll(async ({}, testInfo) => {
  app?.kill('SIGTERM');
  collector?.close();
  // What the server wrote, next to the other results, for reading a failure.
  await writeFile(testInfo.outputPath('server-output.log'), output.join('\n'));
  await writeFile(testInfo.outputPath('server-errors.log'), errorOutput.join('\n'));
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
  // The stack names the TypeScript file and line that threw, not a bundle, from the repository root.
  expect(firstFrame(err.stack)).toContain(
    placeOf('apps/web/src/app/diagnostics/[failure]/page.tsx', 'throw new Error(DIAGNOSTIC_MESSAGE)'),
  );

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

test('a failing Route Handler answers 500 with a Farsi message and a reference code; the log has the rest', async ({
  request,
}) => {
  const response = await request.get(`${base}/api/diagnostics`);
  expect(response.status()).toBe(500);
  expect(response.headers()['cache-control']).toBe('no-store');
  const text = await response.text();
  for (const leak of [MESSAGE, SECRET, 'route.ts']) expect(text).not.toContain(leak);
  const body = JSON.parse(text) as { message: string; reference: string };
  expect(body.message).toBe('مشکلی پیش آمد؛ دوباره امتحان کنید.');
  expect(body.reference).toMatch(/^\d{10}$/);
  const failed = await lineWhere(
    (line) => line.msg === 'request failed' && line.reference === body.reference,
  );
  expect(failed).toMatchObject({
    level: 'error',
    'next.route_type': 'route',
    'next.route_path': '/api/diagnostics',
    'http.request.method': 'GET',
    'url.path': '/api/diagnostics',
  });
  const { stack } = failed.err as { stack: string };
  expect(firstFrame(stack)).toContain(
    placeOf('apps/web/src/app/api/diagnostics/route.ts', 'throw new Error('),
  );
  // Every frame of the server build is mapped, awaited ones (`at async …`) included.
  expect(stack).not.toContain('/.next/server/');
  const errors = jsonLines().filter(
    (line) => line.level === 'error' && line['url.path'] === '/api/diagnostics',
  );
  expect(errors).toHaveLength(1);
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
  expect(firstFrame((failed.err as { stack: string }).stack)).toContain(
    placeOf('apps/web/src/features/diagnostics/diagnostics-actions.ts', 'throw new Error('),
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
  // Symbolicated with the build's browser source maps, on the line of our file that threw even though the React
  // Compiler rewrote the component.
  expect(firstFrame(err.stack)).toContain(placeOf(BROWSER_FAILURES, 'throw new TypeError('));
});

test('an uncaught error and an unhandled rejection in the browser reach the server log', async ({ page }) => {
  await page.goto(`${base}/diagnostics/browser`);
  await page.getByRole('button', { name: 'خطای مهارنشده' }).click();
  await page.getByRole('button', { name: 'وعده‌ی ردشده' }).click();
  const uncaught = await lineWhere((line) => line.msg === 'browser error' && line.kind === 'uncaught');
  const thrown = uncaught.err as { type: string; stack: string };
  expect(thrown.type).toBe('RangeError');
  expect(firstFrame(thrown.stack)).toContain(placeOf(BROWSER_FAILURES, 'throw new RangeError('));
  const rejection = await lineWhere(
    (line) => line.msg === 'browser error' && line.kind === 'unhandledrejection',
  );
  const rejected = rejection.err as { type: string; stack: string };
  expect(rejected.type).toBe('Error');
  expect(firstFrame(rejected.stack)).toContain(placeOf(BROWSER_FAILURES, 'Promise.reject('));
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

test('browser source maps are kept out of the served folder, and the server has them', async ({
  page,
  request,
}) => {
  await page.goto(`${base}/diagnostics/browser`);
  const chunk = await page.locator('script[src*="/_next/static/chunks/"]').first().getAttribute('src');
  const chunkUrl = new URL(chunk ?? '', base);
  const script = await request.get(chunkUrl.href);
  expect(script.status()).toBe(200);
  // Turbopack gives each map its own name; the chunk's last line says which.
  const mapName = /\/\/# sourceMappingURL=(\S+)\s*$/.exec(await script.text())?.[1];
  expect(mapName).toBeTruthy();
  const mapUrl = new URL(mapName ?? '', chunkUrl);
  const mapPath = decodeURIComponent(mapUrl.pathname).replace('/_next/static/', '');
  expect(existsSync(path.join(APP_DIR, '.next', 'browser-source-maps', mapPath))).toBe(true);
  expect((await request.get(mapUrl.href)).status()).toBe(404);
  // Not one map is left where it could be served, whatever serves that folder.
  const served = readdirSync(path.join(APP_DIR, '.next', 'static'), { recursive: true, encoding: 'utf8' });
  expect(served.filter((file) => file.endsWith('.map'))).toEqual([]);
});

test('a static file gets its completion line too, and one missing after a deploy is not quiet', async ({
  request,
}) => {
  const html = await (await request.get(`${base}/diagnostics/browser`)).text();
  const chunk = /\/_next\/static\/chunks\/[^"]+\.js/.exec(html)?.[0];
  expect(chunk).toBeTruthy();
  expect((await request.get(`${base}${chunk ?? ''}`)).status()).toBe(200);
  const served = await lineWhere((line) => line.msg === 'request completed' && line['url.path'] === chunk);
  expect(served).toMatchObject({
    level: 'debug',
    'http.response.status_code': 200,
    'http.request.method': 'GET',
  });
  const missing = '/_next/static/chunks/gone-after-deploy.js';
  expect((await request.get(`${base}${missing}`)).status()).toBe(404);
  const notFound = await lineWhere(
    (line) => line.msg === 'request completed' && line['url.path'] === missing,
  );
  expect(notFound).toMatchObject({ level: 'info', 'http.response.status_code': 404 });
  expect(String(notFound.trace_id)).toMatch(/^[0-9a-f]{32}$/);
});

test('every line after startup is one JSON object with time, level, message, service, version and environment', () => {
  // Everything the server has to say goes through the logger to standard output.
  expect(errorOutput).toEqual([]);
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
