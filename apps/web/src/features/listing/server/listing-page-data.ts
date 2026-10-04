import 'server-only';
import { cache } from 'react';
import { isAssumedMileage } from '@carshenas/search/mileage-reading';
import type { Search } from '@carshenas/search/search';
import type {
  AdjustmentTerm,
  Comparable,
  FactEvidence,
  ListingFacts,
  ListingPageData,
  ListingPageResult,
  NoRatingReason,
  PhotoAddress,
  PriceEvent,
  SimilarListing,
  ValuationFacts,
} from '@/features/listing/listing-types';
import { searchListings } from '@/features/search/server/search-queries';
import { readDatabase } from '@/server/db/database';
import { currentClientAddress } from '@/server/auth/request-address';
import { databaseNow, isoDateText, nameOf, pasteRateListing } from '@/server/db/sql-helpers';
import { takeToken } from '@/server/token-bucket';
import { ttlCache } from '@/server/ttl-cache';

// The listing page's data, in one place (CS-64): `readListingPage(id)` is everything /listings/[id] shows about one
// listing, as the plain DTO of listing-types.ts, and the one function that the pages building on it call (a pasted
// link's result, CS-65; the model page's cheapest listings, CS-67). It reads in two steps, each in parallel: the listing
// with its catalogue names, source and city, together with the latest succeeded valuation run; then, for that listing
// and run, its photos, valuation (with the model's segment and the fitted coefficients that explain it), comparables,
// price history and the facts its text states (through listing_fact_evidence, the only window onto extraction text).
// A listing that has left the market also gets the nearest listings still on it. Every query is a primary-key or
// index range on one listing (plans in docs/evidence/listing-page/); nothing is cached, because the page says how long
// ago it was checked, and nothing here reads a cookie.
//
// A listing that does not exist, and one Carshenas took down (`removed`), is `{ status: 'missing' }`: the page answers
// a real 404 for it. The listing page's own data is read through the web role: it can read only what the migration
// 20261002195527 granted and the view 20261002195528 shows.

/** The terms of the fitted model that adjust a car's value for what it is, which the explanation sizes. */
const ADJUSTMENT_TERMS = [
  'mileage_deviation',
  'zero_km',
  'body_minor',
  'body_painted',
  'body_painted_around',
  'chassis_repainted',
  'gearbox_automatic',
  'dual_fuel_aftermarket',
  'electrified',
  'off_colour',
] as const satisfies readonly AdjustmentTerm[];

/** How many similar listings a page that left the market offers. */
const SIMILAR_COUNT = 6;
/** Their model years differ from the listing's by at most this, and their price by at most this share of its own. */
const SIMILAR_YEARS = 2;
const SIMILAR_PRICE_SHARE = 0.3;

function named(key: string | null, name: string | null): { key: string; name: string } | null {
  return key === null || name === null ? null : { key, name };
}

async function readListing(id: number) {
  const database = readDatabase();
  return database
    .selectFrom('listing as l')
    .innerJoin('source as s', 's.id', 'l.source_id')
    .leftJoin('make as mk', 'mk.id', 'l.make_id')
    .leftJoin('model as m', 'm.id', 'l.model_id')
    .leftJoin('trim as t', 't.id', 'l.trim_id')
    .leftJoin('city as c', 'c.id', 'l.city_id')
    .leftJoin('colour as co', 'co.code', 'l.colour')
    .leftJoin('model_spec as ts', (join) =>
      join.onRef('ts.model_id', '=', 'l.model_id').onRef('ts.trim_id', '=', 'l.trim_id'),
    )
    .leftJoin('model_spec as ms', (join) =>
      join.onRef('ms.model_id', '=', 'l.model_id').on('ms.trim_id', 'is', null),
    )
    .leftJoin('model_spec_agreed as ma', 'ma.model_id', 'l.model_id')
    .select([
      'l.engine_volume_cc as own_volume',
      'ts.engine_volume_cc as trim_volume',
      'ma.engine_volume_cc as model_volume',
      'ts.car_origin as trim_origin',
      'ms.car_origin as model_origin',
      'l.id',
      'l.title',
      'l.url',
      'l.source_id',
      's.name_fa as source_name',
      'l.status',
      'l.listed_at',
      'l.last_seen_at',
      'l.last_checked_at',
      'l.delisted_at',
      'l.model_year_sh',
      'l.model_year_ad',
      'l.mileage_km',
      'l.mileage_reading',
      'l.mileage_written_km',
      'l.fuel',
      'l.gearbox',
      'l.colour',
      'co.family as colour_family',
      'c.name_fa as city_name',
      'l.district_fa',
      'l.seller_type',
      'l.insurance_months_left',
      'l.price_type',
      'l.asking_price_toman',
      'l.down_payment_toman',
      'l.accepts_installments',
      'l.accepts_swap',
      'l.body_condition',
      'l.engine_condition',
      'l.gearbox_condition',
      'l.front_chassis_condition',
      'l.rear_chassis_condition',
      'l.model_id',
      'mk.slug as make_slug',
      nameOf('mk').as('make_name'),
      'm.slug as model_slug',
      nameOf('m').as('model_name'),
      't.slug as trim_slug',
      nameOf('t').as('trim_name'),
      databaseNow().as('now'),
    ])
    .where('l.id', '=', id)
    .executeTakeFirst();
}

