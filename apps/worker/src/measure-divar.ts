import { createErrorCapture } from '@carshenas/observability/capture';
import { createLogger } from '@carshenas/observability/logger';
import { createWorkerDatabase } from './db/database.ts';
import { env } from './env.ts';
import { DIVAR, JOBS } from './jobs/registry.ts';
import { createBoss } from './runtime/boss.ts';
import { createRuntime } from './runtime/runtime.ts';

// `pnpm measure:divar`: starts a measurement of Divar's Tehran car market (CS-33 criteria 5 and 7). It sends the first
// page of every car to Divar's lane and exits; the running worker walks it, then each brand, then the models of every
// brand with more than one page, at the lowest priority, and writes each slice's count to model_volume. Every request
// takes the lane's turn like any other, so discovery and details go first. docs/runbooks/worker.md says how to read it.

const logger = createLogger({
  service: 'carshenas-worker',
  version: 'measure-divar',
  environment: env.environment,
  level: env.logLevel,
  format: env.logFormat,
});
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
  jobs: JOBS,
  userAgent: () => env.crawlerUserAgent,
});

try {
  await boss.start();
  const sweptAt = new Date().toISOString();
  const jobId = await runtime.enqueue(DIVAR.measure, {
    sweptAt,
    slice: { key: 'ROOT', level: 'all' },
    page: 1,
    rows: 0,
    bumped: 0,
    newestSortedAt: null,
    oldestSortedAt: null,
    children: [],
  });
  logger.info('measurement started', { source: 'divar', sweptAt, jobId });
} finally {
  await boss.stop({ graceful: false, close: true });
  await db.destroy();
  await logger.flush();
}
