import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer, get, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { context, SpanKind, SpanStatusCode, trace, TraceFlags, type Span } from '@opentelemetry/api';
import { InMemorySpanExporter } from '@opentelemetry/sdk-trace';
import { createLogger } from './logger.ts';
import { registerTracing, traceUntracedRequests, withSpan } from './tracing.ts';

const raw: string[] = [];
const logger = createLogger({
  service: 'carshenas-test',
  version: 'test',
  environment: 'test',
  level: 'debug',
  destination: { write: (line) => raw.push(line) },
});
const exporter = new InMemorySpanExporter();
const tracing = registerTracing({
  service: 'carshenas-test',
  version: 'test',
  environment: 'test',
  exporter,
  requestLog: { logger, isQuietPath: (path) => path.startsWith('/_next/static/') },
});

after(async () => {
  await tracing?.shutdown();
});

function takeLines() {
  const lines = raw.map((line) => JSON.parse(line) as Record<string, unknown>);
  raw.length = 0;
  return lines;
}

// A request span shaped like Next.js 16's root span (BaseServer.handleRequest).
function serveRequest(target: string, status: number, route: string, parent = context.active()) {
  const span = trace
    .getTracer('next.js')
    .startSpan(
      'GET',
      { kind: SpanKind.SERVER, attributes: { 'http.method': 'GET', 'http.target': target } },
      parent,
    );
  span.setAttributes({
    'http.status_code': status,
    'next.route': route,
    'next.rsc': target.includes('_rsc'),
  });
  span.end();
  return span.spanContext();
}

test('a second registration changes nothing', () => {
  assert.ok(tracing);
  assert.equal(registerTracing({ service: 'other', version: 'test', environment: 'test' }), undefined);
});

test('lines inside withSpan share its trace id, and its result is returned', async () => {
  takeLines();
  const result = await withSpan('crawl divar page', async (span) => {
    logger.info('page fetched');
    await Promise.resolve();
    logger.info('snapshot stored');
    return span.spanContext().traceId;
  });
  const lines = takeLines();
  assert.equal(lines.length, 2);
  assert.ok(lines.every((line) => line.trace_id === result));
});

test('a failure inside withSpan is rethrown and marks the span as failed with the exception', async () => {
  await assert.rejects(
    withSpan('crawl bama page', () => Promise.reject(new Error('403 from bama'))),
    /403 from bama/,
  );
  await tracing?.forceFlush();
  const span = exporter.getFinishedSpans().find((finished) => finished.name === 'crawl bama page');
  assert.equal(span?.status.code, SpanStatusCode.ERROR);
  assert.equal(span.events[0]?.name, 'exception');
  assert.equal(span.events[0].attributes?.['exception.message'], '403 from bama');
});

test('a finished request writes one line with method, path, query, route, status, duration and its trace id', () => {
  takeLines();
  const ids = serveRequest('/listings/42?_rsc=1a2b&sort=price', 200, '/listings/[id]');
  const [line, ...rest] = takeLines();
  assert.equal(rest.length, 0);
  assert.equal(line?.level, 'info');
  assert.equal(line.msg, 'request completed');
  assert.equal(line['http.request.method'], 'GET');
  assert.equal(line['url.path'], '/listings/42');
  assert.equal(line['url.query'], 'sort=price');
  assert.equal(line['http.route'], '/listings/[id]');
  assert.equal(line['http.response.status_code'], 200);
  assert.equal(typeof line.duration_ms, 'number');
  assert.equal(line['next.rsc'], true);
  assert.equal(line.trace_id, ids.traceId);
  assert.equal(line.span_id, ids.spanId);
});

test('a server error is a warning, a quiet path is debug, and a nested server span writes nothing', () => {
  takeLines();
  serveRequest('/search', 500, '/search');
  serveRequest('/_next/static/chunks/app.js', 200, '/_next/static/[...path]');
  const outer = trace.getTracer('next.js').startSpan('GET', { kind: SpanKind.SERVER });
  serveRequest('/inner', 200, '/inner', trace.setSpan(context.active(), outer));
  outer.end();
  assert.deepEqual(
    takeLines().map((line) => [line.level, line['url.path'], line['http.response.status_code']]),
    [
      ['warn', '/search', 500],
      ['debug', '/_next/static/chunks/app.js', 200],
      ['info', undefined, undefined],
    ],
  );
});

