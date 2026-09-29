import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toToman } from '@carshenas/locale/toman';
import { parseShownPrice, samePrice } from './price.ts';

// What sources mean by the price they show. Reading written amounts in every digit script and separator is tested
// where it lives (packages/locale/src/toman.test.ts); the right-to-left mark Divar puts before a detail price is built
// from its code point.
const RLM = String.fromCodePoint(0x200f);

test('a shown amount is an asking price, read as the shared reader reads it', () => {
  assert.deepEqual(parseShownPrice('۱,۳۵۰,۰۰۰,۰۰۰ تومان'), { type: 'asking', toman: 1_350_000_000 });
  assert.deepEqual(parseShownPrice(`${RLM}۱,۱۴۰,۰۰۰,۰۰۰ تومان`), { type: 'asking', toman: 1_140_000_000 });
  assert.deepEqual(parseShownPrice('۱۰,۰۰۰,۰۰۰ تومان'), { type: 'asking', toman: 10_000_000 });
});

test('«توافقی» is negotiable, and a token figure is a placeholder, not a price', () => {
  assert.deepEqual(parseShownPrice('توافقی'), { type: 'negotiable' });
  assert.deepEqual(parseShownPrice(' قیمت  توافقی '), { type: 'negotiable' });
  assert.deepEqual(parseShownPrice(`${RLM}توافقی`), { type: 'negotiable' });
  assert.deepEqual(parseShownPrice('۱۰,۰۰۰ تومان'), { type: 'placeholder', toman: 10_000 });
  assert.deepEqual(parseShownPrice(`${RLM}۵۰۰,۰۰۰ تومان`), { type: 'placeholder', toman: 500_000 });
  assert.deepEqual(parseShownPrice('۰ تومان'), { type: 'placeholder', toman: 0 });
});

test('a text that is not a price is not read as one', () => {
  for (const shown of ['', 'تماس بگیرید', '۱٫۵ میلیارد تومان', '1,350,000,000']) {
    assert.equal(parseShownPrice(shown), undefined, shown);
  }
});

test('two prices are the same when they ask the same, whatever a placeholder showed', () => {
  const asking = (toman: number) => ({ type: 'asking', toman: toToman(toman) }) as const;
  const placeholder = (toman: number) => ({ type: 'placeholder', toman: toToman(toman) }) as const;
  assert.ok(samePrice(asking(5), asking(5)));
  assert.ok(!samePrice(asking(5), asking(6)));
  assert.ok(samePrice(placeholder(1_000), placeholder(10_000)));
  assert.ok(samePrice({ type: 'negotiable' }, { type: 'negotiable' }));
  assert.ok(!samePrice({ type: 'negotiable' }, placeholder(1_000)));
});
