import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nameOnScreen } from './names.ts';

// The names the catalogue stores, as the screen shows them (CS-61): numbers in Persian digits where the name is Persian.

test('a Persian name gets its numbers in Persian digits', () => {
  assert.equal(nameOnScreen('پژو 206 تیپ ۱'), 'پژو ۲۰۶ تیپ ۱');
  assert.equal(nameOnScreen('سمند LX EF7'), 'سمند LX EF7');
  assert.equal(nameOnScreen('تیبا 2'), 'تیبا ۲');
});

test('a digit that belongs to a Latin code stays as written', () => {
  assert.equal(nameOnScreen('بی ام و X5'), 'بی ام و X5');
  assert.equal(nameOnScreen('مرسدس C200 کلاسیک'), 'مرسدس C200 کلاسیک');
  assert.equal(nameOnScreen('پژو 206i'), 'پژو 206i');
});

test('a name in Latin letters is left alone', () => {
  assert.equal(nameOnScreen('Mazda 3'), 'Mazda 3');
});

test('Persian digits and a name without numbers are unchanged', () => {
  assert.equal(nameOnScreen('پژو ۲۰۶'), 'پژو ۲۰۶');
  assert.equal(nameOnScreen('پراید'), 'پراید');
  assert.equal(nameOnScreen(''), '');
});