test('a request under a remote parent (a proxy that propagates traceparent) still writes its line', () => {
  takeLines();
  const remote = trace.wrapSpanContext({
    traceId: '0af7651916cd43dd8448eb211c80319c',
    spanId: 'b7ad6b7169203331',
    traceFlags: TraceFlags.SAMPLED,
    isRemote: true,
  });
  serveRequest('/listings/7', 200, '/listings/[id]', trace.setSpan(context.active(), remote));
  const [line] = takeLines();
  assert.equal(line?.trace_id, '0af7651916cd43dd8448eb211c80319c');
});

test('a trace id that starts like a mobile number is written as it is, so the lines of a request still join', () => {
  takeLines();
  // 1 random trace id in about 4,650 did this: 98 9811836575 reads as an Iranian number with its country code.
  const traceId = '989811836575e82d0af7651916cd43dd';
  const remote = trace.wrapSpanContext({
    traceId,
    spanId: 'b7ad6b7169203331',
    traceFlags: TraceFlags.SAMPLED,
    isRemote: true,
  });
  const served = serveRequest('/listings/7', 200, '/listings/[id]', trace.setSpan(context.active(), remote));
  const [line] = takeLines();
  assert.equal(line?.trace_id, traceId);
  assert.equal(line.span_id, served.spanId);
  assert.equal(line.trace_flags, '01');
});

