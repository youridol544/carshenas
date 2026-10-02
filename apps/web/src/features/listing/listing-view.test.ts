// @vitest-environment node
import { expect, test } from 'vitest';
import { formatMileage } from '@carshenas/locale/format-number';
import { formatToman, toToman } from '@carshenas/locale/toman';
import {
  listingFactsFixture,
  listingPageFixture,
  valuationFactsFixture,
} from '@/features/listing/listing-fixtures';
import { LISTING_COPY } from '@/features/listing/listing-copy';
import {
  comparableRows,
  declaredRows,
  factRows,
  freshnessView,
  historyView,
  listingTitle,
  priceView,
  riskFlags,
  summaryLine,
  textConditionRows,
  textTermRows,
} from '@/features/listing/listing-view';
import type { FactEvidence, PriceEvent } from '@/features/listing/listing-types';

const NOW = '2026-10-02T16:00:00.000Z';

test('the title is the catalogue name with the model year; the summary line is the facts a buyer scans', () => {
  const listing = listingFactsFixture();
  expect(listingTitle(listing)).toBe('پژو ۲۰۶ تیپ ۵، مدل\u00A0۱۳۹۵');
  expect(summaryLine(listing)).toEqual([formatMileage(160_000), 'اتوماتیک', 'تهران، خانی آباد نو']);
});

test('the price is in full digits; an instalment sale shows its down payment with the words that say so', () => {
  expect(priceView(listingFactsFixture())).toEqual({
    kind: 'amount',
    text: formatToman(toToman(960_000_000)),
    caption: LISTING_COPY.price.asking,
  });
  expect(priceView(listingFactsFixture({ priceType: 'negotiable', askingPriceToman: null }))).toMatchObject({
    kind: 'words',
    text: LISTING_COPY.price.negotiable,
  });
  expect(
    priceView(
      listingFactsFixture({
        priceType: 'installment',
        askingPriceToman: null,
        downPaymentToman: 200_000_000,
      }),
    ),
  ).toEqual({
    kind: 'down_payment',
    text: formatToman(toToman(200_000_000)),
    caption: LISTING_COPY.price.downPayment,
  });
  expect(priceView(listingFactsFixture({ status: 'gone' }))).toMatchObject({
    caption: LISTING_COPY.price.lastAsking,
  });
});

test('the facts table lists what the listing states and the days on market from the day it was listed', () => {
  const rows = factRows(listingFactsFixture(), NOW);
  expect(rows.map((row) => row.label)).toEqual(
    expect.arrayContaining([
      'سال ساخت',
      'کارکرد',
      'گیربکس',
      'رنگ',
      'محل',
      'فروشنده',
      'منبع',
      'تاریخ انتشار',
      'روی بازار',
    ]),
  );
  expect(rows.find((row) => row.label === 'روی بازار')?.value).toContain('۳');
  const thin = factRows(
    listingFactsFixture({ modelYearSh: null, mileageKm: null, gearbox: null, colourFamily: null }),
    NOW,
  );
  expect(thin.map((row) => row.label)).not.toContain('سال ساخت');
  expect(thin.map((row) => row.label)).not.toContain('کارکرد');
});

test('what the seller declared is listed with its tone, and a stated problem is a warning', () => {
  const rows = declaredRows(
    listingFactsFixture({
      declared: {
        body: 'repainted_around',
        engine: 'needs_repair',
        gearbox: 'repaired',
        frontChassis: 'repainted',
        rearChassis: null,
      },
    }),
  );
  expect(rows.map((row) => [row.id, row.tone])).toEqual([
    ['body', 'warning'],
    ['front_chassis', 'warning'],
    ['engine', 'warning'],
    ['gearbox', 'warning'],
    ['insurance', 'neutral'],
  ]);
  expect(rows.every((row) => row.quote === null)).toBe(true);
});

