import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { memoryAnswerCache } from '@carshenas/ai/answer-cache';
import { MetisKeyMissingError } from '@carshenas/ai/errors';
import { createLogger } from '@carshenas/observability/logger';
import { NO_MODELS, startModels } from './models.ts';
import { defineJob } from './runtime/job.ts';

// The AI layer in the worker (CS-45 #6): created at start only when a job calls models, and never without the key.

const logger = createLogger({
  service: 'carshenas-worker',
  version: 'test',
  environment: 'test',
  level: 'silent',
});
const crawl = defineJob({ name: 'listing.parse', payload: z.object({}), run: () => Promise.resolve() });
const extract = defineJob({
  name: 'listing.extract',
  payload: z.object({}),
  callsModels: true,
  run: () => Promise.resolve(),
});

/** A fetch that answers Metis's price list and counts what was asked. */
function priceListFetch() {
  const urls: string[] = [];
  const fetch: typeof globalThis.fetch = (input) => {
    urls.push(input instanceof Request ? input.url : input.toString());
    return Promise.resolve(Response.json({ openai_chat_completion: [] }));
  };
  return { fetch, urls };
}

test('a worker whose jobs call no model starts without a key and without the layer', async () => {
  const network = priceListFetch();
  const models = await startModels({
    jobs: [crawl],
    apiKey: undefined,
    logger,
    cache: memoryAnswerCache(),
    fetch: network.fetch,
  });
  assert.equal(models, undefined);
  assert.deepEqual(network.urls, []);
});

test('a job that calls models without METIS_API_KEY stops the start, before anything is fetched', async () => {
  const network = priceListFetch();
  await assert.rejects(
    startModels({
      jobs: [crawl, extract],
      apiKey: undefined,
      logger,
      cache: memoryAnswerCache(),
      fetch: network.fetch,
    }),
    MetisKeyMissingError,
  );
  assert.deepEqual(network.urls, []);
});

test('with the key, the layer starts and loads the price list once', async () => {
  const network = priceListFetch();
  const models = await startModels({
    jobs: [extract],
    apiKey: 'tpsg-test-key-never-real',
    logger,
    cache: memoryAnswerCache(),
    fetch: network.fetch,
  });
  assert.ok(models);
  assert.deepEqual(network.urls, ['https://api.metisai.ir/api/v1/meta/providers/pricing']);
});

test('a job in a worker without the layer is told how to get it', async () => {
  // The product registry is empty until CS-52, so no task name type-checks yet: `never` stands for any of them.
  await assert.rejects(
    NO_MODELS.call('listing.facts' as never, undefined as never),
    /declares callsModels: true/,
  );
});

test('the real process writes one fatal line naming METIS_API_KEY and exits 1 before it starts', () => {
  // The script passes no key itself, whatever this environment holds.
  const script = fileURLToPath(new URL('test-support/start-without-key.ts', import.meta.url));
  const result = spawnSync(
    process.execPath,
    ['--experimental-strip-types', '--no-warnings=ExperimentalWarning', '--enable-source-maps', script],
    { encoding: 'utf8', timeout: 15_000 },
  );
  assert.equal(result.status, 1);
  const lines = result.stdout
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as { level: string; msg: string; err?: { message?: string } });
  assert.equal(lines.length, 1, result.stdout);
  assert.equal(lines[0]?.level, 'fatal');
  assert.match(
    lines[0].err?.message ?? '',
    /^METIS_API_KEY is not set: create a key at https:\/\/console\.metisai\.ir/,
  );
});
