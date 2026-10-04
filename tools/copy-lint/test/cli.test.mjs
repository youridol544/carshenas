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

test('--list-rules shows the level of every rule: refuse fails the lint, warn asks a person', () => {
  const result = run('--list-rules');
  assert.match(result.stdout, /^half-space\s+\[refuse\]/m);
  assert.match(result.stdout, /^semicolon\s+\[warn\]/m);
  assert.match(result.stdout, /^discouraged-phrase\s+\[warn\]/m);
});

test('a warn rule is never baselined: asking for it is a usage error and writes nothing', () => {
  const result = run('--baseline-rule', 'semicolon');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /warn rule/);
});

test('--warnings and a named warn rule run and exit 0: warnings never fail the lint', () => {
  for (const args of [['--warnings'], ['--rule', 'semicolon'], ['--rule', 'discouraged-phrase', '--json']]) {
    const result = run(...args);
    assert.equal(result.status, 0, `${args.join(' ')}: ${result.stdout.slice(-300)}`);
  }
  const json = JSON.parse(run('--rule', 'semicolon', '--json').stdout);
  assert.equal(typeof json.warnings, 'number');
  assert.ok(Array.isArray(json.warningFindings));
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

test('a long listing reaches a shell pipe whole (process.exit right after a big write cut it off)', () => {
  const inventory = path.join(import.meta.dirname, '..', 'inventory.mjs');
  const lastLine = (command) =>
    spawnSync('sh', ['-c', `${command} | tail -n 1`], { encoding: 'utf8' }).stdout.trim();
  assert.match(
    lastLine(`${JSON.stringify(process.execPath)} ${JSON.stringify(CLI)} --list-files`),
    /understand\.ts$/,
  );
  assert.match(
    lastLine(`${JSON.stringify(process.execPath)} ${JSON.stringify(inventory)} --strings D`),
    /^\d+ strings in \d+ files\.$/,
  );
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
