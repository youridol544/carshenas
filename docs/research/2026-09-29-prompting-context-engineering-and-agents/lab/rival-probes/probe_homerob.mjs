// Verbatim copies of Homerob's toEnDigits (src/lib/persian.ts) and numbersAreGrounded (src/lib/explain/index.ts) at
// commit ca0d61a of https://github.com/MohammadJavadHeidari/Homerob (MIT), probed with hand-written explanations.
// No model is called. Run: node probe_homerob.mjs
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
function toEnDigits(input) {
  return input
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
}
function numbersAreGrounded(text, source) {
  const nums = (s) => toEnDigits(s).replace(/[٫.](?=\d)/g, '.').match(/\d+(?:\.\d+)?/g) ?? [];
  const allowed = new Set(nums(JSON.stringify(source)));
  return nums(text).every((n) => allowed.has(n) || Number(n) <= 10);
}
const facts = {
  id: 'L-4521',
  rooms: '۲ خوابه',
  area: '۹۵ متر',
  listedPrice: 'رهن ۵۰۰ میلیون',
  matchScore: 87,
  pros: ['۱۲۰ میلیون زیر بودجه‌ات'],
  cons: ['پارکینگ ندارد'],
};
const cases = {
  true: '۱۲۰ میلیون زیر بودجه‌ته و ۹۵ متره.',
  'false room count (3 vs 2)': '۳ خوابه‌ست و ۹۵ متره.',
  'false price as words (700 million)': 'رهنش هفتصد میلیونه، ولی اجاره نداره.',
  'number borrowed from the id': 'فقط ۴۵۲۱ متر تا مترو فاصله داره.',
  'number borrowed from the score': '۸۷ متر حیاط داره.',
  'false price with a larger unit (5 billion)': 'رهنش ۵ میلیارده.',
};
for (const [name, text] of Object.entries(cases)) {
  console.log(`${numbersAreGrounded(text, facts) ? 'PASS  ' : 'REJECT'}  ${name}`);
}
