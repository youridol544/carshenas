import Link from 'next/link';
import type { Route } from 'next';
import { InfoPopover } from '@/components/ui/info-popover';
import { SkeletonBlock, SkeletonText } from '@/components/ui/skeleton';
import { BODY_TYPE_CODES, type BodyTypeCode } from '@/features/body-types/body-types';
import { BodyTypeLinks } from '@/features/body-types/components/body-type-links';
import { CatalogueRow } from '@/features/home/components/catalogue-row';
import { HOME_COPY } from '@/features/home/home-copy';
import { loadHomeBrowse } from '@/features/home/server/home-queries';
import { ListingCardSkeleton } from '@/features/search/components/listing-card';
import { catalogueInfo } from '@/features/search/info-content';
import { makeLabelOf } from '@/features/search/search-labels';
import { CATALOGUES } from '@carshenas/search/catalogues';
import { catalogueSearch, searchHref } from '@carshenas/search/search';
import { SEARCH_COPY } from '@/features/search/search-copy';

// Everything under the hero that comes from the database (CS-63): the body types that have listings, then one row for
// each catalogue that holds something. It reads one cached answer (loadHomeBrowse), so a visitor costs no query of its
// own. The hero above it is part of the page's static shell and paints without it.

export async function HomeBrowse() {
  const data = await loadHomeBrowse();
  const labelOf = makeLabelOf(data.options, data.bodyTypeLabels);
  const bodyTypes = data.options.body_type.flatMap((option) =>
    option.count > 0 && (BODY_TYPE_CODES as readonly string[]).includes(option.value)
      ? [{ code: option.value as BodyTypeCode, count: HOME_COPY.bodyTypes.count(option.count) }]
      : [],
  );
  if (data.rows.length === 0 && bodyTypes.length === 0) {
    return (
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-12">
        <h2 className="text-heading font-bold">{SEARCH_COPY.emptyIndex.title}</h2>
        <p className="max-w-reading text-body text-pretty text-muted">{SEARCH_COPY.emptyIndex.body}</p>
      </section>
    );
  }
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 py-12">
      {bodyTypes.length === 0 ? null : (
        <section aria-labelledby="home-body-types" className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="home-body-types" className="text-heading font-bold">
              {HOME_COPY.bodyTypes.title}
            </h2>
            <p className="text-secondary text-muted">{HOME_COPY.bodyTypes.lead}</p>
          </div>
          <BodyTypeLinks available={bodyTypes} all={HOME_COPY.bodyTypes.all} />
        </section>
      )}
      {data.rows.map((row) => (
        <CatalogueRow key={row.id} row={row} info={catalogueInfo(row.id, labelOf)} now={data.now} />
      ))}
      {data.more.length === 0 ? null : (
        <section aria-labelledby="home-more" className="flex flex-col gap-3">
          <h2 id="home-more" className="text-heading font-bold">
            {HOME_COPY.more.title}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {data.more.map((item) => {
              const catalogue = CATALOGUES.find((candidate) => candidate.id === item.id);
              if (catalogue === undefined) return null;
              return (
                <li
                  key={item.id}
                  data-catalogue-chip={item.id}
                  className="flex max-w-full items-center rounded-control border border-divider bg-surface"
                >
                  <Link
                    href={searchHref(catalogueSearch(item.id)) as Route}
                    className="inline-flex min-h-11 min-w-0 flex-wrap items-center gap-x-2 rounded-control py-1 ps-4 pe-2 text-label font-medium transition-colors hover:bg-surface-hover"
                  >
                    {catalogue.title}
                    <span className="text-muted">{HOME_COPY.rows.count(item.count)}</span>
                  </Link>
                  <InfoPopover
                    label={SEARCH_COPY.catalogues.info(catalogue.title)}
                    closeLabel={SEARCH_COPY.info.close}
                    content={catalogueInfo(item.id, labelOf)}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

const ROW_KEYS = ['row-1', 'row-2'] as const;
const CARD_KEYS = ['card-1', 'card-2', 'card-3'] as const;
const TILE_KEYS = ['tile-1', 'tile-2', 'tile-3'] as const;

/**
 * The same frames in grey while the first answer is on its way: a body-type panel and two rows of cards, so the
 * space is kept from the first frame (it fades in only after the pending delay, so a quick answer never flashes it).
 */
export function HomeBrowseSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-7xl skeleton-delayed flex-col gap-12 px-4 py-12">
      <p role="status" className="sr-only">
        {SEARCH_COPY.results.loading}
      </p>
      <div aria-hidden="true" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <div className="w-48 text-heading">
            <SkeletonText lastLineWidth="w-full" />
          </div>
          <div className="w-64 text-secondary">
            <SkeletonText lastLineWidth="w-full" />
          </div>
        </div>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,9rem))] gap-3">
          {TILE_KEYS.map((key) => (
            <li key={key} className="flex flex-col gap-2 rounded-card border border-divider p-2">
              <div className="aspect-4/3 overflow-hidden rounded-inner">
                <SkeletonBlock />
              </div>
              <div className="text-label">
                <SkeletonText lastLineWidth="w-full" />
              </div>
              <div className="text-meta">
                <SkeletonText lastLineWidth="w-1/2" />
              </div>
            </li>
          ))}
        </ul>
      </div>
      {ROW_KEYS.map((rowKey) => (
        <div key={rowKey} aria-hidden="true" className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <div className="w-56 text-heading">
              <SkeletonText lastLineWidth="w-full" />
            </div>
            <div className="w-80 max-w-full text-secondary">
              <SkeletonText lastLineWidth="w-full" />
            </div>
          </div>
          <div className="-mx-4 flex gap-3 overflow-hidden px-4 pb-2">
            {CARD_KEYS.map((key) => (
              <div key={key} className="w-80 shrink-0 lg:w-96">
                <ListingCardSkeleton />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
