import { sql, type Kysely, type Transaction } from 'kysely';
import { constraintViolation } from '@carshenas/db/database-errors';
import type { DB, Json, Listing } from '@carshenas/db/db-types';
import { COLOURS } from '../catalogue/codes.ts';
import type { DerivedListing, UnparsedField } from '../sources/attributes.ts';
import { textPriceMeaningOf, type TextPriceMeaning } from './extraction-store.ts';
import { anyOf } from './listing-store.ts';

// What a parser derives from a listing's latest snapshot, written (CS-34; docs/design/data-model.md, "Added by CS-34"):
// the attribute columns on listing, its photo addresses (ADR-0025) and the values it could not read. Every write has a
// change guard, so a derivation that reads as the last one did writes nothing, and a listing's row is rewritten only
// when what it says changed. The caller holds the listing: the crawler derives in the transaction that stored the
// snapshot, and the derive command locks each batch of listings first. Both write through a savepoint, so a value the
// database refuses costs the derivation, never the snapshot.

/** The columns a structured parser owns, in the order they are compared. */
const ATTRIBUTE_COLUMNS = [
  'title',
  'source_model_key',
  'model_year_written',
  'model_year_sh',
  'model_year_ad',
  'mileage_km',
  'mileage_written_km',
  'mileage_reading',
  'mileage_wording',
  'mileage_ask_ratio',
  'fuel',
  'gearbox',
  'insurance_months_left',
  'price_type',
  'asking_price_toman',
  'down_payment_toman',
  'accepts_swap',
  'accepts_installments',
  'seller_type',
  'body_condition',
  'engine_condition',
  'gearbox_condition',
  'front_chassis_condition',
  'rear_chassis_condition',
  'colour',
  'city_id',
  'district_fa',
  'engine_volume_cc',
  'parser_version',
] as const satisfies readonly (keyof Listing)[];

type AttributeColumns = { readonly [K in (typeof ATTRIBUTE_COLUMNS)[number]]: Listing[K] };

/** What a listing's mileage columns hold now: the valuation run's reading in thousands is carried over (columnsOf). */
type StoredMileage = Pick<
  Listing,
  'mileage_km' | 'mileage_written_km' | 'mileage_reading' | 'mileage_ask_ratio'
>;

/**
 * The mileage columns of a derivation (CS-101). An unread figure the valuation run read in thousands by the price
 * (thousands_price) stays read that way while the seller's figure is the same one: the run owns that decision, and the
 * next derivation of an unchanged post must not undo it until the next run decides again. Any other derivation
 * replaces the columns, the price evidence with them.
 */
function mileageColumnsOf(derived: DerivedListing, stored: StoredMileage | undefined) {
  const { mileageKm, mileageReading } = derived.attributes;
  if (
    mileageReading?.reading === 'unread' &&
    stored?.mileage_reading === 'thousands_price' &&
    stored.mileage_written_km === mileageReading.writtenKm
  ) {
    return {
      mileage_km: stored.mileage_km,
      mileage_written_km: stored.mileage_written_km,
      mileage_reading: stored.mileage_reading,
      mileage_wording: null,
      mileage_ask_ratio: stored.mileage_ask_ratio,
    };
  }
  return {
    mileage_km: mileageKm,
    mileage_written_km: mileageReading?.writtenKm ?? null,
    mileage_reading: mileageReading?.reading ?? null,
    mileage_wording: mileageReading?.wording ?? null,
    mileage_ask_ratio: null,
  };
}

function columnsOf(
  derived: DerivedListing,
  cityId: number | null,
  textPrice: TextPriceMeaning | null,
  storedMileage: StoredMileage | undefined,
): AttributeColumns {
  const { attributes } = derived;
  const year = attributes.modelYear;
  const price = attributes.price;
  // The one place the text's reading meets the site's (CS-52, the owner's decision of 2026-09-30): an asking price the
  // listing's accepted, usable extraction calls a down payment is an installment price, its figure the down payment.
  // Every derivation reads both again, so the next crawl cannot overwrite the text's reading.
  const downPayment = price?.type === 'asking' && textPrice === 'down_payment' ? price.toman : null;
  return {
    title: attributes.title,
    source_model_key: attributes.sourceModelKey,
    model_year_written: year?.written ?? null,
    model_year_sh: year?.sh ?? null,
    model_year_ad: year === null || year.written === 'sh' ? null : year.ad,
    ...mileageColumnsOf(derived, storedMileage),
    fuel: attributes.fuel,
    gearbox: attributes.gearbox,
    insurance_months_left: attributes.insuranceMonthsLeft,
    // A placeholder keeps its figure in the snapshot only (ADR-0014).
    price_type: downPayment === null ? (price?.type ?? null) : 'installment',
    asking_price_toman: price?.type === 'asking' && downPayment === null ? price.toman : null,
    down_payment_toman: downPayment,
    accepts_swap: attributes.acceptsSwap,
    accepts_installments: attributes.acceptsInstallments,
    seller_type: attributes.sellerType,
    body_condition: attributes.bodyCondition,
    engine_condition: attributes.engineCondition,
    gearbox_condition: attributes.gearboxCondition,
    front_chassis_condition: attributes.frontChassisCondition,
    rear_chassis_condition: attributes.rearChassisCondition,
    colour: attributes.colour,
    city_id: cityId,
    district_fa: attributes.districtFa,
    engine_volume_cc: attributes.engineVolumeCc,
    parser_version: derived.parserVersion,
  };
}

