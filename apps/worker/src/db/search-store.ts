import { sql, type Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';

// What the search jobs ask of the queue (CS-59). The search tables themselves are built by @carshenas/search/document.

/**
 * Whether a job of this kind is waiting to run or running: a kind with a queue of its own is sent to the queue that
 * carries its name, so a worker that restarts often asks before it sends its start-up rebuild again.
 */
export async function hasOpenJob(db: Kysely<DB>, kind: string): Promise<boolean> {
  const { rows } = await sql<{ open: boolean }>`
    SELECT EXISTS (
      SELECT FROM pgboss.job WHERE name = ${kind} AND state IN ('created', 'retry', 'active')
    ) AS open`.execute(db);
  return rows[0]?.open === true;
}
