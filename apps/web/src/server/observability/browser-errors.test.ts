// @vitest-environment node
import type { BrowserErrorReport } from '@carshenas/observability/browser';
import type { SourceMapLookup } from '@carshenas/observability/stack';
import { beforeEach, expect, test, vi } from 'vitest';
import { createBrowserErrorIntake } from '@/server/observability/browser-errors';
import { recordedLines } from '@/server/observability/recording-logger';

vi.mock('@/server/observability/logger', async () => {
  const { recordingLogger } = await import('@/server/observability/recording-logger');
  return { logger: recordingLogger() };
});

beforeEach(() => {
  recordedLines.length = 0;
});

const CHUNK = 'https://carshenas.ir/_next/static/chunks/0a1b2c.js';

function report(overrides: Partial<BrowserErrorReport> = {}): BrowserErrorReport {
  return {
    kind: 'boundary',
    reference: '4827301956',
    path: '/listings/42?from=search',
    error: {
      type: 'TypeError',
      message: "Cannot read properties of undefined (reading 'price')",
      stack: `TypeError: Cannot read properties of undefined (reading 'price')\n    at a (${CHUNK}:1:2345)`,
    },
    ...overrides,
  };
}

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request('https://carshenas.ir/api/client-errors', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

// A lookup that maps the one chunk frame to the listing card's source, as the build's source maps would.
const sourceMaps = (): Promise<SourceMapLookup> =>
  Promise.resolve((file) =>
    file === CHUNK
      ? {
          map: {
            findOrigin: () => ({
              name: undefined,
              fileName: 'turbopack:///[project]/apps/web/src/features/listings/components/listing-card.tsx',
              lineNumber: 42,
              columnNumber: 17,
            }),
          },
          directory: '/srv',
        }
      : undefined,
  );

function intake(options: Parameters<typeof createBrowserErrorIntake>[0] = {}) {
  let now = 0;
  const receive = createBrowserErrorIntake({ now: () => now, sourceMaps, ...options });
  return {
    receive,
    advance: (milliseconds: number) => {
      now += milliseconds;
    },
  };
}

test('a report is logged once as a browser error with its page, reference, browser and source-mapped stack', async () => {
  const { receive } = intake();
  const response = await receive(post(report(), { 'user-agent': 'Mozilla/5.0 (Linux; Android 14)' }));
  expect(response.status).toBe(204);
  expect(recordedLines).toHaveLength(1);
  const [line] = recordedLines;
  expect(line).toMatchObject({
    level: 'error',
    message: 'browser error',
    fields: {
      source: 'browser',
      kind: 'boundary',
      reference: '4827301956',
      'url.path': '/listings/42',
      'url.query': 'from=search',
      'user_agent.original': 'Mozilla/5.0 (Linux; Android 14)',
      err: { type: 'TypeError' },
    },
  });
  expect(JSON.stringify(line?.fields.err)).toContain(
    'at a (apps/web/src/features/listings/components/listing-card.tsx:42:17)',
  );
});

test('a report from another site is refused and not logged', async () => {
  const response = await intake().receive(post(report(), { 'sec-fetch-site': 'cross-site' }));
  expect(response.status).toBe(403);
  expect(recordedLines).toEqual([]);
});

test('a body over the limit is refused, whether it declares its length or not', async () => {
  const { receive } = intake({ maxBodyBytes: 1_000 });
  const huge = JSON.stringify(report({ error: { type: 'Error', message: 'x'.repeat(2_000) } }));
  expect((await receive(post(huge))).status).toBe(413);
  const streamed = new Request('https://carshenas.ir/api/client-errors', {
    method: 'POST',
    headers: { 'sec-fetch-site': 'same-origin' },
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(huge));
        controller.close();
      },
    }),
    duplex: 'half',
  } as RequestInit);
  expect((await receive(streamed)).status).toBe(413);
  expect(recordedLines).toEqual([]);
});

test('a body that is not JSON, or not a report, is refused', async () => {
  const { receive } = intake();
  for (const body of [
    'not json',
    { ...report(), reference: '123' },
    { ...report(), path: 'https://elsewhere.example/page' },
    { ...report(), kind: 'console' },
    { kind: 'uncaught', reference: '4827301956', path: '/' },
  ]) {
    expect((await receive(post(body))).status).toBe(400);
  }
  expect(recordedLines).toEqual([]);
});

test('the same bug reported again within a minute is counted, not logged, and the count is logged later', async () => {
  const { receive, advance } = intake();
  for (let visitor = 0; visitor < 5; visitor += 1) {
    expect((await receive(post(report({ reference: `482730195${String(visitor)}` })))).status).toBe(204);
  }
  expect(recordedLines.map((line) => line.message)).toEqual(['browser error']);
  advance(60_000);
  await receive(post(report()));
  expect(recordedLines.map((line) => [line.level, line.message])).toEqual([
    ['error', 'browser error'],
    ['warn', 'browser error reports dropped'],
    ['error', 'browser error'],
  ]);
  expect(recordedLines[1]?.fields).toMatchObject({ repeated: 4, overLimit: 0, windowSeconds: 60 });
});

test('no more than the limit of different reports is logged in a minute', async () => {
  const { receive, advance } = intake({ maxPerWindow: 3 });
  for (let bug = 0; bug < 10; bug += 1) {
    await receive(post(report({ error: { type: 'Error', message: `bug ${'x'.repeat(bug)}` } })));
  }
  expect(recordedLines).toHaveLength(3);
  advance(60_000);
  await receive(post(report()));
  expect(recordedLines[3]).toMatchObject({
    message: 'browser error reports dropped',
    fields: { overLimit: 7 },
  });
});
