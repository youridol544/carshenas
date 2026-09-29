import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { after, before, test, type TestContext } from 'node:test';
import type { Kysely } from 'kysely';
import type { DB, JsonObject } from '@carshenas/db/db-types';
import { createTestSource, jobsOf, openScratchDatabase } from '../db/test-database.ts';
import type { PacingPolicy } from '../runtime/pacing.ts';
import { laneQueue } from '../runtime/queues.ts';
import { photoUrlsOf } from '../sources/divar/post.ts';
import {
  postAnswer,
  searchAnswer,
  type FixturePage,
  type FixturePost,
  type FixtureRow,
} from '../test-support/divar-fixtures.ts';
import { startTestWorker, TEST_USER_AGENT, type TestWorker } from '../test-support/runtime.ts';
import {
  startStubSource,
  type StubAnswer,
  type StubRequest,
  type StubSource,
} from '../test-support/stub-source.ts';
import { until } from '../test-support/wait.ts';
import { divarJobs, type DivarJobs, type MeasureLimits } from './divar.ts';

// Divar's crawl against a local stand-in for its API (CS-33 criteria 1 to 4 and 6): the jobs, the lane, the database
// rules and the real three-second floor between requests. Nothing here reaches Divar. Each test has a source and a
// lane of its own; the worker stops and the source is purged when the test ends.

let owner: Kysely<DB>;

before(async () => {
  owner = await openScratchDatabase();
});

after(async () => {
  await owner.destroy();
});

const TRACKED = [{ brandModel: 'Peugeot 206', nameFa: 'پژو ۲۰۶' }];
const SEARCH = '/v8/postlist/w/search';
const POST = '/v8/posts-v2/web/';

type Script = {
  /** Answers to the search, in order; the last repeats. */
  readonly search?: StubAnswer[];
  /** Answers per post token, in order; the last repeats. */
  readonly posts?: Record<string, StubAnswer[]>;
  /** Answers to the search by the brand_model value it asks for (a measurement), ROOT for none; in order, the last repeats. */
  readonly bySlice?: Record<string, StubAnswer | StubAnswer[]>;
};

function page(rows: readonly FixtureRow[], options: FixturePage = {}): StubAnswer {
  return { status: 200, body: searchAnswer(rows, options) };
}

function post(fixture: FixturePost): StubAnswer {
  return { status: 200, body: postAnswer(fixture) };
}

function brandModelOf(request: StubRequest): string {
  const body: unknown = JSON.parse(request.body);
  const values = (
    body as {
      search_data?: { form_data?: { data?: { brand_model?: { repeated_string?: { value?: string[] } } } } };
    }
  ).search_data?.form_data?.data?.brand_model?.repeated_string?.value;
  return values?.join(',') ?? 'ROOT';
}

async function divarStub(context: TestContext, script: Script): Promise<StubSource> {
  const counts = new Map<string, number>();
  const next = (key: string, answers: StubAnswer[] | undefined): StubAnswer => {
    const index = counts.get(key) ?? 0;
    counts.set(key, index + 1);
    return answers?.[Math.min(index, answers.length - 1)] ?? { status: 404, body: '{"code": 5}' };
  };
  const stub = await startStubSource((request) => {
    if (request.method === 'POST' && request.path === SEARCH) {
      if (script.bySlice) {
        const slice = brandModelOf(request);
        const answers = script.bySlice[slice];
        if (answers === undefined) return { status: 500 };
        return next(`slice ${slice}`, Array.isArray(answers) ? answers : [answers]);
      }
      return next('search', script.search);
    }
    if (request.method === 'GET' && request.path.startsWith(POST)) {
      const token = request.path.slice(POST.length);
      return next(token, script.posts?.[token]);
    }
    return { status: 418, body: 'not a Divar address the crawler may use' };
  });
  context.after(() => stub.close());
  return stub;
}

type Setup = {
  readonly sourceId: string;
  readonly jobs: DivarJobs;
  readonly worker: TestWorker;
  readonly stub: StubSource;
};

