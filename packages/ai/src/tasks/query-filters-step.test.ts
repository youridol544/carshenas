// The step plain-Farsi search binds (CS-62): what it answers when the model answers, when a gate refuses the paid
// question, when the answer is stored, when it is too slow or fails its checks, against a stub that plays Metis.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createAi } from '../ai.ts';
import { memoryAnswerCache } from '../answer-cache.ts';
import { priceBookOf } from '../pricing.ts';
import { forbidNetwork, geminiReply, stubFetch, type Reply } from '../test-support/network.ts';
import { recordingLogger } from '../test-support/recording-logger.ts';
import {
  queryFiltersEntry,
  type QueryFiltersInput,
  type QueryReading,
  type ReadingItem,
} from './query-filters.ts';
import { ModelRefused, queryFiltersStep, type QueryFiltersCall } from './query-filters-step.ts';

forbidNetwork();

const INPUT: QueryFiltersInput = {
  solarYear: 1405,
  text: 'کیا سراتو',
  settled: [{ words: 'کیا', means: 'make kia' }],
  left: ['سراتو'],
  why: 'left',
  makes: [{ key: 'kia', label: 'کیا', latin: 'Kia' }],
  models: [{ key: 'kia.cerato', label: 'Kia Cerato', latin: '' }],
  trims: [],
  cities: [],
  bodyTypes: [],
};

const CERATO: ReadingItem = {
  phrase: 'سراتو',
  target: 'filter:model',
  values: ['kia.cerato'],
  number_text: '',
  number_text_to: '',
  relation: 'not_applicable',
  strength: 'direct',
};

const RIGHT: QueryReading = {
  readings: [CERATO],
  instructions_to_ai_evidence: '',
  instructions_to_ai: false,
};

// Gemini 3.5 Flash-Lite's price as Metis lists it, in US dollars per token (the evaluation's own figures).
const PRICES = priceBookOf({
  [queryFiltersEntry.model.id]: { input_token: 1.1e-7, output_token: 4.4e-7, cached_input_token: 1.1e-8 },
});

function layer(...replies: Reply[]) {
  const network = stubFetch(...replies);
  const ai = createAi({
    apiKey: 'tpsg-example-key',
    registry: { 'query.filters': queryFiltersEntry },
    logger: recordingLogger(),
    cache: memoryAnswerCache(),
    prices: PRICES,
    fetch: network.fetch,
  });
  const calls: QueryFiltersCall[] = [];
  const stepWith = (extra: { beforeRequest?: () => void | Promise<void>; deadlineMs?: number } = {}) =>
    queryFiltersStep(ai, {
      deadlineMs: extra.deadlineMs ?? 5_000,
      ...(extra.beforeRequest ? { beforeRequest: extra.beforeRequest } : {}),
      onCall: (call) => calls.push(call),
    });
  return { ai, network, calls, stepWith };
}

