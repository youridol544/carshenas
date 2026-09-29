// The re-ask spike with no network: the AI SDK's own test double (MockLanguageModelV4) plays the model, so each test
// can show exactly what the model was sent. Run with `npm test` in this folder.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { MockLanguageModelV4 } from 'ai/test';
import { checkGrounding, INSTRUCTIONS, ListingFacts, SAMPLES } from './listing.ts';
import type { ListingFacts as Facts } from './listing.ts';
import { generateChecked } from './reask.ts';

type DoGenerate = ConstructorParameters<typeof MockLanguageModelV4>[0] extends infer Options
  ? Options extends { doGenerate?: infer Handler }
    ? Handler
    : never
  : never;
type GenerateResult = Awaited<ReturnType<Extract<DoGenerate, (...args: never[]) => unknown>>>;

const peugeot = SAMPLES.find((sample) => sample.id === 'peugeot-206-jalali')!;
const zwnj = String.fromCodePoint(0x200c);
const unpainted = ['بی', 'رنگ'].join(zwnj); // «بی‌رنگ» as the listing writes it, with a zero-width non-joiner
const unpaintedWithSpace = ['بی', 'رنگ'].join(' '); // the same words as models often retype them

const valid: Facts = {
  paint_evidence: unpainted,
  paint: 'none',
  price_evidence: 'کمی قابل مذاکره',
  price_type: 'negotiable',
  instructions_to_ai: false,
};

function reply(text: string, finish: 'stop' | 'length' | 'content-filter' = 'stop'): GenerateResult {
  return {
    content: text === '' ? [] : [{ type: 'text', text }],
    finishReason: { unified: finish, raw: finish },
    usage: {
      inputTokens: { total: 700, noCache: 700, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 60, text: 60, reasoning: 0 },
    },
    warnings: [],
    response: { modelId: 'mock-answering-model' },
  };
}

function modelAnswering(...texts: GenerateResult[]) {
  return new MockLanguageModelV4({ doGenerate: texts });
}

/** Each message the model received, reduced to its role and text. */
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

const call = (model: MockLanguageModelV4, maxReasks = 1) =>
  generateChecked({
    model,
    instructions: INSTRUCTIONS,
    input: peugeot.text,
    schema: ListingFacts,
    check: (facts) => checkGrounding(facts, peugeot.text),
    maxReasks,
  });

