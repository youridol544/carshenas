import { tehranIsoDate } from '@carshenas/locale/format-date';
import { createErrorCapture } from '@carshenas/observability/capture';
import { createLogger } from '@carshenas/observability/logger';
import { createWorkerDatabase } from './db/database.ts';
import { loadComparables, loadMileageCandidates, type MileageCandidate } from './db/valuation-store.ts';
import { env } from './env.ts';
import { fitValuation } from './valuation/fit.ts';
import { decideMileage, priceRatioAt, valueGap } from './valuation/mileage.ts';
import { MILEAGE_NORM_KM_PER_YEAR, WINDOW_DAYS } from './valuation/method.ts';
import { jalaliYearOf } from './valuation/run.ts';

// `pnpm mileage:measure`: the numbers behind CS-101's price test, on the listings in this database, printed as JSON
// (docs/evidence/listing-facts/2026-10-03-mileage-in-thousands.md reports one run). It sends no request to any source.
//   - readings: how many listings hold each reading, and for every listing with a figure under the floor the asking
//     price over the model's market value at 1,000 times the figure (`ratio`), at the figure as written (`ratioWritten`)
//     and at the norm mileage for its age (`ratioNorm`), and the gap between the two readings' values (`gap`);
//   - falseAssumption: the listings whose words say the car is really that low, run through the price test as if the
//     words were absent and the seller had written their own figure (100 when it was 0, a typical figure in thousands):
//     how many the test would have read in thousands;
//   - recall: stated mileages of 60,000 to 400,000 km on cars of three or more model years, written as thousands as a
//     seller would («۱۰۹» for 109,000), through the same test: how many it reads in thousands.

const logger = createLogger({
  service: 'carshenas-worker',
  version: 'measure-mileage',
  environment: env.environment,
  level: 'error',
  format: env.logFormat,
});
const db = createWorkerDatabase(
  { connectionString: env.databaseUrl, logSql: false, logParameters: false },
  logger,
  createErrorCapture(logger),
);
const asOfDate = tehranIsoDate(new Date());
const year = jalaliYearOf(asOfDate);
const comparables = await loadComparables(db, { asOfDate, windowDays: WINDOW_DAYS });
const { model } = fitValuation(comparables, year);
const all = await loadMileageCandidates(db, { asOfDate, windowDays: WINDOW_DAYS }, 'all');

const round = (value: number | undefined): number | null =>
  value === undefined ? null : Math.round(value * 1000) / 1000;

const readings = all.map((candidate) => {
  const age = year - candidate.attributes.modelYearSh;
  const figure = candidate.writtenKm;
  return {
    id: candidate.listingId,
    reading: candidate.storedReading,
    age,
    written: figure,
    priceMillionToman: candidate.askingPriceToman / 1e6,
    ratio: figure >= 1 ? round(priceRatioAt(model, candidate, year, figure * 1000)) : null,
    ratioWritten: round(priceRatioAt(model, candidate, year, figure)),
    ratioNorm: round(priceRatioAt(model, candidate, year, MILEAGE_NORM_KM_PER_YEAR * Math.max(age, 0.5))),
    gap: figure >= 1 ? round(valueGap(model, candidate, year)) : null,
  };
});

const passes = (candidate: MileageCandidate): boolean => decideMileage(model, candidate, year).thousands;
const asIfTyped = (candidate: MileageCandidate): MileageCandidate => {
  const writtenKm = candidate.writtenKm >= 1 ? candidate.writtenKm : 100;
  return { ...candidate, writtenKm, attributes: { ...candidate.attributes, mileageKm: writtenKm } };
};
const really = all.filter((candidate) => candidate.storedReading === 'really_low');
const falseAssumption = {
  tested: really.length,
  readAsThousands: really.filter((candidate) => passes(asIfTyped(candidate))).length,
  ids: really.filter((candidate) => passes(asIfTyped(candidate))).map((candidate) => candidate.listingId),
};

const recallByAge = new Map<string, { tested: number; read: number }>();
for (const { listingId, modelId, trimId, attributes, askingPriceToman } of comparables) {
  const age = year - attributes.modelYearSh;
  if (age < 3 || attributes.mileageKm < 60_000 || attributes.mileageKm > 400_000) continue;
  const writtenKm = Math.round(attributes.mileageKm / 1000);
  if (writtenKm < 1 || writtenKm > 999) continue;
  const candidate: MileageCandidate = {
    listingId,
    modelId,
    trimId,
    askingPriceToman,
    writtenKm,
    storedReading: 'unread',
    attributes: { ...attributes, mileageKm: writtenKm },
  };
  const bucket = age <= 5 ? '3-5' : age <= 10 ? '6-10' : '11+';
  const entry = recallByAge.get(bucket) ?? { tested: 0, read: 0 };
  entry.tested += 1;
  if (passes(candidate)) entry.read += 1;
  recallByAge.set(bucket, entry);
}

process.stdout.write(
  `${JSON.stringify({ asOfDate, referenceYearSh: year, comparables: comparables.length, readings, falseAssumption, recall: Object.fromEntries(recallByAge) })}\n`,
);
await db.destroy();