async function until(condition: () => boolean): Promise<void> {
  for (let waited = 0; !condition(); waited += 10) {
    if (waited > 2000) throw new Error('timed out waiting');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

test('a request answered before any traced code still gets its line, and a traced one only its own', async () => {
  traceUntracedRequests();
  traceUntracedRequests();
  const server = createServer((request, response) => {
    if (request.url === '/listings/7') {
      // The framework's root span, as Next.js starts one for a page.
      const span = trace.getTracer('next.js').startSpan('GET /listings/[id]', {
        kind: SpanKind.SERVER,
        attributes: { 'http.method': 'GET', 'http.target': request.url },
      });
      span.setAttributes({ 'http.status_code': 200, 'next.route': '/listings/[id]' });
      response.end('ok');
      span.end();
      return;
    }
    // Static files the framework serves itself: one it has, one missing after a deploy.
    response.statusCode = request.url === '/_next/static/chunks/app.js' ? 200 : 404;
    response.end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  takeLines();
  try {
    for (const target of ['/listings/7', '/_next/static/chunks/app.js', '/_next/static/chunks/gone.js']) {
      await (await fetch(`http://127.0.0.1:${String(port)}${target}`)).text();
    }
    await until(() => raw.length >= 3);
  } finally {
    server.close();
    server.closeAllConnections();
  }
  const lines = takeLines();
  assert.equal(lines.length, 3);
  const line = (path: string) => lines.find((entry) => entry['url.path'] === path);
  assert.equal(line('/listings/7')?.['http.route'], '/listings/[id]');
  assert.equal(line('/_next/static/chunks/app.js')?.level, 'debug');
  // A quiet path that answered an error is not quiet.
  assert.equal(line('/_next/static/chunks/gone.js')?.level, 'info');
  assert.equal(line('/_next/static/chunks/gone.js')?.['http.response.status_code'], 404);
  for (const entry of lines) {
    assert.equal(entry.msg, 'request completed');
    assert.match(String(entry.trace_id), /^[0-9a-f]{32}$/);
    assert.equal(typeof entry.duration_ms, 'number');
  }
});

/** Serves `handle` on a free port, requests `target`, and leaves as soon as the server has the request. */
async function leaveEarly(handle: (arrived: () => void) => void, target: string): Promise<Server> {
  let arrived = (): void => undefined;
  const arrival = new Promise<void>((resolve) => (arrived = resolve));
  const server = createServer(() => {
    handle(arrived);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const visitor = get(`http://127.0.0.1:${String(port)}${target}`);
  visitor.on('error', () => undefined);
  await arrival;
  visitor.destroy();
  return server;
}

/** The framework's root span, as Next.js starts one: its route and status are set when it ends. */
function frameworkSpan(target: string): Span {
  return trace.getTracer('next.js').startSpan(`GET ${target}`, {
    kind: SpanKind.SERVER,
    attributes: { 'http.method': 'GET', 'http.target': target },
  });
}

function frameworkEnd(span: Span, route: string): void {
  span.setAttributes({ 'next.route': route, 'http.status_code': 200 });
  span.end();
}

test('a visitor who leaves while the framework answers gets its line when the framework is done, marked', async () => {
  traceUntracedRequests({ abandonedAfterMs: 10_000 });
  takeLines();
  let open: Span | undefined;
  const server = await leaveEarly((arrived) => {
    open = frameworkSpan('/api/slow');
    arrived();
  }, '/api/slow');
  await new Promise((resolve) => setTimeout(resolve, 50));
  // Marked, not ended: nothing is written until the framework ends its span.
  assert.equal(raw.length, 0);
  if (open) frameworkEnd(open, '/api/slow');
  await until(() => raw.length >= 1);
  server.close();
  server.closeAllConnections();
  const [line, ...more] = takeLines();
  assert.equal(more.length, 0);
  assert.ok(line);
  assert.equal(line.clientAborted, true);
  assert.equal(line['http.route'], '/api/slow');
  assert.equal(line.trace_id, open?.spanContext().traceId);
});

test('a span the framework never ends after its visitor left is ended after the grace period', async () => {
  traceUntracedRequests({ abandonedAfterMs: 100 });
  takeLines();
  let open: Span | undefined;
  const server = await leaveEarly((arrived) => {
    // Next.js 16.3.5 sometimes never ends this span once the visitor has left.
    open = frameworkSpan('/api/stuck');
    arrived();
  }, '/api/stuck');
  await until(() => raw.length >= 1);
  // The framework's end, if it ever comes, writes nothing more.
  if (open) frameworkEnd(open, '/api/stuck');
  await new Promise((resolve) => setTimeout(resolve, 50));
  server.close();
  server.closeAllConnections();
  traceUntracedRequests();
  const [line, ...more] = takeLines();
  assert.equal(more.length, 0);
  assert.ok(line);
  assert.equal(line.clientAborted, true);
  assert.equal(line['url.path'], '/api/stuck');
  assert.equal(line['http.response.status_code'], undefined);
  assert.equal(line.trace_id, open?.spanContext().traceId);
  // It lasted until the visitor left, not until the grace period ran out.
  assert.ok(Number(line.duration_ms) < 100, String(line.duration_ms));
});

test('a visitor who leaves before the framework starts its span gets one line, not two', async () => {
  traceUntracedRequests();
  takeLines();
  let late: Span | undefined;
  const server = await leaveEarly((arrived) => {
    arrived();
    setTimeout(() => {
      late = frameworkSpan('/late');
      frameworkEnd(late, '/late');
    }, 100);
  }, '/late');
  await until(() => late !== undefined);
  await new Promise((resolve) => setTimeout(resolve, 50));
  server.close();
  server.closeAllConnections();
  const [line, ...more] = takeLines();
  assert.equal(more.length, 0);
  assert.ok(line);
  assert.equal(line['url.path'], '/late');
  assert.equal(line.clientAborted, true);
});

test('setting OTEL_EXPORTER_OTLP_ENDPOINT alone sends spans to a collector', async () => {
  const bodies: string[] = [];
  const collector = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk: Buffer) => (body += chunk.toString()));
    request.on('end', () => {
      bodies.push(`${request.method ?? ''} ${request.url ?? ''} ${body}`);
      response.writeHead(200, { 'content-type': 'application/json' }).end('{}');
    });
  });
  await new Promise<void>((resolve) => collector.listen(0, '127.0.0.1', resolve));
  const { port } = collector.address() as AddressInfo;
  try {
    const worker = spawn(
      process.execPath,
      [
        '--experimental-strip-types',
        '--no-warnings=ExperimentalWarning',
        fileURLToPath(new URL('fixtures/export-one-span.ts', import.meta.url)),
      ],
      { env: { OTEL_EXPORTER_OTLP_ENDPOINT: `http://127.0.0.1:${port}` }, stdio: 'inherit' },
    );
    const code = await new Promise<number | null>((resolve) => worker.on('exit', resolve));
    assert.equal(code, 0);
  } finally {
    collector.close();
  }
  assert.equal(bodies.length, 1);
  assert.match(bodies[0] ?? '', /^POST \/v1\/traces /);
  assert.match(bodies[0] ?? '', /"crawl divar page"/);
  assert.match(bodies[0] ?? '', /"service\.name","value":\{"stringValue":"carshenas-worker"\}/);
});
