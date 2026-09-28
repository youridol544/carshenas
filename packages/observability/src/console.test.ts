import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { routeConsoleToLogger } from './console.ts';
import { createLogger, type LogLevelSetting } from './logger.ts';

let restore: (() => void) | undefined;

afterEach(() => {
  restore?.();
  restore = undefined;
});

function route(options: Parameters<typeof routeConsoleToLogger>[1] = {}, level: LogLevelSetting = 'debug') {
  const raw: string[] = [];
  const logger = createLogger({
    service: 'carshenas-test',
    version: 'test',
    environment: 'test',
    level,
    destination: { write: (line) => raw.push(line) },
  });
  restore = routeConsoleToLogger(logger, options);
  return () => raw.map((line) => JSON.parse(line) as Record<string, unknown>);
}

test('console methods become log lines at matching levels, marked as console output', () => {
  const lines = route();
  console.debug('debug detail');
  console.log('plain log');
  console.info('information');
  console.warn('a warning');
  console.error('an error');
  assert.deepEqual(
    lines().map((line) => [line.level, line.msg, line.logger]),
    [
      ['debug', 'debug detail', 'console'],
      ['info', 'plain log', 'console'],
      ['info', 'information', 'console'],
      ['warn', 'a warning', 'console'],
      ['error', 'an error', 'console'],
    ],
  );
});

test('format arguments are applied as console would', () => {
  const lines = route();
  console.log('%s has %d listings', 'divar', 3);
  assert.equal(lines()[0]?.msg, 'divar has 3 listings');
});

test('an error argument becomes the serialised error, the rest the message', () => {
  const lines = route();
  console.error('⨯', new RangeError('page out of range'));
  console.error(new Error('alone'));
  const [prefixed, alone] = lines();
  assert.equal(prefixed?.msg, '⨯');
  assert.equal((prefixed.err as { type: string }).type, 'RangeError');
  assert.equal(alone?.msg, 'alone');
});

test('calls the ignore rule matches are dropped', () => {
  const lines = route({ ignore: (args) => args.some((arg) => arg instanceof Error && 'digest' in arg) });
  console.error('⨯', Object.assign(new Error('reported elsewhere'), { digest: '2847193056' }));
  console.error('kept');
  assert.deepEqual(
    lines().map((line) => line.msg),
    ['kept'],
  );
});

test('restoring puts the original methods back', () => {
  const original = console.warn;
  route();
  assert.notEqual(console.warn, original);
  restore?.();
  restore = undefined;
  assert.equal(console.warn, original);
});

test('a console call made while a line is being written goes to the original method', () => {
  const heard: unknown[][] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => heard.push(args);
  try {
    const logger = createLogger({
      service: 'carshenas-test',
      version: 'test',
      environment: 'test',
      destination: {
        write: () => {
          console.error('the destination itself printed');
        },
      },
    });
    restore = routeConsoleToLogger(logger);
    console.error('outer');
    assert.deepEqual(heard, [['the destination itself printed']]);
  } finally {
    restore?.();
    restore = undefined;
    console.error = originalError;
  }
});

test('routing twice wraps console once', () => {
  const lines = route();
  const second = routeConsoleToLogger(
    createLogger({
      service: 'other',
      version: 'test',
      environment: 'test',
      destination: { write: () => undefined },
    }),
  );
  console.info('once');
  second();
  console.info('still routed');
  assert.deepEqual(
    lines().map((line) => line.msg),
    ['once', 'still routed'],
  );
});