async function setUp(
  context: TestContext,
  script: Script,
  options: {
    policy?: 'current' | 'stale';
    pacing?: Partial<PacingPolicy>;
    measure?: Partial<MeasureLimits>;
  } = {},
): Promise<Setup> {
  const stub = await divarStub(context, script);
  const sourceId = await createTestSource(owner, context, { policy: options.policy ?? 'current' });
  const jobs = divarJobs({
    sourceId,
    apiUrl: stub.url,
    trackedModels: TRACKED,
    scheduled: false,
    discovery: { minimumGapMinutes: 0 },
    measure: { allPages: 1, ...options.measure },
  });
  const worker = await startTestWorker(jobs.all, options.pacing);
  context.after(() => worker.stop());
  if (options.policy !== 'stale') {
    await until('the lane is open', () =>
      worker.runtime.lanes().some((lane) => lane.sourceId === sourceId && lane.state === 'running'),
    );
  }
  return { sourceId, jobs, worker, stub };
}

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

async function snapshotsOf(sourceId: string) {
  return owner
    .selectFrom('snapshot as s')
    .innerJoin('listing as l', 'l.id', 's.listing_id')
    .select([
      'l.source_listing_key as token',
      's.id',
      's.url',
      's.canonical_version',
      's.payload',
      's.content_sha256',
    ])
    .where('l.source_id', '=', sourceId)
    .orderBy('s.id')
    .execute();
}

async function fetchesOf(sourceId: string) {
  return owner
    .selectFrom('fetch_log')
    .select([
      'url',
      'method',
      'outcome',
      'http_status',
      'requested_at',
      'listing_id',
      'snapshot_id',
      'crawl_run_id',
    ])
    .where('source_id', '=', sourceId)
    .orderBy('id')
    .execute();
}

async function runsOf(sourceId: string) {
  return owner
    .selectFrom('crawl_run')
    .select(['id', 'kind', 'status', 'counts', 'started_at', 'finished_at'])
    .where('source_id', '=', sourceId)
    .orderBy('id')
    .execute();
}

async function pricesOf(sourceId: string, token: string) {
  return owner
    .selectFrom('listing_price_event as e')
    .innerJoin('listing as l', 'l.id', 'e.listing_id')
    .select(['e.price_type', 'e.asking_price_toman', 'e.previous_price_toman', 'e.last_asking_price_toman'])
    .where('l.source_id', '=', sourceId)
    .where('l.source_listing_key', '=', token)
    .orderBy('e.observed_at')
    .execute();
}

async function sourceRow(sourceId: string) {
  return owner
    .selectFrom('source')
    .select(['crawl_state', 'stop_reason', 'stopped_at'])
    .where('id', '=', sourceId)
    .executeTakeFirstOrThrow();
}

/** Requests the stub saw, as `METHOD path`. */
function asked(stub: StubSource): string[] {
  return stub.requests.map((request) => `${request.method} ${request.path}`);
}

/**
 * The same, with each run of post requests sorted: details sent in one transaction share their creation time, and the
 * queue orders them by a random id after it.
 */
function askedInRounds(stub: StubSource): string[] {
  const rounds: string[][] = [];
  for (const request of asked(stub)) {
    const last = rounds.at(-1);
    if (request.startsWith('GET') && last?.[0]?.startsWith('GET')) last.push(request);
    else rounds.push([request]);
  }
  return rounds.flatMap((round) => [...round].sort());
}

function gapsBetween(stub: StubSource): number[] {
  const gaps: number[] = [];
  for (let i = 1; i < stub.requests.length; i++) {
    const answered = stub.requests[i - 1]?.answeredAt;
    const received = stub.requests[i]?.receivedAt;
    if (answered !== undefined && received !== undefined) gaps.push(received - answered);
  }
  return gaps;
}

const PRICE = '۱,۲۵۰,۰۰۰,۰۰۰ تومان';

