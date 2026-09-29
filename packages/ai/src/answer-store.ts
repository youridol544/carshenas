// The answer cache in PostgreSQL (ai_answer; CS-45, ADR-0021 point 2.4): one lookup by the unique key before every
// call, and one insert after a valid answer. Two workers that ask the same question race to the insert; the first
// answer stays and the second insert changes nothing (ON CONFLICT DO NOTHING on the named key), so neither reads
// before it writes. The caller passes its own database: the worker's role may read and insert, never update.
import type { Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';
import type { AnswerCache } from './answer-cache.ts';
import { toJsonObject } from './json.ts';

export function postgresAnswerCache(db: Kysely<DB>): AnswerCache {
  return {
    async get(key) {
      const row = await db
        .selectFrom('ai_answer')
        .select([
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
        task: row.task,
        promptVersion: row.prompt_version,
        provider: row.provider,
        model: row.model,
        answeringModel: row.answering_model,
        output: toJsonObject(row.output),
        costUsdMicros: row.cost_usd_micros,
      };
    },
    async put(key, answer) {
      await db
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
        .execute();
    },
  };
}
