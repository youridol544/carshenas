// @vitest-environment node
import { expect, test } from 'vitest';
import { CATALOGUES } from '@carshenas/search/catalogues';
import {
  catalogueSearch,
  fromSearchParams,
  paramsFromRecord,
  searchHref,
  SearchSchema,
} from '@carshenas/search/search';

// The web app reads searches through the shared definitions (CS-58, ADR-0027): a page's searchParams prop, as Next.js
// passes it, becomes the search the API's schema accepts, and a catalogue's link opens the same search.

test('a page’s searchParams become the search the API accepts, and link back to the same address', () => {
  const searchParams = { make: ['peugeot', 'kia'], price: '..1000000000', nopaint: '1', utm_source: 'x' };
  const { search, ignored } = fromSearchParams(paramsFromRecord(searchParams));
  expect(ignored).toEqual([]);
  expect(SearchSchema.parse(JSON.parse(JSON.stringify(search)))).toEqual(search);
  expect(searchHref(search)).toBe('/search?make=kia&make=peugeot&price=..1000000000&nopaint=1');
});

test('every catalogue opens from its link on the home page', () => {
  for (const catalogue of CATALOGUES) {
    const { search } = fromSearchParams(paramsFromRecord({ catalogue: catalogue.id }));
    expect(search).toEqual(catalogueSearch(catalogue.id));
    expect(Object.keys(search.filters).sort()).toEqual(Object.keys(catalogue.filters).sort());
  }
});
