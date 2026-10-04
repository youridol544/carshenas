// The search table, built (CS-59, ADR-0027, ADR-0028): search_document holds listing_filter_row's columns for every
// searchable listing, so the predicates of sql.ts run on it unchanged, plus what a result card and the text search
// need. A listing is searchable when it is active, from a public source, its details have been read (price_type is
// set: a list row alone has no title, price or year, and cannot be shown or rated) and a crawl saw it within the
// freshness window. One statement builds the rows of a set of listings or of an id range by writing only the rows
// whose values changed and removing those that stopped being searchable; readers never wait and never see a
// half-built row. The worker runs it for the listings the triggers mark (search.refresh) and, in id ranges of about
// 2,000 listings a statement, for all (search.rebuild, `pnpm search:rebuild`), then refreshes the counts pages read
// (search_facet_count) and the typo vocabulary (search_word), each in a transaction of its own and each recorded in
// search_build_event, so a part that failed is rebuilt by the next run. Runs in Node only.
import { setTimeout as sleep } from 'node:timers/promises';
import { sql, type Kysely, type RawBuilder } from 'kysely';
import type { DB, SearchBuildEvent, SearchFacetCount } from '@carshenas/db/db-types';
import { CATALOGUES } from './catalogues.ts';
import { SEARCH_FRESHNESS_HOURS } from './freshness.ts';
import type { Column } from './kinds.ts';
import { readFilterOptions, type DatabaseFilterOptions } from './options-queries.ts';
import { catalogueSearch } from './search.ts';
import { searchableWhere } from './sql.ts';
import { solarHijriYear } from './year.ts';

/** Every column of listing_filter_row that search_document copies: all of them but the status (every row is active). */
export const FILTER_ROW_COLUMNS = [
  'listing_id',
  'source_id',
  'listed_at',
  'last_seen_at',
  'make_id',
  'model_id',
  'trim_id',
  'make_key',
  'model_key',
  'trim_key',
  'body_type',
  'model_year_sh',
  'mileage_km',
  'price_type',
  'asking_price_toman',
  'market_value_toman',
  'price_gap_pct',
  'deal_rating',
  'gearbox',
  'fuel',
  'colour_family',
  'city_id',
  'city_key',
  'district_fa',
  'district_key',
  'seller_type',
  'insurance_months_left',
  'body_condition',
  'engine_condition',
  'gearbox_condition',
  'chassis_condition',
  'paint_free',
  'accident',
  'replaced_parts',
  'ride_hailing',
  'plate',
  'offers_swap',
  'offers_installments',
  'has_photo',
  'model_rank',
  'mileage_reading',
  'mileage_written_km',
  'engine_volume_cc',
  'car_origin',
] as const satisfies readonly Column[];

// A column added to the view fails type-checking here until search_document copies it (or it is named as left out).
type Never<T extends never> = T;
export type ViewColumnsNotCopied = Never<Exclude<Column, (typeof FILTER_ROW_COLUMNS)[number] | 'status'>>;

/** What search_document adds to the view's columns, computed by the build below. */
const BUILT_COLUMNS = [
  'km_per_year',
  'valued_on',
  'photo_count',
  'cover_photo_url',
  'cover_thumbnail_url',
  'search_text',
] as const;

const WRITTEN_COLUMNS = [...FILTER_ROW_COLUMNS, ...BUILT_COLUMNS];

/** Listings per statement when every row is built: each statement stays well inside the worker's 30 s limit. */
export const BUILD_CHUNK_LISTINGS = 2_000;

/** Which listings to build: those named (the ones the triggers marked), an id range, or every listing in chunks. */
export type BuildScope =
  | { readonly listingIds: readonly number[] }
  | { readonly idRange: { readonly from: number | null; readonly to: number | null } }
  | 'all';

export type BuildChunk = {
  /** 1-based. */
  readonly index: number;
  readonly chunks: number;
  readonly written: number;
  readonly removed: number;
};

export type BuildOptions = {
  readonly scope: BuildScope;
  /** Today, for a car's age in km_per_year. Defaults to the process's clock. */
  readonly now?: Date;
  /** For scope 'all': listings per statement. */
  readonly chunkSize?: number;
  /** For scope 'all': called after each statement, for a rebuild that reports its progress. */
  readonly onChunk?: (chunk: BuildChunk) => void;
};

