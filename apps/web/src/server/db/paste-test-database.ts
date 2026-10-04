import 'server-only';
import { sql, type Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';
import type { ListingTestData } from '@/server/db/listing-test-database';

// For the pasted-link integration tests (CS-65, *.db.test.ts on the scratch database `pnpm db:check` migrated): Divar
// listings of the listing page's seeded model in each state a pasted link can meet, and what a paste leaves behind.

export type PasteListingValues = {
  /** The asking price; null: seen on a list page only, no details read. */
  readonly price: number | null;
  readonly withModel?: boolean;
  readonly gone?: boolean;
};

export async function addDivarListing(
  owner: Kysely<DB>,
  data: ListingTestData,
  key: string,
  values: PasteListingValues,
): Promise<number> {
  const priced = values.price !== null;
  const row = await owner
    .insertInto('listing')
    .values({
      source_id: 'divar',
      source_listing_key: key,
      url: `https://divar.ir/v/${key}`,
      status: 'active',
      listed_at: sql<Date>`now() - interval '3 days'`,
      last_seen_at: sql<Date>`now() - interval '1 hour'`,
      title: `آگهی آزمایشی ${key}`,
      ...(values.withModel === false
        ? { catalogue_match: 'unmatched' as const }
        : { make_id: data.makeId, model_id: data.modelId, catalogue_match: 'model' as const }),
      ...(priced
        ? {
            last_checked_at: sql<Date>`now() - interval '1 hour'`,
            model_year_written: 'sh' as const,
            model_year_sh: 1395,
            mileage_km: 150_000,
            price_type: 'asking' as const,
            asking_price_toman: values.price,
            gearbox: 'automatic' as const,
            fuel: 'petrol' as const,
            seller_type: 'private' as const,
            body_condition: 'intact' as const,
            engine_condition: 'sound' as const,
          }
        : {}),
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  if (values.gone === true) {
    await owner
      .updateTable('listing')
      .set({ status: 'gone', delisted_at: sql<Date>`now()` })
      .where('id', '=', row.id)
      .execute();
  }
  return row.id;
}

/** Everything the tests wrote: their listings, wanted links and the model's demand. */
export async function removePasteRows(owner: Kysely<DB>, data: ListingTestData): Promise<void> {
  await owner.transaction().execute(async (trx) => {
    await sql`SET LOCAL carshenas.purge = 'on'`.execute(trx);
    await sql`DELETE FROM wanted_link WHERE source_listing_key LIKE 'tst%' OR source_listing_key LIKE 'fill%'`.execute(
      trx,
    );
    await sql`DELETE FROM model_demand WHERE model_id = ${data.modelId}`.execute(trx);
    await sql`DELETE FROM crawl_request WHERE model_id = ${data.modelId}`.execute(trx);
    await sql`DELETE FROM listing WHERE source_id = 'divar' AND source_listing_key LIKE 'tst%'`.execute(trx);
  });
}

/** The seeded model read in depth, as the migration seeds the tracked ones: a link for it is queued, not outside (CS-115). */
export async function trackModel(owner: Kysely<DB>, data: ListingTestData): Promise<void> {
  await owner
    .insertInto('tracked_model')
    .values({ model_id: data.modelId, origin: 'seed' })
    .onConflict((conflict) => conflict.constraint('tracked_model_once_per_scope_unique').doNothing())
    .execute();
}

/** The seeded model no longer read: a link for it is outside again. */
export async function untrackModel(owner: Kysely<DB>, data: ListingTestData): Promise<void> {
  await owner.deleteFrom('tracked_model').where('model_id', '=', data.modelId).execute();
}

/** How many crawl requests the seeded model has (made by the asks of a test). */
export async function requestedModels(owner: Kysely<DB>, data: ListingTestData): Promise<number> {
  const rows = await owner
    .selectFrom('crawl_request')
    .select('id')
    .where('model_id', '=', data.modelId)
    .execute();
  return rows.length;
}

/** The model's paste requests counted so far. */
export async function pasteDemand(owner: Kysely<DB>, data: ListingTestData): Promise<number> {
  const rows = await owner
    .selectFrom('model_demand')
    .select('request_count')
    .where('model_id', '=', data.modelId)
    .where('kind', '=', 'paste')
    .execute();
  return rows.reduce((total, row) => total + row.request_count, 0);
}

export async function demandRows(owner: Kysely<DB>, data: ListingTestData): Promise<number> {
  const rows = await owner
    .selectFrom('model_demand')
    .select('id')
    .where('model_id', '=', data.modelId)
    .execute();
  return rows.length;
}

export async function storedValuations(owner: Kysely<DB>, listingId: number): Promise<number> {
  const rows = await owner
    .selectFrom('listing_valuation')
    .select('listing_id')
    .where('listing_id', '=', listingId)
    .execute();
  return rows.length;
}

export async function wantedLinks(owner: Kysely<DB>, key: string) {
  return owner
    .selectFrom('wanted_link')
    .select(['source_id', 'request_count'])
    .where('source_listing_key', '=', key)
    .execute();
}

/** Fills the table with other wanted links up to the cap, as a crowd of pastes would. */
export async function fillWantedLinks(owner: Kysely<DB>, cap: number): Promise<void> {
  const kept = await owner
    .selectFrom('wanted_link')
    .select(sql<number>`count(*)::int`.as('count'))
    .executeTakeFirstOrThrow();
  await sql`INSERT INTO wanted_link (source_id, source_listing_key)
    SELECT 'divar', 'fill' || lpad(n::text, 8, '0') FROM generate_series(1, ${cap - kept.count}::int) AS n`.execute(
    owner,
  );
}

/** Rows the crawler logged in the last minute: a paste must add none. */
export async function recentFetches(owner: Kysely<DB>): Promise<number> {
  const row = await owner
    .selectFrom('fetch_log')
    .select(sql<number>`count(*)::int`.as('count'))
    .where('requested_at', '>', sql<Date>`now() - interval '1 minute'`)
    .executeTakeFirstOrThrow();
  return row.count;
}

/** What the web role may and may not do with the paste tables, as the database answers. */
export async function webRoleCannotWrite(webDatabase: Kysely<DB>): Promise<readonly unknown[]> {
  const errors: unknown[] = [];
  for (const statement of [
    sql`INSERT INTO wanted_link (source_id, source_listing_key) VALUES ('divar', 'direct12')`,
    sql`UPDATE model_demand SET request_count = 1`,
    sql`SELECT * FROM wanted_link`,
  ]) {
    try {
      await statement.execute(webDatabase);
    } catch (error) {
      errors.push(error);
    }
  }
  return errors;
}
