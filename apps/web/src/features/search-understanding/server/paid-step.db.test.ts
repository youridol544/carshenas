import { createAi } from '@carshenas/ai/ai';
import { priceBookOf } from '@carshenas/ai/pricing';
import { queryFiltersEntry, type QueryFiltersInput } from '@carshenas/ai/tasks/query-filters';
import { geminiReply } from '@carshenas/ai/test-support/network';
import { randomBytes } from 'node:crypto';
import type { Kysely } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import type { DB } from '@carshenas/db/db-types';
import {
  forgetLostSpend,
  paidModelStep,
  questionsInFlight,
  spendRecordingFailed,
} from '@/features/search-understanding/server/paid-step';
import { spentTodayUsd } from '@/features/search-understanding/server/model-spend';
import { webAnswerCache } from '@/server/ai/answer-cache';
import { assertScratchDatabase, ownerDatabase } from '@/server/db/account-test-database';
import { database } from '@/server/db/database';
import type { env as serverEnv } from '@/server/env';

// The paid step through the app's own pool, as carshenas_web, on the scratch database `pnpm db:check` migrated: what a
// paid question is held to (the slots of this process, the day's cap, the visitor's hour), what it leaves behind (its
// answer in ai_answer, its cost in model_spend, its count in auth_throttle) and what a stored answer does not cost.
// The model is a stub that plays Metis's Gemini route; nothing here reaches a network.

const TEST_AUTH_KEY = vi.hoisted(() => Buffer.alloc(32, 7));
const settings = vi.hoisted(
  (): { cap: number; visitorLimit: number; concurrency: number; key: string | undefined } => ({
    cap: 1,
    visitorLimit: 40,
    concurrency: 4,
    key: 'tpsg-test-key-never-real',
  }),
);
const layer = vi.hoisted((): { current: (() => Promise<unknown>) | undefined } => ({ current: undefined }));

vi.mock('@/server/env', async (importOriginal) => {
  const { env } = await importOriginal<{ env: typeof serverEnv }>();
  const overridden = Object.create(env) as typeof serverEnv;
  Object.defineProperties(overridden, {
    authKey: { value: TEST_AUTH_KEY },
    searchUnderstandingDailyCapUsd: { get: () => settings.cap },
    searchUnderstandingVisitorLimit: { get: () => settings.visitorLimit },
    searchUnderstandingConcurrency: { get: () => settings.concurrency },
  });
  return { env: overridden };
});
const recording = vi.hoisted(() => ({ fail: false }));
vi.mock('@/features/search-understanding/server/model-spend', async (importOriginal) => {
  const actual = await importOriginal<{ recordSpend: (...args: never[]) => Promise<void> }>();
  return {
    ...actual,
    recordSpend: (...args: never[]) =>
      recording.fail
        ? Promise.reject(new Error('the database refused the spend row'))
        : actual.recordSpend(...args),
  };
});
vi.mock('@/server/ai/models', () => ({ webModels: () => layer.current?.() }));

const owner: Kysely<DB> = ownerDatabase();

// Gemini 3.5 Flash-Lite's list price on Metis, US dollars per token.
const PRICES = priceBookOf({
  [queryFiltersEntry.model.id]: { input_token: 1.1e-7, output_token: 4.4e-7, cached_input_token: 1.1e-8 },
});

type Reply = ReturnType<typeof geminiReply>;
const READING = JSON.stringify({ readings: [], instructions_to_ai_evidence: '', instructions_to_ai: false });

