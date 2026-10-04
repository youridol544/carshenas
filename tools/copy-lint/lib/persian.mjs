// Persian text helpers shared by the extractor, the rules and the tests.
//
// Invisible characters are built from code points here and never typed: an escape typed into a tool input can reach
// the file as the invisible character itself (AGENTS.md, Gotchas), and a zero-width joiner nobody can see is how a
// half-space rule goes wrong. Test samples write a half-space as «~» and a no-break space as «_» (test/samples.mjs).

export const ZWNJ = String.fromCodePoint(0x200c);
export const NBSP = String.fromCodePoint(0x00a0);
/** Stands for a `${...}` hole of a template literal, or an expression among JSX text, in the text a rule reads. */
export const PLACEHOLDER = String.fromCodePoint(0xe000);

/** One letter of the Arabic script (Persian letters and the Arabic ones): not a digit, not punctuation like «،». */
export const PERSIAN_LETTER = /[\p{Script=Arabic}&&\p{L}]/v;
const PERSIAN_RUN = /[\p{Script=Arabic}&&\p{L}]{2,}/v;
const LATIN_WORD = /(?<![A-Za-z0-9_])[A-Za-z]{2,}(?![A-Za-z])/g;

/** The rule for «this string is Persian text»: two letters of the Arabic script in a row. */
export function hasPersianWord(text) {
  return PERSIAN_RUN.test(text);
}

export function latinWords(text) {
  return text.match(LATIN_WORD) ?? [];
}

/** Whitespace-separated tokens that carry at least one Persian letter. */
export function persianTokens(text) {
  return text.split(/\s+/).filter((token) => PERSIAN_LETTER.test(token));
}

/**
 * English prose that quotes a Persian word (a developer's note, a model instruction) is not copy: four or more Latin
 * words, and more of them than Persian ones.
 */
export function isEnglishProse(text) {
  const latin = latinWords(text).length;
  return latin >= 4 && latin > persianTokens(text).length;
}

/** Words as a reader counts them: a ZWNJ joins («می‌خواهید» is one), a hole counts as one, a lone dash counts as none. */
export function wordCount(text) {
  return text.split(/\s+/).filter((token) => token.includes(PLACEHOLDER) || /[\p{L}\p{N}]/u.test(token))
    .length;
}

/** Characters as a reader counts them: holes count one each and invisible joiners none. */
export function charCount(text) {
  return [...text.replaceAll(ZWNJ, '').trim()].length;
}

/** The text with its holes written as «{…}», for messages. */
export function display(text) {
  return text.replaceAll(PLACEHOLDER, '{…}');
}

/** A short piece of text around a match, for a report line. */
export function excerpt(text, index = 0, length = 0, width = 60) {
  const shown = display(text);
  if (shown.length <= width) return shown;
  const start = Math.max(0, Math.min(index - Math.floor((width - length) / 2), shown.length - width));
  const slice = shown.slice(start, start + width);
  return `${start > 0 ? '…' : ''}${slice}${start + width < shown.length ? '…' : ''}`;
}

const ENTITIES = { nbsp: NBSP, zwnj: ZWNJ, amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** JSX text may spell characters as entities (`&nbsp;`); a reader sees the character. */
export function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (whole, name) => {
    if (name.startsWith('#x')) return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
    if (name.startsWith('#')) return String.fromCodePoint(Number.parseInt(name.slice(1), 10));
    return ENTITIES[name] ?? whole;
  });
}

/** JSX's own rule for text that spans lines: each line is trimmed, empty lines go, lines join with one space. */
export function collapseJsxText(raw) {
  if (!raw.includes('\n')) return raw;
  const lines = raw.split(/\r?\n/);
  return lines
    .map((line, index) => {
      let kept = line;
      if (index > 0) kept = kept.trimStart();
      if (index < lines.length - 1) kept = kept.trimEnd();
      return kept;
    })
    .filter((line) => line !== '')
    .join(' ');
}

/** Sentences of a string, split after «.», «؟», «?», «!» and «…» and at line ends. */
export function splitSentences(text) {
  return text
    .split(/(?<=[.؟?!…])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence !== '');
}

/**
 * A sentence reduced to what makes it the same sentence: invisible joiners and no-break spaces are spaces,
 * punctuation and case do not count. A different number is a different sentence.
 */
export function normalizeSentence(sentence) {
  return sentence
    .replaceAll(ZWNJ, ' ')
    .replaceAll(NBSP, ' ')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
