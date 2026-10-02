// The labelled set through plain-Farsi search with no model (CS-62): what code alone reads, against the labels, from the
// frozen lexicon (data/lexicon-rows.json). Free and offline: the loop for writing the code pass, and the number the
// report quotes for the share of queries code settles.
//
//   pnpm --filter @carshenas/ai query-understanding:code-only [--split development|test|all] [--fails] [--id Q012]
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { buildLexicon, type LexiconRows } from '@carshenas/search/understand/lexicon';
import { understandQuery } from '@carshenas/search/understand/understand';
import { loadSet } from './data.ts';
import { attackSucceeded, bestAgainst, producedOf } from './score.ts';

const { values } = parseArgs({
  options: {
    split: { type: 'string', default: 'all' },
    fails: { type: 'boolean', default: false },
    id: { type: 'string' },
  },
});

const rows = JSON.parse(
  readFileSync(new URL('./data/lexicon-rows.json', import.meta.url), 'utf8'),
) as LexiconRows;
const lexicon = buildLexicon(rows);
const set = loadSet().filter(
  (item) =>
    (values.split === 'all' || item.split === values.split) &&
    (values.id === undefined || item.id === values.id),
);

let right = 0;
let settledOk = 0;
let settledTotal = 0;
let askedForModel = 0;
const byCategory = new Map<string, { right: number; total: number }>();
const attacks = { tried: 0, succeeded: 0 };
for (const item of set) {
  const { understanding, trace } = await understandQuery(item.text, { lexicon, solarYear: 1405 });
  const produced = producedOf(understanding);
  const { results, allRight } = bestAgainst(item, produced);
  const asked = trace.asked !== null;
  if (asked) askedForModel += 1;
  if (item.settledByCode) {
    settledTotal += 1;
    if (!asked) settledOk += 1;
  }
  for (const witness of item.attacks) {
    attacks.tried += 1;
    if (attackSucceeded(witness, produced)) attacks.succeeded += 1;
  }
  const own = byCategory.get(item.category) ?? { right: 0, total: 0 };
  own.total += 1;
  if (allRight) {
    right += 1;
    own.right += 1;
  }
  byCategory.set(item.category, own);
  const wrongSettled = item.settledByCode && asked;
  if ((!allRight || wrongSettled) && (values.fails || values.id !== undefined)) {
    console.log(`\n${item.id} [${item.split}/${item.category}] ${item.text}`);
    console.log(
      `  asked the model: ${String(trace.asked)}${wrongSettled ? '  (labelled settledByCode)' : ''}`,
    );
    for (const result of results.filter((one) => !one.right)) {
      console.log(
        `  ${result.field}: expected ${result.expected === '' ? '(none)' : result.expected} | got ${result.got === '' ? '(none)' : result.got}`,
      );
    }
    if (values.id !== undefined) console.log(JSON.stringify(understanding, null, 2));
  }
}
console.log(
  `\n${String(set.length)} queries: ${String(right)} fully right by code alone (${((100 * right) / set.length).toFixed(1)}%)`,
);
console.log(
  `code asked for the model on ${String(askedForModel)}; of ${String(settledTotal)} labelled settledByCode, ${String(settledOk)} needed none`,
);
console.log(`attacks: ${String(attacks.succeeded)} of ${String(attacks.tried)} succeeded`);
for (const [category, count] of byCategory)
  console.log(`  ${category.padEnd(12)} ${String(count.right)}/${String(count.total)}`);
