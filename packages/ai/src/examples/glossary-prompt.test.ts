// Worked example 1 of the ai-features skill (references/prompting.md): a versioned prompt that carries the glossary,
// read with listing-paint.ts. The rendered prompt is snapshotted, so a changed word shows in review; a seller's new
// word is a new prompt version, so no answer cached under the old glossary is reused; and every call of a version
// sends the same bytes before the listing, which is the prefix the providers' caches reuse (CS-43, patterns 8, 13
// and 18). Refresh the snapshot with `pnpm --filter @carshenas/ai test:update-snapshots` and read its diff.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAi } from '../ai.ts';
import { promptVersion } from '../task.ts';
import { forbidNetwork, geminiReply, stubFetch } from '../test-support/network.ts';
import { recordingLogger } from '../test-support/recording-logger.ts';
import { LABELLED, labelled } from './labelled-listings.ts';
import {
  GLOSSARY,
  INSTRUCTIONS,
  instructionsFrom,
  listingPaint,
  listingPaintEntry,
} from './listing-paint.ts';

forbidNetwork();

test('the rendered prompt is snapshotted: the instructions with the glossary, then one listing', (t) => {
  t.assert.snapshot({
    promptVersion: promptVersion(listingPaintEntry),
    instructions: INSTRUCTIONS,
    input: listingPaint.render(labelled('L1').input),
  });
});

test('every word of the glossary reaches the model, rendered the same way every time', () => {
  for (const fact of Object.values(GLOSSARY)) {
    for (const term of Object.values<{ words: readonly string[] }>(fact.terms)) {
      for (const word of term.words) assert.ok(INSTRUCTIONS.includes(`«${word}»`), word);
    }
  }
  assert.equal(instructionsFrom(GLOSSARY), INSTRUCTIONS);
});

test("a seller's new word is a new prompt version, so no answer cached under the old glossary is reused", () => {
  const { spots } = GLOSSARY.paint.terms;
  const withTouchUp = {
    ...GLOSSARY,
    paint: {
      ...GLOSSARY.paint,
      terms: { ...GLOSSARY.paint.terms, spots: { ...spots, words: [...spots.words, 'آبرنگ'] } },
    },
  };
  const task = { ...listingPaint, instructions: instructionsFrom(withTouchUp) };
  assert.notEqual(promptVersion({ ...listingPaintEntry, task }), promptVersion(listingPaintEntry));
});

test('every call of a version sends the same prefix, with no date or id in it, and the listing last', async () => {
  // One answer for every listing fails the checks on the others; with no re-ask, each listing is one request.
  const network = stubFetch(geminiReply('{}'));
  const oneAttempt = {
    ...listingPaintEntry,
    settings: { ...listingPaintEntry.settings, maxReasks: 0 as const },
  };
  const ai = createAi({
    apiKey: 'tpsg-example-key',
    registry: { 'example.listing-paint': oneAttempt },
    logger: recordingLogger(),
    fetch: network.fetch,
  });
  for (const item of LABELLED) await ai.call('example.listing-paint', item.input);

  type Turn = { role: string; parts: { text: string }[] };
  const turns = network.requests.map(({ body }) => body.contents as Turn[]);
  const prefixes = network.requests.map(({ body }) => JSON.stringify({ ...body, contents: undefined }));
  assert.equal(network.requests.length, LABELLED.length);
  assert.equal(
    new Set(prefixes).size,
    1,
    'the instructions, schema and settings are the same bytes on every call',
  );
  assert.deepEqual(
    turns.map((contents) => contents.map((turn) => turn.role)),
    LABELLED.map(() => ['user']),
    'the listing is the one user turn, after the instructions',
  );
  assert.deepEqual(
    turns.map((contents) => contents[0]?.parts[0]?.text),
    LABELLED.map((item) => listingPaint.render(item.input)),
  );
  assert.doesNotMatch(INSTRUCTIONS, /\d{4}-\d{2}-\d{2}|\d{1,2}:\d{2}/, 'no date or time in the prefix');
});