describe('queryFiltersStep', () => {
  test('a valid answer is the reading, and the call is reported with its tokens and cost', async () => {
    const { network, calls, stepWith } = layer(geminiReply(JSON.stringify(RIGHT)));
    const answer = await stepWith()(INPUT);
    assert.deepEqual(answer, { status: 'ok', reading: RIGHT, cached: false });
    assert.equal(network.requests.length, 1);
    const [call] = calls;
    assert.equal(call?.outcome, 'ok');
    assert.equal(call.attempts, 1);
    assert.equal(call.cached, false);
    assert.equal(call.tokens.input, 313);
    assert.equal(call.tokens.output, 166);
    assert.ok((call.costUsd ?? 0) > 0, 'a fresh call has a cost');
    assert.deepEqual(call.reading, RIGHT);
  });

  test('a refused question makes no request, costs nothing, and is answered without the model for the gate’s reason', async () => {
    const { network, calls, stepWith } = layer(geminiReply(JSON.stringify(RIGHT)));
    for (const reason of ['visitor_limit', 'daily_cap', 'busy'] as const) {
      const answer = await stepWith({
        beforeRequest: () => {
          throw new ModelRefused(reason);
        },
      })(INPUT);
      assert.deepEqual(answer, { status: 'unavailable', reason });
    }
    assert.equal(network.requests.length, 0);
    assert.deepEqual(
      calls.map((call) => [call.outcome, call.costUsd]),
      [
        ['refused', 0],
        ['refused', 0],
        ['refused', 0],
      ],
    );
  });

  test('a stored answer is the reading without the gate being asked: nothing to hold when nothing is spent', async () => {
    const { network, calls, stepWith } = layer(geminiReply(JSON.stringify(RIGHT)));
    await stepWith()(INPUT);
    let asked = 0;
    const second = await stepWith({
      beforeRequest: () => {
        asked += 1;
      },
    })(INPUT);
    assert.deepEqual(second, { status: 'ok', reading: RIGHT, cached: true });
    assert.equal(asked, 0);
    assert.equal(network.requests.length, 1);
    assert.equal(calls[1]?.cached, true);
    assert.equal(calls[1].costUsd, 0);
  });

  test('a gate that lets the question through runs once, before the request', async () => {
    const { network, stepWith } = layer(geminiReply(JSON.stringify(RIGHT)));
    const order: string[] = [];
    const answer = await stepWith({
      beforeRequest: () => {
        order.push(`gate after ${String(network.requests.length)} requests`);
      },
    })(INPUT);
    assert.equal(answer.status, 'ok');
    assert.deepEqual(order, ['gate after 0 requests']);
  });

  test('an answer that fails the checks twice is answered without the model, as an invalid answer', async () => {
    const wrong: QueryReading = { ...RIGHT, readings: [{ ...CERATO, values: ['kia.stinger'] }] };
    const { calls, stepWith } = layer(geminiReply(JSON.stringify(wrong)), geminiReply(JSON.stringify(wrong)));
    const answer = await stepWith()(INPUT);
    assert.deepEqual(answer, { status: 'unavailable', reason: 'invalid_answer' });
    assert.equal(calls[0]?.outcome, 'invalid');
    assert.equal(calls[0].attempts, 2);
    assert.equal(calls[0].reading, undefined, 'an invalid answer is not carried');
  });

  test('past its deadline the step answers without the model, for a timeout', async () => {
    // A provider that never answers. The timer stands in for the open socket, which keeps a real process alive
    // (AbortSignal.timeout's own timer does not); the abort clears it.
    let reached = 0;
    const slow: typeof globalThis.fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        reached += 1;
        const socket = setTimeout(() => {
          reject(new Error('the stub waited too long'));
        }, 10_000);
        init?.signal?.addEventListener('abort', () => {
          clearTimeout(socket);
          reject(init.signal?.reason as Error);
        });
      });
    const ai = createAi({
      apiKey: 'tpsg-example-key',
      registry: { 'query.filters': queryFiltersEntry },
      logger: recordingLogger(),
      cache: memoryAnswerCache(),
      prices: PRICES,
      fetch: slow,
    });
    const calls: QueryFiltersCall[] = [];
    const answer = await queryFiltersStep(ai, { deadlineMs: 30, onCall: (call) => calls.push(call) })(INPUT);
    assert.deepEqual(answer, { status: 'unavailable', reason: 'timeout' });
    assert.equal(calls[0]?.outcome, 'error');
    // The deadline is the caller's own signal, so the layer calls it an abort; the buyer is told it was too slow.
    assert.equal(calls[0].errorReason, 'aborted');
    assert.equal(reached, 1);
  });

  test('a failure of the caller’s own, not the model’s, is never hidden as an unavailable model', async () => {
    const { stepWith } = layer(geminiReply(JSON.stringify(RIGHT)));
    await assert.rejects(
      stepWith({
        beforeRequest: () => {
          throw new TypeError('the gate has a bug');
        },
      })(INPUT),
      TypeError,
    );
  });
});