type ListingRow = NonNullable<Awaited<ReturnType<typeof readListing>>>;

/** The volume the listing is given and where it comes from: its own title, else its trim's row, else its model's. */
function engineVolumeOf(row: ListingRow): ListingFacts['engineVolume'] {
  if (row.own_volume !== null) return { cc: row.own_volume, from: 'listing' };
  if (row.trim_volume !== null) return { cc: row.trim_volume, from: 'trim' };
  if (row.model_volume !== null) return { cc: row.model_volume, from: 'model' };
  return null;
}

function factsOf(row: ListingRow): ListingFacts {
  const make = named(row.make_slug, row.make_name);
  const model =
    row.make_slug === null || row.model_slug === null
      ? null
      : named(`${row.make_slug}.${row.model_slug}`, row.model_name);
  const trim =
    row.make_slug === null || row.model_slug === null || row.trim_slug === null
      ? null
      : named(`${row.make_slug}.${row.model_slug}.${row.trim_slug}`, row.trim_name);
  return {
    id: row.id,
    title: row.title,
    name: row.trim_name ?? row.model_name ?? row.make_name ?? row.title ?? '',
    make,
    model,
    trim,
    url: row.url ?? '',
    source: { key: row.source_id, name: row.source_name },
    status: row.status,
    listedAt: row.listed_at.toISOString(),
    lastSeenAt: (row.last_seen_at ?? row.listed_at).toISOString(),
    lastCheckedAt: row.last_checked_at?.toISOString() ?? null,
    delistedAt: row.delisted_at?.toISOString() ?? null,
    modelYearSh: row.model_year_sh,
    modelYearAd: row.model_year_ad,
    mileageKm: row.mileage_km,
    mileageReading: row.mileage_reading,
    mileageWrittenKm: row.mileage_written_km,
    fuel: row.fuel,
    gearbox: row.gearbox,
    engineVolume: engineVolumeOf(row),
    carOrigin: row.trim_origin ?? row.model_origin,
    colour: row.colour,
    colourFamily: row.colour_family,
    city: row.city_name,
    district: row.district_fa,
    sellerType: row.seller_type,
    insuranceMonthsLeft: row.insurance_months_left,
    priceType: row.price_type,
    askingPriceToman: row.asking_price_toman,
    downPaymentToman: row.down_payment_toman,
    acceptsInstallments: row.accepts_installments,
    acceptsSwap: row.accepts_swap,
    declared: {
      body: row.body_condition,
      engine: row.engine_condition,
      gearbox: row.gearbox_condition,
      frontChassis: row.front_chassis_condition,
      rearChassis: row.rear_chassis_condition,
    },
  };
}

/** The latest succeeded valuation run: the one every page shows ratings from. */
async function readLatestRun() {
  return readDatabase()
    .selectFrom('valuation_run')
    .select([
      'id',
      isoDateText('as_of_date').as('as_of'),
      'method_version',
      'reference_year_sh',
      'mileage_norm_km_per_year',
      'window_days',
    ])
    .where('status', '=', 'succeeded')
    .orderBy('as_of_date', 'desc')
    .orderBy('id', 'desc')
    .limit(1)
    .executeTakeFirst();
}

type RunRow = NonNullable<Awaited<ReturnType<typeof readLatestRun>>>;

// The rating computed on the spot costs about 70 ms of SQL and is public input (any listing id, in a loop), so it is kept
// for five minutes per listing in this process's memory (the same for everyone), and a client address may start at most ten
// of them at once and one more every six seconds (ADR-0034; per process). Past that the page simply shows no analysis, as
// it did before the function existed.
const SPOT_RATINGS = ttlCache<number, Awaited<ReturnType<typeof rateOnTheSpot>> | null>(5 * 60_000, 2000);
const SPOT_RULE = { capacity: 10, perSecond: 1 / 6 } as const;

async function rateOnTheSpot(listingId: number) {
  const rated = await readDatabase().selectFrom(pasteRateListing(listingId)).selectAll().executeTakeFirst();
  return rated === undefined
    ? undefined
    : { ...rated, no_rating_reason: rated.no_rating_reason as NoRatingReason | null };
}

