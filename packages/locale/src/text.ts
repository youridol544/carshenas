// Farsi text as it is read, not shown: the invisible direction marks sites put around numbers left out (Divar's price
// starts with a right-to-left mark; CS-2), and the Arabic letters some keyboards type read as their Persian twins, so
// «دي» and «دی» are one word. Showing text is the web app's (apps/web/src/lib/bidi.ts isolates it); this only reads.
// Invisible characters are built from their code points here, never typed, so none hides in the source.

function characters(...codePoints: readonly number[]): string {
  return String.fromCodePoint(...codePoints);
}

function between(from: number, to: number): string {
  return `${characters(from)}-${characters(to)}`;
}

// The left-to-right and right-to-left marks, the Arabic letter mark, embeddings, overrides and isolates: they change
// how text is laid out, never what it says.
const BIDI_CONTROL = new RegExp(
  `[${characters(0x200e, 0x200f, 0x061c)}${between(0x202a, 0x202e)}${between(0x2066, 0x2069)}]`,
  'g',
);

/** The text without direction marks, embeddings and isolates. */
export function withoutBidiControls(text: string): string {
  return text.replace(BIDI_CONTROL, '');
}

/** Arabic yeh (ي, and alef maksura ى) and kaf (ك) as the Persian ی and ک. */
export function withPersianLetters(text: string): string {
  return text.replaceAll('ي', 'ی').replaceAll('ى', 'ی').replaceAll('ك', 'ک');
}
