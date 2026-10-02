import assert from 'node:assert/strict';
import { test } from 'node:test';
import { amountOf, readNumbers } from './numbers.ts';
import { tokenize } from './text.ts';

// The numbers a buyer writes, read by code (CS-62): digits, Persian number words, scale words, compound amounts and the
// unit that follows. A word that is also something else («یک» the article, «نه» no) is a number only with a scale or
// a unit beside it.

function read(text: string) {
  const tokens = tokenize(text);
  return readNumbers(tokens).map((one) => ({
    words: tokens
      .slice(one.from, one.to)
      .map((token) => token.norm)
      .join(' '),
    amount: amountOf(one),
    base: one.base,
    scale: one.scale,
    unit: one.unit,
  }));
}

test('digits with a scale word and a unit', () => {
  assert.deepEqual(read('۷۰۰ میلیون تومان'), [
    { words: '700 میلیون تومان', amount: 700_000_000, base: 700, scale: 1_000_000, unit: 'toman' },
  ]);
  assert.deepEqual(read('۵۰ هزار کیلومتر'), [
    { words: '50 هزار کیلومتر', amount: 50_000, base: 50, scale: 1_000, unit: 'km' },
  ]);
  assert.deepEqual(read('۱۰ میلیارد ریال')[0]?.unit, 'rial');
});

test('Persian number words, alone and with a scale', () => {
  assert.equal(read('هفتصد میلیون')[0]?.amount, 700_000_000);
  assert.equal(read('سیصد و پنجاه میلیون')[0]?.amount, 350_000_000);
  assert.equal(read('بیست و پنج')[0]?.amount, 25);
  assert.equal(read('پانصد')[0]?.amount, 500);
  assert.equal(read('پنجاه هزار')[0]?.amount, 50_000);
  assert.equal(read('دویست و شش')[0]?.amount, 206);
});

test('a half: «یک و نیم میلیارد», «دو و نیم», «نیم میلیارد»', () => {
  assert.equal(read('یک و نیم میلیارد')[0]?.amount, 1_500_000_000);
  assert.equal(read('دو و نیم میلیارد')[0]?.amount, 2_500_000_000);
  assert.equal(read('نیم میلیارد')[0]?.amount, 500_000_000);
  assert.equal(read('۲٫۵ میلیارد')[0]?.amount, 2_500_000_000);
});

test('compound amounts add their smaller parts, the bare part taking the next smaller scale', () => {
  assert.equal(read('۱ میلیارد و ۲۰۰ میلیون')[0]?.amount, 1_200_000_000);
  assert.equal(read('۲ میلیارد و ۳۰۰')[0]?.amount, 2_300_000_000);
  assert.equal(read('یک میلیارد و سیصد میلیون')[0]?.amount, 1_300_000_000);
});

test('two numbers that are not one amount stay two', () => {
  const found = read('۲۰۶ و ۲۰۷');
  assert.deepEqual(
    found.map((one) => one.amount),
    [206, 207],
  );
  const range = read('۴۰۰ تا ۵۰۰ میلیون');
  assert.deepEqual(
    range.map((one) => [one.amount, one.scale]),
    [
      [400, 1],
      [500_000_000, 1_000_000],
    ],
  );
});

test('the article «یک» and «نه» are not numbers alone, and are with a unit or a scale', () => {
  assert.deepEqual(read('یک ماشین'), []);
  assert.deepEqual(read('نه رنگ شده'), []);
  assert.equal(read('یک سال')[0]?.unit, 'years');
  assert.equal(read('یک میلیارد')[0]?.amount, 1_000_000_000);
  assert.equal(read('یه میلیارد')[0]?.amount, 1_000_000_000);
});

test('units: engine size, ages and times', () => {
  assert.equal(read('۱۸۰۰ سی سی')[0]?.unit, 'cc');
  assert.equal(read('۱۸۰۰ cc')[0]?.unit, 'cc');
  assert.equal(read('۵ ساله')[0]?.unit, 'years');
  assert.equal(read('۶ ماه')[0]?.unit, 'months');
  assert.equal(read('۳ روز')[0]?.unit, 'days');
  assert.equal(read('۲۴ ساعت')[0]?.unit, 'hours');
});

test('a bare year or model number is a number with no scale and no unit', () => {
  assert.deepEqual(read('مدل ۱۴۰۰'), [{ words: '1400', amount: 1400, base: 1400, scale: 1, unit: null }]);
});
