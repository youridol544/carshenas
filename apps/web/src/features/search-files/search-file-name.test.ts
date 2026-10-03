import { expect, test } from 'vitest';
import { cleanFileName, suggestFileName } from '@/features/search-files/search-file-name';
import { MAX_NAME_LENGTH } from '@/features/search-files/search-files-rules';

test('a name is the search’s words and chips joined with the Persian comma', () => {
  expect(suggestFileName(['تمیز', 'پژو ۲۰۶', 'تا ۷۰۰ میلیون تومان'])).toBe(
    'تمیز، پژو ۲۰۶، تا ۷۰۰ میلیون تومان',
  );
});

test('a name is cut at a whole chip when the chips are too many for it', () => {
  const chips = Array.from({ length: 20 }, (_, index) => `مشخصه‌ی شماره ${String(index)}`);
  const name = suggestFileName(chips);
  expect(name.length).toBeLessThanOrEqual(MAX_NAME_LENGTH);
  expect(chips).toContain(name.split('، ').at(-1));
});

test('one long text alone is cut at a word with an ellipsis, and nothing at all is a plain name', () => {
  const long = Array.from({ length: 40 }, () => 'کلمه').join(' ');
  const name = suggestFileName([long]);
  expect(name.length).toBeLessThanOrEqual(MAX_NAME_LENGTH);
  expect(name.endsWith('…')).toBe(true);
  expect(suggestFileName([])).toBe('جست‌وجوی خودرو');
  expect(suggestFileName(['  ', ''])).toBe('جست‌وجوی خودرو');
});

test('a typed name loses its extra spaces', () => {
  expect(cleanFileName('  پژو   تمیز \n')).toBe('پژو تمیز');
});

test('a typed name loses bidi marks, zero-width spaces and control characters but keeps the zero-width non-joiner', () => {
  const rlm = String.fromCharCode(0x200f);
  const isolate = String.fromCharCode(0x2067);
  const zwnj = String.fromCharCode(0x200c);
  expect(cleanFileName(`پژو${rlm} ${isolate}تمیز`)).toBe('پژو تمیز');
  expect(cleanFileName(`می${zwnj}خواهم\nپژو`)).toBe(`می${zwnj}خواهم پژو`);
});

test('a typed name loses the soft hyphen, the Arabic letter mark and the word joiner, and a line separator becomes a space', () => {
  const soft = String.fromCharCode(0xad);
  const alm = String.fromCharCode(0x61c);
  const joiner = String.fromCharCode(0x2060);
  const lineSeparator = String.fromCharCode(0x2028);
  expect(cleanFileName(`پژو${soft}${alm}${joiner}${lineSeparator}تمیز`)).toBe('پژو تمیز');
});
