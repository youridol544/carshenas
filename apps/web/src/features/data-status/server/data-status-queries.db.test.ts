import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { loadDataStatus } from '@/features/data-status/server/data-status-queries';
import { assertScratchDatabase, ownerDatabase } from '@/server/db/account-test-database';
import { database } from '@/server/db/database';

// The public data-status page's reads (CS-66) against the scratch database `pnpm db:check` migrated, through the web
// app's own pool as carshenas_web: rows seeded as the owner, the way the worker and the valuation write them, then
// read back. Each source is the test's own; the whole index also counts whatever other tests left.

vi.mock('next/cache', () => ({ cacheLife: vi.fn() }));

const owner = ownerDatabase();

beforeAll(async () => {
  await assertScratchDatabase(owner);
});

afterAll(async () => {
  await Promise.all([owner.destroy(), database().destroy()]);
});

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

async function createSource(crawlState: 'enabled' | 'paused'): Promise<string> {
  const id = `s_${randomBytes(5).toString('hex')}`;
  await owner
    .insertInto('source')
    .values({
      id,
      origin: 'external',
      access_method: 'crawl',
      name_fa: 'منبع آزمایشی',
      base_url: 'https://test.example',
      listing_visibility: 'public',
      crawl_state: crawlState,
      min_request_interval_ms: 3_000,
      daily_request_budget: 12_000,
    })
    .execute();
  return id;
}

async function createModel(sourceId: string, key: string): Promise<number> {
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
    .values({ source_id: sourceId, source_model_key: key, level: 'model', make_id: makeId, model_id: modelId })
    .execute();
  return modelId;
}

type Seeded = {
  postedMinutesAgo: number;
  seenMinutesAgo: number;
  goneMinutesAgo?: number;
  modelId?: number;
};

async function createListing(sourceId: string, fields: Seeded): Promise<void> {
  const key = randomBytes(4).toString('hex');
  await owner
    .insertInto('listing')
    .values({
      source_id: sourceId,
      source_listing_key: key,
      url: `https://test.example/post/${key}`,
      origin: 'external',
      status: fields.goneMinutesAgo === undefined ? 'active' : 'gone',
      listed_at: minutesAgo(fields.postedMinutesAgo),
      last_seen_at: minutesAgo(fields.seenMinutesAgo),
      delisted_at: fields.goneMinutesAgo === undefined ? null : minutesAgo(fields.goneMinutesAgo),
      ...(fields.modelId !== undefined && {
        make_id: (
          await owner
            .selectFrom('model')
            .select('make_id')
            .where('id', '=', fields.modelId)
            .executeTakeFirstOrThrow()
        ).make_id,
        model_id: fields.modelId,
        catalogue_match: 'model',
      }),
    })
    .execute();
}

