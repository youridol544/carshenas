import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import { createTurns, NoTurnError } from './turns.ts';

test('at most `size` tasks run at once, and every waiting task runs in its turn', async () => {
  const turns = createTurns(2, 1_000);
  let peak = 0;
  const task = async (value: number) => {
    peak = Math.max(peak, turns.running);
    await sleep(10);
    return value;
  };
  const results = await Promise.all([1, 2, 3, 4, 5].map((value) => turns.run(() => task(value))));
  assert.deepEqual(results, [1, 2, 3, 4, 5]);
  assert.equal(peak, 2);
  assert.equal(turns.running, 0);
});

test('a task that waits longer than allowed fails with NoTurnError and leaves the queue working', async () => {
  const turns = createTurns(1, 20);
  const slow = turns.run(() => sleep(60).then(() => 'slow'));
  await assert.rejects(
    turns.run(() => Promise.resolve('late')),
    NoTurnError,
  );
  assert.equal(await slow, 'slow');
  assert.equal(await turns.run(() => Promise.resolve('next')), 'next');
  assert.equal(turns.running, 0);
});

test('a failing task gives its turn back', async () => {
  const turns = createTurns(1, 1_000);
  await assert.rejects(
    turns.run(() => Promise.reject(new Error('boom'))),
    /boom/,
  );
  assert.equal(await turns.run(() => Promise.resolve('after')), 'after');
});
