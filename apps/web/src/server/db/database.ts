import 'server-only';
import type { Kysely } from 'kysely';
import type { ReadonlyKysely } from 'kysely/readonly';
import { createDatabase } from '@carshenas/db/database';
import type { DB } from '@carshenas/db/db-types';
import { createQueryLog } from '@carshenas/db/query-log';
import { env } from '@/server/env';
import { captureError, logger } from '@/server/observability/logger';

// The web app's only way into PostgreSQL (ADR-0012): one pool per process, created on first use, as carshenas_web.
// The factory, the generated types and the statement log are shared with the worker (packages/db). Nothing outside
// src/server/db imports pg, constructs Kysely or opens a pool (lint). The database skill (.claude/skills/database)
// has the rules for queries built on it.

/**
 * Every statement passes through here: a slow one is a warning; CARSHENAS_LOG_SQL=1 adds a debug line for each one,
 * with its parameters only in development, because parameters can hold personal data.
 */
export const logQuery = createQueryLog(logger.child({ component: 'db' }), () => ({
  logSql: env.logSql,
  logParameters: env.isDevelopment && env.logSql,
}));

function createWebDatabase(): Kysely<DB> {
  return createDatabase({
    connectionString: env.databaseUrl,
    applicationName: 'carshenas-web',
    max: 5,
    log: logQuery,
    onIdleError: (error) => {
      captureError(error, { message: 'idle database connection failed', fields: { component: 'db' } });
    },
  });
}

// Cached on globalThis so that hot reloading in development reuses the pool instead of opening a new one per edit.
const globalForDatabase = globalThis as typeof globalThis & { carshenasDatabase?: Kysely<DB> };

/** The database for writes: mutations and transactions (`database().transaction().execute(async (trx) => …)`). */
export function database(): Kysely<DB> {
  globalForDatabase.carshenasDatabase ??= createWebDatabase();
  return globalForDatabase.carshenasDatabase;
}

/** The same database typed read-only: `*-queries.ts` use this, so an insert there fails type-checking. */
export function readDatabase(): ReadonlyKysely<DB> {
  // ReadonlyKysely is a type-level view of the same instance; Kysely's own documentation converts with `as never`.
  return database() as unknown as ReadonlyKysely<DB>;
}
