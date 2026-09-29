// The cache of validated answers (ADR-0021 point 2.4; CS-43, pattern 9). A call whose task, prompt version, model and
// rendered input were answered before is answered from here, with no request; the rows are also the record a rebuild
// replays instead of asking again (docs/design/data-model.md, `ai_answer`). Only answers that passed the schema and
// the checks are stored. The key is an exact hash, never a semantic match: «زیر ۷۰۰» and «زیر ۸۰۰» must not share one.
import { createHash } from 'node:crypto';
import type { JSONObject } from '@ai-sdk/provider';
import { canonicalJson } from './json.ts';
import type { ModelChoice, Provider } from './metis.ts';

/** An answer as the cache keeps it: what was asked of which model, who answered, what it answered, what it cost. */
export type StoredAnswer = {
  readonly task: string;
  readonly promptVersion: string;
  readonly provider: Provider;
  /** The requested model id. */
  readonly model: string;
  readonly answeringModel: string;
  /** The validated answer, as JSON. */
  readonly output: JSONObject;
  /** What producing it cost, every attempt included, in millionths of a US dollar; null when unpriced. */
  readonly costUsdMicros: number | null;
};

export type AnswerCache = {
  get(key: Buffer): Promise<StoredAnswer | undefined>;
  /** Stores an answer; a key already stored keeps its first answer (two workers can race to the same input). */
  put(key: Buffer, answer: StoredAnswer): Promise<void>;
};

/** Bumped when the key's parts change, so no old key can collide with a new one. */
const KEY_FORMAT = 'ai_answer/1';

/**
 * The SHA-256 of the task, its prompt version (instructions, schema and settings), the model with its options, and
 * the rendered input: exactly what decides the answer. The input is hashed as the model reads it, so a step that
 * normalises text does it before rendering (CS-43, pattern 17), and an answer is never reused for other words.
 */
export function cacheKey(parts: {
  readonly task: string;
  readonly promptVersion: string;
  readonly model: ModelChoice;
  readonly input: string;
}): Buffer {
  const { task, promptVersion, model, input } = parts;
  return createHash('sha256')
    .update(canonicalJson([KEY_FORMAT, task, promptVersion, model.provider, model.id, model.options, input]))
    .digest();
}

/** A cache in this process only: tests, and scripts that must not touch the database. */
export function memoryAnswerCache(): AnswerCache & { readonly size: number } {
  const answers = new Map<string, StoredAnswer>();
  return {
    get size() {
      return answers.size;
    },
    get(key) {
      return Promise.resolve(answers.get(key.toString('hex')));
    },
    put(key, answer) {
      const hex = key.toString('hex');
      if (!answers.has(hex)) answers.set(hex, answer);
      return Promise.resolve();
    },
  };
}
