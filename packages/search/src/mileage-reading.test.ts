import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAssumedMileage, mileageNote, reallyLowNote } from './mileage-reading.ts';

const NBSP = String.fromCodePoint(0xa0);

test('an assumed mileage says what was written and what it is taken to be, in Persian digits', () => {
  const price = mileageNote({ reading: 'thousands_price', writtenKm: 100, mileageKm: 100_000 });
  assert.equal(
    price?.line,
    `۱۰۰${NBSP}کیلومتر نوشته شده. از روی قیمت و سال، احتمالاً ۱۰۰٬۰۰۰${NBSP}کیلومتر است.`,
  );
  const text = mileageNote({ reading: 'thousands_text', writtenKm: 60, mileageKm: 60_000 });
  assert.equal(text?.line, `۶۰ نوشته شده. طبق متن آگهی، ۶۰٬۰۰۰${NBSP}کیلومتر است.`);
  // The explanation says why in a buyer's terms and quotes no threshold of the valuation run (CS-110, the voice guide
  // section 5): not the share of the price that decides, not the most a car is believed to drive in a year.
  assert.ok(price);
  const rule = price.info.paragraphs.join(' ');
  assert.match(rule, /۱۰۰٬۰۰۰/);
  assert.doesNotMatch(rule, /۱۵|۴۰٬۰۰۰/);
  // No Latin digit and no middle dot beside a number anywhere in it.
  for (const note of [price, text]) assert.doesNotMatch(JSON.stringify(note), /[0-9·]/);
});

test('only a reading in thousands has a note; a really low one has a sentence of its own', () => {
  for (const reading of ['really_low', 'unread', null] as const) {
    assert.equal(mileageNote({ reading, writtenKm: 100, mileageKm: 100 }), null);
    assert.equal(isAssumedMileage(reading), false);
  }
  assert.equal(
    reallyLowNote({ reading: 'really_low', writtenKm: 70, mileageKm: 70 }),
    `طبق متن آگهی، کارکرد واقعاً ۷۰${NBSP}کیلومتر است.`,
  );
  assert.equal(reallyLowNote({ reading: 'thousands_text', writtenKm: 70, mileageKm: 70_000 }), null);
});