export type BuildResult = {
  /** Rows inserted or changed. */
  readonly written: number;
  /** Rows removed: the listing stopped being searchable (sold, expired, details gone, not seen for 48 hours). */
  readonly removed: number;
};

function columnList(prefix: string | null, columns: readonly string[]): RawBuilder<unknown> {
  return sql.join(columns.map((column) => sql.ref(prefix === null ? column : `${prefix}.${column}`)));
}

type SingleScope = Exclude<BuildScope, 'all'>;

function inScope(scope: SingleScope, column: string): RawBuilder<boolean> {
  const ref = sql.ref(column);
  if ('listingIds' in scope) return sql<boolean>`${ref} = any(${[...scope.listingIds]}::bigint[])`;
  const { from, to } = scope.idRange;
  const parts = [
    ...(from === null ? [] : [sql<boolean>`${ref} >= ${from}`]),
    ...(to === null ? [] : [sql<boolean>`${ref} < ${to}`]),
  ];
  return parts.length === 0 ? sql<boolean>`true` : sql<boolean>`(${sql.join(parts, sql` AND `)})`;
}

/** One statement: the rows of the scope's listings that are searchable are written when new or changed, the rest removed. */
async function buildStatement(db: Kysely<DB>, scope: SingleScope, now: Date): Promise<BuildResult> {
  const year = solarHijriYear(now);
  const { rows } = await sql<{ written: number; removed: number }>`
    WITH latest_run AS (
      -- The run listing_filter_row takes its ratings from.
      SELECT r.as_of_date FROM valuation_run r WHERE r.status = 'succeeded' ORDER BY r.as_of_date DESC, r.id DESC LIMIT 1
    ),
    aliases AS (
      SELECT a.make_id, a.model_id, a.trim_id, string_agg(a.alias, ' ' ORDER BY a.alias) AS names
      FROM catalogue_alias a
      WHERE a.status <> 'rejected'
      GROUP BY a.make_id, a.model_id, a.trim_id
    ),
    wanted AS (
      SELECT ${columnList('r', FILTER_ROW_COLUMNS)},
             CASE WHEN r.mileage_km IS NOT NULL AND r.model_year_sh IS NOT NULL
               THEN round(r.mileage_km / greatest(${year}::integer - r.model_year_sh, 0.5))::integer
             END AS km_per_year,
             CASE WHEN r.market_value_toman IS NOT NULL THEN (SELECT as_of_date FROM latest_run) END AS valued_on,
             photo.photo_count,
             photo.cover_photo_url,
             photo.cover_thumbnail_url,
             -- As written: text_vector normalises it only when the row is written, and an unchanged row is not.
             concat_ws(' ',
               l.title, mk.name_fa, mk.name_en, make_alias.names, m.name_fa, m.name_en, model_alias.names, t.name_fa,
               t.name_en, trim_alias.names, r.model_year_sh::text, l.model_year_ad::text, city.name_fa, r.district_fa,
               colour.label_fa, body.label_fa) AS search_text
      FROM listing_filter_row r
      JOIN listing l ON l.id = r.listing_id
      JOIN source s ON s.id = r.source_id AND s.listing_visibility = 'public'
      LEFT JOIN make mk ON mk.id = r.make_id
      LEFT JOIN model m ON m.id = r.model_id
      LEFT JOIN "trim" t ON t.id = r.trim_id
      -- An alias names exactly one make, model or trim, so each join finds only its own level's names.
      LEFT JOIN aliases make_alias ON make_alias.make_id = r.make_id
      LEFT JOIN aliases model_alias ON model_alias.model_id = r.model_id
      LEFT JOIN aliases trim_alias ON trim_alias.trim_id = r.trim_id
      LEFT JOIN city ON city.id = r.city_id
      LEFT JOIN colour ON colour.code = l.colour
      LEFT JOIN body_type body ON body.code = r.body_type
      CROSS JOIN LATERAL (
        SELECT count(*)::integer AS photo_count,
               (array_agg(p.url ORDER BY p.position))[1] AS cover_photo_url,
               (array_agg(p.thumbnail_url ORDER BY p.position))[1] AS cover_thumbnail_url
        FROM listing_photo p
        WHERE p.listing_id = r.listing_id
      ) photo
      WHERE r.status = 'active'
        -- Details read: a list row alone has no price_type, and cannot be shown as a card or rated.
        AND r.price_type IS NOT NULL
        AND r.last_seen_at >= now() - make_interval(hours => ${SEARCH_FRESHNESS_HOURS})
        AND ${inScope(scope, 'r.listing_id')}
    ),
    -- Only rows that are new or differ are written: ON CONFLICT would lock every unchanged row too.
    changed AS (
      SELECT w.*
      FROM wanted w
      LEFT JOIN search_document d ON d.listing_id = w.listing_id
      WHERE d.listing_id IS NULL
         OR (${columnList('d', WRITTEN_COLUMNS)}) IS DISTINCT FROM (${columnList('w', WRITTEN_COLUMNS)})
    ),
    written AS (
      INSERT INTO search_document (${columnList(null, WRITTEN_COLUMNS)}, refreshed_at)
      SELECT ${columnList('c', WRITTEN_COLUMNS)}, now() FROM changed c
      ON CONFLICT ON CONSTRAINT search_document_pkey DO UPDATE
      SET ${sql.join(
        WRITTEN_COLUMNS.filter((column) => column !== 'listing_id').map(
          (column) => sql`${sql.ref(column)} = ${sql.ref(`excluded.${column}`)}`,
        ),
      )},
          refreshed_at = excluded.refreshed_at
      RETURNING 1
    ),
    removed AS (
      DELETE FROM search_document d
      WHERE ${inScope(scope, 'd.listing_id')}
        AND NOT EXISTS (SELECT FROM wanted w WHERE w.listing_id = d.listing_id)
      RETURNING 1
    )
    SELECT (SELECT count(*) FROM written)::integer AS written, (SELECT count(*) FROM removed)::integer AS removed`.execute(
    db,
  );
  const row = rows[0];
  return { written: row?.written ?? 0, removed: row?.removed ?? 0 };
}

