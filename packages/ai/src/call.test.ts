// The checked call on the AI SDK's own test double (MockLanguageModelV4), so each test can show exactly what the
// model was sent: the re-ask with the problems fed back, the typed outcomes, and a failure that never returns the
// unvalidated value (CS-45 #2).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { MockLanguageModelV4 } from 'ai/test';
import { FailedCall, feedbackMessage, generateChecked, refusalInBody, type Checked } from './call.ts';
import { ModelCallError } from './errors.ts';
import {
  checkGrounding,
  INSTRUCTIONS,
  ListingCondition,
  PEUGEOT_EVIDENCE_RETYPED,
  PEUGEOT_FACTS,
  PEUGEOT_PAINT_OUTSIDE_ENUM,
  sample,
} from './test-support/listing-condition.ts';
import { forbidNetwork } from './test-support/network.ts';

forbidNetwork();

type DoGenerate = NonNullable<ConstructorParameters<typeof MockLanguageModelV4>[0]>['doGenerate'];
type GenerateResult = Awaited<ReturnType<Extract<DoGenerate, (...args: never[]) => unknown>>>;

const peugeot = sample('peugeot-206-jalali');

function reply(
  text: string,
  finish: 'stop' | 'length' | 'content-filter' = 'stop',
  body?: unknown,
): GenerateResult {
  return {
    content: text === '' ? [] : [{ type: 'text', text }],
    finishReason: { unified: finish, raw: finish },
    usage: {
      inputTokens: { total: 700, noCache: 188, cacheRead: 512, cacheWrite: 0 },
      outputTokens: { total: 93, text: 63, reasoning: 30 },
    },
    warnings: [],
    response: { modelId: 'mock-answering-model', headers: { 'x-request-id': 'req_1' }, body },
  };
}

const modelAnswering = (...answers: GenerateResult[]) => new MockLanguageModelV4({ doGenerate: answers });

/** Each message the model received on one call, reduced to its role and text. */
function sent(model: MockLanguageModelV4, call: number) {
  const options = model.doGenerateCalls[call];
  assert.ok(options, `call ${call} was made`);
  return options.prompt.map((message) => ({
    role: message.role,
    text:
      typeof message.content === 'string'
        ? message.content
        : message.content.map((part) => ('text' in part ? part.text : `[${part.type}]`)).join(''),
  }));
}

function checked(model: MockLanguageModelV4, maxReasks = 1, signal?: AbortSignal) {
  return generateChecked({
    model,
    instructions: INSTRUCTIONS,
    prompt: peugeot.text,
    schema: ListingCondition,
    check: (facts) => checkGrounding(facts, peugeot.text),
    maxReasks,
    maxOutputTokens: 1024,
    providerOptions: {},
    timeoutMs: 5_000,
    ...(signal ? { signal } : {}),
  });
}

function valueOf<T>(result: Checked<T>): T | undefined {
  return result.outcome === 'ok' ? result.value : undefined;
}

