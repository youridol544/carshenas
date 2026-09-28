import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { test } from 'node:test';
import { context, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { TracerProvider } from '@opentelemetry/sdk-trace';
import { withLogContext } from './context.ts';
import { createLogger, type LoggerOptions } from './logger.ts';
import { REDACTED } from './redact.ts';

type Line = Record<string, unknown>;

function capture(options: Partial<LoggerOptions> = {}) {
  const raw: string[] = [];
  const logger = createLogger({
    service: 'carshenas-test',
    version: 'abc1234',
    environment: 'test',
    destination: { write: (line) => raw.push(line) },
    ...options,
  });
  const lines = () => raw.map((line) => JSON.parse(line) as Line);
  return { logger, raw, lines };
}

test('a line is one JSON object with time, level name, message, service, version and environment', () => {
  const { logger, raw, lines } = capture();
  logger.info('snapshot stored', { listingId: 42 });
  const [written] = raw;
  assert.equal(raw.length, 1);
  assert.ok(written);
  assert.ok(written.endsWith('\n'));
  assert.equal(written.trimEnd().includes('\n'), false);
  const [line] = lines();
  assert.ok(line);
  assert.match(String(line.time), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.equal(line.level, 'info');
  assert.equal(line.msg, 'snapshot stored');
  assert.equal(line.service, 'carshenas-test');
  assert.equal(line.version, 'abc1234');
  assert.equal(line.env, 'test');
  assert.equal(line.pid, process.pid);
  assert.equal(line.listingId, 42);
});

test('the time is within a second of the system clock', () => {
  const { logger, lines } = capture();
  logger.info('now');
  const written = Date.parse(String(lines()[0]?.time));
  assert.ok(Math.abs(written - Date.now()) < 1_000);
});

test('lines below the level are not written, and silent writes nothing', () => {
  const quiet = capture({ level: 'warn' });
  quiet.logger.info('ignored');
  quiet.logger.warn('kept');
  assert.deepEqual(
    quiet.lines().map((line) => line.msg),
    ['kept'],
  );
  assert.equal(quiet.logger.isLevelEnabled('info'), false);
  const silent = capture({ level: 'silent' });
  silent.logger.fatal('nothing');
  assert.equal(silent.raw.length, 0);
});

test('fields and messages are redacted and errors serialised', () => {
  const { logger, lines } = capture();
  logger.error('seller 09121234567 could not be reached', {
    err: new Error('connect to postgres://web:hunter2@db/carshenas failed', {
      cause: new Error('ECONNREFUSED'),
    }),
    password: 'hunter2',
  });
  const [line] = lines();
  assert.ok(line);
  assert.equal(line.msg, `seller ${REDACTED} could not be reached`);
  assert.equal(line.password, REDACTED);
  const err = line.err as { type: string; message: string; cause: { message: string } };
  assert.equal(err.type, 'Error');
  assert.equal(err.message, `connect to postgres://web:${REDACTED}@db/carshenas failed`);
  assert.equal(err.cause.message, 'ECONNREFUSED');
  assert.doesNotMatch(JSON.stringify(line), /hunter2|09121234567/);
});

test('a child carries its bindings, the call overrides them, and no key is written twice', () => {
  const { logger, raw, lines } = capture();
  const db = logger.child({ component: 'db', source: 'divar' });
  db.warn('slow query', { source: 'bama', durationMs: 812 });
  const [line] = lines();
  assert.equal(line?.component, 'db');
  assert.equal(line.source, 'bama');
  assert.equal(raw[0]?.match(/"source":/g)?.length, 1);
});

test('fields of the surrounding log context appear on every line inside it', async () => {
  const { logger, lines } = capture();
  await withLogContext({ runId: 7, source: 'divar' }, async () => {
    await withLogContext({ page: 3 }, async () => {
      await Promise.resolve();
      logger.info('page fetched');
    });
  });
  logger.info('outside');
  const [inside, outside] = lines();
  assert.equal(inside?.runId, 7);
  assert.equal(inside.source, 'divar');
  assert.equal(inside.page, 3);
  assert.equal(outside?.runId, undefined);
});

test('a line written inside an active span carries its trace id, span id and flags', async () => {
  const contextManager = new AsyncLocalStorageContextManager().enable();
  context.setGlobalContextManager(contextManager);
  trace.setGlobalTracerProvider(new TracerProvider());
  try {
    const { logger, lines } = capture();
    const ids = await trace.getTracer('test').startActiveSpan('request', async (span) => {
      await Promise.resolve();
      logger.info('inside');
      span.end();
      return span.spanContext();
    });
    logger.info('outside');
    const [inside, outside] = lines();
    assert.equal(inside?.trace_id, ids.traceId);
    assert.equal(inside.span_id, ids.spanId);
    assert.equal(inside.trace_flags, '01');
    assert.match(ids.traceId, /^[0-9a-f]{32}$/);
    assert.equal(outside?.trace_id, undefined);
  } finally {
    trace.disable();
    context.disable();
  }
});

test('writing a line never reads Date, which Cache Components treats as dynamic input', (t) => {
  const { logger, lines } = capture();
  const RealDate = Date;
  const readClock = () => {
    throw new Error('the logger read the clock through Date');
  };
  // What Next.js watches during a prerender: Date(), new Date() and Date.now().
  const Watched = new Proxy(RealDate, {
    apply: readClock,
    construct: (target, args: unknown[]) => {
      if (args.length === 0) readClock();
      return Reflect.construct(target, args) as object;
    },
    get: (target, property, receiver): unknown =>
      property === 'now' ? readClock : Reflect.get(target, property, receiver),
  });
  t.after(() => {
    globalThis.Date = RealDate;
  });
  globalThis.Date = Watched;
  logger.info('rendering');
  globalThis.Date = RealDate;
  assert.equal(lines()[0]?.msg, 'rendering');
});

test('the pretty format writes readable lines for a person', () => {
  const raw: string[] = [];
  const logger = createLogger({
    service: 'carshenas-test',
    version: 'dev',
    environment: 'development',
    format: 'pretty',
    level: 'debug',
    // The pretty printer pipes into its destination, so it takes a real stream.
    destination: new Writable({
      write(chunk: Buffer, _encoding, done) {
        raw.push(chunk.toString());
        done();
      },
    }),
  });
  logger.debug('page fetched', { page: 3 });
  const text = raw.join('');
  assert.match(text, /DEBUG/);
  assert.match(text, /page fetched/);
  assert.match(text, /page: 3/);
  assert.throws(() => JSON.parse(text));
});
