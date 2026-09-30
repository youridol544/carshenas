// Text rules the bake-off tasks share (CS-46), after CS-43's pattern 17: the model reads a normalised copy of the
// text, and every check compares against that same copy. Persian yeh and kaf for the Arabic letters, Latin digits
// for the three digit scripts, the zero-width non-joiner kept, other zero-width and direction marks dropped, runs of
// spaces made one. CS-52 builds the product's normaliser; this one only has to be the same on both sides of a check.
// Every non-ASCII character here is built from its code point, so the source holds no invisible character.

const char = (code: number): string => String.fromCodePoint(code);
const range = (from: number, to: number): string => `${char(from)}-${char(to)}`;

const ARABIC_YEH = char(0x064a);
const ARABIC_ALEF_MAKSURA = char(0x0649);
const ARABIC_KAF = char(0x0643);
const PERSIAN_YEH = char(0x06cc);
const PERSIAN_KAF = char(0x06a9);
export const ZWNJ = char(0x200c);

/** Zero-width and direction marks other than the non-joiner: ZWSP, ZWJ, LRM, RLM, the embeddings, the isolates, BOM. */
const DROPPED = new Set(
  [
    0x200b, 0x200d, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069,
    0xfeff,
  ].map(char),
);

const DIGITS = new Map<string, string>();
for (let digit = 0; digit < 10; digit += 1) {
  DIGITS.set(char(0x06f0 + digit), String(digit));
  DIGITS.set(char(0x0660 + digit), String(digit));
}

export function normalise(text: string): string {
  let out = '';
  for (const letter of text) {
    if (DROPPED.has(letter)) continue;
    if (letter === ARABIC_YEH || letter === ARABIC_ALEF_MAKSURA) out += PERSIAN_YEH;
    else if (letter === ARABIC_KAF) out += PERSIAN_KAF;
    else out += DIGITS.get(letter) ?? letter;
  }
  return out
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Angle brackets become their look-alikes, so text read as data cannot open or close the prompt's own tags. */
export function asData(text: string): string {
  return text.replaceAll('<', char(0x2039)).replaceAll('>', char(0x203a));
}

/** Any digit in any of the three scripts. */
const ANY_DIGIT = new RegExp(`[0-9${range(0x06f0, 0x06f9)}${range(0x0660, 0x0669)}]`, 'u');

/** Anything that is not an Arabic-script letter or the non-joiner separates words. */
const NOT_A_WORD = new RegExp(`[^${range(0x0621, 0x06ff)}${ZWNJ}]+`, 'u');

/**
 * Persian number words that must not appear in a model's explanation outside a placeholder (CS-43, pattern 25). Whole
 * words only; «نه» is left out because it is also "no".
 */
const NUMBER_WORDS = [
  'یک',
  'دو',
  'سه',
  'چهار',
  'پنج',
  'شش',
  'هفت',
  'هشت',
  'ده',
  'یازده',
  'دوازده',
  'بیست',
  'سی',
  'چهل',
  'پنجاه',
  'شصت',
  'هفتاد',
  'هشتاد',
  'نود',
  'صد',
  'دویست',
  'سیصد',
  'پانصد',
  'هزار',
  'میلیون',
  'میلیارد',
  'نیم',
  'درصد',
];

/** What a sentence says outside its placeholders: the words a reader sees that the model wrote itself. */
export function outsidePlaceholders(sentence: string): string {
  return sentence.replace(/\{[a-z_]+\}/g, ' ');
}

export function hasDigit(text: string): boolean {
  return ANY_DIGIT.test(text);
}

/** The number words a text uses as whole words. */
export function numberWordsIn(text: string): string[] {
  const words = normalise(text).split(NOT_A_WORD);
  return NUMBER_WORDS.filter((word) => words.includes(word));
}
