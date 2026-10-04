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

test('--list-rules prints every rule with its fix and exits 0', () => {
  const result = run('--list-rules');
  assert.equal(result.status, 0);
  for (const id of ['banned-phrase', 'half-space', 'middle-dot-join', 'repeated-sentence', 'length-button']) {
    assert.match(result.stdout, new RegExp(`^${id}\\s`, 'm'));
  }
  assert.match(result.stdout, /fix:/);
});

test('an unknown rule or file is a usage error: exit 2', () => {
  assert.equal(run('--rule', 'no-such-rule').status, 2);
  assert.equal(run('no/such/file.ts').status, 2);
  assert.equal(run('README.md').status, 2);
});

test('updating the baseline needs a full run', () => {
  const result = run('--update-baseline', '--rule', 'half-space');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /full run/);
});

test('--list-files lists the copy files with their string counts', () => {
  const result = run('--list-files');
  assert.equal(result.status, 0);
  assert.match(result.stdout, /apps\/web\/src\/features\/home\/home-copy\.ts/);
});

test('a folder argument means the source files in it', () => {
  const result = run('apps/web/src/features/home', '--list-files');
  assert.equal(result.status, 0);
  assert.match(result.stdout, /home-copy\.ts/);
  assert.doesNotMatch(result.stdout, /listing-copy\.ts/);
});
