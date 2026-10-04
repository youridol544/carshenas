// The same sentence twice: in one file, or among the strings of one screen's files (lib/screens.mjs). Said once, a fact
// is read; said twice on one screen, it is padding (owner, 2026-10-04: the copy "repeats itself"). A sentence is
// what lies between «.», «؟», «?», «!», «…» or a line end; it counts from five words, so labels and titles such as
// «بازگشت به پنل مدیریت» may repeat; case and punctuation do not make two sentences different, a different number does, and a sentence with a
// hole (`${...}`) is not compared, since it may say something else each time it is shown.
import { PLACEHOLDER, normalizeSentence, splitSentences, wordCount } from '../lib/persian.mjs';
import { screenOf } from '../lib/screens.mjs';

const MIN_WORDS = 5;

export default {
  id: 'repeated-sentence',
  level: 'refuse',
  summary: 'the same sentence twice in one file or one screen',
  message: 'The same sentence is written twice.',
  fix: 'Say it once: keep it where the buyer needs it and remove the other, or point to one shared constant.',
  checkAll(units) {
    const found = [];
    const firstSeen = new Map();
    for (const unit of units) {
      if (!unit.persian) continue;
      const screen = screenOf(unit.file);
      const inThisUnit = new Set();
      for (const sentence of splitSentences(unit.text)) {
        // A sentence with a hole may say different things each time it is shown: only whole sentences are compared.
        if (sentence.includes(PLACEHOLDER) || wordCount(sentence) < MIN_WORDS) continue;
        const normalized = normalizeSentence(sentence);
        const key = `${screen}\n${normalized}`;
        const first = firstSeen.get(key);
        if (first === undefined) {
          firstSeen.set(key, unit);
        } else if (first !== unit || inThisUnit.has(normalized)) {
          const sameFile = first.file === unit.file;
          found.push({
            unit,
            text: sentence,
            message: sameFile
              ? `The same sentence is already written in this file (line ${first.line}).`
              : `The same sentence is already written on this screen (${first.file}, line ${first.line}).`,
          });
        }
        inThisUnit.add(normalized);
      }
    }
    return found;
  },
  samples: {
    pass: [
      {
        units: [
          { file: 'a.ts', text: 'کمی بعد دوباره امتحان کنید' },
          { file: 'a.ts', text: 'دوباره تلاش کنید' },
        ],
      },
      {
        units: [
          { file: 'a.ts', text: 'تلاش دوباره' },
          { file: 'a.ts', text: 'تلاش دوباره' },
        ],
      },
      {
        units: [
          { file: 'a.ts', text: 'قیمت {} تومان کم شد امروز' },
          { file: 'a.ts', text: 'قیمت {} تومان کم شد امروز' },
        ],
      },
      {
        units: [
          { file: 'a.ts', text: 'قیمت آگهی دست‌کم ۱۰ درصد کمتر از ارزش بازار باشد.' },
          { file: 'a.ts', text: 'قیمت آگهی دست‌کم ۴ درصد کمتر از ارزش بازار باشد.' },
        ],
      },
      {
        units: [
          { file: 'apps/web/src/features/admin/x-copy.ts', text: 'کمی بعد دوباره امتحان کنید' },
          { file: 'apps/web/src/features/admin/y-copy.ts', text: 'کمی بعد دوباره امتحان کنید' },
        ],
      },
      {
        units: [
          { file: 'apps/web/src/features/home/home-copy.ts', text: 'کمی بعد دوباره امتحان کنید' },
          { file: 'apps/web/src/features/search/search-copy.ts', text: 'کمی بعد دوباره امتحان کنید' },
        ],
      },
    ],
    fail: [
      {
        units: [
          { file: 'a.ts', text: 'کمی بعد دوباره امتحان کنید.' },
          { file: 'a.ts', text: 'کمی بعد دوباره امتحان کنید' },
        ],
      },
      {
        units: [
          { file: 'a.ts', text: 'پایگاه داده پاسخ نداد. کمی بعد دوباره امتحان کنید.' },
          { file: 'a.ts', text: 'کمی بعد دوباره امتحان کنید.' },
        ],
      },
      {
        units: [
          { file: 'apps/web/src/features/home/home-copy.ts', text: 'ارزش بازار هر روز حساب می‌شود' },
          { file: 'apps/web/src/features/home/components/how.tsx', text: 'ارزش بازار هر روز حساب می‌شود' },
        ],
      },
    ],
  },
};