test('discovery reads the tracked models newest first, fetches each new listing once, and stores one snapshot per listing', async (context) => {
  const firstPage = page(
    [
      { token: 'gaPROMO01', sortedAt: minutesAgo(3 * 24 * 60), promoted: true },
      { token: 'gaNEW0001', sortedAt: minutesAgo(5) },
      { token: 'gaNEW0002', sortedAt: minutesAgo(10) },
    ],
    { hasNextPage: false },
  );
  const { sourceId, jobs, worker, stub } = await setUp(context, {
    search: [firstPage],
    posts: {
      gaPROMO01: [post({ token: 'gaPROMO01', price: PRICE })],
      gaNEW0001: [post({ token: 'gaNEW0001', price: PRICE, published: '۲ مهر ۱۴۰۵، ۰۹:۴۷' })],
      gaNEW0002: [post({ token: 'gaNEW0002', price: 'توافقی' })],
    },
  });
  await worker.runtime.enqueue(jobs.discover, { page: 1 });
  await until(
    'every new listing has its snapshot',
    async () => (await snapshotsOf(sourceId)).length === 3,
    30_000,
  );

  // Only Divar's search and its three posts were asked for: no contact, chat or other address (criterion 6).
  assert.deepEqual(askedInRounds(stub), [
    `POST ${SEARCH}`,
    `GET ${POST}gaNEW0001`,
    `GET ${POST}gaNEW0002`,
    `GET ${POST}gaPROMO01`,
  ]);
  const search: unknown = JSON.parse(stub.requests[0]?.body ?? '{}');
  assert.deepEqual(
    search,
    JSON.parse(
      `{"city_ids":["1"],"search_data":{"form_data":{"data":{"category":{"str":{"value":"light"}},"brand_model":{"repeated_string":{"value":["Peugeot 206"]}}}},"server_payload":{"@type":"type.googleapis.com/widgets.SearchData.ServerPayload","additional_form_data":{"data":{"sort":{"str":{"value":"sort_date"}}}}}}}`,
    ),
  );
  // The crawler names itself, one request at a time, at least three seconds apart (criterion 2).
  assert.ok(stub.requests.every((request) => request.headers['user-agent'] === TEST_USER_AGENT));
  for (const gap of gapsBetween(stub))
    assert.ok(gap >= 2_990, `a request came ${Math.round(gap)} ms after the last answer`);

  // One immutable snapshot per listing, with its URL, fetch time, content hash and every photo (criterion 1).
  const snapshots = await snapshotsOf(sourceId);
  for (const snapshot of snapshots) {
    assert.equal(snapshot.url, `${stub.url}${POST}${snapshot.token ?? ''}`);
    assert.equal(snapshot.canonical_version, 1);
    assert.equal(snapshot.content_sha256.length, 32);
    assert.equal(photoUrlsOf(snapshot.payload as JsonObject).length, 3);
    assert.ok(!JSON.stringify(snapshot.payload).includes('contact_uuid'));
  }
  const listings = await owner
    .selectFrom('listing')
    .select(['source_listing_key', 'url', 'status', 'listed_at'])
    .where('source_id', '=', sourceId)
    .orderBy('source_listing_key')
    .execute();
  assert.deepEqual(
    listings.map((row) => [row.source_listing_key, row.url, row.status]),
    ['gaNEW0001', 'gaNEW0002', 'gaPROMO01'].map((token) => [token, `https://divar.ir/v/${token}`, 'active']),
  );
  // Posted on 2 Mehr 1405 at 09:47 in Tehran, as the post said.
  assert.deepEqual(listings[0]?.listed_at, new Date('2026-09-24T06:17:00Z'));

  // Every request is logged; each detail points at its listing and snapshot.
  const fetches = await fetchesOf(sourceId);
  assert.deepEqual(
    fetches.map((row) => [
      row.method,
      row.outcome,
      row.http_status,
      row.listing_id !== null,
      row.snapshot_id !== null,
    ]),
    [
      ['http_post', 'ok', 200, false, false],
      ['http_get', 'ok', 200, true, true],
      ['http_get', 'ok', 200, true, true],
      ['http_get', 'ok', 200, true, true],
    ],
  );
  // Each job is a run that reports what it did and how long it took (criterion 4).
  const runs = await runsOf(sourceId);
  assert.deepEqual(
    runs.map((run) => [run.kind, run.status]),
    [
      ['discovery', 'succeeded'],
      ['detail', 'succeeded'],
      ['detail', 'succeeded'],
      ['detail', 'succeeded'],
    ],
  );
  assert.ok(runs.every((run) => run.finished_at !== null && run.finished_at >= run.started_at));
  assert.deepEqual(runs[0]?.counts, {
    rows: 3,
    fresh: 3,
    newListings: 3,
    lateListings: 0,
    changedListings: 0,
    sightings: 0,
  });
  assert.deepEqual(runs[1]?.counts, { snapshotsStored: 1, priceEvents: 1 });
  assert.deepEqual(await pricesOf(sourceId, 'gaNEW0002'), [
    {
      price_type: 'negotiable',
      asking_price_toman: null,
      previous_price_toman: null,
      last_asking_price_toman: null,
    },
  ]);
  // The round read down from its newest ordinary row: the next one reads only what is newer.
  const feed = await owner
    .selectFrom('crawl_feed')
    .select('read_through_at')
    .where('source_id', '=', sourceId)
    .executeTakeFirstOrThrow();
  assert.ok(
    feed.read_through_at && Math.abs(feed.read_through_at.getTime() - Date.now() + 5 * 60_000) < 60_000,
  );
});

