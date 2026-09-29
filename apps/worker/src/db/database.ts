import type { Kysely } from 'kysely';
import { createDatabase } from '@carshenas/db/database';
import type { DB } from '@carshenas/db/db-types';
import { createQueryLog } from '@carshenas/db/query-log';
import type { ErrorCapture } from '@carshenas/observability/capture';
import type { Logger } from '@carshenas/observability/logger';

// The worker's pool (ADR-0012), as carshenas_worker, whose role carries its timeouts (db/bootstrap/10-roles.sql).
// pg-boss keeps a pool of its own (runtime/boss.ts). Closed on shutdown, after pg-boss has drained.

export type WorkerDatabaseSettings = {
  readonly connectionString: string;
  /** CARSHENAS_LOG_SQL=1: a debug line per statement. */
  readonly logSql: boolean;
  /** Parameters on those lines, in development only. */
  readonly logParameters: boolean;
};

export function createWorkerDatabase(
  settings: WorkerDatabaseSettings,
  logger: Logger,
  errors: ErrorCapture,
): Kysely<DB> {
  return createDatabase({
    connectionString: settings.connectionString,
    applicationName: 'carshenas-worker',
    max: 4,
    log: createQueryLog(logger.child({ component: 'db' }), () => ({
      logSql: settings.logSql,
      logParameters: settings.logParameters,
    })),
    onIdleError: (error) => {
      errors.capture(error, { message: 'idle database connection failed', fields: { component: 'db' } });
    },
  });
}
