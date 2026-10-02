import * as z from 'zod';
import type { ListingCard, SearchFacets } from '@/features/search/search-types';

// What the browser accepts from GET /api/search (CS-59): the answer is parsed, never cast, because it crosses the
// network. Each schema is annotated with the DTO it parses, so a field added to or changed in the API's types fails
// type-checking here until the schema follows it. The answers the page asks for after it has rendered are the next
// page of «نمایش بیشتر» and the count and options of the filter sheet's draft.

const Named = z.object({ key: z.string(), name: z.string() });

const ListingCardSchema: z.ZodType<ListingCard> = z.object({
  id: z.int(),
  title: z.string().nullable(),
  name: z.string(),
  url: z.string(),
  source: Named,
  make: Named.nullable(),
  model: Named.nullable(),
  trim: Named.nullable(),
  bodyType: Named.nullable(),
  modelYearSh: z.int().nullable(),
  modelYearAd: z.int().nullable(),
  mileageKm: z.int().nullable(),
  kmPerYear: z.int().nullable(),
  priceType: z.string().nullable(),
  askingPriceToman: z.number().nullable(),
  valuation: z
    .object({
      marketValueToman: z.number(),
      priceGapPct: z.number().nullable(),
      dealRating: z.enum(['great', 'good', 'fair', 'high', 'overpriced']).nullable(),
      valuedOn: z.string(),
    })
    .nullable(),
  gearbox: z.string().nullable(),
  fuel: z.string().nullable(),
  colourFamily: z.string().nullable(),
  city: Named.nullable(),
  district: z.string().nullable(),
  sellerType: z.string().nullable(),
  condition: z.object({
    body: z.string().nullable(),
    engine: z.string().nullable(),
    gearbox: z.string().nullable(),
    chassis: z.string().nullable(),
    paintFree: z.boolean().nullable(),
    accident: z.string().nullable(),
  }),
  listedAt: z.string(),
  lastSeenAt: z.string(),
  photo: z.object({ url: z.string(), thumbnailUrl: z.string().nullable(), count: z.int() }).nullable(),
});

const FacetOptions = z.array(z.object({ value: z.string(), label: z.string(), count: z.int() }));

const SearchFacetsSchema: z.ZodType<SearchFacets> = z.object({
  make: FacetOptions,
  model: FacetOptions,
  trim: FacetOptions,
  body_type: FacetOptions,
  city: FacetOptions,
  district: FacetOptions,
  source: FacetOptions,
});

export const SearchResponseSchema = z.object({
  results: z.array(ListingCardSchema),
  nextCursor: z.string().nullable(),
  total: z.object({ count: z.int().nonnegative(), exact: z.boolean() }),
  ignored: z.array(z.string()),
  facets: SearchFacetsSchema.optional(),
});
export type SearchResponseBody = z.output<typeof SearchResponseSchema>;

/** The answer to a request the API refused: a Farsi sentence that says what to do. */
export const SearchErrorBodySchema = z.object({ message: z.string() });
