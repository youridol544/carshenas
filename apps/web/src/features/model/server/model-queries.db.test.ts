import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import {
  readModelIndex,
  readModelOverview,
  readModelRef,
  readModelTrend,
  readModelTrims,
  readPopularModels,
} from '@/features/model/server/model-queries';
import { assertScratchDatabase, ownerDatabase } from '@/server/db/account-test-database';
import { database } from '@/server/db/database';
import { removeModelData, seedModelData, type ModelTestData } from '@/server/db/model-test-database';

// The model page's reads (CS-67) against the scratch database `pnpm db:check` migrated, through the app's own pool as
// carshenas_web: rows seeded as the owner (server/db/model-test-database.ts: ten listings of model year 1400 priced 100
// to 190 million, three of 1399, one seen three days ago, one with no trim, and a valuation history of two days, the
// first also run again by another method), then read back. The seed's numbers have known answers.

vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

const owner = ownerDatabase();
const suffix = randomBytes(4).toString('hex');
let data: ModelTestData;

beforeAll(async () => {
  await assertScratchDatabase(owner);
  data = await seedModelData(owner, suffix);
});

afterAll(async () => {
  await removeModelData(owner, suffix);
  await Promise.all([owner.destroy(), database().destroy()]);
});

const key = () => `${data.makeSlug}.${data.modelSlug}`;

test('a model is found by its two slugs, with its names and body type, and nothing else is found', async () => {
  const model = await readModelRef(data.makeSlug, data.modelSlug);
  expect(model).toMatchObject({
    id: data.modelId,
    key: key(),
    name: 'مدل اصلی',
    makeName: 'سازنده‌ی مدل آزمایشی',
    bodyType: { code: 'sedan' },
  });
  expect(await readModelRef(data.makeSlug, 'no-such-model')).toBeNull();
  expect(await readModelRef('no-such-make', data.modelSlug)).toBeNull();
});

test('the overview counts the listings the search shows, leaves out the stale one and sums the ratings', async () => {
  const { stats, years } = await readModelOverview(key(), null);
  // 10 + 3 + the one with no trim; the listing seen three days ago is outside the freshness window.
  expect(stats.count).toBe(14);
  expect(stats.priced).toBe(14);
  expect(stats.firstYear).toBe(1399);
  expect(stats.lastYear).toBe(1400);
  expect(stats.popularRank).toBe(3);
  expect(stats.ratings).toEqual({ great: 1, good: 0, fair: 8, high: 0, overpriced: 1 });
  expect(stats.unrated).toBe(4);
  // facts: paint stated by six (four free), gearbox by all fourteen (three automatic), seller by all (nine private)
  expect(stats.facts.paintFree).toEqual({ of: 6, yes: 4 });
  expect(stats.facts.automatic).toEqual({ of: 14, yes: 3 });
  expect(stats.facts.privateSeller.of).toBe(14);
  expect(years.map((row) => [row.year, row.count])).toEqual([
    [1400, 11],
    [1399, 3],
  ]);
});

test('the price figures are the middle of the asking prices, in whole tomans', async () => {
  const { stats } = await readModelOverview(key(), 1400);
  expect(stats.count).toBe(11);
  // 100, 110 ... 190 and 150 million: the median is 145 million, the 10th and 90th percentiles interpolate.
  expect(stats.medianToman).toBe(145_000_000);
  expect(stats.lowToman).toBe(110_000_000);
  expect(stats.highToman).toBe(180_000_000);
  expect(Number.isInteger(stats.medianToman)).toBe(true);
  const none = await readModelOverview(key(), 1388);
  expect(none.stats.count).toBe(0);
  expect(none.stats.medianToman).toBeNull();
  expect(none.years).toHaveLength(2);
});

test('the trims have their counts and medians, and the listings with no trim are one row', async () => {
  const trims = await readModelTrims(key(), null);
  expect(trims.map((trim) => [trim.key, trim.count])).toEqual(
    expect.arrayContaining([
      [data.trimKeys[0], 8],
      [data.trimKeys[1], 5],
      [null, 1],
    ]),
  );
  expect(trims.find((trim) => trim.key === data.trimKeys[0])?.name).toBe('تیپ الف');
  const ofYear = await readModelTrims(key(), 1399);
  expect(ofYear).toHaveLength(1);
});

test('the trend has a point for each day of the history, counts a day once, and keeps the model years apart', async () => {
  const days = await readModelTrend(data.modelId, 1400);
  expect(days.map((day) => day.date)).toEqual([...data.days]);
  // The first day was run again by another method: the later run counts, the earlier one does not.
  expect(days[0]).toMatchObject({ count: 10, medianToman: 290_000_000 });
  expect(days[1]).toMatchObject({ count: 10, medianToman: 152_250_000 });
  expect(days[0]?.lowToman).toBeLessThan(days[0]?.medianToman ?? 0);
  expect(days[0]?.highToman).toBeGreaterThan(days[0]?.medianToman ?? 0);
  const earlier = await readModelTrend(data.modelId, 1399);
  expect(earlier.map((day) => [day.date, day.count, day.medianToman])).toEqual([
    [data.days[1], 3, 94_500_000],
  ]);
  expect(await readModelTrend(data.modelId, 1380)).toEqual([]);
});

test('popular models and the index list the model with its count, by listings', async () => {
  const popular = await readPopularModels();
  const found = popular.find((model) => model.makeSlug === data.makeSlug && model.slug === data.modelSlug);
  expect(found).toMatchObject({ name: 'مدل اصلی', count: 14, bodyType: 'sedan' });
  const index = await readModelIndex();
  expect(
    index.find((model) => model.makeSlug === data.makeSlug && model.slug === data.modelSlug),
  ).toMatchObject({
    makeName: 'سازنده‌ی مدل آزمایشی',
    count: 14,
  });
  // The other model of the make has no listing, so it is not listed.
  expect(index.some((model) => model.makeSlug === data.makeSlug && model.slug === data.otherSlug)).toBe(
    false,
  );
  const counts = index.map((model) => model.count);
  expect(counts).toEqual([...counts].sort((a, b) => b - a));
});
