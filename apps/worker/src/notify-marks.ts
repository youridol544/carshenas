import { createErrorCapture } from '@carshenas/observability/capture';
import { createLogger } from '@carshenas/observability/logger';
import { createWorkerDatabase } from './db/database.ts';
import { notifyMarkEvents } from './db/mark-store.ts';
import { env } from './env.ts';

// `pnpm marks:notify` (CS-69): one pass of the marks.notify job outside the queue, until nothing is left: price drops,
// sales and returns of marked listings become inbox notifications through the shared helper. The worker does the same
// every two minutes; this is for a person who wants it now and for the browser tests, which change a price and then
// need the notification. It sends no request to any source and prints what it told as one JSON line.

const BATCH = 500;

const logger = createLogger({
  service: 'carshenas-worker',
  version: 'marks-notify',
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
  const total = { priceDrops: 0, offMarket: 0, relisted: 0, skipped: 0 };
  for (;;) {
    const run = await notifyMarkEvents(db, BATCH);
    total.priceDrops += run.priceDrops;
    total.offMarket += run.offMarket;
    total.relisted += run.relisted;
    total.skipped += run.skipped;
    if (!run.more) break;
  }
  process.stdout.write(`${JSON.stringify(total)}\n`);
} finally {
  await db.destroy();
  await logger.flush();
}
