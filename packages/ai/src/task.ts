// What an AI task is (ADR-0021 point 2): a prompt, a schema and checks, and in the registry the model it runs on with
// its settings. Tasks are code in this package: the instructions and the glossary are versioned with it, and a prompt
// version is a content hash, so a changed word is a new version and never a stale cache hit.
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { canonicalJson } from './json.ts';
import type { ModelChoice } from './metis.ts';

/** One thing wrong with an answer, fed back to the model as `- path: message` (CS-43, pattern 5). */
export type Problem = {
  /** The field as a dotted path (`paint_evidence`, `panels.2.state`), or `(the whole answer)`. */
  readonly path: string;
  /** What is wrong, the value seen and what is admissible: the feedback that repairs best (CS-43). */
  readonly message: string;
};

/**
 * `<area>.<what>` in lower case (`listing.facts`, `query.filters`), at most 100 characters, as logs, the registry and
 * ai_answer spell it (the table's CHECK is the same rule).
 */
export const TASK_NAME = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const TASK_NAME_MAX = 100;

/** Rules the schema cannot state, such as grounding in the input, and their version. */
export type Checks<Input, Output> = {
  /**
   * Part of the prompt version: change it whenever `run` changes. A stored answer is checked again before it is
   * reused, but a changed check under the same version would find it stale on every call and ask again forever.
   */
  readonly version: string;
  /** Each problem is fed back to the model as written. */
  run(output: Output, input: Input): readonly Problem[];
};

export type Task<Input, Output> = {
  readonly name: string;
  /**
   * The stable prefix: the rules, the glossary, any examples. Byte-identical for every call of this version, so the
   * providers' prompt caches can reuse it: no dates, ids or input in it (CS-43, pattern 8).
   */
  readonly instructions: string;
  /**
   * The answer's shape in CS-43's portable profile: a strict object, every field required, `not_stated` as an enum
   * value rather than null, evidence before the value it supports.
   */
  readonly schema: z.ZodType<Output>;
  /** The variable part, sent last: what the model reads about this one input. It is also what the cache key hashes. */
  render(input: Input): string;
  /**
   * Part of the prompt version, as the checks' version is: change it whenever `render` or the text cleaning it calls
   * (tasks/listing-text.ts) would turn some input into other text. The cache key already hashes the rendered input, so
   * no stale answer is reused either way; this is what tells an evaluation it no longer covers the prompt (CS-84).
   */
  readonly renderVersion: string;
  readonly checks?: Checks<Input, Output>;
};

export function defineTask<Input, Output>(task: Task<Input, Output>): Task<Input, Output> {
  if (!TASK_NAME.test(task.name) || task.name.length > TASK_NAME_MAX) {
    throw new TypeError(
      `task name ${JSON.stringify(task.name)} is not <area>.<what> in lower case, at most ${TASK_NAME_MAX} characters`,
    );
  }
  if (task.renderVersion.trim() === '') {
    throw new TypeError(`task ${task.name} has no render version: name what its render turns an input into`);
  }
  return task;
}

export type TaskSettings = {
  /** The most the model may write, reasoning included: room to think without cutting the JSON short. */
  readonly maxOutputTokens: number;
  /** One attempt's deadline. On the web path the step answers without the model past it (ADR-0021 point 2.6). */
  readonly timeoutMs: number;
  /** Re-asks after the first answer: at most one, by the owner's decision of 2026-09-29 (ADR-0021 point 2.3). */
  readonly maxReasks: 0 | 1;
  /**
   * Ask the provider to cache the instructions for this long where it needs asking: Anthropic's cache_control on
   * them, and a prompt cache key for OpenAI. Gemini and DeepSeek cache on their own. Off by default: CS-45 measured
   * what Metis passes through (docs/research/2026-09-29-metis-ai.md).
   */
  readonly promptCache?: '5m' | '1h';
};

/** One line of the registry: a task, the model it runs on, the model CS-82 switches to in an outage, its settings. */
export type RegistryEntry<Input, Output> = {
  readonly task: Task<Input, Output>;
  readonly model: ModelChoice;
  /** Named by CS-46 (ADR-0019 point 4); nothing switches to it until CS-82. */
  readonly fallback?: ModelChoice;
  readonly settings: TaskSettings;
};

/** Task name to entry. `render` and `checks.run` are methods, so entries of any input and output fit one registry. */
export type Registry = Readonly<Record<string, RegistryEntry<never, unknown>>>;

export type InputOf<Entry extends RegistryEntry<never, unknown>> = Parameters<Entry['task']['render']>[0];
export type OutputOf<Entry extends RegistryEntry<never, unknown>> = z.output<Entry['task']['schema']>;

/** Bumped when the layer changes what it sends around a task's prompt, so every cached answer is asked again. */
const PROMPT_FORMAT = 1;

/**
 * The prompt version: the first 16 hex digits of the SHA-256 of the instructions, the schema, the render's version, the
 * checks' version and the settings that shape the answer (ADR-0021 point 2.2). The model is not part of it; the cache key adds it.
 */
export function promptVersion(entry: RegistryEntry<never, unknown>): string {
  const content = canonicalJson({
    format: PROMPT_FORMAT,
    instructions: entry.task.instructions,
    schema: z.toJSONSchema(entry.task.schema),
    render: entry.task.renderVersion,
    checks: entry.task.checks?.version ?? null,
    maxOutputTokens: entry.settings.maxOutputTokens,
  });
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}
