import { hostname } from 'node:os';
import type { Kysely } from 'kysely';
import { fromKysely, type JobResult, type JobWithMetadata, type PgBoss } from 'pg-boss';
import type { DB } from '@carshenas/db/db-types';
import type { ErrorCapture } from '@carshenas/observability/capture';
import type { Logger } from '@carshenas/observability/logger';
import type { JobEnvelope } from './envelope.ts';
import { createSourceFetch } from './http.ts';
import type { Enqueue, EnqueueOptions, JobDefinition } from './job.ts';
import { createLaneClient } from './lane-client.ts';
import { createLaneSupervisor, type LaneStatus } from './lanes.ts';
import { PACING, type PacingPolicy } from './pacing.ts';
import {
  DEAD_LETTER_QUEUE,
  DEAD_LETTER_QUEUE_OPTIONS,
  LANE_QUEUE_OPTIONS,
  putBackOptions,
  queueOf,
  queueOptions,
  sendOptions,
} from './queues.ts';
import { runAttempt, type Attempt, type AttemptDeps, type Parent } from './run-job.ts';

// The worker runtime (ADR-0018): it knows pg-boss, the lanes and the job contract, and nothing about any one job. It
// creates the queues, subscribes to the kinds with a queue of their own, keeps the lanes, registers the schedules in
// Tehran time, and hands each claimed job to runAttempt.

export type RuntimeOptions = {
  readonly boss: PgBoss;
  readonly db: Kysely<DB>;
  readonly logger: Logger;
  readonly errors: ErrorCapture;
  readonly jobs: readonly JobDefinition[];
  /** How the crawler names itself to every source (env.crawlerUserAgent), read when a request is sent. */
  readonly userAgent: () => string;
  readonly policy?: PacingPolicy;
  /** The longest a request to a source may take. */
  readonly requestTimeoutMs?: number;
  readonly reconcileIntervalMs?: number;
  readonly lanePollingIntervalSeconds?: number;
  readonly queuePollingIntervalSeconds?: number;
  readonly maxPutBacks?: number;
  /** How long a job of a kind this worker does not know waits before it is claimed again; a minute by default. */
  readonly unknownKindDelayMs?: number;
};

export type Runtime = {
  start(): Promise<void>;
  /** Stops claiming, lets running jobs finish for up to `timeoutMs`, then fails them back to the queue. */
  stop(timeoutMs?: number): Promise<void>;
  readonly enqueue: Enqueue;
  lanes(): LaneStatus[];
  isRunning(): boolean;
};

/** Cron expressions are read in Tehran time (ADR-0011 point 5); pg-boss stores the zone with each schedule. */
export const SCHEDULE_TIME_ZONE = 'Asia/Tehran';

function registryOf(jobs: readonly JobDefinition[]): ReadonlyMap<string, JobDefinition> {
  const registry = new Map<string, JobDefinition>();
  for (const job of jobs) {
    if (registry.has(job.name)) throw new Error(`two jobs are named ${job.name}`);
    // A lane's queue is crawl.<source>; a kind with a queue of its own must never take such a name.
    if (job.placement === 'queue' && job.name.startsWith('crawl.')) {
      throw new Error(`${job.name}: only lane jobs may be named crawl.*`);
    }
    registry.set(job.name, job);
  }
  return registry;
}

function attemptOf(job: JobWithMetadata<unknown>): Attempt {
  return {
    id: job.id,
    queue: job.name,
    data: job.data,
    retryCount: job.retryCount,
    retryLimit: job.retryLimit,
    priority: job.priority,
    signal: job.signal,
  };
}

