// The layer end to end with no network: the real provider packages build each request and parse each answer, and a
// stub fetch replays answers in Metis's formats. Covers calling by task name through one registry (CS-45 #1), the
// cache (#3), the line per call (#4) and the key (#6); call.test.ts covers the re-ask (#2).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createAi } from './ai.ts';
import { cacheKey, memoryAnswerCache, type AnswerCache } from './answer-cache.ts';
import { MetisKeyMissingError, ModelCallError } from './errors.ts';
import { anthropic, openai, type ModelChoice } from './metis.ts';
import { priceBookOf } from './pricing.ts';
import type { RegistryEntry } from './task.ts';
import {
  listingCondition,
  PEUGEOT_EVIDENCE_RETYPED,
  PEUGEOT_FACTS,
  PEUGEOT_PAINT_OUTSIDE_ENUM,
  sample,
  type ListingCondition,
  type Sample,
} from './test-support/listing-condition.ts';
import { anthropicReply, errorReply, forbidNetwork, openaiReply, stubFetch } from './test-support/network.ts';
import { recordingLogger } from './test-support/recording-logger.ts';

forbidNetwork();

const KEY = 'tpsg-test-key-never-real';
const peugeot = sample('peugeot-206-jalali');
const answer = (facts: object) => JSON.stringify(facts);

function registryWith(model: ModelChoice) {
  const entry: RegistryEntry<Sample, ListingCondition> = {
    task: listingCondition,
    model,
    settings: { maxOutputTokens: 1024, timeoutMs: 5_000, maxReasks: 1 },
  };
  return { 'listing.condition': entry };
}

// Metis's live prices on 2026-09-29 (CS-44's evidence), in US dollars per token.
const PRICES = priceBookOf({
  'gpt-5.6-luna': {
    tiers: [
      {
        context_max: 270_000,
        input_token: 2.2e-7,
        output_token: 1.32e-6,
        cache_write_token: 2.75e-7,
        cached_input_token: 2.2e-8,
      },
      { input_token: 4.4e-7, output_token: 1.98e-6, cache_write_token: 5.5e-7, cached_input_token: 4.4e-8 },
    ],
  },
});

function layer(model: ModelChoice, ...replies: Parameters<typeof stubFetch>) {
  const network = stubFetch(...replies);
  const logger = recordingLogger();
  const cache = memoryAnswerCache();
  const ai = createAi({
    apiKey: KEY,
    registry: registryWith(model),
    logger,
    cache,
    prices: PRICES,
    fetch: network.fetch,
  });
  return { ai, network, logger, cache };
}

const LUNA = openai('gpt-5.6-luna', { reasoningEffort: 'low' });

describe('the key (CS-45 #6)', () => {
  for (const [name, apiKey] of [
    ['missing', undefined],
    ['empty', ''],
    ['blank', '   '],
  ] as const) {
    test(`a ${name} METIS_API_KEY stops the layer when it is created, saying where to set it`, () => {
      assert.throws(
        () => createAi({ apiKey, registry: registryWith(LUNA), logger: recordingLogger() }),
        (error: unknown) =>
          error instanceof MetisKeyMissingError &&
          error.message.includes('METIS_API_KEY is not set') &&
          error.message.includes('.env') &&
          error.message.includes('secret store'),
      );
    });
  }

  test('the key travels only in the request header, never in the URL or the body', async () => {
    const { ai, network } = layer(LUNA, openaiReply(answer(PEUGEOT_FACTS)));
    await ai.call('listing.condition', peugeot);
    const [request] = network.requests;
    assert.equal(request?.headers.get('authorization'), `Bearer ${KEY}`);
    assert.ok(!request.url.href.includes(KEY));
    assert.ok(!JSON.stringify(request.body).includes(KEY));
  });
});

