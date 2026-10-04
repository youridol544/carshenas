// An exclamation mark. The voice is a calm expert friend (CS-104): the sentence says the fact and stops.
import { matchesOf } from './util.mjs';

const EXCLAMATION = /[!！‼❗]/g;

export default {
  id: 'exclamation-mark',
  summary: 'an exclamation mark',
  message: 'An exclamation mark. The product speaks calmly: say the fact and stop.',
  fix: 'Remove the mark; if the sentence only sounds friendly with it, rewrite the sentence.',
  check: (unit) => matchesOf(EXCLAMATION, unit.text),
  samples: {
    pass: ['آگهی پیدا نشد.', 'کدام ماشین؟', 'قیمت از ارزش بازار پایین‌تر است؛ دلیلش را ببینید.'],
    fail: ['آگهی ثبت شد!', 'خوش آمدید！', 'سلام!! به کارشناس خوش آمدید'],
  },
};
