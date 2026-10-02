'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { createContext, use, useOptimistic, useTransition, type ReactNode } from 'react';
import { searchHref, type Search } from '@carshenas/search/search';

// The search page's one way to change the search: the address (ADR-0027: the URL holds the whole search, so Back, a
// shared link and a reload all agree). `navigate` pushes the new address inside a transition, so the old results stay
// on screen, readable, under a line that runs along them, until the new ones arrive (ui-design craft.md, section 3), and the controls
// answer at once from the optimistic search: a chosen checkbox is checked on the tap, not when the server answers.
// While a navigation is on its way the wrapper carries `data-pending`, which the line over the results shows itself from
// (group-data-pending/search), so no control passes an isLoading prop down. The old results are not dimmed: dimmed text
// falls under 4.5:1, and a list that is being replaced must stay readable.

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

  function navigate(requested: Search) {
    const next = settled(requested);
    const href = searchHref(next) as Route;
    startTransition(() => {
      setShown(next);
      router.push(href, { scroll: false });
    });
  }

  return (
    <SearchNavigationContext value={{ search: shown, pending, navigate }}>
      <div data-pending={pending ? '' : undefined} className={`group/search ${className ?? ''}`}>
        {children}
      </div>
    </SearchNavigationContext>
  );
}
