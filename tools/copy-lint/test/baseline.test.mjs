// The baseline ratchet: fails only on new or worse, and only ever lowers (lib/baseline.mjs).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  compareToBaseline,
  countFindings,
  keyOf,
  nextBaseline,
  serializeBaseline,
} from '../lib/baseline.mjs';

const finding = (file, rule) => ({ file, rule });

test('findings are counted per file and rule', () => {
  const counts = countFindings([
    finding('a.ts', 'x'),
    finding('a.ts', 'x'),
    finding('a.ts', 'y'),
    finding('b.ts', 'x'),
  ]);
  assert.equal(counts.get(keyOf('a.ts', 'x')), 2);
  assert.equal(counts.get(keyOf('a.ts', 'y')), 1);
  assert.equal(counts.get(keyOf('b.ts', 'x')), 1);
});

test('a new violation, or a higher count, is worse; a lower count is better; the same is neither', () => {
  const baseline = new Map([
    [keyOf('a.ts', 'x'), 2],
    [keyOf('b.ts', 'x'), 3],
    [keyOf('c.ts', 'x'), 1],
  ]);
  const current = new Map([
    [keyOf('a.ts', 'x'), 3],
    [keyOf('b.ts', 'x'), 1],
    [keyOf('c.ts', 'x'), 1],
    [keyOf('d.ts', 'y'), 1],
  ]);
  const { worse, better } = compareToBaseline(current, baseline);
  assert.deepEqual(worse, [
    { file: 'a.ts', rule: 'x', baseline: 2, count: 3 },
    { file: 'd.ts', rule: 'y', baseline: 0, count: 1 },
  ]);
  assert.deepEqual(better, [{ file: 'b.ts', rule: 'x', baseline: 3, count: 1 }]);
});

test('a fixed violation (count zero) is better, and is dropped by the next baseline', () => {
  const baseline = new Map([[keyOf('a.ts', 'x'), 2]]);
  const current = new Map();
  assert.equal(compareToBaseline(current, baseline).better.length, 1);
  const { ok, next } = nextBaseline(current, baseline);
  assert.equal(ok, true);
  assert.equal(next.size, 0);
});

test('updating the baseline only ever lowers a count', () => {
  const baseline = new Map([
    [keyOf('a.ts', 'x'), 3],
    [keyOf('b.ts', 'x'), 2],
  ]);
  const current = new Map([
    [keyOf('a.ts', 'x'), 1],
    [keyOf('b.ts', 'x'), 2],
  ]);
  const { ok, next } = nextBaseline(current, baseline);
  assert.equal(ok, true);
  assert.equal(next.get(keyOf('a.ts', 'x')), 1);
  assert.equal(next.get(keyOf('b.ts', 'x')), 2);
});

test('updating the baseline refuses when anything is worse, and names it', () => {
  const baseline = new Map([[keyOf('a.ts', 'x'), 1]]);
  const current = new Map([
    [keyOf('a.ts', 'x'), 2],
    [keyOf('b.ts', 'x'), 1],
  ]);
  const { ok, refused } = nextBaseline(current, baseline);
  assert.equal(ok, false);
  assert.deepEqual(
    refused.map((entry) => entry.file),
    ['a.ts', 'b.ts'],
  );
});

test('a rule that was just added or tightened can be accepted at its current count', () => {
  const baseline = new Map([[keyOf('a.ts', 'old'), 1]]);
  const current = new Map([
    [keyOf('a.ts', 'old'), 1],
    [keyOf('a.ts', 'new'), 5],
    [keyOf('b.ts', 'new'), 2],
  ]);
  const { ok, next } = nextBaseline(current, baseline, new Set(['new']));
  assert.equal(ok, true);
  assert.equal(next.get(keyOf('a.ts', 'new')), 5);
  assert.equal(next.get(keyOf('b.ts', 'new')), 2);
  assert.equal(next.get(keyOf('a.ts', 'old')), 1);
});

test('the file is one entry per line, sorted, and parses as JSON', () => {
  const text = serializeBaseline(
    new Map([
      [keyOf('b.ts', 'x'), 2],
      [keyOf('a.ts', 'y'), 1],
      [keyOf('a.ts', 'x'), 3],
    ]),
  );
  const parsed = JSON.parse(text);
  assert.deepEqual(parsed.entries, [
    { file: 'a.ts', rule: 'x', count: 3 },
    { file: 'a.ts', rule: 'y', count: 1 },
    { file: 'b.ts', rule: 'x', count: 2 },
  ]);
  const entryLines = text.split('\n').filter((line) => line.includes('"file"'));
  assert.equal(entryLines.length, 3);
  assert.ok(text.endsWith('}\n'));
});
