// A whole run on small in-memory files: scope, rules, inline directives, the allowlist and the setup checks.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lintRepository } from '../lib/run.mjs';
import { scan } from '../lib/scope.mjs';
import { fa } from './helpers.mjs';

const COPY = 'apps/web/src/features/demo/demo-copy.ts';

async function run(sources, options = {}) {
  const files = Object.keys(sources);
  const scanResult = scan({ files, read: (file) => fa(sources[file]) });
  return lintRepository({ scanResult, allowlist: { entries: [] }, ...options });
}

const lines = (result) => result.findings.map((finding) => `${finding.line} ${finding.rule}`);

test('a run finds violations with file, line and rule', async () => {
  const result = await run({
    [COPY]: `export const COPY = {
  title: 'سلام!',
  body: 'می خواهید آگهی ببینید',
  fine: 'قیمت پایین است',
};`,
  });
  assert.deepEqual(lines(result), ['2 exclamation-mark', '3 half-space']);
  assert.equal(result.findings[0].file, COPY);
  assert.equal(result.meta.length, 0);
});

test('a comment on its own line covers the whole property below it, even over several lines', async () => {
  const result = await run({
    [COPY]: `export const COPY = {
  // copy-lint-ignore exclamation-mark: the product name has a mark
  title:
    'سلام!',
  other: 'نه!',
};`,
  });
  assert.deepEqual(lines(result), ['5 exclamation-mark']);
  assert.equal(result.suppressed.directive, 1);
  assert.equal(result.meta.length, 0);
});

test('a comment after code covers its own line only', async () => {
  const result = await run({
    [COPY]: `export const COPY = {
  a: 'سلام!', // copy-lint-ignore exclamation-mark: a greeting in a quoted sign
  b: 'نه!',
};`,
  });
  assert.deepEqual(lines(result), ['3 exclamation-mark']);
});

test('a JSX comment covers the element after it', async () => {
  const result = await run({
    'apps/web/src/features/demo/demo.tsx': `export function Demo() {
  return (
    <div>
      {/* copy-lint-ignore exclamation-mark: a quoted slogan */}
      <p>سلام!</p>
      <p>نه!</p>
    </div>
  );
}`,
  });
  assert.deepEqual(lines(result), ['6 exclamation-mark']);
  assert.equal(result.meta.length, 0);
});

test('several rules may be named in one comment', async () => {
  const result = await run({
    [COPY]: `export const COPY = {
  // copy-lint-ignore exclamation-mark, half-space: a quotation
  a: 'می خواهید!',
};`,
  });
  assert.deepEqual(lines(result), []);
});

test('a directive without a reason, with an unknown rule, or that suppresses nothing is a setup problem', async () => {
  const result = await run({
    [COPY]: `export const COPY = {
  // copy-lint-ignore exclamation-mark
  a: 'سلام!',
  // copy-lint-ignore no-such-rule: because
  b: 'سلام',
  // copy-lint-ignore half-space: nothing to ignore here
  c: 'سلام',
};`,
  });
  assert.deepEqual(
    result.meta.map((finding) => [finding.rule, finding.line]),
    [
      ['ignore-directive', 2],
      ['ignore-directive', 4],
      ['ignore-directive', 6],
    ],
  );
  // The malformed directive covers nothing, so the violation under it still stands.
  assert.deepEqual(lines(result), ['3 exclamation-mark']);
});

test('the allowlist covers a finding by rule, file and text, and needs a reason', async () => {
  const sources = { [COPY]: "export const COPY = { a: 'سلام!', b: 'نه!' };" };
  const covered = await run(sources, {
    allowlist: {
      entries: [
        { rule: 'exclamation-mark', file: 'apps/web/src/features/demo/*', text: 'سلام', reason: 'a quote' },
      ],
    },
  });
  assert.equal(covered.findings.length, 1);
  assert.equal(covered.suppressed.allowlist, 1);

  const noReason = await run(sources, {
    allowlist: { entries: [{ rule: 'exclamation-mark', file: COPY }] },
  });
  assert.equal(
    noReason.meta.some((finding) => finding.rule === 'allowlist-entry'),
    true,
  );
});

test('an allowlist entry that covers nothing is stale on a full run, not on a partial one', async () => {
  const sources = { [COPY]: "export const COPY = { a: 'سلام' };" };
  const allowlist = { entries: [{ rule: 'exclamation-mark', file: COPY, reason: 'gone' }] };
  const full = await run(sources, { allowlist });
  assert.equal(full.meta.filter((finding) => finding.rule === 'allowlist-entry').length, 1);
  const partial = await run(sources, { allowlist, only: new Set(['exclamation-mark']) });
  assert.equal(partial.meta.filter((finding) => finding.rule === 'allowlist-entry').length, 0);
});