/** A model that answers `replies` in turn, after `hold` when it is given; counts the requests it received. */
function stubModel(options: { replies?: Reply[]; hold?: Promise<void> } = {}) {
  const replies = options.replies ?? [geminiReply(READING)];
  let requests = 0;
  const fetch: typeof globalThis.fetch = async () => {
    const reply = replies[Math.min(requests, replies.length - 1)] ?? geminiReply(READING);
    requests += 1;
    if (options.hold) await options.hold;
    return new Response(JSON.stringify(reply.body), {
      status: reply.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { fetch, requests: () => requests };
}

function attachModel(model: ReturnType<typeof stubModel>, prices: typeof PRICES = PRICES) {
  const ai = createAi({
    apiKey: settings.key,
    registry: { 'query.filters': queryFiltersEntry },
    logger: silent,
    cache: webAnswerCache,
    prices,
    fetch: model.fetch,
  });
  layer.current = () => Promise.resolve(ai);
  return ai;
}

const silent = (() => {
  const nothing = () => undefined;
  const self: Record<string, unknown> = {
    trace: nothing,
    debug: nothing,
    info: nothing,
    warn: nothing,
    error: nothing,
    fatal: nothing,
    isLevelEnabled: () => false,
    flush: () => Promise.resolve(),
  };
  self.child = () => self;
  return self;
})() as unknown as Parameters<typeof createAi>[0]['logger'];

let counter = 0;
/** A request no other test made, so its answer is not in the cache; and a visitor no other test was. */
function fresh(): { input: QueryFiltersInput; visitor: { address: string } } {
  counter += 1;
  const stamp = `${String(Date.now())}${String(counter)}`;
  return {
    input: {
      solarYear: 1405,
      text: `پژو ۲۰۶ ${stamp}`,
      settled: [{ words: 'پژو', means: 'make peugeot' }],
      left: [stamp],
      why: 'left',
      makes: [{ key: 'peugeot', label: 'پژو', latin: 'Peugeot' }],
      models: [],
      trims: [],
      cities: [],
      bodyTypes: [],
    },
    // Random, so a second run within the hour does not meet the first one's counts.
    visitor: { address: `10.${[...randomBytes(3)].map(String).join('.')}` },
  };
}

async function spendRows() {
  return owner
    .selectFrom('model_spend')
    .select(['task', 'outcome', 'error_reason', 'cost_usd_micros', 'estimated', 'prompt_version', 'model'])
    .where('task', '=', 'query.filters')
    .orderBy('id')
    .execute();
}

async function answersStored(): Promise<number> {
  const row = await owner
    .selectFrom('ai_answer')
    .select((eb) => eb.fn.countAll<string>().as('n'))
    .where('task', '=', 'query.filters')
    .executeTakeFirstOrThrow();
  return Number(row.n);
}

beforeAll(async () => {
  await assertScratchDatabase(owner);
});

beforeEach(() => {
  forgetLostSpend();
  settings.cap = 1;
  settings.visitorLimit = 40;
  settings.concurrency = 4;
  settings.key = 'tpsg-test-key-never-real';
});

afterAll(async () => {
  await owner.destroy();
  await database().destroy();
});

describe('a paid question', () => {
  test('is answered, its answer stored, its cost recorded, and the visitor counted once', async () => {
    const model = stubModel();
    attachModel(model);
    const { input, visitor } = fresh();
    const before = (await spendRows()).length;
    const stored = await answersStored();

    const answer = await paidModelStep(visitor)(input);

    expect(answer).toMatchObject({ status: 'ok', cached: false });
    expect(model.requests()).toBe(1);
    expect(await answersStored()).toBe(stored + 1);
    const rows = await spendRows();
    expect(rows).toHaveLength(before + 1);
    expect(rows.at(-1)).toMatchObject({
      task: 'query.filters',
      outcome: 'ok',
      error_reason: null,
      estimated: false,
      model: queryFiltersEntry.model.id,
    });
    expect(rows.at(-1)?.cost_usd_micros).toBeGreaterThan(0);
    expect(questionsInFlight()).toBe(0);
  });

  test('asked again, it is a stored answer: no request, no cost, and not counted against the visitor', async () => {
    const model = stubModel();
    attachModel(model);
    const { input, visitor } = fresh();
    settings.visitorLimit = 1;
    await paidModelStep(visitor)(input);
    const spent = (await spendRows()).length;

    const again = await paidModelStep(visitor)(input);

    expect(again).toMatchObject({ status: 'ok', cached: true });
    expect(model.requests()).toBe(1);
    expect((await spendRows()).length).toBe(spent);
  });
});

describe('what holds a paid question back', () => {
  test('a visitor over the hour’s limit is answered by code, with no request and no cost', async () => {
    const model = stubModel();
    attachModel(model);
    settings.visitorLimit = 2;
    const visitor = fresh().visitor;
    const first = await paidModelStep(visitor)(fresh().input);
    const second = await paidModelStep(visitor)(fresh().input);
    const spent = (await spendRows()).length;

    const third = await paidModelStep(visitor)(fresh().input);

    expect(first.status).toBe('ok');
    expect(second.status).toBe('ok');
    expect(third).toEqual({ status: 'unavailable', reason: 'visitor_limit' });
    expect(model.requests()).toBe(2);
    expect((await spendRows()).length).toBe(spent);
    // Another visitor is not held by this one's count.
    expect((await paidModelStep(fresh().visitor)(fresh().input)).status).toBe('ok');
  });

  test('the day’s cap, once reached, stops every visitor until the next day in Tehran', async () => {
    const model = stubModel();
    attachModel(model);
    const spentBefore = await spentTodayUsd();
    settings.cap = spentBefore + 0.001;
    expect((await paidModelStep(fresh().visitor)(fresh().input)).status).toBe('ok');
    // That question cost more than a thousandth of a dollar's remainder, or the cap is reached by what is added next.
    await owner
      .insertInto('model_spend')
      .values({
        task: 'query.filters',
        prompt_version: '0123456789abcdef',
        model: queryFiltersEntry.model.id,
        outcome: 'ok',
        cost_usd_micros: 2_000,
        estimated: false,
      })
      .execute();
    const requests = model.requests();

    const held = await paidModelStep(fresh().visitor)(fresh().input);

    expect(held).toEqual({ status: 'unavailable', reason: 'daily_cap' });
    expect(model.requests()).toBe(requests);
  });

  test('yesterday’s spend does not count against today’s cap', async () => {
    const before = await spentTodayUsd();
    await owner
      .insertInto('model_spend')
      .values({
        task: 'query.filters',
        prompt_version: '0123456789abcdef',
        model: queryFiltersEntry.model.id,
        outcome: 'ok',
        cost_usd_micros: 5_000_000,
        estimated: false,
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      })
      .execute();
    expect(await spentTodayUsd()).toBeCloseTo(before, 6);
  });

  test('only the question’s own task counts: another task’s spend is not this cap’s', async () => {
    const before = await spentTodayUsd();
    await owner
      .insertInto('model_spend')
      .values({
        task: 'listing.facts',
        prompt_version: '0123456789abcdef',
        model: 'gemini-3.7-flash',
        outcome: 'ok',
        cost_usd_micros: 9_000_000,
        estimated: false,
      })
      .execute();
    expect(await spentTodayUsd()).toBeCloseTo(before, 6);
  });

  test('more questions with the model at once than this process may have: the extra one is busy, and nothing is spent on it', async () => {
    let release: () => void = () => undefined;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const model = stubModel({ hold });
    attachModel(model);
    settings.concurrency = 1;
    const first = paidModelStep(fresh().visitor)(fresh().input);
    // The first question reaches the model's request before the second is asked.
    await vi.waitFor(() => {
      expect(model.requests()).toBe(1);
    });
    expect(questionsInFlight()).toBe(1);

    const second = await paidModelStep(fresh().visitor)(fresh().input);
    release();
    const answered = await first;

    expect(second).toEqual({ status: 'unavailable', reason: 'busy' });
    expect(answered.status).toBe('ok');
    expect(model.requests()).toBe(1);
    expect(questionsInFlight()).toBe(0);
  });
});

describe('what goes wrong', () => {
  test('a cost that cannot be recorded closes the gate: no paid question follows, and code answers, until restart', async () => {
    const model = stubModel();
    attachModel(model);
    recording.fail = true;
    const first = await paidModelStep(fresh().visitor)(fresh().input);
    recording.fail = false;
    expect(first.status).toBe('ok');
    expect(spendRecordingFailed()).toBe(true);
    const requests = model.requests();
    const next = await paidModelStep(fresh().visitor)(fresh().input);
    expect(next).toEqual({ status: 'unavailable', reason: 'unavailable' });
    expect(model.requests()).toBe(requests);
    // A restart (a new process) opens it again.
    forgetLostSpend();
    expect((await paidModelStep(fresh().visitor)(fresh().input)).status).toBe('ok');
  });

  test('without a key the question is answered by code and nothing is spent or counted', async () => {
    settings.key = undefined;
    attachModelWithoutKey();
    const spent = (await spendRows()).length;
    const answer = await paidModelStep(fresh().visitor)(fresh().input);
    expect(answer).toEqual({ status: 'unavailable', reason: 'unavailable' });
    expect((await spendRows()).length).toBe(spent);
  });

  test('a model Metis lists no price for is not asked: its cost would read as nothing', async () => {
    const model = stubModel();
    attachModel(model, priceBookOf({}));
    const answer = await paidModelStep(fresh().visitor)(fresh().input);
    expect(answer).toEqual({ status: 'unavailable', reason: 'unavailable' });
    expect(model.requests()).toBe(0);
  });

  test('a provider that fails is answered by code, and the failed call is recorded at what it reported: nothing', async () => {
    const model = stubModel({ replies: [{ status: 500, body: { error: { message: 'down' } } }] });
    attachModel(model);
    const spent = (await spendRows()).length;

    const answer = await paidModelStep(fresh().visitor)(fresh().input);

    expect(answer).toEqual({ status: 'unavailable', reason: 'unavailable' });
    const rows = await spendRows();
    expect(rows).toHaveLength(spent + 1);
    expect(rows.at(-1)).toMatchObject({ outcome: 'error', error_reason: 'unavailable', cost_usd_micros: 0 });
    expect(questionsInFlight()).toBe(0);
  });

  test('a model past its deadline is answered by code, and the call that was cut off is counted at an estimate', async () => {
    // A provider that never answers: the timer stands in for the open socket, and the abort clears it.
    const hanging: typeof globalThis.fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        const socket = setTimeout(() => {
          reject(new Error('the stub waited too long'));
        }, 10_000);
        init?.signal?.addEventListener('abort', () => {
          clearTimeout(socket);
          reject(init.signal?.reason as Error);
        });
      });
    attachModel({ fetch: hanging, requests: () => 0 });
    const spent = (await spendRows()).length;

    const answer = await paidModelStep(fresh().visitor, { deadlineMs: 50 })(fresh().input);

    expect(answer).toEqual({ status: 'unavailable', reason: 'timeout' });
    const rows = await spendRows();
    expect(rows).toHaveLength(spent + 1);
    expect(rows.at(-1)).toMatchObject({ outcome: 'error', error_reason: 'aborted', estimated: true });
    expect(rows.at(-1)?.cost_usd_micros).toBeGreaterThanOrEqual(3_000);
    expect(questionsInFlight()).toBe(0);
  });

  test('an answer that fails the checks twice is answered by code and its two attempts are paid for', async () => {
    const wrong = JSON.stringify({
      readings: [
        {
          phrase: 'کلمه ای که نیست',
          target: 'filter:paint_free',
          values: [],
          number_text: '',
          number_text_to: '',
          relation: 'not_applicable',
          strength: 'direct',
        },
      ],
      instructions_to_ai_evidence: '',
      instructions_to_ai: false,
    });
    const model = stubModel({ replies: [geminiReply(wrong)] });
    attachModel(model);
    const spent = (await spendRows()).length;

    const answer = await paidModelStep(fresh().visitor)(fresh().input);

    expect(answer).toEqual({ status: 'unavailable', reason: 'invalid_answer' });
    expect(model.requests()).toBe(2);
    const rows = await spendRows();
    expect(rows).toHaveLength(spent + 1);
    expect(rows.at(-1)).toMatchObject({ outcome: 'invalid', estimated: false });
  });
});

/** The layer as it is without a key: creating it throws MetisKeyMissingError, as models.ts does. */
function attachModelWithoutKey() {
  layer.current = () =>
    Promise.resolve().then(() =>
      createAi({
        apiKey: undefined,
        registry: { 'query.filters': queryFiltersEntry },
        logger: silent,
      }),
    );
}
