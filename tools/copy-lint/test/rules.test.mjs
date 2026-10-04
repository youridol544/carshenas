// One test per rule, from the passing and failing samples each rule module carries (rules/index.mjs says how to add a
// rule). A rule without samples fails here, so a rule cannot be added untested.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runRules } from '../lib/engine.mjs';
import { loadRules } from '../rules/index.mjs';
import { makeUnit } from './helpers.mjs';

const rules = await loadRules();

function unitsOf(sample) {
  if (sample !== null && typeof sample === 'object' && Array.isArray(sample.units)) {
    return sample.units.map((unit, index) => makeUnit({ file: 'a.ts', ...unit, line: index + 1 }));
  }
  return [makeUnit(sample)];
}

test('the rules are loaded, with distinct kebab-case ids', () => {
  assert.ok(rules.length >= 15, `expected at least 15 rules, got ${rules.length}`);
  assert.equal(new Set(rules.map((rule) => rule.id)).size, rules.length);
});

for (const rule of rules) {
  test(`rule ${rule.id}`, () => {
    assert.ok(
      Array.isArray(rule.samples?.pass) && rule.samples.pass.length > 0,
      'needs at least one passing sample',
    );
    assert.ok(
      Array.isArray(rule.samples?.fail) && rule.samples.fail.length > 0,
      'needs at least one failing sample',
    );
    for (const sample of rule.samples.pass) {
      const found = runRules([rule], unitsOf(sample));
      assert.deepEqual(
        found.map((finding) => `${finding.rule}: ${finding.text}`),
        [],
        `a passing sample was flagged: ${JSON.stringify(sample)}`,
      );
    }
    for (const sample of rule.samples.fail) {
      const found = runRules([rule], unitsOf(sample));
      assert.ok(found.length > 0, `a failing sample was not flagged: ${JSON.stringify(sample)}`);
      for (const finding of found) {
        assert.equal(finding.rule, rule.id);
        assert.ok(finding.message !== '' && finding.fix !== '');
      }
    }
  });
}

test('a rule scoped to Persian text ignores a string without a Persian word', () => {
  const rule = rules.find((candidate) => candidate.id === 'exclamation-mark');
  assert.equal(runRules([rule], [makeUnit('Hello!')]).length, 0);
  assert.equal(runRules([rule], [makeUnit('سلام!')]).length, 1);
});

test('the dot rules also see a separator that has no Persian word', () => {
  const dot = rules.find((candidate) => candidate.id === 'middle-dot-join');
  assert.equal(runRules([dot], [makeUnit(' · ')]).length, 1);
});
