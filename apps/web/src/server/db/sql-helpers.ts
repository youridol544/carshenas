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
