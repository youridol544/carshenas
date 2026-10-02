// @vitest-environment node
import { expect, test } from 'vitest';
import { formatDate } from '@carshenas/locale/format-date';
import { formatMileage, formatPercent } from '@carshenas/locale/format-number';
import { formatToman, formatTomanEstimate, toToman } from '@carshenas/locale/toman';
import { SEARCH_COPY } from '@/features/search/search-copy';
import { cardView, conditionOf, daysOnMarket, gapSentence } from '@/features/search/listing-card-view';
import { listingCardFixture, thinListingCardFixture } from '@/features/search/search-fixtures';

const COPY = SEARCH_COPY.card;

const card = listingCardFixture;

const NOW = '2026-10-02T10:00:00.000Z';

test('a rated listing shows its title, full-digit price, deal, gap and the value it is measured against', () => {
  const view = cardView(card(), NOW);
  expect(view.title).toBe('پژو ۲۰۶ تیپ ۵، مدل\u00A0۱۳۹۵');
  expect(view.price).toEqual({ kind: 'amount', text: formatToman(toToman(960_000_000)) });
  expect(view.deal).toEqual({
    rating: 'great',
    label: 'معامله‌ی عالی',
    gap: `${formatPercent(0.21)} زیر ارزش بازار`,
    marketValue: `ارزش بازار: ${formatTomanEstimate(toToman(1_223_000_000))}، ${formatDate('2026-10-01')}`,
    reason: null,
  });
  expect(view.facts).toEqual([formatMileage(270_000), 'دنده‌ای']);
  expect(view.place).toBe('تهران، خانی آباد نو');
  expect(view.source).toBe('دیوار');
  expect(view.seller).toBe('فروشنده‌ی شخصی');
  expect(view.photo).toEqual({
    src: 'https://s100.divarcdn.com/static/photo/neda/webp_thumbnail/a/b.webp',
    count: 11,
  });
  expect(view.hasDetails).toBe(true);
});

test('a priced listing the valuation did not rate says so instead of showing a badge colour', () => {
  const view = cardView(card({ valuation: null }), NOW);
  expect(view.deal).toEqual({
    rating: 'none',
    label: COPY.unrated,
    gap: null,
    marketValue: null,
    reason: COPY.unratedNoValue,
  });
});

test('a negotiable, instalment or unpriced listing gets words for a price and no badge', () => {
  expect(
    cardView(card({ priceType: 'negotiable', askingPriceToman: null, valuation: null }), NOW),
  ).toMatchObject({
    price: { kind: 'words', text: COPY.negotiable },
    deal: null,
  });
  expect(
    cardView(card({ priceType: 'installment', askingPriceToman: null, valuation: null }), NOW),
  ).toMatchObject({
    price: { kind: 'words', text: COPY.installment },
    deal: null,
  });
  expect(
    cardView(card({ priceType: 'placeholder', askingPriceToman: null, valuation: null }), NOW),
  ).toMatchObject({
    price: { kind: 'words', text: COPY.unknownPrice },
    deal: null,
  });
});

test('a listing only seen in a list has no details and says where to read them', () => {
  const thin = thinListingCardFixture();
  const view = cardView(thin, NOW);
  expect(view.title).toBe('پژو ۲۰۶ تیپ ۵');
  expect(view.price).toEqual({ kind: 'words', text: COPY.unknownPrice });
  expect(view).toMatchObject({
    deal: null,
    facts: [],
    place: null,
    condition: [],
    seller: null,
    photo: null,
    hasDetails: false,
  });
});

test('a car with no kilometres says so, and the fuel is only named when it is not petrol', () => {
  expect(cardView(card({ mileageKm: 0 }), NOW).facts[0]).toBe(COPY.zeroKm);
  expect(cardView(card({ fuel: 'dual_fuel_factory' }), NOW).facts).toContain('دوگانه‌سوز شرکتی');
  expect(cardView(card({ fuel: 'petrol' }), NOW).facts).not.toContain('بنزینی');
});

