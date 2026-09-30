import 'server-only';
import { sql, type Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';
import type { JobState } from '@/server/db/pgboss-types';

// For the superadmin section's pipeline tests (CS-41, *.db.test.ts on the scratch database `pnpm db:check` migrated):
// what the worker writes that the owner's typed connection cannot, a lane's budget counted on a Tehran day and pg-boss's
// own rows, written as the owner.

/** A lane whose budget was counted `daysAgo` Tehran days ago (0: today), with `spent` requests leased that day. */
export async function seedLaneBudget(
  owner: Kysely<DB>,
  sourceId: string,
  daysAgo: number,
  spent: number,
): Promise<void> {
  await sql`
    INSERT INTO crawl_lane (source_id, budget_day, budget_spent)
    VALUES (${sourceId}, (now() AT TIME ZONE 'Asia/Tehran')::date - ${daysAgo}::integer, ${spent})`.execute(
    owner,
  );
}

/** A pg-boss queue, as the worker creates one on start; kept when it exists. */
export async function seedQueue(owner: Kysely<DB>, name: string): Promise<void> {
  await sql`
    INSERT INTO pgboss.queue (name, policy, retry_limit, retry_delay, retry_backoff, expire_seconds,
                              retention_seconds, deletion_seconds, partition, table_name)
    VALUES (${name}, 'standard', 2, 0, false, 900, 1209600, 604800, false, 'job_common')
    ON CONFLICT (name) DO NOTHING`.execute(owner);
}

export type SeedJob = {
  id?: string;
  queue: string;
  state: JobState;
  kind: string;
  retryCount?: number;
  /** Set on a finished job: completed_on is now(). */
  output?: object;
  /** On a dead letter: the queue it failed in, and the error it failed with there. */
  sourceName?: string;
  sourceOutput?: object;
};

/** A job as pg-boss stores one; its data is the worker's envelope, `{ kind }` enough for the section. */
export async function seedJob(owner: Kysely<DB>, job: SeedJob): Promise<void> {
  const output = job.output === undefined ? null : JSON.stringify(job.output);
  const sourceOutput = job.sourceOutput === undefined ? null : JSON.stringify(job.sourceOutput);
  await sql`
    INSERT INTO pgboss.job (id, name, state, data, retry_count, retry_limit, completed_on, output, source_name,
                            source_output)
    VALUES (coalesce(${job.id ?? null}::uuid, gen_random_uuid()), ${job.queue}, ${job.state}::pgboss.job_state,
            ${JSON.stringify({ kind: job.kind })}::jsonb, ${job.retryCount ?? 0}, 2,
            CASE WHEN ${output}::jsonb IS NULL THEN NULL ELSE now() END, ${output}::jsonb,
            ${job.sourceName ?? null}, ${sourceOutput}::jsonb)`.execute(owner);
}
