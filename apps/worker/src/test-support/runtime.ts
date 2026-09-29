import type { Kysely } from 'kysely';
import type { PgBoss } from 'pg-boss';
import type { DB } from '@carshenas/db/db-types';
import { createErrorCapture } from '@carshenas/observability/capture';
import { createLogger, type Logger } from '@carshenas/observability/logger';
import { createWorkerDatabase } from '../db/database.ts';
import { env } from '../env.ts';
import { createBoss } from '../runtime/boss.ts';
import type { JobDefinition } from '../runtime/job.ts';
import { PACING, type PacingPolicy } from '../runtime/pacing.ts';
import { createRuntime, type Runtime } from '../runtime/runtime.ts';

// A worker runtime for the integration tests: the real runtime, on the worker's role, with lanes checked often so
// tests do not wait ten seconds for a lane to open. Each call is one "process"; two calls are two processes.

export type TestWorker = {
  readonly runtime: Runtime;
  readonly boss: PgBoss;
  readonly db: Kysely<DB>;
  readonly logger: Logger;
  stop(): Promise<void>;
};

export const TEST_USER_AGENT = 'CarshenasTest/1.0 (+test@example.com)';

/** The worker's pool on its own, for tests that need no runtime. */
export function testWorkerDatabase(): Kysely<DB> {
  const logger = testLogger();
  return createWorkerDatabase(
    { connectionString: env.databaseUrl, logSql: false, logParameters: false },
    logger,
    createErrorCapture(logger),
  );
}

export function testLogger(): Logger {
  return createLogger({
    service: 'carshenas-worker',
    version: 'test',
    environment: 'test',
    level: env.logLevel,
  });
}

export async function startTestWorker(
  jobs: readonly JobDefinition[],
  policy: Partial<PacingPolicy> = {},
): Promise<TestWorker> {
  const logger = testLogger();
  const errors = createErrorCapture(logger);
  const db = createWorkerDatabase(
    { connectionString: env.databaseUrl, logSql: false, logParameters: false },
    logger,
    errors,
  );
  const boss = createBoss({ connectionString: env.databaseUrl, logger, errors });
  const runtime = createRuntime({
    boss,
    db,
    logger,
    errors,
    jobs,
    userAgent: () => TEST_USER_AGENT,
    policy: { ...PACING, ...policy },
    requestTimeoutMs: 5_000,
    reconcileIntervalMs: 200,
    lanePollingIntervalSeconds: 0.5,
    queuePollingIntervalSeconds: 0.5,
  });
  await runtime.start();
  return {
    runtime,
    boss,
    db,
    logger,
    async stop() {
      await runtime.stop(5_000);
      await db.destroy();
    },
  };
}
