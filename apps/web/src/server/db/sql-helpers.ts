import 'server-only';
import { sql, type RawBuilder } from 'kysely';

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
  instant: RawBuilder<Date | null>,
  filter: RawBuilder<boolean>,
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

// Search (CS-59).

/** A buyer's words as the tsquery search_tsquery() builds, as text to pass on as a constant; null when none is left. */
export function searchTsquery(words: string): RawBuilder<string | null> {
  return sql<string | null>`search_tsquery(${words})::text`;
}

/** A catalogue row's Persian name, else its English one: `coalesce(alias.name_fa, alias.name_en)`. */
export function nameOf(alias: string): RawBuilder<string | null> {
  return sql<string | null>`coalesce(${sql.ref(`${alias}.name_fa`)}, ${sql.ref(`${alias}.name_en`)})`;
}

/** A column named at run time (a filter definition's column), as text: `alias.column::text`. */
export function columnText(alias: string, column: string): RawBuilder<string | null> {
  return sql<string | null>`${sql.ref(`${alias}.${column}`)}::text`;
}

/** A column named at run time has a value: `alias.column IS NOT NULL`. */
export function columnPresent(alias: string, column: string): RawBuilder<boolean> {
  return sql<boolean>`${sql.ref(`${alias}.${column}`)} IS NOT NULL`;
}

/** A column named at run time, to group by. */
export function columnRef(alias: string, column: string): RawBuilder<unknown> {
  return sql`${sql.ref(`${alias}.${column}`)}`;
}

/** A string as a text value of the row: `$1::text`. */
export function textValue(value: string): RawBuilder<string> {
  return sql<string>`${value}::text`;
}