describe('a structured call through the AI SDK with a re-ask', () => {
  test('sends the provider a strict JSON Schema, with every field required and no extra properties', async () => {
    const model = modelAnswering(reply(JSON.stringify(valid)));
    await call(model);
    const format = model.doGenerateCalls[0]?.responseFormat;
    assert.equal(format?.type, 'json');
    const schema = format?.type === 'json' ? (format.schema as Record<string, unknown>) : {};
    assert.equal(schema.additionalProperties, false);
    assert.deepEqual(schema.required, ['paint_evidence', 'paint', 'price_evidence', 'price_type', 'instructions_to_ai']);
  });

  test('feeds a schema failure back to the model and returns the corrected answer', async () => {
    const wrong = JSON.stringify({ ...valid, paint: 'unpainted' });
    const model = modelAnswering(reply(wrong), reply(JSON.stringify(valid)));

    const outcome = await call(model);

    assert.equal(outcome.kind, 'ok');
    assert.deepEqual(outcome.kind === 'ok' ? outcome.value : undefined, valid);
    assert.deepEqual(
      outcome.attempts.map((attempt) => attempt.outcome),
      ['invalid', 'ok'],
    );
    const reask = sent(model, 1);
    assert.deepEqual(
      reask.map((message) => message.role),
      ['system', 'user', 'assistant', 'user'],
    );
    assert.equal(reask[2]?.text, wrong, 'the invalid answer is shown back to the model');
    const feedback = reask[3]?.text ?? '';
    assert.match(feedback, /^Your answer did not pass validation:/);
    assert.match(feedback, /- paint: Invalid option: expected one of "none"\|"spots"\|"partial"\|"full"\|"not_stated"/);
    assert.match(feedback, /received "unpainted"/);
  });

  test('feeds a grounding failure found in code back to the model and returns the corrected answer', async () => {
    const retyped = JSON.stringify({ ...valid, paint_evidence: unpaintedWithSpace });
    const model = modelAnswering(reply(retyped), reply(JSON.stringify(valid)));

    const outcome = await call(model);

    assert.equal(outcome.kind, 'ok');
    assert.equal(outcome.attempts[0]?.outcome, 'invalid');
    assert.deepEqual(outcome.attempts[0]?.problems, [
      `paint_evidence is ${JSON.stringify(unpaintedWithSpace)}, which does not appear in the listing: copy the words exactly as the listing writes them, with its own digits and spacing, or set paint_evidence to "" and paint to "not_stated".`,
    ]);
    assert.ok(sent(model, 1)[3]?.text.includes(JSON.stringify(unpaintedWithSpace)));
  });

  test('returns a typed failure, never the unvalidated value, when the answer is still invalid after the re-ask', async () => {
    const model = modelAnswering(
      reply(JSON.stringify({ ...valid, paint: 'unpainted' })),
      reply(JSON.stringify({ ...valid, paint_evidence: unpaintedWithSpace })),
    );

    const outcome = await call(model);

    assert.equal(outcome.kind, 'invalid');
    assert.equal('value' in outcome, false);
    assert.equal(model.doGenerateCalls.length, 2);
    assert.match(outcome.kind === 'invalid' ? (outcome.problems[0] ?? '') : '', /does not appear in the listing/);
  });

  test('re-asks with a fixed context: the input, the last answer and its problems, not the whole history', async () => {
    const first = JSON.stringify({ ...valid, paint: 'unpainted' });
    const second = JSON.stringify({ ...valid, paint_evidence: unpaintedWithSpace });
    const model = modelAnswering(reply(first), reply(second), reply(JSON.stringify(valid)));

    const outcome = await call(model, 2);

    assert.equal(outcome.kind, 'ok');
    const third = sent(model, 2);
    assert.equal(third.length, 4);
    assert.equal(third[2]?.text, second);
    assert.ok(!third.some((message) => message.text === first));
  });

  test('stops when the model repeats the same invalid answer', async () => {
    const wrong = reply(JSON.stringify({ ...valid, paint: 'unpainted' }));
    const model = modelAnswering(wrong, wrong, wrong);

    const outcome = await call(model, 3);

    assert.equal(outcome.kind, 'invalid');
    assert.equal(model.doGenerateCalls.length, 2);
  });

  // Both of the SDK's paths: with no text it returns a result without output; with text it tries to parse and throws.
  for (const [name, answer, kind] of [
    ['a refusal with no text', reply('', 'content-filter'), 'refusal'],
    ['a refusal with text', reply('I cannot help with that request.', 'content-filter'), 'refusal'],
    ['a truncated answer with no text', reply('', 'length'), 'truncated'],
    ['a truncated answer', reply('{"paint_evidence": "بی', 'length'), 'truncated'],
    ['an empty answer', reply(''), 'empty'],
  ] as const) {
    test(`returns ${name} as its own outcome without re-asking`, async () => {
      const model = modelAnswering(answer);
      const outcome = await call(model);
      assert.equal(outcome.kind, kind);
      assert.equal(model.doGenerateCalls.length, 1);
    });
  }

  test('records the answering model, the finish reason and the token usage of each attempt', async () => {
    const model = modelAnswering(reply(JSON.stringify(valid)));
    const outcome = await call(model);
    const [attempt] = outcome.attempts;
    assert.equal(attempt?.answeringModel, 'mock-answering-model');
    assert.equal(attempt?.finishReason, 'stop');
    assert.equal(attempt?.usage?.inputTokens, 700);
    assert.equal(attempt?.usage?.outputTokens, 60);
  });
});
