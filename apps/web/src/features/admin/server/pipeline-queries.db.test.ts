import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { changeJobStateAction } from '@/features/admin/admin-actions';
import {
  loadCrawl,
  loadJobs,
  loadListings,
  loadProblems,
  loadWorker,
} from '@/features/admin/server/pipeline-queries';
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
    headers: new Headers(),
    refresh: vi.fn(),
  };
});
vi.mock('next/headers', () => ({ headers: () => Promise.resolve(test_.headers) }));
vi.mock('next/cache', () => ({ refresh: test_.refresh }));

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
  test_.headers.set('sec-fetch-site', 'same-origin');
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

test('a superadmin retries a failed job and cancels one waiting to run again, and both show with who did it', async () => {
  const queue = `test.${randomBytes(4).toString('hex')}`;
  await seedQueue(owner, queue);
  const failedId = randomUUID();
  const waitingId = randomUUID();
  await seedJob(owner, {
    id: failedId,
    queue,
    state: 'failed',
    kind: 'test.job',
    retryCount: 2,
    output: { type: 'E' },
  });
  await seedJob(owner, {
    id: waitingId,
    queue,
    state: 'retry',
    kind: 'test.job',
    retryCount: 1,
    output: { type: 'E' },
  });
  const before = await loadJobs();
  expect(before.failures.find((job) => job.id === failedId)?.state).toBe('failed');
  expect(before.failures.find((job) => job.id === waitingId)?.state).toBe('retry');

  const send = (fields: Record<string, string>) => {
    const data = new FormData();
    for (const [name, value] of Object.entries(fields)) data.set(name, value);
    return changeJobStateAction({ status: 'idle' }, data);
  };
  expect(await send({ queue, jobId: failedId, seenState: 'failed', action: 'retry' })).toMatchObject({
    status: 'changed',
    action: 'retry',
  });
  expect(await send({ queue, jobId: failedId, seenState: 'failed', action: 'retry' })).toMatchObject({
    status: 'unchanged',
  });
  expect(await send({ queue, jobId: waitingId, seenState: 'retry', action: 'cancel' })).toMatchObject({
    status: 'changed',
    action: 'cancel',
  });
  expect(await send({ queue, jobId: waitingId, seenState: 'failed', action: 'cancel' })).toMatchObject({
    status: 'invalid',
  });
  expect(test_.refresh).toHaveBeenCalled();

  const after = await loadJobs();
  expect(after.queues.find((candidate) => candidate.queue === queue)?.counts).toEqual({
    retry: 1,
    cancelled: 1,
  });
  expect(after.changes.slice(0, 2)).toEqual([
    expect.objectContaining({ queue, jobId: waitingId, action: 'cancel', changedBy: superadmin.username }),
    expect.objectContaining({ queue, jobId: failedId, action: 'retry', changedBy: superadmin.username }),
  ]);
});

test('a request from another site changes no job', async () => {
  test_.headers.set('sec-fetch-site', 'cross-site');
  await expect(changeJobStateAction({ status: 'idle' }, new FormData())).rejects.toThrow(/outside this site/);
});

test('the worker shows alive while a process beats, silent when its beats stop, and stopped after a clean stop', async () => {
  const beat = async (secondsAgo: number, stopped = false) => {
    const instanceId = randomUUID();
    const at = new Date(Date.now() - secondsAgo * 1_000);
    await owner
      .insertInto('worker_heartbeat')
      .values({
        instance_id: instanceId,
        hostname: 'test-host',
        pid: 4242,
        version: 'test-release',
        started_at: new Date(at.getTime() - 3_600_000),
        beat_at: at,
        stopped_at: stopped ? at : null,
      })
      .execute();
    return instanceId;
  };
  await beat(60);
  expect((await loadWorker()).status).toBe('silent');
  const running = await beat(5);
  const alive = await loadWorker();
  expect(alive.status).toBe('alive');
  expect(alive.processes[0]).toMatchObject({
    instanceId: running,
    state: 'alive',
    version: 'test-release',
    pid: 4242,
  });
  await owner
    .updateTable('worker_heartbeat')
    .set({ stopped_at: new Date(), beat_at: new Date() })
    .where('instance_id', '=', running)
    .execute();
  const stopped = await loadWorker();
  expect(stopped.status).toBe('stopped');
  expect(stopped.processes[0]).toMatchObject({ instanceId: running, state: 'stopped' });
  expect(stopped.processes[1]).toMatchObject({ state: 'silent' });
});

test('a process is alive 39 seconds after its last beat and down at 41: silence ends at 40 s (criterion 1)', async () => {
  const at = async (secondsAgo: number) => {
    const instanceId = randomUUID();
    const beat = new Date(Date.now() - secondsAgo * 1_000);
    await owner
      .insertInto('worker_heartbeat')
      .values({
        instance_id: instanceId,
        hostname: 'edge-host',
        pid: 1,
        version: 'edge',
        started_at: new Date(beat.getTime() - 60_000),
        beat_at: beat,
      })
      .execute();
    return instanceId;
  };
  const beating = await at(39);
  const silent = await at(41);
  const { processes } = await loadWorker();
  expect(processes.find((process) => process.instanceId === beating)?.state).toBe('alive');
  expect(processes.find((process) => process.instanceId === silent)?.state).toBe('silent');
});

