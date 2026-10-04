// The lint and the voice guide agree. Appendix B of docs/design/product-voice.md ("what the copy lint refuses in a buyer
// string") is the source for the lint's list: «refuse» fails the lint, «warn» asks a person. This test holds both ways:
//   - every word or mark the appendix lists is known here, and the lint treats it at the level the appendix gives it;
//   - a word the appendix gains later fails this test by name, until the list in data/banned-phrases.mjs (or a rule) and
//     the table below learn it.
// Arabic letters are built from code points, never typed (AGENTS.md, Gotchas).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { runRules } from '../lib/engine.mjs';
import { REPO_ROOT } from '../lib/paths.mjs';
import { ZWNJ } from '../lib/persian.mjs';
import { loadRules } from '../rules/index.mjs';
import { makeUnit } from './helpers.mjs';

const rules = await loadRules();
const GUIDE = path.join(REPO_ROOT, 'docs', 'design', 'product-voice.md');

const ARABIC_YEH = String.fromCodePoint(0x64a);
const ARABIC_KAF = String.fromCodePoint(0x643);
const words = (count) => Array.from({ length: count }, () => 'کلمه').join(' ');

/**
 * Each entry of the appendix as the guide writes it (marks and half-spaces ignored when comparing), with the rule that
 * must find it and a string that has it. `clean`: strings that have the word in a way the guide allows and must pass.
 */
const REFUSE = {
  لطفاً: { rule: 'banned-phrase', probes: ['لطفاً صبر کنید'] },
  متأسفانه: { rule: 'banned-phrase', probes: ['متأسفانه پیدا نشد'] },
  خوشبختانه: { rule: 'banned-phrase', probes: ['خوشبختانه پیدا شد'] },
  نمایید: { rule: 'banned-phrase', probes: ['ثبت نام نمایید'] },
  گردید: { rule: 'banned-phrase', probes: ['درخواست ثبت گردید'] },
  می‌باشد: { rule: 'banned-phrase', probes: ['قیمت تقریبی می~باشد'] },
  نمودن: { rule: 'banned-phrase', probes: ['ثبت نمودن آگهی'] },
  بفرمایید: { rule: 'banned-phrase', probes: ['بفرمایید آگهی را ببینید'] },
  '!': { rule: 'exclamation-mark', probes: ['آگهی ثبت شد!'] },
  '·': { rule: 'middle-dot-digit', probes: ['تهران · ۳ ساعت پیش', 'کارکرد ۱۲۰٬۰۰۰ · تهران'] },
  [ARABIC_YEH]: { rule: 'arabic-letters', probes: [`قیم${ARABIC_YEH}ت پایین است`] },
  [ARABIC_KAF]: { rule: 'arabic-letters', probes: [`${ARABIC_KAF}ارشناس`] },
  'an ASCII digit in Farsi text': { rule: 'latin-digits', probes: ['قیمت 12 میلیون'] },
  'پایگاه داده': { rule: 'banned-phrase', probes: ['از پایگاه داده خوانده شد'] },
  سرور: { rule: 'banned-phrase', probes: ['به سرور نرسیدیم'] },
  'هوش مصنوعی': { rule: 'banned-phrase', probes: ['هوش مصنوعی آن را خواند'] },
  'مدل زبانی': { rule: 'banned-phrase', probes: ['یک مدل زبانی آن را نوشت'] },
  API: { rule: 'english-word', probes: ['پاسخ API خوانده نشد'] },
  اپ: { rule: 'banned-phrase', probes: ['برای استفاده از اپ وارد شوید'] },
  سامانه: { rule: 'banned-phrase', probes: ['سامانه جمله را نفهمید'] },
  پلتفرم: { rule: 'banned-phrase', probes: ['پلتفرم خرید خودرو'] },
  نامعتبر: { rule: 'banned-phrase', probes: ['نشانی نامعتبر است'] },
  'با موفقیت': { rule: 'banned-phrase', probes: ['درخواست با موفقیت ثبت شد'] },
};

