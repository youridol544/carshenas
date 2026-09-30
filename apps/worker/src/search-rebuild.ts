import { createErrorCapture } from '@carshenas/observability/capture';
import { createLogger } from '@carshenas/observability/logger';
import { createWorkerDatabase } from './db/database.ts';
import { env } from './env.ts';
import { rebuildSearch } from './jobs/search.ts';
import { TRACKED_MODELS } from './sources/divar/tracked-models.ts';

// `pnpm search:rebuild` (CS-59 criterion 3): rebuilds the search table from the listings, every row, then the counts
// pages read and the typo vocabulary, in one transaction, as the nightly search.rebuild does. Readers keep the old rows
// until it commits. It sends no request to any source and can run beside the worker, which waits for it.

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
  const rebuilt = await rebuildSearch(db, { sourceId: 'divar', trackedModels: TRACKED_MODELS });
  logger.info('search rebuilt', { ...rebuilt, durationMs: Math.round(performance.now() - started) });
} finally {
  await db.destroy();
  await logger.flush();
}
