// The committed baseline.json is generated and never edited by hand: it must be exactly what `--update-baseline` writes
// (sorted, one entry per line), name only rules that exist, and hold positive whole counts.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { loadBaseline, serializeBaseline, splitKey } from '../lib/baseline.mjs';
import { BASELINE_FILE } from '../lib/paths.mjs';
import { loadRules } from '../rules/index.mjs';

test('baseline.json is byte-for-byte what the tool writes', () => {
  const written = fs.readFileSync(BASELINE_FILE, 'utf8');
  assert.equal(
    written,
    serializeBaseline(loadBaseline(BASELINE_FILE)),
    'baseline.json was edited by hand or is out of order: regenerate it with `pnpm copy:lint --update-baseline`.',
  );
});

test('baseline.json names only rules that exist, with positive whole counts', async () => {
  const known = new Set((await loadRules()).map((rule) => rule.id));
  const entries = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')).entries;
  const seen = new Set();
  for (const entry of entries) {
    assert.ok(known.has(entry.rule), `unknown rule in the baseline: ${entry.rule}`);
    assert.ok(Number.isInteger(entry.count) && entry.count > 0, `bad count for ${entry.file} ${entry.rule}`);
    const key = `${entry.file}\t${entry.rule}`;
    assert.ok(!seen.has(key), `duplicate baseline entry: ${key}`);
    seen.add(key);
  }
  assert.ok(entries.length > 0);
  assert.equal(splitKey(`${entries[0].file}\t${entries[0].rule}`).length, 2);
});