const FACTS: FactEvidence[] = [
  { field: 'paint', value: 'around', evidence: 'دور رنگ' },
  { field: 'panels', value: '5_or_more', evidence: 'دور رنگ' },
  { field: 'chassis', value: 'intact', evidence: 'شاسی ها سالم' },
  { field: 'price_meaning', value: 'down_payment', evidence: null },
  { field: 'swap', value: 'yes', evidence: 'معاوضه' },
];

test('the text’s facts come with the phrase they were read from, and a panel count is never shown', () => {
  const rows = textConditionRows(FACTS);
  expect(rows.map((row) => [row.text, row.quote])).toEqual([
    ['دوررنگ', 'دور رنگ'],
    ['شاسی سالم', 'شاسی ها سالم'],
  ]);
  expect(rows.some((row) => row.id.startsWith('panels'))).toBe(false);
  const terms = textTermRows(FACTS);
  expect(terms.map((row) => [row.id, row.quote])).toEqual([
    ['price_meaning:down_payment', null],
    ['swap:yes', 'معاوضه'],
  ]);
});

test('a down payment, a missing mileage and a seller’s field against the text are flagged in words', () => {
  const page = listingPageFixture({
    listing: listingFactsFixture({
      priceType: 'installment',
      askingPriceToman: null,
      downPaymentToman: 1,
      mileageKm: null,
      declared: { body: 'intact', engine: null, gearbox: null, frontChassis: 'intact', rearChassis: null },
    }),
    evidence: [
      { field: 'paint', value: 'partial', evidence: 'رنگ چند جا' },
      { field: 'chassis', value: 'damaged', evidence: 'ضربه' },
      { field: 'plate', value: 'free_zone', evidence: 'پلاک منطقه' },
    ],
  });
  const ids = riskFlags(page).map((flag) => flag.id);
  expect(ids).toEqual(
    expect.arrayContaining([
      'down_payment',
      'mileage_unread',
      'paint_conflict',
      'chassis_conflict',
      'free_zone',
    ]),
  );
  for (const flag of riskFlags(page)) expect(flag.text.length).toBeGreaterThan(20);
});

test('a listing that accepts instalments and is guarded from a rating says why', () => {
  const page = listingPageFixture({
    listing: listingFactsFixture({ acceptsInstallments: true }),
    valuation: valuationFactsFixture({
      dealRating: null,
      priceGapPct: null,
      noRatingReason: 'installment_price',
    }),
  });
  expect(riskFlags(page).map((flag) => flag.id)).toContain('installment_guard');
});

test('a clean listing has no flag', () => {
  expect(riskFlags(listingPageFixture())).toEqual([]);
});

test('the page says how long ago the listing was read, and a stale one asks for a re-check', () => {
  const fresh = freshnessView(listingFactsFixture({ lastCheckedAt: '2026-10-02T14:00:00.000Z' }), NOW);
  expect(fresh).toMatchObject({ state: 'fresh', requestsRecheck: false });
  expect(fresh.checked).toMatch(/۲\s+ساعت\s+پیش/);
  const stale = freshnessView(listingFactsFixture({ lastCheckedAt: '2026-10-02T09:00:00.000Z' }), NOW);
  expect(stale).toMatchObject({ state: 'stale', requestsRecheck: true });
  const never = freshnessView(listingFactsFixture({ lastCheckedAt: null }), NOW);
  expect(never).toMatchObject({ state: 'stale', requestsRecheck: true });
  const gone = freshnessView(
    listingFactsFixture({ status: 'gone', lastCheckedAt: '2026-09-01T00:00:00.000Z' }),
    NOW,
  );
  expect(gone).toMatchObject({ state: 'off_market', requestsRecheck: false });
});

