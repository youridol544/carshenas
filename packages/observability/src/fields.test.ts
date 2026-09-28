import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sanitizeFields } from './fields.ts';
import { REDACTED } from './redact.ts';

test('an error in any field becomes a serialised error', () => {
  const sanitized = sanitizeFields({
    err: new RangeError('page 0'),
    nested: { failure: new Error('inner') },
  });
  assert.deepEqual(Object.keys(sanitized.err as object).slice(0, 3), ['type', 'message', 'stack']);
  assert.equal((sanitized.nested as { failure: { type: string } }).failure.type, 'Error');
});

test('secret and personal fields are redacted at any depth, other fields kept', () => {
  const sanitized = sanitizeFields({
    listingId: 42,
    request: { headers: { authorization: 'Bearer abc', cookie: 'sid=1', 'user-agent': 'Mozilla/5.0' } },
    seller: { phone: '09121234567', city: 'تهران' },
  });
  assert.deepEqual(sanitized, {
    listingId: 42,
    request: { headers: { authorization: REDACTED, cookie: REDACTED, 'user-agent': 'Mozilla/5.0' } },
    seller: { phone: REDACTED, city: 'تهران' },
  });
});

test('strings are scrubbed wherever they are', () => {
  const sanitized = sanitizeFields({ note: 'call 0912 123 4567', urls: ['postgres://u:p4ss@db/x'] });
  assert.deepEqual(sanitized, { note: `call ${REDACTED}`, urls: [`postgres://u:${REDACTED}@db/x`] });
});

test('special values become JSON-safe values', () => {
  const sanitized = sanitizeFields({
    at: new Date('2026-09-28T08:00:00Z'),
    invalid: new Date(Number.NaN),
    href: new URL('https://divar.ir/v/x?api_key=k'),
    big: 10n ** 20n,
    bytes: new Uint8Array(3),
    set: new Set(['a', 'b']),
    map: new Map([['k', 1]]),
    fn: () => 1,
  });
  assert.deepEqual(sanitized, {
    at: '2026-09-28T08:00:00.000Z',
    invalid: 'Invalid Date',
    href: `https://divar.ir/v/x?api_key=${REDACTED}`,
    big: '100000000000000000000',
    bytes: '[binary: 3 bytes]',
    set: ['a', 'b'],
    map: { k: 1 },
    fn: undefined,
  });
});

test('cycles, depth and size are bounded', () => {
  const loop: Record<string, unknown> = { name: 'loop' };
  loop.self = loop;
  const shared = { value: 1 };
  let deep: Record<string, unknown> = { leaf: true };
  for (let level = 0; level < 10; level += 1) deep = { deep };
  const sanitized = sanitizeFields({
    loop,
    twice: [shared, shared],
    deep,
    many: Array.from({ length: 60 }, (_, index) => index),
    long: 'x'.repeat(9_000),
  });
  assert.deepEqual(sanitized.loop, { name: 'loop', self: '[circular]' });
  assert.deepEqual(sanitized.twice, [{ value: 1 }, { value: 1 }]);
  assert.match(JSON.stringify(sanitized.deep), /\[too deep\]/);
  assert.equal((sanitized.many as unknown[]).length, 51);
  assert.equal((sanitized.many as unknown[]).at(-1), '… 10 more items');
  assert.match(sanitized.long as string, /… \[1000 more characters\]$/);
});
