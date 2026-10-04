'use client';

import { useId, useState } from 'react';
import { actionClasses } from '@/components/ui/action-link';
import { FieldLabel, inputClasses } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { HOME_COPY } from '@/features/home/home-copy';
import { askSearchAction } from '@/features/search-understanding/search-understanding-actions';
import { MAX_SENTENCE_CHARACTERS, tidySentence } from '@/lib/search-sentence';
import { useSentenceForm } from '@/lib/use-sentence-form';

// The hero's search box (CS-63, CS-111): one box, one button, no second step. The buyer writes a sentence (or taps an
// example, which is the same as writing it and pressing the button) and lands on the search page with the filters it
// meant already applied and shown as chips they can take off (askSearchAction reads it by code on the server and
// answers with the address of the results and the page goes there; docs/specs/S04-plain-farsi-search.md). It is a real
// form whose action is a Server Action, so it works before the script has loaded and with none. What was typed stays
// in the box when the buyer comes back with the back button; the model behind the sentence is off unless the server's
// master switch is on, and nothing waits for it.
export function HeroSearch() {
  const COPY = HOME_COPY.hero;
  const ids = useId();
  const fieldId = `${ids}-field`;
  const failedId = `${ids}-failed`;
  const [typed, setTyped] = useState('');
  const { action, pending, failure, submit } = useSentenceForm(askSearchAction);
  // A failure is shown for the sentence it was about: typing again clears it.
  const failed = failure !== null && failure.sentence === tidySentence(typed) ? failure.message : null;
  return (
    <form
      role="search"
      action={action}
      data-pending={pending ? '' : undefined}
      onSubmit={submit}
      className="group flex flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor={fieldId}>{COPY.searchLabel}</FieldLabel>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id={fieldId}
            name="ask"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={MAX_SENTENCE_CHARACTERS}
            value={typed}
            onChange={(event) => {
              setTyped(event.currentTarget.value);
            }}
            aria-describedby={failed === null ? undefined : failedId}
            className={`${inputClasses} sm:flex-1`}
          />
          <button type="submit" aria-disabled={pending} className={`${actionClasses('primary')} gap-2`}>
            <span>{COPY.submit}</span>
            <Spinner />
          </button>
        </div>
        {failed === null ? null : (
          <p id={failedId} role="alert" className="text-secondary text-pretty text-danger">
            {failed}
          </p>
        )}
      </div>
      {/* Inside the form, after the button: Enter in the box presses the first submit button, which is the one above. */}
      <ul aria-label={COPY.examplesLabel} className="flex flex-wrap gap-2">
        {COPY.examples.map((example) => (
          <li key={example}>
            <button
              type="submit"
              name="example"
              value={example}
              onClick={() => {
                setTyped(example);
              }}
              className="inline-flex min-h-11 items-center rounded-full border border-divider bg-surface px-4 text-label font-medium text-default transition-colors hover:bg-surface-hover"
            >
              {example}
            </button>
          </li>
        ))}
      </ul>
    </form>
  );
}