test('the next round reads down to where the last one stopped: a bumped listing does not end it, only moved prices are asked again, and a listing shown late is still read', async (context) => {
  const round1 = page(
    [
      { token: 'gaKNOWN01', sortedAt: minutesAgo(30) },
      { token: 'gaKNOWN02', sortedAt: minutesAgo(40) },
      { token: 'gaOLD00001', sortedAt: minutesAgo(45) },
    ],
    { hasNextPage: false },
  );
  const round2 = page(
    [
      // Bumped back to the top, same price: known, so no request.
      { token: 'gaKNOWN02', sortedAt: minutesAgo(1), bumped: true },
      { token: 'gaNEW0003', sortedAt: minutesAgo(2) },
      // Moved up with another price: asked again.
      { token: 'gaKNOWN01', sortedAt: minutesAgo(3), price: '۱,۱۰۰,۰۰۰,۰۰۰ تومان' },
      // Below the mark but never seen: Divar showed it after the last round (approved late, say).
      { token: 'gaLATE0001', sortedAt: minutesAgo(35) },
      // Older than the mark and read by the last round, so the round stops here although more pages follow.
      { token: 'gaOLD00001', sortedAt: minutesAgo(45) },
    ],
    { hasNextPage: true, cursor: { page: 1 } },
  );
  const { sourceId, jobs, worker, stub } = await setUp(context, {
    search: [round1, round2],
    posts: {
      gaKNOWN01: [
        post({ token: 'gaKNOWN01', price: PRICE }),
        post({ token: 'gaKNOWN01', price: '۱,۱۰۰,۰۰۰,۰۰۰ تومان' }),
      ],
      gaKNOWN02: [post({ token: 'gaKNOWN02', price: PRICE })],
      gaOLD00001: [post({ token: 'gaOLD00001', price: PRICE })],
      gaNEW0003: [post({ token: 'gaNEW0003', price: PRICE })],
      gaLATE0001: [post({ token: 'gaLATE0001', price: PRICE })],
    },
  });
  await worker.runtime.enqueue(jobs.discover, { page: 1 });
  await until('the first round is stored', async () => (await snapshotsOf(sourceId)).length === 3, 30_000);
  await worker.runtime.enqueue(jobs.discover, { page: 1 });
  await until('the second round is stored', async () => (await snapshotsOf(sourceId)).length === 6, 40_000);

  assert.deepEqual(askedInRounds(stub), [
    `POST ${SEARCH}`,
    `GET ${POST}gaKNOWN01`,
    `GET ${POST}gaKNOWN02`,
    `GET ${POST}gaOLD00001`,
    `POST ${SEARCH}`,
    `GET ${POST}gaKNOWN01`,
    `GET ${POST}gaLATE0001`,
    `GET ${POST}gaNEW0003`,
  ]);
  // The listing whose price moved has a new snapshot and a price event that knows the price before it (criterion 3).
  assert.deepEqual(await pricesOf(sourceId, 'gaKNOWN01'), [
    {
      price_type: 'asking',
      asking_price_toman: 1_250_000_000,
      previous_price_toman: null,
      last_asking_price_toman: null,
    },
    {
      price_type: 'asking',
      asking_price_toman: 1_100_000_000,
      previous_price_toman: 1_250_000_000,
      last_asking_price_toman: 1_250_000_000,
    },
  ]);
  const secondRound = (await runsOf(sourceId)).filter((run) => run.kind === 'discovery')[1];
  assert.deepEqual(secondRound?.counts, {
    rows: 5,
    fresh: 3,
    newListings: 2,
    lateListings: 1,
    changedListings: 1,
    sightings: 0,
  });
});

