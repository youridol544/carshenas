'use client';

import { SearchX } from 'lucide-react';
import { actionClasses } from '@/components/ui/action-link';
import { Icon } from '@/components/ui/icon';
import { useSearchNavigation } from '@/features/search/components/search-navigation';
import { SEARCH_COPY } from '@/features/search/search-copy';
import type { SearchTotal } from '@/features/search/search-types';
import type { Search } from '@carshenas/search/search';

// No results is never a dead end (listing-patterns.md, Baymard): the filters stay as chips above, the list is replaced
// by this, and it names the filters whose removal would bring results back, each with how many listings it would
// show, counted by the database for this very search (relax-queries.ts). The best one is the solid action; the others
// and «clear everything» are quiet. Each is a button that changes the search through the same navigation as the chips
// (search-navigation.tsx), so the line over the results runs and focus lands on the new count when the button is gone.

export type Relaxation = {
  readonly key: string;
  /** What is removed: the chip's text, or the search words. */
  readonly text: string;
  /** The search without it. */
  readonly without: Search;
  readonly total: SearchTotal;
};

type NoResultsProps = {
  relaxations: readonly Relaxation[];
  /** The search with no filter, words and order kept; null when only words were searched. */
  clear: Search | null;
  /** Only words were searched: no filter to suggest removing. */
  wordsOnly: boolean;
};

export function NoResults({ relaxations, clear, wordsOnly }: NoResultsProps) {
  const { navigate } = useSearchNavigation();
  const [best, ...others] = relaxations;
  return (
    <section className="flex flex-col items-start gap-3 rounded-card bg-surface-muted p-6">
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-surface-pressed text-muted">
        <Icon icon={SearchX} size={24} />
      </span>
      <h2 className="text-heading font-bold text-balance">{SEARCH_COPY.noResults.title}</h2>
      {wordsOnly ? (
        <p className="text-body text-pretty text-muted">{SEARCH_COPY.noResults.onlyWords}</p>
      ) : best === undefined ? null : (
        <p className="text-body text-pretty text-muted">{SEARCH_COPY.noResults.lead}</p>
      )}
      {best === undefined ? null : (
        <ul className="flex w-full flex-col items-start gap-1">
          <li className="w-full">
            <button
              type="button"
              onClick={() => {
                navigate(best.without);
              }}
              className={`${actionClasses('primary')} h-auto min-h-12 w-full flex-wrap justify-between gap-x-3 gap-y-1 py-2 text-start lg:w-auto`}
            >
              <span>{SEARCH_COPY.noResults.remove(best.text)}</span>
              {/* A space the flex layout ignores and the accessible name keeps: «برداشتن «…» ۴۲ آگهی». */}{' '}
              <span className="font-normal">
                {SEARCH_COPY.noResults.count(best.total.count, best.total.exact)}
              </span>
            </button>
          </li>
          {others.map((other) => (
            <li key={other.key}>
              <button
                type="button"
                onClick={() => {
                  navigate(other.without);
                }}
                className={actionClasses('tertiary')}
              >
                {SEARCH_COPY.noResults.remove(other.text)}
                {` · ${SEARCH_COPY.noResults.count(other.total.count, other.total.exact)}`}
              </button>
            </li>
          ))}
        </ul>
      )}
      {clear === null ? null : (
        <button
          type="button"
          onClick={() => {
            navigate(clear, { keepSentence: false });
          }}
          className={actionClasses('tertiary')}
        >
          {SEARCH_COPY.noResults.clearAll}
        </button>
      )}
    </section>
  );
}