describe('calling a task by name (CS-45 #1)', () => {
  test('the registry decides the route and the model', async () => {
    const { ai, network } = layer(LUNA, openaiReply(answer(PEUGEOT_FACTS)));

    const result = await ai.call('listing.condition', peugeot);

    assert.equal(result.outcome, 'ok');
    assert.deepEqual(result.value, PEUGEOT_FACTS);
    assert.equal(result.task, 'listing.condition');
    assert.match(result.promptVersion, /^[0-9a-f]{16}$/);
    const [request] = network.requests;
    assert.equal(request?.url.href, 'https://api.metisai.ir/openai/v1/chat/completions');
    assert.equal(request.body.model, 'gpt-5.6-luna');
    assert.equal(request.body.reasoning_effort, 'low', "the model's own options go with it");
  });

  test('switching the model is one line of the registry: the same task goes to another route', async () => {
    const { ai, network } = layer(anthropic('claude-haiku-4-5'), anthropicReply(answer(PEUGEOT_FACTS)));

    const result = await ai.call('listing.condition', peugeot);

    assert.equal(result.outcome, 'ok');
    const [request] = network.requests;
    assert.equal(request?.url.href, 'https://api.metisai.ir/anthropic/v1/messages');
    assert.equal(request.body.model, 'claude-haiku-4-5');
  });

  test('a registry must list each task under its own name', () => {
    assert.throws(
      () =>
        createAi({
          apiKey: KEY,
          registry: { 'listing.other': registryWith(LUNA)['listing.condition'] },
          logger: recordingLogger(),
        }),
      /lists listing.condition under the name listing.other/,
    );
  });
});

