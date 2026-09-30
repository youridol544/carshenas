import { postgresAnswerCache } from '@carshenas/ai/answer-store';
import { installProcessHandlers } from '@carshenas/observability/process';
import { createWorkerDatabase } from './db/database.ts';
import { env } from './env.ts';
import { checkHealth } from './health.ts';
import { startHealthServer } from './health-server.ts';
import { JOBS } from './jobs/registry.ts';
import { startModels } from './models.ts';
import { releaseOf, startObservability } from './observability.ts';
import { createBoss } from './runtime/boss.ts';
import { startHeartbeat } from './runtime/heartbeat.ts';
import { createRuntime } from './runtime/runtime.ts';

// The worker process (ADR-0011 point 5, ADR-0018): `pnpm worker`, or `pnpm worker:dev` to restart on changes.
// docs/runbooks/worker.md says how to run, stop and inspect it. On SIGTERM or SIGINT it stops claiming jobs, lets
// running ones finish for up to 30 seconds, closes its pools and exits 0; a second signal exits at once.

const SHUTDOWN_GRACE_MS = 30_000;

const release = releaseOf(env.release);
const { logger, errors, tracing } = startObservability({
  release,
  environment: env.environment,
  level: env.logLevel,
  format: env.logFormat,
  exportTraces: env.exportTraces,
});
// An uncaught exception or unhandled rejection: one fatal line, exit 1, and the supervisor restarts the worker.
installProcessHandlers(logger);

const db = createWorkerDatabase(
  { connectionString: env.databaseUrl, logSql: env.logSql, logParameters: env.isDevelopment && env.logSql },
  logger,
  errors,
);
// Before any job is claimed: a registered job that calls models needs METIS_API_KEY, and without it the worker stops
// here with one fatal line that says where to set it (ADR-0019 point 1).
const models = await startModels({
  jobs: JOBS,
  apiKey: env.metisApiKey,
  pricingUrl: env.metisPricingUrl,
  logger,
  cache: postgresAnswerCache(db),
});
const boss = createBoss({ connectionString: env.databaseUrl, logger, errors });
const runtime = createRuntime({
  boss,
  db,
  logger,
  errors,
  jobs: JOBS,
  ...(models && { models }),
  userAgent: () => env.crawlerUserAgent,
});

await runtime.start();
// After the runtime, so the section never shows a worker alive that cannot claim jobs.
const heartbeat = await startHeartbeat({ db, version: release, errors });
const health = await startHealthServer(env.healthPort, () =>
  checkHealth({
    db,
    queueSchemaVersion: () => boss.schemaVersion(),
    isRunning: () => runtime.isRunning(),
    lanes: () => runtime.lanes(),
    errors,
  }),
);
logger.info('worker started', {
  healthPort: health.port,
  graceMs: SHUTDOWN_GRACE_MS,
  instanceId: heartbeat.instance.instanceId,
});

let stopping = false;
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (stopping) {
    logger.warn('worker forced to stop', { signal });
    await logger.flush();
    process.exit(1);
  }
  stopping = true;
  logger.info('worker stopping', { signal });
  const started = performance.now();
  await health.close();
  await runtime.stop(SHUTDOWN_GRACE_MS);
  // A failed stop is reported, not fatal: the section then shows the worker down once its beats stop.
  await heartbeat.stop().catch((error: unknown) => {
    errors.capture(error, { message: 'worker heartbeat stop failed', fields: { component: 'heartbeat' } });
  });
  await db.destroy();
  await tracing?.shutdown();
  logger.info('worker stopped', { signal, durationMs: Math.round(performance.now() - started) });
  await logger.flush();
  process.exit(0);
}

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    shutdown(signal).catch((error: unknown) => {
      logger.fatal('worker could not stop cleanly', { err: error, signal });
      process.exit(1);
    });
  });
}
