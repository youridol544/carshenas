import * as z from 'zod';
import { DivarShapeError, jsonObjectOf } from './answers.ts';
import { TOKEN } from './api.ts';

// One page of Divar's search, read (docs/research/2026-09-26-car-listing-sources-and-crawl-policy/divar-web-api.md).
// Each listing is a POST_ROW; its sort time is when it was posted, or last bumped («نردبان شده») or otherwise moved up.
// Promoted rows («پله شده») sit on top of the first page whatever their time. The first page also links the search one
// level down (brands under every car, models under a brand, trims under a model): the values a measurement walks.

export type SearchRow = {
  readonly token: string;
  /** Divar's sort time for the row; undefined if the row did not say. */
  readonly sortedAt: Date | undefined;
  /** Moved back to the top by a paid bump. */
  readonly bumped: boolean;
  /** A paid placement, shown on top of the first page out of time order. */
  readonly promoted: boolean;
  readonly title: string | undefined;
  /** The price as the row shows it («۹۸۰,۰۰۰,۰۰۰ تومان», «توافقی»). */
  readonly priceText: string | undefined;
  /** The first photo's thumbnail, on Divar's CDN. */
  readonly imageUrl: string | undefined;
};

export type SearchPage = {
  readonly rows: readonly SearchRow[];
  /**
   * What Divar says; it says so on the first page of a slice of one listing too, so a page that is not full (PAGE_ROWS),
   * or an empty one, is where a walk may end.
   */
  readonly hasNextPage: boolean;
  /** Sent back unchanged as the next page's pagination_data. */
  readonly cursor: unknown;
  /** brand_model values one level below this search, from the first page's links; empty on later pages. */
  readonly childValues: readonly string[];
  /** The page's other widgets (a divider, a notice) as `TYPE` or `TYPE: title`, for the logs: they show how a feed ends. */
  readonly otherWidgets: readonly string[];
};

/** Rows on a full page of Divar's search, promoted ones included (every full page of the measurement on 2026-09-29). */
export const PAGE_ROWS = 24;

const BUMPED = 'نردبان شده';
const PROMOTED = 'پله شده';

const postRow = z.looseObject({
  widget_type: z.literal('POST_ROW'),
  data: z.looseObject({
    token: z.string().optional(),
    action: z.looseObject({ payload: z.looseObject({ token: z.string().optional() }).optional() }).optional(),
    title: z.string().optional(),
    middle_description_text: z.string().optional(),
    red_text: z.string().optional(),
    image_url: z.string().optional(),
  }),
  action_log: z
    .looseObject({
      server_side_info: z
        .looseObject({ info: z.looseObject({ sort_date: z.string().optional() }).optional() })
        .optional(),
    })
    .optional(),
});

const otherWidget = z.looseObject({
  widget_type: z.string(),
  data: z.looseObject({ title: z.string().optional(), text: z.string().optional() }).optional(),
});

const page = z.looseObject({
  list_widgets: z.array(z.looseObject({ widget_type: z.string() })),
  pagination: z.looseObject({ has_next_page: z.boolean().optional(), data: z.unknown() }).optional(),
  list_bottom_widgets: z.array(z.unknown()).optional(),
  action_log: z
    .looseObject({
      server_side_info: z
        .looseObject({
          info: z
            .looseObject({
              pelle: z
                .looseObject({
                  elastic: z.looseObject({ tokens: z.array(z.string()).optional() }).optional(),
                })
                .optional(),
            })
            .optional(),
        })
        .optional(),
    })
    .optional(),
});

const seoLinks = z.looseObject({
  data: z.looseObject({
    links: z.array(
      z.looseObject({
        action: z
          .looseObject({
            payload: z
              .looseObject({
                search_data: z
                  .looseObject({
                    form_data: z.looseObject({
                      data: z.looseObject({
                        brand_model: z
                          .looseObject({
                            repeated_string: z.looseObject({ value: z.array(z.string()) }),
                          })
                          .optional(),
                      }),
                    }),
                  })
                  .optional(),
              })
              .optional(),
          })
          .optional(),
      }),
    ),
  }),
});

function instantOf(text: string | undefined): Date | undefined {
  if (text === undefined) return undefined;
  const at = new Date(text);
  return Number.isNaN(at.getTime()) ? undefined : at;
}

function childValuesOf(bottomWidgets: readonly unknown[]): string[] {
  const values = new Set<string>();
  for (const widget of bottomWidgets) {
    const links = seoLinks.safeParse(widget);
    if (!links.success) continue;
    for (const link of links.data.data.links) {
      const brandModel = link.action?.payload?.search_data?.form_data.data.brand_model;
      for (const value of brandModel?.repeated_string.value ?? []) values.add(value);
    }
  }
  return [...values];
}

/** Reads a search page; throws DivarShapeError when it is not one (a refusal was already recognised by then). */
export function readSearchPage(body: string): SearchPage {
  const parsed = page.safeParse(jsonObjectOf(body));
  if (!parsed.success)
    throw new DivarShapeError('the search answer is not a page of listings', { cause: parsed.error });
  const promotedTokens = new Set(
    parsed.data.action_log?.server_side_info?.info?.pelle?.elastic?.tokens ?? [],
  );
  const rows: SearchRow[] = [];
  const otherWidgets: string[] = [];
  for (const widget of parsed.data.list_widgets) {
    if (widget.widget_type !== 'POST_ROW') {
      const other = otherWidget.safeParse(widget);
      const title = other.success ? (other.data.data?.title ?? other.data.data?.text) : undefined;
      otherWidgets.push(title ? `${widget.widget_type}: ${title.slice(0, 80)}` : widget.widget_type);
      continue;
    }
    const row = postRow.safeParse(widget);
    const token = row.success ? (row.data.data.token ?? row.data.data.action?.payload?.token) : undefined;
    if (!row.success || token === undefined || !TOKEN.test(token)) {
      throw new DivarShapeError('a listing row has no token Divar would give', { cause: row.error });
    }
    const { data } = row.data;
    rows.push({
      token,
      sortedAt: instantOf(row.data.action_log?.server_side_info?.info?.sort_date),
      bumped: data.red_text === BUMPED,
      promoted: data.red_text === PROMOTED || promotedTokens.has(token),
      title: data.title,
      priceText: data.middle_description_text,
      imageUrl: data.image_url,
    });
  }
  return {
    rows,
    hasNextPage: parsed.data.pagination?.has_next_page === true,
    cursor: parsed.data.pagination?.data,
    childValues: childValuesOf(parsed.data.list_bottom_widgets ?? []),
    otherWidgets,
  };
}
