// The orders a search can show its results in (CS-58; CS-59 criterion 1). Best deal first is CarGurus's default and
// ours: the listings furthest below their market value lead, and unrated listings follow in the order of their newest
// posting. Every order ends on listing_id, so keyset pagination has a total order.
import type { Column } from './kinds.ts';

/** The PostgreSQL type of an order's column: what a keyset cursor's text is checked against and cast to (CS-59). */
export type SortType = 'numeric' | 'timestamptz' | 'smallint' | 'integer' | 'bigint';

export type OrderTerm = {
  readonly column: Column;
  readonly direction: 'asc' | 'desc';
  /** Rows without a value go last, whatever the direction. */
  readonly nullsLast: true;
  readonly type: SortType;
  /**
   * The column is NOT NULL in search_document. A keyset page after such a term can compare rows
   * ((listed_at, listing_id) < (…)), which an index range scan can start from; a nullable term needs its null tail
   * named apart (sql.ts, searchAfterBranches).
   */
  readonly notNull: boolean;
};

export type Sort = {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  /** Words buyers write for it (CS-62). */
  readonly words: readonly string[];
  readonly orderBy: readonly OrderTerm[];
};

function by(
  column: Column,
  direction: 'asc' | 'desc',
  type: SortType,
  options: { readonly notNull?: true } = {},
): OrderTerm {
  return { column, direction, nullsLast: true, type, notNull: options.notNull === true };
}

export const SORTS = [
  {
    id: 'best_deal',
    label: 'بهترین معامله',
    description: 'آگهی‌هایی که بیشتر از همه زیر ارزش بازارند اول می‌آیند؛ آگهی‌های بدون ارزیابی آخر.',
    words: ['بهترین معامله', 'ارزان‌ترین نسبت به بازار'],
    orderBy: [
      by('price_gap_pct', 'asc', 'numeric'),
      by('listed_at', 'desc', 'timestamptz', { notNull: true }),
    ],
  },
  {
    id: 'price_asc',
    label: 'ارزان‌ترین',
    description: 'کمترین قیمت اول؛ آگهی‌های توافقی و قسطی آخر.',
    words: ['ارزان‌ترین', 'ارزان'],
    orderBy: [by('asking_price_toman', 'asc', 'bigint')],
  },
  {
    id: 'price_desc',
    label: 'گران‌ترین',
    description: 'بیشترین قیمت اول؛ آگهی‌های توافقی و قسطی آخر.',
    words: ['گران‌ترین'],
    orderBy: [by('asking_price_toman', 'desc', 'bigint')],
  },
  {
    id: 'mileage_asc',
    label: 'کم‌کارکردترین',
    description: 'کمترین کارکرد اول.',
    words: ['کم‌کارکردترین', 'کمترین کارکرد'],
    orderBy: [by('mileage_km', 'asc', 'integer')],
  },
  {
    id: 'newest',
    label: 'جدیدترین آگهی',
    description: 'تازه‌ترین آگهی‌ها اول.',
    words: ['جدیدترین', 'تازه‌ترین'],
    orderBy: [by('listed_at', 'desc', 'timestamptz', { notNull: true })],
  },
  {
    id: 'year_desc',
    label: 'جدیدترین مدل',
    description: 'بالاترین سال ساخت اول.',
    words: ['مدل بالا', 'جدیدترین مدل'],
    orderBy: [by('model_year_sh', 'desc', 'smallint')],
  },
] as const satisfies readonly Sort[];

export type SortId = (typeof SORTS)[number]['id'];
export const SORT_IDS = SORTS.map((sort) => sort.id) as [SortId, ...SortId[]];
export const DEFAULT_SORT: SortId = 'best_deal';

export function sortById(id: SortId): Sort {
  const sort = SORTS.find((candidate) => candidate.id === id);
  if (sort === undefined) throw new RangeError(`no sort ${id}`);
  return sort;
}
