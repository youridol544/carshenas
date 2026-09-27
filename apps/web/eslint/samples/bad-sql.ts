// path: src/server/db/lint-selftest-sql.ts
// expect: no-restricted-syntax
// expect-message: SQL built by string concatenation
// expect-message: Values interpolated into SQL text
// expect-message: sql.raw sends text
import 'server-only';
import { sql } from 'kysely';

export function unsafeStatements(key: string, table: string) {
  const concatenated = "SELECT id FROM listing WHERE source_listing_key = '" + key + "'";
  const interpolated = `UPDATE listing SET status = '${key}' WHERE id = 1`;
  const raw = sql.raw(table);
  return { concatenated, interpolated, raw };
}
