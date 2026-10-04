// Length budgets by kind of text: a button is at most 3 words and 22 characters, a label 4 words, a title 8, a hint 12,
// a notice 25 and a popover paragraph 45 (lib/kinds.mjs holds the numbers and says how a string gets its kind: from the
// key of the object property it is the value of, or the JSX attribute or element it belongs to; a string of unknown
// kind has no budget). A hole (`${...}`) counts as one word. One rule per kind, so the report says which budget broke.
import { BUDGETS } from '../lib/kinds.mjs';
import { charCount, display, wordCount } from '../lib/persian.mjs';

const WORDS = {
  button: {
    sample: 'دیدن همه‌ی آگهی‌های مشابه این مدل',
    short: 'تلاش دوباره',
    kind: 'a button (a verb the buyer presses)',
  },
  label: { sample: 'تحلیل قیمت این آگهی در بازار', short: 'تحلیل قیمت', kind: 'a label' },
  name: {
    sample: 'توضیح درباره‌ی ترتیب بهترین معامله‌ها در فهرست این مدل و آگهی‌های مشابه آن',
    short: 'توضیح درباره‌ی ارزش بازار',
    kind: 'an accessible name (an aria-label or a key ending in Label)',
  },
  title: {
    sample: 'آگهی‌های مشابهی که ارزش بازار از آن‌ها حساب شد و هنوز روی بازارند',
    short: 'تحلیل قیمت',
    kind: 'a title',
  },
  hint: {
    sample: 'نزدیک‌ترین آگهی‌ها به این خودرو در سال ساخت و کارکرد و قیمت و مکان آگهی',
    short: 'همین مدل، با سال و قیمتی نزدیک.',
    kind: 'a hint',
  },
  notice: {
    sample:
      'آگهی‌های خودروهای کارکرده را از سایت‌های آگهی می‌خوانیم، ارزش بازار هر ماشین را حساب می‌کنیم و می‌گوییم قیمتش منصفانه است یا نه، با دلیل و با شرح کامل',
    short: 'آگهی پیدا نشد.',
    kind: 'a notice or lead paragraph',
  },
  popover: {
    sample: Array.from({ length: 46 }, () => 'کلمه').join(' '),
    short: 'خودروهایی که کارکردشان برای سنشان کم است.',
    kind: 'one paragraph of an info popover',
  },
};

function rule(kind) {
  const budget = BUDGETS[kind];
  const names = WORDS[kind];
  return {
    id: `length-${kind}`,
    summary: `${names.kind} over its length budget`,
    message: `Too long for ${names.kind}: at most ${budget.words} words${budget.chars === undefined ? '' : ` and ${budget.chars} characters`}.`,
    fix: 'Say less: one idea, the answer first. If the rest matters, it is another element (a hint or an info control), not a longer label.',
    check(unit) {
      if (unit.kind !== kind) return [];
      const words = wordCount(unit.text);
      const chars = charCount(unit.text);
      const tooManyWords = words > budget.words;
      const tooManyChars = budget.chars !== undefined && chars > budget.chars;
      if (!tooManyWords && !tooManyChars) return [];
      const detail = [
        tooManyWords ? `${words} words (limit ${budget.words})` : undefined,
        tooManyChars ? `${chars} characters (limit ${budget.chars})` : undefined,
      ]
        .filter(Boolean)
        .join(', ');
      return [
        {
          text: display(unit.text),
          message: `Too long for ${names.kind}: ${detail}.`,
        },
      ];
    },
    samples: {
      pass: [
        { text: names.short, kind },
        { text: names.sample, kind: 'unknown' },
      ],
      fail: [{ text: names.sample, kind }],
    },
  };
}

export default Object.keys(BUDGETS).map(rule);
