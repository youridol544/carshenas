import { writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, expect, inject, test, vi } from 'vitest';
import { toLatinDigits } from '@carshenas/locale/digits';
import { buildExplanation, type Explanation } from '@/features/listing/listing-explanation';
import { readListingPage } from '@/features/listing/server/listing-page-data';
import { assertScratchDatabase, ownerDatabase } from '@/server/db/account-test-database';
import { checkFigures, RULE_FIGURES } from '@/features/listing/server/figure-check';
import {
  expectedFigures,
  removeListingPage,
  seedListingPage,
  seedSampleVariants,
  type ListingTestData,
} from '@/server/db/listing-test-database';

// The faithfulness sample (CS-64, the 2026-09-28 field survey): the share of the explanation's sentences whose every
// number is supported by the stored facts, measured on a labelled sample of 30 real listings. The label of each
// listing is the database: every figure of its explanation is recomputed in SQL from the stored rows
// (expectedFigures) and every digit group of every sentence must be the text of a figure that checks out.
//
// Two forms. In the test run (`pnpm db:check`) it is bounded: ten listings of the scratch database's own seed, one of
// each rating and of the reasons for no rating, with no switch to turn it on. The report of the full sample reads the
// database it is pointed at and writes nothing to it, so it runs only when asked:
//   EXPLANATION_SAMPLE=docs/evidence/listing-page/2026-10-02-explanation-faithfulness.md \
//     pnpm --filter @carshenas/web exec vitest run --config vitest.db.config.mts listing-explanation-sample
// The sample is deterministic (ordered by a hash of the listing's id): four listings of each rating and, of the others, two
// of each of five reasons for no rating, so every kind of sentence is read.

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  cache: <T>(fn: T) => fn,
}));
vi.mock('@/server/observability/logger', async () => {
  const { recordingLogger } = await import('@/server/observability/recording-logger');
  return { logger: recordingLogger(), captureError: vi.fn() };
});

const report = inject('explanationSampleReport');
const full = report !== '';
const owner = ownerDatabase();
let seeded: ListingTestData | undefined;
beforeAll(async () => {
  if (full) return;
  await assertScratchDatabase(owner);
  seeded = await seedListingPage(owner, randomBytes(4).toString('hex'));
  await seedSampleVariants(owner, seeded);
});
afterAll(async () => {
  if (seeded !== undefined) await removeListingPage(owner, seeded);
  await owner.destroy();
});

const RATINGS = ['great', 'good', 'fair', 'high', 'overpriced'] as const;
/** The reasons a listing with a market value can have no rating, and how many of each the sample takes (the others are in the unit tests). */
const REASONS = [
  ['installment_price', full ? 3 : 1],
  ['price_outlier', full ? 3 : 1],
  ['dealer_new_car', full ? 4 : 1],
  ['no_asking_price', full ? 0 : 1],
] as const;

async function sample(): Promise<{ id: number; label: string }[]> {
  const latest = owner
    .selectFrom('valuation_run')
    .select('id')
    .where('status', '=', 'succeeded')
    .orderBy('as_of_date', 'desc')
    .orderBy('id', 'desc')
    .limit(1);
  const chosen: { id: number; label: string }[] = [];
  for (const rating of RATINGS) {
    const rows = await owner
      .selectFrom('listing_valuation as v')
      .innerJoin('listing as l', 'l.id', 'v.listing_id')
      .select('v.listing_id')
      .where('v.valuation_run_id', '=', latest)
      .where('l.status', '=', 'active')
      .where('v.deal_rating', '=', rating)
      .orderBy((eb) => eb.fn('md5', [eb.cast('v.listing_id', 'text')]))
      .limit(full ? 4 : 1)
      .execute();
    chosen.push(...rows.map((row) => ({ id: row.listing_id, label: rating })));
  }
  for (const [reason, take] of REASONS) {
    const rows = await owner
      .selectFrom('listing_valuation as v')
      .innerJoin('listing as l', 'l.id', 'v.listing_id')
      .select('v.listing_id')
      .where('v.valuation_run_id', '=', latest)
      .where('l.status', '=', 'active')
      .where('v.no_rating_reason', '=', reason)
      .where('v.market_value_toman', 'is not', null)
      .orderBy((eb) => eb.fn('md5', [eb.cast('v.listing_id', 'text')]))
      .limit(take)
      .execute();
    chosen.push(...rows.map((row) => ({ id: row.listing_id, label: reason })));
  }
  return chosen;
}

