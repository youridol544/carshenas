// path: src/features/lint-selftest/server/lint-selftest-queries.ts
// expect: no-restricted-imports
// expect-message: Only src/server/db talks to the database driver
// expect-message: Kysely values (sql, Kysely, dialects) stay in src/server/db
import 'server-only';
import { sql } from 'kysely';
import pg from 'pg';

export const pool = new pg.Pool();
export const now = sql`now()`;