test('a listing read again stores a new snapshot only when its page changed, and a price event only when its price did', async (context) => {
  const { sourceId, jobs, worker } = await setUp(context, {
    posts: {
      gaSAME0001: [
        post({ token: 'gaSAME0001', price: PRICE }),
        post({ token: 'gaSAME0001', price: PRICE }),
        post({ token: 'gaSAME0001', price: PRICE, description: 'بدون رنگ، فنی سالم' }),
        post({ token: 'gaSAME0001', price: '۱,۲۰۰,۰۰۰,۰۰۰ تومان', description: 'بدون رنگ، فنی سالم' }),
      ],
    },
  });
  const readAgain = async (expectedFetches: number) => {
    await worker.runtime.enqueue(jobs.listing, { token: 'gaSAME0001', reason: 'changed' });
    await until(
      `${String(expectedFetches)} reads are logged`,
      async () => (await fetchesOf(sourceId)).length === expectedFetches,
      20_000,
    );
  };
  await readAgain(1);
  await readAgain(2);
  const [first, second] = await fetchesOf(sourceId);
  assert.equal((await snapshotsOf(sourceId)).length, 1);
  // The unchanged page is a revisit: its fetch points at the snapshot already stored.
  assert.equal(second?.snapshot_id, first?.snapshot_id);
  await readAgain(3);
  assert.equal((await snapshotsOf(sourceId)).length, 2);
  assert.equal((await pricesOf(sourceId, 'gaSAME0001')).length, 1);
  await readAgain(4);
  assert.equal((await snapshotsOf(sourceId)).length, 3);
  assert.deepEqual(
    (await pricesOf(sourceId, 'gaSAME0001')).map((event) => event.asking_price_toman),
    [1_250_000_000, 1_200_000_000],
  );
  assert.deepEqual(
    (await runsOf(sourceId)).map((run) => run.counts),
    [
      { snapshotsStored: 1, priceEvents: 1 },
      { snapshotsUnchanged: 1 },
      { snapshotsStored: 1 },
      { snapshotsStored: 1, priceEvents: 1 },
    ],
  );
});

test('an answer whose rows could not be written is still logged, as an error, and its run fails (criterion 4)', async (context) => {
  const { sourceId, jobs, worker } = await setUp(context, {
    posts: {
      gaLATE0001: [
        post({ token: 'gaLATE0001', price: PRICE }),
        post({ token: 'gaLATE0001', price: '۱,۲۰۰,۰۰۰,۰۰۰ تومان' }),
      ],
    },
  });
  await worker.runtime.enqueue(jobs.listing, { token: 'gaLATE0001', reason: 'new' });
  await until('the listing is stored', async () => (await fetchesOf(sourceId)).length === 1, 20_000);
  // A price event from tomorrow makes the next price late (listing_price_event_in_order), so the transaction that
  // logged the next answer with its snapshot and price rolls back.
  const [stored] = await fetchesOf(sourceId);
  assert.ok(stored?.listing_id && stored.snapshot_id);
  await owner
    .insertInto('listing_price_event')
    .values({
      listing_id: stored.listing_id,
      observed_at: new Date(Date.now() + 86_400_000),
      price_type: 'negotiable',
      snapshot_id: stored.snapshot_id,
    })
    .execute();
  await worker.runtime.enqueue(jobs.listing, { token: 'gaLATE0001', reason: 'changed' });
  await until('the second request is logged', async () => (await fetchesOf(sourceId)).length >= 2, 20_000);
  const second = (await fetchesOf(sourceId))[1];
  assert.deepEqual([second?.outcome, second?.http_status, second?.snapshot_id], ['error', 200, null]);
  await until('its run is closed', async () => (await runsOf(sourceId))[1]?.status === 'failed');
  assert.equal((await snapshotsOf(sourceId)).length, 1);
});

