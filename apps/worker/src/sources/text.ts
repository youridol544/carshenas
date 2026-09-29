// What a Farsi page writes, made comparable: Persian and Arabic-Indic digits read as Latin ones, and the invisible
// direction marks sites put around numbers left out (Divar's detail price starts with a right-to-left mark; CS-2).
// Invisible characters are built from their code points here, never typed, so none hides in the source.

function characters(...codePoints: readonly number[]): string {
  return String.fromCodePoint(...codePoints);
}

function between(from: number, to: number): string {
  return `${characters(from)}-${characters(to)}`;
}

const PERSIAN_ZERO = 0x06f0;
const ARABIC_INDIC_ZERO = 0x0660;
const NON_LATIN_DIGIT = new RegExp(`[${between(0x06f0, 0x06f9)}${between(0x0660, 0x0669)}]`, 'g');

// The left-to-right and right-to-left marks, the Arabic letter mark, embeddings, overrides and isolates: they change
// how text is laid out, never what it says.
const BIDI_CONTROL = new RegExp(
  `[${characters(0x200e, 0x200f, 0x061c)}${between(0x202a, 0x202e)}${between(0x2066, 0x2069)}]`,
  'g',
);

/** The no-break space, the zero-width non-joiner and the narrow no-break space: they sit between digits in phone numbers. */
export const INVISIBLE_SEPARATORS = characters(0x00a0, 0x200c, 0x202f);

/** Persian (۰–۹) and Arabic-Indic (٠–٩) digits as Latin digits; everything else unchanged. */
export function latinDigits(text: string): string {
  return text.replace(NON_LATIN_DIGIT, (digit) => {
    const code = digit.codePointAt(0) ?? PERSIAN_ZERO;
    return String(code - (code >= PERSIAN_ZERO ? PERSIAN_ZERO : ARABIC_INDIC_ZERO));
  });
}

/** The text without direction marks, embeddings and isolates. */
export function withoutBidiControls(text: string): string {
  return text.replace(BIDI_CONTROL, '');
}

/** Arabic yeh and kaf as their Persian letters, so «دي» and «دی» name the same month. */
export function persianLetters(text: string): string {
  return text.replaceAll('ي', 'ی').replaceAll('ى', 'ی').replaceAll('ك', 'ک');
}