/**
 * The first listing id of each chunk after the first: the listings that are or may be in the table (active with their
 * details read, or already a row), `size` to a chunk. The chunks are id ranges, so together they cover every id.
 */
async function chunkBoundaries(db: Kysely<DB>, size: number): Promise<number[]> {
  const { rows } = await sql<{ id: number }>`
    SELECT id FROM (
      SELECT l.id, row_number() OVER (ORDER BY l.id) AS n
      FROM listing l
      WHERE (l.status = 'active' AND l.price_type IS NOT NULL)
         OR EXISTS (SELECT FROM search_document d WHERE d.listing_id = l.id)
    ) numbered
    WHERE n % ${size} = 1 AND n > 1
    ORDER BY id`.execute(db);
  return rows.map((row) => row.id);
}

/** Every row built in id ranges of about `chunkSize` listings a statement, in the caller's transaction. */
async function buildAll(db: Kysely<DB>, options: BuildOptions): Promise<BuildResult> {
  const now = options.now ?? new Date();
  const boundaries = await chunkBoundaries(db, options.chunkSize ?? BUILD_CHUNK_LISTINGS);
  const ranges = [null, ...boundaries].map((from, index) => ({ from, to: boundaries[index] ?? null }));
  let written = 0;
  let removed = 0;
  for (const [index, idRange] of ranges.entries()) {
    const result = await buildStatement(db, { idRange }, now);
    written += result.written;
    removed += result.removed;
    options.onChunk?.({ index: index + 1, chunks: ranges.length, ...result });
  }
  return { written, removed };
}

/**
 * Builds search_document's rows for the scope: rows whose values changed are written, rows that are no longer
 * searchable are removed. A named set or one id range is one statement; 'all' is one statement per id range of about
 * 2,000 listings, which the caller runs in one transaction so a failure leaves nothing half built. Call it in a
 * transaction holding the build lock (tryLockSearchBuild), so two builds never interleave.
 */
export async function buildSearchDocuments(db: Kysely<DB>, options: BuildOptions): Promise<BuildResult> {
  return options.scope === 'all'
    ? buildAll(db, options)
    : buildStatement(db, options.scope, options.now ?? new Date());
}

/**
 * Removes the rows whose listing no crawl has seen within the freshness window, by a plain scan: 4 ms at 6,000 rows and
 * 16 ms at 25,000 (docs/evidence/search-api/2026-10-02/hot-updates.txt). An index on last_seen_at takes it to 0.35 ms,
 * but a listing seen again changes only last_seen_at, and an indexed column makes that update leave its page: HOT
 * updates of a sighting fall from 26 to 56 % (fill factor 80) to none. Revisit with the index when the delete passes
 * 50 ms, about 80,000 rows.
 */
