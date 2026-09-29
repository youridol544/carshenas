// Divar's public web API, as its own web client calls it (CS-5; docs/research/2026-09-26-car-listing-sources-and-crawl-
// policy/divar-web-api.md). The crawler sends exactly two requests: a page of the search, and one post. It never builds
// any other address, in particular no contact or chat endpoint (ADR-0008 points 2 and 7; CS-33 criterion 6).

export const DIVAR_API_URL = 'https://api.divar.ir';

/** Tehran, in Divar's city ids. */
export const TEHRAN = '1';
/** «خودرو سواری و وانت»: cars and pick-ups, the page divar.ir/s/tehran/car (ADR-0017 point 2). */
export const CARS = 'light';

/** The search: POST, one page of rows per request. */
export function searchUrl(apiUrl: string): string {
  return `${apiUrl}/v8/postlist/w/search`;
}

/** One post, by its token. */
export function postUrl(apiUrl: string, token: string): string {
  return `${apiUrl}/v8/posts-v2/web/${encodeURIComponent(token)}`;
}

/** The listing's own page on Divar: where a buyer clicks out to. */
export function listingPageUrl(token: string): string {
  return `https://divar.ir/v/${encodeURIComponent(token)}`;
}

/** A token as Divar writes them («gaf-cP_-»); anything else is not used in an address. */
export const TOKEN = /^[A-Za-z0-9_-]{6,16}$/;

export type SearchQuery = {
  /** Divar's brand_model filter values («Peugeot 206», «Pride»); none for every car. */
  readonly brandModels?: readonly string[];
  /** The previous page's pagination.data, sent back unchanged for the next page. */
  readonly cursor?: unknown;
};

/**
 * The search's body: Tehran's cars, newest first, as the web client sends it minus its interface state (the minimal
 * body CS-5 confirmed), with the brand_model filter the web client uses on divar.ir/s/tehran/car/<make>/<model>
 * (confirmed on 2026-09-29; several values return the listings of every one of them).
 */
export function searchBody(query: SearchQuery): string {
  const filters: Record<string, unknown> = { category: { str: { value: CARS } } };
  if (query.brandModels && query.brandModels.length > 0) {
    filters.brand_model = { repeated_string: { value: [...query.brandModels] } };
  }
  return JSON.stringify({
    city_ids: [TEHRAN],
    search_data: {
      form_data: { data: filters },
      server_payload: {
        '@type': 'type.googleapis.com/widgets.SearchData.ServerPayload',
        additional_form_data: { data: { sort: { str: { value: 'sort_date' } } } },
      },
    },
    ...(query.cursor !== undefined && { pagination_data: query.cursor }),
  });
}
