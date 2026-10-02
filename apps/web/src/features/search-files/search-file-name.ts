import { MAX_NAME_LENGTH } from '@/features/search-files/search-files-rules';

// The name a new file is offered (CS-70): what the buyer chose, in the words the chips use, so the list of files reads
// like the searches it holds («پژو ۲۰۶، تا ۷۰۰ میلیون تومان»). A catalogue as it is takes the catalogue's title. The
// buyer may change it before saving; it is never a model's text.

const SEPARATOR = '، ';

/**
 * The suggested name of a search from its described texts (`describeSearch`: a catalogue's title alone while unchanged,
 * else the words and the chips), joined and cut at a whole text when too long for a name. Never empty: a search with
 * nothing chosen is «جست‌وجوی خودرو».
 */
export function suggestFileName(texts: readonly string[]): string {
  const parts = texts.map((part) => part.replace(/\s+/g, ' ').trim()).filter((part) => part !== '');
  const kept: string[] = [];
  for (const part of parts) {
    const next = [...kept, part].join(SEPARATOR);
    if (next.length > MAX_NAME_LENGTH) break;
    kept.push(part);
  }
  if (kept.length > 0) return kept.join(SEPARATOR);
  // One part alone is longer than a name: its start, cut at a word.
  const [first] = parts;
  if (first === undefined) return 'جست‌وجوی خودرو';
  const cut = first.slice(0, MAX_NAME_LENGTH - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 1)).trim()}…`;
}

/** A name the buyer typed, as the database keeps it: whitespace collapsed and trimmed. */
export function cleanFileName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}
