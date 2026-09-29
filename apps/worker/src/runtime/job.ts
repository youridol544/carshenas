import type { Kysely } from 'kysely';
import type { ZodType } from 'zod';
import type { Ai } from '@carshenas/ai/ai';
import type { ProductRegistry } from '@carshenas/ai/registry';
import type { DB } from '@carshenas/db/db-types';
import type { Logger } from '@carshenas/observability/logger';
import type { SourceFetch } from './http.ts';

/** The AI layer as jobs see it: every task of the product's registry, by name (packages/ai, ADR-0021). */
export type WorkerModels = Ai<ProductRegistry>;

// What a job is (ADR-0018 point 1). A job says what to do; the runtime decides how: which queue holds it, when it is
// claimed, how its attempts are traced, logged, retried and dead-lettered, and how its requests to a source are
// paced. Jobs import from this file, never the queue library, so either side can change without the other.

/** How often and how patiently the job's own failures are retried (pg-boss's exponential backoff with jitter). */
export type RetryPolicy = {
  /** Retries after the first attempt; then the job goes to the dead-letter queue. */
  readonly limit: number;
  readonly delaySeconds: number;
  readonly maxDelaySeconds: number;
};

/** A recurring job, fired by pg-boss's clock in Asia/Tehran time. */
export type JobSchedule<Payload> = {
  /** Names the schedule among the job's schedules, so it can be changed or removed: letters, digits, _ - . /. */
  readonly key: string;
  /** A cron expression in Asia/Tehran time: '*\/15 * * * *'. */
  readonly cron: string;
  readonly payload: Payload;
};

type CommonDefinition<Payload> = {
  /** The job's kind, `<area>.<verb>` in kebab case: 'listing.parse', 'crawl.discover-page'. */
  readonly name: string;
  /** Checks the payload when the job is sent, and again when it is claimed: stored JSON is outside input. */
  readonly payload: ZodType<Payload>;
  /** Higher runs first within its queue. A lane runs its source's kinds in ADR-0017's order through this. */
  readonly priority?: number;
  readonly retry?: RetryPolicy;
  /** The longest one attempt may take before pg-boss takes the job back and retries it. */
  readonly timeoutSeconds?: number;
  /** A job still queued this many days after it was due is dropped: work that is stale by then. */
  readonly retentionDays?: number;
  readonly schedules?: readonly JobSchedule<Payload>[];
  /**
   * The job asks language models through context.models. The worker then creates the AI layer at start, and refuses
   * to start without METIS_API_KEY (ADR-0019 point 1); a worker whose jobs never call models needs no key.
   */
  readonly callsModels?: boolean;
};

/** A job with a queue of its own: pipeline work that sends no request to a source. */
export type QueueJobDefinition<Payload> = CommonDefinition<Payload> & {
  readonly placement: 'queue';
  /** How many jobs of this kind one worker process runs at once. */
  readonly concurrency?: number;
  run(payload: Payload, context: JobContext): Promise<void>;
};

/** A job that sends requests to one source, and so runs in that source's lane, one job of the lane at a time. */
export type LaneJobDefinition<Payload> = CommonDefinition<Payload> & {
  readonly placement: 'lane';
  /** The source whose lane runs it. */
  source(payload: Payload): string;
  run(payload: Payload, context: LaneJobContext): Promise<void>;
};

export type JobDefinition<Payload = unknown> = QueueJobDefinition<Payload> | LaneJobDefinition<Payload>;

export type EnqueueOptions = {
  /**
   * Enqueue inside this transaction: the job exists exactly when the rows it needs are committed, and a rollback
   * removes both (pg-boss's fromKysely).
   */
  readonly transaction?: Kysely<DB>;
  readonly startAfter?: Date;
};

/** Sends a job; its payload is checked first, so a bad one never reaches the queue. Returns the job's id. */
export type Enqueue = <Payload>(
  job: JobDefinition<Payload>,
  payload: Payload,
  options?: EnqueueOptions,
) => Promise<string>;

export type JobContext = {
  readonly job: {
    readonly id: string;
    readonly kind: string;
    readonly queue: string;
    /** 1 for the first attempt. */
    readonly attempt: number;
  };
  /** Lines written here, or anywhere inside the job, carry the job's id, kind, attempt and trace id. */
  readonly log: Logger;
  /** Aborted when the worker shuts down, or when pg-boss has taken the job back (its timeout, a lost claim). */
  readonly signal: AbortSignal;
  readonly db: Kysely<DB>;
  readonly enqueue: Enqueue;
  /**
   * The AI layer, for a job that declares callsModels: `context.models.call('listing.facts', input, { signal })`.
   * A call that gets no answer throws ModelCallError, which the queue retries when it is retryable (ADR-0019 point 4).
   */
  readonly models: WorkerModels;
  /** Adds to a count reported on the job's completion line: `count('listings', 25)`. */
  count(name: string, by?: number): void;
};

/** What a request to a lane's source gets from the lane. */
export type LaneRequest = {
  /** Aborted by the job's signal. */
  readonly signal: AbortSignal;
  /** When the request was allowed to start, by the database's clock: a fetch_log row's requested_at. */
  readonly startedAt: Date;
};

/** A source's lane, as a job sees it. */
export type LaneClient = {
  readonly sourceId: string;
  /**
   * Sends one request to the source when the lane allows it: after its turn (a job waits at most one gap), holding the
   * lane's lease while it runs, and recording what the source answered. `send` throws SourceBlockedError,
   * SourceThrottledError or SourceUnavailableError for the source's problems (http.ts does); anything else it throws
   * is the job's own failure.
   */
  request<Result>(send: (request: LaneRequest) => Promise<Result>): Promise<Result>;
};

export type LaneJobContext = JobContext & {
  readonly lane: LaneClient;
  /** An HTTP request to the lane's source, through the lane (http.ts): the usual way a lane job reads its source. */
  readonly fetch: SourceFetch;
};

export function defineJob<Payload>(
  definition: Omit<QueueJobDefinition<Payload>, 'placement'>,
): QueueJobDefinition<Payload> {
  return { ...definition, placement: 'queue' };
}

export function defineLaneJob<Payload>(
  definition: Omit<LaneJobDefinition<Payload>, 'placement'>,
): LaneJobDefinition<Payload> {
  return { ...definition, placement: 'lane' };
}
