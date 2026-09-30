import 'server-only';
import type { Json, Timestamp } from '@carshenas/db/db-types';

// The job queue's tables as the superadmin section reads them (CS-41). pg-boss owns the schema `pgboss`, so the
// generated types (public only) leave it out; these are written by hand, only the columns the section reads, all
// read-only, and admin-database.db.test.ts compares them with the installed schema, so a pg-boss upgrade that renames
// one fails a test instead of a page.

/** pg-boss 12's `pgboss.job_state`, in its own order. */
export const JOB_STATES = ['created', 'retry', 'active', 'completed', 'cancelled', 'failed'] as const;
export type JobState = (typeof JOB_STATES)[number];

export type PgbossJob = {
  id: string;
  name: string;
  priority: number;
  data: Json | null;
  state: JobState;
  retry_count: number;
  retry_limit: number;
  start_after: Timestamp;
  created_on: Timestamp;
  started_on: Timestamp | null;
  completed_on: Timestamp | null;
  output: Json | null;
  /** On a dead letter: the queue the job failed in, and its error there. */
  source_name: string | null;
  source_output: Json | null;
};

export type PgbossQueue = {
  name: string;
  dead_letter: string | null;
};

export type PgbossTables = { 'pgboss.job': PgbossJob; 'pgboss.queue': PgbossQueue };

/** Every column above, by table, for the schema comparison. */
export const PGBOSS_COLUMNS: Record<'job' | 'queue', readonly string[]> = {
  job: [
    'id',
    'name',
    'priority',
    'data',
    'state',
    'retry_count',
    'retry_limit',
    'start_after',
    'created_on',
    'started_on',
    'completed_on',
    'output',
    'source_name',
    'source_output',
  ],
  queue: ['name', 'dead_letter'],
};