export async function removeAgedDocuments(db: Kysely<DB>): Promise<number> {
  const result = await db
    .deleteFrom('search_document')
    .where('last_seen_at', '<', sql<Date>`now() - make_interval(hours => ${SEARCH_FRESHNESS_HOURS})`)
    .executeTakeFirst();
  return Number(result.numDeletedRows);
}

/**
 * The caller's transaction gets its own statement, lock and (when asked) transaction limits (set_config with is_local,
 * SET LOCAL's equivalent that takes parameters): the rebuild's statements and transaction are bigger than a refresh's,
 * and its limits are its own. The transaction limit has to be disabled before it is set again: PostgreSQL arms the
 * role's timer when the transaction starts and re-arms it only from nothing (a from-empty fill of 25,000 rows took 40 s in the first version, 15 s now
 * on 2026-10-02, so 60,000 rows would not fit the worker role's two minutes).
 */
export async function limitBuildTransaction(
  db: Kysely<DB>,
  limits: {
    readonly statementSeconds: number;
    readonly lockSeconds: number;
    readonly transactionSeconds?: number;
  },
): Promise<void> {
  await sql`SELECT set_config('statement_timeout', ${`${String(limits.statementSeconds)}s`}, true),
                   set_config('lock_timeout', ${`${String(limits.lockSeconds)}s`}, true)`.execute(db);
  if (limits.transactionSeconds !== undefined) {
    await sql`SELECT set_config('transaction_timeout', '0', true)`.execute(db);
    await sql`SELECT set_config('transaction_timeout', ${`${String(limits.transactionSeconds)}s`}, true)`.execute(
      db,
    );
  }
}

// One key for every build, so a refresh and a rebuild never interleave: 'search_document' as a number.
const BUILD_LOCK = 5_391_027_311;

/**
 * Takes, until the transaction ends, the lock every build of search_document holds, or says it is held. It never waits
 * on the lock itself: the worker's lock_timeout is five seconds, and a refresh that finds a build running has nothing
 * to do but leave its marks for the next tick.
 */
export async function tryLockSearchBuild(db: Kysely<DB>): Promise<boolean> {
  const { rows } = await sql<{
    locked: boolean;
  }>`SELECT pg_try_advisory_xact_lock(${BUILD_LOCK}::bigint) AS locked`.execute(db);
  return rows[0]?.locked === true;
}

/**
 * tryLockSearchBuild again every `pollMs` until it is taken or `timeoutMs` has passed (false): for the rebuild, which
 * should wait out a refresh, but never longer than its limit.
 */
export async function waitForSearchBuild(
  db: Kysely<DB>,
  options: { readonly timeoutMs: number; readonly pollMs?: number },
): Promise<boolean> {
  const deadline = Date.now() + options.timeoutMs;
  for (;;) {
    if (await tryLockSearchBuild(db)) return true;
    if (Date.now() >= deadline) return false;
    await sleep(options.pollMs ?? 250);
  }
}

/**
 * Takes up to `limit` marks, oldest first, and returns the listings they name (a listing marked twice once). The marks
 * are deleted in the caller's transaction, so a failed build leaves them marked. Nothing here locks a row a writer
 * needs: the marks are only ever inserted by the triggers and deleted here, and one build runs at a time.
 */
export async function takeStaleListings(
  db: Kysely<DB>,
  limit: number,
): Promise<{ readonly listingIds: number[]; readonly marks: number }> {
  const { rows } = await sql<{ listing_id: number }>`
    DELETE FROM search_document_stale
    WHERE id IN (SELECT s.id FROM search_document_stale s ORDER BY s.id LIMIT ${limit})
    RETURNING listing_id`.execute(db);
  return {
    listingIds: [...new Set(rows.map((row) => row.listing_id))].sort((a, b) => a - b),
    marks: rows.length,
  };
}

// The counts pages read.

export type FacetCounts = {
  /** The searchable listings: the rows of search_document. */
  readonly total: number;
  /** The active listings of public sources a crawl saw within the window, whether or not their details were read. */
  readonly seen: number;
  readonly catalogues: Readonly<Record<string, number>>;
  readonly options: DatabaseFilterOptions;
};

