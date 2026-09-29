import { PgBoss } from 'pg-boss';
import type { ErrorCapture } from '@carshenas/observability/capture';
import type { Logger } from '@carshenas/observability/logger';

// pg-boss for the worker (ADR-0011 point 5, ADR-0018 point 7). Its schema is installed and upgraded by migrations
// (db/migrations, `pgboss:sql`), so pg-boss only checks the installed version on start; the worker's role has row
// access only, so the maintenance that needs ownership (rebuilding bloated indexes) is off. Queue statistics are not
// persisted: they would need a new partition every day.

export type BossOptions = {
  /** The worker's own role: carshenas_worker. */
  readonly connectionString: string;
  readonly logger: Logger;
  readonly errors: ErrorCapture;
  /** How long the same error from pg-boss is logged only once: a poll that fails every second says so once. */
  readonly repeatedErrorWindowMs?: number;
};

export function createBoss(options: BossOptions): PgBoss {
  const boss = new PgBoss({
    connectionString: options.connectionString,
    application_name: 'carshenas-worker-queue',
    // Beside the worker's own pool of four: the web app's five and these stay far under max_connections (50).
    max: 4,
    schema: 'pgboss',
    migrate: false,
    createSchema: false,
    reindex: false,
  });
  const log = options.logger.child({ component: 'queue' });
  const window = options.repeatedErrorWindowMs ?? 60_000;
  const lastLogged = new Map<string, { at: number; repeats: number }>();
  boss.on('error', (error) => {
    // pg-boss retries its polls and maintenance by itself; what matters is that a person sees the failure once.
    const now = performance.now();
    const seen = lastLogged.get(error.message);
    if (seen && now - seen.at < window) {
      seen.repeats += 1;
      return;
    }
    lastLogged.set(error.message, { at: now, repeats: 0 });
    options.errors.capture(error, {
      message: 'job queue error',
      fields: { component: 'queue', ...(seen && { repeatsSinceLastLine: seen.repeats }) },
    });
  });
  boss.on('warning', (warning) => {
    log.warn('job queue warning', { warning: warning.message, detail: warning.data });
  });
  return boss;
}
