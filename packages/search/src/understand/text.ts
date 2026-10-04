// A buyer's words as the understanding reads them (CS-62, docs/specs/S04-plain-farsi-search.md): cleaned of everything
// that renders as nothing, cut to the length the search schema allows, split into tokens that remember where they were
// typed, and folded so «پرايد», «پراید» and «پراید» are one word, «۲۰۶», «٢٠٦» and «206» are one number, and a word with a
// half-space equals the same two words with a space. The text is untrusted (a buyer, or someone pasting an attack), so
// nothing here interprets it; this file only makes it readable. Pure and client-safe: no Node or DOM API.
import { MAX_QUERY_LENGTH } from '../search.ts';

const char = (code: number): string => String.fromCodePoint(code);

/** The zero-width non-joiner Persian spelling needs: kept (one at a time) as the place where a word may be split. */
export const ZWNJ = char(0x200c);

/** The most characters of a query the understanding reads: what the search schema keeps (`q`). */
export const MAX_UNDERSTOOD_CHARACTERS = MAX_QUERY_LENGTH;

// Every mark that renders as nothing: Unicode's default-ignorable code points (zero-width space and joiners, the word
// joiner, direction marks, isolates, fillers, variation selectors and the tag characters), as listing text is cleaned
// (packages/ai tasks/listing-text.ts); only the non-joiner stays.
const DEFAULT_IGNORABLE = /\p{Default_Ignorable_Code_Point}/u;
const TAG_CHARACTER = /[\u{E0000}-\u{E007F}]/u;
const ZWNJ_RUN = new RegExp(`${ZWNJ}{2,}`, 'g');
const TATWEEL = char(0x0640);
// A half-space beside a space or at an end of the text joins nothing.
const EDGE_ZWNJ = new RegExp(`(^|\\s)${ZWNJ}+|${ZWNJ}+(?=\\s|$)`, 'g');

/** Whether a raw text carries Unicode tag characters: a hidden channel with no honest use in a search. */
export function hasHiddenCharacters(text: string): boolean {
  return TAG_CHARACTER.test(text);
}

/** The text as typed, minus what renders as nothing; spaces made one; nothing cut yet. */
function withoutInvisible(text: string): string {
  let out = '';
  for (const letter of text.normalize('NFKC')) {
    if (letter !== ZWNJ && DEFAULT_IGNORABLE.test(letter)) continue;
    out += letter;
  }
  return out
    .replaceAll(TATWEEL, '')
    .replace(ZWNJ_RUN, ZWNJ)
    .replace(EDGE_ZWNJ, '$1')
    .replace(/[\p{Zs}\t\r]+/gu, ' ')
    .replace(/ *\n+ */g, '\n')
    .trim();
}