/** Counts what search_facet_count holds: the total, the listings seen, each catalogue, each option. */
export async function countFacets(db: Kysely<DB>, now: Date = new Date()): Promise<FacetCounts> {
  const options = await readFilterOptions(db, 'search_document');
  const catalogues: Record<string, number> = {};
  for (const catalogue of CATALOGUES) {
    const row = await db
      .selectFrom('search_document as r')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where(
        searchableWhere(
          { filters: catalogueSearch(catalogue.id).filters, tsquery: null },
          { alias: 'r', now },
        ),
      )
      .executeTakeFirstOrThrow();
    catalogues[catalogue.id] = row.count;
  }
  const total = await db
    .selectFrom('search_document')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .executeTakeFirstOrThrow();
  const seen = await db
    .selectFrom('listing as l')
    .innerJoin('source as s', 's.id', 'l.source_id')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .where('l.status', '=', 'active')
    .where('s.listing_visibility', '=', 'public')
    .where('l.last_seen_at', '>=', sql<Date>`now() - make_interval(hours => ${SEARCH_FRESHNESS_HOURS})`)
    .executeTakeFirstOrThrow();
  return { total: total.count, seen: seen.count, catalogues, options };
}

type FacetRow = {
  facet: SearchFacetCount['facet'];
  value: string;
  label_fa: string;
  position: number;
  listing_count: number;
};

/**
 * Makes search_facet_count hold the counts, in the caller's transaction: a row is written only when its count or
 * label changed and removed when its option is gone, so a minute that changed nothing writes nothing.
 */
export async function writeFacetCounts(
  db: Kysely<DB>,
  counts: FacetCounts,
): Promise<{ readonly written: number; readonly removed: number }> {
  const rows: FacetRow[] = [
    { facet: 'total', value: '', label_fa: 'قابل جست‌وجو', position: 0, listing_count: counts.total },
    { facet: 'seen', value: '', label_fa: 'دیده‌شده', position: 0, listing_count: counts.seen },
  ];
  CATALOGUES.forEach((catalogue, position) => {
    rows.push({
      facet: 'catalogue',
      value: catalogue.id,
      label_fa: catalogue.title,
      position,
      listing_count: counts.catalogues[catalogue.id] ?? 0,
    });
  });
  for (const [facet, options] of Object.entries(counts.options) as [
    keyof DatabaseFilterOptions,
    DatabaseFilterOptions[keyof DatabaseFilterOptions],
  ][]) {
    options.forEach((option, position) => {
      rows.push({
        facet,
        value: option.value,
        label_fa: option.label,
        position,
        listing_count: option.count,
      });
    });
  }
  const { rows: done } = await sql<{ written: number; removed: number }>`
    WITH wanted AS (
      SELECT * FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb)
        AS x (facet text, value text, label_fa text, "position" integer, listing_count integer)
    ),
    removed AS (
      DELETE FROM search_facet_count f
      WHERE NOT EXISTS (SELECT FROM wanted w WHERE w.facet = f.facet AND w.value = f.value)
      RETURNING 1
    ),
    written AS (
      INSERT INTO search_facet_count (facet, value, label_fa, "position", listing_count, changed_at)
      SELECT w.facet, w.value, w.label_fa, w."position", w.listing_count, now() FROM wanted w
      ON CONFLICT ON CONSTRAINT search_facet_count_pkey DO UPDATE
      SET label_fa = excluded.label_fa, "position" = excluded."position", listing_count = excluded.listing_count,
          changed_at = excluded.changed_at
      WHERE (search_facet_count.label_fa, search_facet_count."position", search_facet_count.listing_count)
        IS DISTINCT FROM (excluded.label_fa, excluded."position", excluded.listing_count)
      RETURNING 1
    )
    SELECT (SELECT count(*) FROM written)::integer AS written, (SELECT count(*) FROM removed)::integer AS removed`.execute(
    db,
  );
  await recordBuildEvent(db, 'counts_built');
  return { written: done[0]?.written ?? 0, removed: done[0]?.removed ?? 0 };
}

/** Counts and writes the counts: what the worker does every minute, and after every change. */
export async function refreshFacetCounts(
  db: Kysely<DB>,
  now: Date = new Date(),
): Promise<{ readonly written: number; readonly removed: number }> {
  return writeFacetCounts(db, await countFacets(db, now));
}

// The typo vocabulary.

/**
 * Rebuilds the typo vocabulary from search_document's words: rows for new words, counts changed, gone words removed,
 * in the caller's transaction.
 */
