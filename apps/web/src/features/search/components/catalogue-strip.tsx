'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { InfoPopover, type InfoContent } from '@/components/ui/info-popover';
import { RovingGroup } from '@/components/ui/roving-group';
import { useSearchNavigation } from '@/features/search/components/search-navigation';
import { SEARCH_COPY } from '@/features/search/search-copy';
import { formatCount } from '@carshenas/locale/format-number';
import { catalogueSearch, EMPTY_SEARCH, isCatalogueUnchanged, searchHref } from '@carshenas/search/search';
import type { CatalogueId } from '@carshenas/search/catalogues';

// The premade catalogues as one-tap collections (CS-58: a catalogue is nothing more than filter values and an order):
// «پیشنهاد کارشناس» first, each with how many searchable listings it holds, from the counts the worker keeps. Each chip
// is a link, so it can be opened in a new tab or shared, and an info button beside its title says exactly what it
// applies (the owner's request of 2026-10-01). The strip is one Tab stop with the arrow keys moving along it
// (RovingGroup), a rail that scrolls sideways on a phone with a fade only on the side that has more, and wraps on a
// desktop.

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
  const rail = useRef<HTMLUListElement>(null);
  const activeId = search.catalogue !== undefined && isCatalogueUnchanged(search) ? search.catalogue : null;
  const everything =
    activeId === null &&
    search.q === undefined &&
    search.sort === undefined &&
    Object.keys(search.filters).length === 0;

  // The chosen chip is brought to the middle of the rail: on a phone it may be past the rail's edge. The rail itself
  // is scrolled, never scrollIntoView: Chrome moves the keyboard's starting point to an element scrolled into view,
  // and the next Tab would then skip everything before it.
  useEffect(() => {
    const element = rail.current;
    const chosen = element?.querySelector('[aria-current="true"]');
    if (element === null || chosen === null || chosen === undefined) return;
    const [around, inside] = [element.getBoundingClientRect(), chosen.getBoundingClientRect()];
    element.scrollBy({
      left: inside.left + inside.width / 2 - (around.left + around.width / 2),
      behavior: 'instant',
    });
  }, [activeId]);

  return (
    <nav aria-label={SEARCH_COPY.catalogues.label}>
      <RovingGroup label={SEARCH_COPY.catalogues.label} className="-mx-4 lg:mx-0">
        <ul
          ref={rail}
          className="flex scroll-fade-inline gap-2 overflow-x-auto overscroll-x-contain px-4 pb-1 lg:flex-wrap lg:overflow-visible lg:px-0"
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
        </ul>
      </RovingGroup>
    </nav>
  );
}
