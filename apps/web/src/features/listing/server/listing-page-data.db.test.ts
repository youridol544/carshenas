import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { formatToman, toToman } from '@carshenas/locale/toman';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { buildExplanation } from '@/features/listing/listing-explanation';
import {
  comparableRows,
  historyView,
  riskFlags,
  textConditionRows,
  textTermRows,
} from '@/features/listing/listing-view';
import { requestRecheck } from '@/features/listing/server/listing-mutations';
import { readListingPage } from '@/features/listing/server/listing-page-data';
import { assertScratchDatabase, ownerDatabase } from '@/server/db/account-test-database';
import { database } from '@/server/db/database';
import { checkFigures } from '@/features/listing/server/figure-check';
import {
  addBareListing,
  addFactEvidence,
  addCheckedListing,
  addRemovedListing,
  clearRecheckQueue,
  fillRecheckQueue,
  recheckCounts,
  ruleDefinition,
  viewOptions,
  expectedFigures,
  removeListingPage,
  seedHistoryAndFacts,
  seedListingPage,
  type ListingTestData,
} from '@/server/db/listing-test-database';

// The listing page's reads and its one write (CS-64) against the scratch database `pnpm db:check` migrated, through the
// app's own pool as carshenas_web: what the page shows is exactly what the rows say, the seller's text reaches the page
// only as short phrases through the view, a stale listing records one re-check request, and every number of the
// explanation is recomputed in SQL from the stored rows.

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  cache: <T>(fn: T) => fn,
}));
vi.mock('@/server/observability/logger', async () => {
  const { recordingLogger } = await import('@/server/observability/recording-logger');
  return { logger: recordingLogger(), captureError: vi.fn() };
});

const owner = ownerDatabase();
let data: ListingTestData;

beforeAll(async () => {
  await assertScratchDatabase(owner);
  data = await seedListingPage(owner, randomBytes(4).toString('hex'));
  await seedHistoryAndFacts(owner, data);
});

afterAll(async () => {
  await removeListingPage(owner, data);
  await owner.destroy();
});

async function pageOf(id: number) {
  const result = await readListingPage(id);
  if (result.status !== 'found') throw new Error('the listing was not found');
  return result.page;
}

test('the page reads the listing, its photos in order, its valuation and the model’s fitted terms', async () => {
  const page = await pageOf(data.listingId);
  expect(page.listing).toMatchObject({
    id: data.listingId,
    status: 'active',
    modelYearSh: 1395,
    mileageKm: 160_000,
    askingPriceToman: 900_000_000,
    gearbox: 'automatic',
    source: { key: data.source, name: 'منبع آزمایشی' },
    model: { name: 'مدل ۲۰۶ آزمایشی' },
  });
  expect(page.photos.map((photo) => photo.url)).toEqual([
    'https://s100.divarcdn.com/static/photo/test/1.webp',
    'https://s100.divarcdn.com/static/photo/test/2.webp',
  ]);
  expect(page.valuation).toMatchObject({
    marketValueToman: 1_000_000_000,
    priceGapPct: -10,
    dealRating: 'great',
    noRatingReason: null,
    run: {
      asOfDate: '2099-12-30',
      methodVersion: 96,
      referenceYearSh: 1405,
      mileageNormKmPerYear: 20_000,
      windowDays: 30,
    },
    segment: {
      comparableCount: 20,
      minModelYearSh: 1385,
      maxModelYearSh: 1404,
      errorPct: 6.72,
      ratesListings: true,
    },
    modelAgeSlope: -0.062,
  });
  expect(page.valuation?.coefficients).toEqual({
    mileage_deviation: -0.08,
    body_minor: -0.02,
    gearbox_automatic: 0.095,
    off_colour: -0.05,
  });
  expect(page.similar).toEqual([]);
});

test('the comparables come in the valuation’s order, each with its own id, price and adjusted price', async () => {
  const page = await pageOf(data.listingId);
  expect(page.comparables.map((item) => item.listingId)).toEqual(data.comparableIds);
  expect(page.comparables.map((item) => item.position)).toEqual([1, 2, 3]);
  expect(page.comparables[0]).toMatchObject({
    askingPriceToman: 950_000_000,
    adjustedPriceToman: 990_000_000,
    modelYearSh: 1395,
  });
  expect(comparableRows(page.comparables)[0]?.href).toBe(`/listings/${String(data.comparableIds[0])}`);
});

test('the price history is the listing’s own changes, and days on market start where the history does', async () => {
  const page = await pageOf(data.listingId);
  expect(page.priceHistory.map((event) => event.askingPriceToman)).toEqual([
    1_000_000_000, 950_000_000, 900_000_000,
  ]);
  const history = historyView(page);
  expect(history.rows).toHaveLength(3);
  expect(history.rows.at(-1)?.price).toBe(formatToman(toToman(1_000_000_000)));
  expect(history.daysOnMarket).toBe('۱۰');
});

