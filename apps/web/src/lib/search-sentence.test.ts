// @vitest-environment node
import { expect, test } from 'vitest';
import {
  MAX_SENTENCE_CHARACTERS,
  SENTENCE_PARAM,
  sentenceFromParams,
  tidySentence,
  withSentence,
} from '@/lib/search-sentence';
import { searchHref } from '@carshenas/search/search';

// The sentence an address keeps beside its search (CS-111): read back as typed, never able to reach the database as a
// control character, and added to an address without changing a parameter of the search.

test('a sentence is one line of single spaces, trimmed', () => {
  expect(tidySentence('  پژو ۲۰۶ \n\t زیر   ۷۰۰ میلیون  ')).toBe('پژو ۲۰۶ زیر ۷۰۰ میلیون');
});

test('a null byte and the other control characters become spaces', () => {
  const nul = String.fromCharCode(0);
  const bell = String.fromCharCode(7);
  const del = String.fromCharCode(0x7f);
  expect(tidySentence(`پژو${nul}۲۰۶${bell}تیپ${del}۲`)).toBe('پژو ۲۰۶ تیپ ۲');
});

test('the zero-width non-joiner of Persian spelling is kept', () => {
  const zwnj = String.fromCharCode(0x200c);
  expect(tidySentence(`کم${zwnj}کارکرد`)).toBe(`کم${zwnj}کارکرد`);
});

test('a long text is cut to the limit by whole characters, never in the middle of a pair', () => {
  const pair = String.fromCodePoint(0x1f697);
  const cut = tidySentence(pair.repeat(MAX_SENTENCE_CHARACTERS + 5));
  expect(Array.from(cut)).toHaveLength(MAX_SENTENCE_CHARACTERS);
  expect(cut).toBe(pair.repeat(MAX_SENTENCE_CHARACTERS));
});

test('an address carries the sentence in its last parameter and gives it back as typed', () => {
  const href = withSentence('/search?model=peugeot.206&price=..700000000', 'پژو ۲۰۶ زیر ۷۰۰ میلیون');
  const [path, query] = href.split('?');
  expect(path).toBe('/search');
  const params = new URLSearchParams(query);
  expect([...params.keys()].at(-1)).toBe(SENTENCE_PARAM);
  expect(params.get('model')).toBe('peugeot.206');
  expect(params.get('price')).toBe('..700000000');
  expect(sentenceFromParams(params)).toBe('پژو ۲۰۶ زیر ۷۰۰ میلیون');
});

test('an address with no query gets one, and no sentence leaves the address as it is', () => {
  expect(withSentence('/search', 'پراید')).toBe(`/search?${SENTENCE_PARAM}=${encodeURIComponent('پراید')}`);
  expect(withSentence('/search?deal=good', undefined)).toBe('/search?deal=good');
  expect(withSentence('/search?deal=good', '   ')).toBe('/search?deal=good');
});

test('the parameters of the search are not changed by adding the sentence', () => {
  const base = searchHref({ filters: { price: { max: 700_000_000 }, paint_free: true } });
  const withIt = withSentence(base, 'بدون رنگ زیر ۷۰۰ میلیون');
  const params = new URLSearchParams(withIt.split('?')[1]);
  params.delete(SENTENCE_PARAM);
  expect(`/search?${params.toString()}`).toBe(base);
});

test('an address with no sentence, or an empty one, has none', () => {
  expect(sentenceFromParams(new URLSearchParams('deal=good'))).toBeUndefined();
  expect(sentenceFromParams(new URLSearchParams(`${SENTENCE_PARAM}=%20%20`))).toBeUndefined();
});
