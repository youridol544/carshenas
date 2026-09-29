// The core of the layer CS-45 will build, reduced to one function for the CS-44 spike: a structured call through the
// AI SDK whose answer must pass the schema and then the checks in code. A failure is fed back to the model with each
// problem named, a bounded number of times, and the caller gets a typed outcome, never an unvalidated value.
// Provider errors (network, 4xx, 5xx) are thrown: retrying them with backoff is the queue's job (ADR-0019 point 4).
import { generateText, NoObjectGeneratedError, NoOutputGeneratedError, Output } from 'ai';
import type { LanguageModel, LanguageModelUsage, ModelMessage } from 'ai';
import type { z } from 'zod';

type ProviderOptions = NonNullable<Parameters<typeof generateText>[0]['providerOptions']>;

export type AttemptOutcome = 'ok' | 'invalid' | 'refusal' | 'truncated' | 'empty';

export interface Attempt {
  outcome: AttemptOutcome;
  finishReason: string | undefined;
  rawFinishReason: string | undefined;
  /** The model that answered, as the provider reports it; Metis may route an id to another model. */
  answeringModel: string | undefined;
  usage: LanguageModelUsage | undefined;
  latencyMs: number;
  problems: string[];
}

export type Outcome<T> =
  | { kind: 'ok'; value: T; attempts: Attempt[] }
  | { kind: Exclude<AttemptOutcome, 'ok'>; problems: string[]; attempts: Attempt[] };

export interface CheckedCall<T> {
  model: LanguageModel;
  instructions: string;
  input: string;
  schema: z.ZodType<T>;
  /** Rules the schema cannot state, such as grounding in the input; each problem is fed back as written. */
  check?: (value: T) => string[];
  /** Re-asks after the first answer; CS-43 recommends one. */
  maxReasks?: number;
  maxOutputTokens?: number;
  providerOptions?: ProviderOptions;
}

export function feedbackMessage(problems: string[]): string {
  return [
    'Your answer did not pass validation:',
    ...problems.map((problem) => `- ${problem}`),
    'Answer again with the complete JSON object.',
  ].join('\n');
}

/** The schema's complaints about an answer, one line per issue, with the path and the value that was sent. */
export function describeInvalidAnswer(error: NoObjectGeneratedError): string[] {
  const zodError = (error.cause as { cause?: unknown } | undefined)?.cause;
  const issues = (zodError as { issues?: Array<{ path: PropertyKey[]; message: string }> } | undefined)?.issues;
  if (!Array.isArray(issues)) return [`the answer is not valid JSON for the schema: ${error.message}`];
  let answer: unknown;
  try {
    answer = JSON.parse(error.text ?? '');
  } catch {
    answer = undefined;
  }
  return issues.map((issue) => {
    const path = issue.path.map(String).join('.') || '(the whole answer)';
    const received = issue.path.reduce<unknown>(
      (node, key) => (node !== null && typeof node === 'object' ? (node as Record<PropertyKey, unknown>)[key] : undefined),
      answer,
    );
    return `${path}: ${issue.message}${received === undefined ? '' : `; received ${JSON.stringify(received)}`}.`;
  });
}

/** A finish reason that rules the answer out whatever its text; `undefined` when the text decides. */
function unusable(finishReason: string | undefined): 'refusal' | 'truncated' | undefined {
  if (finishReason === 'content-filter') return 'refusal';
  if (finishReason === 'length') return 'truncated';
  return undefined;
}

function classify(error: NoObjectGeneratedError): Exclude<AttemptOutcome, 'ok'> {
  return unusable(error.finishReason) ?? (error.text?.trim() ? 'invalid' : 'empty');
}

export async function generateChecked<T>(call: CheckedCall<T>): Promise<Outcome<T>> {
  const { model, instructions, input, schema, check, maxReasks = 1, maxOutputTokens, providerOptions } = call;
  const attempts: Attempt[] = [];
  const firstTurn: ModelMessage[] = [{ role: 'user', content: input }];
  // A re-ask sends a fixed context: the input, the last invalid answer and its problems, never the whole history.
  let previous: { answer: string; problems: string[] } | undefined;

  for (let attempt = 0; attempt <= maxReasks; attempt += 1) {
    const messages: ModelMessage[] = previous
      ? [
          ...firstTurn,
          { role: 'assistant', content: previous.answer },
          { role: 'user', content: feedbackMessage(previous.problems) },
        ]
      : firstTurn;
    const started = performance.now();
    try {
      const result = await generateText({
        model,
        instructions,
        messages,
        output: Output.object({ schema }),
        maxRetries: 0,
        ...(maxOutputTokens === undefined ? {} : { maxOutputTokens }),
        ...(providerOptions === undefined ? {} : { providerOptions }),
      });
      const record = (outcome: AttemptOutcome, problems: string[]) =>
        attempts.push({
          outcome,
          finishReason: result.finishReason,
          rawFinishReason: result.rawFinishReason,
          answeringModel: result.finalStep.response.modelId,
          usage: result.usage,
          latencyMs: Math.round(performance.now() - started),
          problems,
        });
      // The SDK parses the answer only when the model stopped normally or wrote some text, so a refusal or a
      // truncation with no text returns here with no output, and reading `result.output` then throws
      // NoOutputGeneratedError. The finish reason is read first.
      const cutShort = unusable(result.finishReason);
      if (cutShort) {
        record(cutShort, []);
        return { kind: cutShort, problems: [], attempts };
      }
      let value: T;
      try {
        value = result.output;
      } catch (error) {
        if (!NoOutputGeneratedError.isInstance(error)) throw error;
        record('empty', []);
        return { kind: 'empty', problems: [], attempts };
      }
      const problems = check ? check(value) : [];
      record(problems.length === 0 ? 'ok' : 'invalid', problems);
      if (problems.length === 0) return { kind: 'ok', value, attempts };
      // The same invalid answer twice means the feedback is not being used: stop rather than pay again.
      if (previous?.answer === result.text) break;
      previous = { answer: result.text, problems };
    } catch (error) {
      if (!NoObjectGeneratedError.isInstance(error)) throw error;
      const outcome = classify(error);
      const problems = outcome === 'invalid' ? describeInvalidAnswer(error) : [];
      attempts.push({
        outcome,
        finishReason: error.finishReason,
        rawFinishReason: undefined,
        answeringModel: error.response?.modelId,
        usage: error.usage,
        latencyMs: Math.round(performance.now() - started),
        problems,
      });
      if (outcome !== 'invalid') return { kind: outcome, problems, attempts };
      if (previous?.answer === error.text) break;
      previous = { answer: error.text ?? '', problems };
    }
  }
  return { kind: 'invalid', problems: previous?.problems ?? [], attempts };
}
