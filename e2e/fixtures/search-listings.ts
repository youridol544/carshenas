import { randomInt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import pg from 'pg';

// The search page's data for its browser tests (CS-61): thirty listings of one catalogue model, written as the
// migration role straight into the listing table and into search_document (the table the page reads), so a test sees
// exactly the cards it expects whatever else the index holds, and removes them when it ends. They carry a word of their
// own, so `/search?q=<token>` shows only them; their prices step by a million tomans, their deal gaps by two percent
// of market value, so every order and every filter has a known answer. The catalogue rows are the real ones
// (Peugeot 206 and Tehran, from the catalogue sync): a fresh database without them makes the seed say so.
//
// Photos point at the source's photo host with addresses no one has; the fixture in test.ts answers them with a drawn
// stand-in, so a test never reaches a listing site. The worker's search.refresh would rebuild these rows from the
// listing table (and drop them, having no valuation), so the tests assume no worker is running against this database.

const REPOSITORY_SETTINGS = fileURLToPath(new URL('../../.env', import.meta.url));

function migrateUrl(): string {
  const fromEnvironment = process.env.DATABASE_MIGRATE_URL;
  if (fromEnvironment !== undefined && fromEnvironment !== '') return fromEnvironment;
  const url = parseEnv(readFileSync(REPOSITORY_SETTINGS, 'utf8')).DATABASE_MIGRATE_URL;
  if (url === undefined || url === '') {
    throw new Error('DATABASE_MIGRATE_URL is not set: the search page tests need the database the app uses.');
  }
  return url;
}

export type DealRating = 'great' | 'good' | 'fair' | 'high' | 'overpriced';
export type SeedKind = 'rated' | 'unrated' | 'negotiable' | 'installment';

export type SeededListing = {
  readonly index: number;
  readonly key: string;
  readonly kind: SeedKind;
  readonly priceToman: number | null;
  readonly rating: DealRating | null;
  readonly gapPct: number | null;
  readonly photos: number;
  readonly paintFree: boolean | null;
  readonly modelYear: number;
  readonly mileageKm: number;
};

export type SearchSeed = {
  /** A word only these listings contain: `?q=<token>` isolates them. */
  readonly token: string;
  readonly listings: readonly SeededListing[];
  /** The lowest and highest asking price of the seeded listings that have one. */
  readonly priceBand: { readonly min: number; readonly max: number };
};

export const SEEDED_COUNT = 30;
const FIRST_PRICE = 611_000_000;
const PRICE_STEP = 1_000_000;

function ratingFor(gapPct: number): DealRating {
  if (gapPct <= -10) return 'great';
  if (gapPct <= -4) return 'good';
  if (gapPct < 4) return 'fair';
  if (gapPct < 10) return 'high';
  return 'overpriced';
}

/** Which kind each of the thirty is: a few without a rating or a price, so every state of a card appears. */
function plan(token: string): SeededListing[] {
  return Array.from({ length: SEEDED_COUNT }, (_, index): SeededListing => {
    const kind: SeedKind =
      index === 26 ? 'installment' : index % 10 === 7 ? 'negotiable' : index % 7 === 6 ? 'unrated' : 'rated';
    const priced = kind === 'rated' || kind === 'unrated';
    const gapPct = kind === 'rated' ? Math.round((-30 + 2 * index) * 100) / 100 : null;
    return {
      index,
      key: `e2e-${token}-${String(index)}`,
      kind,
      priceToman: priced ? FIRST_PRICE + index * PRICE_STEP : null,
      rating: gapPct === null ? null : ratingFor(gapPct),
      gapPct,
      photos: index % 3 === 0 ? 0 : 1 + (index % 5),
      paintFree: index % 2 === 0 ? true : index % 4 === 1 ? false : null,
      modelYear: 1390 + (index % 14),
      mileageKm: 10_000 * (index + 1),
    };
  });
}

function randomToken(): string {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  return 'qzx' + Array.from({ length: 7 }, () => letters.charAt(randomInt(letters.length))).join('');
}

type Catalogue = { makeId: number; modelId: number; trimIds: number[]; cityId: number };

async function readCatalogue(client: pg.Client): Promise<Catalogue> {
  const trims = await client.query<{ make_id: number; model_id: number; trim_id: number }>(
    `SELECT mk.id AS make_id, m.id AS model_id, t.id AS trim_id
     FROM make mk JOIN model m ON m.make_id = mk.id JOIN "trim" t ON t.model_id = m.id
     WHERE mk.slug = 'peugeot' AND m.slug = '206' ORDER BY t.id LIMIT 2`,
  );
  const city = await client.query<{ id: number }>(`SELECT id FROM city WHERE slug = 'tehran'`);
  const [first] = trims.rows;
  const [tehran] = city.rows;
  if (first === undefined || tehran === undefined || trims.rows.length < 2) {
    throw new Error(
      'The search page tests need the catalogue (Peugeot 206 with two trims, and Tehran): run pnpm catalogue:sync.',
    );
  }
  return {
    makeId: first.make_id,
    modelId: first.model_id,
    trimIds: trims.rows.map((row) => row.trim_id),
    cityId: tehran.id,
  };
}

const DISTRICTS = ['سعادت آباد', 'صادقیه'] as const;
const COLOURS = ['white', 'silver', 'black', 'blue', 'red', 'grey'] as const;

export async function seedSearchListings(): Promise<SearchSeed> {
  const token = randomToken();
  const listings = plan(token);
  const client = new pg.Client({ connectionString: migrateUrl(), application_name: 'carshenas-e2e' });
  await client.connect();
  try {
    const catalogue = await readCatalogue(client);
    await client.query('BEGIN');
    for (const listing of listings) {
      const { index } = listing;
      const trimId = catalogue.trimIds[index % catalogue.trimIds.length] ?? catalogue.trimIds[0];
      const gearbox = index % 5 === 0 ? 'automatic' : 'manual';
      const seller = index % 3 === 0 ? 'dealer' : 'private';
      const district = DISTRICTS[index % DISTRICTS.length];
      const colour = COLOURS[index % COLOURS.length];
      const priceType = listing.kind === 'rated' || listing.kind === 'unrated' ? 'asking' : listing.kind;
      const accident = index % 9 === 5 ? 'had_accident' : null;
      const bodyCondition = listing.paintFree === true ? 'intact' : null;
      const chassis = index % 3 === 0 ? 'intact' : null;
      const sound = index % 4 === 0 ? 'sound' : null;
      const marketValue =
        listing.priceToman === null || listing.gapPct === null
          ? null
          : Math.round(listing.priceToman / (1 + listing.gapPct / 100));
      const inserted = await client.query<{ id: number }>(
        `INSERT INTO listing (source_id, source_listing_key, url, origin, status, listed_at, last_seen_at, title,
                              model_year_written, model_year_sh, mileage_km, fuel, gearbox, price_type,
                              asking_price_toman, down_payment_toman, seller_type, body_condition, engine_condition,
                              gearbox_condition, front_chassis_condition, rear_chassis_condition, colour, make_id,
                              model_id, trim_id, catalogue_match, city_id, district_fa)
         VALUES ('divar', $1, $2, 'external', 'active', now() - make_interval(days => $3), now(), $4,
                 'sh', $5, $6, 'petrol', $7, $8, $9, $10, $11, $12, $13, $14, $15, $15, NULL, $16, $17, $18, 'trim',
                 $19, $20)
         RETURNING id`,
        [
          listing.key,
          `https://test.example/post/${listing.key}`,
          (index % 9) + 1,
          `${token} پژو ۲۰۶ ${String(index)}`,
          listing.modelYear,
          listing.mileageKm,
          gearbox,
          priceType,
          priceType === 'asking' ? listing.priceToman : null,
          priceType === 'installment' ? 200_000_000 : null,
          seller,
          bodyCondition,
          sound,
          sound,
          chassis,
          catalogue.makeId,
          catalogue.modelId,
          trimId,
          catalogue.cityId,
          district,
        ],
      );
      const listingId = inserted.rows[0]?.id;
      if (listingId === undefined) throw new Error('the seeded listing has no id');
      const cover =
        listing.photos === 0
          ? null
          : `https://s100.divarcdn.com/static/photo/e2e/${token}-${String(index)}.webp`;
      const thumbnail =
        listing.photos === 0
          ? null
          : `https://s100.divarcdn.com/static/photo/e2e/thumb-${token}-${String(index)}.webp`;
      await client.query(
        `INSERT INTO search_document (
           listing_id, source_id, listed_at, last_seen_at, make_id, model_id, trim_id, make_key, model_key, trim_key,
           body_type, model_year_sh, mileage_km, km_per_year, price_type, asking_price_toman, market_value_toman,
           price_gap_pct, deal_rating, valued_on, gearbox, fuel, colour_family, city_id, city_key, district_fa,
           district_key, seller_type, body_condition, engine_condition, gearbox_condition, chassis_condition,
           paint_free, accident, has_photo, photo_count, cover_photo_url, cover_thumbnail_url, model_rank,
           search_text, refreshed_at)
         SELECT l.id, l.source_id, l.listed_at, l.last_seen_at, l.make_id, l.model_id, l.trim_id, mk.slug,
                mk.slug || '.' || m.slug, mk.slug || '.' || m.slug || '.' || t.slug, m.body_type, l.model_year_sh,
                l.mileage_km, round(l.mileage_km / greatest(1405 - l.model_year_sh, 0.5))::integer, l.price_type,
                l.asking_price_toman, $2::bigint, $3::numeric, $4::deal_rating, CASE WHEN $2::bigint IS NULL THEN NULL
                ELSE current_date END, l.gearbox, l.fuel, $5::text, l.city_id, c.slug, l.district_fa,
                c.slug || '.' || l.district_fa, l.seller_type, l.body_condition, l.engine_condition,
                l.gearbox_condition, CASE WHEN l.front_chassis_condition = 'intact' THEN 'intact' END, $6::boolean,
                $7::text, $8::boolean, $9::integer, $10::text, $11::text, 1,
                concat_ws(' ', $12::text, l.title, mk.name_fa, mk.name_en, m.name_fa, t.name_fa, c.name_fa), now()
         FROM listing l
         JOIN make mk ON mk.id = l.make_id JOIN model m ON m.id = l.model_id JOIN "trim" t ON t.id = l.trim_id
         JOIN city c ON c.id = l.city_id
         WHERE l.id = $1`,
        [
          listingId,
          marketValue,
          listing.gapPct,
          listing.rating,
          colour,
          listing.paintFree,
          accident,
          listing.photos > 0,
          listing.photos,
          cover,
          thumbnail,
          token,
        ],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
  const prices = listings.flatMap((listing) => (listing.priceToman === null ? [] : [listing.priceToman]));
  return { token, listings, priceBand: { min: Math.min(...prices), max: Math.max(...prices) } };
}

/** Removes the seeded listings; their search rows go with them (the foreign key cascades). */
export async function removeSearchListings(seed: SearchSeed): Promise<void> {
  const client = new pg.Client({ connectionString: migrateUrl(), application_name: 'carshenas-e2e' });
  await client.connect();
  try {
    await client.query(`DELETE FROM listing WHERE source_id = 'divar' AND source_listing_key LIKE $1`, [
      `e2e-${seed.token}-%`,
    ]);
  } finally {
    await client.end();
  }
}
