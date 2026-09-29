import type { Queue, SendOptions } from 'pg-boss';
import type { JobDefinition, QueueJobDefinition, RetryPolicy } from './job.ts';

// Where each job lives in pg-boss, and the options it is sent with (ADR-0011 point 5, ADR-0018 point 2). Every send
// carries its kind's full options, so a queue's own defaults, which pg-boss fixes when the queue is first created,
// never decide anything.

const DAY_SECONDS = 86_400;

/** Where every job that failed for good ends up, whatever its queue: people read and redrive it. */
export const DEAD_LETTER_QUEUE = 'dead-letter';

export const DEAD_LETTER_QUEUE_OPTIONS: Omit<Queue, 'name'> = {
  policy: 'standard',
  retentionSeconds: 30 * DAY_SECONDS,
};

/** For a kind that does not set its own. */
export const JOB_DEFAULTS = {
  retry: { limit: 3, delaySeconds: 30, maxDelaySeconds: 3_600 } satisfies RetryPolicy,
  timeoutSeconds: 300,
  /** A lane can stay stopped until a person resumes it, so its queued jobs are kept longer. */
  retentionDays: { queue: 14, lane: 30 },
  /**
   * A worker that holds a job touches it this often (half of it, pg-boss's default); a job whose worker went silent
   * is failed and retried, so a crashed process frees its lane in a minute or two instead of the job's timeout.
   */
  heartbeatSeconds: 30,
} as const;

/** The queue of a source's lane. */
export function laneQueue(sourceId: string): string {
  return `crawl.${sourceId}`;
}

/** A lane: `singleton`, so pg-boss's unique index lets one of its jobs be active at a time, across every process. */
export const LANE_QUEUE_OPTIONS: Omit<Queue, 'name'> = {
  policy: 'singleton',
  deadLetter: DEAD_LETTER_QUEUE,
  retentionSeconds: JOB_DEFAULTS.retentionDays.lane * DAY_SECONDS,
  heartbeatSeconds: JOB_DEFAULTS.heartbeatSeconds,
};

export function queueOptions(definition: QueueJobDefinition<unknown>): Omit<Queue, 'name'> {
  const { priority: _priority, ...options } = sendOptions(definition);
  return { policy: 'standard', ...options };
}

/** The queue that holds a job of this kind with this payload. */
export function queueOf<Payload>(definition: JobDefinition<Payload>, payload: Payload): string {
  return definition.placement === 'lane' ? laneQueue(definition.source(payload)) : definition.name;
}

/** Everything a send of this kind carries. Lane jobs never set a singletonKey: it would give them a lane of their own. */
export function sendOptions(definition: JobDefinition): SendOptions {
  const retry = definition.retry ?? JOB_DEFAULTS.retry;
  return {
    priority: definition.priority ?? 0,
    retryLimit: retry.limit,
    retryDelay: retry.delaySeconds,
    retryBackoff: true,
    retryDelayMax: retry.maxDelaySeconds,
    expireInSeconds: definition.timeoutSeconds ?? JOB_DEFAULTS.timeoutSeconds,
    retentionSeconds:
      (definition.retentionDays ?? JOB_DEFAULTS.retentionDays[definition.placement]) * DAY_SECONDS,
    heartbeatSeconds: JOB_DEFAULTS.heartbeatSeconds,
    deadLetter: DEAD_LETTER_QUEUE,
  };
}

/**
 * The options of a job sent back to its queue after its lane could not send it: its priority, and the retries it had
 * left, so a put-back never renews a job's attempts (ADR-0018 point 4). A kind this worker does not know keeps its
 * queue's defaults.
 */
export function putBackOptions(
  definition: JobDefinition | undefined,
  attempt: { readonly priority: number; readonly retryCount: number },
): SendOptions {
  if (!definition) return { priority: attempt.priority, deadLetter: DEAD_LETTER_QUEUE };
  const options = sendOptions(definition);
  return {
    ...options,
    priority: attempt.priority,
    retryLimit: Math.max(0, (options.retryLimit ?? 0) - attempt.retryCount),
  };
}
