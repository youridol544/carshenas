import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { loadCrawl, loadJobs, loadProblems } from '@/features/admin/server/pipeline-queries';
import { assertScratchDatabase, createAccount, ownerDatabase } from '@/server/db/account-test-database';
import { adminDatabase } from '@/server/db/admin-database';
import { seedJob, seedLaneBudget, seedQueue } from '@/server/db/pipeline-test-database';

// The worker and pipeline screens' reads (CS-41) against the scratch database `pnpm db:check` migrated, through the
// section's own pool, as carshenas_admin: rows seeded as the owner, the way the worker writes them, then read back.
// Each test seeds a source and a queue of its own, so tests never share one.

const test_ = vi.hoisted(() => {
  class NotFound extends Error {}
  return {
    NotFound,
    account: undefined as { id: number; username: string; role: 'buyer' | 'superadmin' } | undefined,
  };
});

vi.mock('@/server/observability/logger', async () => {
  const { recordingLogger } = await import('@/server/observability/recording-logger');
  return { logger: recordingLogger(), captureError: vi.fn() };
});
vi.mock('@/server/auth/current-account', () => ({
  requireSuperadmin: () => {
    if (test_.account?.role !== 'superadmin') throw new test_.NotFound('not found');
    return Promise.resolve(test_.account);
  },
}));

const owner = ownerDatabase();
let superadmin: { id: number; username: string };

beforeAll(async () => {
  await assertScratchDatabase(owner);
  superadmin = await createAccount(owner, 'superadmin');
});

afterAll(async () => {
  await Promise.all([owner.destroy(), adminDatabase().destroy()]);
});

beforeEach(() => {
  test_.account = { ...superadmin, role: 'superadmin' };
});

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

