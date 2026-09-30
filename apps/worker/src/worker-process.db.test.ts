import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { sql, type Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';
import { env } from './env.ts';
import { REPOSITORY_ROOT } from './observability.ts';
import { testWorkerDatabase } from './test-support/runtime.ts';
import { until } from './test-support/wait.ts';

// The worker as it runs (CS-32 criteria 1, 2 and 4): `node src/main.ts` on the worker's own role, a health check that
// proves it reaches PostgreSQL and the job queue, and a SIGTERM that drains and exits 0. Then the role itself: its
// settings, and the privileges it must not have.

const MAIN = fileURLToPath(new URL('main.ts', import.meta.url));

let worker: Kysely<DB>;

before(() => {
  worker = testWorkerDatabase();
});

after(async () => {
  await worker.destroy();
});

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  await new Promise<void>((resolve) => {
    server.close(() => {
      resolve();
    });
  });
  if (address === null || typeof address === 'string') throw new Error('no port');
  return address.port;
}

function newestMigration(): string {
  const files = readdirSync(path.join(REPOSITORY_ROOT, 'db', 'migrations'))
    .filter((file) => file.endsWith('.sql'))
    .sort();
  return (files.at(-1) ?? '').slice(0, 14);
}

type Line = { level: string; msg: string; [field: string]: unknown };

function startedInstance(lines: readonly Line[]): string {
  const instanceId = lines.find((line) => line.msg === 'worker started')?.instanceId;
  if (typeof instanceId !== 'string') throw new Error('the worker did not name its instance');
  return instanceId;
}

async function heartbeatOf(instanceId: string) {
  const { rows } = await sql<{
    version: string;
    pid: number;
    stopped_at: Date | null;
    beat_age_seconds: number;
  }>`
    SELECT version, pid, stopped_at, extract(epoch FROM now() - beat_at)::float8 AS beat_age_seconds
    FROM worker_heartbeat WHERE instance_id = ${instanceId}`.execute(worker);
  const row = rows.at(0);
  if (row === undefined) throw new Error(`no heartbeat for ${instanceId}`);
  return row;
}

test('the worker starts on its own role, answers its health check, and drains and exits 0 on SIGTERM', async () => {
  const port = await freePort();
  const child = spawn(
    process.execPath,
    ['--experimental-strip-types', '--no-warnings=ExperimentalWarning', '--enable-source-maps', MAIN],
    {
      env: {
        NODE_ENV: 'production',
        WORKER_DATABASE_URL: env.databaseUrl,
        WORKER_HEALTH_PORT: String(port),
        CRAWLER_USER_AGENT: 'CarshenasTest/1.0 (+test@example.com)',
        LOG_LEVEL: 'info',
        LOG_FORMAT: 'json',
        CARSHENAS_RELEASE: 'test',
        // CS-52's extraction calls models, so the worker needs a key to start. This one never reaches Metis: the price
        // list is read from a port nothing listens on, so the job finds no price and calls no model.
        METIS_API_KEY: 'tpsg-worker-process-test',
        METIS_PRICING_URL: 'http://127.0.0.1:9/prices',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  const lines: Line[] = [];
  let stderr = '';
  let buffered = '';
  child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
    buffered += chunk;
    const complete = buffered.split('\n');
    buffered = complete.pop() ?? '';
    for (const line of complete) if (line.trim()) lines.push(JSON.parse(line) as Line);
  });
  child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));
  const exited = new Promise<number | null>((resolve) => {
    child.on('exit', (code) => {
      resolve(code);
    });
  });
  try {
    await until('the worker has started', () => lines.some((line) => line.msg === 'worker started'), 20_000);
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(response.status, 200);
    const report = (await response.json()) as {
      status: string;
      database: { migration: string };
      queue: { schemaVersion: number };
    };
    assert.equal(report.status, 'ok');
    assert.equal(report.database.migration, newestMigration());
    assert.equal(report.queue.schemaVersion, 43);
    // It says it is alive in the database (CS-41 criterion 1): its row, with its release and process.
    const alive = await heartbeatOf(startedInstance(lines));
    assert.equal(alive.version, 'test');
    assert.equal(alive.pid, child.pid);
    assert.equal(alive.stopped_at, null);
    assert.ok(alive.beat_age_seconds < 15);
  } finally {
    child.kill('SIGTERM');
  }
  assert.equal(await exited, 0, stderr);
  // A clean stop marks the row, so the section shows the worker stopped rather than silent.
  const stopped = await heartbeatOf(startedInstance(lines));
  assert.ok(stopped.stopped_at instanceof Date);
  assert.equal(stderr, '');
  assert.deepEqual(
    lines.map((line) => line.msg).filter((msg) => msg.startsWith('worker')),
    ['worker runtime started', 'worker started', 'worker stopping', 'worker stopped'],
  );
  for (const line of lines) {
    assert.equal(line.service, 'carshenas-worker');
    assert.equal(line.version, 'test');
  }
});

test('the worker role has its own limits and name, and cannot create temporary tables', async () => {
  const { rows } = await sql<{
    statement: string;
    lock: string;
    idle: string;
    transaction: string;
    name: string;
  }>`
    SELECT current_setting('statement_timeout') AS statement,
           current_setting('lock_timeout') AS lock,
           current_setting('idle_in_transaction_session_timeout') AS idle,
           current_setting('transaction_timeout') AS transaction,
           current_setting('application_name') AS name`.execute(worker);
  assert.deepEqual(rows[0], {
    statement: '30s',
    lock: '5s',
    idle: '30s',
    transaction: '2min',
    name: 'carshenas-worker',
  });
  await assert.rejects(sql`CREATE TEMP TABLE shadow (id bigint)`.execute(worker), { code: '42501' });
  await assert.rejects(sql`UPDATE source SET crawl_state = 'enabled'`.execute(worker), { code: '42501' });
});
