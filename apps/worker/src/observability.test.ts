import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { releaseOf } from './observability.ts';

// The worker's own setup, run by plain Node the way `pnpm worker` runs it: TypeScript stripped by Node, source maps
// on. A crash must leave one fatal line whose stack names the TypeScript file and line, from the repository root.

const fixture = fileURLToPath(new URL('test-support/crash-on-purpose.ts', import.meta.url));

test('an uncaught exception writes one fatal line whose stack points at the TypeScript source, then exits 1', () => {
  const result = spawnSync(
    process.execPath,
    ['--experimental-strip-types', '--no-warnings=ExperimentalWarning', '--enable-source-maps', fixture],
    { encoding: 'utf8', timeout: 15_000 },
  );
  assert.equal(result.status, 1);
  assert.equal(result.stderr, '');
  const lines = result.stdout
    .trim()
    .split('\n')
    .map(
      (line) => JSON.parse(line) as { level: string; msg: string; service: string; err?: { stack: string } },
    );
  assert.deepEqual(
    lines.map((line) => [line.level, line.msg, line.service]),
    [
      ['info', 'worker started', 'carshenas-worker'],
      ['fatal', 'uncaught exception, exiting', 'carshenas-worker'],
    ],
  );
  const markerLine = readFileSync(fixture, 'utf8').split('\n').indexOf('  // crash-marker') + 2;
  assert.match(
    lines[1]?.err?.stack ?? '',
    new RegExp(`apps/worker/src/test-support/crash-on-purpose\\.ts:${markerLine}:\\d+`),
  );
});

test('the release names the deployment when it is set, and the commit when it is not', () => {
  assert.equal(releaseOf('2026.09.29-1'), '2026.09.29-1');
  assert.match(releaseOf(undefined), /^([0-9a-f]{12}(-dirty)?|unknown)$/);
});
