// English (Latin-letter) words inside Persian copy, outside the allowlist in data/allowed-latin.mjs (cc, km). A Latin
// token is two or more letters in a row, with its digits («xDrive30i»); holes (`${...}`) are not looked into.
import { ALLOWED_LATIN } from '../data/allowed-latin.mjs';

const LATIN_TOKEN = /(?<![A-Za-z0-9_])[A-Za-z][A-Za-z0-9_]*[A-Za-z0-9](?:-[A-Za-z0-9_]+)*(?![A-Za-z0-9_-])/g;
const ADDRESS = /(?:https?:\/\/|www\.)\S+|\S+@\S+\.\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/\S*)?/gi;
const allowed = new Set(Object.keys(ALLOWED_LATIN).map((word) => word.toLowerCase()));

export default {
  id: 'english-word',
  level: 'refuse',
  summary: 'an English word inside Persian copy',
  message: 'An English word inside Persian copy.',
  fix: 'Write it in Persian (the glossary has the term), or, if it must stay Latin, add it to tools/copy-lint/data/allowed-latin.mjs with a reason.',
  check(unit) {
    const found = [];
    const text = unit.text.replace(ADDRESS, (whole) => ' '.repeat(whole.length));
    for (const match of text.matchAll(LATIN_TOKEN)) {
      if (allowed.has(match[0].toLowerCase())) continue;
      found.push({
        index: match.index,
        length: match[0].length,
        text: match[0],
        message: `The English word «${match[0]}» inside Persian copy.`,
      });
    }
    return found;
  },
  samples: {
    pass: [
      'موتور ۲۰۰۰ cc',
      'حداکثر ۱۲۰ km',
      'نشانی https://divar.ir/v/abc را بچسبانید',
      'مثلاً divar.ir/v/نام-آگهی',
      'قیمت {} تومان',
    ],
    fail: ['ارسال به Telegram', 'پاسخ API خوانده نشد', 'خطای server', 'مدل BMW X3', 'صف pg-boss خالی است'],
  },
};
