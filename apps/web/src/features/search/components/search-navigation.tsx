'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import {
  createContext,
  use,
  useEffect,
  useLayoutEffect,
  useOptimistic,
  useRef,
  useTransition,
  type ReactNode,
} from 'react';
import { focusSurvived } from '@/components/layout/navigation-focus';
import { withSentence } from '@/lib/search-sentence';
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
//
// The sentence the buyer typed (CS-111) rides in the address beside the search, so a chip, a filter or the order that
// changes the search keeps it in the box; only the buyer's own «clear» lets go of it.

export type NavigateOptions = {
  /** False when the change starts a new search and the sentence no longer describes it (clearing the filters). */
  readonly keepSentence?: boolean;
  /** Replace the address instead of adding a step to the history: a change nobody needs Back to undo. */
  readonly replace?: boolean;
};

type SearchNavigation = {
  /** The search the controls show: the applied one, or the one just asked for while its results are on the way. */
  readonly search: Search;
  /** The sentence the address keeps, as typed; undefined when it has none. */
  readonly sentence: string | undefined;
  readonly pending: boolean;
  readonly navigate: (next: Search, options?: NavigateOptions) => void;
  /** To an address the server made (the one the box's sentence leads to): the same transition, the same line over the results. */
  readonly go: (href: string) => void;
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
  /** The sentence the address keeps beside it. */
  sentence?: string | undefined;
  className?: string;
  children: ReactNode;
};

export function SearchNavigationProvider({ search, sentence, className, children }: ProviderProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(search);
  const wrapper = useRef<HTMLDivElement>(null);
  // A change this provider started is on its way (or just arrived and has not been checked for focus yet).
  const asked = useRef(false);
  // The control that asked, to see whether the optimistic render removed it.
  const asker = useRef<Element | null>(null);

  function navigate(requested: Search, options: NavigateOptions = {}) {
    const next = settled(requested);
    const href = withSentence(
      searchHref(next),
      options.keepSentence === false ? undefined : sentence,
    ) as Route;
    asked.current = true;
    asker.current = document.activeElement;
    startTransition(() => {
      setShown(next);
      if (options.replace === true) router.replace(href, { scroll: false });
      else router.push(href, { scroll: false });
    });
  }

  function go(href: string) {
    asked.current = true;
    asker.current = document.activeElement;
    startTransition(() => {
      router.push(href as Route, { scroll: false });
    });
  }

  // A search that changed (a push from here, or Back and Forward) shows its results from their top: the list the buyer
  // was deep in is a different list now, and leaving them at scrollY 3000 of a new order lands them mid-list. Only a
  // reader who has scrolled past the top of the results is moved, and only by scrolling the window: scrollIntoView
  // would also move the keyboard's starting point (Chrome).
  const address = searchHref(search);
  const lastAddress = useRef(address);
  useEffect(() => {
    if (lastAddress.current === address) return;
    lastAddress.current = address;
    const top = wrapper.current?.querySelector<HTMLElement>('[data-results-top]');
    if (top === null || top === undefined) return;
    const sticky = wrapper.current?.querySelector<HTMLElement>('[data-sticky-row]');
    const stuck =
      sticky !== null && sticky !== undefined && sticky.offsetParent !== null ? sticky.offsetHeight : 0;
    const distance = top.getBoundingClientRect().top - stuck;
    if (distance < 0) window.scrollBy({ top: distance, behavior: 'instant' });
  }, [address]);

  // The optimistic search is shown at once, and it may remove the control that has focus (the last chip, «clear all»):
  // focus moves in the same commit, so it is never on the page's top, even for a moment.
  useLayoutEffect(() => {
    const was = asker.current;
    if (was === null || was.isConnected || focusSurvived()) return;
    asker.current = null;
    wrapper.current?.querySelector<HTMLElement>('[data-results-count]')?.focus({ preventScroll: true });
  }, [shown]);

  useEffect(() => {
    if (pending || !asked.current) return;
    asked.current = false;
    if (focusSurvived()) return;
    wrapper.current?.querySelector<HTMLElement>('[data-results-count]')?.focus({ preventScroll: true });
  }, [pending]);

  return (
    <SearchNavigationContext value={{ search: shown, sentence, pending, navigate, go }}>
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
