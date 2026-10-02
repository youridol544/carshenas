import type {
  Comparable,
  ListingFacts,
  ListingPageData,
  ValuationFacts,
} from '@/features/listing/listing-types';

// A listing page's data for the unit tests of this feature (and the component tests): a rated listing with everything the
// page can show, and overrides for each test. The page's own browser tests seed the database instead.

export function listingFactsFixture(overrides: Partial<ListingFacts> = {}): ListingFacts {
  return {
    id: 4321,
    title: 'پژو ۲۰۶ تیپ ۵ سالم',
    name: 'پژو 206 تیپ ۵',
    make: { key: 'peugeot', name: 'پژو' },
    model: { key: 'peugeot.206', name: 'پژو ۲۰۶' },
    trim: { key: 'peugeot.206.5', name: 'پژو 206 تیپ ۵' },
    url: 'https://divar.ir/v/abc',
    source: { key: 'divar', name: 'دیوار' },
    status: 'active',
    listedAt: '2026-09-29T07:49:00.000Z',
    lastSeenAt: '2026-10-02T14:36:11.126Z',
    lastCheckedAt: '2026-10-02T14:36:11.126Z',
    delistedAt: null,
    modelYearSh: 1395,
    modelYearAd: 2016,
    mileageKm: 160_000,
    fuel: 'petrol',
    gearbox: 'automatic',
    colour: 'سفید',
    colourFamily: 'white',
    city: 'تهران',
    district: 'خانی آباد نو',
    sellerType: 'private',
    insuranceMonthsLeft: 6,
    priceType: 'asking',
    askingPriceToman: 960_000_000,
    downPaymentToman: null,
    acceptsInstallments: false,
    acceptsSwap: false,
    declared: {
      body: 'minor_scratches',
      engine: 'sound',
      gearbox: 'sound',
      frontChassis: 'intact',
      rearChassis: 'intact',
    },
    ...overrides,
  };
}

export function valuationFactsFixture(overrides: Partial<ValuationFacts> = {}): ValuationFacts {
  return {
    run: {
      asOfDate: '2026-10-01',
      methodVersion: 1,
      referenceYearSh: 1405,
      mileageNormKmPerYear: 20_000,
      windowDays: 30,
    },
    marketValueToman: 1_223_000_000,
    ratedPriceToman: 960_000_000,
    priceGapPct: -21.49,
    dealRating: 'great',
    noRatingReason: null,
    segment: {
      comparableCount: 412,
      minModelYearSh: 1380,
      maxModelYearSh: 1404,
      errorPct: 6.72,
      ratesListings: true,
    },
    coefficients: {
      mileage_deviation: -0.08,
      body_minor: -0.02,
      gearbox_automatic: 0.095,
      off_colour: -0.05,
    },
    modelAgeSlope: -0.062,
    ...overrides,
  };
}

export function comparablesFixture(): Comparable[] {
  return [
    {
      position: 1,
      listingId: 11,
      name: 'پژو 206 تیپ ۵',
      modelYearSh: 1395,
      mileageKm: 150_000,
      status: 'active',
      askingPriceToman: 1_150_000_000,
      adjustedPriceToman: 1_160_000_000,
    },
    {
      position: 2,
      listingId: 12,
      name: 'پژو 206 تیپ ۲',
      modelYearSh: 1396,
      mileageKm: 90_000,
      status: 'sold',
      askingPriceToman: 1_300_000_000,
      adjustedPriceToman: 1_210_000_000,
    },
    {
      position: 3,
      listingId: 13,
      name: 'پژو 206 تیپ ۵',
      modelYearSh: 1394,
      mileageKm: 200_000,
      status: 'active',
      askingPriceToman: 1_050_000_000,
      adjustedPriceToman: 1_190_000_000,
    },
  ];
}

export function listingPageFixture(overrides: Partial<ListingPageData> = {}): ListingPageData {
  return {
    now: '2026-10-02T16:00:00.000Z',
    listing: listingFactsFixture(),
    photos: [
      {
        url: 'https://s100.divarcdn.com/static/photo/neda/a.webp',
        thumbnailUrl: 'https://s100.divarcdn.com/static/photo/neda/at.webp',
      },
    ],
    valuation: valuationFactsFixture(),
    comparables: comparablesFixture(),
    priceHistory: [],
    evidence: [],
    similar: [],
    ...overrides,
  };
}
