'use client';

import { Search, X } from 'lucide-react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { actionClasses } from '@/components/ui/action-link';
import { Icon } from '@/components/ui/icon';
import { useSearchNavigation } from '@/features/search/components/search-navigation';
import { SEARCH_COPY } from '@/features/search/search-copy';
import { canonicalDivarAddress, readPastedLink } from '@/lib/pasted-link';
import { MAX_QUERY_LENGTH } from '@carshenas/search/search';

// The search box: a real search form (type="search" in a role="search" form, enterKeyHint, text of 16 px so a phone never
// zooms), whose words go in the address as `q` beside the filters, so the buyer never has to choose between typing and
// filtering. The words are matched by CS-59's text search; plain-Farsi understanding (CS-62) shows what it understood in
// the slot under the box. Submitting keeps the filters and the order; an unchanged catalogue keeps its filters too.
// The one box also takes the link of a listing (CS-65): a pasted Divar link is sent to its rating at once, and a typed
// or pasted address of any kind turns the button into «ارزیابی لینک» (the answer page names what is wrong with a link that
// is not a Divar listing's), so a buyer never has to find a second box. A search never contains an address.

export function SearchField() {
  const { search, navigate } = useSearchNavigation();
  const router = useRouter();
  const applied = search.q ?? '';
  const [text, setText] = useState(applied);
  const [seen, setSeen] = useState(applied);
  const input = useRef<HTMLInputElement>(null);

  // The applied words changed from outside the box (Back, a chip, a suggestion): it shows them. State is adjusted while
  // rendering, never by remounting the input, so a key press or a clear never loses the focus it is in.
  if (seen !== applied) {
    setSeen(applied);
    setText(applied);
  }

  const reading = readPastedLink(text);
  const isLink =
    reading.kind === 'divar_listing' || reading.kind === 'other_site' || reading.kind === 'divar_other';

  /** Sends an address to the answer page, in its canonical form when it is a Divar listing's. */
  function check(value: string) {
    const link = readPastedLink(value);
    const address = link.kind === 'divar_listing' ? canonicalDivarAddress(link) : value.trim();
    router.push(`/check?link=${encodeURIComponent(address)}` as Route);
  }

  function submit(words: string) {
    const trimmed = words.trim();
    navigate({ ...search, ...(trimmed === '' ? { q: undefined } : { q: trimmed }) });
  }

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        if (isLink) check(text);
        else submit(text);
      }}
      className="flex flex-wrap gap-2"
    >
      <div className="relative flex min-w-0 flex-1 basis-40 items-center">
        <span aria-hidden="true" className="pointer-events-none absolute inset-s-3 inline-flex text-muted">
          <Icon icon={Search} />
        </span>
        <input
          ref={input}
          aria-label={SEARCH_COPY.bar.label}
          type="search"
          name="q"
          value={text}
          onChange={(event) => {
            setText(event.currentTarget.value);
          }}
          maxLength={MAX_QUERY_LENGTH}
          onPaste={(event) => {
            const pasted = event.clipboardData.getData('text');
            if (readPastedLink(pasted).kind !== 'divar_listing') return;
            event.preventDefault();
            setText(pasted.trim());
            check(pasted);
          }}
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
              // The button goes with the words: focus stays in the box, ready for the next ones.
              input.current?.focus();
              if (search.q !== undefined) submit('');
            }}
            className="absolute inset-e-1 inline-flex size-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-hover"
          >
            <Icon icon={X} />
          </button>
        )}
      </div>
      <button type="submit" className={actionClasses('primary')}>
        {isLink ? SEARCH_COPY.bar.checkLink : SEARCH_COPY.bar.submit}
      </button>
      {isLink ? (
        <p role="status" className="basis-full text-secondary text-pretty text-muted">
          {SEARCH_COPY.bar.linkHint}
        </p>
      ) : null}
    </form>
  );
}
