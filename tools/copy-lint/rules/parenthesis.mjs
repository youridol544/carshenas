// A parenthesis. The voice guide (CS-104, section 6 and appendix B) writes an aside as a sentence of its own: «(...)» hides
// the thing the buyer needs behind the thing the sentence says. A warning, not a refusal: a parenthesis around a unit or a
// code can be honest, and a person decides.
import { matchesOf } from './util.mjs';

const PARENTHESIS = /\([^()]*\)/g;

export default {
  id: 'parenthesis',
  level: 'warn',
  summary: 'a parenthesis for an aside',
  message: 'A parenthesis: an aside is a sentence of its own (guide, section 6).',
  fix: 'Write the aside as a sentence, or cut it when the buyer can neither check it nor act on it.',
  check: (unit) => matchesOf(PARENTHESIS, unit.text).slice(0, 1),
  samples: {
    pass: ['قیمت پایین است. دلیلش را ببینید.', 'کارکرد ۱۲٬۰۰۰ کیلومتر', 'قیمت {} تومان'],
    fail: [
      'قیمت از ارزش بازار (۱۲٪) پایین‌تر است',
      'کارکرد کم (کمتر از ۲۰٬۰۰۰ کیلومتر در سال)',
      'روش {} (ارزش بازار)',
    ],
  },
};
