import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { after, test } from 'node:test';
import { CompiledQuery, sql, type Kysely } from 'kysely';
import { z } from 'zod';
import { createAi } from '@carshenas/ai/ai';
import { postgresAnswerCache } from '@carshenas/ai/answer-store';
import { openai } from '@carshenas/ai/metis';
import { defineTask, type RegistryEntry } from '@carshenas/ai/task';
import type { DB } from '@carshenas/db/db-types';
import { openScratchDatabase } from './db/test-database.ts';
import { testLogger, testWorkerDatabase } from './test-support/runtime.ts';

// The answer cache in PostgreSQL on the worker's own role (CS-45 #3; ai_answer): a second call with the same task,
// prompt version, model and input is answered from the table with no request, and two answers to one key keep the
// first. Run by `pnpm db:check` on a scratch database.

const worker = testWorkerDatabase();
const owner = await openScratchDatabase();
after(async () => {
  await worker.destroy();
  await owner.destroy();
});

const cache = postgresAnswerCache(worker);

const echo = defineTask({
  name: 'test.echo',
  instructions: 'Return the word you are given, as JSON.',
  schema: z.strictObject({ word: z.string() }),
  render: (word: string) => word,
  renderVersion: 'word-as-is-1',
  checks: {
    version: 'echo-1',
    run: (output, word) =>
      output.word === word
        ? []
        : [{ path: 'word', message: `is ${JSON.stringify(output.word)}, not the word given` }],
  },
});
const entry: RegistryEntry<string, { word: string }> = {
  task: echo,
  model: openai('gpt-5.6-luna'),
  settings: { maxOutputTokens: 256, timeoutMs: 5_000, maxReasks: 1 },
};

/** Metis's Chat Completions answering each request with the word it was sent, counting the requests. */
function echoingMetis() {
  let requests = 0;
  const fetch: typeof globalThis.fetch = (_input, init) => {
    requests += 1;
    const body = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as {
      messages?: { content: string }[];
    };
    const word = body.messages?.at(-1)?.content ?? '';
    return Promise.resolve(
      Response.json({
        id: 'chatcmpl-db-test',
        object: 'chat.completion',
        created: 1_790_000_000,
        model: 'gpt-5.6-luna-2026-07-09',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: JSON.stringify({ word }) },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 },
      }),
    );
  };
  return { fetch, requests: () => requests };
}

test('a repeated call is answered from ai_answer with no request, in this process and in the next', async () => {
  const word = `word-${randomBytes(4).toString('hex')}`;
  const metis = echoingMetis();
  const layer = () =>
    createAi({
      apiKey: 'tpsg-db-test',
      registry: { 'test.echo': entry },
      logger: testLogger(),
      cache,
      fetch: metis.fetch,
    });

  const first = await layer().call('test.echo', word);
  const second = await layer().call('test.echo', word);

  assert.equal(first.cached, false);
  assert.equal(second.cached, true);
  assert.deepEqual(second.outcome === 'ok' ? second.value : undefined, { word });
  assert.equal(metis.requests(), 1, 'the second call made no request');
  assert.ok(first.answerId !== undefined, 'the stored answer names its row');
  assert.equal(second.answerId, first.answerId);
  const rows = await owner
    .selectFrom('ai_answer')
    .select(['task', 'prompt_version', 'provider', 'model', 'answering_model', 'output', 'cost_usd_micros'])
    .where('prompt_version', '=', first.promptVersion)
    .where('output', '@>', { word })
    .execute();
  assert.deepEqual(rows, [
    {
      task: 'test.echo',
      prompt_version: first.promptVersion,
      provider: 'openai',
      model: 'gpt-5.6-luna',
      answering_model: 'gpt-5.6-luna-2026-07-09',
      output: { word },
      cost_usd_micros: null,
    },
  ]);
});

/** A query's EXPLAIN (ANALYZE, BUFFERS) on the worker's role, as the plan's text. */
async function planOf(executor: Kysely<DB>, query: CompiledQuery): Promise<string> {
  const result = await executor.executeQuery<{ 'QUERY PLAN': string }>(
    CompiledQuery.raw(`EXPLAIN (ANALYZE, BUFFERS) ${query.sql}`, [...query.parameters]),
  );
  return result.rows.map((row) => row['QUERY PLAN']).join('\n');
}

