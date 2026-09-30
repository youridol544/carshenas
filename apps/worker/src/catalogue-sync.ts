import { createErrorCapture } from '@carshenas/observability/capture';
import { createLogger } from '@carshenas/observability/logger';
import { CURATION_DOUBTS } from './catalogue/divar-catalogue.ts';
import { matchShares, unclassifiedModels } from './db/catalogue-store.ts';
import { createWorkerDatabase } from './db/database.ts';
import { env } from './env.ts';
import { refreshCatalogue } from './jobs/catalogue.ts';
import { TRACKED_MODELS } from './sources/divar/tracked-models.ts';

// `pnpm catalogue:sync`: brings the catalogue up to date now instead of at the next ten minutes (CS-50): the curated
// codes, makes and models, what the stored listings' keys add, Persian names from the posts, and every listing's match;
// then the matched share for Divar and for each tracked model (criterion 2), and the body types curated with doubt. It
// reads only what is stored and can run beside the worker. docs/runbooks/worker.md says how to read it.

const logger = createLogger({
  service: 'carshenas-worker',
  version: 'catalogue-sync',
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
  const refreshed = await refreshCatalogue(db, 'divar');
  logger.info('catalogue refreshed', { source: 'divar', ...refreshed });
  const shares = await matchShares(
    db,
    'divar',
    TRACKED_MODELS.map((model) => model.brandModel),
  );
  for (const share of shares) {
    const matched = share.trim + share.model;
    logger.info('catalogue match', {
      ...share,
      scope: share.scope ?? 'all of divar',
      matchedPercent: share.listings === 0 ? null : Math.round((1000 * matched) / share.listings) / 10,
      trimPercent: share.listings === 0 ? null : Math.round((1000 * share.trim) / share.listings) / 10,
    });
  }
  const unclassified = await unclassifiedModels(db, 'divar');
  logger.info('models listed without a body type', {
    count: unclassified.length,
    models: unclassified.slice(0, 50),
  });
  logger.info('body types curated with doubt', { count: CURATION_DOUBTS.length, models: CURATION_DOUBTS });
} finally {
  await db.destroy();
  await logger.flush();
}