export function createRuntime(options: RuntimeOptions): Runtime {
  const { boss, db, logger, errors } = options;
  const policy = options.policy ?? PACING;
  const requestTimeoutMs = options.requestTimeoutMs ?? 30_000;
  const registry = registryOf(options.jobs);
  const holderPrefix = `${hostname()}:${process.pid}`;
  const knownQueues = new Set<string>();
  let running = false;

  async function ensureQueue(queue: string, definition: JobDefinition): Promise<void> {
    if (knownQueues.has(queue)) return;
    await boss.createQueue(
      queue,
      definition.placement === 'lane' ? LANE_QUEUE_OPTIONS : queueOptions(definition),
    );
    knownQueues.add(queue);
  }

  async function send(
    definition: JobDefinition,
    payload: unknown,
    options: EnqueueOptions | undefined,
    parent: Parent | undefined,
  ): Promise<string> {
    // A bad payload is the caller's bug: it throws here, before anything reaches the queue.
    const value = definition.payload.parse(payload);
    const queue = queueOf(definition, value);
    await ensureQueue(queue, definition);
    const envelope: JobEnvelope = {
      kind: definition.name,
      payload: value,
      meta: parent ? { parentJobId: parent.jobId, parentTraceId: parent.traceId } : {},
    };
    const id = await boss.send(queue, envelope, {
      ...sendOptions(definition),
      ...(options?.startAfter && { startAfter: options.startAfter }),
      ...(options?.transaction && { db: fromKysely(options.transaction) }),
    });
    if (id === null) throw new Error(`pg-boss did not create the ${definition.name} job`);
    return id;
  }

  const deps: AttemptDeps = {
    registry,
    db,
    logger,
    errors,
    maxPutBacks: options.maxPutBacks ?? 25,
    unknownKindDelayMs: options.unknownKindDelayMs ?? 60_000,
    enqueue: send,
    async putBack(attempt, envelope, definition, startAfter) {
      const again: JobEnvelope = {
        ...envelope,
        meta: { ...envelope.meta, putBacks: (envelope.meta.putBacks ?? 0) + 1 },
      };
      // One transaction: the job is either done here and queued again, or neither.
      return db.transaction().execute(async (transaction) => {
        const adapter = fromKysely(transaction);
        await boss.complete(
          attempt.queue,
          { id: attempt.id, retryCount: attempt.retryCount },
          { putBack: true },
          { db: adapter },
        );
        const id = await boss.send(attempt.queue, again, {
          ...putBackOptions(definition, attempt),
          ...(startAfter && { startAfter }),
          db: adapter,
        });
        if (id === null) throw new Error(`pg-boss did not queue ${envelope.kind} again`);
        return id;
      });
    },
    lane(sourceId, attempt, log) {
      const lane = createLaneClient({
        sourceId,
        holder: `${holderPrefix}:${attempt.id}`,
        db,
        policy,
        requestTimeoutMs,
        signal: attempt.signal,
        log,
        onClosed: (closure, until) => {
          supervisor.close(sourceId, closure, until);
        },
      });
      return { lane, fetch: createSourceFetch(lane, options.userAgent) };
    },
  };

  async function handle(job: JobWithMetadata<unknown>): Promise<JobResult> {
    const disposition = await runAttempt(attemptOf(job), deps);
    return { id: job.id, status: disposition.status, output: disposition.output };
  }

  const supervisor = createLaneSupervisor({
    boss,
    db,
    logger,
    errors,
    handle,
    reconcileIntervalMs: options.reconcileIntervalMs ?? 10_000,
    pollingIntervalSeconds: options.lanePollingIntervalSeconds ?? 1,
  });

  async function registerSchedules(): Promise<void> {
    const wanted = new Set<string>();
    for (const definition of registry.values()) {
      for (const schedule of definition.schedules ?? []) {
        const payload = definition.payload.parse(schedule.payload);
        const queue = queueOf(definition, payload);
        await ensureQueue(queue, definition);
        // pg-boss allows letters, digits, _ - . and / in a key.
        const key = `${definition.name}/${schedule.key}`;
        wanted.add(`${queue} ${key}`);
        const envelope: JobEnvelope = { kind: definition.name, payload, meta: {} };
        await boss.schedule(queue, schedule.cron, envelope, {
          ...sendOptions(definition),
          tz: SCHEDULE_TIME_ZONE,
          key,
        });
      }
    }
    for (const existing of await boss.getSchedules()) {
      if (!wanted.has(`${existing.name} ${existing.key}`)) await boss.unschedule(existing.name, existing.key);
    }
  }

  return {
    async start() {
      await boss.start();
      await boss.createQueue(DEAD_LETTER_QUEUE, DEAD_LETTER_QUEUE_OPTIONS);
      for (const definition of registry.values()) {
        if (definition.placement !== 'queue') continue;
        await ensureQueue(definition.name, definition);
        await boss.work(
          definition.name,
          {
            batchSize: 1,
            localConcurrency: definition.concurrency ?? 1,
            includeMetadata: true,
            perJobResults: true,
            pollingIntervalSeconds: options.queuePollingIntervalSeconds ?? 2,
          },
          (jobs) => Promise.all(jobs.map((job) => handle(job))),
        );
      }
      await supervisor.start();
      await registerSchedules();
      running = true;
      logger.info('worker runtime started', {
        jobs: [...registry.keys()],
        lanes: supervisor.statuses().map((lane) => lane.sourceId),
      });
    },
    async stop(timeoutMs = 30_000) {
      running = false;
      supervisor.stop();
      await boss.stop({ graceful: true, timeout: timeoutMs, close: true });
    },
    enqueue: (definition, payload, enqueueOptions) => send(definition, payload, enqueueOptions, undefined),
    lanes: () => supervisor.statuses(),
    isRunning: () => running,
  };
}
