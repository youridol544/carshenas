// The Arabic semicolon «؛». The voice guide (CS-104, R4) writes one idea per sentence, with a full stop where a «؛» was:
// «؛» is the exception, and a string that holds one is usually two sentences glued together. Built from its code point.
import { matchesOf } from './util.mjs';

const SEMICOLON = String.fromCodePoint(0x061b);
const ARABIC_SEMICOLON = new RegExp(SEMICOLON, 'g');

export default {
  id: 'semicolon',
  summary: 'the Arabic semicolon',
  message: `A «${SEMICOLON}»: one idea per sentence, a full stop where a «${SEMICOLON}» was (guide R4).`,
  fix: 'Split it into two sentences, or cut the second clause if it only restates the first.',
  check: (unit) => matchesOf(ARABIC_SEMICOLON, unit.text).slice(0, 1),
  samples: {
    pass: ['قیمت پایین است. دلیلش را ببینید.', 'سال، کارکرد و وضعیت بدنه'],
    fail: [`قیمت پایین است${SEMICOLON} دلیلش را ببینید.`, `ثبت نشد${SEMICOLON} دوباره امتحان کنید`],
  },
};