export async function refreshSearchWords(db: Kysely<DB>): Promise<{ readonly words: number }> {
  const { rows } = await sql<{ words: number }>`
    WITH words AS (
      SELECT s.word, s.ndoc AS listing_count FROM ts_stat('SELECT text_vector FROM search_document') s
    ),
    removed AS (
      DELETE FROM search_word w WHERE NOT EXISTS (SELECT FROM words x WHERE x.word = w.word) RETURNING 1
    ),
    written AS (
      INSERT INTO search_word (word, listing_count)
      SELECT x.word, x.listing_count FROM words x
      ON CONFLICT ON CONSTRAINT search_word_pkey DO UPDATE SET listing_count = excluded.listing_count
      WHERE search_word.listing_count <> excluded.listing_count
      RETURNING 1
    )
    SELECT (SELECT count(*) FROM words)::integer AS words`.execute(db);
  await recordBuildEvent(db, 'vocabulary_built');
  return { words: rows[0]?.words ?? 0 };
}

/** Rows changed by one build above which the build analyses the tables, so the next plans count the new rows. */
export const ANALYZE_AFTER_ROWS = 1_000;

/** Refreshes the planner's statistics of search_document and search_word (the worker holds MAINTAIN on both). */
export async function analyzeSearchTables(db: Kysely<DB>): Promise<void> {
  await sql`ANALYZE search_document, search_word`.execute(db);
}

// When each part was built.

/** Writes the time of an event by the database's clock (documents_changed is written by a trigger). */
export async function recordBuildEvent(db: Kysely<DB>, event: SearchBuildEvent['event']): Promise<void> {
  await sql`
    INSERT INTO search_build_event (event, happened_at) VALUES (${event}, clock_timestamp())
    ON CONFLICT ON CONSTRAINT search_build_event_pkey DO UPDATE SET happened_at = excluded.happened_at`.execute(
    db,
  );
}

export type BuildState = {
  /** The rows in search_document. */
  readonly documents: number;
  readonly documentsChangedAt: Date | null;
  readonly countsBuiltAt: Date | null;
  readonly vocabularyBuiltAt: Date | null;
  readonly fullRebuildAt: Date | null;
  /** The database's clock. */
  readonly now: Date;
};

export async function readBuildState(db: Kysely<DB>): Promise<BuildState> {
  const events = await db.selectFrom('search_build_event').select(['event', 'happened_at']).execute();
  const at = (event: SearchBuildEvent['event']) =>
    events.find((row) => row.event === event)?.happened_at ?? null;
  const { rows } = await sql<{ documents: number; now: Date }>`
    SELECT (SELECT count(*) FROM search_document)::integer AS documents, now() AS now`.execute(db);
  return {
    documents: rows[0]?.documents ?? 0,
    documentsChangedAt: at('documents_changed'),
    countsBuiltAt: at('counts_built'),
    vocabularyBuiltAt: at('vocabulary_built'),
    fullRebuildAt: at('full_rebuild'),
    now: rows[0]?.now ?? new Date(),
  };
}

/**
 * The vocabulary was not built since the rows last changed (or never): whatever the next run changed or did not, it
 * rebuilds it. This is what repairs a run that committed its rows and failed before the vocabulary.
 */
export function isVocabularyStale(state: BuildState): boolean {
  if (state.vocabularyBuiltAt === null) return true;
  return state.documentsChangedAt !== null && state.documentsChangedAt > state.vocabularyBuiltAt;
}

/** The counts were not built since the rows last changed (or never). */
export function areCountsStale(state: BuildState): boolean {
  if (state.countsBuiltAt === null) return true;
  return state.documentsChangedAt !== null && state.documentsChangedAt > state.countsBuiltAt;
}

/** How old the last full rebuild may be: the nightly one runs every 24 hours. */
export const FULL_REBUILD_MAX_AGE_HOURS = 26;

/**
 * Why a full rebuild is due: the table is empty, none was ever completed, or the last is older than 26 hours (the
 * nightly one did not run, or failed). Undefined when none is.
 */
export function fullRebuildDue(state: BuildState): 'empty' | 'never' | 'old' | undefined {
  if (state.documents === 0) return 'empty';
  if (state.fullRebuildAt === null) return 'never';
  const ageHours = (state.now.getTime() - state.fullRebuildAt.getTime()) / 3_600_000;
  return ageHours > FULL_REBUILD_MAX_AGE_HOURS ? 'old' : undefined;
}