// How a character behaves while splitting words.
// Letters of the Arabic script and their marks; its digits and punctuation are Script=Arabic too and are not words.
const ARABIC_LETTER = /(?=\p{L})\p{Script=Arabic}|\p{M}/u;
const ARABIC_WORD = /^(?:(?=\p{L})\p{Script=Arabic}|\p{M})+/u;
const LATIN = /\p{Script=Latin}/u;
const LATIN_WORD = /^\p{Script=Latin}(?:\p{Script=Latin}|[0-9']|\p{M})*/u;
const DIGIT = /\p{Nd}/u;
// Marks that end a sentence, and with it any text addressed to the system; a comma or a colon does not.
const SENTENCE_END = /[.!?؟؛;\n<>{}[\]"`]/;
// Marks that only end a clause.
const CLAUSE_END = /[,،:()«»\-–—/\\|*_=+~^%$#@&]/;

export type TokenKind = 'word' | 'number' | 'symbol';

export type Token = {
  readonly index: number;
  /** As typed, for showing the buyer their own words back. */
  readonly raw: string;
  /** Folded for matching: Persian letters, Latin digits, lower case, one word. A number is its plain decimal text. */
  readonly norm: string;
  readonly kind: TokenKind;
  /** Offsets in the cleaned text. */
  readonly start: number;
  readonly end: number;
  /** Nothing but a half-space or a letter-digit boundary separates it from the token before it. */
  readonly joined: boolean;
  /** 0 none, 1 a clause ends before it (comma, colon, bracket), 2 a sentence ends before it. */
  readonly breakBefore: 0 | 1 | 2;
};

export type CleanedQuery = {
  /** Cleaned and cut at a word boundary; what is shown back and what the model reads. */
  readonly text: string;
  readonly tokens: readonly Token[];
  /** More than MAX_UNDERSTOOD_CHARACTERS were typed: only the first words were read. */
  readonly cut: boolean;
  /** Tag characters were present: a hidden message, dropped. */
  readonly hidden: boolean;
};

const FOLD = new Map<string, string>([
  [char(0x064a), char(0x06cc)], // Arabic yeh
  [char(0x0649), char(0x06cc)], // alef maksura
  [char(0x0626), char(0x06cc)], // yeh with hamza: «کوئیک» is «کوییک»
  [char(0x0643), char(0x06a9)], // Arabic kaf
  [char(0x06c0), char(0x0647)], // heh with yeh above
  [char(0x0629), char(0x0647)], // teh marbuta
  [char(0x0623), char(0x0627)], // alef with hamza above
  [char(0x0625), char(0x0627)], // alef with hamza below
  [char(0x0671), char(0x0627)], // alef wasla
  [char(0x0622), char(0x0627)], // alef with madda
  [char(0x0624), char(0x0648)], // waw with hamza
]);
const REMOVED = /[ـً-ٰٟۖ-ۭ]/g; // tatweel and the vowel marks

/** One word folded for matching (see Token.norm); the zero-width non-joiner is a space. */
export function normaliseWord(word: string): string {
  let out = '';
  for (const letter of word.normalize('NFKC').replace(REMOVED, '').toLowerCase()) {
    if (letter === ZWNJ) {
      out += ' ';
      continue;
    }
    const code = letter.codePointAt(0) ?? 0;
    if (code >= 0x06f0 && code <= 0x06f9) out += String(code - 0x06f0);
    else if (code >= 0x0660 && code <= 0x0669) out += String(code - 0x0660);
    else if (LATIN.test(letter)) out += letter.normalize('NFD').replace(/\p{M}/gu, '');
    else out += FOLD.get(letter) ?? letter;
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** A phrase folded for matching: its words, folded, single-spaced. */
export function normalisePhrase(phrase: string): string {
  return tokenize(withoutInvisible(phrase))
    .map((token) => token.norm)
    .join(' ');
}

// A number as typed: thousands groups with a comma or an Arabic thousands separator (an Arabic comma needs two groups,
// or «۲۰۶،۲۰۷», two models, would read as one number), a decimal with a dot or an Arabic decimal separator, or the
// Persian slash between two single digits («۱/۵»).
const DECIMAL_SEPARATOR = '[.٫]';
const NUMBER_PATTERN = new RegExp(
  [
    `\\p{Nd}{1,3}(?:[,٬]\\p{Nd}{3})+(?:${DECIMAL_SEPARATOR}\\p{Nd}+)?(?!\\p{Nd})`,
    `\\p{Nd}{1,3}(?:،\\p{Nd}{3}){2,}(?:${DECIMAL_SEPARATOR}\\p{Nd}+)?(?!\\p{Nd})`,
    `\\p{Nd}{1,3}(?:\\.\\p{Nd}{3}){2,}(?!\\p{Nd})`,
    `\\p{Nd}+${DECIMAL_SEPARATOR}\\p{Nd}+`,
    `\\p{Nd}/\\p{Nd}(?!\\p{Nd})`,
    `\\p{Nd}+`,
  ].join('|'),
  'uy',
);

/** «۱٬۲۰۰٬۰۰۰», «١,٢٠٠», «۲٫۵» and «۱/۵» as plain decimal text: «1200000», «2.5», «1.5». */
function numberText(raw: string): string {
  const latin = normaliseWord(raw);
  if (/^\d{1,3}(?:\.\d{3}){2,}$/.test(latin)) return latin.replaceAll('.', '');
  if (/^\d/.test(latin) && /[,٬،]/.test(latin)) {
    const [whole = '', fraction] = latin.split(/[٫.]/);
    return `${whole.replace(/[,٬،]/g, '')}${fraction === undefined ? '' : `.${fraction}`}`;
  }
  return latin.replace('٫', '.').replace('/', '.');
}

/**
 * Tokens of an already cleaned text. Words of Arabic-script letters, Latin words (digits may follow letters: «207i»),
 * numbers with their separators; a half-space splits a word into two tokens that remember they were joined.
 */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let at = 0;
  let spaceBefore = true;
  let pendingBreak = 2 as 0 | 1 | 2;
  const push = (kind: TokenKind, start: number, end: number, norm: string) => {
    tokens.push({
      index: tokens.length,
      raw: text.slice(start, end),
      norm,
      kind,
      start,
      end,
      joined: !spaceBefore && pendingBreak === 0,
      breakBefore: pendingBreak,
    });
    spaceBefore = false;
    pendingBreak = 0;
  };
  while (at < text.length) {
    const rest = text.slice(at);
    const first = rest.codePointAt(0) ?? 0;
    const letter = String.fromCodePoint(first);
    const size = letter.length;
    if (letter === ZWNJ) {
      at += size;
      continue;
    }
    if (/\s/u.test(letter)) {
      spaceBefore = true;
      if (letter === '\n') pendingBreak = 2;
      at += size;
      continue;
    }
    if (DIGIT.test(letter)) {
      NUMBER_PATTERN.lastIndex = 0;
      const match = NUMBER_PATTERN.exec(rest);
      const raw = match?.[0] ?? letter;
      const after = rest.slice(raw.length);
      // Digits run into Latin letters («207i», «206sd») stay one Latin word.
      const run = LATIN_WORD.exec(after);
      // A unit written right after the digits is its own word («2000cc», «80km», «1.6l» are a number and a unit).
      const unitAfter = run !== null && /^(?:cc|km|l|lit|litre|liter)$/iu.test(run[0]);
      if (run !== null && !unitAfter && /^\p{Nd}+$/u.test(raw)) {
        const word = raw + run[0];
        push('word', at, at + word.length, normaliseWord(word));
        at += word.length;
      } else {
        push('number', at, at + raw.length, numberText(raw));
        at += raw.length;
      }
      continue;
    }
    if (LATIN.test(letter)) {
      const word = LATIN_WORD.exec(rest)?.[0] ?? letter;
      push('word', at, at + word.length, normaliseWord(word));
      at += word.length;
      continue;
    }
    if (ARABIC_LETTER.test(letter)) {
      const word = ARABIC_WORD.exec(rest)?.[0] ?? letter;
      const norm = normaliseWord(word);
      if (norm !== '') push('word', at, at + word.length, norm);
      at += word.length;
      continue;
    }
    // Punctuation and symbols: a break, never a token, except the hyphen that is a range between two numbers.
    if (
      (letter === '-' || letter === '–' || letter === '—') &&
      tokens.at(-1)?.kind === 'number' &&
      pendingBreak === 0
    ) {
      const next = text.slice(at + size).trimStart();
      if (next !== '' && DIGIT.test(String.fromCodePoint(next.codePointAt(0) ?? 0))) {
        push('symbol', at, at + size, 'تا');
        at += size;
        continue;
      }
    }
    if (SENTENCE_END.test(letter)) pendingBreak = 2;
    else if (CLAUSE_END.test(letter) && pendingBreak === 0) pendingBreak = 1;
    spaceBefore = true;
    at += size;
  }
  return tokens;
}

/** A query as the buyer typed it, cleaned, cut and tokenised. */
export function cleanQuery(typed: string): CleanedQuery {
  const hidden = hasHiddenCharacters(typed);
  let text = withoutInvisible(typed);
  let cut = false;
  const letters = Array.from(text);
  if (letters.length > MAX_UNDERSTOOD_CHARACTERS) {
    cut = true;
    const head = letters.slice(0, MAX_UNDERSTOOD_CHARACTERS).join('');
    // Never in the middle of a word: back to the last space unless there is none.
    const space = Math.max(head.lastIndexOf(' '), head.lastIndexOf('\n'));
    text = (space > 0 ? head.slice(0, space) : head).trimEnd();
  }
  return { text, tokens: tokenize(text), cut, hidden };
}

/** The tokens' normalised words as one phrase: «پراید 131». */
export function phraseOf(tokens: readonly Token[], from: number, to: number): string {
  return tokens
    .slice(from, to)
    .map((token) => token.norm)
    .join(' ');
}

/** What the buyer typed for tokens [from, to): the cleaned text between their first and last character. */
export function wordsOf(text: string, tokens: readonly Token[], from: number, to: number): string {
  const first = tokens[from];
  const last = tokens[to - 1];
  return first === undefined || last === undefined ? '' : text.slice(first.start, last.end);
}

/**
 * Where a phrase (the model's evidence) stands in the tokens, as whole words: the first token index of each
 * occurrence, compared on folded words so spacing, half-spaces, digit scripts and Arabic letters do not matter.
 */
export function findPhrase(tokens: readonly Token[], phrase: string): { from: number; to: number }[] {
  const wanted = tokenize(withoutInvisible(phrase)).map((token) => token.norm);
  if (wanted.length === 0 || wanted.every((word) => word === '')) return [];
  const found: { from: number; to: number }[] = [];
  for (let from = 0; from + wanted.length <= tokens.length; from += 1) {
    if (wanted.every((word, offset) => tokens[from + offset]?.norm === word)) {
      found.push({ from, to: from + wanted.length });
    }
  }
  return found;
}

/**
 * Long digit runs masked, for the copy a model reads: a phone number or an identity number a buyer pasted never
 * reaches a prompt, a cache row or a log (no personal data in prompts). A number code has claimed as a price is passed
 * in `keep`; the rest of the words are as they were.
 */
export function maskedWords(
  text: string,
  tokens: readonly Token[],
  keep: ReadonlySet<number> = new Set(),
): string {
  let out = '';
  let at = 0;
  for (const token of tokens) {
    if (token.kind !== 'number' || keep.has(token.index)) continue;
    if (token.norm.replace('.', '').length < 10) continue;
    out += `${text.slice(at, token.start)}#`;
    at = token.end;
  }
  return out + text.slice(at);
}
