import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { HealthReport } from './health.ts';
import { startHealthServer } from './health-server.ts';

const OK: HealthReport = {
  status: 'ok',
  database: { migration: '20260929082449', latencyMs: 2 },
  queue: { schemaVersion: 43 },
  lanes: [],
};

test('GET /health answers 200 with the report when the worker can work, 503 when it cannot, and nothing else', async () => {
  let report: HealthReport = OK;
  const server = await startHealthServer(0, () => Promise.resolve(report));
  try {
    const base = `http://127.0.0.1:${server.port}`;
    const ok = await fetch(`${base}/health`);
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await ok.json(), OK);
    report = { status: 'unavailable', failing: ['database'] };
    const down = await fetch(`${base}/health`);
    assert.equal(down.status, 503);
    assert.deepEqual(await down.json(), { status: 'unavailable', failing: ['database'] });
    assert.equal((await fetch(`${base}/`)).status, 404);
    assert.equal((await fetch(`${base}/health`, { method: 'POST' })).status, 404);
  } finally {
    await server.close();
  }
});