/** The key the seed below gives answer `n`: SHA-256 of its number as eight big-endian bytes, as int8send does. */
function seededKey(n: number): Buffer {
  const bytes = Buffer.alloc(8);
  bytes.writeBigInt64BE(BigInt(n));
  return createHash('sha256').update(bytes).digest();
}

test('at 100,000 answers, the lookup and the insert go through the key index', async (t) => {
  // About a year of extractions for the bounded index (ADR-0017), each answer the size of a listing's facts.
  await sql`
    INSERT INTO ai_answer (cache_key, task, prompt_version, provider, model, answering_model, output, cost_usd_micros)
    SELECT sha256(int8send(i::bigint)), 'plan.seed', '0123456789abcdef', 'openai', 'gpt-5.6-luna',
           'gpt-5.6-luna-2026-07-09',
           jsonb_build_object('paint_evidence', 'بی‌رنگ', 'paint', 'none', 'price_evidence', 'کمی قابل مذاکره',
                              'price_type', 'negotiable', 'instructions_to_ai', false, 'n', i),
           175
    FROM generate_series(1, 100000) AS i`.execute(owner);
  await sql`ANALYZE ai_answer`.execute(owner);
  // Answers are append-only: the seed leaves as a purge would take it.
  t.after(() =>
    owner.transaction().execute(async (purge) => {
      await sql`SET LOCAL carshenas.purge = 'on'`.execute(purge);
      await purge.deleteFrom('ai_answer').where('task', '=', 'plan.seed').execute();
    }),
  );

  // The lookup postgresAnswerCache makes before every call, run twice. The seed has just written these pages, so
  // both runs find them in shared buffers.
  const lookup = worker
    .selectFrom('ai_answer')
    .select([
      'id',
      'task',
      'prompt_version',
      'provider',
      'model',
      'answering_model',
      'output',
      'cost_usd_micros',
    ])
    .where('cache_key', '=', seededKey(54_321))
    .compile();
  const firstRun = await planOf(worker, lookup);
  const secondRun = await planOf(worker, lookup);
  t.diagnostic(`lookup, first run:\n${firstRun}`);
  t.diagnostic(`lookup, second run:\n${secondRun}`);
  assert.match(secondRun, /Index Scan using ai_answer_cache_key_unique on ai_answer/);

  // The insert after a valid answer: a new key, and a key another worker stored first. Rolled back.
  const insertOf = (key: Buffer) =>
    worker
      .insertInto('ai_answer')
      .values({
        cache_key: key,
        task: 'plan.seed',
        prompt_version: '0123456789abcdef',
        provider: 'openai',
        model: 'gpt-5.6-luna',
        answering_model: 'gpt-5.6-luna-2026-07-09',
        output: { word: 'new' },
        cost_usd_micros: 175,
      })
      .onConflict((conflict) => conflict.constraint('ai_answer_cache_key_unique').doNothing())
      .returning('id')
      .compile();
  await worker
    .transaction()
    .execute(async (transaction) => {
      const fresh = await planOf(transaction, insertOf(randomBytes(32)));
      const raced = await planOf(transaction, insertOf(seededKey(12_345)));
      t.diagnostic(`insert, new key:\n${fresh}`);
      t.diagnostic(`insert, key already stored:\n${raced}`);
      assert.match(fresh, /Conflict Arbiter Indexes: ai_answer_cache_key_unique/);
      assert.match(raced, /Conflicting Tuples: 1/);
      throw new RolledBack();
    })
    .catch((error: unknown) => {
      if (!(error instanceof RolledBack)) throw error;
    });
});

class RolledBack extends Error {}

test('two answers to one key keep the first, and the second writer gets the first back, row and all', async () => {
  const key = randomBytes(32);
  const answer = {
    task: 'test.echo',
    promptVersion: '0123456789abcdef',
    provider: 'openai' as const,
    model: 'gpt-5.6-luna',
    answeringModel: 'gpt-5.6-luna',
    costUsdMicros: 12,
  };
  const first = await cache.put(key, { ...answer, output: { word: 'first' } });
  const second = await cache.put(key, { ...answer, output: { word: 'second' } });
  assert.equal(second.id, first.id);
  assert.deepEqual(second.output, { word: 'first' });
  assert.deepEqual((await cache.get(key))?.output, { word: 'first' });
  assert.equal(await cache.get(randomBytes(32)), undefined);
});
