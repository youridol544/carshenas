import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SearchFiltersSchema } from '../search.ts';
import { SORT_IDS } from '../sorts.ts';
import { FILLER_WORDS } from './fillers.ts';
import { INTENT_IDS } from './intents.ts';
import { conflictingPhrases, indexPhrases, PHRASES } from './phrases.ts';

// The documented phrases (CS-62, S04 "Phrases"): every value is one its filter accepts, every bundle and order exists,
// no phrase means two things, and no phrase is a word that is only grammar.

test('every filter value a phrase gives is valid for its filter', () => {
  for (const { phrase, effect } of PHRASES) {
    if (effect.kind !== 'filters') continue;
    const filters = Object.fromEntries(effect.filters.map((one) => [one.filterId, one.value]));
    const checked = SearchFiltersSchema.safeParse(filters);
    assert.ok(checked.success, `${phrase}: ${JSON.stringify(filters)}`);
  }
});

test('every bundle and order a phrase names exists', () => {
  for (const { phrase, effect } of PHRASES) {
    if (effect.kind === 'intent')
      assert.ok((INTENT_IDS as readonly string[]).includes(effect.intent), phrase);
    if (effect.kind === 'sort') assert.ok((SORT_IDS as readonly string[]).includes(effect.sort), phrase);
  }
});

test('no phrase is listed twice with another meaning', () => {
  assert.deepEqual(conflictingPhrases(PHRASES), []);
});

test('a phrase is never a word that is only grammar, and every word is folded', () => {
  for (const { phrase } of PHRASES) {
    assert.ok(phrase !== '' && phrase === phrase.trim() && !phrase.includes('  '), JSON.stringify(phrase));
    const words = phrase.split(' ');
    assert.ok(!(words.length === 1 && FILLER_WORDS.has(phrase)), `${phrase} is filler`);
  }
});

test('the index lists the longest phrase of a first word first, and the first duplicate wins', () => {
  const index = indexPhrases([
    { phrase: 'بدون', effect: { kind: 'unsupported', topic: 'a' }, soft: false },
    { phrase: 'بدون رنگ و تصادف', effect: { kind: 'unsupported', topic: 'b' }, soft: false },
    { phrase: 'بدون', effect: { kind: 'unsupported', topic: 'c' }, soft: false },
  ]);
  const list = index.byFirst.get('بدون') ?? [];
  assert.deepEqual(
    list.map((one) => one.phrase),
    ['بدون رنگ و تصادف', 'بدون'],
  );
  assert.equal(list[1]?.effect.kind === 'unsupported' ? list[1].effect.topic : '', 'a');
  assert.equal(index.maxWords, 4);
});
