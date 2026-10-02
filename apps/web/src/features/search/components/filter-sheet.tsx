'use client';

import { Drawer } from '@base-ui/react/drawer';
import { SlidersHorizontal, X } from 'lucide-react';
import { useLayoutEffect, useState } from 'react';
import { actionClasses } from '@/components/ui/action-link';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import { FilterPanel, type FilterPanelData } from '@/features/search/components/filter-panel';
import { useSearchNavigation } from '@/features/search/components/search-navigation';
import { SEARCH_COPY } from '@/features/search/search-copy';
import { useLiveCount } from '@/features/search/use-live-count';
import { formatCount } from '@carshenas/locale/format-number';
import { toSearchParams, type Search } from '@carshenas/search/search';

// The filters on a phone: a batch (listing-patterns.md, NN/g: "err on the side of batch filtering and include an Apply
// button"). A button next to the order opens a sheet from the bottom, with the same panel as the desktop's rail; what
// the buyer changes is a draft, and a bar that stays at the bottom says how many listings that draft would show, from
// the same SQL as the page, and applies it. Closing the sheet (the close button, Escape, a tap on the page behind it
// or a swipe down) throws the draft away. The sheet is a modal dialog (focus is kept inside it, the page behind is
// inert and does not scroll), built on Base UI's drawer, which gives the swipe, the focus and the keyboard.

function SheetContent({ data, onClose }: { data: FilterPanelData; onClose: () => void }) {
  const { search, navigate } = useSearchNavigation();
  const [draft, setDraft] = useState(search.filters);
  const draftSearch: Search = { ...search, filters: draft };
  const live = useLiveCount(toSearchParams(draftSearch).toString(), {
    query: toSearchParams(search).toString(),
    total: data.total,
    facets: data.facets,
  });
  const { total } = live.answer;
  const none = live.status === 'ready' && total.count === 0;
  const loading = live.status === 'loading';
  const countText = SEARCH_COPY.results.count(total.count, total.exact);

  return (
    <>
      <div className="relative flex shrink-0 items-center justify-between gap-2 border-b border-divider ps-4 pe-2 pt-6 pb-1">
        {/* the grab handle: decoration for the swipe the whole sheet answers to */}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-2 mx-auto h-1 w-10 rounded-full bg-surface-pressed"
        />
        <Drawer.Title className="text-heading font-bold">{SEARCH_COPY.sheet.title}</Drawer.Title>
        <Drawer.Close
          aria-label={SEARCH_COPY.controls.close}
          className="inline-flex size-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-hover"
        >
          <Icon icon={X} />
        </Drawer.Close>
      </div>
      <Drawer.Content className="min-h-0 flex-1 touch-auto overflow-y-auto overscroll-contain p-4">
        <FilterPanel
          filters={draft}
          onChange={setDraft}
          facets={live.answer.facets}
          sourceCount={data.sourceCount}
          labels={data.chosenLabels}
        />
      </Drawer.Content>
      <div className="flex shrink-0 flex-col gap-2 border-t border-divider bg-surface p-4 shadow-raised">
        <p role="status" className="min-h-lh text-secondary text-muted">
          {live.status === 'failed' ? SEARCH_COPY.sheet.countFailed : none ? SEARCH_COPY.sheet.noneHint : ''}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setDraft({});
            }}
            className={actionClasses('secondary')}
          >
            {SEARCH_COPY.controls.clearFilters}
          </button>
          <button
            type="button"
            aria-disabled={none}
            aria-busy={loading}
            data-pending={loading ? '' : undefined}
            onClick={() => {
              if (none) return;
              navigate(draftSearch);
              onClose();
            }}
            className={`group relative min-w-0 flex-1 ${actionClasses('primary')}`}
          >
            {none ? SEARCH_COPY.sheet.none : SEARCH_COPY.sheet.apply(countText)}
            <span className="absolute inset-y-0 inset-e-3 flex items-center">
              <Spinner />
            </span>
          </button>
        </div>
      </div>
    </>
  );
}

export function FilterSheet(data: FilterPanelData) {
  const { search } = useSearchNavigation();
  const [open, setOpen] = useState(false);
  const applied = Object.keys(search.filters).length;

  // Next.js keeps a page it has left in the document, hidden, with its state (Activity): an open sheet is transient.
  useLayoutEffect(
    () => () => {
      setOpen(false);
    },
    [],
  );

  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Trigger
        aria-label={applied === 0 ? undefined : SEARCH_COPY.controls.filtersApplied(applied)}
        className="inline-flex min-h-12 max-w-full touch-manipulation items-center justify-center gap-2 rounded-control border border-control bg-canvas px-3 text-control font-semibold text-default transition-colors hover:bg-surface-hover"
      >
        <Icon icon={SlidersHorizontal} />
        {SEARCH_COPY.controls.filters}
        {applied === 0 ? null : (
          <span
            aria-hidden="true"
            className="inline-flex min-w-6 justify-center rounded-full bg-action px-2 text-label font-medium text-on-action"
          >
            {formatCount(applied)}
          </span>
        )}
      </Drawer.Trigger>
      <Drawer.VirtualKeyboardProvider>
        <Drawer.Portal>
          <Drawer.Backdrop className="fixed inset-0 z-40 bg-scrim transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0 motion-safe:duration-sheet" />
          <Drawer.Viewport className="fixed inset-0 z-40 flex items-end justify-center pt-8">
            <Drawer.Popup className="flex h-full max-h-full w-full max-w-2xl translate-y-(--drawer-swipe-movement-y) flex-col rounded-t-sheet bg-surface text-default shadow-sheet outline-none data-ending-style:translate-y-full data-starting-style:translate-y-full data-swiping:transition-none motion-safe:transition-transform motion-safe:duration-sheet motion-safe:ease-settle">
              <SheetContent
                data={data}
                onClose={() => {
                  setOpen(false);
                }}
              />
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.VirtualKeyboardProvider>
    </Drawer.Root>
  );
}