test('an allowlist entry for an unknown rule is a setup problem', async () => {
  const result = await run(
    { [COPY]: "export const COPY = { a: 'سلام' };" },
    { allowlist: { entries: [{ rule: 'nope', file: COPY, reason: 'x' }] } },
  );
  assert.ok(result.meta.some((finding) => finding.message.includes('unknown rule')));
});

test('a file with Persian text that nothing classifies is a setup problem', async () => {
  const result = await run({ 'packages/search/src/brand-new.ts': "export const A = 'متن تازه';" });
  assert.deepEqual(
    result.meta.map((finding) => [finding.rule, finding.file]),
    [['unclassified-file', 'packages/search/src/brand-new.ts']],
  );
});

test('a test file and a vocabulary key are not copy', async () => {
  const result = await run({
    'apps/web/src/features/demo/demo.test.ts': "export const A = 'سلام!';",
    [COPY]: "export const COPY = { words: ['سلام!'], label: 'برند' };",
  });
  assert.deepEqual(lines(result), []);
});

test('the rules that look at a whole screen see its files together', async () => {
  const sentence = 'کمی بعد دوباره امتحان کنید و اگر نشد خبر دهید';
  const result = await run({
    'apps/web/src/features/demo/demo-copy.ts': `export const A = { x: '${sentence}' };`,
    'apps/web/src/features/demo/components/panel.tsx': `export const B = { y: '${sentence}' };`,
    'apps/web/src/features/other/other-copy.ts': `export const C = { z: '${sentence}' };`,
  });
  assert.deepEqual(
    result.findings.map((finding) => [finding.rule, finding.file]),
    [['repeated-sentence', 'apps/web/src/features/demo/demo-copy.ts']],
  );
});

test('--rule runs one rule only', async () => {
  const result = await run(
    { [COPY]: "export const COPY = { a: 'سلام!', b: 'می خواهید' };" },
    { only: new Set(['half-space']) },
  );
  assert.deepEqual(
    result.findings.map((finding) => finding.rule),
    ['half-space'],
  );
});

test('the dot rules reach a file that only joins values with a middle dot', async () => {
  const result = await run({
    'apps/web/src/features/demo/components/row.tsx': 'export const Row = () => <p>{a} · {b}</p>;',
  });
  assert.deepEqual(
    result.findings.map((finding) => finding.rule),
    ['middle-dot-join'],
  );
});

test('an entry of the banned list can exempt some files (the superadmin screens may name the database)', async () => {
  const text = "export const A = { lead: 'اعداد از پایگاه داده خوانده می‌شود' };";
  const buyer = await run({ [COPY]: text });
  assert.deepEqual(lines(buyer), ['1 banned-phrase']);
  const admin = await run({ 'apps/web/src/features/admin/x-admin-copy.ts': text });
  assert.deepEqual(lines(admin), []);
});

test('a finding inside a string that spans lines is placed on its own line', async () => {
  const result = await run({
    [COPY]: [
      'export const A = {',
      '  body: `خط اول این متن است',
      '  و خط دوم می خواهید می‌گوید',
      '  و خط سوم`,',
      '};',
    ].join('\n'),
  });
  assert.deepEqual(lines(result), ['3 half-space']);
});

test('a JSON data file under apps/web/public is scanned like a copy file', async () => {
  const result = await run({
    'apps/web/public/home/hero/credits.json': '{\n  "photos": [\n    { "alt": "یک عکس زیبا!" }\n  ]\n}',
  });
  assert.deepEqual(lines(result), ['3 exclamation-mark']);
});

test('a lone separator in a file outside the copy files is not Persian text and needs no decision', async () => {
  const result = await run({ 'packages/db/src/log.ts': "export const SEPARATOR = ' · ';" });
  assert.deepEqual(result.meta, []);
  assert.deepEqual(result.findings, []);
});

test('a directive reaches its property past a note and past another directive', async () => {
  const result = await run({
    [COPY]: `export const COPY = {
  // copy-lint-ignore exclamation-mark: a quoted slogan
  // a note about why
  // copy-lint-ignore half-space: written the way the seller wrote it
  a: 'می خواهید!',
};`,
  });
  assert.deepEqual(lines(result), []);
  assert.deepEqual(result.meta, []);
});
