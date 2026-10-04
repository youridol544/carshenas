'use client';

import { Search, X } from 'lucide-react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useId, useRef, useState } from 'react';
import { actionClasses } from '@/components/ui/action-link';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import { useSearchNavigation } from '@/features/search/components/search-navigation';
import { SEARCH_COPY } from '@/features/search/search-copy';
import { canonicalDivarAddress, readPastedLink } from '@/lib/pasted-link';
import { MAX_SENTENCE_CHARACTERS, tidySentence } from '@/lib/search-sentence';
import { useSentenceForm, type AskAction } from '@/lib/use-sentence-form';

// The search box, the one place a buyer says what they want (CS-111, ADR-0043): a sentence, or a word, or the link of a
// listing. Enter or the one button sends it to the server through the action the route gives (`ask`), which reads it
// by code and answers with the address of the results: the filters it meant applied and shown as chips below, with
// nothing to confirm. It is a real search form (type="search" in a role="search" form, enterKeyHint, text of 16 px so a
// phone never zooms) whose action works before the script has loaded. The box shows the sentence the address keeps
// (or, for an address made by hand or an old link, the words it searches), and a draft survives every change that is
// not to the sentence: state is adjusted while rendering, never by remounting the input, so a key press or a clear
// never loses the focus it is in. A pasted Divar link is sent to its rating at once, and a typed or pasted address of
// any kind turns the button into «ارزیابی لینک» (the answer page names what is wrong with a link that is not a Divar
// listing's), so a buyer never has to find a second box. A search never contains an address.

function touchScreen(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
}

export function SearchField({ ask }: { ask: AskAction }) {
  const { search, sentence, navigate, go, pending: navigating } = useSearchNavigation();
  const router = useRouter();
  const applied = sentence ?? search.q ?? '';
  const [text, setText] = useState(applied);
  const [seen, setSeen] = useState(applied);
  const input = useRef<HTMLInputElement>(null);
  const {
    action,
    pending: asking,
    failure,
    submit,
  } = useSentenceForm(ask, (href) => {
    // On a phone the keyboard goes with the box, so the results are not under it; focus lands on their count (the
    // navigation does that when focus did not survive). With a keyboard of its own the box keeps focus, to edit the sentence.
    if (touchScreen()) input.current?.blur();
    go(href);
  });
  const pending = asking || navigating;

  // The applied sentence changed from outside the box (Back, a new search): it shows it.
  if (seen !== applied) {
    setSeen(applied);
    setText(applied);
  }

  const reading = readPastedLink(text);
  const isLink =
    reading.kind === 'divar_listing' || reading.kind === 'other_site' || reading.kind === 'divar_other';
  // A failure is shown for the sentence it was about: typing again clears it.
  const failed = failure !== null && failure.sentence === tidySentence(text) ? failure.message : null;
  const failedId = useId();

  /** Sends an address to the answer page, in its canonical form when it is a Divar listing's. */
  function check(value: string) {
    const link = readPastedLink(value);
    const address = link.kind === 'divar_listing' ? canonicalDivarAddress(link) : value.trim();
    router.push(`/check?link=${encodeURIComponent(address)}` as Route);
  }

  return (
    <form
      role="search"
      action={action}
      data-pending={pending ? '' : undefined}
      onSubmit={(event) => {
        if (pending) {
          event.preventDefault();
          return;
        }
        if (isLink) {
          event.preventDefault();
          check(text);
          return;
        }
        if (text.trim() === '') {
          // Nothing to read: the filters stay, and the sentence the address kept is let go.
          event.preventDefault();
          if (sentence !== undefined) navigate(search, { keepSentence: false, replace: true });
          return;
        }
        submit(event);
      }}
      className="group flex flex-wrap gap-2"
    >
      <div className="relative flex min-w-0 flex-1 basis-40 items-center">
        <span aria-hidden="true" className="pointer-events-none absolute inset-s-3 inline-flex text-muted">
          <Icon icon={Search} />
        </span>
        <input
          ref={input}
          aria-label={SEARCH_COPY.bar.label}
          aria-describedby={failed === null ? undefined : failedId}
          type="search"
          name="ask"
          value={text}
          onChange={(event) => {
            setText(event.currentTarget.value);
          }}
          maxLength={MAX_SENTENCE_CHARACTERS}
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
              if (sentence !== undefined) navigate(search, { keepSentence: false, replace: true });
            }}
            className="absolute inset-e-1 inline-flex size-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-hover"
          >
            <Icon icon={X} />
          </button>
        )}
      </div>
      <button type="submit" aria-disabled={pending} className={`${actionClasses('primary')} gap-2`}>
        {isLink ? SEARCH_COPY.bar.checkLink : SEARCH_COPY.bar.submit}
        <Spinner />
      </button>
      {isLink ? (
        <p role="status" className="basis-full text-secondary text-pretty text-muted">
          {SEARCH_COPY.bar.linkHint}
        </p>
      ) : null}
      {failed === null ? null : (
        <p id={failedId} role="alert" className="basis-full text-secondary text-pretty text-danger">
          {failed}
        </p>
      )}
    </form>
  );
}