describe('the cache (CS-45 #3)', () => {
  test('the same task, prompt version, model and input is answered from the cache, with no request', async () => {
    const { ai, network, cache } = layer(LUNA, openaiReply(answer(PEUGEOT_FACTS)));

    const first = await ai.call('listing.condition', peugeot);
    const second = await ai.call('listing.condition', peugeot);

    assert.equal(network.requests.length, 1, 'the second call made no request');
    assert.equal(first.cached, false);
    assert.equal(second.cached, true);
    assert.deepEqual(second.outcome === 'ok' ? second.value : undefined, PEUGEOT_FACTS);
    assert.equal(cache.size, 1);
  });

  test("a caller's beforeRequest runs only when a paid request is about to be made: never for a stored answer", async () => {
    const { ai, network } = layer(LUNA, openaiReply(answer(PEUGEOT_FACTS)));
    let held = 0;
    const beforeRequest = () => {
      held += 1;
      assert.equal(network.requests.length, 0, 'it runs before the request');
    };

    await ai.call('listing.condition', peugeot, { beforeRequest });
    await ai.call('listing.condition', peugeot, { beforeRequest });

    assert.equal(held, 1, 'the second call was answered from the cache');
    assert.equal(network.requests.length, 1);
  });

  test('what beforeRequest throws is what the call throws, and no request is made', async () => {
    const { ai, network, cache } = layer(LUNA, openaiReply(answer(PEUGEOT_FACTS)));
    const refusal = new Error("today's cap is reached");

    await assert.rejects(
      ai.call('listing.condition', peugeot, {
        beforeRequest: () => Promise.reject(refusal),
      }),
      (error: unknown) => error === refusal,
    );

    assert.equal(network.requests.length, 0);
    assert.equal(cache.size, 0);
  });

  test('other words are asked again: the key is the exact rendered input', async () => {
    const { ai, network } = layer(
      LUNA,
      openaiReply(answer(PEUGEOT_FACTS)),
      openaiReply(answer({ ...PEUGEOT_FACTS, paint_evidence: '', paint: 'not_stated' })),
    );
    await ai.call('listing.condition', peugeot);
    await ai.call('listing.condition', { id: 'edited', text: `${peugeot.text} ` });
    assert.equal(network.requests.length, 2);
  });

  test('another model is another key', () => {
    const base = { task: 'listing.condition', promptVersion: '0123456789abcdef', input: peugeot.text };
    const keys = [
      cacheKey({ ...base, model: LUNA }),
      cacheKey({ ...base, model: openai('gpt-5.6-luna', { reasoningEffort: 'medium' }) }),
      cacheKey({ ...base, model: anthropic('claude-haiku-4-5') }),
      cacheKey({ ...base, model: LUNA, promptVersion: 'fedcba9876543210' }),
      cacheKey({ ...base, model: LUNA, task: 'listing.other' }),
    ];
    assert.equal(new Set(keys.map((key) => key.toString('hex'))).size, keys.length);
    assert.ok(keys.every((key) => key.length === 32));
    assert.deepEqual(cacheKey({ ...base, model: LUNA }), keys[0], 'the same parts give the same key');
  });

  test('an answer is cached only when it passed the schema and the checks', async () => {
    const { ai, cache } = layer(
      LUNA,
      openaiReply(answer(PEUGEOT_PAINT_OUTSIDE_ENUM)),
      openaiReply(answer(PEUGEOT_EVIDENCE_RETYPED)),
    );
    const result = await ai.call('listing.condition', peugeot);
    assert.equal(result.outcome, 'invalid');
    assert.equal(cache.size, 0);
  });

  /** An answer stored under the Peugeot's key, as another worker (or an older check) left it. */
  function storedUnderPeugeot(ai: ReturnType<typeof layer>['ai'], output: ListingCondition) {
    const key = cacheKey({
      task: 'listing.condition',
      promptVersion: ai.promptVersion('listing.condition'),
      model: LUNA,
      input: peugeot.text,
    });
    const row = {
      task: 'listing.condition',
      promptVersion: ai.promptVersion('listing.condition'),
      provider: 'openai' as const,
      model: 'gpt-5.6-luna',
      answeringModel: 'gpt-5.6-luna',
      output: { ...output },
      costUsdMicros: 175,
    };
    return { key, row };
  }

  test('a stored answer that fails its own checks is never returned: the fresh one is, and a warning says why', async () => {
    const { ai, network, cache, logger } = layer(LUNA, openaiReply(answer(PEUGEOT_FACTS)));
    const stale = storedUnderPeugeot(ai, PEUGEOT_EVIDENCE_RETYPED);
    await cache.put(stale.key, stale.row);

    const result = await ai.call('listing.condition', peugeot);

    assert.equal(network.requests.length, 1);
    assert.equal(result.cached, false);
    assert.equal(result.outcome, 'ok');
    assert.deepEqual(result.value, PEUGEOT_FACTS);
    assert.equal(result.answerId, undefined, 'no row holds the fresh answer');
    assert.ok(
      logger.lines.some(
        (line) =>
          line.level === 'warn' && line.message === 'stored answer fails the checks of its own version',
      ),
    );
  });

  test('a new checks version is a new key: the question is asked once, then answered from the cache', async () => {
    const network = stubFetch(openaiReply(answer(PEUGEOT_FACTS)));
    const cache = memoryAnswerCache();
    const withChecks = (version: string) => {
      const entry = registryWith(LUNA)['listing.condition'];
      const run = (facts: ListingCondition, listing: Sample) => entry.task.checks?.run(facts, listing) ?? [];
      const task = { ...entry.task, checks: { version, run } };
      return createAi({
        apiKey: KEY,
        registry: { 'listing.condition': { ...entry, task } },
        logger: recordingLogger(),
        cache,
        fetch: network.fetch,
      });
    };
    await withChecks('grounding-1').call('listing.condition', peugeot);
    const changed = withChecks('grounding-2');
    const first = await changed.call('listing.condition', peugeot);
    const second = await changed.call('listing.condition', peugeot);
    assert.notEqual(
      changed.promptVersion('listing.condition'),
      withChecks('grounding-1').promptVersion('listing.condition'),
    );
    assert.deepEqual([first.cached, second.cached], [false, true]);
    assert.equal(network.requests.length, 2, 'one request per version, none for the repeat');
  });

  test('when another worker stored an answer first, the caller gets that one and its row', async () => {
    const { ai, cache } = layer(LUNA, openaiReply(answer(PEUGEOT_FACTS)));
    const theirs = { ...PEUGEOT_FACTS, price_evidence: 'قابل مذاکره' };
    const other = storedUnderPeugeot(ai, theirs);
    const racing: AnswerCache = {
      // The lookup misses, and the other worker's insert lands before this one's.
      get: () => Promise.resolve(undefined),
      async put(key, row) {
        const first = await cache.put(other.key, other.row);
        const mine = await cache.put(key, row);
        assert.equal(mine.id, first.id, 'the second insert returns the first row');
        return mine;
      },
    };
    const result = await createAi({
      apiKey: KEY,
      registry: registryWith(LUNA),
      logger: recordingLogger(),
      cache: racing,
      fetch: stubFetch(openaiReply(answer(PEUGEOT_FACTS))).fetch,
    }).call('listing.condition', peugeot);

    assert.equal(result.outcome, 'ok');
    assert.deepEqual(result.value, theirs);
    assert.equal(result.answerId, 1);
  });

  test('an ok answer names its row when there is a cache, and none without one', async () => {
    const { ai } = layer(LUNA, openaiReply(answer(PEUGEOT_FACTS)));
    assert.equal((await ai.call('listing.condition', peugeot)).answerId, 1);
    assert.equal((await ai.call('listing.condition', peugeot)).answerId, 1);
    const uncached = createAi({
      apiKey: KEY,
      registry: registryWith(LUNA),
      logger: recordingLogger(),
      fetch: stubFetch(openaiReply(answer(PEUGEOT_FACTS))).fetch,
    });
    assert.equal((await uncached.call('listing.condition', peugeot)).answerId, undefined);
  });
});