function sentencesOf(explanation: Explanation): string[] {
  const names = explanation.names;
  const strip = (text: string) => names.reduce((rest, name) => rest.replaceAll(name, ''), text);
  return [explanation.verdict, ...explanation.lines.map((line) => line.text), ...explanation.method].map(
    strip,
  );
}

function digitGroups(text: string): string[] {
  return (
    toLatinDigits(text)
      .replace(/(?<=\d)[٬,](?=\d)/g, '')
      .match(/\d+(?:[.٫]\d+)?/g) ?? []
  );
}

test('the explanations of a labelled sample of listings are faithful to the stored facts, in number and in text', async () => {
  const listings = await sample();
  expect(listings.length).toBe(full ? 30 : 9);
  const rows: string[] = [];
  let sentences = 0;
  let faithfulSentences = 0;
  let figures = 0;
  let recomputed = 0;
  let constants = 0;
  let faithfulExplanations = 0;
  for (const { id, label } of listings) {
    const result = await readListingPage(id);
    if (result.status !== 'found') throw new Error(`listing ${String(id)} is missing`);
    const { page } = result;
    const explanation = buildExplanation({
      listing: page.listing,
      valuation: page.valuation,
      comparables: page.comparables,
    });
    const check = checkFigures(explanation, await expectedFigures(owner, id));
    const allowed = new Set(explanation.figures.flatMap((figure) => digitGroups(figure.text)));
    const all = sentencesOf(explanation);
    const faithful = all.filter((sentence) => digitGroups(sentence).every((group) => allowed.has(group)));
    sentences += all.length;
    faithfulSentences += faithful.length;
    figures += explanation.figures.length;
    recomputed += check.checked;
    constants += explanation.figures.filter((figure) => RULE_FIGURES.has(figure.id)).length;
    const ok = check.wrong.length === 0 && check.unverified.length === 0 && faithful.length === all.length;
    if (ok) faithfulExplanations += 1;
    rows.push(
      `| ${String(id)} | ${label} | ${String(explanation.figures.length)} | ${String(check.checked)} | ${String(faithful.length)} / ${String(all.length)} | ${ok ? 'yes' : 'NO: ' + [...check.wrong, ...check.unverified].join('; ')} |`,
    );
    expect(check.wrong, `listing ${String(id)}`).toEqual([]);
    expect(check.unverified, `listing ${String(id)}`).toEqual([]);
  }
  const rate = (part: number, whole: number) =>
    `${String(part)} of ${String(whole)} (${(whole === 0 ? 0 : (100 * part) / whole).toFixed(1)} %)`;
  const text = [
    '# Explanation faithfulness on a labelled sample (CS-64)',
    '',
    `- Date: ${new Date().toISOString().slice(0, 10)}`,
    "- Method: for each sampled listing the page's explanation is built from the listing page's data (`readListingPage`, as the page reads it) and every number it quotes (a **figure**, recorded with its source by `buildExplanation`) is recomputed in SQL from the stored rows (`expectedFigures`, sharing no code with the explanation), and the text the page displays for it is compared with the text the recomputed values must be written as. A **sentence** is faithful when every group of digits in it is the text of a figure that was recomputed and matched.",
    '- Sample: 30 listings of the latest succeeded valuation run: four of each rating and three of price_outlier, three of installment_price and four of dealer_new_car, ordered by a hash of the listing id. The explanations are made by templates from stored facts, with no language model.',
    '',
    `- Listings whose every figure matched and every sentence is faithful: ${rate(faithfulExplanations, listings.length)}`,
    `- Sentences faithful: ${rate(faithfulSentences, sentences)}`,
    `- Figures recorded: ${String(figures)}; recomputed from the stored rows and matched: ${String(recomputed)}; a rule's own constant, read back from its home by \`listing-page-data.db.test.ts\`: ${String(constants)}`,
    '',
    '| Listing | Rating or reason | Figures | Recomputed | Faithful sentences | Faithful |',
    '|---|---|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');
  if (full) writeFileSync(report, text);
  expect(faithfulExplanations).toBe(listings.length);
  expect(faithfulSentences).toBe(sentences);
});
