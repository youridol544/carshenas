import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_TOMAN, parseShownPrice, samePrice } from './price.ts';

// Prices as Divar's pages show them (CS-2, finding 3.5): a list row, and the detail's «قیمت پایه», which starts with a
// right-to-left mark built here from its code point.
const RLM = String.fromCodePoint(0x200f);

test('a shown price is read in any digit script and separator, with or without a leading right-to-left mark', () => {
  for (const shown of [
    '۱,۳۵۰,۰۰۰,۰۰۰ تومان',
    `${RLM}۱,۳۵۰,۰۰۰,۰۰۰ تومان`,
    '۱،۳۵۰،۰۰۰،۰۰۰ تومان',
    '۱٬۳۵۰٬۰۰۰٬۰۰۰ تومان',
    '١٬٣٥٠٬٠٠٠٬٠٠٠ تومان',
    '1,350,000,000 تومان',
    '1350000000 تومان',
    '۱٬۳۵۰٬۰۰۰٬۰۰۰تومان',
  ]) {
    assert.deepEqual(parseShownPrice(shown), { type: 'asking', toman: 1_350_000_000 }, shown);
  }
});

test('«توافقی» is negotiable, and a token figure is a placeholder, not a price', () => {
  assert.deepEqual(parseShownPrice('توافقی'), { type: 'negotiable' });
  assert.deepEqual(parseShownPrice(' قیمت توافقی '), { type: 'negotiable' });
  assert.deepEqual(parseShownPrice('۱۰,۰۰۰ تومان'), { type: 'placeholder', toman: 10_000 });
  assert.deepEqual(parseShownPrice(`${RLM}۵۰۰,۰۰۰ تومان`), { type: 'placeholder', toman: 500_000 });
  assert.deepEqual(parseShownPrice('۰ تومان'), { type: 'placeholder', toman: 0 });
  assert.deepEqual(parseShownPrice('۱۰,۰۰۰,۰۰۰ تومان'), { type: 'asking', toman: 10_000_000 });
});

test('anything else is not read as a price: it is kept, never guessed', () => {
  for (const shown of [
    '',
    'تماس بگیرید',
    '۱٫۵ میلیارد تومان',
    '۱,۳۵,۰۰۰ تومان',
    '1,350,000,000',
    '۱,۳۵۰,۰۰۰,۰۰۰ دلار',
    `${String(MAX_TOMAN + 1)} تومان`,
  ]) {
    assert.equal(parseShownPrice(shown), undefined, shown);
  }
  assert.deepEqual(parseShownPrice(`${String(MAX_TOMAN)} تومان`), { type: 'asking', toman: MAX_TOMAN });
});

test('two prices are the same when they ask the same, whatever a placeholder showed', () => {
  assert.ok(samePrice({ type: 'asking', toman: 5 }, { type: 'asking', toman: 5 }));
  assert.ok(!samePrice({ type: 'asking', toman: 5 }, { type: 'asking', toman: 6 }));
  assert.ok(samePrice({ type: 'placeholder', toman: 1_000 }, { type: 'placeholder', toman: 10_000 }));
  assert.ok(samePrice({ type: 'negotiable' }, { type: 'negotiable' }));
  assert.ok(!samePrice({ type: 'negotiable' }, { type: 'placeholder', toman: 1_000 }));
});
