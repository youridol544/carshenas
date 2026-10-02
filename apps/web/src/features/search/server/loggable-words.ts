import 'server-only';
import { maskPhoneLike } from '@carshenas/search/understand/privacy';

// Keeps a typed query's digits out of the log when they could be a phone number: the one rule in @carshenas/search,
// which plain-Farsi search also applies before a model reads a word (CS-62).
export function loggableWords(words: string | undefined): string | undefined {
  return maskPhoneLike(words);
}
