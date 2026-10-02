import type { ListingCard } from '@/features/search/search-types';

// A result as the search API returns it, for the unit and component tests of this feature: a listing with everything
// the card can show, and the overrides each test needs. Tests of the page itself seed the database instead.

export function listingCardFixture(overrides: Partial<ListingCard> = {}): ListingCard {
  return {
    id: 1,
    title: 'پژو ۲۰۶ تیپ ۵ سالم',
    name: 'پژو 206 تیپ ۵',
    url: 'https://divar.ir/v/abc',
    source: { key: 'divar', name: 'دیوار' },
    make: { key: 'peugeot', name: 'پژو' },
    model: { key: 'peugeot.206', name: 'پژو ۲۰۶' },
    trim: { key: 'peugeot.206.5', name: 'پژو 206 تیپ ۵' },
    bodyType: { key: 'hatchback', name: 'هاچ‌بک' },
    modelYearSh: 1395,
    modelYearAd: 2016,
    mileageKm: 270_000,
    kmPerYear: 24_000,
    priceType: 'asking',
    askingPriceToman: 960_000_000,
    valuation: {
      marketValueToman: 1_223_000_000,
      priceGapPct: -21.49,
      dealRating: 'great',
      valuedOn: '2026-10-01',
    },
    gearbox: 'manual',
    fuel: 'petrol',
    colourFamily: 'white',
    city: { key: 'tehran', name: 'تهران' },
    district: 'خانی آباد نو',
    sellerType: 'private',
    condition: {
      body: 'minor_scratches',
      engine: 'sound',
      gearbox: 'sound',
      chassis: 'intact',
      paintFree: true,
      accident: null,
    },
    listedAt: '2026-09-29T07:49:00.000Z',
    lastSeenAt: '2026-10-02T14:36:11.126Z',
    photo: {
      url: 'https://s100.divarcdn.com/static/photo/neda/webp_post/a/b.webp',
      thumbnailUrl: 'https://s100.divarcdn.com/static/photo/neda/webp_thumbnail/a/b.webp',
      count: 11,
    },
    ...overrides,
  };
}

/** A listing that was only seen in a list: the catalogue knows the car, and nothing else is known. */
export function thinListingCardFixture(overrides: Partial<ListingCard> = {}): ListingCard {
  return listingCardFixture({
    title: null,
    modelYearSh: null,
    modelYearAd: null,
    mileageKm: null,
    kmPerYear: null,
    priceType: null,
    askingPriceToman: null,
    valuation: null,
    gearbox: null,
    fuel: null,
    colourFamily: null,
    city: null,
    district: null,
    sellerType: null,
    condition: { body: null, engine: null, gearbox: null, chassis: null, paintFree: null, accident: null },
    photo: null,
    ...overrides,
  });
}
