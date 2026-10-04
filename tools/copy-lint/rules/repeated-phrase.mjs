// The same run of eight words in two strings of one screen (lib/screens.mjs): the hero intro that reappears, word for
// word, as the first step of «how it works». Said once, a fact is read; said twice on one screen it is padding (owner,
// 2026-10-04: the copy "repeats itself"; guide R5: an idea sits in one of the title, lead, hint, button and notice).
//
// repeated-sentence finds a whole sentence written twice; this finds what two different sentences share. Words are counted
// as a reader counts them (a half-space joins a word; case and punctuation do not matter), runs never span a hole
// (`${...}`), and a pair of strings that already share a whole sentence is left to the other rule. One finding per string.
import { NBSP, PLACEHOLDER, ZWNJ, normalizeSentence, splitSentences, wordCount } from '../lib/persian.mjs';
import { screenOf } from '../lib/screens.mjs';

const RUN = 8;
const SENTENCE_WORDS = 5;

/**
 * The words of a string in runs that never span a hole, each as `{ norm, shown }`: `norm` is how words are compared (a
 * half-space is dropped, case and punctuation do not matter), `shown` the word as written, for the report. Only runs long
 * enough to share are kept.
 */
function runsOf(text) {
  return text
    .split(PLACEHOLDER)
    .map((segment) =>
      segment
        .replaceAll(NBSP, ' ')
        .split(/\s+/)
        .map((word) => ({
          norm: word
            .replaceAll(ZWNJ, '')
            .toLowerCase()
            .replace(/[^\p{L}\p{N}]/gu, ''),
          shown: word,
        }))
        .filter((word) => word.norm !== ''),
    )
    .filter((words) => words.length >= RUN);
}

/** The whole sentences of a string that repeated-sentence compares (five words or more, no holes). */
function wholeSentences(text) {
  return new Set(
    splitSentences(text)
      .filter((sentence) => !sentence.includes(PLACEHOLDER) && wordCount(sentence) >= SENTENCE_WORDS)
      .map(normalizeSentence),
  );
}

export default {
  id: 'repeated-phrase',
  summary: `a run of ${RUN} words repeated in two strings of one screen`,
  message: `A run of ${RUN} words is written again in another string of this screen.`,
  fix: 'Say it once: keep the phrase where the buyer needs it, and shorten or drop the other.',
  checkAll(units) {
    const found = [];
    const firstSeen = new Map();
    for (const unit of units) {
      if (!unit.persian) continue;
      const screen = screenOf(unit.file);
      const sentences = wholeSentences(unit.text);
      let reported = false;
      for (const words of runsOf(unit.text)) {
        for (let at = 0; at + RUN <= words.length; at += 1) {
          const slice = words.slice(at, at + RUN);
          const key = `${screen}\n${slice.map((word) => word.norm).join(' ')}`;
          const first = firstSeen.get(key);
          if (first === undefined) {
            firstSeen.set(key, unit);
            continue;
          }
          if (first === unit || reported) continue;
          // A whole sentence said twice is the other rule's finding; here only what different sentences share.
          if ([...wholeSentences(first.text)].some((sentence) => sentences.has(sentence))) continue;
          reported = true;
          const where = first.file === unit.file ? 'in this file' : `on this screen (${first.file})`;
          found.push({
            unit,
            text: slice.map((word) => word.shown).join(' '),
            message: `A run of ${RUN} words is already written ${where}, line ${first.line}.`,
          });
        }
      }
    }
    return found;
  },
  samples: {
    pass: [
      {
        units: [
          { file: 'a.ts', text: 'آگهی~های خودروهای کارکرده را از سایت~های آگهی می~خوانیم و حساب می~کنیم' },
          { file: 'a.ts', text: 'ما آگهی~های خودروهای کارکرده را از سایت~های آگهی بررسی می~کنیم' },
        ],
      },
      {
        units: [
          {
            file: 'apps/web/src/features/home/home-copy.ts',
            text: 'آگهی~های خودروهای کارکرده را از سایت~های آگهی می~خوانیم و حساب می~کنیم',
          },
          {
            file: 'apps/web/src/features/search/search-copy.ts',
            text: 'آگهی~های خودروهای کارکرده را از سایت~های آگهی می~خوانیم و حساب می~کنیم',
          },
        ],
      },
      {
        units: [
          { file: 'a.ts', text: 'قیمت این آگهی از ارزش بازار {} کمتر است و همین~طور دیگر' },
          { file: 'a.ts', text: 'قیمت این آگهی از ارزش بازار {} کمتر است و همین~طور دیگر' },
        ],
      },
      {
        units: [
          { file: 'a.ts', text: 'کمی بعد دوباره امتحان کنید و اگر نشد خبر دهید.' },
          { file: 'a.ts', text: 'کمی بعد دوباره امتحان کنید و اگر نشد خبر دهید.' },
        ],
      },
    ],
    fail: [
      {
        units: [
          {
            file: 'a.ts',
            text: 'آگهی~های خودروهای کارکرده را از سایت~های آگهی می~خوانیم و ارزش بازار هر ماشین را حساب می~کنیم',
          },
          {
            file: 'a.ts',
            text: 'هر روز آگهی~های خودروهای کارکرده را از سایت~های آگهی می~خوانیم، نام و تیپ هر خودرو را پیدا می~کنیم',
          },
        ],
      },
      {
        units: [
          {
            file: 'apps/web/src/features/home/home-copy.ts',
            text: 'نیمی از آگهی~ها ارزان~تر و نیمی گران~تر از قیمت میانه هستند',
          },
          {
            file: 'apps/web/src/features/home/components/how.tsx',
            text: 'می~بینید که نیمی از آگهی~ها ارزان~تر و نیمی گران~تر از این است',
          },
        ],
      },
    ],
  },
};
