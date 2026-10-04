// Arabic-Indic digits (U+0660 to U+0669) in Persian text. Persian digits are U+06F0 to U+06F9 and come from the
// formatters in @carshenas/locale (ADR-0014); the two sets differ in the shapes of four, five and six.
import { matchesOf } from './util.mjs';

const FIRST = 0x0660;
const ARABIC_INDIC_DIGIT = new RegExp(
  `[${String.fromCodePoint(FIRST)}-${String.fromCodePoint(FIRST + 9)}]`,
  'g',
);
const arabicDigits = (digits) =>
  [...digits].map((digit) => String.fromCodePoint(FIRST + Number(digit))).join('');

export default {
  id: 'arabic-digits',
  summary: 'Arabic-Indic digits',
  message: 'An Arabic-Indic digit (U+0660 to U+0669) in Persian text.',
  fix: 'Persian digits (U+06F0 to U+06F9) come from the formatters in @carshenas/locale; do not type a number into copy.',
  check: (unit) => matchesOf(ARABIC_INDIC_DIGIT, unit.text),
  samples: {
    pass: ['۱۲۰ کیلومتر', 'مدل ۱۴۰۰', 'کارکرد نامشخص'],
    fail: [`مدل ${arabicDigits('1400')}`, `${arabicDigits('45')} روز پیش`],
  },
};
