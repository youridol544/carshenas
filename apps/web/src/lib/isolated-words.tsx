import type { ReactNode } from 'react';

// A text with the buyer's own words inside it set apart (`<bdi>`), so Latin words and digits typed into a right-to-left
// sentence keep their own direction and the quotation marks around them stay where the sentence puts them (ui-design
// rule 5, rtl-bidi.md). The text is one string from the copy files with the words in it once; the words are found in
// it, so the copy is never split in two to make room for them.

export function isolatedWords(text: string, words: string): ReactNode {
  const at = words === '' ? -1 : text.indexOf(words);
  if (at === -1) return text;
  return (
    <>
      {text.slice(0, at)}
      <bdi>{words}</bdi>
      {text.slice(at + words.length)}
    </>
  );
}
