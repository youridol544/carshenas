import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

// Metis credit is for tasks (the owner, 2026-10-02): the registry schedules the extraction only when the environment
// says EXTRACTION_SCHEDULED=1. Each case starts a process of its own with exactly the environment it names.

const script = fileURLToPath(new URL('../test-support/print-extraction-schedule.ts', import.meta.url));

function schedulesWith(
  environment: Record<string, string>,
): readonly { cron: string; payload: { dailyCapUsd: number } }[] {
  const result = spawnSync(
    process.execPath,
    ['--experimental-strip-types', '--no-warnings=ExperimentalWarning', script],
    { encoding: 'utf8', timeout: 30_000, env: environment },
  );
  assert.equal(result.status, 0, result.stderr);
  return (JSON.parse(result.stdout) as { schedules: { cron: string; payload: { dailyCapUsd: number } }[] })
    .schedules;
}

test('extraction is not scheduled unless the environment switches it on', () => {
  assert.deepEqual(schedulesWith({}), []);
  for (const value of ['', '0', 'true', 'yes']) {
    assert.deepEqual(schedulesWith({ EXTRACTION_SCHEDULED: value }), [], `"${value}" does not switch it on`);
  }
});

test('EXTRACTION_SCHEDULED=1 schedules it every five minutes with its daily cap', () => {
  const schedules = schedulesWith({ EXTRACTION_SCHEDULED: '1' });
  assert.equal(schedules.length, 1);
  const schedule = schedules[0];
  assert.ok(schedule);
  assert.equal(schedule.cron, '*/5 * * * *');
  assert.equal(schedule.payload.dailyCapUsd, 10);
});
