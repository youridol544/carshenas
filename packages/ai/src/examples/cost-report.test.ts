// Worked example 5 of the ai-features skill (references/cost.md): a cost report, read with cost-report.ts. Calls go
// through the layer as a job makes them, the process's real JSON logger writes their lines, and the report sums the
// lines per task, prompt version and model: calls, answers from the cache, requests with their re-asks, tokens split
// by what each part costs, the cost at Metis's list, and latency. The lines hold no prompt, input or answer.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createLogger } from '@carshenas/observability/logger';
import { createAi } from '../ai.ts';
import { memoryAnswerCache } from '../answer-cache.ts';
import { priceBookOf, type ModelPrices } from '../pricing.ts';
import { forbidNetwork, geminiReply, stubFetch } from '../test-support/network.ts';
import { costReport, formatCostReport } from './cost-report.ts';
import { labelled } from './labelled-listings.ts';
import { fa } from '../tasks/listing-text.ts';
import { EXAMPLE_REGISTRY, type ListingPaint } from './listing-paint.ts';

forbidNetwork();

const recorded = JSON.parse(
  readFileSync(new URL('../test-support/step-model-prices.json', import.meta.url), 'utf8'),
) as { prices: Record<string, ModelPrices> };

const L1: ListingPaint = {
  paint_evidence: fa('بی^رنگ'),
  paint: 'none',
  price_evidence: 'قیمت مقطوع',
  price_terms: 'fixed',
  instructions_to_ai: false,
};
const L3: ListingPaint = {
  paint_evidence: 'کاپوت رنگ',
  paint: 'partial',
  price_evidence: 'کمی قابل مذاکره',
  price_terms: 'negotiable',
  instructions_to_ai: false,
};

test('a cost report sums the layer lines per task, prompt version and model', async () => {
  const written: string[] = ['plain text before the logger started'];
  const logger = createLogger({
    service: 'carshenas-worker',
    version: 'example',
    environment: 'test',
    destination: { write: (line: string) => written.push(line) },
  });
  // In turn: L1 right; L3 re-asked once, then right; L2 invalid twice.
  const network = stubFetch(
    ...[
      L1,
      { ...L3, paint_evidence: 'کاپوت رنگی' },
      L3,
      { ...L1, paint: 'full' },
      { ...L1, paint: 'full' },
    ].map((answer) => geminiReply(JSON.stringify(answer))),
  );
  const ai = createAi({
    apiKey: 'tpsg-example-key',
    registry: EXAMPLE_REGISTRY,
    logger,
    cache: memoryAnswerCache(),
    prices: priceBookOf(recorded.prices),
    fetch: network.fetch,
  });
  const outcomes = [];
  for (const id of ['L1', 'L1', 'L3', 'L2']) {
    outcomes.push((await ai.call('example.listing-paint', labelled(id).input)).outcome);
  }
  logger.info('models ready', { tasks: ['example.listing-paint'] });
  await logger.flush();

  const [row] = costReport(written);

  assert.deepEqual(outcomes, ['ok', 'ok', 'ok', 'invalid']);
  assert.ok(row);
  assert.deepEqual(
    { ...row, p50Ms: typeof row.p50Ms, p95Ms: typeof row.p95Ms },
    {
      task: 'example.listing-paint',
      promptVersion: ai.promptVersion('example.listing-paint'),
      modelName: 'google/gemini-3.7-flash',
      calls: 4,
      cachedCalls: 1,
      requests: 5,
      outcomes: { ok: 3, invalid: 1 },
      inputTokens: 1565,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      outputTokens: 830,
      reasoningTokens: 0,
      // Five requests at gemini-3.7-flash's list price: 313 tokens in at $0.825 and 166 out at $4.125 per million.
      costUsd: 0.004714875,
      costPer1000CallsUsd: 1.178719,
      p50Ms: 'number',
      p95Ms: 'number',
    },
  );
  assert.match(
    formatCostReport([row])[0] ?? '',
    /^example\.listing-paint [0-9a-f]{16} google\/gemini-3\.7-flash: 4 calls \(1 from the cache\), 5 requests \(ok 3, invalid 1\); tokens in 1565 \(0% from the provider cache\), out 830 \(0 reasoning\); US\$0\.0047, US\$1\.18 per 1,000 calls; p50 \d+ ms, p95 \d+ ms$/,
  );
  const everything = written.join('');
  for (const text of [labelled('L1').input.description, 'کاپوت رنگ', 'قیمت مقطوع']) {
    assert.ok(!everything.includes(text), 'no line holds the listing or the answer');
  }
});
