// The answer cache in PostgreSQL (ai_answer; CS-45, ADR-0021 point 2.4): one lookup by the unique key before every
// call, and one insert after a valid answer. Two workers that ask the same question race to the insert; the first
// answer stays (ON CONFLICT DO NOTHING on the named key), and the second reads it back in a new statement, which
// under READ COMMITTED sees the committed row, so both return the same answer and its row. Nothing reads before it
// writes. The caller passes its own database: the worker's role may read and insert, and no role may change a row.
import type { Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';
import type { AnswerCache, StoredRow } from './answer-cache.ts';
import { toJsonObject } from './json.ts';

export function postgresAnswerCache(db: Kysely<DB>): AnswerCache {
  async function find(key: Buffer): Promise<StoredRow | undefined> {
    const row = await db
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
      .where('cache_key', '=', key)
      .executeTakeFirst();
    if (!row) return undefined;
    return {
      id: row.id,
      task: row.task,
      promptVersion: row.prompt_version,
      provider: row.provider,
      model: row.model,
      answeringModel: row.answering_model,
      output: toJsonObject(row.output),
      costUsdMicros: row.cost_usd_micros,
    };
  }

  return {
    get: find,
    async put(key, answer) {
      const inserted = await db
        .insertInto('ai_answer')
        .values({
          cache_key: key,
          task: answer.task,
          prompt_version: answer.promptVersion,
          provider: answer.provider,
          model: answer.model,
          answering_model: answer.answeringModel,
          output: answer.output,
          cost_usd_micros: answer.costUsdMicros,
        })
        .onConflict((conflict) => conflict.constraint('ai_answer_cache_key_unique').doNothing())
        .returning('id')
        .executeTakeFirst();
      if (inserted) return { ...answer, id: inserted.id };
      // Another worker stored an answer to the same question first: that one stays and is the answer.
      const first = await find(key);
      if (!first) throw new Error('ai_answer refused the insert but holds no row for its key');
      return first;
    },
  };
}
