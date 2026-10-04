'use client';

import { Plus } from 'lucide-react';
import { actionClasses } from '@/components/ui/action-link';
import { Icon } from '@/components/ui/icon';
import { RefineReading } from '@/features/search/components/refine-reading';
import { useSearchNavigation } from '@/features/search/components/search-navigation';
import { SEARCH_COPY } from '@/features/search/search-copy';
import { isolatedWords } from '@/lib/isolated-words';
import type { SentenceView } from '@/lib/search-sentence';

// What the page says about the sentence the buyer wrote, beside the filters it became (CS-111, S04): quiet lines, never a
// step. A note says what the code did with a word it could not use (a typo read, a city the index does not cover, a make
// that is not collected, a number no car has). The words that would have left the results empty are said as left out,
// each with one tap to put it back; with no results at all the no-results panel speaks instead, and these stay silent.
// A suggestion is a reading a model was not sure of: not applied, one tap to add. While a model reads the rest of the
// sentence in the background, one quiet line says so. All of it comes from the server as data; nothing here reads the
// sentence again.

export function SentenceNotes({
  view,
  sentence,
  empty,
}: {
  view: SentenceView;
  /** The sentence the address keeps; the model's background reading needs it. */
  sentence: string | undefined;
  /** The search found nothing: the no-results panel names what to take off. */
  empty: boolean;
}) {
  const { navigate } = useSearchNavigation();
  const COPY = SEARCH_COPY.sentence;
  const dropped = empty ? [] : view.dropped;
  const refine = view.refine && sentence !== undefined;
  if (view.notes.length === 0 && dropped.length === 0 && view.suggestions.length === 0 && !refine)
    return null;
  return (
    <section aria-label={COPY.label} className="flex flex-col gap-2">
      {view.notes.map((note) => (
        <p key={note} className="text-secondary text-pretty text-muted">
          {note}
        </p>
      ))}
      {dropped.map((one) => (
        <p
          key={one.words}
          role="status"
          className="flex flex-wrap items-center gap-x-2 text-secondary text-pretty text-muted"
        >
          <span>{isolatedWords(COPY.dropped(one.words), one.words)}</span>
          <button
            type="button"
            aria-label={COPY.putBackName(one.words)}
            onClick={() => {
              navigate(one.put);
            }}
            className={actionClasses('tertiary')}
          >
            {COPY.putBack}
          </button>
        </p>
      ))}
      {view.suggestions.length === 0 ? null : (
        <div className="flex flex-col gap-2">
          <p className="text-label font-medium text-default">{COPY.suggestions}</p>
          <ul className="flex flex-wrap gap-2">
            {view.suggestions.map((suggestion) => (
              <li key={suggestion.key}>
                <button
                  type="button"
                  aria-label={COPY.add(suggestion.text)}
                  onClick={() => {
                    navigate(suggestion.add);
                  }}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-dashed border-control bg-canvas ps-3 pe-4 text-label font-medium text-default transition-colors hover:bg-surface-hover"
                >
                  <Icon icon={Plus} size={16} />
                  {suggestion.text}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {refine ? <RefineReading sentence={sentence} /> : null}
    </section>
  );
}
