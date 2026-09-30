// The superadmin section's shared types (CS-40, ADR-0023): a source's crawl state as the database lists it, the two
// states a person may choose (only the crawler stops a source), and what the source state form answers.

export type CrawlState = 'enabled' | 'paused' | 'stopped_on_block';

/** What a person may set: they enable or pause a source; the crawler alone stops one (stop_source()). */
export type ChosenCrawlState = 'enabled' | 'paused';

/** Why the crawler stopped a source (ADR-0008 point 6, ADR-0018 point 6). */
export type StopReason = 'blocked' | 'rate_limited' | 'challenge';

/**
 * What change_source_state() made of a person's choice: changed; unchanged, because the source was in that state
 * already (a repeated press); stale, because its state or stop was no longer the one the page showed; or refused,
 * because a source that is not crawled cannot be enabled.
 */
export type SourceStateOutcome = 'changed' | 'unchanged' | 'stale' | 'not_crawled';

export type ChangeSourceStateState =
  | { status: 'idle' }
  | {
      /** An outcome, or failed: the database did not answer, so the page shows the source as it now is. */
      status: SourceStateOutcome | 'failed';
      /** Changes with every answer, so the status line announces a repeated answer again. */
      submission: number;
      chosen: ChosenCrawlState;
    }
  | { status: 'invalid'; submission: number };

export type ChangeSourceStateStatus = ChangeSourceStateState['status'];

/** What a person does to a job (CS-41): retry a failed one, cancel one waiting to run again. */
export type JobAction = 'retry' | 'cancel';

/** What change_job_state() made of it: changed, unchanged (a repeated press), stale (the job moved on, or is gone). */
export type JobStateOutcome = 'changed' | 'unchanged' | 'stale';

export type ChangeJobStateState =
  | { status: 'idle' }
  | {
      /** An outcome, or failed: the database did not answer, so the page shows the job as it now is. */
      status: JobStateOutcome | 'failed';
      /** Changes with every answer, so the status line announces a repeated answer again. */
      submission: number;
      action: JobAction;
    }
  | { status: 'invalid'; submission: number };

/** The windows the worker screen counts over (CS-41; the owner's decision of 2026-09-30). */
export type PipelineWindow = '1h' | '24h' | '7d';