/**
 * The listing's stored verdict on the run; for a listing the run did not rate (crawled after it, or a link pasted before
 * it was crawled) the same verdict computed on the run's stored numbers by the database function paste_rate_listing (CS-65),
 * which rates it by the SQL the run itself used. A listing the function does not value has none.
 */
async function readVerdict(run: RunRow, listing: ListingRow) {
  const stored = await readDatabase()
    .selectFrom('listing_valuation')
    .select(['asking_price_toman', 'market_value_toman', 'price_gap_pct', 'deal_rating', 'no_rating_reason'])
    .where('valuation_run_id', '=', run.id)
    .where('listing_id', '=', listing.id)
    .executeTakeFirst();
  if (stored !== undefined || listing.status !== 'active') return stored;
  const cached = SPOT_RATINGS.get(listing.id);
  if (cached !== undefined) return cached ?? undefined;
  if (!takeToken('spot-rating', await currentClientAddress(), SPOT_RULE)) return undefined;
  const rated = await rateOnTheSpot(listing.id);
  SPOT_RATINGS.set(listing.id, rated ?? null);
  return rated;
}

async function readValuation(run: RunRow, listing: ListingRow): Promise<ValuationFacts | null> {
  const database = readDatabase();
  const modelId = listing.model_id;
  const [verdict, segment, coefficients] = await Promise.all([
    readVerdict(run, listing),
    modelId === null
      ? undefined
      : database
          .selectFrom('valuation_segment')
          .select([
            'comparable_count',
            'min_model_year_sh',
            'max_model_year_sh',
            'error_pct',
            'rates_listings',
          ])
          .where('valuation_run_id', '=', run.id)
          .where('model_id', '=', modelId)
          .executeTakeFirst(),
    database
      .selectFrom('valuation_coefficient')
      .select(['term', 'model_id', 'coefficient'])
      .where('valuation_run_id', '=', run.id)
      .where('trim_id', 'is', null)
      .where((eb) =>
        eb.or([
          eb.and([eb('model_id', 'is', null), eb('term', 'in', [...ADJUSTMENT_TERMS])]),
          modelId === null
            ? eb.val(false)
            : eb.and([eb('model_id', '=', modelId), eb('term', '=', 'model_age_slope')]),
        ]),
      )
      .execute(),
  ]);
  const marketValue = verdict?.market_value_toman ?? null;
  if (verdict === undefined || marketValue === null) return null;
  const terms: Partial<Record<AdjustmentTerm, number>> = {};
  let ageSlope: number | null = null;
  for (const row of coefficients) {
    if (row.term === 'model_age_slope') ageSlope = row.coefficient;
    else terms[row.term as AdjustmentTerm] = row.coefficient;
  }
  return {
    run: {
      asOfDate: run.as_of,
      methodVersion: run.method_version,
      referenceYearSh: run.reference_year_sh,
      mileageNormKmPerYear: run.mileage_norm_km_per_year,
      windowDays: run.window_days,
    },
    marketValueToman: marketValue,
    ratedPriceToman: verdict.asking_price_toman,
    priceGapPct: verdict.price_gap_pct === null ? null : Number(verdict.price_gap_pct),
    dealRating: verdict.deal_rating,
    noRatingReason: verdict.no_rating_reason,
    segment:
      segment === undefined
        ? null
        : {
            comparableCount: segment.comparable_count,
            minModelYearSh: segment.min_model_year_sh,
            maxModelYearSh: segment.max_model_year_sh,
            errorPct: segment.error_pct === null ? null : Number(segment.error_pct),
            ratesListings: segment.rates_listings,
          },
    coefficients: terms,
    modelAgeSlope: ageSlope,
  };
}

async function readComparables(runId: number, listingId: number): Promise<Comparable[]> {
  const rows = await readDatabase()
    .selectFrom('listing_valuation_comparable as c')
    .innerJoin('listing as l', 'l.id', 'c.comparable_listing_id')
    .leftJoin('model as m', 'm.id', 'l.model_id')
    .leftJoin('trim as t', 't.id', 'l.trim_id')
    .leftJoin('listing_photo as p', (join) =>
      join.onRef('p.listing_id', '=', 'l.id').on('p.position', '=', 1),
    )
    .select([
      'c.position',
      'c.comparable_listing_id',
      'c.asking_price_toman',
      'c.adjusted_price_toman',
      'l.title',
      'l.model_year_sh',
      'l.mileage_km',
      'l.mileage_reading',
      'l.status',
      'p.url as photo_url',
      'p.thumbnail_url as photo_thumbnail_url',
      nameOf('t').as('trim_name'),
      nameOf('m').as('model_name'),
    ])
    .where('c.valuation_run_id', '=', runId)
    .where('c.listing_id', '=', listingId)
    .orderBy('c.position')
    .execute();
  return rows.map((row) => ({
    position: row.position,
    listingId: row.comparable_listing_id,
    name: row.trim_name ?? row.model_name ?? row.title ?? '',
    modelYearSh: row.model_year_sh,
    mileageKm: row.mileage_km,
    mileageAssumed: isAssumedMileage(row.mileage_reading),
    status: row.status,
    photoUrl: row.photo_thumbnail_url ?? row.photo_url,
    askingPriceToman: row.asking_price_toman,
    adjustedPriceToman: row.adjusted_price_toman,
  }));
}

