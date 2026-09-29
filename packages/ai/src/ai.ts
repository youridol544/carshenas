// The AI layer's one entry point (ADR-0021 point 2): `ai.call('listing.facts', input)` finds the task in the registry,
// answers from the cache when the same question was answered before, otherwise asks the task's model through Metis
// with the checked call, and writes one line per call with its tokens, cost and latency. The process that creates it
// reads METIS_API_KEY from its own environment and passes it in; without it the layer refuses to start.
import { OpenTelemetry } from '@ai-sdk/otel';
import type { SharedV4ProviderOptions } from '@ai-sdk/provider';
import { trace, type Tracer } from '@opentelemetry/api';
import type { SystemModelMessage } from 'ai';
import type { Logger } from '@carshenas/observability/logger';
import { cacheKey, type AnswerCache } from './answer-cache.ts';
import { FailedCall, generateChecked, type Attempt, type Checked, type TokenUsage } from './call.ts';
import { MetisKeyMissingError, ModelCallError } from './errors.ts';
import { toJsonObject } from './json.ts';
import { metisModels, providerOptionsFor, type ModelChoice } from './metis.ts';
import { costUsd, type PriceBook } from './pricing.ts';
import {
  promptVersion,
  type InputOf,
  type OutputOf,
  type Problem,
  type Registry,
  type RegistryEntry,
} from './task.ts';

export type AiOptions<R extends Registry> = {
  /** METIS_API_KEY as the process read it from its environment (ADR-0019 point 1); the layer never reads it. */
  readonly apiKey: string | undefined;
  readonly registry: R;
  readonly logger: Logger;
  /** Validated answers to reuse (the worker's is PostgreSQL's ai_answer); without one every call asks the model. */
  readonly cache?: AnswerCache;
  /** Metis's prices, for the cost on each line; without them the cost is null. */
  readonly prices?: PriceBook;
  /** The global fetch by default: tests replay recorded answers, scripts time requests. */
  readonly fetch?: typeof globalThis.fetch;
  /** Where the SDK's spans go: the process's tracer provider (packages/observability) by default. */
  readonly tracer?: Tracer;
};

export type CallOptions = {
  /** The caller's own deadline or cancellation, on top of the task's timeout per attempt. */
  readonly signal?: AbortSignal;
};

export type AiResult<Output> = Checked<Output> & {
  readonly task: string;
  readonly promptVersion: string;
  readonly model: ModelChoice;
  /** Answered from the cache, with no request. */
  readonly cached: boolean;
};

export type Ai<R extends Registry> = {
  /**
   * Asks the task's model about one input. Returns ok with a validated value, or a typed outcome for review
   * (invalid, refusal, truncated, empty); throws ModelCallError when no answer came at all.
   */
  call<Name extends keyof R & string>(
    task: Name,
    input: InputOf<R[Name]>,
    options?: CallOptions,
  ): Promise<AiResult<OutputOf<R[Name]>>>;
  /** The prompt version of a task, as logs and ai_answer record it. */
  promptVersion(task: keyof R & string): string;
};

const TRACER_NAME = 'carshenas-ai';

function totalTokens(attempts: readonly Attempt[]): TokenUsage {
  return attempts.reduce<TokenUsage>(
    (sum, { usage }) => ({
      inputTokens: sum.inputTokens + usage.inputTokens,
      cacheReadTokens: sum.cacheReadTokens + usage.cacheReadTokens,
      cacheWriteTokens: sum.cacheWriteTokens + usage.cacheWriteTokens,
      outputTokens: sum.outputTokens + usage.outputTokens,
      reasoningTokens: sum.reasoningTokens + usage.reasoningTokens,
    }),
    { inputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 0, reasoningTokens: 0 },
  );
}

/** The instructions, with Anthropic's cache breakpoint on them when the task asks for provider caching. */
function instructionsOf(entry: RegistryEntry<unknown, unknown>): string | SystemModelMessage {
  const ttl = entry.settings.promptCache;
  if (ttl === undefined || entry.model.provider !== 'anthropic') return entry.task.instructions;
  return {
    role: 'system',
    content: entry.task.instructions,
    providerOptions: { anthropic: { cacheControl: { type: 'ephemeral', ttl } } },
  };
}

/** The model's options, with OpenAI's prompt cache key when the task asks for provider caching. */
function providerOptionsOf(entry: RegistryEntry<unknown, unknown>, key: string): SharedV4ProviderOptions {
  const options = providerOptionsFor(entry.model);
  if (entry.settings.promptCache === undefined || !options.openai) return options;
  return { ...options, openai: { ...options.openai, promptCacheKey: key } };
}

