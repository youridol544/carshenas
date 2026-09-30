import { sql, type Kysely, type Transaction } from 'kysely';
import { constraintViolation } from '@carshenas/db/database-errors';
import type { DB, Json, Listing } from '@carshenas/db/db-types';
import type { DerivedListing, UnparsedField } from '../sources/attributes.ts';
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
  'parser_version',
] as const satisfies readonly (keyof Listing)[];

type AttributeColumns = { readonly [K in (typeof ATTRIBUTE_COLUMNS)[number]]: Listing[K] };

function columnsOf(derived: DerivedListing): AttributeColumns {
  const { attributes } = derived;
  const year = attributes.modelYear;
  const price = attributes.price;
  return {
    title: attributes.title,
    source_model_key: attributes.sourceModelKey,
    model_year_written: year?.written ?? null,
    model_year_sh: year?.sh ?? null,
    model_year_ad: year === null || year.written === 'sh' ? null : year.ad,
    mileage_km: attributes.mileageKm,
    fuel: attributes.fuel,
    gearbox: attributes.gearbox,
    insurance_months_left: attributes.insuranceMonthsLeft,
    // A placeholder keeps its figure in the snapshot only (ADR-0014); an installment offer is read from the text
    // (CS-52), which writes the three price columns together with this parser's reading.
    price_type: price?.type ?? null,
    asking_price_toman: price?.type === 'asking' ? price.toman : null,
    down_payment_toman: null,
    accepts_swap: attributes.acceptsSwap,
    accepts_installments: attributes.acceptsInstallments,
    seller_type: attributes.sellerType,
    body_condition: attributes.bodyCondition,
    engine_condition: attributes.engineCondition,
    gearbox_condition: attributes.gearboxCondition,
    front_chassis_condition: attributes.frontChassisCondition,
    rear_chassis_condition: attributes.rearChassisCondition,
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

/** Writes what a parser derived for a listing, each part only where it differs from what is stored. */
export async function writeDerivedListing(
  db: Kysely<DB>,
  listingId: number,
  derived: DerivedListing,
): Promise<DerivationWritten> {
  const columns = columnsOf(derived);
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
  derived: DerivedListing,
): Promise<DerivationOutcome> {
  await sql`SAVEPOINT derived_listing`.execute(trx);
  try {
    const written = await writeDerivedListing(trx, listingId, derived);
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
 * fetch_log_listing_requested_idx, so a page that changed and changed back is the older snapshot again. A listing no
 * fetch ever stored a snapshot for is left out.
 */
export async function latestSnapshots(
  db: Kysely<DB>,
  listingIds: readonly number[],
): Promise<StoredSnapshot[]> {
  if (listingIds.length === 0) return [];
  return db
    .selectFrom('listing as l')
    .innerJoinLateral(
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
      join.onRef('s.id', '=', 'latest.snapshot_id').onRef('s.listing_id', '=', 'l.id'),
    )
    .select(['l.id as listingId', 'l.source_id as sourceId', 's.id as snapshotId', 's.payload'])
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
