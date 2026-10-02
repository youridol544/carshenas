import assert from 'node:assert/strict';
import { test } from 'node:test';
import { placeDivarKey, slugOf } from './catalogue.ts';
import { BODY_TYPES, COLOURS } from './codes.ts';
import { CURATION_DOUBTS, DIVAR_MAKES, TRIM_BODY_TYPES } from './divar-catalogue.ts';
import { MAKE_ALIASES, OTHER_MODEL_ALIASES, TRACKED_MODEL_ALIASES } from './aliases.ts';
import { TRACKED_MODELS } from '../sources/divar/tracked-models.ts';

const MODELS = new Map(
  Object.entries(DIVAR_MAKES).map(([make, { models }]) => [
    make,
    Object.keys(models).map((rest) => `${make} ${rest}`),
  ]),
);

test('a slug is Latin letters and digits folded by hyphens, and the fallback when a name has none', () => {
  assert.equal(slugOf('Range Rover-Evoque', 'x'), 'range-rover-evoque');
  assert.equal(slugOf('Škoda', 'x'), 'skoda');
  assert.equal(slugOf('Bi-fuel(CNG)', 'x'), 'bi-fuel-cng');
  assert.equal(slugOf('تیگو 8 پرو E plus', 'x'), '8-e-plus');
  assert.equal(slugOf('تیگو', 'model-3'), 'model-3');
});

test('a Divar key is placed under the longest make and model it starts with', () => {
  assert.deepEqual(placeDivarKey('Peugeot', MODELS), { level: 'make', make: 'Peugeot' });
  assert.deepEqual(placeDivarKey('Peugeot 206', MODELS), {
    level: 'model',
    make: 'Peugeot',
    model: 'Peugeot 206',
  });
  assert.deepEqual(placeDivarKey('Peugeot 206 SD V8', MODELS), {
    level: 'trim',
    make: 'Peugeot',
    model: 'Peugeot 206',
    trim: 'Peugeot 206 SD V8',
  });
  // «IranKhodro Van» is a make of its own, not a model of another; «Pride Pickup 151 GX» is a trim of the pickup.
  assert.deepEqual(placeDivarKey('IranKhodro Van Ghazal', MODELS), {
    level: 'model',
    make: 'IranKhodro Van',
    model: 'IranKhodro Van Ghazal',
  });
  assert.deepEqual(placeDivarKey('Pride Pickup 151 GX', MODELS), {
    level: 'trim',
    make: 'Pride',
    model: 'Pride Pickup',
    trim: 'Pride Pickup 151 GX',
  });
  // A model the catalogue does not list yet is learned as a model of its make; a make it does not know is nowhere.
  assert.deepEqual(placeDivarKey('Chevrolet Camaro', MODELS), {
    level: 'model',
    make: 'Chevrolet',
    model: 'Chevrolet Camaro',
  });
  assert.equal(placeDivarKey('Trabant 601', MODELS), undefined);
});

test('every tracked model is in the catalogue with a body type and curated aliases in each script', () => {
  for (const tracked of TRACKED_MODELS) {
    const make = Object.keys(DIVAR_MAKES).find((key) => tracked.brandModel.startsWith(`${key} `));
    assert.ok(make, tracked.brandModel);
    assert.ok(DIVAR_MAKES[make]?.models[tracked.brandModel.slice(make.length + 1)], tracked.brandModel);
    const scripts = new Set(TRACKED_MODEL_ALIASES[tracked.brandModel]?.map((alias) => alias.script));
    assert.ok(scripts.has('fa') && scripts.has('latin'), tracked.brandModel);
  }
  for (const key of ['Peugeot 206', 'Peugeot 405', 'Pride 131'])
    assert.ok(
      TRACKED_MODEL_ALIASES[key]?.some((alias) => alias.script === 'spelled'),
      key,
    );
});

test('the curated lists name only what exists', () => {
  const codes = new Set(BODY_TYPES.map((type) => type.code));
  for (const make of Object.values(DIVAR_MAKES))
    for (const bodyType of Object.values(make.models)) assert.ok(bodyType === null || codes.has(bodyType));
  const keys = new Set([...MODELS.values()].flat());
  for (const doubt of CURATION_DOUBTS) assert.ok(keys.has(doubt), doubt);
  for (const rule of TRIM_BODY_TYPES) assert.ok(keys.has(rule.model), rule.model);
  assert.equal(new Set(COLOURS.map((colour) => colour.labelFa)).size, COLOURS.length);
  const corollaCross = TRIM_BODY_TYPES.find((rule) => rule.model === 'Toyota Corolla');
  assert.ok(corollaCross, 'the Corolla Cross rule');
  assert.ok(corollaCross.trimWord.test('Corolla CROSS Hybrid'));
  assert.ok(corollaCross.trimWord.test('Cross Petrol 2.0L'));
  assert.ok(!corollaCross.trimWord.test('1800 Hybrid'));
});

test('the curated make aliases name makes the catalogue has, and no alias is written twice for one target', () => {
  for (const key of Object.keys(MAKE_ALIASES)) assert.ok(DIVAR_MAKES[key], key);
  for (const [key, aliases] of [
    ...Object.entries(MAKE_ALIASES),
    ...Object.entries(TRACKED_MODEL_ALIASES),
    ...Object.entries(OTHER_MODEL_ALIASES),
  ]) {
    const written = aliases.map((alias) => alias.alias.toLowerCase());
    assert.equal(new Set(written).size, written.length, key);
  }
  for (const key of Object.keys(OTHER_MODEL_ALIASES)) {
    const make = Object.keys(DIVAR_MAKES).find((one) => key.startsWith(`${one} `));
    assert.ok(make && DIVAR_MAKES[make]?.models[key.slice(make.length + 1)], key);
  }
});
