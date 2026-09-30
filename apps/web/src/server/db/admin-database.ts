import 'server-only';
import type { Kysely } from 'kysely';
import type { ReadonlyKysely } from 'kysely/readonly';
import { createDatabase } from '@carshenas/db/database';
import type { DB } from '@carshenas/db/db-types';
import { logQuery } from '@/server/db/database';
import type { PgbossTables } from '@/server/db/pgboss-types';
import { env } from '@/server/env';
import { captureError } from '@/server/observability/logger';

// The superadmin section's own way into PostgreSQL (ADR-0023): a second, small pool, as carshenas_admin, which reads
// what the section shows and changes a curated row only through a function that records the superadmin who changed
// it. Only src/features/admin imports this file (lint); every other page reads and writes as carshenas_web, through
// database() and readDatabase(). One superadmin uses it, so two connections are plenty.

function createAdminDatabase(): Kysely<DB> {
  return createDatabase({
    connectionString: env.adminDatabaseUrl,
    applicationName: 'carshenas-admin',
    max: 2,
    log: logQuery,
    onIdleError: (error) => {
      captureError(error, { message: 'idle database connection failed', fields: { component: 'admin-db' } });
    },
  });
}

// Cached on globalThis so that hot reloading in development reuses the pool instead of opening a new one per edit.
const globalForAdminDatabase = globalThis as typeof globalThis & { carshenasAdminDatabase?: Kysely<DB> };

/** The section's database for changes: its mutations call the functions its role may execute. */
export function adminDatabase(): Kysely<DB> {
  globalForAdminDatabase.carshenasAdminDatabase ??= createAdminDatabase();
  return globalForAdminDatabase.carshenasAdminDatabase;
}

/** What the section reads: the public schema, and the job queue's tables its role may read (CS-41). */
export type AdminDB = DB & PgbossTables;

/** The same database typed read-only, for the section's `*-queries.ts`, with the job queue's tables. */
export function readAdminDatabase(): ReadonlyKysely<AdminDB> {
  // ReadonlyKysely is a type-level view of the same instance; Kysely's own documentation converts with `as never`.
  return adminDatabase() as unknown as ReadonlyKysely<AdminDB>;
}
