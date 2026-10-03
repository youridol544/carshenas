import { sql } from 'kysely';
import { tehranIsoDate } from '@carshenas/locale/format-date';
import { createErrorCapture } from '@carshenas/observability/capture';
import { createLogger } from '@carshenas/observability/logger';
import { createWorkerDatabase } from './db/database.ts';
import { loadComparables, loadMileageCandidates } from './db/valuation-store.ts';
import { env } from './env.ts';
import { fitValuation } from './valuation/fit.ts';
import { priceRatioAt } from './valuation/mileage.ts';
import { MILEAGE_NORM_KM_PER_YEAR, WINDOW_DAYS } from './valuation/method.ts';
import { jalaliYearOf } from './valuation/run.ts';

const logger = createLogger({ service: 'carshenas-worker', version: 'measure-mileage', environment: env.environment, level: 'error', format: env.logFormat });
const db = createWorkerDatabase({ connectionString: env.databaseUrl, logSql: false, logParameters: false }, logger, createErrorCapture(logger));
const asOfDate = tehranIsoDate(new Date());
const year = jalaliYearOf(asOfDate);
const comparables = await loadComparables(db, { asOfDate, windowDays: WINDOW_DAYS });
const { model } = fitValuation(comparables, year);
const all = await loadMileageCandidates(db, { asOfDate, windowDays: WINDOW_DAYS }, 'all');
const out = all.map((c) => {
  const age = year - c.attributes.modelYearSh;
  const norm = MILEAGE_NORM_KM_PER_YEAR * Math.max(age, 0.5);
  return {
    id: c.listingId, reading: c.storedReading, written: c.writtenKm, age, price: c.askingPriceToman / 1e6,
    rA: c.writtenKm >= 1 ? priceRatioAt(model, c, year, c.writtenKm * 1000) : null,
    rNorm: priceRatioAt(model, c, year, norm), rW: priceRatioAt(model, c, year, c.writtenKm),
  };
});
console.log(JSON.stringify(out));
void sql;
await db.destroy();