/** `<> all($1)` with one array parameter: the statement's text stays the same whatever the number of fields. */
function noneOf(fields: readonly UnparsedField[]) {
  return sql<UnparsedField>`all(${[...fields]}::text[])`;
}

export type DerivationWritten = {
  /** The listing's attribute columns changed. */
  readonly attributes: boolean;
  /** Its photo addresses changed: added, moved, replaced or removed. */
  readonly photos: boolean;
  /** Its unparsed values changed. */
  readonly unparsed: boolean;
};

/**
 * The city a post names, added the first time a post names it (CS-50); its id either way. Looked up first, as almost
 * every post names a city already known, so the insert (whose conflict settles a race) rarely spends an id.
 */
async function cityIdOf(
  db: Kysely<DB>,
  city: { readonly slug: string; readonly nameFa: string },
): Promise<number> {
  const known = await db.selectFrom('city').select('id').where('slug', '=', city.slug).executeTakeFirst();
  if (known) return known.id;
  const inserted = await db
    .insertInto('city')
    .values({ slug: city.slug, name_fa: city.nameFa })
    .onConflict((conflict) => conflict.constraint('city_slug_unique').doNothing())
    .returning('id')
    .executeTakeFirst();
  if (inserted) return inserted.id;
  const raced = await db
    .selectFrom('city')
    .select('id')
    .where('slug', '=', city.slug)
    .executeTakeFirstOrThrow();
  return raced.id;
}

/**
 * The colour's code row, added from the parser's own list when catalogue:sync has not run yet (a fresh database), so a
 * colour the parser read is never refused for its code; the sync keeps the labels.
 */
async function ensureColour(db: Kysely<DB>, code: string): Promise<void> {
  const colour = COLOURS.find((candidate) => candidate.code === code);
  if (colour === undefined) return;
  await db
    .insertInto('colour')
    .values({ code: colour.code, label_fa: colour.labelFa, family: colour.family })
    .onConflict((conflict) => conflict.constraint('colour_pkey').doNothing())
    .execute();
}