test('the text’s facts reach the page as short accepted phrases only, never the rest of the text', async () => {
  const page = await pageOf(data.listingId);
  const byField = new Map(page.evidence.map((fact) => [fact.field, fact]));
  // Accepted: the paint, the chassis, the swap (its phrase holds a phone number, so it is dropped), the instalment.
  expect([...byField.keys()].sort()).toEqual(['chassis', 'installment', 'paint', 'swap']);
  expect(byField.get('paint')).toMatchObject({ value: 'around', evidence: 'دور رنگ' });
  expect(byField.get('swap')).toMatchObject({ value: 'yes', evidence: null });
  // Not accepted (below its threshold) and not stated: not on the page at all.
  expect(byField.has('plate')).toBe(false);
  expect(byField.has('negotiable')).toBe(false);
  const rows = [...textConditionRows(page.evidence), ...textTermRows(page.evidence)];
  expect(rows.find((row) => row.id.startsWith('swap'))?.quote).toBeNull();
  expect(JSON.stringify(page)).not.toContain('09121234567');
});

test('the web role reads the facts through the view and cannot read the extraction tables themselves', async () => {
  await expect(
    database().selectFrom('extraction_field').select('evidence').limit(1).execute(),
  ).rejects.toMatchObject({ code: '42501' });
  await expect(database().selectFrom('extraction').select('id').limit(1).execute()).rejects.toMatchObject({
    code: '42501',
  });
  const view = await database()
    .selectFrom('listing_fact_evidence')
    .select('field')
    .where('listing_id', '=', data.listingId)
    .execute();
  expect(view.length).toBe(4);
});

// Shapes by which a phrase of a listing's text could reach the seller: shown as no quote at all (the fact stays listed).
const CONTACT_PHRASES = [
  'تماس 09123456789',
  'تماس 0912 345 6789',
  'تماس 0912-345-6789',
  'تماس 0912.345.6789',
  'تماس 0912/345/6789',
  'تماس 0912,345,6789',
  'تماس +98 912 345 6789',
  'تماس +989123456789',
  'تماس 0098 912 345 6789',
  'تماس 98-912-345-6789',
  'تماس ۰۹۱۲ ۳۴۵ ۶۷۸۹',
  'تماس ۰۹۱۲-۳۴۵-۶۷۸۹',
  'تماس ٠٩١٢ ٣٤٥ ٦٧٨٩',
  'تماس ۰۹۱۲\u200c۳۴۵\u200c۶۷۸۹',
  'تماس ۰۹۱۲ - ۳۴۵ - ۶۷۸۹',
  'تلفن 021 1234 5678',
  'تلفن ۰۲۱-۱۲۳۴۵۶۷۸',
  'پیام بدهید @seller_name',
  'تلگرام t.me/seller',
  'واتساپ wa.me/989123456789',
  'اینستاگرام: instagram.com/seller',
  'https://example.com/car',
];
/** Price and other digit-heavy phrases that are not a way to reach anyone: they stay. */
const KEPT_PHRASES = [
  'پیش پرداخت: 966,000,000',
  'پیش پرداخت ۹۶۶٬۰۰۰٬۰۰۰ تومان',
  'قیمت ۱٬۰۹۸٬۰۰۰٬۰۰۰ توافقی',
  'کارکرد 98000 کیلومتر',
  'مدل 1398 دور رنگ',
  'قسط ماهی 12,500,000',
  'پلاک ۱۲ ب ۳۴۵ ایران ۹۸',
];

test('a phrase that could reach the seller is never quoted, in any shape its digits are written in', async () => {
  const everything = [...CONTACT_PHRASES, ...KEPT_PHRASES];
  const ids = new Map<string, number>();
  for (const [index, phrase] of everything.entries()) {
    ids.set(phrase, await addFactEvidence(owner, data.source, `ev${String(index)}`, phrase));
  }
  for (const phrase of everything) {
    const id = ids.get(phrase) ?? 0;
    const rows = await database()
      .selectFrom('listing_fact_evidence')
      .select(['field', 'value', 'evidence'])
      .where('listing_id', '=', id)
      .execute();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.value).toBe('yes');
    expect(rows[0]?.evidence).toBe(CONTACT_PHRASES.includes(phrase) ? null : phrase);
  }
});

test('the view is a security barrier, so a caller’s own predicate cannot read what it filters out', async () => {
  expect(await viewOptions(owner)).toContain('security_barrier=true');
});

test('an id that is no listing, and a listing taken down, are missing', async () => {
  expect(await readListingPage(2_000_000_000)).toEqual({ status: 'missing' });
  const removed = { id: await addRemovedListing(owner, data.source) };
  expect(await readListingPage(removed.id)).toEqual({ status: 'missing' });
});

