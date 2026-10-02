import 'server-only';
import { sql, type AliasedRawBuilder, type Expression, type RawBuilder, type SqlBool } from 'kysely';

// The only home of `sql` fragments in the web app (ADR-0012, the database skill's kysely.md): what Kysely's builder
// does not express, each named and tested in sql-helpers.db.test.ts. Times come from the database's clock, so stored
// times and the times compared with them never disagree because a server's clock drifted.

/** The transaction's start time, `now()`. */
export function databaseNow(): RawBuilder<Date> {
  return sql<Date>`now()`;
}

/** `now()` plus a number of seconds. */
export function secondsFromNow(seconds: number): RawBuilder<Date> {
  return sql<Date>`now() + make_interval(secs => ${seconds})`;
}

/** `now()` minus a number of seconds. */
export function secondsAgo(seconds: number): RawBuilder<Date> {
  return sql<Date>`now() - make_interval(secs => ${seconds})`;
}

/** Today's date in Tehran, the day a source's request budget is counted on (ADR-0017 point 5). */
export function tehranToday(): RawBuilder<Date> {
  return sql<Date>`(now() AT TIME ZONE 'Asia/Tehran')::date`;
}

/** The average number of seconds from one instant column to another, over the rows of a group; null when none. */
export function averageSecondsBetween(from: string, to: string): RawBuilder<number | null> {
  return sql<number | null>`avg(extract(epoch FROM ${sql.ref(to)} - ${sql.ref(from)}))::float8`;
}

/**
 * `column IN ('a', 'b')` with the values as literals in the SQL text, never parameters, so a partial index whose
 * predicate is that same list serves the query (the database skill: a partial index's predicate is a literal).
 */
export function inLiterals(column: string, values: readonly string[]): RawBuilder<boolean> {
  return sql<boolean>`${sql.ref(column)} IN (${sql.join(values.map((value) => sql.lit(value)))})`;
}

/**
 * The median, in whole minutes, of how long ago an instant was, over the rows of a group that pass `filter`; null when
 * none does. Measured from now(), the database's clock.
 */
export function medianMinutesSince(
  instant: Expression<Date | null>,
  filter: Expression<SqlBool>,
): RawBuilder<number | null> {
  return sql<
    number | null
  >`round(percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM now() - ${instant}) / 60)
    FILTER (WHERE ${filter}))::integer`;
}

/** The later of two instant columns, ignoring a null one (PostgreSQL's greatest()). */
export function laterOf(first: string, second: string): RawBuilder<Date | null> {
  return sql<Date | null>`greatest(${sql.ref(first)}, ${sql.ref(second)})`;
}

/** A condition written as a literal comparison, `column = 'value'`, for a FILTER or a partial index's predicate. */
export function equalsLiteral(column: string, value: string): RawBuilder<boolean> {
  return sql<boolean>`${sql.ref(column)} = ${sql.lit(value)}`;
}

/**
 * `ROLLUP (column)` for a GROUP BY: one row per value of the column, then one more for all rows together, whose column
 * is null. Every aggregate, a median included, is computed for both in the one pass.
 */
export function rollup(column: string): RawBuilder<unknown> {
  return sql`ROLLUP (${sql.ref(column)})`;
}

/** A `date` column as its ISO text ('2026-09-30'): the driver would otherwise read it as midnight in the server's zone. */
export function isoDateText(column: string): RawBuilder<string> {
  return sql<string>`to_char(${sql.ref(column)}, 'YYYY-MM-DD')`;
}

/**
 * `(first, second) < (row)`: a keyset page's condition, the rows that sort after a cursor in a descending order on the
 * two columns, where `row` is a subquery selecting the cursor's own two values. A row comparison, so an index on
 * (…, first DESC, second DESC) serves it as one range; Kysely's builder does not type a tuple against a subquery.
 * A subquery that finds no row makes the condition null, so the page is empty.
 */
export function rowsBefore(first: string, second: string, row: Expression<unknown>): RawBuilder<boolean> {
  return sql<boolean>`(${sql.ref(first)}, ${sql.ref(second)}) < (${row})`;
}

// Search (CS-59).

/** A buyer's words as the tsquery search_tsquery() builds, as text to pass on as a constant; null when none is left. */
export function searchTsquery(words: string): RawBuilder<string | null> {
  return sql<string | null>`search_tsquery(${words})::text`;
}

/** A catalogue row's Persian name, else its English one: `coalesce(alias.name_fa, alias.name_en)`. */
export function nameOf(alias: string): RawBuilder<string | null> {
  return sql<string | null>`coalesce(${sql.ref(`${alias}.name_fa`)}, ${sql.ref(`${alias}.name_en`)})`;
}

// The listing page (CS-64).

/** What asking for a listing to be read again came to (the database function request_listing_recheck). */
export type RecheckAnswer = 'recorded' | 'pending' | 'not_needed' | 'capped';

/** `request_listing_recheck(id)`: the one way a page asks for a re-check, with the caps in the database. */
export function requestListingRecheck(listingId: number): RawBuilder<RecheckAnswer> {
  return sql<RecheckAnswer>`request_listing_recheck(${listingId}::bigint)`;
}

// Pasted links (CS-65).

/** A listing's verdict on the latest valuation run, as `paste_rate_listing` returns it. */
export type PastedRating = {
  asking_price_toman: number | null;
  market_value_toman: number | null;
  price_gap_pct: string | null;
  deal_rating: 'great' | 'good' | 'fair' | 'high' | 'overpriced' | null;
  no_rating_reason: string | null;
};

/** `paste_rate_listing(id)`: rates one listing from the stored coefficients, for a listing the daily run did not rate. */
export function pasteRateListing(listingId: number): AliasedRawBuilder<PastedRating, 'rated'> {
  return sql<PastedRating>`paste_rate_listing(${listingId}::bigint)`.as('rated');
}

/** What a pasted token came to (the database function record_paste_request). */
export type PasteAnswer = 'counted' | 'known' | 'wanted' | 'capped' | 'invalid';

/** `record_paste_request(source, token)`: counts model demand or keeps the link as a wanted one, with its cap in the database. */
export function recordPasteRequest(sourceId: string, token: string): RawBuilder<PasteAnswer> {
  return sql<PasteAnswer>`record_paste_request(${sourceId}::text, ${token}::text)`;
}
