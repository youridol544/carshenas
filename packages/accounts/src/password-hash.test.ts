import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hash } from 'argon2';
import {
  hashNeedsUpgrade,
  hashPassword,
  keptUnlessFailed,
  verifyPassword,
  verifyUnknownAccount,
} from './password-hash.ts';

test('a password is stored as an Argon2id PHC string with OWASP parameters, salted anew each time', async () => {
  const first = await hashPassword('blue tiger eats rice');
  const second = await hashPassword('blue tiger eats rice');
  assert.match(first, /^\$argon2id\$v=19\$m=19456,p=1,t=2\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/);
  assert.notEqual(first, second);
});

test('a stored hash verifies its own password and nothing else', async () => {
  const stored = await hashPassword('پژو ۲۰۶ سفید من');
  assert.equal(await verifyPassword(stored, 'پژو ۲۰۶ سفید من'), true);
  assert.equal(await verifyPassword(stored, 'پژو ۲۰۶ سفید'), false);
  assert.equal(await verifyPassword(stored, ''), false);
});

test('a hash made with older parameters asks to be upgraded after the next sign-in', async () => {
  assert.equal(hashNeedsUpgrade(await hashPassword('blue tiger eats rice')), false);
  const older = await hash('blue tiger eats rice', { memoryCost: 4096, timeCost: 3, parallelism: 1 });
  assert.equal(hashNeedsUpgrade(older), true);
});

test('an unknown account takes a real verification, never an early answer', async () => {
  await verifyUnknownAccount('warm the cached hash');
  const known = await hashPassword('blue tiger eats rice');
  const started = performance.now();
  await verifyPassword(known, 'a wrong guess');
  const knownMs = performance.now() - started;
  const unknownStarted = performance.now();
  await verifyUnknownAccount('a wrong guess');
  const unknownMs = performance.now() - unknownStarted;
  // Same work: within a factor of three either way on a busy machine, never the microseconds of a skipped hash.
  assert.ok(unknownMs > knownMs / 3 && unknownMs < knownMs * 3, `${unknownMs} ms against ${knownMs} ms`);
});

test('the unknown-account hash is made once, but a failed attempt to make it is not kept', async () => {
  let made = 0;
  const value = keptUnlessFailed(() => {
    made += 1;
    return made === 1
      ? Promise.reject(new Error('no turn within five seconds'))
      : Promise.resolve(`hash ${String(made)}`);
  });
  await assert.rejects(value(), /no turn/);
  assert.equal(await value(), 'hash 2');
  assert.equal(await value(), 'hash 2');
  assert.equal(made, 2);
});
