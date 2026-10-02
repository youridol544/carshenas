'use client';

import { Search, X } from 'lucide-react';
import { useState } from 'react';
import { actionClasses } from '@/components/ui/action-link';
import { Icon } from '@/components/ui/icon';
import { useSearchNavigation } from '@/features/search/components/search-navigation';
import { SEARCH_COPY } from '@/features/search/search-copy';
import { MAX_QUERY_LENGTH } from '@carshenas/search/search';

// The search box: a real search form (type="search" in a role="search" form, enterKeyHint, text of 16 px so a phone never
// zooms), whose words go in the address as `q` beside the filters, so the buyer never has to choose between typing and
// filtering. The words are matched by CS-59's text search; plain-Farsi understanding (CS-62) shows what it understood in
// the slot under the box. Submitting keeps the filters and the order; an unchanged catalogue keeps its filters too.

function SearchFieldForm({ initial }: { initial: string }) {
  const { search, navigate } = useSearchNavigation();
  const [text, setText] = useState(initial);

  function submit(words: string) {
    const trimmed = words.trim();
    navigate({ ...search, ...(trimmed === '' ? { q: undefined } : { q: trimmed }) });
  }

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        submit(text);
      }}
      className="flex flex-wrap gap-2"
    >
      <div className="relative flex min-w-0 flex-1 basis-40 items-center">
        <span aria-hidden="true" className="pointer-events-none absolute inset-s-3 inline-flex text-muted">
          <Icon icon={Search} />
        </span>
        <input
          aria-label={SEARCH_COPY.bar.label}
          type="search"
          name="q"
          value={text}
          onChange={(event) => {
            setText(event.currentTarget.value);
          }}
          maxLength={MAX_QUERY_LENGTH}
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder={SEARCH_COPY.bar.placeholder}
          className="min-h-12 w-full min-w-0 rounded-control border border-control bg-canvas ps-12 pe-12 text-control text-default placeholder:text-subtle [&::-webkit-search-cancel-button]:hidden"
        />
        {text === '' ? null : (
          <button
            type="button"
            aria-label={SEARCH_COPY.bar.clear}
            onClick={() => {
              setText('');
              if (search.q !== undefined) submit('');
            }}
            className="absolute inset-e-1 inline-flex size-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-hover"
          >
            <Icon icon={X} />
          </button>
        )}
      </div>
      <button type="submit" className={actionClasses('primary')}>
        {SEARCH_COPY.bar.submit}
      </button>
    </form>
  );
}

export function SearchField() {
  const { search } = useSearchNavigation();
  // Keyed by the applied words: a Back to another search, or a clear from elsewhere, shows its own words.
  return <SearchFieldForm key={search.q ?? ''} initial={search.q ?? ''} />;
}
