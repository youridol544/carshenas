import assert from 'node:assert/strict';
import { test } from 'node:test';
import { maskPhoneLike, phoneLikeRanges } from './privacy.ts';

test('phone-like runs are masked in every digit script, spaced, hyphenated, dotted or whole', () => {
  for (const run of [
    '09123456789',
    '0912 345 6789',
    '0912-345-6789',
    '0912.345.6789',
    '۰۹۱۲-۳۴۵-۶۷۸۹',
    '٠٩١٢ ٣٤٥ ٦٧٨٩',
    '0912 345 67 89',
  ]) {
    assert.equal(maskPhoneLike(`پژو ${run} سفید`), 'پژو # سفید', run);
  }
});

test('a model year, a price and a mileage stay readable when words sit between them', () => {
  for (const text of [
    'پژو ۲۰۶ تیپ ۵ ۱۳۹۷',
    'زیر ۷۰۰ میلیون',
    '۲۰۶ سفید ۱۳۹۷ زیر ۷۰۰ میلیون کارکرد ۴۰ هزار',
  ]) {
    assert.equal(maskPhoneLike(text), text);
  }
});

test('the ranges are what the mask replaces', () => {
  const text = 'a 0912 345 6789 b 1234567 c';
  assert.deepEqual(
    phoneLikeRanges(text).map((r) => text.slice(r.start, r.end)),
    ['0912 345 6789', '1234567'],
  );
  assert.equal(maskPhoneLike(undefined), undefined);
});
