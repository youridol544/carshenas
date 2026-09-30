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

type OptionRow = {
  kind: DatabaseOptions;
  value: string | null;
  label: string;
  position: number | null;
  count: number;
};

type KnownRow = OptionRow & { value: string };

/** Every database-backed filter's options: body types in the catalogue's order, the others most listed first. */
export async function readFilterOptions(db: Kysely<DB>): Promise<DatabaseFilterOptions> {
  // Counted by ids first (the view then skips its catalogue joins: 42 ms against 155 ms over 23,364 listings on
  // 2026-10-01), then each group is named. The keys are built as listing_filter_row builds them.
  const { rows } = await sql<OptionRow>`
    WITH counted AS (
      SELECT grouping(r.make_id, r.model_id, r.trim_id, r.body_type, r.city_id, r.district_fa, r.source_id) AS sets,
             r.make_id, r.model_id, r.trim_id, r.body_type, r.city_id, r.district_fa, r.source_id,
             count(*)::integer AS count
      FROM listing_filter_row r
      WHERE r.status = 'active'
      GROUP BY GROUPING SETS ((r.make_id), (r.model_id), (r.trim_id), (r.body_type), (r.city_id), (r.district_fa),
                             (r.source_id))
    )
    SELECT CASE c.sets WHEN 63 THEN 'make' WHEN 95 THEN 'model' WHEN 111 THEN 'trim' WHEN 119 THEN 'body_type'
                       WHEN 123 THEN 'city' WHEN 125 THEN 'district' ELSE 'source' END AS kind,
           CASE c.sets
             WHEN 63 THEN mk.slug
             WHEN 95 THEN mmk.slug || '.' || m.slug
             WHEN 111 THEN tmk.slug || '.' || tm.slug || '.' || t.slug
             WHEN 119 THEN c.body_type
             WHEN 123 THEN city.slug
             WHEN 125 THEN c.district_fa
             ELSE c.source_id
           END AS value,
           coalesce(mk.name_fa, mk.name_en, m.name_fa, m.name_en, t.name_fa, t.name_en, b.label_fa, city.name_fa,
                    c.district_fa, s.name_fa) AS label,
           b.position::integer AS position,
           c.count
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
  // A group whose key is null (listings the catalogue could not match, or that named no district) is not an option.
  for (const row of rows) if (row.value !== null) options[row.kind].push({ ...row, value: row.value });
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
