import { SpanStatusCode } from '@opentelemetry/api';
import type { Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';
import type { ErrorCapture } from '@carshenas/observability/capture';
import { withLogContext } from '@carshenas/observability/context';
import { serializeError } from '@carshenas/observability/errors';
import type { Logger } from '@carshenas/observability/logger';
import { withSpan } from '@carshenas/observability/tracing';
import { jobEnvelopeSchema, type JobEnvelope } from './envelope.ts';
import {
  LaneClosedError,
  PermanentJobError,
  SourceBlockedError,
  SourceThrottledError,
  SourceUnavailableError,
} from './errors.ts';
import type { SourceFetch } from './http.ts';
import type { EnqueueOptions, JobContext, JobDefinition, LaneClient } from './job.ts';

// One attempt of one job (ADR-0016, ADR-0018 point 5): the stored data is parsed, the job runs inside its own trace
// and log context, and the attempt ends with exactly one line and one disposition for pg-boss. Only the job's own
// failures spend an attempt; a source's refusal, or a lane that cannot send, puts the job back with its attempts
// untouched; input that can never work goes to the dead-letter queue at once. No error is logged twice or dropped.

/** What the runtime needs of a claimed pg-boss job. */
export type Attempt = {
  readonly id: string;
  readonly queue: string;
  readonly data: unknown;
  /** 0 on the first attempt. */
  readonly retryCount: number;
  readonly retryLimit: number;
  readonly priority: number;
  readonly signal: AbortSignal;
};

/** How pg-boss settles the attempt (perJobResults): completed, failed (retried until the limit), dead-lettered. */
export type Disposition = {
  readonly status: 'completed' | 'failed' | 'deadletter';
  readonly output: object;
};

/** Where a follow-up job came from. */
export type Parent = { readonly jobId: string; readonly traceId: string };

export type AttemptDeps = {
  readonly registry: ReadonlyMap<string, JobDefinition>;
  readonly db: Kysely<DB>;
  readonly logger: Logger;
  readonly errors: ErrorCapture;
  readonly enqueue: (
    job: JobDefinition,
    payload: unknown,
    options: EnqueueOptions | undefined,
    parent: Parent,
  ) => Promise<string>;
  /** Completes this attempt and sends the same job again, in one transaction; returns the new job's id. */
  readonly putBack: (
    attempt: Attempt,
    envelope: JobEnvelope,
    /** Undefined for a kind this worker does not know: the queue's own options apply. */
    definition: JobDefinition | undefined,
    startAfter: Date | undefined,
  ) => Promise<string>;
  /** The lane of `sourceId`, as this attempt sees it. */
  readonly lane: (
    sourceId: string,
    attempt: Attempt,
    log: Logger,
  ) => { lane: LaneClient; fetch: SourceFetch };
  /** A job put back this many times is treated as failing, so nothing circles the queue forever. */
  readonly maxPutBacks: number;
  /** How long a job of a kind this worker does not know waits before another worker may take it. */
  readonly unknownKindDelayMs: number;
};

function elapsed(started: number): number {
  return Math.round(performance.now() - started);
}

/** The attempt ends before the job runs: the stored data cannot be used. */
function unusable(deps: AttemptDeps, attempt: Attempt, message: string, cause: unknown): Disposition {
  const error = new PermanentJobError(message, { cause });
  deps.errors.capture(error, {
    message: 'job dead-lettered',
    fields: { jobId: attempt.id, queue: attempt.queue },
  });
  return { status: 'deadletter', output: serializeError(error) };
}

/** When a job the lane could not send should come back. */
function returnTime(error: LaneClosedError | SourceBlockedError | SourceThrottledError): Date | undefined {
  return error instanceof LaneClosedError ? error.until : undefined;
}

export async function runAttempt(attempt: Attempt, deps: AttemptDeps): Promise<Disposition> {
  const started = performance.now();
  const parsed = jobEnvelopeSchema.safeParse(attempt.data);
  if (!parsed.success) return unusable(deps, attempt, 'the job data is not a job envelope', parsed.error);
  const envelope = parsed.data;
  const definition = deps.registry.get(envelope.kind);
  if (!definition) {
    // During a deploy a worker of the previous version can claim a job of a kind only the new one knows: the job
    // goes back for a worker that knows it, and is dead-lettered only when none has taken it for a long while.
    if ((envelope.meta.putBacks ?? 0) >= deps.maxPutBacks) {
      return unusable(deps, attempt, `no worker knows jobs of kind ${envelope.kind}`, undefined);
    }
    const until = new Date(Date.now() + deps.unknownKindDelayMs);
    const nextJobId = await deps.putBack(attempt, envelope, undefined, until);
    deps.logger.warn('job of an unknown kind put back', {
      jobId: attempt.id,
      queue: attempt.queue,
      job: envelope.kind,
      nextJobId,
      until,
    });
    return { status: 'completed', output: { putBack: 'unknown kind', nextJobId } };
  }
  const payload = definition.payload.safeParse(envelope.payload);
  if (!payload.success)
    return unusable(deps, attempt, `the ${envelope.kind} payload is invalid`, payload.error);
  const sourceId = definition.placement === 'lane' ? definition.source(payload.data) : undefined;

  const fields = {
    jobId: attempt.id,
    queue: attempt.queue,
    job: envelope.kind,
    attempt: attempt.retryCount + 1,
    ...(sourceId !== undefined && { source: sourceId }),
    ...(envelope.meta.parentJobId !== undefined && { parentJobId: envelope.meta.parentJobId }),
    ...(envelope.meta.parentTraceId !== undefined && { parentTraceId: envelope.meta.parentTraceId }),
  };
  return withLogContext(fields, () =>
    withSpan(
      `job ${envelope.kind}`,
      async (span): Promise<Disposition> => {
        const log = deps.logger.child({ component: 'job' });
        const counts: Record<string, number> = {};
        const parent = { jobId: attempt.id, traceId: span.spanContext().traceId };
        const context: JobContext = {
          job: { id: attempt.id, kind: envelope.kind, queue: attempt.queue, attempt: attempt.retryCount + 1 },
          log,
          signal: attempt.signal,
          db: deps.db,
          enqueue: (job, jobPayload, options) => deps.enqueue(job, jobPayload, options, parent),
          count(name, by = 1) {
            counts[name] = (counts[name] ?? 0) + by;
          },
        };
        try {
          if (definition.placement === 'lane' && sourceId !== undefined) {
            await definition.run(payload.data, { ...context, ...deps.lane(sourceId, attempt, log) });
          } else if (definition.placement === 'queue') {
            await definition.run(payload.data, context);
          }
          log.info('job completed', { durationMs: elapsed(started), counts });
          return { status: 'completed', output: { counts } };
        } catch (error) {
          const summary = { durationMs: elapsed(started), counts };
          if (
            (error instanceof LaneClosedError ||
              error instanceof SourceBlockedError ||
              error instanceof SourceThrottledError) &&
            (envelope.meta.putBacks ?? 0) < deps.maxPutBacks
          ) {
            // Not the job's failure: the lane has already reacted (stopped, cooling down or waiting).
            const until = returnTime(error);
            const nextJobId = await deps.putBack(attempt, envelope, definition, until);
            log.info('job put back', {
              ...summary,
              reason: error instanceof LaneClosedError ? error.closure : error.name,
              nextJobId,
              ...(until && { until }),
            });
            return { status: 'completed', output: { putBack: error.message, nextJobId } };
          }
          span.recordException(error instanceof Error ? error : String(error));
          span.setStatus({ code: SpanStatusCode.ERROR });
          if (error instanceof PermanentJobError) {
            deps.errors.capture(error, { message: 'job dead-lettered', fields: summary });
            return { status: 'deadletter', output: serializeError(error) };
          }
          const willRetry = attempt.retryCount < attempt.retryLimit;
          const outcome = { ...summary, willRetry, deadLettered: !willRetry };
          if (error instanceof SourceUnavailableError) {
            // The source's trouble, which the lane's breaker counts; it spends an attempt, since the request failed.
            log.warn('job failed', { ...outcome, reason: 'source unavailable', err: error });
          } else if (attempt.signal.aborted) {
            log.warn('job interrupted', { ...outcome, err: error });
          } else {
            deps.errors.capture(error, { message: 'job failed', fields: outcome });
          }
          return { status: 'failed', output: serializeError(error) };
        }
      },
      {
        'job.id': attempt.id,
        'job.kind': envelope.kind,
        'job.queue': attempt.queue,
        'job.attempt': attempt.retryCount + 1,
      },
    ),
  );
}
