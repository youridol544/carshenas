import { sql, type Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';

// The worker's heartbeat (CS-41 criterion 1; table worker_heartbeat): one row per process, written when it starts,
// stamped from the database's clock while it runs, marked stopped when it shuts down cleanly. The superadmin section
// reads it to say whether the worker is alive.

export type WorkerInstance = {
  readonly instanceId: string;
  readonly hostname: string;
  readonly pid: number;
  readonly version: string;
};

/** How long the rows of processes that have stopped are kept: a week of restarts. */
export const HEARTBEAT_RETENTION_DAYS = 7;

/** Records a starting process, and deletes the rows of processes silent for longer than the retention. */
export async function recordStart(db: Kysely<DB>, instance: WorkerInstance): Promise<void> {
  await db.transaction().execute(async (trx) => {
    await trx
      .deleteFrom('worker_heartbeat')
      .where('beat_at', '<', sql<Date>`now() - make_interval(days => ${HEARTBEAT_RETENTION_DAYS})`)
      .execute();
    await trx
      .insertInto('worker_heartbeat')
      .values({
        instance_id: instance.instanceId,
        hostname: instance.hostname,
        pid: instance.pid,
        version: instance.version,
        started_at: sql<Date>`now()`,
        beat_at: sql<Date>`now()`,
      })
      .execute();
  });
}

/** One beat. A row a clean stop already marked is left alone. */
export async function recordBeat(db: Kysely<DB>, instanceId: string): Promise<void> {
  await db
    .updateTable('worker_heartbeat')
    .set({ beat_at: sql<Date>`greatest(now(), started_at)` })
    .where('instance_id', '=', instanceId)
    .where('stopped_at', 'is', null)
    .execute();
}

/** A clean stop: the section shows the worker stopped at this time rather than silent. */
export async function recordStop(db: Kysely<DB>, instanceId: string): Promise<void> {
  await db
    .updateTable('worker_heartbeat')
    .set({
      beat_at: sql<Date>`greatest(now(), started_at)`,
      stopped_at: sql<Date>`greatest(now(), started_at)`,
    })
    .where('instance_id', '=', instanceId)
    .execute();
}
