import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readTehranDateTime } from './jalali.ts';

// Checked by hand: 1 Farvardin 1405 is 2026-03-21, so 1 Mehr (after six months of 31 days) is 2026-09-23; Tehran has
// been at UTC+03:30 all year since daylight saving ended in 2022.

test('a Solar Hijri date and time on Tehran’s clock is the instant it names', () => {
  assert.deepEqual(readTehranDateTime('۲ مهر ۱۴۰۵، ۰۹:۴۷'), new Date('2026-09-24T06:17:00Z'));
  assert.deepEqual(readTehranDateTime('۷ مهر ۱۴۰۵، ۱۳:۵۸'), new Date('2026-09-29T10:28:00Z'));
  assert.deepEqual(readTehranDateTime('۱۲ مرداد ۱۴۰۵، ۱۱:۱۴'), new Date('2026-08-03T07:44:00Z'));
  // Nowruz, and a date before 2022, when Tehran still kept daylight saving (UTC+04:30 in summer).
  assert.deepEqual(readTehranDateTime('1 فروردین 1405, 00:00'), new Date('2026-03-20T20:30:00Z'));
  assert.deepEqual(readTehranDateTime('۱ تیر ۱۳۹۹، ۱۲:۰۰'), new Date('2020-06-21T07:30:00Z'));
});

test('Arabic letters in a month name read as Persian ones', () => {
  assert.deepEqual(readTehranDateTime('۱ دي ۱۴۰۴، ۱۰:۰۰'), readTehranDateTime('۱ دی ۱۴۰۴، ۱۰:۰۰'));
});

test('a day that does not exist, or a text that is not a date and time, is not read', () => {
  for (const text of [
    '۳۱ مهر ۱۴۰۵، ۱۰:۰۰',
    '۲ مهر ۱۴۰۵',
    '۲ Mehr ۱۴۰۵، ۰۹:۴۷',
    '۲ مهر ۱۴۰۵، ۲۵:۰۰',
    'دیروز',
    '',
  ]) {
    assert.equal(readTehranDateTime(text), undefined, text);
  }
});
