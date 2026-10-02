import { createErrorCapture } from '@carshenas/observability/capture';
import { createLogger } from '@carshenas/observability/logger';
import { createWorkerDatabase } from './db/database.ts';
import { env } from './env.ts';
import { rebuildSearch } from './jobs/search.ts';

// `pnpm search:rebuild` (CS-59 criterion 3): rebuilds the search table from the listings, every row, in id ranges of
// about 2,000 listings a statement inside one transaction, then the counts pages read and the typo vocabulary, each in
// a transaction of its own, as the nightly search.rebuild does. Readers keep the old rows until the rows commit. It
// sends no request to any source and can run beside the worker: it waits up to 30 seconds for a refresh to finish,
// and exits 1 when it could not get the build lock.

const logger = createLogger({
  service: 'carshenas-worker',
  version: 'search-rebuild',
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

try {
  const started = performance.now();
  const run = await rebuildSearch(db, {
    onChunk: (chunk) => {
      logger.info('search rows built', { ...chunk });
    },
  });
  logger.info('search rebuilt', { ...run, durationMs: Math.round(performance.now() - started) });
  if (run.skipped > 0) process.exitCode = 1;
} finally {
  await db.destroy();
  await logger.flush();
}
