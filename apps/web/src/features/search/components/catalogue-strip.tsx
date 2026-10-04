'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { InfoPopover, type InfoContent } from '@/components/ui/info-popover';
import { RovingGroup } from '@/components/ui/roving-group';
import { ScrollRail } from '@/components/ui/scroll-rail';
import { useSearchNavigation } from '@/features/search/components/search-navigation';
import { SEARCH_COPY } from '@/features/search/search-copy';
import { formatCount } from '@carshenas/locale/format-number';
import { catalogueSearch, EMPTY_SEARCH, isCatalogueUnchanged, searchHref } from '@carshenas/search/search';
import type { CatalogueId } from '@carshenas/search/catalogues';

// The premade catalogues as one-tap collections (CS-58: a catalogue is nothing more than filter values and an order):
// «پیشنهاد کارشناس» first, each with how many searchable listings it holds, from the counts the worker keeps. Each chip
// is a link, so it can be opened in a new tab or shared, and an info button beside its title says exactly what it
// applies (the owner's request of 2026-10-01). The strip is one Tab stop with the arrow keys moving along it
// (RovingGroup), a rail that scrolls sideways, on a desktop too, so the first card stays near the top of the screen: the
// shared ScrollRail (no scrollbar, a fade on the side that has more, previous and next buttons for a mouse, the open
// catalogue brought to the middle). A catalogue that holds nothing right now is left out (a chip that leads to an empty
// list is worse than none), unless it is the one open.

export type CatalogueStripItem = {
  readonly id: CatalogueId;
  readonly title: string;
  readonly count: number;
  readonly info: InfoContent;
};

const CHIP = 'flex shrink-0 items-center rounded-full border';
const CHIP_LINK =
  'inline-flex min-h-11 items-center gap-2 rounded-full ps-4 pe-2 text-label font-medium whitespace-nowrap transition-colors hover:bg-surface-hover';

export function CatalogueStrip({ items }: { items: readonly CatalogueStripItem[] }) {
  const { search, navigate } = useSearchNavigation();
  const activeId = search.catalogue !== undefined && isCatalogueUnchanged(search) ? search.catalogue : null;
  const everything =
    activeId === null &&
    search.q === undefined &&
    search.sort === undefined &&
    Object.keys(search.filters).length === 0;

  return (
    <nav aria-label={SEARCH_COPY.catalogues.label}>
      <RovingGroup label={SEARCH_COPY.catalogues.label}>
        <ScrollRail
          as="ul"
          className="-mx-4 lg:mx-0"
          scrollerClassName="flex gap-2 px-4 pb-1 lg:px-0"
          current={{ selector: '[aria-current="true"]', key: activeId }}
        >
          <li
            className={`${CHIP} ${everything ? 'border-action bg-action-subtle text-on-action-subtle' : 'border-divider bg-surface text-default'}`}
          >
            <Link
              href="/search"
              data-roving-item=""
              aria-current={everything ? 'true' : undefined}
              onNavigate={(event) => {
                event.preventDefault();
                navigate(EMPTY_SEARCH);
              }}
              className={`${CHIP_LINK} pe-4`}
            >
              {SEARCH_COPY.catalogues.all}
            </Link>
          </li>
          {items.map((item) => {
            const active = item.id === activeId;
            if (item.count === 0 && !active) return null;
            return (
              <li
                key={item.id}
                className={`${CHIP} ${active ? 'border-action bg-action-subtle text-on-action-subtle' : 'border-divider bg-surface text-default'}`}
              >
                <Link
                  href={searchHref(catalogueSearch(item.id)) as Route}
                  data-roving-item=""
                  aria-current={active ? 'true' : undefined}
                  onNavigate={(event) => {
                    event.preventDefault();
                    navigate(catalogueSearch(item.id));
                  }}
                  className={CHIP_LINK}
                >
                  {item.title}
                  <span className={active ? '' : 'text-muted'}>{formatCount(item.count)}</span>
                </Link>
                <InfoPopover
                  roving
                  label={SEARCH_COPY.catalogues.info(item.title)}
                  closeLabel={SEARCH_COPY.info.close}
                  content={item.info}
                />
              </li>
            );
          })}
        </ScrollRail>
      </RovingGroup>
    </nav>
  );
}
