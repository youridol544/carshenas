'use client';

import { useId } from 'react';
import { FilterPanel, type FilterPanelData } from '@/features/search/components/filter-panel';
import { useSearchNavigation } from '@/features/search/components/search-navigation';
import { SEARCH_COPY } from '@/features/search/search-copy';
import { useIsDesktop } from '@/features/search/use-viewport';

// The filters on a desktop: a rail at the inline start of the results (teardown pattern 22: Autolist's and CarGurus's
// rail), which stays in view while the results scroll and scrolls inside itself when it is taller than the window. Each
// change applies at once, so the results beside it answer the click; the checkbox is already checked from the optimistic
// search while they are on their way. On a phone it is not there at all (display: none removes it from the tab order and
// the accessibility tree): the sheet is the same panel.

export function FilterRail({ facets, sourceCount, chosenLabels }: FilterPanelData) {
  const { search, navigate } = useSearchNavigation();
  const headingId = useId();
  const applied = Object.keys(search.filters).length;
  // On a phone the sheet is the panel: mounting this one too would double every label and info control.
  if (useIsDesktop() === false) return null;
  return (
    <aside
      aria-labelledby={headingId}
      className="sticky top-4 hidden max-h-[calc(100dvh-2rem)] flex-col gap-4 overflow-y-auto overscroll-contain lg:flex"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id={headingId} className="text-heading font-bold">
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