test('the thumbnail is shown when there is one, the full-size address otherwise', () => {
  expect(
    cardView(
      card({ photo: { url: 'https://s100.divarcdn.com/full.webp', thumbnailUrl: null, count: 1 } }),
      NOW,
    ).photo?.src,
  ).toBe('https://s100.divarcdn.com/full.webp');
});

test('the gap names its direction in words and treats a few tenths as the market value', () => {
  expect(gapSentence(-8.4)).toBe(`${formatPercent(0.08)} ${COPY.belowMarket}`);
  expect(gapSentence(12)).toBe(`${formatPercent(0.12)} ${COPY.aboveMarket}`);
  expect(gapSentence(-0.4)).toBe(COPY.atMarket);
  expect(gapSentence(0.3)).toBe(COPY.atMarket);
});

test('days on market count Tehran days, not hours', () => {
  // 20:00 UTC is 23:30 in Tehran on the 1st; 10:00 UTC on the 2nd is 13:30 on the 2nd: one day later by the calendar.
  expect(daysOnMarket('2026-10-01T20:00:00Z', '2026-10-02T10:00:00Z')).toBe(1);
  expect(daysOnMarket('2026-10-02T04:00:00Z', '2026-10-02T10:00:00Z')).toBe(0);
  expect(daysOnMarket('2026-09-29T07:49:00Z', NOW)).toBe(3);
  expect(daysOnMarket('2026-10-05T07:49:00Z', NOW)).toBe(0);
  expect(cardView(card({ listedAt: '2026-10-02T04:00:00Z' }), NOW).days).toBe(COPY.today);
  expect(cardView(card(), NOW).days).toBe(COPY.daysOnMarket(3));
});

test('the condition summary prefers a stated problem to a stated virtue and shows at most three phrases', () => {
  const clean = conditionOf(card());
  expect(clean).toEqual([
    { text: 'بدون رنگ', tone: 'good' },
    { text: 'شاسی سالم و پلمپ', tone: 'good' },
    { text: COPY.soundBoth, tone: 'good' },
  ]);
  const accident = conditionOf(
    card({
      condition: {
        body: 'intact',
        engine: 'needs_repair',
        gearbox: 'sound',
        chassis: 'damaged',
        paintFree: true,
        accident: 'had_accident',
      },
    }),
  );
  expect(accident).toEqual([
    { text: 'تصادفی', tone: 'warning' },
    { text: 'شاسی آسیب‌دیده', tone: 'warning' },
    { text: 'موتور نیازمند تعمیر', tone: 'warning' },
  ]);
});

test('paint the text found shows the seller’s own word for it, and silence shows nothing', () => {
  expect(
    conditionOf(
      card({
        condition: {
          body: 'repainted_around',
          engine: null,
          gearbox: null,
          chassis: null,
          paintFree: false,
          accident: null,
        },
      }),
    ),
  ).toEqual([{ text: 'دوررنگ', tone: 'warning' }]);
  expect(
    conditionOf(
      card({
        condition: {
          body: null,
          engine: null,
          gearbox: null,
          chassis: null,
          paintFree: false,
          accident: null,
        },
      }),
    ),
  ).toEqual([{ text: COPY.paintedSomewhere, tone: 'warning' }]);
  expect(
    conditionOf(
      card({
        condition: {
          body: null,
          engine: null,
          gearbox: null,
          chassis: null,
          paintFree: null,
          accident: null,
        },
      }),
    ),
  ).toEqual([]);
});

test('a listing with a market value and no rating keeps the value and says why it is not rated', () => {
  const view = cardView(
    card({
      valuation: {
        marketValueToman: 1_223_000_000,
        priceGapPct: -66,
        dealRating: null,
        valuedOn: '2026-10-01',
      },
    }),
    NOW,
  );
  expect(view.deal?.rating).toBe('none');
  expect(view.deal?.label).toBe(COPY.unrated);
  expect(view.deal?.gap).toBeNull();
  expect(view.deal?.marketValue).toContain('ارزش بازار');
  expect(view.deal?.reason).toBe(COPY.unratedWithValue);
});
