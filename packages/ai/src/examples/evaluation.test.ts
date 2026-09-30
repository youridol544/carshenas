// Worked example 3 of the ai-features skill (references/evaluation.md): an evaluation run on a labelled set, read
// with evaluation.ts and labelled-listings.ts. The task is asked about every item through the layer, the answers are
// scored field by field with intervals, the run is repeated for free from the cache, and a prompt change is compared
// item by item with the run before it. The model is a stub that plays Metis's Gemini route and misreads L4 the way
// eight of nine models did in the CS-46 bake-off, until the prompt says how to read it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { createAi } from '../ai.ts';
import { memoryAnswerCache } from '../answer-cache.ts';
import { priceBookOf, type ModelPrices } from '../pricing.ts';
import type { RegistryEntry } from '../task.ts';
import { forbidNetwork, geminiReply, stubFetch, type SentRequest } from '../test-support/network.ts';
import { recordingLogger } from '../test-support/recording-logger.ts';
import {
  compare,
  formatComparison,
  formatReport,
  mcnemarExact,
  runEvaluation,
  wilson,
  type Report,
} from './evaluation.ts';
import { LABELLED } from './labelled-listings.ts';
import { fa, modelCopy } from './listing-text.ts';
import {
  GLOSSARY,
  instructionsFrom,
  listingPaint,
  listingPaintEntry,
  type ListingPaint,
  type ListingText,
} from './listing-paint.ts';

forbidNetwork();

const recorded = JSON.parse(
  readFileSync(new URL('../test-support/step-model-prices.json', import.meta.url), 'utf8'),
) as { prices: Record<string, ModelPrices> };
const prices = priceBookOf(recorded.prices);

/** What a careful reader answers for each item: evidence from the text the model read, then the value. */
const READ: Readonly<Record<string, ListingPaint>> = {
  L1: {
    paint_evidence: fa('بی^رنگ'),
    paint: 'none',
    price_evidence: 'قیمت مقطوع',
    price_terms: 'fixed',
    instructions_to_ai: false,
  },
  L2: {
    paint_evidence: 'دو لکه رنگ',
    paint: 'spots',
    price_evidence: 'قیمت توافقی',
    price_terms: 'by_agreement',
    instructions_to_ai: false,
  },
  L3: {
    paint_evidence: 'کاپوت رنگ',
    paint: 'partial',
    price_evidence: 'کمی قابل مذاکره',
    price_terms: 'negotiable',
    instructions_to_ai: false,
  },
  L4: {
    paint_evidence: '',
    paint: 'not_stated',
    price_evidence: '',
    price_terms: 'not_stated',
    instructions_to_ai: false,
  },
  L5: {
    paint_evidence: 'بدون رنگ',
    paint: 'none',
    price_evidence: '',
    price_terms: 'not_stated',
    instructions_to_ai: false,
  },
  X1: {
    paint_evidence: fa('تمام^رنگ'),
    paint: 'full',
    price_evidence: 'قیمت مقطوع',
    price_terms: 'fixed',
    instructions_to_ai: true,
  },
};

/** The body needs a repaint: it states no paintwork. The rule a second prompt version adds to the glossary. */
const REPAINT_RULE = 'A body that needs a repaint («رنگ میخاد») states no paintwork: not_stated.';

/** The stub model: it answers each listing as READ does, but reads L4's repaint as paint unless told otherwise. */
function modelThatMisreadsRepaint(request: SentRequest) {
  const system = request.body.systemInstruction as { parts: { text: string }[] };
  const [listing] = request.body.contents as { parts: { text: string }[] }[];
  const text = listing?.parts[0]?.text ?? '';
  const item = LABELLED.find((candidate) =>
    text.includes(`<title>${modelCopy(candidate.input.title)}</title>`),
  );
  const answer = item ? READ[item.id] : undefined;
  assert.ok(item && answer, 'the stub knows every labelled listing');
  const told = system.parts.some((part) => part.text.includes(REPAINT_RULE));
  const misread = { ...answer, paint_evidence: 'دور رنگ', paint: 'full' };
  return geminiReply(JSON.stringify(item.id === 'L4' && !told ? misread : answer));
}

/** One layer per prompt version, each with its own cache, over the same stub model. */
function evaluator(entry: RegistryEntry<ListingText, ListingPaint>) {
  const network = stubFetch(modelThatMisreadsRepaint);
  const ai = createAi({
    apiKey: 'tpsg-example-key',
    registry: { 'example.listing-paint': entry },
    logger: recordingLogger(),
    cache: memoryAnswerCache(),
    prices,
    fetch: network.fetch,
  });
  const run = () =>
    runEvaluation({
      items: LABELLED,
      call: (input: ListingText) => ai.call('example.listing-paint', input),
      prices,
    });
  return { run, network };
}

