import type { Search } from '@carshenas/search/search';

// The sentence a buyer typed, kept beside the search it became (CS-111, ADR-0043). The box takes one free text; the
// server reads it by code and answers with the canonical address of the search (filters, words, order), and keeps the
// sentence in one more parameter, `ask`, so the box shows what was written after a reload, a shared link, Back and every
// chip removed. The search itself never holds it: `ask` is not part of the Search schema, a search file stores no
// sentence, and the filters in the address are the whole truth about what is shown.

export const SENTENCE_PARAM = 'ask';

/** The longest sentence the box takes; the understanding reads the first 200 characters and says so. */
export const MAX_SENTENCE_CHARACTERS = 1_000;

function isControl(code: number): boolean {
  return code < 0x20 || code === 0x7f;
}

/**
 * A typed text as a sentence: control characters (a null byte would reach the database) and runs of whitespace become
 * one space, the ends are trimmed, and at most MAX_SENTENCE_CHARACTERS characters stay, never half a character.
 */
export function tidySentence(text: string): string {
  let out = '';
  for (const letter of text) out += isControl(letter.codePointAt(0) ?? 0) ? ' ' : letter;
  return Array.from(out.replace(/\s+/g, ' ').trim()).slice(0, MAX_SENTENCE_CHARACTERS).join('').trim();
}

/** The sentence an address carries, or undefined when it has none. */
export function sentenceFromParams(params: URLSearchParams): string | undefined {
  const text = tidySentence(params.get(SENTENCE_PARAM) ?? '');
  return text === '' ? undefined : text;
}

/** An address with the sentence kept in it (the last parameter); the address itself when there is none. */
export function withSentence(href: string, sentence: string | undefined): string {
  const text = sentence === undefined ? '' : tidySentence(sentence);
  if (text === '') return href;
  const at = href.indexOf('?');
  const path = at === -1 ? href : href.slice(0, at);
  const params = new URLSearchParams(at === -1 ? '' : href.slice(at + 1));
  params.set(SENTENCE_PARAM, text);
  return `${path}?${params.toString()}`;
}

/**
 * What asking answers (CS-111): where the sentence leads, or why it could not be read, with the sentence it was (the
 * message is shown for that text only, so typing again clears it). A form sent before the script has loaded is
 * redirected by the server instead, and never sees this.
 */
export type AskState =
  | { readonly status: 'idle' }
  | { readonly status: 'found'; readonly href: string }
  | { readonly status: 'failed'; readonly message: string; readonly sentence: string };

export const ASK_IDLE: AskState = { status: 'idle' };

/**
 * The box could not read the sentence (the lexicon or the counts failed on the server, or the request never arrived):
 * said under the box, the sentence still in it. One text for the server's answer and the browser's own failure.
 */
export const ASK_FAILED_MESSAGE = 'جمله‌ی شما خوانده نشد و همین‌جا مانده است. دوباره امتحان کنید.';

/** What the page says about the sentence beside the filters it became (docs/specs/S04-plain-farsi-search.md). */
export type SentenceView = {
  /** One quiet line each: a typo read, a city that is not covered, a make that is not collected, a number no car has. */
  readonly notes: readonly string[];
  /**
   * Words the sentence had that no filter could name and that would leave the results empty, left out; each comes
   * with the search that puts it back.
   */
  readonly dropped: readonly { readonly words: string; readonly put: Search }[];
  /** Readings a model was not sure of: not applied, one tap to add; each with the search that adds it. */
  readonly suggestions: readonly { readonly key: string; readonly text: string; readonly add: Search }[];
  /** A model may still read more of the sentence: the page asks in the background (the master switch is on). */
  readonly refine: boolean;
  /**
   * The Persian names the understanding gave the chosen values of the filters whose options are rows, keyed «filter id:value»
   * («make:mazda»): the page names a value from the options its listings have, and a make nobody collects has none, so
   * its chip would read as the English key.
   */
  readonly labels: Readonly<Record<string, string>>;
};
