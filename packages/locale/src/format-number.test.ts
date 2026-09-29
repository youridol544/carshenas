import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatCount, formatCountOf, formatMileage, formatPercent } from './format-number.ts';

const RLM = '\u200F';
const NBSP = '\u00A0';

test('a count prints in Persian digits with the Persian thousands mark', () => {
  assert.equal(formatCount(120_000), '۱۲۰٬۰۰۰');
  assert.equal(formatCount(128), '۱۲۸');
  assert.equal(formatCount(0), '۰');
});

test('mileage keeps its unit on the same line as the number', () => {
  assert.equal(formatMileage(120_000), `۱۲۰٬۰۰۰${NBSP}کیلومتر`);
  assert.equal(formatMileage(0), `۰${NBSP}کیلومتر`);
});

test('a count stays on the line of its noun', () => {
  assert.equal(formatCountOf(8, 'کاراکتر'), `۸${NBSP}کاراکتر`);
  assert.equal(formatCountOf(1_250, 'آگهی'), `۱٬۲۵۰${NBSP}آگهی`);
});

test('a share prints as a whole Persian percentage', () => {
  assert.equal(formatPercent(0.12), `۱۲${RLM}٪`);
  assert.equal(formatPercent(0.124), `۱۲${RLM}٪`);
});

test('a right-to-left mark before every percent sign keeps it to the left of the number on screen', () => {
  // Without the mark the bidi algorithm pulls the sign into the digits' left-to-right run and shows it on the
  // right; e2e/tests/app/layout-stress.spec.ts measures the rendered order on every page.
  for (let whole = 0; whole <= 100; whole++) {
    assert.match(formatPercent(whole / 100), /^[۰-۹]+\u200F٪$/);
  }
});

test('a negative share keeps the left-to-right mark Intl puts before the minus sign', () => {
  assert.equal(formatPercent(-0.12), `\u200E−۱۲${RLM}٪`);
});
