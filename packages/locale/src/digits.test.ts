import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readWholeNumber, toLatinDigits, toPersianDigits } from './digits.ts';

test('Persian and Arabic-Indic digits become Latin digits', () => {
  assert.equal(toLatinDigits('۰۱۲۳۴۵۶۷۸۹'), '0123456789');
  assert.equal(toLatinDigits('٠١٢٣٤٥٦٧٨٩'), '0123456789');
});

test('everything that is not a digit is left alone, separators and letters included', () => {
  assert.equal(toLatinDigits('۱٬۲۵۰٬۰۰۰ تومان'), '1٬250٬000 تومان');
  assert.equal(toLatinDigits('پژو ۲۰۶ SD مدل 1402'), 'پژو 206 SD مدل 1402');
  assert.equal(toLatinDigits(''), '');
});

// The right-to-left mark sources put around numbers, built from its code point.
const RLM = String.fromCodePoint(0x200f);

test('a written whole number is read in any digit script and grouping, direction marks and spaces aside', () => {
  for (const written of [
    '۱۲۰۰۰۰',
    '۱۲۰,۰۰۰',
    '۱۲۰،۰۰۰',
    '۱۲۰٬۰۰۰',
    '۱۲۰٫۰۰۰',
    '١٢٠٬٠٠٠',
    '120,000',
    ` ${RLM}۱۲۰,۰۰۰ `,
  ]) {
    assert.equal(readWholeNumber(written), 120_000, written);
  }
  assert.equal(readWholeNumber('۰'), 0);
});

test('anything else is not read as a number: a decimal, a sign, a unit or a group of the wrong size', () => {
  for (const written of ['', '۱٫۵', '-۱۲۰', '۱۲۰ کیلومتر', '۱۲,۰۰', '۱۲۰ ۰۰۰', 'صفر', '9007199254740993']) {
    assert.equal(readWholeNumber(written), undefined, written);
  }
});

test('a code keeps its characters and shows Persian digits, with no thousands marks', () => {
  assert.equal(toPersianDigits('2847193056'), '۲۸۴۷۱۹۳۰۵۶');
  assert.equal(toPersianDigits('1234@E394'), '۱۲۳۴@E۳۹۴');
  assert.equal(toLatinDigits(toPersianDigits('0123456789')), '0123456789');
});
