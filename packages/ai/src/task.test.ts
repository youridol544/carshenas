// Versioned prompts (ADR-0021 point 2.2; CS-43, patterns 8 and 18): the version changes exactly when what shapes the
// answer changes, the rendered prompt is snapshotted so a changed word shows in review, and every call of a version
// shares a byte-identical prefix that providers can cache.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { z } from 'zod';
import { createAi } from './ai.ts';
import { anthropic, openai } from './metis.ts';
import { defineTask, promptVersion, type RegistryEntry } from './task.ts';
import {
  listingCondition,
  ListingCondition,
  PEUGEOT_FACTS,
  sample,
  SAMPLES,
  type Sample,
} from './test-support/listing-condition.ts';
import { forbidNetwork, openaiReply, stubFetch } from './test-support/network.ts';
import { recordingLogger } from './test-support/recording-logger.ts';

forbidNetwork();

const entry: RegistryEntry<Sample, ListingCondition> = {
  task: listingCondition,
  model: openai('gpt-5.6-luna', { reasoningEffort: 'low' }),
  settings: { maxOutputTokens: 1024, timeoutMs: 5_000, maxReasks: 1 },
};

describe('a task name', () => {
  for (const name of [
    'Listing.Facts',
    'listing facts',
    '',
    'listing.',
    '.facts',
    'listing..facts',
    `a${'b'.repeat(100)}`,
  ]) {
    test(`${JSON.stringify(name)} is refused`, () => {
      assert.throws(() => defineTask({ ...listingCondition, name }), TypeError);
    });
  }
  test('a task without a render version is refused', () => {
    assert.throws(() => defineTask({ ...listingCondition, renderVersion: ' ' }), TypeError);
  });
  for (const name of ['listing.facts', 'query.filters', 'listing.pair-decision', 'explanation']) {
    test(`${name} is accepted`, () => {
      assert.equal(defineTask({ ...listingCondition, name }).name, name);
    });
  }
});

describe('the prompt version', () => {
  const version = promptVersion(entry);

  test('is 16 hex digits and the same for the same task', () => {
    assert.match(version, /^[0-9a-f]{16}$/);
    assert.equal(promptVersion({ ...entry, task: { ...listingCondition } }), version);
  });

  test('changes with one character of the instructions', () => {
    const task = { ...listingCondition, instructions: `${listingCondition.instructions} ` };
    assert.notEqual(promptVersion({ ...entry, task }), version);
  });

  test('changes with the schema', () => {
    const schema = ListingCondition.extend({ paint: z.enum(['none', 'spots', 'partial', 'full']) });
    const task = { ...listingCondition, schema };
    assert.notEqual(promptVersion({ ...entry, task }), version);
  });

  test("changes with the checks' version, so a changed check never meets an answer stored under the old one", () => {
    const run: NonNullable<typeof listingCondition.checks>['run'] = (facts, listing) =>
      listingCondition.checks?.run(facts, listing) ?? [];
    const task = { ...listingCondition, checks: { version: 'grounding-2', run } };
    assert.notEqual(promptVersion({ ...entry, task }), version);
  });

  test("changes with the render's version, so an evaluation of the old render no longer covers it (CS-84)", () => {
    const render = (listing: Parameters<typeof listingCondition.render>[0]) => listing.text.trim();
    const task = { ...listingCondition, render, renderVersion: 'text-trimmed-1' };
    assert.notEqual(promptVersion({ ...entry, task }), version);
  });

  test('stays with a new render function under the same render version: the version is declared, not guessed', () => {
    const render = (listing: Parameters<typeof listingCondition.render>[0]) => listing.text;
    assert.equal(promptVersion({ ...entry, task: { ...listingCondition, render } }), version);
  });

  test('changes with the output budget, which can cut an answer short', () => {
    assert.notEqual(
      promptVersion({ ...entry, settings: { ...entry.settings, maxOutputTokens: 2048 } }),
      version,
    );
  });

  test('stays when only the model, the timeout, the re-asks or provider caching change: none rewrites the prompt', () => {
    assert.equal(promptVersion({ ...entry, model: anthropic('claude-haiku-4-5') }), version);
    assert.equal(
      promptVersion({
        ...entry,
        settings: { ...entry.settings, timeoutMs: 60_000, maxReasks: 0, promptCache: '1h' },
      }),
      version,
    );
  });
});

test('the rendered prompt of a task is snapshotted, so a changed word shows in review', (t) => {
  t.assert.snapshot({
    promptVersion: promptVersion(entry),
    instructions: listingCondition.instructions,
    input: listingCondition.render(sample('peugeot-206-jalali')),
  });
});

test('every call of one version sends a byte-identical prefix, with the input last', async () => {
  const network = stubFetch(openaiReply(JSON.stringify(PEUGEOT_FACTS)));
  // One answer for every listing fails grounding on the others; with no re-ask each listing is one request.
  const oneAttempt = { ...entry, settings: { ...entry.settings, maxReasks: 0 as const } };
  const ai = createAi({
    apiKey: 'tpsg-prefix-check',
    registry: { 'listing.condition': oneAttempt },
    logger: recordingLogger(),
    fetch: network.fetch,
  });
  for (const listing of SAMPLES) await ai.call('listing.condition', listing);

  const prefixes = network.requests.map(({ body }) => {
    const messages = body.messages as { role: string; content: unknown }[];
    return JSON.stringify({ ...body, messages: messages.slice(0, -1) });
  });
  const inputs = network.requests.map(({ body }) =>
    (body.messages as { role: string; content: unknown }[]).at(-1),
  );
  assert.equal(network.requests.length, SAMPLES.length);
  assert.equal(new Set(prefixes).size, 1, 'everything before the input is the same bytes');
  assert.deepEqual(
    inputs.map((message) => message?.role),
    SAMPLES.map(() => 'user'),
  );
  assert.deepEqual(
    inputs.map((message) => message?.content),
    SAMPLES.map((listing) => listing.text),
  );
});