describe('one line per call (CS-45 #4)', () => {
  test('names the task, prompt version, models, request, outcome, tokens, cost and latency', async () => {
    const { ai, logger } = layer(LUNA, openaiReply(answer(PEUGEOT_FACTS)));

    const result = await ai.call('listing.condition', peugeot);

    const lines = logger.lines.filter((line) => line.message === 'model call completed');
    assert.equal(lines.length, 1);
    const [line] = lines;
    assert.equal(line?.level, 'info');
    // 700 prompt tokens, 512 of them read from the cache, 93 written with 30 of reasoning, at luna's first tier.
    assert.deepEqual(
      { ...line.fields, latencyMs: typeof line.fields.latencyMs },
      {
        component: 'ai',
        task: 'listing.condition',
        promptVersion: result.promptVersion,
        provider: 'openai',
        model: 'gpt-5.6-luna',
        answeringModel: 'gpt-5.6-luna-2026-07-09',
        requestId: 'req_openai_stub',
        outcome: 'ok',
        cached: false,
        attempts: 1,
        latencyMs: 'number',
        inputTokens: 188,
        cacheReadTokens: 512,
        cacheWriteTokens: 0,
        outputTokens: 93,
        reasoningTokens: 30,
        costUsd: 0.000175384,
      },
    );
  });

  test('a cached call writes a line too, with no tokens and no cost', async () => {
    const { ai, logger } = layer(LUNA, openaiReply(answer(PEUGEOT_FACTS)));
    await ai.call('listing.condition', peugeot);
    await ai.call('listing.condition', peugeot);
    const cached = logger.lines.filter((line) => line.message === 'model call completed').at(-1);
    assert.equal(cached?.fields.cached, true);
    assert.equal(cached.fields.attempts, 0);
    assert.equal(cached.fields.inputTokens, 0);
    assert.equal(cached.fields.costUsd, 0);
    assert.equal(cached.fields.answeringModel, 'gpt-5.6-luna-2026-07-09');
  });

  test('an answer that goes to review is a warning with the failing fields, and both attempts are counted', async () => {
    const { ai, logger } = layer(
      LUNA,
      openaiReply(answer(PEUGEOT_PAINT_OUTSIDE_ENUM)),
      openaiReply(answer(PEUGEOT_EVIDENCE_RETYPED)),
    );
    await ai.call('listing.condition', peugeot);
    const [line] = logger.lines.filter((entry) => entry.message === 'model call completed');
    assert.equal(line?.level, 'warn');
    assert.equal(line.fields.outcome, 'invalid');
    assert.equal(line.fields.attempts, 2);
    assert.deepEqual(line.fields.problemPaths, ['paint_evidence']);
    assert.equal(line.fields.outputTokens, 186);
  });

  test('holds no prompt, input or answer text: a planted phone number and marker appear in no line', async () => {
    const marker = 'PLANTED-MARKER-7f3a';
    const phone = '۰۹۱۲۳۴۵۶۷۸۹';
    const listing: Sample = { id: 'planted', text: `${peugeot.text} ${marker} تماس ${phone}` };
    const quoted = { ...PEUGEOT_FACTS, price_evidence: `کمی قابل مذاکره ${marker} تماس ${phone}` };
    const { ai, logger } = layer(
      LUNA,
      openaiReply(answer({ ...quoted, paint_evidence: 'بی رنگ ' + marker })),
      openaiReply(answer({ ...quoted, price_evidence: 'کمی قابل مذاکره' })),
    );

    await ai.call('listing.condition', listing);

    const written = JSON.stringify(logger.lines);
    for (const secret of [
      marker,
      phone,
      'کمی قابل مذاکره',
      listingCondition.instructions.slice(0, 40),
      KEY,
    ]) {
      assert.ok(!written.includes(secret), `a line holds ${secret}`);
    }
    assert.ok(logger.lines.some((line) => line.message === 'model call completed'));
  });
});

