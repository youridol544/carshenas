import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PHONE_REMOVED, withoutPhoneNumbers } from './redact.ts';

// Numbers a seller might write into a listing (ADR-0008 point 7). The invisible separators are built from their code
// points, never typed.
const NBSP = String.fromCodePoint(0x00a0);
const ZWNJ = String.fromCodePoint(0x200c);

test('a mobile or landline number is removed in any digit script and grouping', () => {
  for (const phone of [
    '09121234567',
    '۰۹۱۲۱۲۳۴۵۶۷',
    '٠٩١٢١٢٣٤٥٦٧',
    '0912 123 4567',
    '0912-123-45-67',
    '0912.123.4567',
    `0912${NBSP}123${ZWNJ}4567`,
    '+98 912 123 4567',
    '0098 912 123 4567',
    '+۹۸۹۱۲۱۲۳۴۵۶۷',
    '912 123 4567',
    '021-2233 4455',
    '۰۲۱ ۲۲۳۳۴۴۵۵',
  ]) {
    assert.equal(withoutPhoneNumbers(`تماس: ${phone} فقط پیامک`), `تماس: ${PHONE_REMOVED} فقط پیامک`, phone);
  }
  assert.equal(withoutPhoneNumbers('شماره۰۹۱۲۱۲۳۴۵۶۷لطفا'), `شماره${PHONE_REMOVED}لطفا`);
});

test('prices, mileage, years and other numbers are left as written', () => {
  for (const text of [
    '۱,۱۴۰,۰۰۰,۰۰۰ تومان',
    'قیمت ۹۵۰۰۰۰۰۰۰۰ تومان',
    'کارکرد ۹۱۰۰۰ کیلومتر',
    'مدل ۱۳۹۲ - ۲۰۱۳',
    'پژو 206 تیپ ۵',
    '091212345678',
    'کد ۰۹۱۲۳',
  ]) {
    assert.equal(withoutPhoneNumbers(text), text, text);
  }
});
