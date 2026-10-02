// @vitest-environment node
import { expect, test } from 'vitest';
import { SearchErrorBodySchema, SearchResponseSchema } from '@/features/search/search-schemas';
import { listingCardFixture, thinListingCardFixture } from '@/features/search/search-fixtures';

// The browser accepts the API's answer only when it has the shape the DTOs promise (search-schemas.ts); a card from
// the API, as JSON, parses back to itself.

test('a page of results as the API sends it parses back to itself', () => {
  const body = {
    results: [listingCardFixture(), thinListingCardFixture({ id: 2 })],
    nextCursor: 'abc_-',
    total: { count: 23127, exact: true },
    text: { searchable: true, corrections: [], unknown: [] },
    ignored: ['year'],
    facets: {
      make: [{ value: 'peugeot', label: 'پژو', count: 2100 }],
      model: [],
      trim: [],
      body_type: [],
      city: [],
      district: [],
      source: [],
    },
  };
  const parsed = SearchResponseSchema.parse(JSON.parse(JSON.stringify(body)));
  expect(parsed).toEqual(body);
});

test('an answer that is not a page of results is refused, never repaired', () => {
  expect(SearchResponseSchema.safeParse({ message: 'x' }).success).toBe(false);
  expect(
    SearchResponseSchema.safeParse({
      results: [{ id: 'one' }],
      nextCursor: null,
      total: { count: 1, exact: true },
      ignored: [],
    }).success,
  ).toBe(false);
  expect(SearchResponseSchema.safeParse(null).success).toBe(false);
});

test('a refusal carries a sentence to show', () => {
  expect(SearchErrorBodySchema.parse({ message: 'این فهرست از نو باز شد.' }).message).toBe(
    'این فهرست از نو باز شد.',
  );
});
