import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtureLexicon } from './fixture.ts';
import { editDistance } from './lexicon.ts';
import { tokenize } from './text.ts';

// What the catalogue knows by name (CS-62): longest name first, ambiguity stated, trims by what they add, typos only
// when one name is a slip away.

const lexicon = fixtureLexicon();
const all = () => true;

function match(text: string) {
  const tokens = tokenize(text);
  const found = lexicon.entityAt(tokens, 0, all);
  return found === undefined ? undefined : { to: found.to, keys: found.entities.map((one) => one.key) };
}

test('the longest name at a position wins', () => {
  assert.deepEqual(match('پژو ۲۰۶ تیپ ۲'), { to: 2, keys: ['peugeot.206'] });
  assert.deepEqual(match('پژو'), { to: 1, keys: ['peugeot'] });
  assert.deepEqual(match('سمند سورن'), { to: 2, keys: ['samand.soren'] });
  assert.deepEqual(match('سمند'), { to: 1, keys: ['samand'] });
});

test('Latin names, aliases and the Latin remainder of a name are names', () => {
  assert.deepEqual(match('peugeot 206'), { to: 2, keys: ['peugeot.206'] });
  assert.deepEqual(match('elantra'), { to: 1, keys: ['hyundai.elantra'] });
  assert.deepEqual(match('cerato'), { to: 1, keys: ['kia.cerato'] });
  assert.equal(match('plus'), undefined, 'a generic word that ends a name is not a name');
  assert.equal(match('manual'), undefined);
});

test('a name two entries share is stated as an ambiguity', () => {
  assert.deepEqual(match('lx')?.keys.sort(), ['lexus.lx', 'samand.lx']);
});

test('names that are everyday words are not names', () => {
  assert.equal(match('گاز'), undefined);
});

test('a trim is not found by its full name, but by what it adds to its model', () => {
  assert.equal(match('پژو 206 تیپ ۲')?.keys.includes('peugeot.206.2'), false);
  const trims = lexicon.trimsOf('peugeot.206');
  const two = trims.find((one) => one.entity.key === 'peugeot.206.2');
  assert.deepEqual([...(two?.remainders ?? [])].sort(), ['2', 'تیپ 2']);
  assert.equal(two?.shortLabel, 'تیپ ۲');
  assert.deepEqual(trims.find((one) => one.entity.key === 'peugeot.206.sd')?.remainders, ['sd']);
});

test('only a single name a slip away is a typo, and a short word never is', () => {
  assert.equal(lexicon.typoOf('پراید'), undefined, 'a name itself is no typo');
  assert.equal(lexicon.typoOf('کورولا')?.word, 'کرولا');
  assert.equal(lexicon.typoOf('سورین')?.word, 'سورن');
  assert.equal(lexicon.typoOf('پزو'), undefined, 'three letters');
  assert.equal(lexicon.typoOf('دانشجو'), undefined);
  assert.equal(lexicon.typoOf('xyzxyz'), undefined);
});

test('near names for the model step: misspellings and transliterations, nearest first', () => {
  assert.ok(lexicon.near('toyta', 3).some((one) => one.key === 'toyota'));
  assert.deepEqual(lexicon.near('zzzz', 3), []);
});

test('entities keep their listings, labels, and what the filters offer', () => {
  assert.equal(lexicon.entity('peugeot.206')?.listings, 4244);
  assert.equal(lexicon.entity('kia.cerato')?.listings, 0);
  assert.equal(lexicon.labelOf('model', 'peugeot.206'), 'پژو ۲۰۶');
  assert.equal(lexicon.labelOf('trim', 'peugeot.206.5'), 'تیپ ۵');
  assert.equal(lexicon.labelOf('city', 'karaj'), 'کرج');
  assert.equal(lexicon.hasValue('district', 'tehran.ونک'), true);
  assert.deepEqual(
    lexicon
      .searchableModels()
      .map((one) => one.key)
      .slice(0, 2),
    ['peugeot.207i', 'peugeot.206'],
  );
  assert.equal(lexicon.modelsOfMake('kia').length, 2);
});

test('edit distance counts a swap as one and stops early', () => {
  assert.equal(editDistance('پزو', 'پژو', 1), 1);
  assert.equal(editDistance('abcd', 'abdc', 1), 1);
  assert.equal(editDistance('abcdef', 'xyz', 1), 2);
  assert.equal(editDistance('same', 'same', 1), 0);
});
