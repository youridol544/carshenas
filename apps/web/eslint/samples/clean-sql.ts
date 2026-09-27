// path: src/server/db/lint-selftest-clean.ts
// expect: (none)
import 'server-only';
import { sql } from 'kysely';
import { readDatabase } from '@/server/db/database';

// Parameters everywhere: the builder and the sql tag send values separately from the SQL text. English prose that
// starts like a keyword ("Update failed", "With ...") is not SQL and must not trip the selectors.
export async function listingUrlByKey(sourceId: string, key: string) {
  return readDatabase()
    .selectFrom('listing')
    .select(['id', 'url'])
    .where('source_id', '=', sourceId)
    .where('source_listing_key', '=', key)
    .executeTakeFirst();
}

export function seenWithin(days: number) {
  return sql<boolean>`last_seen_at > now() - make_interval(days => ${days})`;
}

export function describeFailure(message: string) {
  return { log: `Update failed: ${message}`, note: 'With ' + message, status: sql.lit('running') };
}
