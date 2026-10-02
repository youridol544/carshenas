import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtureLexicon } from './fixture.ts';
import type { QueryReading } from './reading.ts';
import { DEGRADED_MESSAGES, understandQuery, type ModelStep } from './understand.ts';

const lexicon = fixtureLexicon();
const options = { lexicon, solarYear: 1405 } as const;

/** A model step that records what it was asked and answers with the reading it was given. */
function stubModel(reading: QueryReading) {
  const asked: unknown[] = [];
  const step: ModelStep = (input) => {
    asked.push(input);
    return Promise.resolve({ status: 'ok', reading, cached: false });
  };
  return { step, asked };
}

test('a query code settles never reaches the model, switched on or off', async () => {
  const model = stubModel({ readings: [], instructions_to_ai_evidence: '', instructions_to_ai: false });
  const off = await understandQuery('پژو ۲۰۶ زیر ۵۰۰ میلیون', { ...options, withoutModel: 'switched_off' });
  const on = await understandQuery('پژو ۲۰۶ زیر ۵۰۰ میلیون', { ...options, model: model.step });
  assert.equal(off.trace.asked, null);
  assert.equal(off.understanding.degraded, null);
  assert.deepEqual(off.understanding.search.filters, on.understanding.search.filters);
  assert.equal(model.asked.length, 0);
});

test('with the master switch off, a query code cannot settle is answered by code and says why', async () => {
  const { understanding, trace } = await understandQuery('پژو ۲۰۶ خوشگل', {
    ...options,
    withoutModel: 'switched_off',
  });
  assert.equal(trace.asked, 'left');
  assert.equal(trace.answered, 'switched_off');
  assert.equal(understanding.modelUsed, false);
  assert.deepEqual(understanding.search.filters, { model: ['peugeot.206'] });
  assert.deepEqual(understanding.degraded, {
    reason: 'switched_off',
    message: DEGRADED_MESSAGES.switched_off,
  });
  // The word nothing read is shown, never dropped, and can be searched as text.
  assert.deepEqual(
    understanding.unused.map((group) => group.words),
    ['خوشگل'],
  );
});

test('with no model and no reason given, the answer is the unavailable one', async () => {
  const { understanding } = await understandQuery('پژو ۲۰۶ خوشگل', options);
  assert.equal(understanding.degraded?.reason, 'unavailable');
});

test('a model that answers is asked only about the words left, and its reading is used', async () => {
  const model = stubModel({
    readings: [
      {
        phrase: 'خوشگل',
        target: 'filter:paint_free',
        values: [],
        number_text: '',
        number_text_to: '',
        relation: 'not_applicable',
        strength: 'inferred',
      },
    ],
    instructions_to_ai_evidence: '',
    instructions_to_ai: false,
  });
  const { understanding, trace } = await understandQuery('پژو ۲۰۶ خوشگل', { ...options, model: model.step });
  assert.equal(model.asked.length, 1);
  assert.deepEqual((model.asked[0] as { left: string[] }).left, ['خوشگل']);
  assert.equal(trace.answered, 'ok');
  assert.equal(understanding.modelUsed, true);
  assert.equal(understanding.degraded, null);
  assert.deepEqual(understanding.search.filters, { model: ['peugeot.206'], paint_free: true });
});

test('a model that does not answer in time degrades the answer to code’s own, with its reason', async () => {
  const slow: ModelStep = () => Promise.resolve({ status: 'unavailable', reason: 'timeout' });
  const { understanding, trace } = await understandQuery('پژو ۲۰۶ خوشگل', { ...options, model: slow });
  assert.equal(trace.answered, 'timeout');
  assert.equal(understanding.degraded?.reason, 'timeout');
  assert.deepEqual(understanding.search.filters, { model: ['peugeot.206'] });
});
