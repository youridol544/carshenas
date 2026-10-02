import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { CATALOGUE_IDS, type CatalogueId } from '@carshenas/search/catalogues';
import { catalogueSearch } from '@carshenas/search/search';
import type { ListingCard, SearchFacets } from '@/features/search/search-types';
import { readBodyTypeLabels, type BodyTypeLabel } from '@/features/search/server/search-labels';
import {
  readCatalogueCounts,
  readFilterOptionCounts,
  readSearchCoverage,
  searchListings,
} from '@/features/search/server/search-queries';
import { loadDataStatus } from '@/features/data-status/server/data-status-queries';
import type { DataStatus } from '@/features/data-status/data-status-types';

// What the home page reads (CS-63): the first cards of every catalogue that holds something, the body types that have
// listings, and the measured figures of the trust strip. Everything is cached for a minute: a burst of visitors costs
// one set of reads, and the page's HTML does not wait for them (it is a Suspense boundary, so the hero paints first).
// The lifetime is under five minutes on purpose, as the data-status page's: the build never bakes the figures in.

/** Cards a row holds before its «دیدن همه» tile. */
export const ROW_CARDS = 6;
/**
 * Catalogues shown as rows of cards. Each row is nine Tab stops (its info control, the link, six cards, the tile) and a
 * phone scrolls a screen and a half past each, so the first five say what the product is for and the others are
 * chips under them; the search page lists every catalogue.
 */
export const ROW_COUNT = 5;

export type HomeRow = {
  readonly id: CatalogueId;
  /** How many searchable listings the catalogue holds, as the worker last counted them. */
  readonly count: number;
  readonly cards: readonly ListingCard[];
};

export type HomeBrowse = {
  /** The server's clock when the rows were read: every card's days on market is counted from it. */
  readonly now: string;
  /** The first ROW_COUNT catalogues with listings, in the catalogues' order («پیشنهاد کارشناس» first). */
  readonly rows: readonly HomeRow[];
  /** The other catalogues that hold listings, as chips after the rows. */
  readonly more: readonly { readonly id: CatalogueId; readonly count: number }[];
  /** The options of every filter with a name, for the catalogues' explanations. */
  readonly options: SearchFacets;
  readonly bodyTypeLabels: readonly BodyTypeLabel[];
};

export async function loadHomeBrowse(): Promise<HomeBrowse> {
  'use cache';
  cacheLife({ stale: 60, revalidate: 60, expire: 180 });
  cacheTag('search-counts');

  const [counts, options, bodyTypeLabels] = await Promise.all([
    readCatalogueCounts(),
    readFilterOptionCounts(),
    readBodyTypeLabels(),
  ]);
  // A catalogue that holds nothing is left out: a row that leads to an empty list is worse than none.
  const filled = CATALOGUE_IDS.filter((id) => counts[id] > 0);
  const rows = await Promise.all(
    filled.slice(0, ROW_COUNT).map(async (id): Promise<HomeRow> => {
      const result = await searchListings({
        search: catalogueSearch(id),
        limit: ROW_CARDS,
        quiet: true,
      });
      // Only a request with a cursor can be refused for it, and this one has none.
      if (result.status !== 'ok') throw new Error('the first cards of a catalogue were refused');
      return { id, count: counts[id], cards: result.page.results };
    }),
  );
  const more = filled.slice(ROW_COUNT).map((id) => ({ id, count: counts[id] }));
  return { now: new Date().toISOString(), rows, more, options, bodyTypeLabels };
}

export type HomeTrust = {
  /** Listings a buyer can find in the search now. */
  readonly searchable: number;
  /** The Tehran day the market values hold for (ISO), and how many listings they rated; null before the first run. */
  readonly valuation: { readonly asOfDate: string; readonly rated: number } | null;
  /** The published evaluation of reading listing text: facts read right of facts scored; null before the first. */
  readonly reading: { readonly fieldsRight: number; readonly fieldsScored: number } | null;
};

/** The figures of the trust strip, from the same reads as the data-status page (CS-66) and the search's own counts. */
export async function loadHomeTrust(): Promise<HomeTrust> {
  'use cache';
  cacheLife({ stale: 60, revalidate: 60, expire: 180 });
  cacheTag('search-counts');

  const [coverage, status]: [Awaited<ReturnType<typeof readSearchCoverage>>, DataStatus] = await Promise.all([
    readSearchCoverage(),
    loadDataStatus(),
  ]);
  return {
    searchable: coverage.searchable,
    valuation:
      status.valuation === null
        ? null
        : { asOfDate: status.valuation.asOfDate, rated: status.valuation.rated },
    reading:
      status.extraction === null
        ? null
        : { fieldsRight: status.extraction.fieldsRight, fieldsScored: status.extraction.fieldsScored },
  };
}