test("a request that opens the lane's breaker is logged like the failures before it (criterion 4)", async (context) => {
  const { sourceId, jobs, worker } = await setUp(context, {
    posts: {
      gaFAIL0001: [{ status: 503 }],
      gaFAIL0002: [{ status: 503 }],
      gaFAIL0003: [{ status: 503 }],
    },
  });
  for (const token of ['gaFAIL0001', 'gaFAIL0002', 'gaFAIL0003']) {
    await worker.runtime.enqueue(jobs.listing, { token, reason: 'new' });
  }
  await until(
    'the three runs are closed',
    async () => (await runsOf(sourceId)).filter((run) => run.status === 'failed').length === 3,
    30_000,
  );
  // The third 503 opened the breaker, so its job went back to the queue: its request is logged all the same, and no
  // run claims it sent nothing.
  assert.deepEqual(
    (await fetchesOf(sourceId)).map((fetch) => [fetch.outcome, fetch.http_status]),
    [
      ['error', 503],
      ['error', 503],
      ['error', 503],
    ],
  );
  assert.deepEqual(
    (await runsOf(sourceId)).map((run) => run.counts),
    [{}, {}, {}],
  );
});

async function expectStopped(setup: Setup, reason: 'blocked' | 'challenge', outcome: string): Promise<void> {
  const { sourceId, stub } = setup;
  await until(
    'the source is stopped',
    async () => (await sourceRow(sourceId)).crawl_state === 'stopped_on_block',
  );
  const source = await sourceRow(sourceId);
  assert.equal(source.stop_reason, reason);
  // The refused request is logged, at the instant the source was stopped at: its evidence.
  await until('the refused request is logged', async () => (await fetchesOf(sourceId)).length === 1);
  const [refused] = await fetchesOf(sourceId);
  assert.equal(refused?.outcome, outcome);
  assert.deepEqual(refused.requested_at, source.stopped_at);
  const [run] = await runsOf(sourceId);
  assert.equal(run?.status, 'stopped_on_block');
  // The job goes back to the queue with its attempts, to wait for a person to resume the source; nothing more is sent.
  await until('the job is put back', async () =>
    (await jobsOf(owner, laneQueue(sourceId))).some((job) => job.state === 'created'),
  );
  await sleep(1_500);
  assert.equal(stub.requests.length, 1);
}

test('a 403 stops Divar at once, with the refused request as the evidence (criterion 2)', async (context) => {
  const setup = await setUp(context, { search: [{ status: 403 }] });
  await setup.worker.runtime.enqueue(setup.jobs.discover, { page: 1 });
  await expectStopped(setup, 'blocked', 'blocked');
});

test('a challenge page where a post was expected stops Divar (criterion 2)', async (context) => {
  const setup = await setUp(context, {
    posts: {
      gaCHALLNG1: [
        {
          status: 200,
          headers: { 'content-type': 'text/html' },
          body: '<!DOCTYPE html><html><body>Checking your browser…</body></html>',
        },
      ],
    },
  });
  await setup.worker.runtime.enqueue(setup.jobs.listing, { token: 'gaCHALLNG1', reason: 'new' });
  await expectStopped(setup, 'challenge', 'challenge');
});

test('an empty answer where listings were expected stops Divar (criterion 2)', async (context) => {
  const setup = await setUp(context, { search: [{ status: 200, body: '{}' }] });
  await setup.worker.runtime.enqueue(setup.jobs.discover, { page: 1 });
  await expectStopped(setup, 'blocked', 'blocked');
});

