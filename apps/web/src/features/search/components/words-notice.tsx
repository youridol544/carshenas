import { SEARCH_COPY } from '@/features/search/search-copy';
import type { SearchText } from '@/features/search/search-types';

// What the search did with the words typed (CS-59): a word no listing has may be replaced by a close, common one, and
// the page says so («نتیجه‌ها برای «…» است»), and a word that matched nothing and had no replacement is named, so a typo
// never looks like an empty market. Words that were only punctuation are named by the ignored-parameters notice.

export function WordsNotice({ text, empty = false }: { text: SearchText | null; empty?: boolean }) {
  if (!text?.searchable) return null;
  const lines = [
    ...text.corrections.map((c) => SEARCH_COPY.words.corrected(c.from, c.to)),
    // With no results the no-results panel already says the words found nothing: one message, not two.
    ...(empty ? [] : text.unknown.map((word) => SEARCH_COPY.words.unknown(word))),
  ];
  if (lines.length === 0) return null;
  return (
    <p role="status" className="text-secondary text-pretty text-muted">
      {lines.join(' ')}
    </p>
  );
}
