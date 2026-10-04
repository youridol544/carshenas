// Banned phrases and machine-written patterns, from the ONE list in data/banned-phrases.mjs.
//
// A gap in a phrase matches a space, a no-break space or a half-space (ZWNJ), so one spelling in the list finds all
// three. A phrase matches whole words only: a letter, a digit or a half-space right next to it means it is part of a
// longer word («گردد» is not found in «برگردد», «جهت» not in «جهت‌یابی»).
import { ZWNJ } from '../lib/persian.mjs';
import { matchesGlob } from '../lib/glob.mjs';
import { BANNED } from '../data/banned-phrases.mjs';

const GAP = `[\\s${ZWNJ}]+`;
const NOT_INSIDE_A_WORD_BEFORE = `(?<![\\p{L}\\p{N}${ZWNJ}])`;
const NOT_INSIDE_A_WORD_AFTER = `(?![\\p{L}\\p{N}${ZWNJ}])`;

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function compile(entry) {
  const sources = [
    ...(entry.phrases ?? []).map((phrase) => phrase.trim().split(/\s+/).map(escape).join(GAP)),
    ...(entry.patterns ?? []).map((pattern) => pattern.replaceAll('\\s', `[\\s${ZWNJ}]`)),
  ];
  return new RegExp(`${NOT_INSIDE_A_WORD_BEFORE}(?:${sources.join('|')})${NOT_INSIDE_A_WORD_AFTER}`, 'iu');
}

export const compiled = BANNED.map((entry) => ({ entry, regex: compile(entry) }));

export default {
  id: 'banned-phrase',
  summary: 'a banned filler, machine-written, bureaucratic, praising or apologising phrase',
  message: 'A banned phrase (tools/copy-lint/data/banned-phrases.mjs).',
  fix: 'See the entry in the list: it says what is wrong and what to write instead.',
  check(unit) {
    const found = [];
    for (const { entry, regex } of compiled) {
      if (entry.except?.some((glob) => matchesGlob(unit.file, glob))) continue;
      const match = regex.exec(unit.text);
      if (match === null) continue;
      found.push({
        index: match.index,
        length: match[0].length,
        text: match[0],
        message: `Banned phrase «${match[0]}» (${entry.id}, ${entry.group}): ${entry.why}`,
        fix: entry.instead,
      });
    }
    return found;
  },
  samples: {
    pass: [
      'آگهی‌های تازه را ببینید',
      'برگردد به صفحه‌ی قبل',
      'نمایش همه‌ی آگهی‌ها',
      'جهت‌یابی روی نقشه',
      'قیمت از ارزش بازار پایین‌تر است',
      'امکان خرید قسطی',
      'فروشنده امکان معاوضه را نوشته است',
      'اینجا را ببینید و همین~جا بمانید',
      'قیمتش را ببینید و دکمه را بزنید',
      'نام کاربری و حساب کاربری',
      'بهترین معامله',
      'اپل و سیستم~عامل',
    ],
    fail: BANNED.flatMap((entry) => entry.examples),
  },
};
