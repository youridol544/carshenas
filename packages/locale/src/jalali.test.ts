import assert from 'node:assert/strict';
import { test } from 'node:test';
import { jalaliYearOf, readTehranDateTime } from './jalali.ts';

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

test('the Solar Hijri year of an instant is the year of its Tehran day, which Nowruz opens at midnight in Tehran', () => {
  // Checked by hand: 1 Farvardin 1405 is 2026-03-21, and Tehran (UTC+03:30) is already there at 20:30 UTC the evening
  // before.
  assert.equal(jalaliYearOf(new Date('2026-03-20T20:29:59.999Z')), 1404);
  assert.equal(jalaliYearOf(new Date('2026-03-20T20:30:00Z')), 1405);
  assert.equal(jalaliYearOf(new Date('2026-10-02T15:08:00Z')), 1405);
  // The server's zone never decides it: both instants are the evening of 20 March in UTC, and Tehran is a day on at the
  // second one (1405 has 365 days, so 1406 opens on 2027-03-21).
  assert.equal(jalaliYearOf(new Date('2027-03-20T20:29:59Z')), 1405);
  assert.equal(jalaliYearOf(new Date('2027-03-20T20:30:00Z')), 1406);
  // Before 2022, Tehran kept daylight saving in summer (UTC+04:30).
  assert.equal(jalaliYearOf(new Date('2020-06-21T07:30:00Z')), 1399);
});

test('every Nowruz from 1399 to 1420 opens its year, as the platform’s own Persian calendar says', () => {
  const platform = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
    year: 'numeric',
    timeZone: 'Asia/Tehran',
  });
  const platformYear = (instant: Date) => Number.parseInt(platform.format(instant), 10);
  for (let year = 1399; year <= 1420; year += 1) {
    const nowruz = readTehranDateTime(`1 فروردین ${String(year)}، 00:00`);
    assert.ok(nowruz, String(year));
    const before = new Date(nowruz.getTime() - 1);
    assert.equal(jalaliYearOf(nowruz), year);
    assert.equal(platformYear(nowruz), year);
    assert.equal(jalaliYearOf(before), year - 1);
    assert.equal(platformYear(before), year - 1);
  }
});

test('an instant that is not one has no year', () => {
  assert.throws(() => jalaliYearOf(new Date(Number.NaN)), RangeError);
});
