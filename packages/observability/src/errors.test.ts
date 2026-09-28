import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { errorFingerprint, isError, serializeError } from './errors.ts';
import { REDACTED } from './redact.ts';

test('an error keeps its type, message and stack', () => {
  const serialized = serializeError(new TypeError('price is undefined'));
  assert.equal(serialized.type, 'TypeError');
  assert.equal(serialized.message, 'price is undefined');
  assert.match(serialized.stack ?? '', /^TypeError: price is undefined\n\s+at /);
});

test('a subclass without its own name reports its class name', () => {
  class SourceBlockedError extends Error {}
  assert.equal(serializeError(new SourceBlockedError('403 from divar')).type, 'SourceBlockedError');
});

test('the whole cause chain is kept, as a failed fetch hides its network error in its cause', () => {
  const network = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5418'), {
    code: 'ECONNREFUSED',
    errno: -111,
    syscall: 'connect',
  });
  const fetchFailed = new TypeError('fetch failed', { cause: network });
  const { cause } = serializeError(new Error('crawl page 3 failed', { cause: fetchFailed }));
  assert.ok(cause);
  assert.equal(cause.type, 'TypeError');
  assert.equal(cause.message, 'fetch failed');
  assert.ok(cause.cause);
  const { type, code, errno, syscall } = cause.cause;
  assert.deepEqual(
    { type, code, errno, syscall },
    { type: 'Error', code: 'ECONNREFUSED', errno: -111, syscall: 'connect' },
  );
});

test('an AggregateError keeps its members', () => {
  const serialized = serializeError(
    new AggregateError(
      [new Error('divar timed out'), new RangeError('bama page out of range')],
      'two sources failed',
    ),
  );
  assert.equal(serialized.type, 'AggregateError');
  assert.deepEqual(
    serialized.errors?.map((member) => [member.type, member.message]),
    [
      ['Error', 'divar timed out'],
      ['RangeError', 'bama page out of range'],
    ],
  );
});

test('own fields with primitive values are kept, objects and functions are not', () => {
  const error = Object.assign(new Error('duplicate key value violates unique constraint'), {
    code: '23505',
    constraint: 'listing_source_key_unique',
    digest: '2847193056',
    retryable: false,
    count: 3n,
    response: { body: 'a large object' },
    retry: () => undefined,
  });
  const serialized = serializeError(error);
  assert.equal(serialized.code, '23505');
  assert.equal(serialized.constraint, 'listing_source_key_unique');
  assert.equal(serialized.digest, '2847193056');
  assert.equal(serialized.retryable, false);
  assert.equal(serialized.count, '3');
  assert.equal('response' in serialized, false);
  assert.equal('retry' in serialized, false);
});

test('secrets are redacted from the message, the stack and sensitive fields', () => {
  const error = Object.assign(new Error('cannot connect to postgres://web:hunter2@db:5432/carshenas'), {
    password: 'hunter2',
    detail: 'seller 09121234567 exists',
  });
  const serialized = serializeError(error);
  assert.equal(serialized.message, `cannot connect to postgres://web:${REDACTED}@db:5432/carshenas`);
  assert.doesNotMatch(serialized.stack ?? '', /hunter2/);
  assert.equal(serialized.password, REDACTED);
  assert.equal(serialized.detail, `seller ${REDACTED} exists`);
});

test('a cause chain that loops ends instead of recursing forever', () => {
  const first = new Error('first');
  const second = new Error('second', { cause: first });
  (first as { cause?: unknown }).cause = second;
  const { cause } = serializeError(first);
  assert.ok(cause);
  assert.equal(cause.message, 'second');
  assert.equal(cause.cause?.type, 'Circular');
});

test('a very deep cause chain is cut after five levels', () => {
  let error = new Error('level 0');
  for (let level = 1; level <= 20; level += 1) error = new Error(`level ${level}`, { cause: error });
  let depth = 0;
  for (let current = serializeError(error).cause; current; current = current.cause) depth += 1;
  assert.equal(depth, 5);
});

test('values that are not errors keep what they said', () => {
  assert.deepEqual(serializeError('boom'), { type: 'string', message: 'boom' });
  assert.deepEqual(serializeError(404), { type: 'number', message: '404' });
  assert.deepEqual(serializeError(null), { type: 'null', message: 'null' });
  assert.deepEqual(serializeError(undefined), { type: 'undefined', message: 'undefined' });
  assert.deepEqual(serializeError({ message: 'rejected with an object' }), {
    type: 'Object',
    message: 'rejected with an object',
  });
  assert.deepEqual(serializeError({ status: 503 }), { type: 'Object', message: '{"status":503}' });
});

test('long messages and stacks are truncated with a note of what was cut', () => {
  const serialized = serializeError(new Error('x'.repeat(5_000)));
  assert.match(serialized.message, /… \[1000 more characters\]$/);
});

test('errors from another realm are recognised', () => {
  const foreign: unknown = runInNewContext('new RangeError("from a vm context")');
  assert.equal(foreign instanceof Error, false);
  assert.equal(isError(foreign), true);
  assert.equal(serializeError(foreign).type, 'RangeError');
  assert.equal(isError({ name: 'Error', message: 'looks like one' }), false);
});

test('the fingerprint is the same for two occurrences that differ only in numbers', () => {
  const first = serializeError(new Error('listing 123 has no price'));
  const second = serializeError(new Error('listing 456 has no price'));
  second.stack = first.stack?.replace('listing 123', 'listing 456');
  assert.equal(errorFingerprint(first), errorFingerprint(second));
  assert.notEqual(errorFingerprint(first), errorFingerprint(serializeError(new Error('another bug'))));
});