const WARN = {
  هنوز: { rule: 'discouraged-phrase', probes: ['این آگهی را هنوز ندیده‌ایم'] },
  فعلاً: { rule: 'discouraged-phrase', probes: ['فعلاً فقط دیوار را می‌خوانیم'] },
  'در حال حاضر': { rule: 'discouraged-phrase', probes: ['در حال حاضر فقط دیوار را می‌خوانیم'] },
  می‌توانید: { rule: 'discouraged-phrase', probes: ['می~توانید برگردید'] },
  'شما می‌توانید': { rule: 'discouraged-phrase', probes: ['شما می~توانید فیلترها را ببینید'] },
  'ممکن است': { rule: 'discouraged-phrase', probes: ['قیمت ممکن است پیش‌پرداخت باشد'] },
  احتمالاً: {
    rule: 'discouraged-phrase',
    probes: ['احتمالاً ارزان است و احتمالاً دوباره بالا می~رود'],
    clean: ['احتمالاً ۱۰۰٬۰۰۰ کیلومتر'],
  },
  '؛': { rule: 'semicolon', probes: [`قیمت پایین است${String.fromCodePoint(0x61b)} دلیلش را ببینید.`] },
  'a sentence over 25 words': { rule: 'long-sentence', probes: [`${words(26)}.`], clean: [`${words(25)}.`] },
  'a parenthesis': { rule: 'parenthesis', probes: ['قیمت از ارزش بازار (۱۲٪) پایین‌تر است'] },
  'اتصال را بررسی کنید': { rule: 'discouraged-phrase', probes: ['ثبت نشد. اتصال را بررسی کنید.'] },
  'مشکلی پیش آمد': { rule: 'discouraged-phrase', probes: ['مشکلی پیش آمد؛ دوباره امتحان کنید'] },
  من: { rule: 'discouraged-phrase', probes: ['نتوانستم این کلمه را بخوانم'] },
  'فهمیدم، گذاشتم، نتوانستم': {
    rule: 'discouraged-phrase',
    probes: ['فهمیدم', 'این‌ها را هم گذاشتم', 'نتوانستم این کلمه را بخوانم'],
  },
  'مورد … قرار': { rule: 'discouraged-phrase', probes: ['این آگهی مورد بررسی قرار گرفت'] },
  'در رابطه با': { rule: 'discouraged-phrase', probes: ['در رابطه با این آگهی'] },
  'به منظور': { rule: 'discouraged-phrase', probes: ['به منظور ثبت نام وارد شوید'] },
  جهت: { rule: 'discouraged-phrase', probes: ['جهت ثبت نام وارد شوید'], clean: ['جهت~یابی روی نقشه'] },
  حذف: { rule: 'discouraged-phrase', probes: ['آگهی را حذف کنید'] },
  مشاهده: { rule: 'discouraged-phrase', probes: ['مشاهده آگهی'] },
  پیوند: { rule: 'discouraged-phrase', probes: ['پیوند آگهی'] },
};

/** How the guide spells a word and how this table does, compared without marks, half-spaces or the spaces round a mark. */
const normalise = (text) =>
  text
    .replace(new RegExp(`[${ZWNJ}\\p{M}]`, 'gu'), '')
    .replace(/\s+/g, ' ')
    .trim();

const normalised = (table) => new Map(Object.entries(table).map(([key, entry]) => [normalise(key), entry]));

function findingsOf(text) {
  return runRules(rules, [makeUnit({ text })]);
}

for (const [level, table] of [
  ['refuse', REFUSE],
  ['warn', WARN],
]) {
  test(`the lint treats every ${level} word of the guide's appendix B at that level`, () => {
    for (const [word, entry] of Object.entries(table)) {
      assert.ok(entry.probes.length > 0, `${word} needs a probe`);
      for (const probe of entry.probes) {
        const found = findingsOf(probe).filter((finding) => finding.rule === entry.rule);
        assert.ok(found.length > 0, `«${word}»: rule ${entry.rule} did not find «${probe}»`);
        assert.ok(
          found.every((finding) => finding.level === level),
          `«${word}» is a ${level} word in the guide: ${entry.rule} reports it at level ${found[0].level}`,
        );
      }
      for (const clean of entry.clean ?? []) {
        assert.deepEqual(
          findingsOf(clean).map((finding) => finding.rule),
          [],
          `«${word}»: a use the guide allows was flagged: «${clean}»`,
        );
      }
    }
  });
}

test('every word or mark that appendix B of the guide lists is in this table (a new one fails here, by name)', () => {
  assert.ok(fs.existsSync(GUIDE), 'docs/design/product-voice.md is missing: the lint takes its list from it');
  const guide = fs.readFileSync(GUIDE, 'utf8');
  const knownByLevel = { refuse: normalised(REFUSE), warn: normalised(WARN) };
  const missing = [];
  for (const level of ['refuse', 'warn']) {
    const row = guide.split('\n').find((line) => line.startsWith(`| ${level} |`));
    assert.ok(row !== undefined, `appendix B of the guide has no «${level}» row: did its table change?`);
    const tokens = [...row.matchAll(/«([^»]+)»/g)].map((match) => normalise(match[1]));
    assert.ok(
      tokens.length >= 15,
      `the «${level}» row of appendix B holds ${tokens.length} words: did its table change?`,
    );
    for (const token of tokens) if (!knownByLevel[level].has(token)) missing.push(`${level}: «${token}»`);
  }
  assert.deepEqual(
    missing,
    [],
    'appendix B lists words the lint does not know: add each to tools/copy-lint/data/banned-phrases.mjs (or a rule in tools/copy-lint/rules/) and to the tables in this test',
  );
});
