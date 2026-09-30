import { createErrorCapture } from '@carshenas/observability/capture';
import { createLogger } from '@carshenas/observability/logger';
import { createWorkerDatabase } from './db/database.ts';
import { env } from './env.ts';
import { DIVAR_FRESHNESS, JOBS } from './jobs/registry.ts';
import { createBoss } from './runtime/boss.ts';
import { createRuntime } from './runtime/runtime.ts';

// `pnpm sweep:divar tracked|untracked`: starts a sweep of Divar now instead of at its scheduled hour (CS-35): the
// tracked models every night, the rest of the market every Friday. It queues the sweep's start and exits; the running
// worker reads it, within the daily request budget, behind discovery and buyers' re-checks. docs/runbooks/worker.md
// says how to follow it.

const scope = process.argv[2];
if (scope !== 'tracked' && scope !== 'untracked') {
  process.stderr.write('usage: pnpm sweep:divar tracked|untracked\n');
  process.exit(2);
}

const logger = createLogger({
  service: 'carshenas-worker',
  version: 'sweep-divar',
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
  const jobId = await runtime.enqueue(DIVAR_FRESHNESS.startSweep, { scope });
  logger.info('sweep started', { source: 'divar', scope, jobId });
} finally {
  await boss.stop({ graceful: false, close: true });
  await db.destroy();
  await logger.flush();
}
