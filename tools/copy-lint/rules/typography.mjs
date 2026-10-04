// Typography the voice guide (CS-104, section 6) rules out in Farsi copy, each cheap to see and never a matter of taste:
//   straight-quotes  «"..."» and curly double quotes: a quoted word takes «», never "" (a single apostrophe is left alone)
//   ascii-ellipsis   three full stops: the one character «…» is the ellipsis
//   range-hyphen     a hyphen or dash between two digits: a range is written with «تا»
//   emoji            an emoji: none anywhere in the product
import { matchesOf } from './util.mjs';

const DOUBLE_QUOTES = new RegExp(`[${String.fromCodePoint(0x22, 0x201c, 0x201d, 0x201e)}]`, 'g');
const THREE_DOTS = /\.{3}/g;
const DIGIT_HYPHEN_DIGIT = /\p{Nd}\s?[-–—]\s?\p{Nd}/gu;
const EMOJI = /\p{Emoji_Presentation}/gu;

export const straightQuotes = {
  id: 'straight-quotes',
  level: 'refuse',
  summary: 'a double quote mark instead of «»',
  message: 'A double quote mark: Farsi copy quotes a word or a control with «», never with "".',
  fix: 'Use «» around the quoted word.',
  check: (unit) => matchesOf(DOUBLE_QUOTES, unit.text).slice(0, 1),
  samples: {
    pass: ['«نشان کردن» را بزنید', 'قیمت کم شد'],
    fail: [
      '"نشان کردن" را بزنید',
      `${String.fromCodePoint(0x201c)}نشان کردن${String.fromCodePoint(0x201d)} را بزنید`,
    ],
  },
};

export const asciiEllipsis = {
  id: 'ascii-ellipsis',
  level: 'refuse',
  summary: 'three full stops instead of the ellipsis character',
  message:
    'Three full stops: the ellipsis is the one character «…» and only for work in progress (guide, section 6).',
  fix: 'Write «…» for «در حال خواندن…», or drop it.',
  check: (unit) => matchesOf(THREE_DOTS, unit.text).slice(0, 1),
  samples: {
    pass: ['در حال خواندن…', 'قیمت کم شد.'],
    fail: ['در حال خواندن...', 'مبلغ آگهی «از ...» است'],
  },
};

export const rangeHyphen = {
  id: 'range-hyphen',
  level: 'warn',
  summary: 'a hyphen between two numbers',
  message: 'A hyphen or dash between two digits: write a range with «تا» (guide, section 6).',
  fix: 'Write «۳ تا ۵ سال», not «۳-۵ سال».',
  check: (unit) => matchesOf(DIGIT_HYPHEN_DIGIT, unit.text).slice(0, 1),
  samples: {
    pass: ['۳ تا ۵ سال', 'مدل ۱۴۰۰', 'پژو ۲۰۶ تیپ ۵'],
    fail: ['۳-۵ سال', '۱۲۰ – ۱۵۰ کیلومتر'],
  },
};

export const emoji = {
  id: 'emoji',
  level: 'refuse',
  summary: 'an emoji',
  message: 'An emoji: the product uses none (guide R1, section 6).',
  fix: 'Remove it; if it carried a meaning, say the meaning in words.',
  check: (unit) => matchesOf(EMOJI, unit.text).slice(0, 1),
  samples: {
    pass: ['قیمت خوب است', 'کیلومتر © تهران'],
    fail: [`قیمت خوب است ${String.fromCodePoint(0x1f44d)}`, `${String.fromCodePoint(0x2705)} ثبت شد`],
  },
};

export default [straightQuotes, asciiEllipsis, rangeHyphen, emoji];
