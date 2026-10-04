// The command line: exit codes and the options that do not touch the baseline.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { test } from 'node:test';

const CLI = path.join(import.meta.dirname, '..', 'cli.mjs');
const run = (...args) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });

test('--help prints the options and exits 0', () => {
  const result = run('--help');
  assert.equal(result.status, 0);
  assert.match(result.stdout, /--update-baseline/);
  assert.match(result.stdout, /--baseline-rule/);
});

test('--list-rules prints every rule with its level and fix and exits 0', () => {
  const result = run('--list-rules');
  assert.equal(result.status, 0);
  for (const id of ['banned-phrase', 'half-space', 'middle-dot-join', 'repeated-sentence', 'length-button']) {
    assert.match(result.stdout, new RegExp(`^${id}\\s+\\[refuse\\]`, 'm'));
  }
  for (const id of ['semicolon', 'discouraged-phrase', 'parenthesis']) {
    assert.match(result.stdout, new RegExp(`^${id}\\s+\\[warn\\]`, 'm'));
  }
  assert.match(result.stdout, /fix:/);
});

test('a warn rule is never baselined: asking for it is a usage error, before any lint run', () => {
  const result = run('--baseline-rule', 'semicolon');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /warn rule/);
});

test('warnings are counted and listed apart from violations, and never change the exit code', () => {
  const folder = 'apps/web/src/features/home';
  const loud = run(folder, '--warnings', '--json');
  assert.equal(loud.status, 0);
  const all = JSON.parse(loud.stdout);
  assert.equal(typeof all.warnings, 'number');
  assert.equal(all.warningFindings.length, all.warnings);
  assert.ok(all.warningFindings.every((finding) => finding.level === 'warn'));
  assert.ok(all.findings.every((finding) => finding.level === 'refuse'));
  const quiet = JSON.parse(run(folder, '--json').stdout);
  assert.equal(quiet.warningFindings, undefined);
  assert.equal(quiet.warnings, all.warnings);
  // Naming a warn rule lists the warnings of that rule, and nothing else.
  const named = JSON.parse(run(folder, '--rule', 'parenthesis', '--json').stdout);
  assert.ok(named.warningFindings.every((finding) => finding.rule === 'parenthesis'));
});

test('an unknown rule or file is a usage error: exit 2', () => {
  assert.equal(run('--rule', 'no-such-rule').status, 2);
  assert.equal(run('README.md').status, 2);
});

test('updating the baseline needs a full run', () => {
  const result = run('--update-baseline', '--rule', 'half-space');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /full run/);
});

test('--list-files lists the copy files with their string counts; a folder argument means the source files in it', () => {
  const result = run('apps/web/src/features/home', '--list-files');
  assert.equal(result.status, 0);
  assert.match(result.stdout, /^\s+\d+\s+name\s+apps\/web\/src\/features\/home\/home-copy\.ts$/m);
  assert.doesNotMatch(result.stdout, /listing-copy\.ts/);
});

test('a long table reaches a shell pipe whole (process.exit right after a big write cut it off)', () => {
  const inventory = path.join(import.meta.dirname, '..', 'inventory.mjs');
  const last = spawnSync(
    'sh',
    ['-c', `${JSON.stringify(process.execPath)} ${JSON.stringify(inventory)} --strings D | tail -n 1`],
    { encoding: 'utf8' },
  ).stdout.trim();
  assert.match(last, /^\d+ strings in \d+ files\.$/);
});

test('a reader that closes the pipe early gets no stack trace', () => {
  const inventory = path.join(import.meta.dirname, '..', 'inventory.mjs');
  const result = spawnSync(
    'sh',
    ['-c', `${JSON.stringify(process.execPath)} ${JSON.stringify(inventory)} --strings D | head -n 1`],
    { encoding: 'utf8' },
  );
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /^\| File:line/);
});
