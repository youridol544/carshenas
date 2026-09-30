// Pricing a call at Metis's live list price (ADR-0021 point 2.5): the endpoint's answer as recorded on 2026-09-29
// (CS-43), tiers by prompt length, each kind of token at its own rate, and the daily refresh.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import type { TokenUsage } from './call.ts';
import {
  costUsd,
  createMetisPriceBook,
  METIS_PRICING_URL,
  parseMetisPricing,
  type ModelPrices,
} from './pricing.ts';
import { forbidNetwork, stubFetch } from './test-support/network.ts';
import { recordingLogger } from './test-support/recording-logger.ts';

forbidNetwork();

const RECORDED: unknown = JSON.parse(
  readFileSync(new URL('./test-support/metis-pricing.json', import.meta.url), 'utf8'),
);
const prices = parseMetisPricing(RECORDED);
const of = (model: string): ModelPrices => {
  const found = prices[model];
  assert.ok(found, `Metis lists ${model}`);
  return found;
};

const usage = (parts: Partial<TokenUsage>): TokenUsage => ({
  inputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  outputTokens: 0,
  reasoningTokens: 0,
  ...parts,
});

describe("Metis's pricing answer", () => {
  test('lists every model it prices, and skips a row it cannot read instead of failing', () => {
    assert.deepEqual(Object.keys(prices).sort(), [
      'claude-haiku-4-5',
      'claude-sonnet-5',
      'deepseek-v4-flash',
      'deepseek-v4.1-flash',
      'gemini-3.1-flash-lite',
      'gpt-5.4-mini',
      'gpt-5.4-nano',
      'gpt-5.6-luna',
    ]);
  });

  test('keeps the rates in dollars per token, cache writes and tiers included', () => {
    assert.equal(of('claude-haiku-4-5').input_token, 1.1e-6);
    assert.equal(of('claude-haiku-4-5').cache_write_1h_token, 2.2e-6);
    assert.equal(of('gpt-5.6-luna').tiers?.[0]?.context_max, 270_000);
  });

  test('refuses an answer that is not a price list at all', () => {
    assert.throws(() => parseMetisPricing({ error: 'maintenance' }));
  });
});

describe('the cost of a call', () => {
  test('prices uncached input, cache reads and output with reasoning, each at its own rate', () => {
    // 188 uncached, 512 cached, 93 written: luna's first tier (2.2e-7, 2.2e-8, 1.32e-6).
    const cost = costUsd(of('gpt-5.6-luna'), [
      usage({ inputTokens: 188, cacheReadTokens: 512, outputTokens: 93, reasoningTokens: 30 }),
    ]);
    assert.equal(cost, 0.000175384);
  });

  test('uses the tier the prompt falls in', () => {
    const long = usage({ inputTokens: 300_000, outputTokens: 1_000 });
    assert.equal(
      costUsd(of('gpt-5.6-luna'), [long]),
      Number((300_000 * 4.4e-7 + 1_000 * 1.98e-6).toFixed(9)),
    );
  });

  test("prices Anthropic's cache writes at the lifetime the task asked for", () => {
    const writes = [usage({ cacheWriteTokens: 4_096, outputTokens: 50 })];
    const output = 50 * 5.5e-6;
    assert.equal(
      costUsd(of('claude-haiku-4-5'), writes, '5m'),
      Number((4_096 * 1.375e-6 + output).toFixed(9)),
    );
    assert.equal(costUsd(of('claude-haiku-4-5'), writes, '1h'), Number((4_096 * 2.2e-6 + output).toFixed(9)));
  });

  test('charges cache reads at the full input rate where Metis lists no cached rate (Gemini Flash-Lite)', () => {
    const cost = costUsd(of('gemini-3.1-flash-lite'), [usage({ cacheReadTokens: 1_000 })]);
    assert.equal(cost, Number((1_000 * 2.75e-7).toFixed(9)));
  });

  test('adds every attempt of a call', () => {
    const one = usage({ inputTokens: 700, outputTokens: 60 });
    const single = costUsd(of('deepseek-v4-flash'), [one]) ?? 0;
    assert.equal(costUsd(of('deepseek-v4-flash'), [one, one]), Number((2 * single).toFixed(9)));
  });

  test('is null, never a guess, for a model without prices', () => {
    assert.equal(costUsd(undefined, [usage({ inputTokens: 10 })]), null);
    assert.equal(costUsd({ output_token: 1e-6 }, [usage({ inputTokens: 10 })]), null);
  });
});

describe('the price book', () => {
  test('loads the list on refresh, from the pricing endpoint, with no key', async () => {
    const network = stubFetch({ body: RECORDED });
    const book = createMetisPriceBook({ logger: recordingLogger(), fetch: network.fetch });
    assert.equal(book.pricesOf('gpt-5.6-luna'), undefined, 'nothing is priced before the first load');
    assert.equal(await book.refresh(), true);
    assert.deepEqual(book.pricesOf('gpt-5.6-luna'), of('gpt-5.6-luna'));
    assert.equal(network.requests[0]?.url.href, METIS_PRICING_URL);
    assert.equal(network.requests[0].headers.has('authorization'), false);
  });

  test('reloads in the background once the list is older than a day, and keeps it when a reload fails', async () => {
    let now = 0;
    const logger = recordingLogger();
    const network = stubFetch({ body: RECORDED }, { status: 503, body: { error: 'down' } });
    const book = createMetisPriceBook({ logger, fetch: network.fetch, now: () => now });
    const loads = () => network.requests.length;
    await book.refresh();

    now = 23 * 60 * 60 * 1000;
    book.pricesOf('gpt-5.6-luna');
    assert.equal(loads(), 1, 'a fresh list is not reloaded');

    now = 25 * 60 * 60 * 1000;
    assert.deepEqual(book.pricesOf('gpt-5.6-luna'), of('gpt-5.6-luna'), 'the stale list answers meanwhile');
    await book.refresh();
    assert.ok(loads() >= 2, 'a stale list is reloaded');
    assert.deepEqual(book.pricesOf('gpt-5.6-luna'), of('gpt-5.6-luna'), 'a failed reload keeps the list');
    assert.ok(
      logger.lines.some((line) => line.level === 'warn' && line.message === 'metis prices not loaded'),
    );
  });

  test('a list that could not be loaded at start is tried again, at most once a minute, until it loads', async () => {
    let now = 0;
    const network = stubFetch({ status: 503, body: { error: 'down' } }, { body: RECORDED });
    const book = createMetisPriceBook({ logger: recordingLogger(), fetch: network.fetch, now: () => now });
    const loads = () => network.requests.length;
    assert.equal(await book.refresh(), false);

    now = 30_000;
    assert.equal(book.pricesOf('gpt-5.6-luna'), undefined);
    assert.equal(loads(), 1, 'not again within the minute');

    now = 61_000;
    assert.equal(book.pricesOf('gpt-5.6-luna'), undefined, 'unpriced while the retry is on its way');
    await book.refresh();
    assert.deepEqual(book.pricesOf('gpt-5.6-luna'), of('gpt-5.6-luna'));
    assert.equal(loads(), 2, 'the retry and the refresh after it were one load');
  });
});
