import { SearchX } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { actionClasses } from '@/components/ui/action-link';
import { Icon } from '@/components/ui/icon';
import { SEARCH_COPY } from '@/features/search/search-copy';
import type { SearchTotal } from '@/features/search/search-types';

// No results is never a dead end (listing-patterns.md, Baymard): the filters stay as chips above, the list is replaced
// by this, and it names the filters whose removal would bring results back, each with how many listings it would
// show, counted by the database for this very search (relax-queries.ts). The best one is the solid action; the others
// and «clear everything» are quiet links.

export type Relaxation = {
  readonly key: string;
  /** What is removed: the chip's text, or the search words. */
  readonly text: string;
  readonly href: string;
  readonly total: SearchTotal;
};

type NoResultsProps = {
  relaxations: readonly Relaxation[];
  clearHref: string | null;
  /** Only words were searched: no filter to suggest removing. */
  wordsOnly: boolean;
};

export function NoResults({ relaxations, clearHref, wordsOnly }: NoResultsProps) {
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
            <Link
              href={best.href as Route}
              className={`${actionClasses('primary')} w-full justify-between gap-3 lg:w-auto`}
            >
              <span>{SEARCH_COPY.noResults.remove(best.text)}</span>
              {/* A space the flex layout ignores and the accessible name keeps: «برداشتن «…» ۴۲ آگهی». */}{' '}
              <span className="font-normal">
                {SEARCH_COPY.noResults.count(best.total.count, best.total.exact)}
              </span>
            </Link>
          </li>
          {others.map((other) => (
            <li key={other.key}>
              <Link href={other.href as Route} className={actionClasses('tertiary')}>
                {SEARCH_COPY.noResults.remove(other.text)}
                {` · ${SEARCH_COPY.noResults.count(other.total.count, other.total.exact)}`}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {clearHref === null ? null : (
        <Link href={clearHref as Route} className={actionClasses('tertiary')}>
          {SEARCH_COPY.noResults.clearAll}
        </Link>
      )}
    </section>
  );
}
