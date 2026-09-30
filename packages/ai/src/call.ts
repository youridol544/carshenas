// One checked call (ADR-0021 point 2.3), grown from CS-44's spike: a structured call through the AI SDK whose answer
// must pass the schema and then the checks in code. A failure is fed back once with each problem named, and the
// caller gets one typed outcome, never an unvalidated value. A call that gets no answer at all throws a
// ModelCallError: the SDK's retries are off (maxRetries 0), because the queue retries in the worker and the web path
// has one attempt within its deadline (ADR-0021 point 2.6).
import type { LanguageModelV4, SharedV4ProviderOptions } from '@ai-sdk/provider';
import {
  APICallError,
  generateText,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  Output,
  type LanguageModelUsage,
  type ModelMessage,
  type SystemModelMessage,
  type TelemetryOptions,
} from 'ai';
import type { z } from 'zod';
import { failureOfStatus, ModelCallError } from './errors.ts';
import type { Problem } from './task.ts';

/** ok: valid and checked. The rest go to review (ADR-0011 point 6); none carries the answer. */
export const OUTCOMES = ['ok', 'invalid', 'refusal', 'truncated', 'empty'] as const;
export type Outcome = (typeof OUTCOMES)[number];

/** Tokens as Metis bills them. Input is split so each part is priced at its own rate; output includes reasoning. */
export type TokenUsage = {
  /** Input read at the full price. */
  readonly inputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheWriteTokens: number;
  /** Everything the model wrote, reasoning included. */
  readonly outputTokens: number;
  readonly reasoningTokens: number;
};

export type Attempt = {
  readonly outcome: Outcome;
  readonly finishReason: string | undefined;
  /** The model that answered, as the provider reports it: Metis routes some ids to another model (CS-42). */
  readonly answeringModel: string | undefined;
  readonly requestId: string | undefined;
  readonly usage: TokenUsage;
  readonly latencyMs: number;
  readonly problems: readonly Problem[];
};

export type Checked<Output> =
  | { readonly outcome: 'ok'; readonly value: Output; readonly attempts: readonly Attempt[] }
  | {
      readonly outcome: Exclude<Outcome, 'ok'>;
      /** What was wrong with the last answer: the review queue's reason. */
      readonly problems: readonly Problem[];
      readonly attempts: readonly Attempt[];
    };

export type CheckedCall<Output> = {
  readonly model: LanguageModelV4;
  /** The stable prefix, a system message so a provider cache breakpoint can sit on it. */
  readonly instructions: string | SystemModelMessage;
  /** The rendered input: the one user message of the first attempt. */
  readonly prompt: string;
  readonly schema: z.ZodType<Output>;
  readonly check?: (output: Output) => readonly Problem[];
  readonly maxReasks: number;
  readonly maxOutputTokens: number;
  readonly providerOptions: SharedV4ProviderOptions;
  /** Each attempt's deadline. */
  readonly timeoutMs: number;
  /** The caller's own signal: a job taken back or shut down, a visitor who left. */
  readonly signal?: AbortSignal;
  readonly telemetry?: TelemetryOptions;
};

const NO_TOKENS: TokenUsage = {
  inputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  outputTokens: 0,
  reasoningTokens: 0,
};

export function tokensOf(usage: LanguageModelUsage | undefined): TokenUsage {
  if (!usage) return NO_TOKENS;
  const input = usage.inputTokens ?? 0;
  const cacheRead = usage.inputTokenDetails.cacheReadTokens ?? 0;
  const cacheWrite = usage.inputTokenDetails.cacheWriteTokens ?? 0;
  return {
    inputTokens: usage.inputTokenDetails.noCacheTokens ?? Math.max(0, input - cacheRead - cacheWrite),
    cacheReadTokens: cacheRead,
    cacheWriteTokens: cacheWrite,
    outputTokens: usage.outputTokens ?? 0,
    reasoningTokens: usage.outputTokenDetails.reasoningTokens ?? 0,
  };
}

const REQUEST_ID_HEADERS = ['x-request-id', 'request-id'];

function requestIdOf(headers: Record<string, string> | undefined): string | undefined {
  for (const name of REQUEST_ID_HEADERS) {
    const value = headers?.[name];
    if (value) return value;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * OpenAI's refusal: Chat Completions puts it in `message.refusal` with a normal finish reason, and the SDK's OpenAI
 * package drops that field, so a refusal would otherwise read as an empty answer (CS-44).
 */
export function refusalInBody(body: unknown): boolean {
  if (!isRecord(body) || !Array.isArray(body.choices)) return false;
  const [choice] = body.choices as unknown[];
  if (!isRecord(choice) || !isRecord(choice.message)) return false;
  const { refusal } = choice.message;
  return typeof refusal === 'string' && refusal.trim() !== '';
}

/** A finish reason that rules the answer out whatever its text; undefined when the text decides. */
function cutShort(finishReason: string | undefined): 'refusal' | 'truncated' | undefined {
  if (finishReason === 'content-filter') return 'refusal';
  if (finishReason === 'length') return 'truncated';
  return undefined;
}

const WHOLE_ANSWER = '(the whole answer)';

function valueAt(answer: unknown, path: readonly PropertyKey[]): unknown {
  let node = answer;
  for (const key of path) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<PropertyKey, unknown>)[key];
  }
  return node;
}

