import 'server-only';
import { fromSearchParams } from '@carshenas/search/search';
import type { SearchFacets, SearchPage } from '@/features/search/search-types';
import { MAX_PAGE_SIZE, readSearchFacets, searchListings } from '@/features/search/server/search-queries';

// GET /api/search?<the search page's own parameters>&cursor=…&limit=…&facets=1: the search API for what a page asks
// after it has rendered (CS-61's «نمایش بیشتر», CS-62's answer), with the URL form of @carshenas/search (CS-58), so a
// search page's address and its API call carry the same parameters. Server Components call search-queries.ts directly.
// The answer is the same for everyone who asks, so it may be kept for half a minute.

const CACHE = { 'Cache-Control': 'public, max-age=30' };
const NO_STORE = { 'Cache-Control': 'no-store' };

export type SearchResponse = SearchPage & {
  /** Parameters this search knows whose values it could not use; the page says so. */
  readonly ignored: readonly string[];
  /** With facets=1 only. */
  readonly facets?: SearchFacets;
};

export type SearchErrorResponse = { readonly message: string };

const INVALID_CURSOR = 'این فهرست از نو باز شد؛ ادامه‌ی فهرست قبلی دیگر در دسترس نیست.';
const INVALID_LIMIT = 'تعداد نتیجه‌ها باید عددی بین ۱ و ۴۸ باشد.';

export async function answerSearch(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const { search, ignored } = fromSearchParams(params);
  const cursor = params.get('cursor') ?? undefined;
  const limitText = params.get('limit');
  const limit = limitText === null ? undefined : Number(limitText);
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE)) {
    return Response.json({ message: INVALID_LIMIT } satisfies SearchErrorResponse, {
      status: 400,
      headers: NO_STORE,
    });
  }
  const withFacets = params.get('facets') === '1';
  const [result, facets] = await Promise.all([
    searchListings({ search, cursor, limit }),
    withFacets ? readSearchFacets(search) : undefined,
  ]);
  if (result.status === 'invalid_cursor') {
    return Response.json({ message: INVALID_CURSOR } satisfies SearchErrorResponse, {
      status: 400,
      headers: NO_STORE,
    });
  }
  const body: SearchResponse = { ...result.page, ignored, ...(facets === undefined ? {} : { facets }) };
  return Response.json(body, { headers: CACHE });
}
