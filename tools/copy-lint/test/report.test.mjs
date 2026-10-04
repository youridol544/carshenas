// What the lint prints: violations and warnings are told apart, and warnings never turn the verdict into a failure.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatMarkdown, formatRules, formatText } from '../lib/report.mjs';

const refuse = { id: 'half-space', level: 'refuse', summary: 'a half-space', message: 'm', fix: 'Join it.' };
const warn = { id: 'semicolon', level: 'warn', summary: 'a semicolon', message: 'm', fix: 'Split it.' };

const finding = (rule, file, line) => ({
  rule: rule.id,
  level: rule.level,
  file,
  line,
  column: 1,
  endLine: line,
  text: 'متن',
  message: `${rule.id} here`,
  fix: rule.fix,
  unitText: 'متن',
});

function resultOf({ findings = [], warnings = [] } = {}) {
  return {
    findings,
    warnings,
    meta: [],
    suppressed: { directive: 0, allowlist: 0 },
    rules: [refuse, warn],
    scan: { copy: [{ file: 'a.ts', units: [{ persian: true }, { persian: true }] }], excluded: [] },
  };
}

const none = { worse: [], better: [] };

test('the summary line counts violations and warnings apart', () => {
  const text = formatText({
    result: resultOf({ warnings: [finding(warn, 'a.ts', 3)] }),
    shown: [],
    comparison: none,
  });
  assert.match(text, /copy-lint: 1 copy files, 2 strings, 0 violations, 1 warnings/);
});

test('warnings are listed only when asked for, with a hint to ask', () => {
  const result = resultOf({ warnings: [finding(warn, 'a.ts', 3)] });
  const quiet = formatText({ result, shown: [], comparison: none });
  assert.doesNotMatch(quiet, /Warnings \(they never fail/);
  assert.match(quiet, /1 warnings.*pnpm copy:lint --warnings/);
  const loud = formatText({ result, shown: [], shownWarnings: result.warnings, comparison: none });
  assert.match(loud, /Warnings \(they never fail the lint/);
  assert.match(loud, /3:1\s+semicolon\s+semicolon here/);
  assert.doesNotMatch(loud, /lists them/);
});

test('warnings alone never make the verdict a failure', () => {
  const result = resultOf({ warnings: [finding(warn, 'a.ts', 3), finding(warn, 'a.ts', 4)] });
  const text = formatText({ result, shown: [], shownWarnings: result.warnings, comparison: none });
  assert.match(text, /ok: nothing new or worse/);
  assert.doesNotMatch(text, /FAIL/);
});

test('a violation worse than the baseline is a failure, whatever the warnings', () => {
  const violation = finding(refuse, 'a.ts', 2);
  const worse = { worse: [{ file: 'a.ts', rule: 'half-space', baseline: 0, count: 1 }], better: [] };
  const text = formatText({
    result: resultOf({ findings: [violation] }),
    shown: [violation],
    comparison: worse,
  });
  assert.match(text, /FAIL/);
  assert.match(text, /half-space: 1 \(baseline 0\)/);
});

test("the rule list shows each rule's level", () => {
  const text = formatRules([refuse, warn]);
  assert.match(text, /^half-space\s+\[refuse\] a half-space/m);
  assert.match(text, /^semicolon\s+\[warn\] a semicolon/m);
});

test('the markdown report has the level of each rule and separate sections for violations and warnings', () => {
  const result = resultOf({
    findings: [finding(refuse, 'a.ts', 2)],
    warnings: [finding(warn, 'a.ts', 3), finding(warn, 'b.ts', 1)],
  });
  const markdown = formatMarkdown({
    result,
    areaOf: () => 'A',
    date: '2026-10-04',
    command: 'pnpm copy:lint --report x.md',
    rulesById: new Map([refuse, warn].map((rule) => [rule.id, rule])),
  });
  assert.match(markdown, /Rules: 2 \(1 refuse, 1 warn\)/);
  assert.match(markdown, /Violations \(refuse rules; the baseline\): \*\*1\*\* in 1 files/);
  assert.match(markdown, /Warnings \(warn rules; never fail\): \*\*2\*\* in 2 files/);
  assert.match(markdown, /\| `half-space` \| refuse \| a half-space \| 1 \| 1 \|/);
  assert.match(markdown, /\| `semicolon` \| warn \| a semicolon \| 2 \| 2 \|/);
  for (const heading of [
    '## Violations by rewrite area',
    '## Warnings by rewrite area',
    '## Violations by file',
    '## Warnings: the files with most',
    '## Examples of violations, by rule',
    '## Examples of warnings, by rule',
  ]) {
    assert.ok(markdown.includes(heading), `missing section: ${heading}`);
  }
});