test('listings show per source and tracked model: total, active, new, changed and gone in the window, and the freshness chart', async () => {
  const source = await createSource();
  const hour = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000);
  await owner
    .insertInto('freshness_measurement')
    .values([
      {
        source_id: source.id,
        source_model_key: null,
        measured_at: new Date(hour.getTime() - 3_600_000),
        new_listings: 3,
        left_market: 0,
        active_listings: 2,
        seen_within_48h: 2,
        last_seen_age_p50_minutes: 40,
      },
      {
        source_id: source.id,
        source_model_key: null,
        measured_at: hour,
        new_listings: 4,
        left_market: 1,
        active_listings: 3,
        seen_within_48h: 3,
        last_seen_age_p50_minutes: 30,
      },
      {
        source_id: source.id,
        source_model_key: 'Peugeot 206',
        measured_at: hour,
        new_listings: 2,
        left_market: 0,
        active_listings: 2,
        seen_within_48h: 2,
      },
    ])
    .execute();
  // The tracked key names a catalogue model, as the catalogue job leaves it (CS-50).
  const slug = `t${randomBytes(4).toString('hex')}`;
  const { id: makeId } = await owner
    .insertInto('make')
    .values({ slug, name_en: 'Test make' })
    .returning('id')
    .executeTakeFirstOrThrow();
  const { id: modelId } = await owner
    .insertInto('model')
    .values({ make_id: makeId, slug, name_en: 'Test 206', name_fa: 'پژو ۲۰۶ آزمایشی' })
    .returning('id')
    .executeTakeFirstOrThrow();
  await owner
    .insertInto('catalogue_source_key')
    .values({
      source_id: source.id,
      source_model_key: 'Peugeot 206',
      level: 'model',
      make_id: makeId,
      model_id: modelId,
    })
    .execute();
  const listing = async (
    key: string,
    modelKey: string,
    fields: {
      createdMinutesAgo: number;
      seenMinutesAgo: number;
      goneMinutesAgo?: number;
      tracked?: boolean;
    },
  ) => {
    const { id } = await owner
      .insertInto('listing')
      .values({
        source_id: source.id,
        source_listing_key: key,
        url: `https://test.example/post/${key}`,
        origin: 'external',
        status: fields.goneMinutesAgo === undefined ? 'active' : 'gone',
        listed_at: minutesAgo(fields.createdMinutesAgo + 60),
        created_at: minutesAgo(fields.createdMinutesAgo),
        last_seen_at: minutesAgo(fields.seenMinutesAgo),
        delisted_at: fields.goneMinutesAgo === undefined ? null : minutesAgo(fields.goneMinutesAgo),
        source_model_key: modelKey,
        ...(fields.tracked === true && { make_id: makeId, model_id: modelId, catalogue_match: 'model' }),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return id;
  };
  const fresh = await listing('a', 'Peugeot 206', {
    createdMinutesAgo: 10,
    seenMinutesAgo: 10,
    tracked: true,
  });
  // A trim under the tracked model is matched to its model, and counts with it.
  await listing('b', 'Peugeot 206 SD', { createdMinutesAgo: 3 * 24 * 60, seenMinutesAgo: 30, tracked: true });
  const gone = await listing('c', 'Pride 131', {
    createdMinutesAgo: 3 * 24 * 60,
    seenMinutesAgo: 20,
    goneMinutesAgo: 20,
  });
  const run = await createRun(source, {
    kind: 'detail',
    status: 'succeeded',
    startedAt: minutesAgo(5),
    seconds: 1,
  });
  await logFetch(source.id, run, { outcome: 'ok', at: minutesAgo(5), status: 200 });
  const { id: fetchId } = await owner
    .selectFrom('fetch_log')
    .select('id')
    .where('crawl_run_id', '=', run)
    .executeTakeFirstOrThrow();
  await owner
    .insertInto('listing_price_event')
    .values(
      // A listing's first event records its first price; only the second is a change of price.
      [minutesAgo(8), minutesAgo(5)].map((observedAt, index) => ({
        listing_id: fresh,
        observed_at: observedAt,
        price_type: 'asking',
        asking_price_toman: index === 0 ? 1_300_000_000 : 1_250_000_000,
        fetch_log_id: fetchId,
      })),
    )
    .execute();
  // Another listing's first price is no change.
  await owner
    .insertInto('listing_price_event')
    .values({
      listing_id: gone,
      observed_at: minutesAgo(25),
      price_type: 'asking',
      asking_price_toman: 400_000_000,
      fetch_log_id: fetchId,
    })
    .execute();

  const hourly = (await loadListings('1h')).sources.find((candidate) => candidate.id === source.id);
  expect(hourly?.flows).toEqual([
    { model: null, total: 3, active: 2, added: 1, changed: 1, gone: 1, lastCheckMedianMinutes: 20 },
    {
      model: { key: 'Peugeot 206', nameFa: 'پژو ۲۰۶ آزمایشی' },
      total: 2,
      active: 2,
      added: 1,
      changed: 1,
      gone: 0,
      lastCheckMedianMinutes: 20,
    },
  ]);
  expect(hourly?.chart.map((point) => [point.added, point.gone, point.lastCheckMedianMinutes])).toEqual([
    [3, 0, 40],
    [4, 1, 30],
  ]);
  const weekly = (await loadListings('7d')).sources.find((candidate) => candidate.id === source.id);
  expect(weekly?.flows[0]).toMatchObject({ added: 3, gone: 1 });
});

test('nobody but the superadmin reads the worker', async () => {
  test_.account = { ...superadmin, role: 'buyer' };
  await expect(loadWorker()).rejects.toBeInstanceOf(test_.NotFound);
  await expect(loadListings('1h')).rejects.toBeInstanceOf(test_.NotFound);
  await expect(loadJobs()).rejects.toBeInstanceOf(test_.NotFound);
  await expect(loadCrawl('1h')).rejects.toBeInstanceOf(test_.NotFound);
  await expect(loadProblems()).rejects.toBeInstanceOf(test_.NotFound);
});
