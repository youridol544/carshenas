// What a buyer or a seller might type or paste, plus strings that break naive layouts, parsers and bidi handling.
// The Big List of Naughty Strings has almost nothing for Persian (of 515 entries, 13 contain right-to-left or
// bidi characters, 1 uses letters specific to Persian and 2 a zero-width non-joiner; counted 2026-09-22), so the
// Persian cases are ours: zero-width non-joiners, Arabic yeh and kaf, three digit scripts, tatweel, bidi controls.
// Invisible characters are built from code points so this file stays readable.
// Never add the words the garbage-text oracle looks for (NaN, undefined, …): typed text can be echoed.

const ZWNJ = String.fromCodePoint(0x200c);
const LRM = String.fromCodePoint(0x200e);
const RLM = String.fromCodePoint(0x200f);
const RLO = String.fromCodePoint(0x202e);
const PDF = String.fromCodePoint(0x202c);
const LRI = String.fromCodePoint(0x2066);
const PDI = String.fromCodePoint(0x2069);
const TATWEEL = String.fromCodePoint(0x0640);

/** A realistic long dealership name: breakable at spaces, with one zero-width non-joiner. */
export const LONG_FARSI_PHRASE = `مجموعهٔ نمایشگاه${ZWNJ}های خرید و فروش خودروهای صفر و کارکردهٔ خانوادهٔ بزرگ ایرانی با مسئولیت محدود`;

export const HOSTILE_STRINGS: readonly string[] = [
  '',
  ' ',
  'سلام',
  `نمایشگاه${ZWNJ}ها و آگهی${ZWNJ}های خودروهای دست${ZWNJ}دوم`,
  `مجموعهٔ نمایشگاه${ZWNJ}های خرید و فروش خودروهای صفر و کارکردهٔ خانوادهٔ بزرگ ایرانی با مسئولیت محدود، شعبهٔ مرکزی تهران`,
  Array.from({ length: 10 }, () => 'دست').join(ZWNJ), // one long word: ZWNJ is not a line-break opportunity
  'Supercalifragilisticexpialidocious-Pneumonoultramicroscopicsilicovolcanoconiosis',
  'VIN-NAAP13ED9KJ123456 پژو پارس مدل ۱۳۹۸ (model 2019)',
  '۰۹۱۲۳۴۵۶۷۸۹',
  '09123456789',
  '+98 912 345 6789',
  '٠٩١٢٣٤٥٦٧٨٩',
  '۱۲',
  '١٢',
  '12',
  '۱۲٬۵۰۰',
  '۱۲۳٫۴۵',
  '-1',
  '0',
  '999999999999999999999',
  '1e309',
  '<script>alert(1)</script>',
  '"><img src=x onerror=alert(1)>',
  "' OR '1'='1",
  '{{7*7}} ${7*7}',
  `${RLO}تست جهت${PDF}`,
  `${RLM}${LRM}${LRI}${PDI}`,
  'ي ك', // Arabic yeh and kaf where Persian ی and ک are expected
  `کا${TATWEEL.repeat(6)}لا`,
  '👩🏽‍🚀🧿🇮🇷',
  'a'.repeat(512),
  'ن'.repeat(512),
  'line one\nline two\ttabbed',
];
