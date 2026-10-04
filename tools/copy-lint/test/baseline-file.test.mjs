// The committed baseline (tools/copy-lint/baseline/<area>.json) is generated and never edited by hand: each file must be
// exactly what `--update-baseline` writes (sorted, one entry per line), belong to a real area, hold only that area's files
// and rules that exist, and carry positive whole counts.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { AREA_IDS, areaIdOf } from '../areas.mjs';
import { loadBaseline, serializeBaseline, splitKey } from '../lib/baseline.mjs';
import { BASELINE_DIR } from '../lib/paths.mjs';
import { loadRules } from '../rules/index.mjs';

const names = fs.readdirSync(BASELINE_DIR).filter((name) => name.endsWith('.json'));

test('there is one baseline file for each area, and no other', () => {
  assert.deepEqual(names.map((name) => name.replace(/\.json$/, '')).sort(), [...AREA_IDS].sort());
});

for (const name of names) {
  test(`baseline/${name} is byte-for-byte what the tool writes, with its own area's files only`, async () => {
    const area = name.replace(/\.json$/, '');
    const text = fs.readFileSync(path.join(BASELINE_DIR, name), 'utf8');
    const parsed = JSON.parse(text);
    assert.equal(parsed.area, area);
    const known = new Set((await loadRules()).map((rule) => rule.id));
    const counts = new Map();
    for (const entry of parsed.entries) {
      assert.ok(known.has(entry.rule), `unknown rule in the baseline: ${entry.rule}`);
      assert.ok(
        Number.isInteger(entry.count) && entry.count > 0,
        `bad count for ${entry.file} ${entry.rule}`,
      );
      assert.equal(areaIdOf(entry.file), area, `${entry.file} does not belong to area ${area}`);
      const key = `${entry.file}\t${entry.rule}`;
      assert.ok(!counts.has(key), `duplicate baseline entry: ${key}`);
      counts.set(key, entry.count);
      assert.equal(splitKey(key).length, 2);
    }
    assert.equal(
      text,
      serializeBaseline(counts, area),
      `baseline/${name} was edited by hand or is out of order: regenerate it with \`pnpm copy:lint --update-baseline\`.`,
    );
  });
}

test('the baseline is not empty', () => {
  assert.ok(loadBaseline(BASELINE_DIR).size > 0);
});
