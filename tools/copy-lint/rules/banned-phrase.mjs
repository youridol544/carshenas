// Banned and discouraged phrases and machine-written patterns, from the ONE list in data/banned-phrases.mjs.
//
// The list has two levels (the voice guide's appendix B), so it makes two rules:
//   banned-phrase       level refuse: a new hit fails the lint (the entries marked `level: 'refuse'`)
//   discouraged-phrase  level warn: listed by `--warnings`, never fails, never baselined (the entries marked `level: 'warn'`)
//
// A gap in a phrase matches a space, a no-break space or a half-space (ZWNJ), so one spelling in the list finds all
// three. A phrase matches whole words only: a letter, a digit or a half-space right next to it means it is part of a
// longer word («گردد» is not found in «برگردد», «جهت» not in «جهت‌یابی»). An entry may say where it does not apply
// (`except`: file globs or `area:<id>`).
import { ZWNJ } from '../lib/persian.mjs';
import { matchesGlob } from '../lib/glob.mjs';
import { areaIdOf } from '../areas.mjs';
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

const seen = new Set();
for (const entry of BANNED) {
  if (entry.level !== 'refuse' && entry.level !== 'warn') {
    throw new Error(`data/banned-phrases.mjs: entry ${entry.id} needs level 'refuse' or 'warn'`);
  }
  if (seen.has(entry.id)) throw new Error(`data/banned-phrases.mjs: entry ${entry.id} is listed twice`);
  seen.add(entry.id);
}

export const compiled = BANNED.map((entry) => ({ entry, regex: compile(entry) }));

/** Whether an entry's `except` covers the file: a glob, or `area:<id>` for the files of a rewrite area. */
export function isExempt(entry, file) {
  return (entry.except ?? []).some((exception) =>
    exception.startsWith('area:')
      ? areaIdOf(file) === exception.slice('area:'.length)
      : matchesGlob(file, exception),
  );
}

const PASSING = [
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
];

function rule(level, { id, summary, message, fix, label }) {
  const entries = compiled.filter((item) => item.entry.level === level);
  return {
    id,
    level,
    summary,
    message,
    fix,
    check(unit) {
      const found = [];
      for (const { entry, regex } of entries) {
        if (isExempt(entry, unit.file)) continue;
        const match = regex.exec(unit.text);
        if (match === null) continue;
        found.push({
          index: match.index,
          length: match[0].length,
          text: match[0],
          message: `${label} «${match[0]}» (${entry.id}, ${entry.group}): ${entry.why}`,
          fix: entry.instead,
        });
      }
      return found;
    },
    samples: {
      pass: PASSING,
      fail: entries.flatMap(({ entry }) => entry.examples),
    },
  };
}

export default [
  rule('refuse', {
    id: 'banned-phrase',
    summary:
      'a banned phrase: filler, translated, machine-written, register slip, bureaucratic, praise, apology',
    message: 'A banned phrase (tools/copy-lint/data/banned-phrases.mjs).',
    fix: 'See the entry in the list: it says what is wrong and what to write instead.',
    label: 'Banned phrase',
  }),
  rule('warn', {
    id: 'discouraged-phrase',
    summary: 'a phrase the voice guide asks a person to reconsider (a warning: it never fails the lint)',
    message: 'A phrase to reconsider (tools/copy-lint/data/banned-phrases.mjs).',
    fix: 'Read the sentence: the entry in the list says what is usually wrong and what to write instead.',
    label: 'Phrase to reconsider',
  }),
];
