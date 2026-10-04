// The two levels of a rule (docs/design/product-voice.md, appendix B): `refuse` fails the lint, `warn` asks a person.
// The loader refuses a rule without one, the run keeps the two apart, and a warning never fails or enters the baseline.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { compareToBaseline, countFindings } from '../lib/baseline.mjs';
import { lintRepository } from '../lib/run.mjs';
import { scan } from '../lib/scope.mjs';
import { LEVELS, loadRules } from '../rules/index.mjs';
import { fa } from './helpers.mjs';

const COPY = 'apps/web/src/features/demo/demo-copy.ts';
const rules = await loadRules();

async function run(source, options = {}) {
  const scanResult = scan({ files: [COPY], read: () => fa(source) });
  return lintRepository({ scanResult, allowlist: { entries: [] }, ...options });
}

async function loadFolder(moduleSource) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'copy-lint-rules-'));
  try {
    fs.writeFileSync(path.join(directory, 'sample-rule.mjs'), moduleSource);
    return await loadRules(directory);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

const RULE_WITHOUT_LEVEL = `export default {
  id: 'sample-rule',
  summary: 'a sample',
  message: 'A sample.',
  fix: 'Fix it.',
  check: () => [],
  samples: { pass: ['x'], fail: ['y'] },
};`;

test('every rule has a level, and both levels are in use', () => {
  for (const rule of rules) assert.ok(LEVELS.includes(rule.level), `${rule.id} has no valid level`);
  assert.deepEqual([...new Set(rules.map((rule) => rule.level))].sort(), [...LEVELS].sort());
});

test('the loader refuses a rule that does not say whether it refuses or warns', async () => {
  await assert.rejects(loadFolder(RULE_WITHOUT_LEVEL), /needs a level/);
  const loaded = await loadFolder(
    RULE_WITHOUT_LEVEL.replace("id: 'sample-rule',", "id: 'sample-rule', level: 'warn',"),
  );
  assert.deepEqual(
    loaded.map((rule) => [rule.id, rule.level]),
    [['sample-rule', 'warn']],
  );
  await assert.rejects(
    loadFolder(RULE_WITHOUT_LEVEL.replace("id: 'sample-rule',", "id: 'sample-rule', level: 'error',")),
    /needs a level/,
  );
});

test('a violation of a refuse rule and a warning of a warn rule are kept apart', async () => {
  const result = await run(`export const COPY = {
  a: 'سلام!',
  b: 'قیمت پایین است؛ دلیلش را ببینید.',
};`);
  assert.deepEqual(
    result.findings.map((finding) => [finding.line, finding.rule, finding.level]),
    [[2, 'exclamation-mark', 'refuse']],
  );
  assert.deepEqual(
    result.warnings.map((finding) => [finding.line, finding.rule, finding.level]),
    [[3, 'semicolon', 'warn']],
  );
});

test('a warning is never counted for the baseline, so it can never fail the lint', async () => {
  const result = await run("export const COPY = { b: 'قیمت پایین است؛ دلیلش را ببینید.' };");
  assert.equal(result.warnings.length, 1);
  const counts = countFindings(result.findings);
  assert.equal(counts.size, 0);
  assert.deepEqual(compareToBaseline(counts, new Map()).worse, []);
});

test('a comment can silence a warning with a reason, and a comment that silences nothing is still a setup problem', async () => {
  const silenced = await run(`export const COPY = {
  // copy-lint-ignore semicolon: the pair is a quoted rule, not two sentences
  b: 'قیمت پایین است؛ دلیلش را ببینید.',
};`);
  assert.deepEqual(silenced.warnings, []);
  assert.equal(silenced.suppressed.directive, 1);
  assert.deepEqual(silenced.meta, []);

  const unused = await run(`export const COPY = {
  // copy-lint-ignore semicolon: nothing here needs it
  b: 'قیمت پایین است',
};`);
  assert.equal(unused.meta.length, 1);
  assert.equal(unused.meta[0].rule, 'ignore-directive');
});

test('the banned list makes two rules, one per level, and every entry lands in the rule of its level', () => {
  const byId = new Map(rules.map((rule) => [rule.id, rule]));
  assert.equal(byId.get('banned-phrase').level, 'refuse');
  assert.equal(byId.get('discouraged-phrase').level, 'warn');
});
