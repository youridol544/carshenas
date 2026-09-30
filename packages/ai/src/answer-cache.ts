// The cache of validated answers (ADR-0021 point 2.4; CS-43, pattern 9). A call whose task, prompt version, model and
// rendered input were answered before is answered from here, with no request; the rows are also the record a rebuild
// replays instead of asking again (docs/design/data-model.md, `ai_answer`). Only answers that passed the schema and
// the checks are stored. The key is an exact hash, never a semantic match: «زیر ۷۰۰» and «زیر ۸۰۰» must not share one.
import { createHash } from 'node:crypto';
import { canonicalJson, type JsonObject } from './json.ts';
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
  readonly output: JsonObject;
  /** What producing it cost, every attempt included, in millionths of a US dollar; null when unpriced. */
  readonly costUsdMicros: number | null;
};

/** An answer where it is stored: its row, which CS-52's extraction will point at, and the answer itself. */
export type StoredRow = StoredAnswer & { readonly id: number };

export type AnswerCache = {
  get(key: Buffer): Promise<StoredRow | undefined>;
  /**
   * Stores an answer and returns the row stored under its key: this one, or the first one when another worker stored
   * an answer to the same question in the meantime. That first answer stays, so every caller gets the same one.
   */
  put(key: Buffer, answer: StoredAnswer): Promise<StoredRow>;
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
  const answers = new Map<string, StoredRow>();
  return {
    get size() {
      return answers.size;
    },
    get(key) {
      return Promise.resolve(answers.get(key.toString('hex')));
    },
    put(key, answer) {
      const hex = key.toString('hex');
      const stored = answers.get(hex) ?? { ...answer, id: answers.size + 1 };
      answers.set(hex, stored);
      return Promise.resolve(stored);
    },
  };
}