/** Writes what a parser derived for a listing, each part only where it differs from what is stored. */
export async function writeDerivedListing(
  db: Kysely<DB>,
  listingId: number,
  /** The snapshot the derivation read: only its own extraction's reading of the price is merged (CS-52). */
  snapshotId: number,
  derived: DerivedListing,
): Promise<DerivationWritten> {
  if (derived.attributes.colour !== null) await ensureColour(db, derived.attributes.colour);
  const cityId = derived.attributes.city === null ? null : await cityIdOf(db, derived.attributes.city);
  const storedMileage = await db
    .selectFrom('listing')
    .select(['mileage_km', 'mileage_written_km', 'mileage_reading', 'mileage_ask_ratio'])
    .where('id', '=', listingId)
    .executeTakeFirst();
  const columns = columnsOf(derived, cityId, await textPriceMeaningOf(db, snapshotId), storedMileage);
  const updated = await db
    .updateTable('listing')
    .set(columns)
    .where('id', '=', listingId)
    .where(
      sql<boolean>`(${sql.join(ATTRIBUTE_COLUMNS.map((column) => sql.ref(column)))}) IS DISTINCT FROM (${sql.join(
        ATTRIBUTE_COLUMNS.map((column) => columns[column]),
      )})`,
    )
    .executeTakeFirst();

  const photos = derived.photos.map((photo, index) => ({
    listing_id: listingId,
    position: index + 1,
    url: photo.url,
    thumbnail_url: photo.thumbnailUrl,
  }));
  const photosRemoved = await db
    .deleteFrom('listing_photo')
    .where('listing_id', '=', listingId)
    .where('position', '>', photos.length)
    .executeTakeFirst();
  const photosWritten =
    photos.length === 0
      ? undefined
      : await db
          .insertInto('listing_photo')
          .values(photos)
          .onConflict((conflict) =>
            conflict
              .constraint('listing_photo_pkey')
              .doUpdateSet((eb) => ({
                url: eb.ref('excluded.url'),
                thumbnail_url: eb.ref('excluded.thumbnail_url'),
              }))
              .where((eb) =>
                eb.or([
                  eb('listing_photo.url', 'is distinct from', eb.ref('excluded.url')),
                  eb('listing_photo.thumbnail_url', 'is distinct from', eb.ref('excluded.thumbnail_url')),
                ]),
              ),
          )
          .executeTakeFirst();

  const unparsed = derived.unparsed.map((value) => ({
    listing_id: listingId,
    field: value.field,
    raw_text: value.rawText,
  }));
  const unparsedRemoved = await db
    .deleteFrom('listing_unparsed_value')
    .where('listing_id', '=', listingId)
    .where('field', '<>', noneOf(unparsed.map((value) => value.field)))
    .executeTakeFirst();
  const unparsedWritten =
    unparsed.length === 0
      ? undefined
      : await db
          .insertInto('listing_unparsed_value')
          .values(unparsed)
          .onConflict((conflict) =>
            conflict
              .constraint('listing_unparsed_value_pkey')
              .doUpdateSet((eb) => ({ raw_text: eb.ref('excluded.raw_text') }))
              .where((eb) =>
                eb('listing_unparsed_value.raw_text', 'is distinct from', eb.ref('excluded.raw_text')),
              ),
          )
          .executeTakeFirst();

  return {
    attributes: updated.numUpdatedRows > 0n,
    photos: photosRemoved.numDeletedRows > 0n || (photosWritten?.numInsertedOrUpdatedRows ?? 0n) > 0n,
    unparsed: unparsedRemoved.numDeletedRows > 0n || (unparsedWritten?.numInsertedOrUpdatedRows ?? 0n) > 0n,
  };
}

/** Why the database refused a derived value: its SQLSTATE, and the constraint or column it broke when it names one. */
export type Refusal = { readonly code: string; readonly constraint: string | undefined };

function refusalOf(error: unknown): Refusal | undefined {
  const violation = constraintViolation(error);
  if (violation !== undefined) {
    return {
      code: violation.code,
      constraint: 'constraint' in violation ? violation.constraint : violation.column,
    };
  }
  // A value outside its column's type: 22003, numeric value out of range, and the other data exceptions.
  if (
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code.startsWith('22')
  ) {
    return { code: error.code, constraint: undefined };
  }
  return undefined;
}

export type DerivationOutcome =
  | { readonly written: DerivationWritten; readonly refused?: never }
  | { readonly refused: Refusal; readonly written?: never };

/**
 * Writes a derivation inside a savepoint of the caller's transaction. When the database refuses one of its values (a
 * CHECK, a type's range), only the derivation is undone and the refusal returned: the snapshot, fetch and price event
 * the crawler wrote in the same transaction stay, and the derive command goes on with its next listing. Any other
 * error is thrown, as before.
 */
export async function writeDerivedListingOrRefusal(
  trx: Transaction<DB>,
  listingId: number,
  snapshotId: number,
  derived: DerivedListing,
): Promise<DerivationOutcome> {
  await sql`SAVEPOINT derived_listing`.execute(trx);
  try {
    const written = await writeDerivedListing(trx, listingId, snapshotId, derived);
    await sql`RELEASE SAVEPOINT derived_listing`.execute(trx);
    return { written };
  } catch (error) {
    const refused = refusalOf(error);
    if (refused === undefined) throw error;
    await sql`ROLLBACK TO SAVEPOINT derived_listing`.execute(trx);
    await sql`RELEASE SAVEPOINT derived_listing`.execute(trx);
    return { refused };
  }
}

export type StoredSnapshot = {
  readonly listingId: number;
  readonly sourceId: string;
  readonly snapshotId: number;
  readonly payload: Json;
  /**
   * When the snapshot was first fetched: the date a parser reads it at, the same whenever it is derived (a mileage's
   * plausibility depends on the car's age then, never on the clock; CS-86).
   */
  readonly fetchedAt: Date;
  /** False when no fetch here records any of the listing's snapshots: they were copied from another database. */
  readonly fetched: boolean;
};

/** `= any($1)` over listing ids, with one array parameter. */
function anyListing(listingIds: readonly number[]) {
  return sql<number>`any(${[...listingIds]}::bigint[])`;
}