export function createAi<R extends Registry>(options: AiOptions<R>): Ai<R> {
  const apiKey = options.apiKey?.trim();
  if (!apiKey) throw new MetisKeyMissingError();
  const resolve = metisModels({ apiKey, fetch: options.fetch });
  // Spans follow the GenAI conventions (model, finish reason, tokens) and never carry the prompt, the input or the
  // answer: the SDK records both by default (CS-44), so both are switched off on every call.
  const integrations = new OpenTelemetry({ tracer: options.tracer ?? trace.getTracer(TRACER_NAME) });
  const log = options.logger.child({ component: 'ai' });
  const versions = new Map<string, string>();
  for (const [name, entry] of Object.entries(options.registry)) {
    if (entry.task.name !== name) {
      throw new TypeError(`the registry lists ${entry.task.name} under the name ${name}`);
    }
    versions.set(name, promptVersion(entry));
  }
  const versionOf = (name: string): string => {
    const version = versions.get(name);
    if (version === undefined) throw new TypeError(`no task named ${name} in the registry`);
    return version;
  };

  /**
   * One line per call: what was asked of which model, what came back and what it cost (ADR-0021 point 2.5). No
   * prompt, input, answer or problem text: a problem quotes the listing, so only the paths of the failing fields.
   */
  function writeLine(
    base: { task: string; promptVersion: string; model: ModelChoice },
    outcome: Checked<unknown>['outcome'] | 'error',
    details: {
      cached: boolean;
      attempts: readonly Attempt[];
      latencyMs: number;
      costUsd: number | null;
      answeringModel?: string | undefined;
      problems?: readonly Problem[];
      error?: ModelCallError;
    },
  ): void {
    const last = details.attempts.at(-1);
    const fields = {
      task: base.task,
      promptVersion: base.promptVersion,
      provider: base.model.provider,
      model: base.model.id,
      answeringModel: details.answeringModel ?? last?.answeringModel,
      requestId: last?.requestId,
      outcome,
      cached: details.cached,
      attempts: details.attempts.length,
      latencyMs: details.latencyMs,
      ...totalTokens(details.attempts),
      costUsd: details.costUsd,
      ...(details.problems?.length ? { problemPaths: details.problems.map((problem) => problem.path) } : {}),
      ...(details.error ? { errorReason: details.error.reason, status: details.error.status } : {}),
    };
    if (outcome === 'ok') log.info('model call completed', fields);
    else log.warn('model call completed', fields);
  }

  // Typed by the registry for callers; inside, an entry of any input and output. The overload holds because every
  // value returned was parsed by that task's own schema and passed its own checks.
  function call<Name extends keyof R & string>(
    task: Name,
    input: InputOf<R[Name]>,
    callOptions?: CallOptions,
  ): Promise<AiResult<OutputOf<R[Name]>>>;
  async function call(
    name: string,
    input: unknown,
    callOptions: CallOptions = {},
  ): Promise<AiResult<unknown>> {
    const found = options.registry[name];
    if (!found) throw new TypeError(`no task named ${name} in the registry`);
    const entry: RegistryEntry<unknown, unknown> = found;
    const base = { task: name, promptVersion: versionOf(name), model: entry.model };
    const prompt = entry.task.render(input);
    const key = cacheKey({
      task: name,
      promptVersion: base.promptVersion,
      model: entry.model,
      input: prompt,
    });
    const started = performance.now();
    const elapsed = () => Math.round(performance.now() - started);

    const stored = await options.cache?.get(key);
    if (stored) {
      // Re-checked, so a cached answer is never less valid than a fresh one: a changed check makes it a miss.
      const parsed = entry.task.schema.safeParse(stored.output);
      if (parsed.success && (entry.task.check?.(parsed.data, input) ?? []).length === 0) {
        writeLine(base, 'ok', {
          cached: true,
          attempts: [],
          latencyMs: elapsed(),
          costUsd: 0,
          answeringModel: stored.answeringModel,
        });
        return { ...base, outcome: 'ok', value: parsed.data, attempts: [], cached: true };
      }
      log.info('cached answer no longer valid', { task: name, promptVersion: base.promptVersion });
    }

    let checked: Checked<unknown>;
    try {
      checked = await generateChecked<unknown>({
        model: resolve(entry.model),
        instructions: instructionsOf(entry),
        prompt,
        schema: entry.task.schema,
        check: (output) => entry.task.check?.(output, input) ?? [],
        maxReasks: entry.settings.maxReasks,
        maxOutputTokens: entry.settings.maxOutputTokens,
        providerOptions: providerOptionsOf(entry, `${name}:${base.promptVersion}`),
        timeoutMs: entry.settings.timeoutMs,
        ...(callOptions.signal ? { signal: callOptions.signal } : {}),
        telemetry: { functionId: name, recordInputs: false, recordOutputs: false, integrations },
      });
    } catch (failure) {
      if (!(failure instanceof FailedCall)) throw failure;
      if (failure.error instanceof ModelCallError) {
        writeLine(base, 'error', {
          cached: false,
          attempts: failure.attempts,
          latencyMs: elapsed(),
          costUsd: costUsd(
            options.prices?.pricesOf(entry.model.id),
            failure.attempts.map((attempt) => attempt.usage),
            entry.settings.promptCache,
          ),
          error: failure.error,
        });
      }
      throw failure.error;
    }

    const cost = costUsd(
      options.prices?.pricesOf(entry.model.id),
      checked.attempts.map((attempt) => attempt.usage),
      entry.settings.promptCache,
    );
    if (checked.outcome !== 'ok') {
      writeLine(base, checked.outcome, {
        cached: false,
        attempts: checked.attempts,
        latencyMs: elapsed(),
        costUsd: cost,
        problems: checked.problems,
      });
      return { ...base, ...checked, cached: false };
    }
    writeLine(base, 'ok', { cached: false, attempts: checked.attempts, latencyMs: elapsed(), costUsd: cost });
    await options.cache?.put(key, {
      task: name,
      promptVersion: base.promptVersion,
      provider: entry.model.provider,
      model: entry.model.id,
      answeringModel: checked.attempts.at(-1)?.answeringModel ?? entry.model.id,
      output: toJsonObject(checked.value),
      costUsdMicros: cost === null ? null : Math.round(cost * 1_000_000),
    });
    return { ...base, outcome: 'ok', value: checked.value, attempts: checked.attempts, cached: false };
  }

  return { promptVersion: versionOf, call };
}