describe('a checked call', () => {
  test('sends a strict JSON Schema with every field required and no extra properties', async () => {
    const model = modelAnswering(reply(JSON.stringify(PEUGEOT_FACTS)));
    await checked(model);
    const format = model.doGenerateCalls[0]?.responseFormat;
    assert.equal(format?.type, 'json');
    assert.equal(format.schema?.additionalProperties, false);
    assert.deepEqual(format.schema.required, [
      'paint_evidence',
      'paint',
      'price_evidence',
      'price_type',
      'instructions_to_ai',
    ]);
  });

  test('asks once, with no retries of its own, when the first answer is valid', async () => {
    const model = modelAnswering(reply(JSON.stringify(PEUGEOT_FACTS)));
    const result = await checked(model);
    assert.equal(result.outcome, 'ok');
    assert.deepEqual(valueOf(result), PEUGEOT_FACTS);
    assert.equal(model.doGenerateCalls.length, 1);
  });

  test('feeds a schema failure back, naming the field, the value sent and what is allowed', async () => {
    const wrong = JSON.stringify(PEUGEOT_PAINT_OUTSIDE_ENUM);
    const model = modelAnswering(reply(wrong), reply(JSON.stringify(PEUGEOT_FACTS)));

    const result = await checked(model);

    assert.equal(result.outcome, 'ok');
    assert.deepEqual(valueOf(result), PEUGEOT_FACTS);
    assert.deepEqual(
      result.attempts.map((attempt) => attempt.outcome),
      ['invalid', 'ok'],
    );
    const reask = sent(model, 1);
    assert.deepEqual(
      reask.map((message) => message.role),
      ['system', 'user', 'assistant', 'user'],
    );
    assert.equal(reask[2]?.text, wrong, 'the invalid answer is shown back to the model');
    const feedback = reask[3]?.text ?? '';
    assert.match(feedback, /^Your answer did not pass validation:\n/);
    assert.match(
      feedback,
      /- paint: Invalid option: expected one of "none"\|"spots"\|"partial"\|"full"\|"not_stated"/,
    );
    assert.match(feedback, /received "unpainted"/);
    assert.match(feedback, /\nAnswer again with the complete JSON object\.$/);
  });

  test('feeds a failure the checks in code find back to the model', async () => {
    const retyped = JSON.stringify(PEUGEOT_EVIDENCE_RETYPED);
    const model = modelAnswering(reply(retyped), reply(JSON.stringify(PEUGEOT_FACTS)));

    const result = await checked(model);

    assert.equal(result.outcome, 'ok');
    assert.equal(result.attempts[0]?.outcome, 'invalid');
    assert.deepEqual(
      result.attempts[0].problems.map((problem) => problem.path),
      ['paint_evidence'],
    );
    assert.ok(sent(model, 1)[3]?.text.includes(JSON.stringify(PEUGEOT_EVIDENCE_RETYPED.paint_evidence)));
  });

  test('returns a typed failure, never the unvalidated value, when the answer is still invalid after the re-ask', async () => {
    const model = modelAnswering(
      reply(JSON.stringify(PEUGEOT_PAINT_OUTSIDE_ENUM)),
      reply(JSON.stringify(PEUGEOT_EVIDENCE_RETYPED)),
    );

    const result = await checked(model);

    assert.equal(result.outcome, 'invalid');
    assert.equal('value' in result, false);
    assert.equal(model.doGenerateCalls.length, 2);
    assert.match(result.problems[0]?.message ?? '', /does not appear/);
  });

  test('re-asks with a fixed context: the input, the last answer and its problems, not the whole history', async () => {
    const first = JSON.stringify(PEUGEOT_PAINT_OUTSIDE_ENUM);
    const second = JSON.stringify(PEUGEOT_EVIDENCE_RETYPED);
    const model = modelAnswering(reply(first), reply(second), reply(JSON.stringify(PEUGEOT_FACTS)));

    const result = await checked(model, 2);

    assert.equal(result.outcome, 'ok');
    const third = sent(model, 2);
    assert.equal(third.length, 4);
    assert.equal(third[2]?.text, second);
    assert.ok(!third.some((message) => message.text === first));
  });

  test('stops when the model repeats the same invalid answer', async () => {
    const wrong = reply(JSON.stringify(PEUGEOT_PAINT_OUTSIDE_ENUM));
    const model = modelAnswering(wrong, wrong, wrong);

    const result = await checked(model, 3);

    assert.equal(result.outcome, 'invalid');
    assert.equal(model.doGenerateCalls.length, 2);
  });

  test('with no re-asks allowed, an invalid first answer is the outcome', async () => {
    const model = modelAnswering(reply(JSON.stringify(PEUGEOT_PAINT_OUTSIDE_ENUM)));
    const result = await checked(model, 0);
    assert.equal(result.outcome, 'invalid');
    assert.equal(model.doGenerateCalls.length, 1);
  });

  // Both of the SDK's paths: with no text it returns a result without output; with text it parses and throws.
  const openaiRefusal = {
    choices: [{ message: { content: null, refusal: 'I cannot help with that request.' } }],
  };
  for (const [name, answer, outcome] of [
    ['a refusal with no text', reply('', 'content-filter'), 'refusal'],
    ['a refusal with text', reply('I cannot help with that request.', 'content-filter'), 'refusal'],
    ["OpenAI's refusal field, with a normal finish", reply('', 'stop', openaiRefusal), 'refusal'],
    ['a truncated answer with no text', reply('', 'length'), 'truncated'],
    ['a truncated answer', reply('{"paint_evidence": "بی', 'length'), 'truncated'],
    ['an empty answer', reply(''), 'empty'],
  ] as const) {
    test(`returns ${name} as its own outcome without re-asking`, async () => {
      const model = modelAnswering(answer);
      const result = await checked(model);
      assert.equal(result.outcome, outcome);
      assert.equal(model.doGenerateCalls.length, 1);
    });
  }

  test('records the answering model, the request id, the finish reason and the tokens of each attempt', async () => {
    const model = modelAnswering(reply(JSON.stringify(PEUGEOT_FACTS)));
    const [attempt] = (await checked(model)).attempts;
    assert.equal(attempt?.answeringModel, 'mock-answering-model');
    assert.equal(attempt.requestId, 'req_1');
    assert.equal(attempt.finishReason, 'stop');
    assert.deepEqual(attempt.usage, {
      inputTokens: 188,
      cacheReadTokens: 512,
      cacheWriteTokens: 0,
      outputTokens: 93,
      reasoningTokens: 30,
    });
  });

  test('a call the caller aborts surfaces as FailedCall with the attempts made before it', async () => {
    const controller = new AbortController();
    let calls = 0;
    const model = new MockLanguageModelV4({
      doGenerate: () => {
        calls += 1;
        if (calls === 1) return Promise.resolve(reply(JSON.stringify(PEUGEOT_PAINT_OUTSIDE_ENUM)));
        controller.abort();
        return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
      },
    });
    const failure = await checked(model, 1, controller.signal).then(
      () => assert.fail('the call should fail'),
      (error: unknown) => error,
    );
    assert.ok(failure instanceof FailedCall);
    assert.ok(failure.error instanceof ModelCallError);
    assert.equal(failure.error.reason, 'aborted');
    assert.equal(failure.attempts.length, 1);
  });
});

test('the OpenAI refusal field is read only where Chat Completions puts it', () => {
  assert.equal(refusalInBody({ choices: [{ message: { refusal: 'no' } }] }), true);
  assert.equal(refusalInBody({ choices: [{ message: { refusal: null, content: '{}' } }] }), false);
  assert.equal(refusalInBody({ choices: [{ message: { refusal: '  ' } }] }), false);
  assert.equal(refusalInBody({ candidates: [] }), false);
  assert.equal(refusalInBody(undefined), false);
});

test('the feedback lists each problem on its own line', () => {
  assert.equal(
    feedbackMessage([
      { path: 'paint', message: 'is wrong' },
      { path: 'price_type', message: 'is also wrong' },
    ]),
    'Your answer did not pass validation:\n- paint: is wrong\n- price_type: is also wrong\nAnswer again with the complete JSON object.',
  );
});
