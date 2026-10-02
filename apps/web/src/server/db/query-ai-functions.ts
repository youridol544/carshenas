import 'server-only';
import { sql } from 'kysely';
import { database } from '@/server/db/database';

// The web role's whole access to the AI tables (CS-62, migration grant_web_understanding): it has no privilege on
// ai_answer or model_spend, only EXECUTE on four functions that can touch task query.filters and nothing else. Each is
// a named, tested call here; no other file calls them.

export type StoredQueryAnswer = {
  id: number;
  prompt_version: string;
  provider: 'openai' | 'anthropic' | 'google' | 'deepseek';
  model: string;
  answering_model: string;
  output: unknown;
  cost_usd_micros: number | null;
};

/** The stored answer under a cache key, or undefined; never an answer of another task. */
export async function readQueryAnswer(cacheKey: Buffer): Promise<StoredQueryAnswer | undefined> {
  const { rows } = await sql<StoredQueryAnswer>`SELECT * FROM read_query_answer(${cacheKey})`.execute(
    database(),
  );
  return rows[0];
}

/** Adds an answer; the id, or null when one was stored under the key already (the first stays). */
export async function recordQueryAnswer(answer: {
  cacheKey: Buffer;
  promptVersion: string;
  provider: string;
  model: string;
  answeringModel: string;
  output: unknown;
  costUsdMicros: number | null;
}): Promise<number | null> {
  const { rows } = await sql<{ id: number | null }>`
    SELECT record_query_answer(${answer.cacheKey}, ${answer.promptVersion}, ${answer.provider}, ${answer.model},
      ${answer.answeringModel}, ${JSON.stringify(answer.output)}::jsonb, ${answer.costUsdMicros}) AS id`.execute(
    database(),
  );
  return rows[0]?.id ?? null;
}

export async function recordQuerySpend(spend: {
  promptVersion: string;
  model: string;
  outcome: string;
  errorReason: string | null;
  costUsdMicros: number;
  estimated: boolean;
}): Promise<void> {
  await sql`SELECT record_query_spend(${spend.promptVersion}, ${spend.model}, ${spend.outcome}, ${spend.errorReason},
    ${spend.costUsdMicros}, ${spend.estimated})`.execute(database());
}

/** What query.filters calls cost since midnight in Tehran, in micro-dollars. */
export async function spendTodayQueryUsdMicros(): Promise<number> {
  const { rows } = await sql<{ spent: string }>`SELECT spend_today_query_usd_micros() AS spent`.execute(
    database(),
  );
  return Number(rows[0]?.spent ?? 0);
}
