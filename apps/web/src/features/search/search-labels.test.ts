import { expect, test } from 'vitest';
import { nameOnScreen } from '@/features/search/search-labels';

// The names the catalogue stores, as the screen shows them (CS-61): numbers in Persian digits where the name is Persian.

test('a Persian name gets its numbers in Persian digits', () => {
  expect(nameOnScreen('پژو 206 تیپ ۱')).toBe('پژو ۲۰۶ تیپ ۱');
  expect(nameOnScreen('سمند LX EF7')).toBe('سمند LX EF7');
  expect(nameOnScreen('تیبا 2')).toBe('تیبا ۲');
});

test('a digit that belongs to a Latin code stays as written', () => {
  expect(nameOnScreen('بی ام و X5')).toBe('بی ام و X5');
  expect(nameOnScreen('مرسدس C200 کلاسیک')).toBe('مرسدس C200 کلاسیک');
  expect(nameOnScreen('پژو 206i')).toBe('پژو 206i');
});

test('a name in Latin letters is left alone', () => {
  expect(nameOnScreen('Mazda 3')).toBe('Mazda 3');
});

test('Persian digits and a name without numbers are unchanged', () => {
  expect(nameOnScreen('پژو ۲۰۶')).toBe('پژو ۲۰۶');
  expect(nameOnScreen('پراید')).toBe('پراید');
  expect(nameOnScreen('')).toBe('');
});
