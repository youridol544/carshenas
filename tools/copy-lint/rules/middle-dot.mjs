// The middle dot as a separator. A dot next to a Persian digit reads as one more zero: the Persian zero IS a dot («۰»),
// so «تهران · ۳ ساعت» reads like a number with a stray zero (owner, 2026-10-04). Never join a number with « · ».
//
// Two rules, because a static check sees two things:
//   middle-dot-digit  a dot with a digit right next to it (one space allowed) in the text itself;
//   middle-dot-join   a dot that joins a value this file cannot see: next to a `${...}`, standing alone as a separator
//                     (`.join(' · ')`, `{' · '}`), or at the edge of a piece of text that sits beside an expression or an
//                     element. At run time that value may be a number; separate the facts with «،» or lay them out as
//                     separate elements instead.
import { PLACEHOLDER } from '../lib/persian.mjs';

const DOTS = '·•⋅∙';
const DIGIT_NEXT_TO_DOT = new RegExp(`[${DOTS}]\\s?\\p{Nd}|\\p{Nd}\\s?[${DOTS}]`, 'gu');
const HOLE_NEXT_TO_DOT = new RegExp(`[${DOTS}]\\s*${PLACEHOLDER}|${PLACEHOLDER}\\s*[${DOTS}]`, 'g');
const ONLY_DOTS = new RegExp(`^[${DOTS}\\s]+$`);
const DOT_AT_START = new RegExp(`^\\s*[${DOTS}]`);
const DOT_AT_END = new RegExp(`[${DOTS}]\\s*$`);

export const middleDotDigit = {
  id: 'middle-dot-digit',
  summary: 'a middle dot next to a digit',
  scope: 'any',
  message:
    'A middle dot next to a digit: the Persian zero is a dot, so «۳ · ۵» reads like a number with a zero in it.',
  fix: 'Separate the facts with «،» or put them in separate elements; never join a number with « · ».',
  check(unit) {
    // One finding per string: it is the string that has to change, however many dots it holds.
    return [...unit.text.matchAll(DIGIT_NEXT_TO_DOT)].slice(0, 1).map((match) => ({
      index: match.index,
      length: match[0].length,
      text: match[0],
    }));
  },
  samples: {
    pass: ['تهران · شیراز', 'ذخیره شد · مشاهده پرونده', '۳ ساعت پیش', 'تهران، ۳ ساعت پیش', '۳ ساعت · تهران'],
    fail: ['تهران · ۳ ساعت پیش', '۱۲۰٬۰۰۰ · تهران', 'کارکرد ۱۲۰٬۰۰۰·تهران', 'قیمت • 3 روز'],
  },
};

export const middleDotJoin = {
  id: 'middle-dot-join',
  summary: 'a middle dot that joins a value (it may be a number at run time)',
  scope: 'any',
  message:
    'A middle dot that joins a value the file cannot see: at run time it may sit next to a number, and a dot next to a Persian digit reads as a zero.',
  fix: 'Separate the facts with «،» or put them in separate elements; never join a number with « · ».',
  check(unit) {
    const text = unit.text;
    if (ONLY_DOTS.test(text)) return [{ index: 0, length: text.length, text: text.trim() }];
    const found = [...text.matchAll(HOLE_NEXT_TO_DOT)].map((match) => ({
      index: match.index,
      length: match[0].length,
      text: match[0].replaceAll(PLACEHOLDER, '{…}'),
    }));
    if (found.length === 0 && !unit.standalone && (DOT_AT_START.test(text) || DOT_AT_END.test(text))) {
      return [{ index: 0, length: text.length, text: text.trim() }];
    }
    return found.slice(0, 1);
  },
  samples: {
    pass: ['تهران · شیراز', 'ذخیره شد · مشاهده پرونده', 'قیمت {} تومان', '{}، {}'],
    fail: [
      ' · ',
      '·',
      '{} · {}',
      '· {}',
      { text: ' · عکس از', standalone: false },
      { text: 'نام ·', standalone: false },
    ],
  },
};

export default [middleDotDigit, middleDotJoin];