/** The schema's complaints about an answer: one problem per issue, with its path and the value that was sent. */
export function schemaProblems(error: NoObjectGeneratedError): Problem[] {
  const zodError = isRecord(error.cause) ? error.cause.cause : undefined;
  const issues = isRecord(zodError) ? zodError.issues : undefined;
  if (!Array.isArray(issues)) {
    return [{ path: WHOLE_ANSWER, message: 'is not a JSON object that follows the schema' }];
  }
  let answer: unknown;
  try {
    answer = JSON.parse(error.text ?? '');
  } catch {
    answer = undefined;
  }
  return issues.filter(isRecord).map((issue) => {
    const path = Array.isArray(issue.path) ? (issue.path as PropertyKey[]) : [];
    const received = valueAt(answer, path);
    const message = typeof issue.message === 'string' ? issue.message : 'is invalid';
    return {
      path: path.map(String).join('.') || WHOLE_ANSWER,
      message: received === undefined ? message : `${message}; received ${JSON.stringify(received)}`,
    };
  });
}

/** The re-ask's message: each problem on its own line, then the instruction to answer again in full. */
export function feedbackMessage(problems: readonly Problem[]): string {
  return [
    'Your answer did not pass validation:',
    ...problems.map((problem) => `- ${problem.path}: ${problem.message}`),
    'Answer again with the complete JSON object.',
  ].join('\n');
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
}

/** A failure with no answer, as the layer's own error; anything else is a bug and goes up unchanged. */
function asCallError(error: unknown, caller: AbortSignal | undefined): Error {
  if (APICallError.isInstance(error)) {
    return error.statusCode === undefined
      ? new ModelCallError('unavailable', { cause: error })
      : new ModelCallError(failureOfStatus(error.statusCode), { status: error.statusCode, cause: error });
  }
  if (isAbort(error)) return new ModelCallError(caller?.aborted ? 'aborted' : 'timeout', { cause: error });
  return error instanceof Error ? error : new Error('a model call threw a non-error', { cause: error });
}

/** A call that ended without an answer: the error to rethrow, and the attempts made before it, for the log line. */
export class FailedCall extends Error {
  override readonly name = 'FailedCall';
  readonly error: Error;
  readonly attempts: readonly Attempt[];

  constructor(error: Error, attempts: readonly Attempt[]) {
    super('model call failed', { cause: error });
    this.error = error;
    this.attempts = attempts;
  }
}

export async function generateChecked<Output>(call: CheckedCall<Output>): Promise<Checked<Output>> {
  const attempts: Attempt[] = [];
  const firstTurn: ModelMessage[] = [{ role: 'user', content: call.prompt }];
  // A re-ask sends a fixed context: the input, the last invalid answer and its problems, never the whole history.
  let previous: { answer: string; problems: readonly Problem[] } | undefined;

  for (let attempt = 0; attempt <= call.maxReasks; attempt += 1) {
    const messages: ModelMessage[] = previous
      ? [
          ...firstTurn,
          { role: 'assistant', content: previous.answer },
          { role: 'user', content: feedbackMessage(previous.problems) },
        ]
      : firstTurn;
    const signal = call.signal
      ? AbortSignal.any([call.signal, AbortSignal.timeout(call.timeoutMs)])
      : AbortSignal.timeout(call.timeoutMs);
    const started = performance.now();
    const elapsed = () => Math.round(performance.now() - started);
    try {
      const result = await generateText({
        model: call.model,
        instructions: call.instructions,
        messages,
        output: Output.object({ schema: call.schema }),
        maxRetries: 0,
        maxOutputTokens: call.maxOutputTokens,
        providerOptions: call.providerOptions,
        // Kept for OpenAI's refusal field, which only the raw body carries; the SDK drops the body by default.
        include: { responseBody: true },
        abortSignal: signal,
        ...(call.telemetry ? { telemetry: call.telemetry } : {}),
      });
      const { response } = result.finalStep;
      const record = (outcome: Outcome, problems: readonly Problem[]) => {
        attempts.push({
          outcome,
          finishReason: result.finishReason,
          answeringModel: response.modelId,
          requestId: requestIdOf(response.headers),
          usage: tokensOf(result.usage),
          latencyMs: elapsed(),
          problems,
        });
      };
      // The SDK parses the answer only when the model stopped normally or wrote some text, so a refusal or a
      // truncation with no text comes back here without output, and reading `output` would throw. The finish
      // reason and the refusal field are read first.
      const stopped = cutShort(result.finishReason) ?? (refusalInBody(response.body) ? 'refusal' : undefined);
      if (stopped) {
        record(stopped, []);
        return { outcome: stopped, problems: [], attempts };
      }
      let value: Output;
      try {
        value = result.output;
      } catch (error) {
        if (!NoOutputGeneratedError.isInstance(error)) throw error;
        record('empty', []);
        return { outcome: 'empty', problems: [], attempts };
      }
      const problems = call.check?.(value) ?? [];
      record(problems.length === 0 ? 'ok' : 'invalid', problems);
      if (problems.length === 0) return { outcome: 'ok', value, attempts };
      // The same invalid answer twice means the feedback is not being used: stop rather than pay again.
      if (previous?.answer === result.text) break;
      previous = { answer: result.text, problems };
    } catch (error) {
      if (!NoObjectGeneratedError.isInstance(error))
        throw new FailedCall(asCallError(error, call.signal), attempts);
      const stopped =
        cutShort(error.finishReason) ?? (refusalInBody(error.response?.body) ? 'refusal' : undefined);
      const outcome = stopped ?? (error.text?.trim() ? 'invalid' : 'empty');
      const problems = outcome === 'invalid' ? schemaProblems(error) : [];
      attempts.push({
        outcome,
        finishReason: error.finishReason,
        answeringModel: error.response?.modelId,
        requestId: requestIdOf(error.response?.headers),
        usage: tokensOf(error.usage),
        latencyMs: elapsed(),
        problems,
      });
      if (outcome !== 'invalid') return { outcome, problems, attempts };
      if (previous?.answer === error.text) break;
      previous = { answer: error.text ?? '', problems };
    }
  }
  return { outcome: 'invalid', problems: previous?.problems ?? [], attempts };
}
