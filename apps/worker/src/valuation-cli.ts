import { writeFile, mkdir } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { tehranIsoDate } from '@carshenas/locale/format-date';
import { createErrorCapture } from '@carshenas/observability/capture';
import { createLogger } from '@carshenas/observability/logger';
import { createWorkerDatabase } from './db/database.ts';
import { loadComparables, modelNames } from './db/valuation-store.ts';
import { env } from './env.ts';
import { TRACKED_MODELS } from './sources/divar/tracked-models.ts';
import { randomSplit, timeSplit, type SplitReport } from './valuation/evaluate.ts';
import { WINDOW_DAYS } from './valuation/method.ts';
import { jalaliYearOf, runValuation } from './valuation/run.ts';

// `pnpm valuation:run [--as-of YYYY-MM-DD]`: one valuation run now, as the daily job does it (CS-51); a rerun of a day
// replaces its run. `pnpm valuation:evaluate [--as-of YYYY-MM-DD] [--cut-days 7] [--write]`: the accuracy report of
// S01 on the live index, by time and at random; --write saves it to docs/evidence/valuation/<as-of>.md. Neither sends
// a request to any source.

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    'as-of': { type: 'string' },
    'cut-days': { type: 'string', default: '7' },
    write: { type: 'boolean', default: false },
  },
});
const command = positionals[0];
const asOfDate = values['as-of'] ?? tehranIsoDate(new Date());

const logger = createLogger({
  service: 'carshenas-worker',
  version: 'valuation',
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

function shiftDate(isoDate: string, days: number): string {
  return new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** The tracked models a split could not score, with how many listings each had on either side of it. */
function unscored(
  report: SplitReport,
  names: ReadonlyMap<number, string>,
  sides: ReadonlyMap<number, { learned: number; heldOut: number }>,
): string[] {
  const scored = new Set(report.models.map((model) => model.modelId));
  const byName = new Map([...names].map(([id, name]) => [name, id]));
  return TRACKED_MODELS.flatMap(({ nameFa }) => {
    const id = byName.get(nameFa);
    if (id !== undefined && scored.has(id)) return [];
    const side = id === undefined ? undefined : sides.get(id);
    return [
      `| ${nameFa} | yes | not scored: ${String(side?.learned ?? 0)} learned, ${String(side?.heldOut ?? 0)} held out (a rating needs 8 learned comparables and 3 within two model years) | | |`,
    ];
  });
}

function table(
  report: SplitReport,
  names: ReadonlyMap<number, string>,
  tracked: ReadonlySet<string>,
): string {
  const lines = [
    `Learned from ${String(report.learned)} comparables; ${String(report.candidates)} held out, ${String(report.overall?.tested ?? 0)} of them rateable.`,
    '',
    '| Model | Tracked | Tested | MdAPE | Within 10 % |',
    '|---|---|---|---|---|',
  ];
  for (const model of report.models) {
    const name = names.get(model.modelId) ?? String(model.modelId);
    lines.push(
      `| ${name} | ${tracked.has(name) ? 'yes' : ''} | ${String(model.tested)} | ${model.mdapePct.toFixed(2)} % | ${model.within10Pct.toFixed(1)} % |`,
    );
  }
  if (report.overall !== undefined)
    lines.push(
      `| **All** | | ${String(report.overall.tested)} | ${report.overall.mdapePct.toFixed(2)} % | ${report.overall.within10Pct.toFixed(1)} % |`,
    );
  return lines.join('\n');
}

try {
  if (command === 'run') {
    const summary = await runValuation(db, asOfDate);
    logger.info('valuation run', { asOfDate, ...summary });
  } else if (command === 'evaluate') {
    const cutDays = Number.parseInt(values['cut-days'], 10);
    const cutDate = shiftDate(asOfDate, -cutDays);
    const comparables = await loadComparables(db, { asOfDate, windowDays: WINDOW_DAYS });
    const referenceYearSh = jalaliYearOf(asOfDate);
    const time = timeSplit(comparables, asOfDate, cutDate, referenceYearSh);
    const sides = new Map<number, { learned: number; heldOut: number }>();
    for (const c of comparables) {
      const side = sides.get(c.modelId) ?? { learned: 0, heldOut: 0 };
      if (c.listedDate < cutDate) side.learned += 1;
      else side.heldOut += 1;
      sides.set(c.modelId, side);
    }
    const random = randomSplit(comparables, referenceYearSh);
    const names = await modelNames(db, [...new Set(comparables.map((c) => c.modelId))]);
    const tracked = new Set(TRACKED_MODELS.map((model) => model.nameFa));
    const report = [
      `# Valuation accuracy, ${asOfDate}`,
      '',
      `CS-51, docs/specs/S01-deal-ratings.md "Accuracy"; \`pnpm valuation:evaluate --as-of ${asOfDate} --cut-days ${String(cutDays)}\` on the live index (frozen releases wait for CS-49). ${String(comparables.length)} comparables in the ${String(WINDOW_DAYS)}-day window. MdAPE is the median absolute percentage error of the market value against the asking price; a listing is scored only where a rating would be given.`,
      '',
      `## Time split: learned before ${cutDate}, scored from ${cutDate} to ${asOfDate}`,
      '',
      table(time, names, tracked),
      ...unscored(time, names, sides),
      '',
      'The split is by the day Divar says a listing was posted, but every asking price is the one the crawler read, and the index was first filled on 2026-09-30: a listing posted before the cut carries its price as read today, not as it stood at the cut. This is a split by listing age, not yet a test on a market that moved; it becomes one once the index has weeks of price history (listing_price_event) or a frozen release (CS-49). Held-out listings are not filtered for outliers, which makes the error slightly pessimistic.',
      '',
      '## Random split: a seeded 80/20 split of the same comparables',
      '',
      table(random, names, tracked),
      '',
    ].join('\n');
    process.stdout.write(`${report}\n`);
    if (values.write) {
      const directory = new URL('../../../docs/evidence/valuation/', import.meta.url);
      await mkdir(directory, { recursive: true });
      await writeFile(new URL(`${asOfDate}.md`, directory), report);
    }
  } else {
    throw new Error('usage: valuation-cli.ts run|evaluate [--as-of YYYY-MM-DD] [--cut-days N] [--write]');
  }
} finally {
  await db.destroy();
  await logger.flush();
}
