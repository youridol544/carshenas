import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { sql, type Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';
import { createErrorCapture } from '@carshenas/observability/capture';
import { createLogger } from '@carshenas/observability/logger';
import { testWorkerDatabase } from '../test-support/runtime.ts';
import { until } from '../test-support/wait.ts';
import { startHeartbeat } from './heartbeat.ts';

// The worker's heartbeat (CS-41 criterion 1) on its own role: a row at start, beats from the database's clock, a stop,
// and the rows of processes silent for more than a week deleted by the next start.

let worker: Kysely<DB>;
const errors = createErrorCapture(
  createLogger({ service: 'carshenas-worker', version: 'test', environment: 'test', level: 'silent' }),
);

before(() => {
  worker = testWorkerDatabase();
});

after(async () => {
  await worker.destroy();
});

async function row(instanceId: string) {
  const { rows } = await sql<{ started_at: Date; beat_at: Date; stopped_at: Date | null; version: string }>`
    SELECT started_at, beat_at, stopped_at, version FROM worker_heartbeat WHERE instance_id = ${instanceId}`.execute(
    worker,
  );
  return rows.at(0);
}

test('a running worker beats, and a stop marks its row', async () => {
  const heartbeat = await startHeartbeat({ db: worker, version: 'test-beat', errors, intervalMs: 50 });
  const started = await row(heartbeat.instance.instanceId);
  assert.ok(started);
  assert.equal(started.version, 'test-beat');
  assert.equal(started.stopped_at, null);
  await until(
    'a beat',
    async () =>
      ((await row(heartbeat.instance.instanceId))?.beat_at.getTime() ?? 0) > started.beat_at.getTime(),
    5_000,
  );
  await heartbeat.stop();
  const stopped = await row(heartbeat.instance.instanceId);
  assert.ok(stopped?.stopped_at instanceof Date);
  assert.ok(stopped.stopped_at.getTime() >= stopped.started_at.getTime());
});

test('a start deletes the rows of processes silent for more than a week, and keeps the others', async () => {
  const old = '00000000-0000-4000-8000-00000000c541';
  const recent = '00000000-0000-4000-8000-00000000c542';
  await sql`DELETE FROM worker_heartbeat WHERE instance_id IN (${old}, ${recent})`.execute(worker);
  await sql`
    INSERT INTO worker_heartbeat (instance_id, hostname, pid, version, started_at, beat_at)
    VALUES (${old}, 'old-host', 1, 'old', now() - interval '9 days', now() - interval '8 days'),
           (${recent}, 'recent-host', 2, 'recent', now() - interval '2 days', now() - interval '1 day')`.execute(
    worker,
  );
  const heartbeat = await startHeartbeat({ db: worker, version: 'test-prune', errors, intervalMs: 60_000 });
  await heartbeat.stop();
  assert.equal(await row(old), undefined);
  assert.equal((await row(recent))?.version, 'recent');
});