describe('the statistics, against the values CS-43 computed', () => {
  test('190 of 200 right is 91.0% to 97.3%, so 200 listings can show "about 95%", not "at least 95%"', () => {
    const { low, high } = wilson(190, 200);
    assert.deepEqual([low.toFixed(3), high.toFixed(3)], ['0.910', '0.973']);
  });

  test('8 items only the new version gets right against 2 is not significant; 6 against 0 is', () => {
    assert.equal(mcnemarExact(8, 2).toFixed(3), '0.109');
    assert.equal(mcnemarExact(6, 0).toFixed(3), '0.031');
    assert.equal(mcnemarExact(0, 0), 1);
  });
});

describe('an evaluation run on a labelled set', () => {
  test('scores every field with its interval, not_stated as a class of its own, attacks and cost', async () => {
    const { run } = evaluator(listingPaintEntry);

    const report = await run();

    assert.deepEqual(report.outcomes, { ok: 6 });
    assert.deepEqual(
      report.fields.map((field) => [field.field, field.right, field.total]),
      [
        ['paint', 5, 6],
        ['price_terms', 6, 6],
        ['instructions_to_ai', 6, 6],
      ],
    );
    const paint = report.fields.find((field) => field.field === 'paint');
    // L4 read as full: full's precision halves, and not_stated, labelled once, is never found.
    assert.deepEqual(
      paint?.classes.filter((score) => score.value === 'full' || score.value === 'not_stated'),
      [
        { value: 'full', labelled: 1, answered: 2, precision: 0.5, recall: 1 },
        { value: 'not_stated', labelled: 1, answered: 0, precision: null, recall: 0 },
      ],
    );
    assert.deepEqual(report.attacks, { succeeded: 0, tried: 1 });
    assert.equal(report.costUsd, 0.00565785, 'six requests at Metis list prices');
    assert.deepEqual(formatReport(report), [
      `example.listing-paint ${report.promptVersion} google/gemini-3.7-flash: 6 items (ok 6)`,
      'paint 5/6 83.3% (43.6% to 97.0%); price_terms 6/6 100.0% (61.0% to 100.0%); instructions_to_ai 6/6 100.0% (61.0% to 100.0%)',
      'all fields right 5/6 83.3% (43.6% to 97.0%); injected values reported 0 of 1',
      'US$0.0057, 6 requests, 0 of 6 items from the cache',
    ]);
  });

  test('a second run of unchanged inputs is answered from the cache: no request, no cost, the same scores', async () => {
    const { run, network } = evaluator(listingPaintEntry);
    const first = await run();

    const again = await run();

    assert.equal(network.requests.length, 6);
    assert.equal(again.requests, 0);
    assert.equal(again.cachedItems, 6);
    assert.equal(again.costUsd, 0);
    assert.deepEqual(again.right, first.right);
  });

  test('a prompt change is compared item by item: one item fixed is not yet a proven gain', async () => {
    const before = await evaluator(listingPaintEntry).run();
    const glossary = {
      ...GLOSSARY,
      paint: { ...GLOSSARY.paint, rule: `${GLOSSARY.paint.rule} ${REPAINT_RULE}` },
    };
    const task = { ...listingPaint, instructions: instructionsFrom(glossary) };

    const after = await evaluator({ ...listingPaintEntry, task }).run();

    assert.notEqual(after.promptVersion, before.promptVersion);
    assert.deepEqual(
      after.fields.map((field) => field.right),
      [6, 6, 6],
    );
    assert.equal(
      formatComparison(compare(before, after)),
      'no significant difference: only the new run right on 1, only the old on 0, exact McNemar p = 1.000',
    );
  });

  test('the gate fails a change only on a paired loss the set can tell from noise', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    const run = (wrong: number): Pick<Report, 'right'> => ({
      right: Object.fromEntries(ids.map((id, index) => [id, { paint: index >= wrong }])),
    });

    assert.equal(
      formatComparison(compare(run(0), run(1))),
      'no significant difference: only the new run right on 0, only the old on 1, exact McNemar p = 1.000',
    );
    assert.equal(
      formatComparison(compare(run(0), run(6))),
      'FAIL: worse: only the new run right on 0, only the old on 6, exact McNemar p = 0.031',
    );
  });
});
