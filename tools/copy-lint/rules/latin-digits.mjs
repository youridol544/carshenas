// Latin digits inside Persian text. Every number a buyer reads is printed in Persian digits (ADR-0014) by the
// formatters of @carshenas/locale; a number typed into a sentence as 1400 or 206 shows up in the wrong script.
//
// Not flagged: digits that are part of a Latin token («X3», «4x4», «206i», «v2»), digits inside an address
// (https://..., www....), and holes (`${...}`), whose digits the formatter decides.
import { blank, matchesOf } from './util.mjs';

const ADDRESS = /(?:https?:\/\/|www\.)\S+/g;
const LATIN_DIGITS = /(?<![A-Za-z0-9_])[0-9]+(?:[.,][0-9]+)*(?![A-Za-z0-9_])/g;

export default {
  id: 'latin-digits',
  summary: 'Latin digits inside Persian text',
  message: 'Latin digits (0 to 9) inside Persian text.',
  fix: 'Persian digits come from the formatters in @carshenas/locale (formatCount, formatToman, toPersianDigits); a model name written in Latin letters keeps its own digits («X3»), and a name written in Persian takes Persian digits («۲۰۶»).',
  check: (unit) => matchesOf(LATIN_DIGITS, blank(unit.text, ADDRESS)),
  samples: {
    pass: [
      'مدل ۱۴۰۰ و ۲۰۶',
      'بی‌ام‌و X3 مدل ۲۰۲۰',
      'قیمت {} تومان',
      'نشانی https://divar.ir/v/abc-123 را بچسبانید',
      'نسخه‌ی v2',
    ],
    fail: ['مدل 1400', 'پژو 206 تیپ 5', 'حداکثر 12,000 کیلومتر', 'سال 2021 میلادی'],
  },
};