/** The next listings of these sources after `afterListingId`, by id, without holding them. */
export async function nextListings(
  db: Kysely<DB>,
  sourceIds: readonly string[],
  afterListingId: number,
  limit: number,
): Promise<number[]> {
  const rows = await db
    .selectFrom('listing')
    .select('id')
    .where('source_id', '=', anyOf(sourceIds))
    .where('id', '>', afterListingId)
    .orderBy('id')
    .limit(limit)
    .execute();
  return rows.map((row) => row.id);
}

// Holding listings to write what they say. The crawler holds a listing while it writes it, and discovery holds up to a
// page of them at once, in no set order; so a writer that waited for one of them while holding others could close a
// cycle with it (a deadlock). These two never do: the first waits for nothing, the second holds nothing while it waits.
// Read the snapshots of what they hold in a statement of their own: under READ COMMITTED a statement that waited for a
// lock rechecks only the row it locked, while a new statement also sees the fetch and snapshot committed meanwhile.

/**
 * Holds those of these listings no other transaction holds (FOR NO KEY UPDATE SKIP LOCKED) until the transaction ends,
 * and returns them; the others are left for holdListing.
 */
export async function holdFreeListings(db: Kysely<DB>, listingIds: readonly number[]): Promise<number[]> {
  if (listingIds.length === 0) return [];
  const rows = await db
    .selectFrom('listing')
    .select('id')
    .where('id', '=', anyListing(listingIds))
    .orderBy('id')
    .forNoKeyUpdate()
    .skipLocked()
    .execute();
  return rows.map((row) => row.id);
}

/** Holds one listing until the transaction ends, waiting for whoever holds it; false when it no longer exists. */
export async function holdListing(db: Kysely<DB>, listingId: number): Promise<boolean> {
  const row = await db
    .selectFrom('listing')
    .select('id')
    .where('id', '=', listingId)
    .forNoKeyUpdate()
    .executeTakeFirst();
  return row !== undefined;
}

/**
 * Each listing's latest snapshot: the one its latest fetch with content returned, found through
 * fetch_log_listing_requested_idx, so a page that changed and changed back is the older snapshot again. When no fetch
 * here records any of its snapshots, because they were copied from another database without its request log (as the
 * bake-off's listings were into the main database), it is the one first fetched last. A listing with no snapshot is
 * left out.
 */
export async function latestSnapshots(
  db: Kysely<DB>,
  listingIds: readonly number[],
): Promise<StoredSnapshot[]> {
  if (listingIds.length === 0) return [];
  return db
    .selectFrom('listing as l')
    .leftJoinLateral(
      (eb) =>
        eb
          .selectFrom('fetch_log as f')
          .select('f.snapshot_id')
          .whereRef('f.listing_id', '=', 'l.id')
          .whereRef('f.source_id', '=', 'l.source_id')
          .where('f.snapshot_id', 'is not', null)
          .orderBy('f.requested_at', 'desc')
          .orderBy('f.id', 'desc')
          .limit(1)
          .as('latest'),
      (join) => join.onTrue(),
    )
    .innerJoin('snapshot as s', (join) =>
      join.onRef('s.listing_id', '=', 'l.id').on((eb) =>
        eb(
          's.id',
          '=',
          // COALESCE evaluates the copied snapshots' subquery only for a listing no fetch recorded.
          eb.fn.coalesce(
            'latest.snapshot_id',
            eb
              .selectFrom('snapshot as copied')
              .select('copied.id')
              .whereRef('copied.listing_id', '=', 'l.id')
              .orderBy('copied.first_fetched_at', 'desc')
              .orderBy('copied.id', 'desc')
              .limit(1),
          ),
        ),
      ),
    )
    .select((eb) => [
      'l.id as listingId',
      'l.source_id as sourceId',
      's.id as snapshotId',
      's.payload',
      's.first_fetched_at as fetchedAt',
      // node-postgres reads a boolean as one; SqlBool also allows the 0 and 1 of other dialects.
      eb('latest.snapshot_id', 'is not', null).$castTo<boolean>().as('fetched'),
    ])
    .where('l.id', '=', anyListing(listingIds))
    .orderBy('l.id')
    .execute();
}

/** How many listings of these sources have no snapshot yet: seen in lists only, never read in detail. */
export async function countListingsWithoutSnapshot(
  db: Kysely<DB>,
  sourceIds: readonly string[],
): Promise<number> {
  const row = await db
    .selectFrom('listing as l')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .where('l.source_id', '=', anyOf(sourceIds))
    .where((eb) =>
      eb.not(eb.exists(eb.selectFrom('snapshot as s').select('s.id').whereRef('s.listing_id', '=', 'l.id'))),
    )
    .executeTakeFirstOrThrow();
  return row.count;
}
