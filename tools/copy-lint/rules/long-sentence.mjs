// A sentence over 25 words. The voice guide (CS-104, R4): one idea per sentence, about 15 words and never over 25. A sentence
// is what lies between «.», «؟», «?», «!», «…» and line ends; a hole (`${...}`) counts as one word. One finding per string:
// the first long sentence. (length-notice, length-hint and the other length rules budget a whole string by its kind; this
// one budgets each sentence, whatever the kind.)
import { splitSentences, wordCount } from '../lib/persian.mjs';

const LIMIT = 25;
const words = (count) => Array.from({ length: count }, () => 'کلمه').join(' ');

export default {
  id: 'long-sentence',
  summary: `a sentence over ${LIMIT} words`,
  message: `A sentence over ${LIMIT} words (guide R4: about 15, never over ${LIMIT}).`,
  fix: 'Split it into sentences of one idea each, answer first; cut what the buyer cannot check or act on.',
  check(unit) {
    for (const sentence of splitSentences(unit.text)) {
      const count = wordCount(sentence);
      if (count > LIMIT)
        return [{ text: sentence, message: `A sentence of ${count} words (limit ${LIMIT}, guide R4).` }];
    }
    return [];
  },
  samples: {
    pass: [words(LIMIT), `${words(20)}. ${words(20)}.`, 'قیمت پایین است.'],
    fail: [words(LIMIT + 1), `کوتاه است. ${words(LIMIT + 5)}.`],
  },
};
