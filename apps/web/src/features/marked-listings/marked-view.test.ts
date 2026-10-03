import { describe, expect, test } from 'vitest';
import { formatPercent } from '@carshenas/locale/format-number';
import { formatToman, formatTomanInWords, toToman } from '@carshenas/locale/toman';
import { MARKED_COPY } from '@/features/marked-listings/marked-copy';
import {
  markedPage,
  priceChangeOf,
  readMarkedFilter,
  toMarkedListing,
  type MarkedRow,
} from '@/features/marked-listings/marked-view';

// What the marked page says about a listing (CS-69): the two prices side by side and how they compare, the status, the
// filters and their counts. The words come from the copy file, the numbers from the locale formatters.

const row: MarkedRow = {
  listingId: 7,
  markedAt: new Date('2026-10-01T09:00:00Z'),
  markedPriceToman: 850_000_000,
  status: 'active',
  delistedAt: null,
  name: 'پژو 206 تیپ 5',
  title: null,
  modelYearSh: 1399,
  mileageKm: 120_000,
  mileageReading: null,
  gearbox: 'manual',
  cityName: 'تهران',
  districtFa: null,
  priceType: 'asking',
  askingPriceToman: 810_000_000,
  dealRating: 'good',
  priceGapPct: -4,
  photoUrl: null,
};

describe('the price now against the price when marked', () => {
  test('a fall is said in words with its share, a rise as a rise, an unchanged price as unchanged', () => {
    expect(priceChangeOf(850_000_000, 810_000_000)).toEqual({
      kind: 'down',
      label: MARKED_COPY.change.down,
      detail: MARKED_COPY.change.detailDown(
        formatTomanInWords(toToman(40_000_000)),
        formatPercent(40_000_000 / 850_000_000),
      ),
    });
    expect(priceChangeOf(850_000_000, 900_000_000)?.kind).toBe('up');
    expect(priceChangeOf(850_000_000, 850_000_000)?.kind).toBe('same');
  });

  test('says nothing when either price is not a stated asking price', () => {
    expect(priceChangeOf(null, 810_000_000)).toBeNull();
    expect(priceChangeOf(850_000_000, null)).toBeNull();
  });
});

describe('one marked listing', () => {
  test('shows its price in full digits beside the price when marked, its rating and its facts', () => {
    const listing = toMarkedListing(row);
    expect(listing.href).toBe('/listings/7');
    expect(listing.title).toContain('پژو ۲۰۶ تیپ ۵');
    expect(listing.title).toContain('۱۳۹۹');
    expect(listing.price).toEqual({ kind: 'amount', text: formatToman(toToman(810_000_000)) });
    expect(listing.markedPrice).toBe(formatToman(toToman(850_000_000)));
    expect(listing.change?.kind).toBe('down');
    // An unchanged price is no news: no badge.
    expect(toMarkedListing({ ...row, askingPriceToman: 850_000_000 }).change).toBeNull();
    expect(listing.deal?.rating).toBe('good');
    expect(listing.statusLabel).toBeNull();
    expect(listing.place).toBe('تهران');
  });

  test('a listing off the market says what became of it, since when, and is not rated', () => {
    const listing = toMarkedListing({ ...row, status: 'sold', delistedAt: new Date('2026-10-02T00:00:00Z') });
    expect(listing.statusLabel).toBe(MARKED_COPY.status.sold);
    expect(listing.offSince).toMatch(/^از /);
    expect(listing.deal).toBeNull();
  });

  test('a negotiable listing has words where a price would be and no comparison', () => {
    const listing = toMarkedListing({
      ...row,
      priceType: 'negotiable',
      askingPriceToman: null,
      markedPriceToman: null,
    });
    expect(listing.price.kind).toBe('words');
    expect(listing.markedPrice).toBeNull();
    expect(listing.change).toBeNull();
    expect(listing.deal).toBeNull();
  });
});

describe('the filters', () => {
  const rows: MarkedRow[] = [
    row,
    { ...row, listingId: 8, askingPriceToman: 900_000_000 },
    { ...row, listingId: 9, status: 'expired', delistedAt: new Date('2026-10-02T00:00:00Z') },
  ];

  test('count and keep what they say: on the market, price fallen, off the market', () => {
    const all = markedPage(rows, 'all');
    expect(all.counts).toEqual({ all: 3, active: 2, dropped: 2, off: 1 });
    expect(all.total).toBe(3);
    expect(markedPage(rows, 'active').items.map((item) => item.id)).toEqual([7, 8]);
    expect(markedPage(rows, 'dropped').items.map((item) => item.id)).toEqual([7, 9]);
    expect(markedPage(rows, 'off').items.map((item) => item.id)).toEqual([9]);
  });

  test('read only the filters that exist from the address', () => {
    expect(readMarkedFilter('dropped')).toBe('dropped');
    expect(readMarkedFilter('everything')).toBe('all');
    expect(readMarkedFilter(['active'])).toBe('all');
    expect(readMarkedFilter(undefined)).toBe('all');
  });
});