test('a source shows its listings, what results pages may show and how fresh they are, and its hourly measurements', async () => {
  const source = await createSource('enabled');
  const modelId = await createModel(source, 'Peugeot 206');
  const hour = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000);
  await owner
    .insertInto('freshness_measurement')
    .values([
      {
        source_id: source,
        source_model_key: null,
        measured_at: new Date(hour.getTime() - 3_600_000),
        new_listings: 3,
        left_market: 0,
        active_listings: 3,
        seen_within_48h: 3,
        posting_to_first_seen_p50_minutes: 80,
        posting_to_first_seen_p90_minutes: 200,
        last_seen_age_p50_minutes: 40,
      },
      {
        source_id: source,
        source_model_key: null,
        measured_at: hour,
        new_listings: 4,
        left_market: 1,
        active_listings: 4,
        seen_within_48h: 3,
        posting_to_first_seen_p50_minutes: 45,
        posting_to_first_seen_p90_minutes: 120,
        last_seen_age_p50_minutes: 30,
      },
      // The tracked model: a key of the latest measurement.
      {
        source_id: source,
        source_model_key: 'Peugeot 206',
        measured_at: hour,
        new_listings: 2,
        left_market: 0,
        active_listings: 3,
        seen_within_48h: 2,
      },
    ])
    .execute();
  // Posted within the day, tracked and just seen; a tracked trim seen 30 minutes ago; a tracked listing not seen for
  // 50 hours, which results pages no longer show; an untracked one; one that left the market 20 minutes ago.
  await createListing(source, { postedMinutesAgo: 70, seenMinutesAgo: 10, modelId });
  await createListing(source, { postedMinutesAgo: 3 * 24 * 60, seenMinutesAgo: 30, modelId });
  await createListing(source, { postedMinutesAgo: 5 * 24 * 60, seenMinutesAgo: 50 * 60, modelId });
  await createListing(source, { postedMinutesAgo: 3 * 24 * 60, seenMinutesAgo: 20 });
  await createListing(source, { postedMinutesAgo: 3 * 24 * 60, seenMinutesAgo: 25, goneMinutesAgo: 20 });

  const status = await loadDataStatus();
  const read = status.sources.find((candidate) => candidate.id === source);
  expect(read).toMatchObject({
    nameFa: 'منبع آزمایشی',
    state: 'live',
    dailyRequestBudget: 12_000,
    postingToStoredMedianMinutes: 45,
    figures: {
      active: 4,
      postedLast24h: 1,
      goneLast24h: 1,
      trackedActive: 3,
      shown: 2,
      shownCheckMedianMinutes: 20,
    },
  });
  expect(Date.parse(read?.figures.lastReadAt ?? '')).toBeGreaterThan(minutesAgo(11).getTime());
  expect(read?.series.map((point) => [point.activeListings, point.lastCheckMedianMinutes])).toEqual([
    [3, 40],
    [4, 30],
  ]);
  // The whole index counts this source's listings among everyone's.
  expect(status.index.figures.active).toBeGreaterThanOrEqual(4);
  expect(status.index.state).toBe('live');
  expect(status.tehranToday).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

test('a paused source is not being updated, and keeps the date of its latest data', async () => {
  const source = await createSource('paused');
  await createListing(source, { postedMinutesAgo: 4 * 24 * 60, seenMinutesAgo: 3 * 24 * 60 });

  const read = (await loadDataStatus()).sources.find((candidate) => candidate.id === source);
  expect(read).toMatchObject({
    state: 'not_updating',
    postingToStoredMedianMinutes: null,
    series: [],
    figures: { active: 1, trackedActive: 0, shown: 0, shownCheckMedianMinutes: null },
  });
  const lastRead = Date.parse(read?.figures.lastReadAt ?? '');
  expect(Math.abs(lastRead - minutesAgo(3 * 24 * 60).getTime())).toBeLessThan(60_000);
});

test('market values show the latest succeeded run, its models that rate listings with their error, and the published evaluation', async () => {
  const modelId = await createModel(await createSource('paused'), 'Test key');
  const run = async (asOfDate: string, status: 'succeeded' | 'failed') =>
    (
      await owner
        .insertInto('valuation_run')
        .values({
          as_of_date: new Date(`${asOfDate}T00:00:00Z`),
          method_version: 1,
          status,
          reference_year_sh: 1478,
          mileage_norm_km_per_year: 20_000,
          window_days: 30,
          prior_strength: 5,
          comparable_count: status === 'succeeded' ? 700 : null,
          valued_count: status === 'succeeded' ? 900 : null,
          rated_count: status === 'succeeded' ? 650 : null,
          finished_at: new Date(),
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
  // Far in the future, so no other run is later; a failed run after it is never shown.
  const succeeded = await run('2099-03-01', 'succeeded');
  await run('2099-03-02', 'failed');
  await owner
    .insertInto('valuation_segment')
    .values({
      valuation_run_id: succeeded,
      model_id: modelId,
      comparable_count: 40,
      zero_km_count: 0,
      min_model_year_sh: 1395,
      max_model_year_sh: 1403,
      error_pct: '5.96',
      rates_listings: true,
    })
    .execute();

  const { valuation, extraction } = await loadDataStatus();
  expect(valuation).toEqual({
    asOfDate: '2099-03-01',
    finishedAt: expect.any(String) as unknown,
    comparables: 700,
    valued: 900,
    rated: 650,
    models: [{ modelId, name: 'پژو ۲۰۶ آزمایشی', comparables: 40, errorPct: 5.96 }],
  });
  // The migration's row: CS-52's report of 2026-09-30.
  expect(extraction).toEqual({
    evaluatedOn: '2026-09-30',
    items: 66,
    itemsRight: 65,
    fieldsScored: 792,
    fieldsRight: 791,
    injectedItems: 11,
    injectedHeld: 11,
  });
});