// The first event is the price when the listing was first read (no previous price); the others are changes.
const EVENTS: PriceEvent[] = [
  {
    observedAt: '2026-09-29T09:00:00.000Z',
    priceType: 'asking',
    askingPriceToman: 1_100_000_000,
    previousPriceType: null,
    previousPriceToman: null,
  },
  {
    observedAt: '2026-09-30T08:00:00.000Z',
    priceType: 'asking',
    askingPriceToman: 1_000_000_000,
    previousPriceType: 'asking',
    previousPriceToman: 1_100_000_000,
  },
  {
    observedAt: '2026-10-01T08:00:00.000Z',
    priceType: 'asking',
    askingPriceToman: 960_000_000,
    previousPriceType: 'asking',
    previousPriceToman: 1_000_000_000,
  },
];

test('the price history starts from the first price, runs newest first and names the total change', () => {
  const history = historyView(listingPageFixture({ priceHistory: EVENTS }));
  expect(history.rows.map((row) => row.id)).toEqual(['event-1', 'event-0', 'listed']);
  expect(history.rows[2]?.price).toBe(formatToman(toToman(1_100_000_000)));
  expect(history.rows[0]).toMatchObject({
    label: LISTING_COPY.history.dropped,
    price: formatToman(toToman(960_000_000)),
    previous: formatToman(toToman(1_000_000_000)),
  });
  expect(history.totalChange).toContain(formatToman(toToman(140_000_000)));
  expect(history.totalChange).toContain(LISTING_COPY.history.lower);
  expect(history.unchanged).toBe(false);
});

test('days on market and the history start on the same day, so they cannot disagree', () => {
  const page = listingPageFixture({ priceHistory: EVENTS });
  const history = historyView(page);
  const listedRow = history.rows.at(-1);
  const rows = factRows(page.listing, page.now);
  expect(listedRow?.date).toBe(rows.find((row) => row.label === 'تاریخ انتشار')?.value);
  expect(history.daysOnMarket).toBe('۳');
  expect(rows.find((row) => row.label === 'روی بازار')?.value).toContain('۳');
});

test('a listing that never changed price says so, and a gone one counts its days to the day it left', () => {
  const unchanged = historyView(listingPageFixture());
  expect(unchanged).toMatchObject({ unchanged: true, totalChange: null });
  expect(unchanged.rows).toHaveLength(1);
  expect(unchanged.rows[0]?.price).toBe(formatToman(toToman(960_000_000)));
  const gone = historyView(
    listingPageFixture({
      listing: listingFactsFixture({ status: 'gone', delistedAt: '2026-09-30T10:00:00.000Z' }),
    }),
  );
  expect(gone.daysOnMarket).toBe('۱');
});

test('a price that went negotiable is a row of its own, with the old price struck', () => {
  const history = historyView(
    listingPageFixture({
      listing: listingFactsFixture({ priceType: 'negotiable', askingPriceToman: null }),
      priceHistory: [
        {
          observedAt: '2026-10-01T08:00:00.000Z',
          priceType: 'negotiable',
          askingPriceToman: null,
          previousPriceType: 'asking',
          previousPriceToman: 960_000_000,
        },
      ],
    }),
  );
  expect(history.rows[0]).toMatchObject({
    label: LISTING_COPY.history.priceRemoved,
    price: LISTING_COPY.price.negotiable,
  });
  expect(history.rows[0]?.previous).toBe(formatToman(toToman(960_000_000)));
});

test('each comparable leads to its own page with its price and the price for this car', () => {
  const rows = comparableRows(listingPageFixture().comparables);
  expect(rows[0]).toMatchObject({ id: 11, href: '/listings/11', offMarket: false });
  expect(rows[1]).toMatchObject({ id: 12, offMarket: true });
  expect(rows[0]?.asking).toBe(formatToman(toToman(1_150_000_000)));
});

test('a listing with no price of its own claims none in its history', () => {
  const history = historyView(
    listingPageFixture({
      listing: listingFactsFixture({ priceType: null, askingPriceToman: null }),
      priceHistory: EVENTS.slice(0, 1),
    }),
  );
  expect(history.rows).toHaveLength(1);
  expect(history.rows[0]?.price).toBe(LISTING_COPY.history.firstPriceUnknown);
  expect(history.totalChange).toBeNull();
  expect(history.unchanged).toBe(false);
});
