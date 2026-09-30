// Worked example 2 of the ai-features skill (references/structured-output.md): a structured extraction retried on
// validation errors, read with listing-paint.ts (the schema, checkListingPaint and nextStep). The layer validates each
// answer against the schema, then runs the task's checks; a failure is fed back once, each problem naming the field,
// the value seen and what is admissible (CS-43, pattern 5); whatever still fails goes to review with its problems and
// never with a value, and only a validated answer is cached. The model here is a stub that plays Metis's Gemini route.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { createAi } from '../ai.ts';
import { memoryAnswerCache } from '../answer-cache.ts';
import { priceBookOf, type ModelPrices } from '../pricing.ts';
import { forbidNetwork, geminiReply, stubFetch, type SentRequest } from '../test-support/network.ts';
import { recordingLogger } from '../test-support/recording-logger.ts';
import { labelled } from './labelled-listings.ts';
import { fa } from '../tasks/listing-text.ts';
import { EXAMPLE_REGISTRY, nextStep, type ListingPaint } from './listing-paint.ts';

forbidNetwork();

const recorded = JSON.parse(
  readFileSync(new URL('../test-support/step-model-prices.json', import.meta.url), 'utf8'),
) as { prices: Record<string, ModelPrices> };

const l1 = labelled('L1');
/** L1 as a careful reader reports it: evidence copied from the text the model read, then the value. */
const RIGHT: ListingPaint = {
  paint_evidence: fa('بی^رنگ'),
  paint: 'none',
  price_evidence: 'قیمت مقطوع',
  price_terms: 'fixed',
  instructions_to_ai: false,
};

/** The layer as a job gets it, over a stub that gives these answers in turn. */
function layer(...answers: object[]) {
  const network = stubFetch(...answers.map((answer) => geminiReply(JSON.stringify(answer))));
  const cache = memoryAnswerCache();
  const logger = recordingLogger();
  const ai = createAi({
    apiKey: 'tpsg-example-key',
    registry: EXAMPLE_REGISTRY,
    logger,
    cache,
    prices: priceBookOf(recorded.prices),
    fetch: network.fetch,
  });
  return { ai, network, cache, logger };
}

/** What one request sent, as Gemini's route takes it: each turn's role and text. */
function turns(request: SentRequest | undefined): { role: string; text: string }[] {
  assert.ok(request, 'the request was sent');
  const contents = request.body.contents as { role: string; parts: { text: string }[] }[];
  return contents.map((turn) => ({ role: turn.role, text: turn.parts.map((part) => part.text).join('') }));
}

describe('a structured extraction retried on validation errors', () => {
  test('a value outside the schema is fed back with the values it allows, and the second answer is stored', async () => {
    const outside = { ...RIGHT, paint: 'unpainted' };
    const { ai, network, cache } = layer(outside, RIGHT);

    const result = await ai.call('example.listing-paint', l1.input);

    assert.equal(result.outcome, 'ok');
    assert.deepEqual(
      result.attempts.map((attempt) => attempt.outcome),
      ['invalid', 'ok'],
    );
    // The re-ask is a fixed context: the listing, the answer that failed, and what was wrong with it.
    const reask = turns(network.requests[1]);
    assert.deepEqual(
      reask.map((turn) => turn.role),
      ['user', 'model', 'user'],
    );
    assert.equal(reask[1]?.text, JSON.stringify(outside));
    assert.match(
      reask[2]?.text ?? '',
      /- paint: Invalid option: expected one of "none"\|"spots"\|"partial"\|"full"\|"not_stated"; received "unpainted"/,
    );
    assert.equal(cache.size, 1, 'the validated answer is cached');
    assert.deepEqual(nextStep(result, l1.input), {
      action: 'store',
      facts: RIGHT,
      answerId: 1,
      reviewFirst: [],
    });
  });

  test('evidence the checks cannot find in the listing is fed back, naming the field and the words it sent', async () => {
    // «بی رنگ» with a space where the listing has the non-joiner: valid for the schema, not a quote.
    const retyped = { ...RIGHT, paint_evidence: 'بی رنگ' };
    const { ai, network } = layer(retyped, RIGHT);

    const result = await ai.call('example.listing-paint', l1.input);

    assert.equal(result.outcome, 'ok');
    assert.deepEqual(result.attempts[0]?.problems, [
      {
        path: 'paint_evidence',
        message:
          'is "بی رنگ", which does not appear in the listing: copy the words exactly as the listing writes them, or set paint_evidence to "" and paint to "not_stated".',
      },
    ]);
    assert.match(
      turns(network.requests[1])[2]?.text ?? '',
      /^Your answer did not pass validation:\n- paint_evidence: /,
    );
  });

  test('an answer still invalid after the re-ask goes to review with its problems, and nothing is stored', async () => {
    const guessed = { ...RIGHT, price_evidence: '' };
    const { ai, network, cache, logger } = layer(guessed, guessed);

    const result = await ai.call('example.listing-paint', l1.input);

    assert.equal(result.outcome, 'invalid');
    assert.equal(network.requests.length, 2, 'one answer and one re-ask, never more');
    assert.equal(cache.size, 0, 'an invalid answer is never cached');
    const next = nextStep(result, l1.input);
    assert.ok(next.action === 'review');
    assert.equal('facts' in next, false, 'a review item carries no value');
    assert.deepEqual(
      next.problems.map((problem) => problem.path),
      ['price_evidence'],
    );
    // The line is a warning with the failing fields' paths only: a problem's message quotes the listing.
    const [line] = logger.lines.filter((recordedLine) => recordedLine.message === 'model call completed');
    assert.equal(line?.level, 'warn');
    assert.deepEqual(line.fields.problemPaths, ['price_evidence']);
    assert.equal(line.fields.attempts, 2);
  });

  test('the same question again is answered from the cache, with no request and no cost', async () => {
    const { ai, network, logger } = layer(RIGHT);
    await ai.call('example.listing-paint', l1.input);

    const again = await ai.call('example.listing-paint', l1.input);

    assert.equal(again.cached, true);
    assert.equal(network.requests.length, 1);
    const lines = logger.lines.filter((recordedLine) => recordedLine.message === 'model call completed');
    assert.deepEqual(
      lines.map((recordedLine) => [recordedLine.fields.cached, recordedLine.fields.costUsd]),
      [
        [false, 0.000942975],
        [true, 0],
      ],
    );
  });
});
