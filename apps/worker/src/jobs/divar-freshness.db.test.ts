import assert from 'node:assert/strict';
import { after, before, test, type TestContext } from 'node:test';
import { sql, type Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';
import { createTestSource, jobsOf, openScratchDatabase } from '../db/test-database.ts';
import {
  postAnswer,
  searchAnswer,
  type FixturePage,
  type FixturePost,
  type FixtureRow,
} from '../test-support/divar-fixtures.ts';
import { startTestWorker, type TestWorker } from '../test-support/runtime.ts';
import {
  startStubSource,
  type StubAnswer,
  type StubRequest,
  type StubSource,
} from '../test-support/stub-source.ts';
import { until } from '../test-support/wait.ts';
import { divarFreshnessJobs, type DivarFreshnessJobs } from './divar-freshness.ts';
import { divarJobs, type DivarJobs } from './divar.ts';
import { recheckJobs } from './rechecks.ts';

// Keeping Divar's listings fresh against a local stand-in for its API (CS-35 criteria 1, 2, 3, 5 and 7): sweeps of the
// tracked models and of the rest of the market, what a complete slice no longer shows, price events read from list
// rows, buyers' re-checks and expiry, all through the real lane and its three-second floor. Nothing here reaches Divar.

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
const PRICE = '۱,۲۵۰,۰۰۰,۰۰۰ تومان';

type Script = {
  /** Answers to the search by the brand_model value it asks for, ROOT for none; any other slice is an error. */
  readonly bySlice?: Record<string, StubAnswer>;
  /** Answers per post token; any other token is a 404. */
  readonly posts?: Record<string, StubAnswer>;
};

function page(rows: readonly FixtureRow[], options: FixturePage = {}): StubAnswer {
  return { status: 200, body: searchAnswer(rows, options) };
}

function post(fixture: FixturePost): StubAnswer {
  return { status: 200, body: postAnswer(fixture) };
}

function sliceOf(request: StubRequest): string {
  const body = JSON.parse(request.body) as {
    search_data?: { form_data?: { data?: { brand_model?: { repeated_string?: { value?: string[] } } } } };
  };
  return body.search_data?.form_data?.data?.brand_model?.repeated_string?.value?.join(',') ?? 'ROOT';
}

type Setup = {
  readonly sourceId: string;
  readonly divar: DivarJobs;
  readonly fresh: DivarFreshnessJobs;
  readonly drain: ReturnType<typeof recheckJobs>;
  readonly worker: TestWorker;
  readonly stub: StubSource;
};

async function setUp(context: TestContext, script: Script): Promise<Setup> {
  const stub = await startStubSource((request) => {
    if (request.method === 'POST' && request.path === SEARCH) {
      return script.bySlice?.[sliceOf(request)] ?? { status: 500 };
    }
    if (request.method === 'GET' && request.path.startsWith(POST)) {
      return script.posts?.[request.path.slice(POST.length)] ?? { status: 404, body: '{"code": 5}' };
    }
    return { status: 418, body: 'not a Divar address the crawler may use' };
  });
  context.after(() => stub.close());
  const sourceId = await createTestSource(owner, context);
  const divar = divarJobs({ sourceId, apiUrl: stub.url, trackedModels: TRACKED, scheduled: false });
  const fresh = divarFreshnessJobs({
    sourceId,
    apiUrl: stub.url,
    trackedModels: TRACKED,
    scheduled: false,
  });
  const drain = recheckJobs({ recheckBySource: new Map([[sourceId, fresh.recheck]]), scheduled: false });
  const worker = await startTestWorker([...divar.all, ...fresh.all, drain]);
  context.after(() => worker.stop());
  await until('the lane is open', () =>
    worker.runtime.lanes().some((lane) => lane.sourceId === sourceId && lane.state === 'running'),
  );
  return { sourceId, divar, fresh, drain, worker, stub };
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

/** A listing stored before the test, as an earlier crawl left it. */
async function seedListing(
  sourceId: string,
  token: string,
  values: { modelKey: string; lastSeenDaysAgo: number; askingToman?: number; expiresAt?: Date },
): Promise<number> {
  const listing = await owner
    .insertInto('listing')
    .values({
      source_id: sourceId,
      source_listing_key: token,
      url: `https://divar.ir/v/${token}`,
      status: 'active',
      listed_at: daysAgo(values.lastSeenDaysAgo + 1),
      last_seen_at: daysAgo(values.lastSeenDaysAgo),
      source_model_key: values.modelKey,
      expires_at: values.expiresAt ?? null,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  if (values.askingToman !== undefined) {
    const snapshot = await owner
      .insertInto('snapshot')
      .values({
        listing_id: listing.id,
        first_fetched_at: daysAgo(values.lastSeenDaysAgo),
        url: `https://api.divar.ir/v8/posts-v2/web/${token}`,
        canonical_version: 1,
        payload: { seeded: token },
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await owner
      .insertInto('listing_price_event')
      .values({
        listing_id: listing.id,
        observed_at: daysAgo(values.lastSeenDaysAgo),
        price_type: 'asking',
        asking_price_toman: values.askingToman,
        snapshot_id: snapshot.id,
      })
      .execute();
  }
  return listing.id;
}

async function listingOf(sourceId: string, token: string) {
  return owner
    .selectFrom('listing')
    .select(['status', 'delisted_at', 'last_seen_at', 'last_checked_at', 'source_model_key', 'expires_at'])
    .where('source_id', '=', sourceId)
    .where('source_listing_key', '=', token)
    .executeTakeFirstOrThrow();
}

async function runKinds(sourceId: string): Promise<Record<string, number>> {
  const rows = await owner
    .selectFrom('crawl_run')
    .select(['kind', (eb) => eb.fn.countAll<string>().as('runs')])
    .where('source_id', '=', sourceId)
    .groupBy('kind')
    .execute();
  return Object.fromEntries(rows.map((row) => [row.kind, Number(row.runs)]));
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

const recent = (index: number) => new Date(Date.now() - (60 + index) * 60_000).toISOString();

test('the tracked sweep refreshes what it sees, records row prices, and checks what it no longer shows (criteria 1 to 3, 7)', async (context) => {
  const setup = await setUp(context, {
    bySlice: {
      'Peugeot 206': page(
        [
          { token: 'gaKNOWN1', sortedAt: recent(1), price: PRICE },
          { token: 'gaFRESH1', sortedAt: recent(2), price: PRICE },
          // The same listing twice on one page: written once, its details asked for once.
          { token: 'gaFRESH1', sortedAt: recent(2), price: PRICE },
        ],
        { hasNextPage: false },
      ),
    },
    posts: {
      gaKNOWN1: post({ token: 'gaKNOWN1', price: PRICE }),
      gaFRESH1: post({ token: 'gaFRESH1', price: PRICE }),
      // gaSOLD01 is not in the script: Divar answers 404 for it.
      gaEXPIR1: post({ token: 'gaEXPIR1', price: PRICE, unavailableAfter: '2026-09-01T10:00:00.000000' }),
    },
  });
  const { sourceId, fresh, worker, stub } = setup;
  // Known with a detail, last seen three days ago at a higher price, under a trim of the tracked model.
  await seedListing(sourceId, 'gaKNOWN1', {
    modelKey: 'Peugeot 206 5',
    lastSeenDaysAgo: 3,
    askingToman: 1_300_000_000,
  });
  // Two listings the sweep will not show: one Divar no longer has, one past its own end date.
  await seedListing(sourceId, 'gaSOLD01', { modelKey: 'Peugeot 206 5', lastSeenDaysAgo: 2 });
  await seedListing(sourceId, 'gaEXPIR1', { modelKey: 'Peugeot 206 2', lastSeenDaysAgo: 2 });

  await worker.runtime.enqueue(fresh.startSweep, { scope: 'tracked' });
  await until(
    'the sweep, its details and its checks are done',
    async () =>
      (await listingOf(sourceId, 'gaSOLD01')).status === 'gone' &&
      (await listingOf(sourceId, 'gaEXPIR1')).status === 'expired' &&
      (await listingOf(sourceId, 'gaFRESH1')).last_checked_at !== null,
    60_000,
  );
  await until('every run has closed', async () => {
    const running = await owner
      .selectFrom('crawl_run')
      .select('id')
      .where('source_id', '=', sourceId)
      .where('status', '=', 'running')
      .execute();
    return running.length === 0 && stub.requests.length >= 5;
  });

  // One search, the details of the new listing and of the re-priced one, and one check for each missing listing.
  assert.deepEqual(await runKinds(sourceId), { sweep: 1, detail: 2, check: 2 });
  assert.equal(stub.requests.length, 5);
  for (const gap of gapsBetween(stub))
    assert.ok(gap >= 2_990, `a request came ${Math.round(gap)} ms after the last answer`);

  // Seen: refreshed, with the finer model key it already had; new: stored with the slice's key.
  const volume = await owner
    .selectFrom('model_volume')
    .select(['source_model_key', 'level', 'active_count', 'complete', 'swept_at'])
    .where('source_id', '=', sourceId)
    .executeTakeFirstOrThrow();
  assert.deepEqual(
    [volume.source_model_key, volume.level, volume.active_count, volume.complete],
    ['Peugeot 206', 'model', 2, true],
  );
  const known = await listingOf(sourceId, 'gaKNOWN1');
  assert.equal(known.source_model_key, 'Peugeot 206 5');
  assert.ok(known.last_seen_at !== null && known.last_seen_at >= volume.swept_at);
  assert.equal((await listingOf(sourceId, 'gaFRESH1')).source_model_key, 'Peugeot 206 5');

  // The lower price in the row is one price event, whose evidence is the list page's request; the detail that
  // followed showed the same price and added none.
  const events = await owner
    .selectFrom('listing_price_event as e')
    .innerJoin('listing as l', 'l.id', 'e.listing_id')
    .select(['e.asking_price_toman', 'e.snapshot_id', 'e.fetch_log_id'])
    .where('l.source_id', '=', sourceId)
    .where('l.source_listing_key', '=', 'gaKNOWN1')
    .orderBy('e.observed_at')
    .execute();
  assert.deepEqual(
    events.map((event) => [
      event.asking_price_toman,
      event.snapshot_id === null,
      event.fetch_log_id === null,
    ]),
    [
      [1_300_000_000, false, true],
      [1_250_000_000, true, false],
    ],
  );

  // Gone when Divar no longer has it; expired when its page is past its end date; both checked with one request.
  const sold = await listingOf(sourceId, 'gaSOLD01');
  assert.ok(sold.delisted_at && sold.delisted_at >= volume.swept_at);
  const expired = await listingOf(sourceId, 'gaEXPIR1');
  assert.ok(expired.last_checked_at && expired.delisted_at);
  assert.equal(expired.expires_at?.toISOString(), '2026-09-01T06:30:00.000Z');
});

test('the weekly sweep leaves the tracked models to the daily one and marks what it no longer shows gone without a request (criterion 2)', async (context) => {
  const rows = (prefix: string, count: number) =>
    Array.from({ length: count }, (_, index) => ({
      token: `ga${prefix}${String(index).padStart(4, '0')}`,
      sortedAt: recent(index),
      price: PRICE,
    }));
  const { sourceId, fresh, worker, stub } = await setUp(context, {
    bySlice: {
      ROOT: page(rows('ROOT', 24), { hasNextPage: true, childValues: ['Pride', 'Peugeot'] }),
      Pride: page(rows('PRID', 2), { hasNextPage: false, childValues: ['Pride 131'] }),
      Peugeot: page(rows('PEUG', 24), { hasNextPage: true, childValues: ['Peugeot 206', 'Peugeot 405'] }),
      'Peugeot 405': page(rows('P405', 1), { hasNextPage: false }),
      // 'Peugeot 206' is tracked: the weekly sweep must never ask for it (the stub would answer 500).
    },
  });
  await seedListing(sourceId, 'gaPRIDEGONE', { modelKey: 'Pride 131', lastSeenDaysAgo: 8 });
  await seedListing(sourceId, 'gaTRACKED1', { modelKey: 'Peugeot 206 5', lastSeenDaysAgo: 8 });

  await worker.runtime.enqueue(fresh.startSweep, { scope: 'untracked' });
  await until(
    'every slice is swept',
    async () =>
      (await owner.selectFrom('model_volume').select('id').where('source_id', '=', sourceId).execute())
        .length === 2,
    40_000,
  );
  await until(
    'the last page is written',
    async () => (await listingOf(sourceId, 'gaPRIDEGONE')).status === 'gone',
  );

  assert.deepEqual(
    stub.requests.map((request) => `${request.method} ${sliceOf(request)}`),
    ['POST ROOT', 'POST Pride', 'POST Peugeot', 'POST Peugeot 405'],
  );
  const gone = await listingOf(sourceId, 'gaPRIDEGONE');
  assert.ok(gone.delisted_at && gone.last_seen_at && gone.delisted_at > gone.last_seen_at);
  // The tracked model's listing is not the weekly sweep's to judge.
  assert.equal((await listingOf(sourceId, 'gaTRACKED1')).status, 'active');
  // Rows of untracked models are stored with their slice's key and their first price, at no extra request.
  const pride = await listingOf(sourceId, 'gaPRID0000');
  assert.equal(pride.source_model_key, 'Pride');
  const { rows: prideEvents } = await sql<{ n: string }>`
    SELECT count(*) AS n FROM listing_price_event e JOIN listing l ON l.id = e.listing_id
    WHERE l.source_id = ${sourceId} AND e.fetch_log_id IS NOT NULL`.execute(owner);
  assert.equal(Number(prideEvents[0]?.n), 2 + 24 + 1);
});

test("a buyer's re-check reads the page once, then says it is fresh for six hours; an unchanged page stores nothing new (criteria 3 and 5)", async (context) => {
  const { sourceId, fresh, drain, worker, stub } = await setUp(context, {
    posts: { gaRECHK01: post({ token: 'gaRECHK01', price: PRICE }) },
  });
  const listingId = await seedListing(sourceId, 'gaRECHK01', {
    modelKey: 'Peugeot 206 5',
    lastSeenDaysAgo: 1,
  });
  const request = () =>
    owner.insertInto('listing_recheck_request').values({ listing_id: listingId }).execute();
  const outcomes = () =>
    owner
      .selectFrom('listing_recheck_request')
      .select('outcome')
      .where('listing_id', '=', listingId)
      .orderBy('id')
      .execute();

  await request();
  await worker.runtime.enqueue(drain, {});
  await until(
    'the re-check has read the page',
    async () => (await listingOf(sourceId, 'gaRECHK01')).last_checked_at !== null,
  );
  assert.deepEqual(
    (await outcomes()).map((row) => row.outcome),
    ['queued'],
  );

  await request();
  await worker.runtime.enqueue(drain, {});
  await until('the second request is handled', async () =>
    (await outcomes()).every((row) => row.outcome !== null),
  );
  assert.deepEqual(
    (await outcomes()).map((row) => row.outcome),
    ['queued', 'fresh'],
  );
  assert.equal(stub.requests.length, 1);

  // Sent again directly, the same page stores no second snapshot.
  await worker.runtime.enqueue(fresh.recheck, { token: 'gaRECHK01' });
  await until('the second read is done', () => stub.requests.length === 2);
  await until('its run has closed', async () => (await runKinds(sourceId)).recheck === 2);
  const snapshots = await owner
    .selectFrom('snapshot')
    .select('id')
    .where('listing_id', '=', listingId)
    .execute();
  assert.equal(snapshots.length, 1);
});

test('a listing past its own end date is marked expired without a request (criterion 2)', async (context) => {
  const { sourceId, fresh, worker, stub } = await setUp(context, {});
  await seedListing(sourceId, 'gaEXPIRE2', {
    modelKey: 'Pride 131',
    lastSeenDaysAgo: 3,
    expiresAt: daysAgo(1),
  });
  await seedListing(sourceId, 'gaLATER01', {
    modelKey: 'Pride 131',
    lastSeenDaysAgo: 3,
    expiresAt: daysAgo(-5),
  });
  // Past its end date, but a list showed it a day after: renewed on Divar, so not expired.
  await seedListing(sourceId, 'gaRENEW01', {
    modelKey: 'Pride 131',
    lastSeenDaysAgo: 1,
    expiresAt: daysAgo(2),
  });
  await worker.runtime.enqueue(fresh.expire, {});
  await until(
    'the expired listing is off the market',
    async () => (await listingOf(sourceId, 'gaEXPIRE2')).status === 'expired',
  );
  assert.equal((await listingOf(sourceId, 'gaLATER01')).status, 'active');
  assert.equal((await listingOf(sourceId, 'gaRENEW01')).status, 'active');
  assert.equal(stub.requests.length, 0);
});

test('freshness is measured every hour for the source and each tracked model, once an hour (criterion 6)', async (context) => {
  const { sourceId, fresh, worker } = await setUp(context, {});
  const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000);
  const insert = (
    token: string,
    values: {
      modelKey: string;
      created: Date;
      listed: Date;
      lastSeen: Date;
      checked?: Date;
      delisted?: Date;
    },
  ) =>
    owner
      .insertInto('listing')
      .values({
        source_id: sourceId,
        source_listing_key: token,
        url: `https://divar.ir/v/${token}`,
        status: values.delisted ? 'gone' : 'active',
        listed_at: values.listed,
        delisted_at: values.delisted ?? null,
        last_seen_at: values.lastSeen,
        last_checked_at: values.checked ?? null,
        created_at: values.created,
        source_model_key: values.modelKey,
      })
      .execute();
  // Two tracked listings stored in the last day, 30 and 60 minutes after they were posted.
  await insert('gaFRSH0001', {
    modelKey: 'Peugeot 206 5',
    created: hoursAgo(2),
    listed: hoursAgo(2.5),
    lastSeen: hoursAgo(2),
    checked: hoursAgo(2),
  });
  await insert('gaFRSH0002', {
    modelKey: 'Peugeot 206 2',
    created: hoursAgo(3),
    listed: hoursAgo(4),
    lastSeen: hoursAgo(3),
    checked: hoursAgo(3),
  });
  // An untracked listing not seen for three days, and one that left the market two hours ago.
  await insert('gaFRSH0003', {
    modelKey: 'Pride 131',
    created: hoursAgo(120),
    listed: hoursAgo(121),
    lastSeen: hoursAgo(72),
  });
  await insert('gaFRSH0004', {
    modelKey: 'Pride 131',
    created: hoursAgo(120),
    listed: hoursAgo(121),
    lastSeen: hoursAgo(3),
    delisted: hoursAgo(2),
  });

  await worker.runtime.enqueue(fresh.measure, {});
  const rowsOf = () =>
    owner
      .selectFrom('freshness_measurement')
      .select([
        'source_model_key',
        'new_listings',
        'left_market',
        'active_listings',
        'seen_within_48h',
        'posting_to_first_seen_p50_minutes',
        'posting_to_first_seen_p90_minutes',
        'last_seen_age_p50_minutes',
      ])
      .where('source_id', '=', sourceId)
      .orderBy('source_model_key', (order) => order.nullsFirst())
      .execute();
  await until('the source and its tracked model are measured', async () => (await rowsOf()).length === 2);
  const [whole, model] = await rowsOf();
  assert.deepEqual(
    [
      whole?.source_model_key,
      whole?.new_listings,
      whole?.left_market,
      whole?.active_listings,
      whole?.seen_within_48h,
    ],
    [null, 2, 1, 3, 2],
  );
  assert.deepEqual(
    [
      model?.source_model_key,
      model?.new_listings,
      model?.left_market,
      model?.active_listings,
      model?.seen_within_48h,
    ],
    ['Peugeot 206', 2, 0, 2, 2],
  );
  // 30 and 60 minutes: a median of 45 and a 90th percentile of 57.
  assert.deepEqual(
    [whole?.posting_to_first_seen_p50_minutes, whole?.posting_to_first_seen_p90_minutes],
    [45, 57],
  );
  assert.ok(whole?.last_seen_age_p50_minutes !== null && whole?.last_seen_age_p50_minutes !== undefined);

  // Measured again within the hour: nothing new is stored. The queue is shared, so count from here.
  const completed = async () =>
    (await jobsOf(owner, 'divar.measure-freshness')).filter((job) => job.state === 'completed').length;
  await until('the first run is settled', async () => (await completed()) >= 1);
  const before = await completed();
  await worker.runtime.enqueue(fresh.measure, {});
  await until('the second run is done', async () => (await completed()) === before + 1);
  assert.equal((await rowsOf()).length, 2);
});

test("the day's spend is readable by kind and outcome beside the budget (criterion 4)", async (context) => {
  const { sourceId, fresh, worker, stub } = await setUp(context, {
    posts: { gaSPEND001: post({ token: 'gaSPEND001', price: PRICE }) },
  });
  await worker.runtime.enqueue(fresh.recheck, { token: 'gaSPEND001' });
  await worker.runtime.enqueue(fresh.check, { token: 'gaSPEND002' });
  await until('both requests are sent', () => stub.requests.length === 2, 20_000);
  const spendOf = () =>
    owner
      .selectFrom('source_daily_spend')
      .select(['kind', 'outcome', 'requests', 'daily_request_budget'])
      .where('source_id', '=', sourceId)
      .orderBy('kind')
      .execute();
  // A run exists before its request is logged: wait for both requests in the view.
  await until(
    'both requests are logged',
    async () => (await spendOf()).reduce((sum, row) => sum + (row.requests ?? 0), 0) === 2,
  );
  const spend = await spendOf();
  assert.deepEqual(
    spend.map((row) => [row.kind, row.outcome, row.requests, row.daily_request_budget]),
    [
      ['check', 'not_found', 1, 12_000],
      ['recheck', 'ok', 1, 12_000],
    ],
  );
  const lane = await owner
    .selectFrom('crawl_lane')
    .select('budget_spent')
    .where('source_id', '=', sourceId)
    .executeTakeFirstOrThrow();
  assert.equal(lane.budget_spent, 2);
});
