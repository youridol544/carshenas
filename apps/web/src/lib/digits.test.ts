// @vitest-environment node
import { expect, test } from 'vitest';
import { toLatinDigits, toPersianDigits } from '@/lib/digits';

test('Persian and Arabic-Indic digits become Latin digits', () => {
  expect(toLatinDigits('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789');
  expect(toLatinDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
});

test('everything that is not a digit is left alone, separators and letters included', () => {
  expect(toLatinDigits('۱٬۲۵۰٬۰۰۰ تومان')).toBe('1٬250٬000 تومان');
  expect(toLatinDigits('پژو ۲۰۶ SD مدل 1402')).toBe('پژو 206 SD مدل 1402');
  expect(toLatinDigits('')).toBe('');
});

test('a code keeps its characters and shows Persian digits, with no thousands marks', () => {
  expect(toPersianDigits('2847193056')).toBe('۲۸۴۷۱۹۳۰۵۶');
  expect(toPersianDigits('1234@E394')).toBe('۱۲۳۴@E۳۹۴');
  expect(toLatinDigits(toPersianDigits('0123456789'))).toBe('0123456789');
});
