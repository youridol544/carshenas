import type { Kysely } from 'kysely';
import type { JobResult, JobWithMetadata, PgBoss } from 'pg-boss';
import type { DB } from '@carshenas/db/db-types';
import type { ErrorCapture } from '@carshenas/observability/capture';
import type { Logger } from '@carshenas/observability/logger';
import { ensureLane, readSourceLanes, type SourceLane } from '../db/lane-store.ts';
import { lowestOpenPriority } from './budget.ts';
import type { LaneClosure } from './errors.ts';
import { LANE_QUEUE_OPTIONS, laneQueue } from './queues.ts';

// Keeps one pg-boss subscription per crawled source, running exactly while its lane can send (ADR-0018 points 2 and
// 4): a stopped, paused or cooling lane claims no job, so its queued jobs wait in the table, untouched, instead of
// being claimed and failed. A lane closes at once when one of its requests says so, and the supervisor opens it
// again when the database says it can send: the source enabled by a person, the cool-down over.

export type LaneStatus = {
  readonly sourceId: string;
  readonly queue: string;
  readonly state: 'running' | 'paused';
  /** The lowest priority a running lane claims, when today's budget no longer covers every kind (budget.ts). */
  readonly minPriority?: number;
  /** Why a paused lane is paused. */
  readonly closure?: LaneClosure;
  /** When a paused lane expects to open again; unknown for a source only a person can resume. */
  readonly until?: Date;
};

export type LaneSupervisorOptions = {
  readonly boss: PgBoss;
  readonly db: Kysely<DB>;
  readonly logger: Logger;
  readonly errors: ErrorCapture;
  /** Runs one claimed job of a lane. */
  readonly handle: (job: JobWithMetadata<unknown>) => Promise<JobResult>;
  /** How often the lanes are compared with the sources and their cool-downs. */
  readonly reconcileIntervalMs: number;
  /** How often a running lane looks for a job when it has none. */
  readonly pollingIntervalSeconds: number;
};

export type LaneSupervisor = {
  /** Creates the lanes of every crawled source, opens those that can send, and keeps checking. */
  start(): Promise<void>;
  /** Stops checking; pg-boss's own stop drains the subscriptions. */
  stop(): void;
  /** Called by a lane's request when it learns the lane cannot send: stop claiming its jobs. */
  close(sourceId: string, closure: LaneClosure, until: Date | undefined): void;
  statuses(): LaneStatus[];
};

type Lane = {
  sourceId: string;
  queue: string;
  workerId: string | undefined;
  /** The minPriority its subscription was opened with. */
  minPriority: number | undefined;
  closure: LaneClosure | undefined;
  until: Date | undefined;
  /** Subscribing and unsubscribing, one at a time per lane. */
  pending: Promise<void>;
};

type LaneVerdict =
  | { readonly closure: LaneClosure; readonly until?: Date }
  | { readonly closure?: undefined; readonly minPriority: number | undefined };

/**
 * Whether a lane can send now, by the database's clock, and if not, why; when it can, the lowest priority today's
 * budget still lets it claim (ADR-0017 point 5: what comes last is dropped first).
 */
function verdictOf(source: SourceLane, lane: Lane): LaneVerdict {
  if (source.crawlState === 'stopped_on_block') return { closure: 'stopped' };
  if (source.crawlState === 'paused') return { closure: 'paused' };
  if (source.policyExpired) return { closure: 'policy_expired' };
  if (source.cooldownUntil && source.cooldownUntil > source.now) {
    return { closure: 'cooling_down', until: source.cooldownUntil };
  }
  if (lane.closure === 'waiting' && lane.until && lane.until > source.now) {
    return { closure: 'waiting', until: lane.until };
  }
  const lowest =
    source.dailyBudget === null ? null : lowestOpenPriority(source.spentToday, source.dailyBudget);
  if (lowest === null) return { closure: 'over_budget', until: source.budgetResetsAt };
  return { minPriority: lowest };
}

