import 'server-only';
import type { AnswerCache, StoredRow } from '@carshenas/ai/answer-cache';
import { toJsonObject } from '@carshenas/ai/json';
import { readQueryAnswer, recordQueryAnswer } from '@/server/db/query-ai-functions';

// The answer cache for the web path: ai_answer through the web role's functions (query-ai-functions.ts), which reach
// task query.filters alone. Same contract as the package's postgresAnswerCache: the first answer under a key stays.

function rowOf(found: NonNullable<Awaited<ReturnType<typeof readQueryAnswer>>>): StoredRow {
  return {
    id: found.id,
    task: 'query.filters',
    promptVersion: found.prompt_version,
    provider: found.provider,
    model: found.model,
    answeringModel: found.answering_model,
    output: toJsonObject(found.output),
    costUsdMicros: found.cost_usd_micros,
  };
}

export const webAnswerCache: AnswerCache = {
  async get(key) {
    const found = await readQueryAnswer(key);
    return found === undefined ? undefined : rowOf(found);
  },
  async put(key, answer) {
    const id = await recordQueryAnswer({
      cacheKey: key,
      promptVersion: answer.promptVersion,
      provider: answer.provider,
      model: answer.model,
      answeringModel: answer.answeringModel,
      output: answer.output,
      costUsdMicros: answer.costUsdMicros,
    });
    if (id !== null) return { ...answer, id };
    const first = await readQueryAnswer(key);
    if (first === undefined) throw new Error('the answer was refused and none is stored under its key');
    return rowOf(first);
  },
};