test('a listing without a valuation row has no valuation, and its page still reads', async () => {
  const bare = { id: await addBareListing(owner, data.source) };
  const page = await pageOf(bare.id);
  expect(page.valuation).toBeNull();
  expect(page.comparables).toEqual([]);
  expect(page.listing.lastCheckedAt).toBeNull();
  expect(buildExplanation({ listing: page.listing, valuation: null, comparables: [] }).figures).toEqual([]);
  expect(riskFlags(page).map((flag) => flag.id)).toContain('mileage_unread');
});

async function pendingRequests(listingId: number): Promise<number> {
  const rows = await owner
    .selectFrom('listing_recheck_request')
    .select('id')
    .where('listing_id', '=', listingId)
    .where('handled_at', 'is', null)
    .execute();
  return rows.length;
}

function listingChecked(hoursAgo: number | null, status: 'active' | 'gone' = 'active'): Promise<number> {
  return addCheckedListing(owner, data.source, `rc${randomBytes(4).toString('hex')}`, hoursAgo, status);
}

test('a listing last read longer ago than the freshness window records one re-check request, however often it is asked', async () => {
  const id = await listingChecked(9);
  expect(await requestRecheck(id)).toBe('recorded');
  expect(await requestRecheck(id)).toBe('pending');
  expect(await requestRecheck(id)).toBe('pending');
  expect(await pendingRequests(id)).toBe(1);
});

test('a listing never read has its page requested; a fresh one and a gone one record nothing', async () => {
  const never = await listingChecked(null);
  expect(await requestRecheck(never)).toBe('recorded');
  const fresh = await listingChecked(2);
  expect(await requestRecheck(fresh)).toBe('not_needed');
  const gone = await listingChecked(100, 'gone');
  expect(await requestRecheck(gone)).toBe('not_needed');
  expect(await requestRecheck(2_000_000_000)).toBe('not_needed');
  expect([await pendingRequests(never), await pendingRequests(fresh), await pendingRequests(gone)]).toEqual([
    1, 0, 0,
  ]);
});

test('no loop over ids can queue more than 200 waiting requests or 120 an hour', async () => {
  await clearRecheckQueue(owner, data.source);
  // 200 waiting: the 201st is refused, and asking again for one that waits is still just «pending».
  await fillRecheckQueue(owner, data.source, {
    waiting: 200 - (await recheckCounts(owner)).waiting,
    handledThisHour: 0,
  });
  const next = await listingChecked(9);
  expect(await requestRecheck(next)).toBe('capped');
  expect(await pendingRequests(next)).toBe(0);
  // 120 made in the hour, none waiting: still refused.
  await clearRecheckQueue(owner, data.source);
  await fillRecheckQueue(owner, data.source, {
    waiting: 0,
    handledThisHour: 120 - (await recheckCounts(owner)).lastHour,
  });
  expect(await requestRecheck(next)).toBe('capped');
  // 119 made: one more fits, and then the cap holds.
  await clearRecheckQueue(owner, data.source);
  await fillRecheckQueue(owner, data.source, {
    waiting: 0,
    handledThisHour: 119 - (await recheckCounts(owner)).lastHour,
  });
  expect(await requestRecheck(next)).toBe('recorded');
  const another = await listingChecked(9);
  expect(await requestRecheck(another)).toBe('capped');
  await clearRecheckQueue(owner, data.source);
});

test('the numbers the page quotes from rules are the rules’ own, read from their homes', async () => {
  const definition = await ruleDefinition(owner);
  const rules = await import('@/features/listing/listing-rules');
  // «at least 3 comparables within 2 years», «more than 3 times the value is an outlier», «8 comparables».
  expect(definition).toContain(`near_year_count < ${String(rules.MIN_NEAR_YEAR_COMPARABLES)}`);
  expect(definition).toContain(`model_year_sh - ${String(rules.NEAR_YEARS)}`);
  expect(definition).toContain(`${String(rules.OUTLIER_FACTOR)}.0`);
  expect(definition).toContain(`segment_count < ${String(rules.MIN_COMPARABLES)}`);
  const method = readFileSync(
    new URL('../../../../../worker/src/valuation/method.ts', import.meta.url),
    'utf8',
  );
  const constant = (name: string) => Number(new RegExp(`export const ${name} = (-?\\d+)`).exec(method)?.[1]);
  expect(constant('MIN_SEGMENT_COMPARABLES')).toBe(rules.MIN_COMPARABLES);
  expect(constant('MAX_SEGMENT_ERROR_PCT')).toBe(rules.MAX_SEGMENT_ERROR_PCT);
  expect(constant('INSTALLMENT_GUARD_GAP_PCT')).toBe(-rules.INSTALLMENT_GUARD_GAP_PCT);
});

test('every number of the explanation of the seeded listing is recomputed from its stored rows', async () => {
  const page = await pageOf(data.listingId);
  const explanation = buildExplanation({
    listing: page.listing,
    valuation: page.valuation,
    comparables: page.comparables,
  });
  const check = checkFigures(explanation, await expectedFigures(owner, data.listingId));
  expect(check.wrong).toEqual([]);
  expect(check.unverified).toEqual([]);
  expect(check.checked).toBeGreaterThan(12);
});