test('a first 429 cools the lane down; a second within the day stops Divar, both requests logged (criterion 2)', async (context) => {
  const setup = await setUp(context, { search: [{ status: 429, headers: { 'retry-after': '1' } }] });
  const { sourceId, jobs, worker } = setup;
  await worker.runtime.enqueue(jobs.discover, { page: 1 });
  await until('the first 429 is logged', async () => (await fetchesOf(sourceId)).length === 1);
  assert.equal((await sourceRow(sourceId)).crawl_state, 'enabled');
  // The job was put back and runs again once the lane has rested; the second 429 stops the source.
  await until(
    'the source is stopped',
    async () => (await sourceRow(sourceId)).crawl_state === 'stopped_on_block',
    30_000,
  );
  const source = await sourceRow(sourceId);
  assert.equal(source.stop_reason, 'rate_limited');
  await until('both requests are logged', async () => (await fetchesOf(sourceId)).length === 2);
  const [first, second] = await fetchesOf(sourceId);
  assert.deepEqual([first?.outcome, second?.outcome], ['rate_limited', 'rate_limited']);
  assert.deepEqual(second?.requested_at, source.stopped_at);
  assert.deepEqual(
    (await runsOf(sourceId)).map((run) => run.status),
    ['failed', 'stopped_on_block'],
  );
});

test('a source whose robots.txt and terms were not read in the last 30 days sends nothing until they are (ADR-0008 point 1)', async (context) => {
  const { sourceId, jobs, worker, stub } = await setUp(context, { search: [page([])] }, { policy: 'stale' });
  await until('the lane is closed for its policy', () =>
    worker.runtime.lanes().some((lane) => lane.sourceId === sourceId && lane.closure === 'policy_expired'),
  );
  await worker.runtime.enqueue(jobs.discover, { page: 1 });
  await sleep(1_500);
  assert.equal(stub.requests.length, 0);
  assert.deepEqual(
    (await jobsOf(owner, laneQueue(sourceId))).map((job) => job.state),
    ['created'],
  );
});

test('a measurement counts every brand, and the models of a brand with more than one page (criteria 5 and 7)', async (context) => {
  const rows = (prefix: string, count: number, days = 1) =>
    Array.from({ length: count }, (_, index) => ({
      token: `ga${prefix}${String(index).padStart(4, '0')}`,
      sortedAt: minutesAgo(days * 24 * 60 + index),
    }));
  const { sourceId, jobs, worker, stub } = await setUp(context, {
    bySlice: {
      ROOT: page(rows('ROOT', 24), { hasNextPage: true, childValues: ['Pride', 'Peugeot'] }),
      Pride: page(rows('PRID', 2), { hasNextPage: false, childValues: ['Pride 131', 'Pride 111'] }),
      // A full first page that says more follow.
      Peugeot: page(rows('PEUG', 24), {
        hasNextPage: true,
        childValues: ['Peugeot 206', 'Peugeot 405', 'Pride 131'],
      }),
      'Peugeot 206': page(rows('P206', 3), { hasNextPage: false }),
      'Peugeot 405': page(rows('P405', 1), { hasNextPage: false }),
    },
  });
  const sweptAt = new Date().toISOString();
  await worker.runtime.enqueue(jobs.measure, {
    sweptAt,
    slice: { key: 'ROOT', level: 'all' },
    page: 1,
    rows: 0,
    bumped: 0,
    newestSortedAt: null,
    oldestSortedAt: null,
    children: [],
  });
  await until(
    'every slice is counted',
    async () =>
      (await owner.selectFrom('model_volume').select('id').where('source_id', '=', sourceId).execute())
        .length === 4,
    40_000,
  );
  const volumes = await owner
    .selectFrom('model_volume')
    .select(['source_model_key', 'level', 'active_count', 'pages_read', 'complete'])
    .where('source_id', '=', sourceId)
    .orderBy('source_model_key')
    .execute();
  assert.deepEqual(
    volumes.map((row) => [row.source_model_key, row.level, row.active_count, row.pages_read, row.complete]),
    [
      // The whole feed is read only as deep as the measurement allows: a lower bound (allPages is 1 here).
      ['Peugeot 206', 'model', 3, 1, true],
      ['Peugeot 405', 'model', 1, 1, true],
      ['Pride', 'brand', 2, 1, true],
      ['ROOT', 'all', 24, 1, false],
    ],
  );
  // A brand of one page is counted from it; one with more is counted through its own models only.
  assert.equal(stub.requests.length, 5);
  assert.ok(asked(stub).every((request) => request === `POST ${SEARCH}`));
});

