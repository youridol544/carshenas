'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { FilterPanel, type FilterPanelData } from '@/features/search/components/filter-panel';
import { useSearchNavigation } from '@/features/search/components/search-navigation';
import { SEARCH_COPY } from '@/features/search/search-copy';
import { useIsDesktop } from '@/features/search/use-viewport';

// The filters on a desktop: a rail at the inline start of the results (teardown pattern 22: Autolist's and CarGurus's
// rail). It never scrolls inside itself (owner, 2026-10-04): its lists grow in place, the page scrolls, and the rail
// stays in view beside the results only while the whole of it fits the window, because a taller one pinned to the top
// would cut off its lower part with no way to reach it. Each change applies at once, so the results beside it answer the
// click; the checkbox is already checked from the optimistic search while they are on their way. On a phone it is not
// there at all (display: none removes it from the tab order and the accessibility tree): the sheet is the same panel.

/** The gap the pinned rail keeps from the top of the window (top-4), and so from its bottom too. */
const PIN_GAP = 16;

export function FilterRail({ facets, sourceCount, chosenLabels }: FilterPanelData) {
  const { search, navigate } = useSearchNavigation();
  const headingId = useId();
  const applied = Object.keys(search.filters).length;
  const desktop = useIsDesktop();
  // Focus inside the rail when the window narrows past the desktop layout: the rail goes, and focus goes to the button
  // that opens the same panel as a sheet, never to the top of the page.
  const lastFocused = useRef<Element | null>(null);
  const rail = useRef<HTMLElement>(null);
  // Pinned only while the whole rail fits the window; measured, because its height changes as its lists grow.
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    const element = rail.current;
    if (element === null) return;
    const measure = () => {
      setPinned(element.offsetHeight + 2 * PIN_GAP <= window.innerHeight);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [desktop]);
  // The rail's last focused control: narrowing blurs it (the CSS hides the rail) a moment before React removes it, so
  // the blur cannot tell a removal from a person moving on. Focus moving to another control clears it; a removed
  // control that was the last to hold focus, with focus on the page's top, sends focus on to the sheet's button.
  useEffect(() => {
    const element = rail.current;
    if (element === null) return;
    const entered = (event: FocusEvent) => {
      lastFocused.current = event.target instanceof Element ? event.target : null;
    };
    const left = (event: FocusEvent) => {
      if (event.relatedTarget !== null) lastFocused.current = null;
    };
    element.addEventListener('focusin', entered);
    element.addEventListener('focusout', left);
    return () => {
      element.removeEventListener('focusin', entered);
      element.removeEventListener('focusout', left);
    };
  }, [desktop]);
  useLayoutEffect(() => {
    const was = lastFocused.current;
    if (desktop !== false || was === null || was.isConnected) return;
    lastFocused.current = null;
    // The sheet's button is mounted by the same render but registered a frame later: ask again then.
    const toTrigger = () => {
      if (document.activeElement !== null && document.activeElement !== document.body) return;
      document.querySelector<HTMLElement>('[data-filter-trigger]')?.focus({ preventScroll: true });
    };
    toTrigger();
    requestAnimationFrame(toTrigger);
  }, [desktop]);
  // On a phone the sheet is the panel: mounting this one too would double every label and info control.
  if (desktop === false) return null;
  return (
    <aside
      aria-labelledby={headingId}
      ref={rail}
      className={`hidden flex-col gap-4 lg:flex ${pinned ? 'sticky top-4' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id={headingId} tabIndex={-1} data-rail-landing className="text-heading font-bold">
          {SEARCH_COPY.panel.label}
        </h2>
        {applied === 0 ? null : (
          <button
            type="button"
            onClick={() => {
              navigate({ ...search, filters: {} });
            }}
            className="inline-flex min-h-11 items-center rounded-control px-2 text-control text-link underline"
          >
            {SEARCH_COPY.controls.clearFilters}
          </button>
        )}
      </div>
      <FilterPanel
        filters={search.filters}
        onChange={(filters) => {
          navigate({ ...search, filters });
        }}
        facets={facets}
        sourceCount={sourceCount}
        labels={chosenLabels}
      />
    </aside>
  );
}
