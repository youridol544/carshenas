import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createErrorCapture, type CaptureContext } from './capture.ts';
import { createLogger } from './logger.ts';

function setup() {
  const raw: string[] = [];
  const logger = createLogger({
    service: 'carshenas-test',
    version: 'test',
    environment: 'test',
    destination: { write: (line) => raw.push(line) },
  });
  const lines = () => raw.map((line) => JSON.parse(line) as Record<string, unknown>);
  return { capture: createErrorCapture(logger), lines };
}

test('an error is logged once at error level with its message, tags, fields and serialised error', () => {
  const { capture, lines } = setup();
  capture.capture(new Error('listing 42 has no price'), {
    message: 'request failed',
    tags: { route: '/listings/[id]' },
    fields: { reference: '2847193056' },
  });
  const [line] = lines();
  assert.equal(lines().length, 1);
  assert.equal(line?.level, 'error');
  assert.equal(line.msg, 'request failed');
  assert.equal(line.route, '/listings/[id]');
  assert.equal(line.reference, '2847193056');
  assert.equal((line.err as { message: string }).message, 'listing 42 has no price');
});

test('without a message the line says unexpected error, and a warning is logged at warn', () => {
  const { capture, lines } = setup();
  capture.capture(new Error('first'));
  capture.capture(new Error('second'), { severity: 'warning' });
  assert.deepEqual(
    lines().map((line) => [line.level, line.msg]),
    [
      ['error', 'unexpected error'],
      ['warn', 'unexpected error'],
    ],
  );
});

test('every reporter receives the original error and context, and a failing reporter breaks nothing', async () => {
  const { capture, lines } = setup();
  const received: [unknown, CaptureContext][] = [];
  let flushedWithin: number | undefined;
  capture.addReporter({
    name: 'broken',
    capture: () => {
      throw new Error('sentry is unreachable');
    },
  });
  capture.addReporter({
    name: 'recording',
    capture: (error, context) => received.push([error, context]),
    flush: (timeoutMs) => {
      flushedWithin = timeoutMs;
      return Promise.resolve(true);
    },
  });
  const error = new Error('crawl run failed');
  assert.doesNotThrow(() => {
    capture.capture(error, { fingerprint: ['crawler', 'divar'] });
  });
  assert.equal(received[0]?.[0], error);
  assert.deepEqual(received[0][1].fingerprint, ['crawler', 'divar']);
  assert.deepEqual(
    lines().map((line) => line.msg),
    ['unexpected error', 'error reporter failed'],
  );
  await capture.flush(500);
  assert.equal(flushedWithin, 500);
});