function sliceRows(prefix: string, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    token: `ga${prefix}${String(index).padStart(4, '0')}`,
    sortedAt: minutesAgo(24 * 60 + index),
  }));
}

function measureAll(jobs: DivarJobs, worker: TestWorker) {
  return worker.runtime.enqueue(jobs.measure, {
    sweptAt: new Date().toISOString(),
    slice: { key: 'ROOT', level: 'all' },
    page: 1,
    rows: 0,
    bumped: 0,
    newestSortedAt: null,
    oldestSortedAt: null,
    children: [],
  });
}

async function volumesOf(sourceId: string, count: number) {
  await until(
    `${String(count)} slices are counted`,
    async () =>
      (await owner.selectFrom('model_volume').select('id').where('source_id', '=', sourceId).execute())
        .length === count,
    30_000,
  );
  const volumes = await owner
    .selectFrom('model_volume')
    .select(['source_model_key', 'level', 'active_count', 'pages_read', 'complete'])
    .where('source_id', '=', sourceId)
    .orderBy('source_model_key')
    .execute();
  return volumes.map((row) => [
    row.source_model_key,
    row.level,
    row.active_count,
    row.pages_read,
    row.complete,
  ]);
}

test("a slice ends at its first short page, at Divar's empty answer after a full one, or where other cities' listings begin, and none of these stops Divar (criterion 5)", async (context) => {
  const { sourceId, jobs, worker, stub } = await setUp(context, {
    bySlice: {
      ROOT: page(sliceRows('ROOT', 24), { hasNextPage: true, childValues: ['Smart', 'Datsun', 'Kia'] }),
      // Divar says a next page follows under a slice of one listing: a short page is the last all the same.
      Smart: page(sliceRows('SMRT', 1), {
        hasNextPage: true,
        childValues: ['Smart Fortwo', 'Smart Forfour'],
      }),
      // Its own rows end on the first page: the nearby cities' listings after them are neither counted nor followed.
      Datsun: page(sliceRows('DATS', 2), {
        hasNextPage: true,
        end: { kind: 'suggestions', suggested: sliceRows('QOM', 20) },
      }),
      // A full last page says more follow; the page after it is an answer without a list, as protobuf's JSON writes an
      // empty one.
      Kia: [page(sliceRows('KIA', 24), { hasNextPage: true }), page([])],
    },
  });
  await measureAll(jobs, worker);
  assert.deepEqual(await volumesOf(sourceId, 4), [
    ['Datsun', 'brand', 2, 1, true],
    ['Kia', 'brand', 24, 2, true],
    ['ROOT', 'all', 24, 1, false],
    ['Smart', 'brand', 1, 1, true],
  ]);
  assert.equal(stub.requests.length, 5);
  assert.equal((await sourceRow(sourceId)).crawl_state, 'enabled');
});

test('a model read to the page limit is counted again through its trims (criteria 5 and 7)', async (context) => {
  const { sourceId, jobs, worker, stub } = await setUp(
    context,
    {
      bySlice: {
        ROOT: page(sliceRows('ROOT', 24), { hasNextPage: true, childValues: ['Pride'] }),
        Pride: page(sliceRows('PRID', 24), { hasNextPage: true, childValues: ['Pride 131'] }),
        'Pride 131': page(sliceRows('P131', 24), {
          hasNextPage: true,
          childValues: ['Pride 131 SE', 'Pride 131 SL'],
        }),
        'Pride 131 SE': page(sliceRows('P1SE', 5)),
        'Pride 131 SL': page(sliceRows('P1SL', 7)),
      },
    },
    { measure: { slicePages: 1 } },
  );
  await measureAll(jobs, worker);
  assert.deepEqual(await volumesOf(sourceId, 4), [
    ['Pride 131', 'model', 24, 1, false],
    ['Pride 131 SE', 'trim', 5, 1, true],
    ['Pride 131 SL', 'trim', 7, 1, true],
    ['ROOT', 'all', 24, 1, false],
  ]);
  assert.equal(stub.requests.length, 5);
});
