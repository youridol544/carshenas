import 'server-only';
import type { Kysely } from 'kysely';
import { database } from '@/server/db/database';
import type { DB } from '@/server/db/db-types';
import { logger } from '@/server/observability/logger';

export type DatabaseHealth = { migration: string | null; latencyMs: number };

/**
 * A real query through the app's own pool and role, not a ping: it proves the web app can connect, authenticate as
 * carshenas_web and read, and it reports the newest applied migration so a deploy can see the schema it runs on.
 */
export async function checkDatabaseHealth(db: Kysely<DB> = database()): Promise<DatabaseHealth> {
  const started = performance.now();
  const row = await db
    .selectFrom('schema_migrations')
    .select((eb) => eb.fn.max<string | null>('version').as('migration'))
    .executeTakeFirstOrThrow();
  return { migration: row.migration, latencyMs: Math.round(performance.now() - started) };
}

const NO_STORE = { 'Cache-Control': 'no-store' };

/** GET /api/health: 200 with the migration when the database answers, 503 without details when it does not. */
export async function databaseHealthResponse(db?: Kysely<DB>): Promise<Response> {
  try {
    const health = await checkDatabaseHealth(db);
    return Response.json({ status: 'ok', database: health }, { headers: NO_STORE });
  } catch (error) {
    logger.error('database health check failed', { component: 'health', err: error });
    return Response.json({ status: 'unavailable' }, { status: 503, headers: NO_STORE });
  }
}
