// The options of the filters whose values are rows, not code (CS-58 criterion 3): makes, models, trims, body types,
// cities, districts and sources, each only when active listings have it (the owner, 2026-09-30: a body type is offered
// only when there are listings of it), with how many. A new source or body type is a row, never a code change. One
// grouped scan of listing_filter_row's active rows; the keys and labels come from the catalogue's own rows.
import { sql, type Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';
import type { DatabaseOptions } from './kinds.ts';

export type FilterOption = {
  readonly value: string;
  /** The Persian name, else the English one (a make the catalogue has not named in Persian yet). */
  readonly label: string;
  /** Active listings with this value. */
  readonly count: number;
};

export type DatabaseFilterOptions = Readonly<Record<DatabaseOptions, readonly FilterOption[]>>;

type KnownRow = {
  readonly value: string;
  readonly label: string;
  readonly position: number | null;
  readonly count: number;
};

// The grouping sets, one per database-backed filter, and the columns grouping() reads, in one order. A set's number
// (grouping() sets the bit of every column the set leaves out, the first column the highest bit) is computed from
// this list, so adding, removing or reordering a set cannot silently mislabel the groups.
const COUNTED_SETS = [
  { kind: 'make', columns: ['make_id'] },
  { kind: 'model', columns: ['model_id'] },
  { kind: 'trim', columns: ['trim_id'] },
  { kind: 'body_type', columns: ['body_type'] },
  { kind: 'city', columns: ['city_id'] },
  { kind: 'district', columns: ['city_id', 'district_fa'] },
  { kind: 'source', columns: ['source_id'] },
] as const satisfies readonly { kind: DatabaseOptions; columns: readonly string[] }[];
const COUNTED_COLUMNS = [...new Set(COUNTED_SETS.flatMap((set) => set.columns))];

/** grouping()'s number for a set of columns, as PostgreSQL computes it over COUNTED_COLUMNS. */
export function groupingNumber(columns: readonly string[]): number {
  return COUNTED_COLUMNS.reduce(
    (bits, column, index) =>
      columns.includes(column) ? bits : bits | (1 << (COUNTED_COLUMNS.length - 1 - index)),
    0,
  );
}

const KIND_BY_GROUPING = new Map(COUNTED_SETS.map((set) => [groupingNumber(set.columns), set.kind]));

type CountedRow = {
  sets: number;
  count: number;
  body_type: string | null;
  district_fa: string | null;
  source_id: string | null;
  make_slug: string | null;
  make_fa: string | null;
  make_en: string | null;
  model_make_slug: string | null;
  model_slug: string | null;
  model_fa: string | null;
  model_en: string | null;
  trim_make_slug: string | null;
  trim_model_slug: string | null;
  trim_slug: string | null;
  trim_fa: string | null;
  trim_en: string | null;
  body_fa: string | null;
  body_position: number | null;
  city_slug: string | null;
  city_fa: string | null;
  source_fa: string | null;
};

// The value and label of a counted group; the keys are built as listing_filter_row builds them. Null when the group
// is of listings without that value (not matched to the catalogue, no district), which is not an option.
function optionOf(kind: DatabaseOptions, row: CountedRow): KnownRow | null {
  const known = (value: string | null, label: string | null, position: number | null = null) =>
    value === null || label === null ? null : { value, label, position, count: row.count };
  const join = (...parts: (string | null)[]) => (parts.includes(null) ? null : parts.join('.'));
  switch (kind) {
    case 'make':
      return known(row.make_slug, row.make_fa ?? row.make_en);
    case 'model':
      return known(join(row.model_make_slug, row.model_slug), row.model_fa ?? row.model_en);
    case 'trim':
      return known(join(row.trim_make_slug, row.trim_model_slug, row.trim_slug), row.trim_fa ?? row.trim_en);
    case 'body_type':
      return known(row.body_type, row.body_fa, row.body_position);
    case 'city':
      return known(row.city_slug, row.city_fa);
    case 'district':
      return known(join(row.city_slug, row.district_fa), row.district_fa);
    case 'source':
      return known(row.source_id, row.source_fa);
  }
}

/** Every database-backed filter's options: body types in the catalogue's order, the others most listed first. */
export async function readFilterOptions(db: Kysely<DB>): Promise<DatabaseFilterOptions> {
  // Counted by ids first (the view then skips its catalogue joins: 42 ms against 155 ms over 23,364 listings on
  // 2026-10-01), then each group is named.
  const column = (name: string) => sql.ref(`r.${name}`);
  const { rows } = await sql<CountedRow>`
    WITH counted AS (
      SELECT grouping(${sql.join(COUNTED_COLUMNS.map(column))}) AS sets,
             ${sql.join(COUNTED_COLUMNS.map(column))},
             count(*)::integer AS count
      FROM listing_filter_row r
      WHERE r.status = 'active'
      GROUP BY GROUPING SETS (${sql.join(COUNTED_SETS.map((set) => sql`(${sql.join(set.columns.map(column))})`))})
    )
    SELECT c.sets, c.count, c.body_type, c.district_fa, c.source_id,
           mk.slug AS make_slug, mk.name_fa AS make_fa, mk.name_en AS make_en,
           mmk.slug AS model_make_slug, m.slug AS model_slug, m.name_fa AS model_fa, m.name_en AS model_en,
           tmk.slug AS trim_make_slug, tm.slug AS trim_model_slug, t.slug AS trim_slug, t.name_fa AS trim_fa,
           t.name_en AS trim_en,
           b.label_fa AS body_fa, b.position::integer AS body_position,
           city.slug AS city_slug, city.name_fa AS city_fa,
           s.name_fa AS source_fa
    FROM counted c
    LEFT JOIN make mk ON mk.id = c.make_id
    LEFT JOIN model m ON m.id = c.model_id
    LEFT JOIN make mmk ON mmk.id = m.make_id
    LEFT JOIN "trim" t ON t.id = c.trim_id
    LEFT JOIN model tm ON tm.id = t.model_id
    LEFT JOIN make tmk ON tmk.id = tm.make_id
    LEFT JOIN body_type b ON b.code = c.body_type
    LEFT JOIN city ON city.id = c.city_id
    LEFT JOIN source s ON s.id = c.source_id`.execute(db);

  const options: Record<DatabaseOptions, KnownRow[]> = {
    make: [],
    model: [],
    trim: [],
    body_type: [],
    city: [],
    district: [],
    source: [],
  };
  for (const row of rows) {
    const kind = KIND_BY_GROUPING.get(row.sets);
    if (kind === undefined)
      throw new Error(`a grouping set numbered ${String(row.sets)} that no filter names`);
    const option = optionOf(kind, row);
    if (option !== null) options[kind].push(option);
  }
  const byCount = (a: KnownRow, b: KnownRow) => b.count - a.count || a.label.localeCompare(b.label, 'fa');
  const byPosition = (a: KnownRow, b: KnownRow) => (a.position ?? 0) - (b.position ?? 0);
  const plain = ({ value, label, count }: KnownRow): FilterOption => ({ value, label, count });
  return {
    make: options.make.sort(byCount).map(plain),
    model: options.model.sort(byCount).map(plain),
    trim: options.trim.sort(byCount).map(plain),
    body_type: options.body_type.sort(byPosition).map(plain),
    city: options.city.sort(byCount).map(plain),
    district: options.district.sort(byCount).map(plain),
    source: options.source.sort(byCount).map(plain),
  };
}
