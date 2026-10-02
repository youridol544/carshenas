import { fixtureLexicon } from '@carshenas/search/understand/fixture';
import { understandQuery } from '@carshenas/search/understand/understand';
import { expect, test } from 'vitest';
import { withoutChips } from '@/features/search-understanding/without-chips';

const lexicon = fixtureLexicon();
const understand = async (text: string) =>
  (await understandQuery(text, { lexicon, solarYear: 1405, withoutModel: 'switched_off' })).understanding;

test('nothing removed is the search as understood', async () => {
  const u = await understand('پژو ۲۰۶ زیر ۵۰۰ میلیون');
  expect(withoutChips(u.search, u.chips, new Set())).toEqual(u.search);
});

test('a removed chip takes its filter off, and removing several takes each off', async () => {
  const u = await understand('پژو ۲۰۶ زیر ۵۰۰ میلیون بدون رنگ');
  const keys = u.chips.map((chip) => chip.key);
  expect(keys).toEqual(expect.arrayContaining(['model:peugeot.206', 'price', 'paint_free']));
  const one = withoutChips(u.search, u.chips, new Set(['price']));
  expect(one.filters).toEqual({ model: ['peugeot.206'], paint_free: true });
  const two = withoutChips(u.search, u.chips, new Set(['price', 'paint_free']));
  expect(two.filters).toEqual({ model: ['peugeot.206'] });
});

test('one colour of two is taken off alone', async () => {
  const u = await understand('پژو ۲۰۶ سفید یا مشکی');
  const white = u.chips.find((chip) => chip.key === 'colour:white');
  expect(white).toBeDefined();
  const left = withoutChips(u.search, u.chips, new Set(['colour:white']));
  expect(left.filters.colour).toEqual(['black']);
});

test('removing a bundle’s chip drops the catalogue mark: it is no longer that catalogue', async () => {
  const u = await understand('تمیز و بی‌دردسر');
  expect(u.search.catalogue).toBeDefined();
  const first = u.chips[0];
  if (first === undefined) throw new Error('a catalogue has chips');
  const left = withoutChips(u.search, u.chips, new Set([first.key]));
  expect(left.catalogue).toBeUndefined();
  expect(left.filters[first.filterId]).toBeUndefined();
});
