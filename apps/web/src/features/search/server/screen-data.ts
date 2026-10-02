import 'server-only';
import type { Search } from '@carshenas/search/search';
import type { CatalogueCounts, SearchFacets, SearchPage } from '@/features/search/search-types';
import {
  PAGE_SIZE,
  readCatalogueCounts,
  readFilterOptionCounts,
  readSearchFacets,
  searchListings,
} from '@/features/search/server/search-queries';
import { readBodyTypeLabels, type BodyTypeLabel } from '@/features/search/server/search-labels';
import { nameOnScreen } from '@/features/search/search-labels';

// Everything the search screen reads, started together (one round trip per navigation): the first page and the total of
// the search, the options of the database-backed filters with the counts this search leaves them, every option the index
// has (their names, and whether more than one source has listings), the catalogues' counts and the body types' names.

export type ScreenData = {
  readonly page: SearchPage;
  /** Each database-backed filter's options as this search leaves them (counted without the filter's own values). */
  readonly facets: SearchFacets;
  /** Every option the index has, whatever the search: the names of the chosen values, and the sources that exist. */
  readonly options: SearchFacets;
  readonly catalogueCounts: CatalogueCounts;
  readonly bodyTypes: readonly BodyTypeLabel[];
  readonly pageSize: number;
};

/** The options with their names as they are shown (nameOnScreen); the database's own stay as written. */
function namedOnScreen(facets: SearchFacets): SearchFacets {
  const named: Record<string, SearchFacets[keyof SearchFacets]> = {};
  for (const [kind, list] of Object.entries(facets)) {
    named[kind] = list.map((option) => ({ ...option, label: nameOnScreen(option.label) }));
  }
  return named as SearchFacets;
}

export async function readScreenData(search: Search): Promise<ScreenData> {
  const [result, facets, options, catalogueCounts, bodyTypes] = await Promise.all([
    searchListings({ search, limit: PAGE_SIZE }),
    readSearchFacets(search),
    readFilterOptionCounts(),
    readCatalogueCounts(),
    readBodyTypeLabels(),
  ]);
  // Only a request with a cursor can be refused for it, and this one has none.
  if (result.status !== 'ok') throw new Error('the first page of a search was refused');
  return {
    page: result.page,
    facets: namedOnScreen(facets),
    options: namedOnScreen(options),
    catalogueCounts,
    bodyTypes,
    pageSize: PAGE_SIZE,
  };
}
