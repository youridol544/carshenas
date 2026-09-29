import type { Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';
import type { ErrorCapture } from '@carshenas/observability/capture';
import type { LaneStatus } from './runtime/lanes.ts';

// Whether the worker can do its work (CS-32 criterion 2): a real query through its own pool and role, the job
// queue's schema read through pg-boss, and the runtime running. The lanes are reported, not judged: a source that
// is stopped or cooling down is the worker doing its job.

export type HealthReport =
  | {
      readonly status: 'ok';
      readonly database: { readonly migration: string | null; readonly latencyMs: number };
      readonly queue: { readonly schemaVersion: number | null };
      readonly lanes: readonly LaneStatus[];
    }
  | { readonly status: 'unavailable'; readonly failing: readonly ('database' | 'queue' | 'runtime')[] };

export type HealthSources = {
  readonly db: Kysely<DB>;
  /** pg-boss's installed schema version, read from its own table. */
  readonly queueSchemaVersion: () => Promise<number | null>;
  readonly isRunning: () => boolean;
  readonly lanes: () => readonly LaneStatus[];
  readonly errors: ErrorCapture;
};

async function checkDatabase(db: Kysely<DB>): Promise<{ migration: string | null; latencyMs: number }> {
  const started = performance.now();
  const row = await db
    .selectFrom('schema_migrations')
    .select((eb) => eb.fn.max<string | null>('version').as('migration'))
    .executeTakeFirstOrThrow();
  return { migration: row.migration, latencyMs: Math.round(performance.now() - started) };
}

export async function checkHealth(sources: HealthSources): Promise<HealthReport> {
  const [database, queue] = await Promise.allSettled([
    checkDatabase(sources.db),
    sources.queueSchemaVersion(),
  ]);
  const failing: ('database' | 'queue' | 'runtime')[] = [];
  if (database.status === 'rejected') {
    failing.push('database');
    sources.errors.capture(database.reason, {
      message: 'worker health check failed',
      fields: { part: 'database' },
    });
  }
  if (queue.status === 'rejected') {
    failing.push('queue');
    sources.errors.capture(queue.reason, {
      message: 'worker health check failed',
      fields: { part: 'queue' },
    });
  }
  if (!sources.isRunning()) failing.push('runtime');
  if (database.status === 'rejected' || queue.status === 'rejected' || failing.length > 0) {
    return { status: 'unavailable', failing };
  }
  return {
    status: 'ok',
    database: database.value,
    queue: { schemaVersion: queue.value },
    lanes: sources.lanes(),
  };
}