export function createLaneSupervisor(options: LaneSupervisorOptions): LaneSupervisor {
  const { boss, db, errors } = options;
  const log = options.logger.child({ component: 'lanes' });
  const lanes = new Map<string, Lane>();
  let timer: ReturnType<typeof setInterval> | undefined;
  let stopping = false;
  let reconciling = false;

  function serially(lane: Lane, step: () => Promise<void>): Promise<void> {
    lane.pending = lane.pending.then(step).catch((error: unknown) => {
      errors.capture(error, { message: 'lane could not change state', fields: { source: lane.sourceId } });
    });
    return lane.pending;
  }

  function open(lane: Lane, minPriority: number | undefined): Promise<void> {
    return serially(lane, async () => {
      if (stopping) return;
      if (lane.workerId !== undefined) {
        if (lane.minPriority === minPriority) return;
        // Today's budget dropped a kind (or a new day brought it back): claim again from the new lowest priority.
        const id = lane.workerId;
        lane.workerId = undefined;
        await boss.offWork(lane.queue, { id, wait: false });
      }
      lane.workerId = await boss.work(
        lane.queue,
        {
          batchSize: 1,
          localConcurrency: 1,
          includeMetadata: true,
          perJobResults: true,
          pollingIntervalSeconds: options.pollingIntervalSeconds,
          ...(minPriority !== undefined && { minPriority }),
        },
        (jobs) => Promise.all(jobs.map((job) => options.handle(job))),
      );
      const reason = lane.closure;
      lane.minPriority = minPriority;
      lane.closure = undefined;
      lane.until = undefined;
      log.info('lane opened', {
        source: lane.sourceId,
        ...(reason && { after: reason }),
        ...(minPriority !== undefined && { minPriority }),
      });
    });
  }

  function shut(lane: Lane, closure: LaneClosure, until: Date | undefined): Promise<void> {
    return serially(lane, async () => {
      const changed = lane.closure !== closure || lane.until?.getTime() !== until?.getTime();
      lane.closure = closure;
      lane.until = until;
      lane.minPriority = undefined;
      if (lane.workerId !== undefined) {
        const id = lane.workerId;
        lane.workerId = undefined;
        // Without waiting: this is often called from inside the lane's own job, which offWork would wait for.
        await boss.offWork(lane.queue, { id, wait: false });
      }
      if (changed) log.info('lane closed', { source: lane.sourceId, closure, ...(until && { until }) });
    });
  }

  async function laneOf(sourceId: string): Promise<Lane> {
    const known = lanes.get(sourceId);
    if (known) return known;
    const queue = laneQueue(sourceId);
    await boss.createQueue(queue, LANE_QUEUE_OPTIONS);
    await ensureLane(db, sourceId);
    const lane: Lane = {
      sourceId,
      queue,
      workerId: undefined,
      minPriority: undefined,
      closure: undefined,
      until: undefined,
      pending: Promise.resolve(),
    };
    lanes.set(sourceId, lane);
    return lane;
  }

  async function reconcile(): Promise<void> {
    if (reconciling || stopping) return;
    reconciling = true;
    try {
      const sources = await readSourceLanes(db);
      const current = new Set(sources.map((source) => source.sourceId));
      for (const source of sources) {
        const lane = await laneOf(source.sourceId);
        const verdict = verdictOf(source, lane);
        await (verdict.closure === undefined
          ? open(lane, verdict.minPriority)
          : shut(lane, verdict.closure, verdict.until));
      }
      // A source that is no longer crawled keeps its queue; its lane just stops claiming.
      for (const lane of lanes.values()) {
        if (!current.has(lane.sourceId)) await shut(lane, 'paused', undefined);
      }
    } finally {
      reconciling = false;
    }
  }

  return {
    async start() {
      stopping = false;
      await reconcile();
      timer = setInterval(() => {
        reconcile().catch((error: unknown) => {
          errors.capture(error, { message: 'lanes could not be checked', fields: { component: 'lanes' } });
        });
      }, options.reconcileIntervalMs);
    },
    stop() {
      stopping = true;
      if (timer) clearInterval(timer);
      timer = undefined;
    },
    close(sourceId, closure, until) {
      const lane = lanes.get(sourceId);
      if (!lane) return;
      if (closure === 'over_budget') {
        // Only the job's tier may be spent: the database says which kinds the lane can still claim.
        reconcile().catch((error: unknown) => {
          errors.capture(error, { message: 'lanes could not be checked', fields: { component: 'lanes' } });
        });
        return;
      }
      void shut(lane, closure, until);
    },
    statuses() {
      return [...lanes.values()].map((lane) => ({
        sourceId: lane.sourceId,
        queue: lane.queue,
        state: lane.workerId === undefined ? 'paused' : 'running',
        ...(lane.minPriority !== undefined && { minPriority: lane.minPriority }),
        ...(lane.closure && { closure: lane.closure }),
        ...(lane.until && { until: lane.until }),
      }));
    },
  };
}
