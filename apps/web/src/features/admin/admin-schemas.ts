import * as z from 'zod';
import type { ChosenCrawlState, CrawlState } from '@/features/admin/admin-types';

// What the source state form sends (every field is hostile: the Next.js data-security guide): the source, the state
// and the stop the page showed, and the state the person chose. The stop travels as the database's own text for a
// timestamptz, exact to the microsecond, and goes back to change_source_state() as text, so no JavaScript Date ever
// rounds it (the database skill, kysely.md). Anything else is refused before it reaches the database.

// source_id_format, the source table's CHECK.
const SOURCE_ID = /^[a-z][a-z0-9_]{1,30}$/;
// PostgreSQL's text for a timestamptz in the ISO DateStyle: 2026-09-29 13:13:44.123456+00, the offset with minutes
// or seconds when the zone has them.
const DATABASE_INSTANT = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?[+-]\d{2}(:\d{2}){0,2}$/;

const CRAWL_STATES = ['enabled', 'paused', 'stopped_on_block'] as const satisfies readonly CrawlState[];
const CHOSEN_STATES = ['enabled', 'paused'] as const satisfies readonly ChosenCrawlState[];

function formText() {
  return z.preprocess((value) => (typeof value === 'string' ? value : ''), z.string());
}

const changeSourceStateSchema = z
  .object({
    sourceId: formText().pipe(z.string().regex(SOURCE_ID)),
    seenState: formText().pipe(z.enum(CRAWL_STATES)),
    seenStoppedAt: formText().pipe(z.union([z.literal(''), z.string().regex(DATABASE_INSTANT)])),
    chosen: formText().pipe(z.enum(CHOSEN_STATES)),
  })
  // A stop is shown exactly for a stopped source, as source_stop_recorded keeps it.
  .refine((form) => (form.seenState === 'stopped_on_block') === (form.seenStoppedAt !== ''));

export type ChangeSourceStateForm = {
  sourceId: string;
  seenState: CrawlState;
  /** The stop the page showed, as the database's text; null when it showed none. */
  seenStoppedAt: string | null;
  chosen: ChosenCrawlState;
};

/** Reads the source state form; anything that is not a form this section rendered comes back as undefined. */
export function readChangeSourceStateForm(formData: FormData): ChangeSourceStateForm | undefined {
  const parsed = changeSourceStateSchema.safeParse({
    sourceId: formData.get('sourceId'),
    seenState: formData.get('seenState'),
    seenStoppedAt: formData.get('seenStoppedAt'),
    chosen: formData.get('chosen'),
  });
  if (!parsed.success) return undefined;
  const { sourceId, seenState, seenStoppedAt, chosen } = parsed.data;
  return { sourceId, seenState, seenStoppedAt: seenStoppedAt === '' ? null : seenStoppedAt, chosen };
}

// What the job form sends (CS-41): the job's queue and id, the state the page showed, and the action. The action must
// fit the state shown: a failed job is retried, a job waiting to run again is cancelled.
const QUEUE_NAME = /^[a-z0-9][a-z0-9._-]{0,199}$/;

const changeJobStateSchema = z
  .object({
    queue: formText().pipe(z.string().regex(QUEUE_NAME)),
    jobId: formText().pipe(z.uuid()),
    seenState: formText().pipe(z.enum(['failed', 'retry'])),
    action: formText().pipe(z.enum(['retry', 'cancel'])),
  })
  .refine((form) => (form.action === 'retry') === (form.seenState === 'failed'));

export type ChangeJobStateForm = {
  queue: string;
  jobId: string;
  seenState: 'failed' | 'retry';
  action: 'retry' | 'cancel';
};

/** Reads the job form; anything that is not a form this section rendered comes back as undefined. */
export function readChangeJobStateForm(formData: FormData): ChangeJobStateForm | undefined {
  const parsed = changeJobStateSchema.safeParse({
    queue: formData.get('queue'),
    jobId: formData.get('jobId'),
    seenState: formData.get('seenState'),
    action: formData.get('action'),
  });
  return parsed.success ? parsed.data : undefined;
}
