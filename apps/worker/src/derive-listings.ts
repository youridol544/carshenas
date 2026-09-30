import { createErrorCapture } from '@carshenas/observability/capture';
import { createLogger } from '@carshenas/observability/logger';
import { createWorkerDatabase } from './db/database.ts';
import { env } from './env.ts';
import { deriveStoredListings } from './listing-derivation.ts';
import { PARSERS } from './sources/parsers.ts';

// `pnpm derive:listings`: re-derives what every stored listing says from its latest snapshot, with its source's current
// parser (CS-34 criterion 4), so a parser change never needs a new crawl. It sends no request to any source and can run
// beside the worker. It logs, per field, how many listings stated a value the parser read, a form meaning unknown, a
// value it could not read, or nothing; then each text it could not read and each row it does not know, most common
// first; then one line with the totals. docs/runbooks/worker.md says when to run it.

const logger = createLogger({
  service: 'carshenas-worker',
  version: 'derive-listings',
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
  const report = await deriveStoredListings(db, PARSERS);
  for (const [field, counts] of Object.entries(report.fields))
    logger.info('field derived', { field, ...counts });
  for (const [text, listings] of report.unparsedTexts) logger.info('value not read', { text, listings });
  for (const [label, listings] of report.unknownLabels) logger.info('row not known', { label, listings });
  logger.info('listings derived', {
    sources: Object.keys(PARSERS),
    derived: report.derived,
    withoutSnapshot: report.withoutSnapshot,
    unreadable: report.unreadable.length,
    unreadableListingIds: report.unreadable.slice(0, 20),
    attributesChanged: report.attributesChanged,
    photosChanged: report.photosChanged,
    unparsedChanged: report.unparsedChanged,
    photosKept: report.photosKept,
    photosSkipped: report.photosSkipped,
  });
} finally {
  await db.destroy();
  await logger.flush();
}
