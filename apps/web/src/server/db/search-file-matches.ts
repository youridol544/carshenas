import 'server-only';
import type { ReadonlyKysely } from 'kysely/readonly';
import type { DB } from '@carshenas/db/db-types';
import type { Search } from '@carshenas/search/search';
import { searchableWhere, searchQuerySql } from '@carshenas/search/sql';

// How many cars a search file finds now, and how many are new to its buyer (CS-70, ADR-0031): one read for the buyer's
// own pages and for the superadmin's list, each with its own database role (the handle is the caller's). The matches
// are never stored: they are read from search_document with searchableWhere(), the one function the search page, the
// API and the matching job (CS-72) share, so a file finds exactly what the search page shows. A car is new when
// Carshenas first saw it (listing.created_at) after the file's viewed_at. Counted up to a cap, so a broad search costs
// a few milliseconds, not a scan of every match.

/** The alias search_document is read under, which the package's SQL helpers are given. */
const ALIAS = 'r';

export type FileMatchCounts = {
  readonly matches: { readonly count: number; readonly exact: boolean };
  /** Matches first seen since the file was last viewed; counted within the same cap. */
  readonly newCount: number;
};

export async function countFileMatches(
  db: ReadonlyKysely<DB>,
  fileId: number,
  search: Search,
  cap: number,
): Promise<FileMatchCounts> {
  const plan =
    search.q === undefined
      ? undefined
      : await db.selectFrom(searchQuerySql(search.q).as('q')).selectAll().executeTakeFirst();
  const where = searchableWhere(
    { filters: search.filters, tsquery: plan?.tsquery_text ?? null },
    { alias: ALIAS, now: new Date() },
  );
  // Two reads, each stopped at the cap: the matches, and the new ones among all matches. Counting the new ones inside
  // the first cap's rows would count only the arbitrary first thousand, and miss a new car further down.
  const capped = (onlyNew: boolean) =>
    db
      .selectFrom((eb) =>
        eb
          .selectFrom('search_document as r')
          .innerJoin('listing as l', 'l.id', 'r.listing_id')
          .select((inner) => inner.lit(1).as('one'))
          .where(where)
          .$if(onlyNew, (query) =>
            query.where((inner) =>
              inner(
                'l.created_at',
                '>',
                inner.selectFrom('search_file as f').select('f.viewed_at').where('f.id', '=', fileId),
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
