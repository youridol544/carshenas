import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toLatinDigits, toPersianDigits } from './digits.ts';

test('Persian and Arabic-Indic digits become Latin digits', () => {
  assert.equal(toLatinDigits('۰۱۲۳۴۵۶۷۸۹'), '0123456789');
  assert.equal(toLatinDigits('٠١٢٣٤٥٦٧٨٩'), '0123456789');
});

test('everything that is not a digit is left alone, separators and letters included', () => {
  assert.equal(toLatinDigits('۱٬۲۵۰٬۰۰۰ تومان'), '1٬250٬000 تومان');
  assert.equal(toLatinDigits('پژو ۲۰۶ SD مدل 1402'), 'پژو 206 SD مدل 1402');
  assert.equal(toLatinDigits(''), '');
});

test('a code keeps its characters and shows Persian digits, with no thousands marks', () => {
  assert.equal(toPersianDigits('2847193056'), '۲۸۴۷۱۹۳۰۵۶');
  assert.equal(toPersianDigits('1234@E394'), '۱۲۳۴@E۳۹۴');
  assert.equal(toLatinDigits(toPersianDigits('0123456789')), '0123456789');
});