/** A crawled, enabled source with a current policy check and a lane, as the worker's migrations leave one. */
async function createSource(): Promise<{ id: string; policyCheckId: number }> {
  const id = `p_${randomBytes(5).toString('hex')}`;
  await owner
    .insertInto('source')
    .values({
      id,
      origin: 'external',
      access_method: 'crawl',
      name_fa: 'منبع آزمایشی',
      base_url: 'https://test.example',
      listing_visibility: 'public',
      crawl_state: 'enabled',
      min_request_interval_ms: 3_000,
      daily_request_budget: 12_000,
    })
    .execute();
  const { id: policyCheckId } = await owner
    .insertInto('source_policy_check')
    .values({
      source_id: id,
      checked_at: new Date(),
      checked_by: 'the integration tests',
      terms_summary: 'A test source: nothing is read from a real site.',
      verdict: 'allowed',
      photos_allowed: false,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return { id, policyCheckId };
}

async function createRun(
  source: { id: string; policyCheckId: number },
  run: {
    kind: 'discovery' | 'detail' | 'sweep';
    status: 'running' | 'succeeded' | 'failed';
    startedAt: Date;
    seconds?: number;
    counts?: Record<string, number>;
  },
): Promise<number> {
  const { id } = await owner
    .insertInto('crawl_run')
    .values({
      source_id: source.id,
      policy_check_id: source.policyCheckId,
      kind: run.kind,
      status: run.status,
      started_at: run.startedAt,
      finished_at: run.seconds === undefined ? null : new Date(run.startedAt.getTime() + run.seconds * 1_000),
      counts: JSON.stringify(run.counts ?? {}),
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return id;
}

async function logFetch(
  sourceId: string,
  crawlRunId: number,
  fetch: { outcome: 'ok' | 'not_found' | 'blocked' | 'challenge'; at: Date; status: number; url?: string },
): Promise<void> {
  await owner
    .insertInto('fetch_log')
    .values({
      source_id: sourceId,
      crawl_run_id: crawlRunId,
      url: fetch.url ?? `https://test.example/post/${randomBytes(3).toString('hex')}`,
      requested_at: fetch.at,
      http_status: fetch.status,
      outcome: fetch.outcome,
      duration_ms: 120,
    })
    .execute();
}

test('crawl runs show per source with their kind, state, duration, outcomes and the day spent against the budget', async () => {
  const source = await createSource();
  await seedLaneBudget(owner, source.id, 0, 42);
  const detail = await createRun(source, {
    kind: 'detail',
    status: 'succeeded',
    startedAt: minutesAgo(10),
    seconds: 4,
    counts: { snapshotsStored: 1, priceEvents: 1 },
  });
  await createRun(source, { kind: 'detail', status: 'succeeded', startedAt: minutesAgo(20), seconds: 6 });
  await createRun(source, { kind: 'sweep', status: 'failed', startedAt: minutesAgo(30), seconds: 2 });
  // Outside the hour: counted in 24 hours only.
  await createRun(source, { kind: 'discovery', status: 'succeeded', startedAt: minutesAgo(180), seconds: 3 });
  await createRun(source, { kind: 'discovery', status: 'running', startedAt: minutesAgo(1) });
  await logFetch(source.id, detail, { outcome: 'ok', at: minutesAgo(10), status: 200 });
  await logFetch(source.id, detail, { outcome: 'not_found', at: minutesAgo(9), status: 404 });

  const hour = (await loadCrawl('1h')).sources.find((candidate) => candidate.id === source.id);
  expect(hour).toMatchObject({ nameFa: 'منبع آزمایشی', spentToday: 42, dailyBudget: 12_000 });
  expect(hour?.runGroups).toEqual([
    { kind: 'detail', status: 'succeeded', runs: 2, averageSeconds: 5 },
    { kind: 'discovery', status: 'running', runs: 1, averageSeconds: null },
    { kind: 'sweep', status: 'failed', runs: 1, averageSeconds: 2 },
  ]);
  expect(hour?.outcomes).toEqual({ ok: 1, not_found: 1 });
  expect(hour?.recentRuns.map((run) => [run.kind, run.status, run.seconds])).toEqual([
    ['discovery', 'running', null],
    ['detail', 'succeeded', 4],
    ['detail', 'succeeded', 6],
    ['sweep', 'failed', 2],
    ['discovery', 'succeeded', 3],
  ]);
  expect(hour?.recentRuns[1]?.counts).toEqual({ snapshotsStored: 1, priceEvents: 1 });

  const day = (await loadCrawl('24h')).sources.find((candidate) => candidate.id === source.id);
  expect(day?.runGroups).toContainEqual({
    kind: 'discovery',
    status: 'succeeded',
    runs: 1,
    averageSeconds: 3,
  });
});

test('a source without a lane, or whose lane counted another day, has spent nothing today', async () => {
  const withoutLane = await createSource();
  const yesterday = await createSource();
  await seedLaneBudget(owner, yesterday.id, 1, 900);
  const { sources } = await loadCrawl('24h');
  for (const id of [withoutLane.id, yesterday.id]) {
    expect(sources.find((candidate) => candidate.id === id)).toMatchObject({ spentToday: 0, runGroups: [] });
  }
});

test('source problems show the refused requests with their time and address, the stop they caused, and unread values', async () => {
  const source = await createSource();
  const run = await createRun(source, {
    kind: 'detail',
    status: 'succeeded',
    startedAt: minutesAgo(5),
    seconds: 1,
  });
  await logFetch(source.id, run, { outcome: 'ok', at: minutesAgo(5), status: 200 });
  // A refused request stops the source (fetch_log_stops_on_block), as the crawler's own would.
  await logFetch(source.id, run, {
    outcome: 'blocked',
    at: minutesAgo(4),
    status: 403,
    url: 'https://test.example/post/refused',
  });

  const { id: listingId } = await owner
    .insertInto('listing')
    .values({
      source_id: source.id,
      source_listing_key: 'unread-1',
      url: 'https://test.example/post/unread-1',
      origin: 'external',
      status: 'active',
      listed_at: minutesAgo(60),
      last_seen_at: minutesAgo(5),
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  await owner
    .insertInto('listing_unparsed_value')
    .values({ listing_id: listingId, field: 'mileage_km', raw_text: 'حدود صد هزار' })
    .execute();

  const problems = (await loadProblems()).sources.find((candidate) => candidate.id === source.id);
  expect(problems?.stop).toMatchObject({ reason: 'blocked' });
  expect(problems?.fetches).toEqual([
    {
      id: expect.any(Number) as number,
      requestedAt: expect.any(String) as string,
      outcome: 'blocked',
      httpStatus: 403,
      url: 'https://test.example/post/refused',
      runKind: 'detail',
    },
  ]);
  expect(
    Math.abs(Date.parse(problems?.fetches[0]?.requestedAt ?? '') - minutesAgo(4).getTime()),
  ).toBeLessThan(5_000);
  expect(problems?.unparsed).toEqual([{ field: 'mileage_km', rawText: 'حدود صد هزار', listings: 1 }]);
});

test('jobs show per queue and state, with recent failures and dead letters, their error and trace id', async () => {
  const queue = `test.${randomBytes(4).toString('hex')}`;
  await seedQueue(owner, queue);
  await seedQueue(owner, 'dead-letter');
  const failedId = randomUUID();
  const deadId = randomUUID();
  const traceId = randomBytes(16).toString('hex');
  const error = { type: 'TypeError', message: 'snapshot.price is undefined', traceId };
  await seedJob(owner, { queue, state: 'created', kind: 'test.job' });
  await seedJob(owner, { queue, state: 'created', kind: 'test.job' });
  await seedJob(owner, { queue, state: 'retry', kind: 'test.job', retryCount: 1 });
  await seedJob(owner, {
    id: failedId,
    queue,
    state: 'failed',
    kind: 'test.job',
    retryCount: 2,
    output: error,
  });
  await seedJob(owner, {
    id: deadId,
    queue: 'dead-letter',
    state: 'created',
    kind: 'test.job',
    sourceName: queue,
    sourceOutput: error,
  });

  const jobs = await loadJobs();
  expect(jobs.queues.find((candidate) => candidate.queue === queue)).toEqual({
    queue,
    counts: { created: 2, retry: 1, failed: 1 },
  });
  expect(jobs.failures.find((job) => job.id === failedId)).toMatchObject({
    queue,
    kind: 'test.job',
    attempts: 3,
    attemptsAllowed: 3,
    error,
  });
  expect(jobs.deadLetters.find((job) => job.id === deadId)).toMatchObject({
    fromQueue: queue,
    kind: 'test.job',
    error,
  });
});

test('nobody but the superadmin reads the worker', async () => {
  test_.account = { ...superadmin, role: 'buyer' };
  await expect(loadJobs()).rejects.toBeInstanceOf(test_.NotFound);
  await expect(loadCrawl('1h')).rejects.toBeInstanceOf(test_.NotFound);
  await expect(loadProblems()).rejects.toBeInstanceOf(test_.NotFound);
});
