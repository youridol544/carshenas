import 'server-only';
import { formatCount } from '@carshenas/locale/format-number';
import { fromSearchParams } from '@carshenas/search/search';
import type { SearchFacets, SearchPage } from '@/features/search/search-types';
import {
  MAX_PAGE_SIZE,
  PAGE_COUNT_CAP,
  readSearchFacets,
  searchListings,
} from '@/features/search/server/search-queries';

// GET /api/search?<the search page's own parameters>&cursor=…&limit=…&facets=1: the search API for what a page asks
// after it has rendered (CS-61's «نمایش بیشتر», CS-62's answer), with the URL form of @carshenas/search (CS-58), so a
// search page's address and its API call carry the same parameters. limit=0 is only the count: a live count of any
// filter combination, exact up to 1,000 («بیش از ۱٬۰۰۰» above), for a filter sheet. Server Components call
// search-queries.ts directly. The answer is the same for everyone who asks, so it may be kept for half a minute.

const CACHE = { 'Cache-Control': 'public, max-age=30' };
const NO_STORE = { 'Cache-Control': 'no-store' };

export type SearchResponse = SearchPage & {
  /** Parameters this search knows whose values it could not use; the page says so. */
  readonly ignored: readonly string[];
  /** With facets=1 only. */
  readonly facets?: SearchFacets;
};

export type SearchErrorResponse = { readonly message: string };

const INVALID_CURSOR = 'فهرست در این فاصله تازه شد.';
const INVALID_LIMIT = `تعداد نتایج باید عددی بین ${formatCount(0)} و ${formatCount(MAX_PAGE_SIZE)} باشد.`;

export async function answerSearch(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const { search, ignored } = fromSearchParams(params);
  // An empty `cursor=` (a form's hidden field with nothing in it) is no cursor: the first page.
  const cursorText = params.get('cursor');
  const cursor = cursorText === null || cursorText === '' ? undefined : cursorText;
  const limitText = params.get('limit');
  const limit = limitText === null ? undefined : Number(limitText);
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 0 || limit > MAX_PAGE_SIZE)) {
    return Response.json({ message: INVALID_LIMIT } satisfies SearchErrorResponse, {
      status: 400,
      headers: NO_STORE,
    });
  }
  const withFacets = params.get('facets') === '1';
  const [result, facets] = await Promise.all([
    searchListings({ search, cursor, limit, ...(limit === 0 ? { countCap: PAGE_COUNT_CAP } : {}) }),
    withFacets ? readSearchFacets(search) : undefined,
  ]);
  if (result.status === 'invalid_cursor') {
    return Response.json({ message: INVALID_CURSOR } satisfies SearchErrorResponse, {
      status: 400,
      headers: NO_STORE,
    });
  }
  // Words with nothing to search (punctuation only) are ignored like any parameter the search could not use.
  const wordsIgnored = result.page.text !== null && !result.page.text.searchable;
  const body: SearchResponse = {
    ...result.page,
    ignored: wordsIgnored ? [...ignored, 'q'] : ignored,
    ...(facets === undefined ? {} : { facets }),
  };
  return Response.json(body, { headers: CACHE });
}
