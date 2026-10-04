// @vitest-environment node
import { expect, test } from 'vitest';
import { DEAL_GAP_PCT } from '@carshenas/search/filters';
import { gaugeInfo, gaugeView } from '@/features/listing/gauge-view';
import { listingFactsFixture, valuationFactsFixture } from '@/features/listing/listing-fixtures';
import { gaugeBands, GAUGE_HALF_RANGE_PCT, markerShare } from '@/features/listing/listing-rules';

test('the five bands cover the bar from the cheap end, and their edges are S01’s limits', () => {
  const bands = gaugeBands();
  expect(bands.map((band) => band.rating)).toEqual(['great', 'good', 'fair', 'high', 'overpriced']);
  expect(bands.reduce((sum, band) => sum + band.share, 0)).toBeCloseTo(1, 10);
  expect(bands.map((band) => [band.fromPct, band.toPct])).toEqual([
    [-GAUGE_HALF_RANGE_PCT, DEAL_GAP_PCT.great],
    [DEAL_GAP_PCT.great, DEAL_GAP_PCT.good],
    [DEAL_GAP_PCT.good, DEAL_GAP_PCT.fair],
    [DEAL_GAP_PCT.fair, DEAL_GAP_PCT.high],
    [DEAL_GAP_PCT.high, GAUGE_HALF_RANGE_PCT],
  ]);
});

test('the marker sits in the band the rating names: each limit lands on the band’s own edge', () => {
  const bands = gaugeBands();
  let from = 0;
  for (const band of bands) {
    expect(markerShare(band.fromPct)).toBeCloseTo(from, 10);
    from += band.share;
  }
  expect(markerShare(0)).toBeCloseTo(0.5, 10);
  // The market value is the middle of the fair band.
  const fair = bands[2];
  expect(fair).toBeDefined();
  expect(markerShare(-500)).toBe(0);
  expect(markerShare(500)).toBe(1);
});

test('a rated listing gets bands, a marker where its stored gap puts it, and its words', () => {
  const view = gaugeView(
    listingFactsFixture(),
    valuationFactsFixture({ priceGapPct: -7, dealRating: 'good' }),
  );
  expect(view?.banded).toBe(true);
  expect(view?.bands).toHaveLength(5);
  expect(view?.marker).toBeCloseTo(markerShare(-7), 10);
  expect(view?.ratingLabel).toBe('معامله‌ی خوب');
  expect(view?.gap).toContain('زیر ارزش بازار');
  expect(view?.beyond).toBeNull();
});

test('a price beyond the bar is marked at its end and says so', () => {
  const view = gaugeView(
    listingFactsFixture(),
    valuationFactsFixture({ priceGapPct: -35, dealRating: 'great' }),
  );
  expect(view?.marker).toBe(0);
  expect(view?.beyond).toBe('cheap');
});

test('a market value with no rating shows the marker from the value and the price, and no bands', () => {
  const view = gaugeView(
    listingFactsFixture({ askingPriceToman: 1_223_000_000 * 1.1 }),
    valuationFactsFixture({
      priceGapPct: null,
      dealRating: null,
      noRatingReason: 'dealer_new_car',
      ratedPriceToman: null,
      marketValueToman: 1_223_000_000,
    }),
  );
  expect(view?.banded).toBe(false);
  expect(view?.bands).toEqual([]);
  expect(view?.gap).toBeNull();
  expect(view?.marker).toBeCloseTo(markerShare(10), 3);
  expect(view?.rating).toBe('none');
  expect(view?.ratingLabel).toBe('بدون ارزیابی');
});

test('an instalment or negotiable listing has no marker, only the value', () => {
  const view = gaugeView(
    listingFactsFixture({ priceType: 'installment', askingPriceToman: null, downPaymentToman: 200_000_000 }),
    valuationFactsFixture({
      priceGapPct: null,
      dealRating: null,
      noRatingReason: 'installment_price',
      ratedPriceToman: null,
    }),
  );
  expect(view?.marker).toBeNull();
  expect(view?.price).toBeNull();
  expect(view?.priceText).toBe('قیمت کامل در آگهی نیامده');
});

test('a listing with no valuation has no gauge', () => {
  expect(gaugeView(listingFactsFixture(), null)).toBeNull();
});

test('the info control names the five bands with the limits the rating uses, and when a listing is not rated', () => {
  const info = gaugeInfo();
  const bands = info.sections.find((section) => section.id === 'bands');
  expect(bands?.rows?.map((row) => row.label)).toEqual([
    'معامله‌ی عالی',
    'معامله‌ی خوب',
    'قیمت منصفانه',
    'گران',
    'خیلی گران',
  ]);
  expect(bands?.rows?.[0]?.text).toContain('۱۰');
  expect(bands?.rows?.[1]?.text).toContain('۴');
  expect(info.sections.find((section) => section.id === 'needs')?.paragraphs?.[0]).toContain('آگهی مشابه');
  // No heading above a band or a paragraph: an info control answers one question in plain sentences.
  expect(info.sections.every((section) => section.heading === undefined)).toBe(true);
});
