import 'server-only';
import type { ReadonlyKysely } from 'kysely/readonly';
import type { DB } from '@carshenas/db/db-types';
import type { Search } from '@carshenas/search/search';
import { searchFileSeenBaseline } from '@/server/db/sql-helpers';
import { searchableWhere, searchPageSql, searchQuerySql, type SearchRead } from '@carshenas/search/sql';

// How many cars a search file finds now, and how many are new to its buyer (CS-70, ADR-0031): one read for the buyer's
// own pages and for the superadmin's list, each with its own database role (the handle is the caller's). The matches
// are never stored: they are read from search_document with searchableWhere(), the one function the search page, the
// API and the matching job (CS-72) share, so a file finds exactly what the search page shows. A car is new when
// it first became searchable (search_document.indexed_at, CS-72) after the file's baseline. Counted up to a cap, so a broad search costs
// a few milliseconds, not a scan of every match.

/** The alias search_document is read under, which the package's SQL helpers are given. */
const ALIAS = 'r';

export type FileMatchCounts = {
  readonly matches: { readonly count: number; readonly exact: boolean };
  /** Matches first seen since the file was last viewed; counted within the same cap. */
  readonly newCount: number;
};

async function readOf(db: ReadonlyKysely<DB>, search: Search): Promise<SearchRead> {
  const plan =
    search.q === undefined
      ? undefined
      : await db.selectFrom(searchQuerySql(search.q).as('q')).selectAll().executeTakeFirst();
  return { filters: search.filters, tsquery: plan?.tsquery_text ?? null };
}

/** What a file's list card shows besides the counts: the newest match's photo and the best deal among the matches. */
export type FileHighlights = {
  /** The newest match's photo address on the source's own host (ADR-0025), or null when it has none. */
  readonly newestPhotoUrl: string | null;
  readonly best: {
    readonly askingPriceToman: number | null;
    readonly dealRating: 'great' | 'good' | 'fair' | 'high' | 'overpriced' | null;
    readonly priceGapPct: number | null;
  } | null;
};

/** The newest match and the best deal, each one row of an indexed order (the page's own SQL, limit 1). */
export async function readFileHighlights(db: ReadonlyKysely<DB>, search: Search): Promise<FileHighlights> {
  const read = await readOf(db, search);
  const context = { alias: ALIAS, now: new Date() };
  const first = (sort: 'newest' | 'best_deal') =>
    db
      .selectFrom(searchPageSql({ read, sort, limit: 1, context }).as('p'))
      .select([
        'p.cover_photo_url',
        'p.cover_thumbnail_url',
        'p.asking_price_toman',
        'p.deal_rating',
        'p.price_gap_pct',
        'p.price_type',
      ])
      .executeTakeFirst();
  const [newest, best] = await Promise.all([first('newest'), first('best_deal')]);
  return {
    newestPhotoUrl: newest === undefined ? null : (newest.cover_thumbnail_url ?? newest.cover_photo_url),
    best:
      best?.price_type !== 'asking'
        ? null
        : {
            askingPriceToman: best.asking_price_toman,
            dealRating: best.deal_rating,
            priceGapPct: best.price_gap_pct === null ? null : Number(best.price_gap_pct),
          },
  };
}

export async function countFileMatches(
  db: ReadonlyKysely<DB>,
  fileId: number,
  search: Search,
  cap: number,
): Promise<FileMatchCounts> {
  const read = await readOf(db, search);
  const where = searchableWhere(read, { alias: ALIAS, now: new Date() });
  // Two reads, each stopped at the cap: the matches, and the new ones among all matches. Counting the new ones inside
  // the first cap's rows would count only the arbitrary first thousand, and miss a new car further down.
  const capped = (onlyNew: boolean) =>
    db
      .selectFrom((eb) =>
        eb
          .selectFrom('search_document as r')
          .select((inner) => inner.lit(1).as('one'))
          .where(where)
          .$if(onlyNew, (query) =>
            query.where((inner) =>
              inner(
                'r.indexed_at',
                '>',
                inner
                  .selectFrom('search_file as f')
                  .select(searchFileSeenBaseline('f').as('baseline'))
                  .where('f.id', '=', fileId),
              ),
            ),
          )
          .limit(cap + 1)
          .as('m'),
      )
      .select((eb) => eb.fn.countAll<number>().as('found'))
      .executeTakeFirstOrThrow();
  const [all, fresh] = await Promise.all([capped(false), capped(true)]);
  const row = { matches: all.found, fresh: fresh.found };
  return {
    matches: row.matches > cap ? { count: cap, exact: false } : { count: row.matches, exact: true },
    newCount: Math.min(row.fresh, cap),
  };
}
