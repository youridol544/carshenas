// A space where a half-space (the zero-width non-joiner, ZWNJ) belongs. Persian writes the verb prefixes می and نمی,
// the plural «ها», the comparative «تر» and «ترین» and the ezafe «ی» joined to their word by a ZWNJ: «می‌خواهید»,
// «کتاب‌ها», «بزرگ‌تر», «صفحه‌ی اصلی». A plain space (or a no-break space) there reads as two words and breaks a
// search for the right spelling. Test samples write the ZWNJ as «~» (test/samples.mjs).
import { PERSIAN_LETTER } from '../lib/persian.mjs';

const PREFIXES = new Set(['می', 'نمی']);
const SUFFIXES = new Set([
  'ها',
  'های',
  'هایی',
  'هایم',
  'هایت',
  'هایش',
  'هایمان',
  'هایتان',
  'هایشان',
  'تر',
  'تری',
  'ترین',
  'ی',
]);

const ENDS_IN_LETTER = new RegExp(`${PERSIAN_LETTER.source}$`, 'v');
const STARTS_WITH_LETTER = new RegExp(`^${PERSIAN_LETTER.source}`, 'v');
const EDGE_PUNCTUATION = /^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu;

function tokens(text) {
  return [...text.matchAll(/\S+/g)].map((match) => {
    const raw = match[0];
    const core = raw.replace(EDGE_PUNCTUATION, '');
    return {
      raw,
      core,
      start: match.index,
      end: match.index + raw.length,
      // Joined to the text before or after it by punctuation («می،»): the pair is not a word and its suffix.
      closedBefore: core !== '' && !raw.startsWith(core),
      closedAfter: core !== '' && !raw.endsWith(core),
    };
  });
}

export default {
  id: 'half-space',
  summary: 'a space where a half-space belongs',
  message:
    'A space where a half-space (ZWNJ) belongs: the prefix می or نمی, the suffix ها, تر, ترین or ی, written as a separate word.',
  fix: 'Join it to its word with a zero-width non-joiner (U+200C): «می‌خواهید», «کتاب‌ها», «بزرگ‌تر», «صفحه‌ی اصلی».',
  check(unit) {
    const found = [];
    const list = tokens(unit.text);
    for (let i = 1; i < list.length; i += 1) {
      const before = list[i - 1];
      const after = list[i];
      if (before.closedAfter || after.closedBefore) continue;
      const prefix = PREFIXES.has(before.core) && STARTS_WITH_LETTER.test(after.core);
      const suffix = SUFFIXES.has(after.core) && ENDS_IN_LETTER.test(before.core);
      if (prefix || suffix) {
        found.push({
          index: before.start,
          length: after.end - before.start,
          text: `${before.raw} ${after.raw}`,
        });
      }
    }
    return found;
  },
  samples: {
    pass: [
      'می~خواهید آگهی ببینید؟',
      'نمی~توانید وارد شوید',
      'کتاب~ها و آگهی~های تازه',
      'بزرگ~تر و گران~ترین',
      'صفحه~ی اصلی',
      'میلیون تومان',
      'قیمت {} تومان',
    ],
    fail: [
      'می خواهید آگهی ببینید؟',
      'نمی توانید وارد شوید',
      'کتاب ها',
      'آگهی های تازه',
      'بزرگ تر از این',
      'گران ترین آگهی',
      'صفحه ی اصلی',
      'می_خواهید',
    ],
  },
};