describe('a call with no answer', () => {
  for (const [status, reason, retryable] of [
    [500, 'unavailable', true],
    [503, 'unavailable', true],
    [429, 'rate_limited', true],
    [401, 'unauthorized', false],
    [402, 'no_credit', false],
    [400, 'rejected', false],
  ] as const) {
    test(`${status} throws ModelCallError ${reason}, after one request and one line`, async () => {
      const { ai, network, logger } = layer(LUNA, errorReply(status));
      const error = await ai.call('listing.condition', peugeot).then(
        () => assert.fail('the call should throw'),
        (thrown: unknown) => thrown,
      );
      assert.ok(error instanceof ModelCallError);
      assert.equal(error.reason, reason);
      assert.equal(error.status, status);
      assert.equal(error.retryable, retryable);
      assert.equal(network.requests.length, 1, 'the SDK does not retry on its own: the queue does');
      const [line] = logger.lines.filter((entry) => entry.message === 'model call completed');
      assert.equal(line?.fields.outcome, 'error');
      assert.equal(line.fields.errorReason, reason);
    });
  }

  test("an attempt past the task's timeout throws ModelCallError timeout", async () => {
    // A provider that never answers. The timer stands in for the open socket, which keeps a real process alive
    // (AbortSignal.timeout's own timer does not); the abort clears it.
    const hanging: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        const socket = setTimeout(() => {
          reject(new Error('the stub waited too long'));
        }, 10_000);
        init?.signal?.addEventListener('abort', () => {
          clearTimeout(socket);
          reject(init.signal?.reason as Error);
        });
      });
    const entry = registryWith(LUNA)['listing.condition'];
    const ai = createAi({
      apiKey: KEY,
      registry: { 'listing.condition': { ...entry, settings: { ...entry.settings, timeoutMs: 50 } } },
      logger: recordingLogger(),
      fetch: hanging,
    });
    await assert.rejects(ai.call('listing.condition', peugeot), (error: unknown) => {
      return error instanceof ModelCallError && error.reason === 'timeout' && error.retryable;
    });
  });

  test('a call the caller aborts throws ModelCallError aborted', async () => {
    const { ai } = layer(LUNA, openaiReply(answer(PEUGEOT_FACTS)));
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      ai.call('listing.condition', peugeot, { signal: controller.signal }),
      (error: unknown) => error instanceof ModelCallError && error.reason === 'aborted',
    );
  });
});

describe('what a call cost, for a caller that caps spending (CS-52)', () => {
  test('every outcome carries its cost: an answer, one sent to review, and one from the cache', async () => {
    const valid = layer(LUNA, openaiReply(answer(PEUGEOT_FACTS)));
    const fresh = await valid.ai.call('listing.condition', peugeot);
    assert.ok(fresh.costUsd !== null && fresh.costUsd > 0);
    const again = await valid.ai.call('listing.condition', peugeot);
    assert.equal(again.costUsd, 0);

    const outside = answer(PEUGEOT_PAINT_OUTSIDE_ENUM);
    const invalid = layer(LUNA, openaiReply(outside), openaiReply(outside));
    const review = await invalid.ai.call('listing.condition', peugeot);
    assert.equal(review.outcome, 'invalid');
    assert.ok(review.costUsd !== null && review.costUsd > 0, 'both paid attempts are counted');
    assert.equal(invalid.cache.size, 0);
  });

  test('a call with no answer throws with what its answered attempts cost', async () => {
    const failing = layer(LUNA, openaiReply(answer(PEUGEOT_PAINT_OUTSIDE_ENUM)), errorReply(503));
    const error = await failing.ai.call('listing.condition', peugeot).catch((thrown: unknown) => thrown);
    assert.ok(error instanceof ModelCallError);
    assert.ok(error.costUsd !== null && error.costUsd > 0, 'the first, answered attempt');
  });

  test('a model without a known price costs null, and hasPrice says so before any call', async () => {
    const unpriced = layer(anthropic('claude-haiku-4-5'), anthropicReply(answer(PEUGEOT_FACTS)));
    assert.equal(unpriced.ai.hasPrice('listing.condition'), false);
    assert.equal(layer(LUNA).ai.hasPrice('listing.condition'), true);
    const result = await unpriced.ai.call('listing.condition', peugeot);
    assert.equal(result.costUsd, null);
  });
});
