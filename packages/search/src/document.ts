// The search table, built (CS-59, ADR-0027): search_document holds listing_filter_row's columns for every searchable
// listing, so the predicates of sql.ts run on it unchanged, plus what a result card and the text search need. A
// listing is searchable when it is active, from a public source, of a tracked model and seen within the freshness
// window. One statement builds the rows of a set of listings, or of all of them, by writing only the rows whose
// values changed and removing those that stopped being searchable; readers never wait and never see a half-built
// table. The worker runs it for the listings the triggers mark (search.refresh) and for all (search.rebuild,
// `pnpm search:rebuild`), then refreshes the counts pages read (search_facet_count) and the typo vocabulary
// (search_word). Runs in Node only.
import { sql, type Kysely, type RawBuilder } from 'kysely';
import type { DB, SearchFacetCount } from '@carshenas/db/db-types';
import { CATALOGUES } from './catalogues.ts';
import { SEARCH_FRESHNESS_HOURS } from './freshness.ts';
import type { Column } from './kinds.ts';
import { readFilterOptions, type DatabaseFilterOptions } from './options-queries.ts';
import { catalogueSearch } from './search.ts';
import { searchWhere } from './sql.ts';
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

/** Which listings to build: those named (the ones the triggers marked), or every listing. */
export type BuildScope = { readonly listingIds: readonly number[] } | 'all';

export type BuildOptions = {
  readonly scope: BuildScope;
  /** The catalogue ids of the tracked models (ADR-0017 point 4); a listing of another model is not searchable. */
  readonly trackedModelIds: readonly number[];
  /** Today, for a car's age in km_per_year. Defaults to the process's clock. */
  readonly now?: Date;
};

export type BuildResult = {
  /** Rows inserted or changed. */
  readonly written: number;
  /** Rows removed: the listing stopped being searchable (sold, expired, untracked, not seen for 48 hours). */
  readonly removed: number;
};

function columnList(prefix: string | null, columns: readonly string[]): RawBuilder<unknown> {
  return sql.join(columns.map((column) => sql.ref(prefix === null ? column : `${prefix}.${column}`)));
}

/**
 * Builds search_document's rows for the scope in one statement: rows whose values changed are written, rows that are
 * no longer searchable are removed, and so are rows of any listing not seen within the freshness window. Call it in
 * a transaction holding lockSearchBuild(), so two builds never interleave.
 */
export async function buildSearchDocuments(db: Kysely<DB>, options: BuildOptions): Promise<BuildResult> {
  const ids = options.scope === 'all' ? null : options.scope.listingIds;
  const year = solarHijriYear(options.now ?? new Date());
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
        AND r.model_id = any(${[...options.trackedModelIds]}::bigint[])
        AND r.last_seen_at >= now() - make_interval(hours => ${SEARCH_FRESHNESS_HOURS})
        AND (${ids === null ? null : [...ids]}::bigint[] IS NULL
             OR r.listing_id = any(${ids === null ? null : [...ids]}::bigint[]))
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
      WHERE (${ids === null ? null : [...ids]}::bigint[] IS NULL
             OR d.listing_id = any(${ids === null ? null : [...ids]}::bigint[])
             OR d.last_seen_at < now() - make_interval(hours => ${SEARCH_FRESHNESS_HOURS}))
        AND NOT EXISTS (SELECT FROM wanted w WHERE w.listing_id = d.listing_id)
      RETURNING 1
    )
    SELECT (SELECT count(*) FROM written)::integer AS written, (SELECT count(*) FROM removed)::integer AS removed`.execute(
    db,
  );
  const row = rows[0];
  return { written: row?.written ?? 0, removed: row?.removed ?? 0 };
}

// One key for every build, so a refresh and a rebuild never interleave: 'search_document' as a number.
const BUILD_LOCK = 5_391_027_311;

/** Waits for, then holds until the transaction ends, the lock every build of search_document takes. */
export async function lockSearchBuild(db: Kysely<DB>): Promise<void> {
  await sql`SELECT pg_advisory_xact_lock(${BUILD_LOCK}::bigint)`.execute(db);
}

/**
 * Takes up to `limit` listings the triggers marked, in listing order, and removes their marks: in the caller's
 * transaction, so a failed build leaves them marked. Marks held by another transaction are skipped.
 */
export async function takeStaleListings(db: Kysely<DB>, limit: number): Promise<number[]> {
  const { rows } = await sql<{ listing_id: number }>`
    DELETE FROM search_document_stale
    WHERE listing_id IN (
      SELECT s.listing_id FROM search_document_stale s ORDER BY s.listing_id LIMIT ${limit} FOR UPDATE SKIP LOCKED)
    RETURNING listing_id`.execute(db);
  return rows.map((row) => row.listing_id);
}

/** The catalogue ids of a source's tracked models, from their keys on the source (Divar's brand_model values). */
export async function trackedModelIds(
  db: Kysely<DB>,
  sourceId: string,
  sourceModelKeys: readonly string[],
): Promise<number[]> {
  const rows = await db
    .selectFrom('catalogue_source_key')
    .select('model_id')
    .where('source_id', '=', sourceId)
    .where('level', '=', 'model')
    .where('source_model_key', 'in', [...sourceModelKeys])
    .orderBy('model_id')
    .execute();
  return rows.flatMap((row) => (row.model_id === null ? [] : [row.model_id]));
}

export type FacetCounts = {
  readonly total: number;
  readonly catalogues: Readonly<Record<string, number>>;
  readonly options: DatabaseFilterOptions;
};

/** Counts what search_facet_count holds, from search_document: the total, each catalogue, each option. */
export async function countFacets(db: Kysely<DB>, now: Date = new Date()): Promise<FacetCounts> {
  const options = await readFilterOptions(db, 'search_document');
  const catalogues: Record<string, number> = {};
  for (const catalogue of CATALOGUES) {
    const row = await db
      .selectFrom('search_document as r')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where(searchWhere(catalogueSearch(catalogue.id).filters, { alias: 'r', now }))
      .executeTakeFirstOrThrow();
    catalogues[catalogue.id] = row.count;
  }
  const total = await db
    .selectFrom('search_document')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .executeTakeFirstOrThrow();
  return { total: total.count, catalogues, options };
}

/** Replaces search_facet_count with the counts: in the caller's transaction, so pages see the old or the new set. */
export async function writeFacetCounts(db: Kysely<DB>, counts: FacetCounts): Promise<void> {
  type Row = {
    facet: SearchFacetCount['facet'];
    value: string;
    label_fa: string;
    position: number;
    listing_count: number;
  };
  const rows: Row[] = [{ facet: 'total', value: '', label_fa: 'همه', position: 0, listing_count: counts.total }];
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
      rows.push({ facet, value: option.value, label_fa: option.label, position, listing_count: option.count });
    });
  }
  await db.deleteFrom('search_facet_count').execute();
  const now = new Date();
  for (let start = 0; start < rows.length; start += 500) {
    await db
      .insertInto('search_facet_count')
      .values(
        rows.slice(start, start + 500).map((row) => ({ ...row, refreshed_at: now })),
      )
      .execute();
  }
}

/** Rebuilds the typo vocabulary from search_document's words: rows for new words, counts changed, gone words removed. */
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
  return { words: rows[0]?.words ?? 0 };
}
