'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { createContext, use, useEffect, useOptimistic, useRef, useTransition, type ReactNode } from 'react';
import { focusSurvived } from '@/components/layout/navigation-focus';
import { searchHref, type Search } from '@carshenas/search/search';

// The search page's one way to change the search: the address (ADR-0027: the URL holds the whole search, so Back, a
// shared link and a reload all agree). `navigate` pushes the new address inside a transition, so the old results stay
// on screen, readable, under a line that runs along them, until the new ones arrive (ui-design craft.md, section 3), and the controls
// answer at once from the optimistic search: a chosen checkbox is checked on the tap, not when the server answers.
// While a navigation is on its way the wrapper carries `data-pending`, which the line over the results shows itself from
// (group-data-pending/search), so no control passes an isLoading prop down. The old results are not dimmed: dimmed text
// falls under 4.5:1, and a list that is being replaced must stay readable.
//
// Focus: a control that asks for a change may be gone when the answer comes (a chip that removed itself, «clear all»,
// a suggestion taken), and focus would fall back to the top of the page, where a keyboard or screen-reader user starts
// again (WCAG 2.4.3). When the answer is in and focus did not survive, it goes to the count of the new results
// (`data-results-count`), which says what the change did; focus that survived is left where it is.

type SearchNavigation = {
  /** The search the controls show: the applied one, or the one just asked for while its results are on the way. */
  readonly search: Search;
  readonly pending: boolean;
  readonly navigate: (next: Search) => void;
};

const SearchNavigationContext = createContext<SearchNavigation | null>(null);

export function useSearchNavigation(): SearchNavigation {
  const value = use(SearchNavigationContext);
  if (value === null) throw new Error('useSearchNavigation is used outside SearchNavigationProvider');
  return value;
}

// A catalogue named with nothing beside it IS that catalogue (ADR-0027: search.ts canonical()), so a search that began
// on a catalogue and now has no filter, no words and no order would reopen it. A buyer who removed the last filter wants
// no filters: the catalogue mark goes with them. Everything else keeps its mark (the address still says where it began).
function settled(search: Search): Search {
  const bare =
    Object.keys(search.filters).length === 0 && search.q === undefined && search.sort === undefined;
  if (search.catalogue === undefined || !bare) return search;
  const { catalogue: _catalogue, ...rest } = search;
  return rest;
}

type ProviderProps = {
  /** The search the server rendered the results of. */
  search: Search;
  className?: string;
  children: ReactNode;
};

export function SearchNavigationProvider({ search, className, children }: ProviderProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(search);
  const wrapper = useRef<HTMLDivElement>(null);
  // A change this provider started is on its way (or just arrived and has not been checked for focus yet).
  const asked = useRef(false);

  function navigate(requested: Search) {
    const next = settled(requested);
    const href = searchHref(next) as Route;
    asked.current = true;
    startTransition(() => {
      setShown(next);
      router.push(href, { scroll: false });
    });
  }

  useEffect(() => {
    if (pending || !asked.current) return;
    asked.current = false;
    if (focusSurvived()) return;
    wrapper.current?.querySelector<HTMLElement>('[data-results-count]')?.focus({ preventScroll: true });
  }, [pending]);

  return (
    <SearchNavigationContext value={{ search: shown, pending, navigate }}>
      <div
        ref={wrapper}
        data-pending={pending ? '' : undefined}
        className={`group/search ${className ?? ''}`}
      >
        {children}
      </div>
    </SearchNavigationContext>
  );
}