async function readPhotos(listingId: number): Promise<PhotoAddress[]> {
  const rows = await readDatabase()
    .selectFrom('listing_photo')
    .select(['url', 'thumbnail_url'])
    .where('listing_id', '=', listingId)
    .orderBy('position')
    .execute();
  return rows.map((row) => ({ url: row.url, thumbnailUrl: row.thumbnail_url }));
}

async function readPriceHistory(listingId: number): Promise<PriceEvent[]> {
  const rows = await readDatabase()
    .selectFrom('listing_price_event')
    .select([
      'observed_at',
      'price_type',
      'asking_price_toman',
      'previous_price_type',
      'previous_price_toman',
    ])
    .where('listing_id', '=', listingId)
    .orderBy('observed_at')
    .execute();
  return rows.map((row) => ({
    observedAt: row.observed_at.toISOString(),
    priceType: row.price_type,
    askingPriceToman: row.asking_price_toman,
    previousPriceType: row.previous_price_type,
    previousPriceToman: row.previous_price_toman,
  }));
}

async function readEvidence(listingId: number): Promise<FactEvidence[]> {
  const rows = await readDatabase()
    .selectFrom('listing_fact_evidence')
    .select(['field', 'value', 'evidence'])
    .where('listing_id', '=', listingId)
    .execute();
  return rows.flatMap((row) =>
    row.field === null || row.value === null
      ? []
      : [{ field: row.field, value: row.value, evidence: row.evidence }],
  );
}

/** The nearest listings still on the market: the same model, a close year and a close price, best deals first. */
async function readSimilar(listing: ListingFacts): Promise<SimilarListing[]> {
  if (listing.model === null) return [];
  const filters: Search['filters'] = { model: [listing.model.key] };
  if (listing.modelYearSh !== null) {
    filters.year = { min: listing.modelYearSh - SIMILAR_YEARS, max: listing.modelYearSh + SIMILAR_YEARS };
  }
  if (listing.askingPriceToman !== null) {
    filters.price = {
      min: Math.round(listing.askingPriceToman * (1 - SIMILAR_PRICE_SHARE)),
      max: Math.round(listing.askingPriceToman * (1 + SIMILAR_PRICE_SHARE)),
    };
  }
  const result = await searchListings({ search: { filters }, limit: SIMILAR_COUNT });
  if (result.status !== 'ok') return [];
  return result.page.results
    .filter((card) => card.id !== listing.id)
    .map((card) => ({
      id: card.id,
      name: card.name,
      modelYearSh: card.modelYearSh,
      mileageKm: card.mileageKm,
      mileageAssumed: isAssumedMileage(card.mileageReading),
      askingPriceToman: card.askingPriceToman,
      dealRating: card.valuation?.dealRating ?? null,
      priceGapPct: card.valuation?.priceGapPct ?? null,
      photoUrl: card.photo?.thumbnailUrl ?? card.photo?.url ?? null,
    }));
}

/**
 * Everything the listing page shows about one listing. `{ status: 'missing' }` for an id that is no listing here or was
 * taken down; a database failure throws (the page's error screen, with its reference code). Deduplicated within one
 * request, so the page and its metadata read once.
 */
export const readListingPage = cache(async (id: number): Promise<ListingPageResult> => {
  const [row, run] = await Promise.all([readListing(id), readLatestRun()]);
  if (row === undefined || row.status === 'removed') return { status: 'missing' };
  const listing = factsOf(row);
  const [photos, valuation, comparables, priceHistory, evidence] = await Promise.all([
    readPhotos(id),
    run === undefined ? null : readValuation(run, row),
    run === undefined ? [] : readComparables(run.id, id),
    readPriceHistory(id),
    readEvidence(id),
  ]);
  const similar = listing.status === 'active' ? [] : await readSimilar(listing);
  const page: ListingPageData = {
    now: row.now.toISOString(),
    listing,
    photos,
    valuation,
    comparables: valuation === null ? [] : comparables,
    priceHistory,
    evidence,
    similar,
  };
  return { status: 'found', page };
});
