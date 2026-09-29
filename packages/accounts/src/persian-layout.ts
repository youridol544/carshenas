// A Latin password typed while the keyboard is on Persian comes out in Persian letters: "password" becomes «حشسسصخقی».
// Mapping each letter back to the key it sits on (the Persian standard layout, ISIRI 9147, which Windows, macOS and
// Android's Persian keyboards share for these keys) lets the blocklist catch it too (ADR-0020 point 3). Only the
// unshifted letters are mapped; anything else is left as it is.

const KEY_OF_LETTER: Readonly<Record<string, string>> = {
  ض: 'q',
  ص: 'w',
  ث: 'e',
  ق: 'r',
  ف: 't',
  غ: 'y',
  ع: 'u',
  ه: 'i',
  خ: 'o',
  ح: 'p',
  ج: '[',
  چ: ']',
  ش: 'a',
  س: 's',
  ی: 'd',
  ب: 'f',
  ل: 'g',
  ا: 'h',
  ت: 'j',
  ن: 'k',
  م: 'l',
  ک: ';',
  گ: "'",
  ظ: 'z',
  ط: 'x',
  ز: 'c',
  ر: 'v',
  ذ: 'b',
  د: 'n',
  پ: 'm',
  // The older Windows "Persian" layout has «ئ» where the standard one has «پ».
  ئ: 'm',
  و: ',',
};

/** «حشسسصخقی» becomes "password"; Arabic ي and ك are expected to be Persian already (normalizePassword). */
export function fromPersianLayout(text: string): string {
  return Array.from(text, (character) => KEY_OF_LETTER[character] ?? character).join('');
}
