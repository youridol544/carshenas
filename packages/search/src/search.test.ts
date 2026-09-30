import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FILTER_CASES } from '../test/filter-cases.ts';
import { CATALOGUES } from './catalogues.ts';
import { FILTERS } from './filters.ts';
import {
  canonical,
  catalogueSearch,
  chipsOf,
  fromSearchParams,
  fromStoredSearch,
  isCatalogueUnchanged,
  paramsFromRecord,
  SearchSchema,
  searchHref,
  toSearchParams,
  toStoredSearch,
  type Search,
} from './search.ts';
import { searchVocabulary } from './describe.ts';

// One schema and one serialisation (CS-58 criterion 4): a search goes through the URL (the search and home pages),
// the API's JSON body and a stored search file and comes back the same.

/** A search with every filter set, from each filter's first test case. */
function everyFilter(): Search {
  const filters: Record<string, unknown> = {};
  for (const filter of FILTERS) filters[filter.id] = FILTER_CASES[filter.id][0]?.value;
  return { q: 'بدون رنگ  زیر قیمت', filters: filters, sort: 'mileage_asc' };
}

function roundTrip(search: Search): Search {
  // URL → the page's search → the API's JSON body → a stored file → the page again.
  const fromUrl = fromSearchParams(new URLSearchParams(toSearchParams(search).toString()));
  assert.deepEqual(fromUrl.ignored, []);
  const body: unknown = JSON.parse(JSON.stringify(fromUrl.search));
  const api = SearchSchema.parse(body);
  const stored: unknown = JSON.parse(JSON.stringify(toStoredSearch(api)));
  const file = fromStoredSearch(stored);
  assert.ok(file.success);
  return file.data;
}

test('a search with every filter, words and an order survives the URL, the API and a search file', () => {
  const search = canonical(everyFilter());
  assert.equal(Object.keys(search.filters).length, FILTERS.length);
  assert.deepEqual(roundTrip(search), search);
  assert.equal(toSearchParams(roundTrip(search)).toString(), toSearchParams(search).toString());
});

test('every filter case round-trips on its own', () => {
  for (const filter of FILTERS) {
    for (const { value } of FILTER_CASES[filter.id]) {
      const search = canonical({ filters: { [filter.id]: value } });
      assert.deepEqual(roundTrip(search), search, filter.id);
    }
  }
});

test('an unchanged catalogue is its name in the URL, and a stored file keeps its filters expanded', () => {
  for (const catalogue of CATALOGUES) {
    const search = catalogueSearch(catalogue.id);
    assert.equal(searchHref(search), `/search?catalogue=${catalogue.id}`);
    assert.ok(isCatalogueUnchanged(search));
    assert.deepEqual(roundTrip(search), search);
    const stored = toStoredSearch(search);
    assert.deepEqual(stored.filters, canonical({ filters: catalogue.filters }).filters);
  }
});

test('a catalogue named alone is that catalogue in the URL, the API and a stored file', () => {
  // CS-62's model may answer with a catalogue and nothing else.
  for (const catalogue of CATALOGUES) {
    const bare: unknown = { catalogue: catalogue.id, filters: {} };
    const expected = catalogueSearch(catalogue.id);
    assert.deepEqual(SearchSchema.parse(bare), expected);
    const file = fromStoredSearch({ v: 1, catalogue: catalogue.id, filters: {} });
    assert.ok(file.success);
    assert.deepEqual(file.data, expected);
    assert.deepEqual(canonical({ catalogue: catalogue.id, filters: {} }), expected);
    assert.deepEqual(toStoredSearch({ catalogue: catalogue.id, filters: {} }).filters, expected.filters);
    assert.equal(searchHref({ catalogue: catalogue.id, filters: {} }), `/search?catalogue=${catalogue.id}`);
    assert.deepEqual(roundTrip({ catalogue: catalogue.id, filters: {} }), expected);
  }
});

test('a changed catalogue lists its filters and remembers where it started', () => {
  const family = catalogueSearch('family');
  const changed: Search = { ...family, filters: { ...family.filters, gearbox: ['automatic'] } };
  assert.ok(!isCatalogueUnchanged(changed));
  const params = toSearchParams(changed);
  assert.equal(params.get('catalogue'), 'family');
  assert.equal(params.get('gearbox'), 'automatic');
  assert.deepEqual(roundTrip(changed), canonical(changed));
});

test('a URL is read the way people and sites write it', () => {
  const { search, ignored } = fromSearchParams(
    new URLSearchParams(
      'make=peugeot,kia&make=saipa&price=..۱٬۰۰۰٬۰۰۰٬۰۰۰&year=۱۳۹۸..1402&nopaint=true&utm_source=x&sort=price_asc',
    ),
  );
  assert.deepEqual(ignored, []);
  assert.deepEqual(search, {
    filters: {
      make: ['kia', 'peugeot', 'saipa'],
      year: { min: 1398, max: 1402 },
      price: { max: 1_000_000_000 },
      paint_free: true,
    },
    sort: 'price_asc',
  });
});

test('an unusable value is left out and named, never guessed', () => {
  const { search, ignored } = fromSearchParams(
    new URLSearchParams(
      'fuel=gas&year=1402..1398&price=cheap&deal=best&km=..-5&nopaint=0&make=Peugeot&sort=random&catalogue=nope&age=10',
    ),
  );
  assert.deepEqual(search, { filters: { age: 10 } });
  assert.deepEqual([...ignored].sort(), [
    'catalogue',
    'deal',
    'fuel',
    'km',
    'make',
    'nopaint',
    'price',
    'sort',
    'year',
  ]);
});

test('words are trimmed and cut, never refused', () => {
  assert.deepEqual(fromSearchParams(new URLSearchParams('q=%20%20')).search, { filters: {} });
  const long = 'ب'.repeat(500);
  assert.equal(fromSearchParams(new URLSearchParams({ q: long })).search.q?.length, 200);
  assert.equal(fromSearchParams(new URLSearchParams({ q: ' ۲۰۶   تیپ ۲ ' })).search.q, '۲۰۶ تیپ ۲');
});

test('a stored search that no longer fits the schema is refused, not repaired', () => {
  assert.equal(fromStoredSearch({ v: 2, filters: {} }).success, false);
  assert.equal(fromStoredSearch({ v: 1, filters: { colour: ['mauve'] } }).success, false);
  assert.equal(fromStoredSearch({ v: 1, filters: {}, extra: true }).success, false);
  assert.equal(fromStoredSearch({ v: 1, filters: { price: {} } }).success, false);
});

test('the API refuses what the URL would drop: unknown filters, reversed ranges and repeated values', () => {
  assert.equal(SearchSchema.safeParse({ filters: { wheels: 4 } }).success, false);
  assert.equal(SearchSchema.safeParse({ filters: { year: { min: 1402, max: 1398 } } }).success, false);
  assert.equal(SearchSchema.safeParse({ filters: { gearbox: ['manual', 'manual'] } }).success, false);
  assert.equal(SearchSchema.safeParse({ filters: { mileage: { min: -1 } } }).success, false);
  assert.equal(SearchSchema.safeParse({ filters: { model: ['206'] } }).success, false);
});

test('Next.js search params keep every value of a repeated parameter', () => {
  const params = paramsFromRecord({ make: ['peugeot', 'kia'], deal: 'good', empty: undefined });
  assert.deepEqual(fromSearchParams(params).search.filters, { make: ['kia', 'peugeot'], deal: 'good' });
});

test('chips name each applied value in Farsi and remove only themselves', () => {
  const search = fromSearchParams(
    new URLSearchParams(
      'make=peugeot&make=kia&price=..1000000000&year=1398..1402&km=20000..60000&deal=good&nopaint=1&posted=1&insurance=6&age=10',
    ),
  ).search;
  const chips = chipsOf(search, (id, value) => (id === 'make' && value === 'peugeot' ? 'پژو' : undefined));
  assert.deepEqual(
    chips.map((chip) => chip.text),
    [
      'kia',
      'پژو',
      'مدل ۱۳۹۸ تا ۱۴۰۲',
      'حداکثر ۱۰ سال عمر',
      'کارکرد ۲۰٬۰۰۰ تا ۶۰٬۰۰۰ کیلومتر',
      'تا ۱ میلیارد تومان',
      'معامله‌ی خوب یا بهتر',
      'بدون رنگ',
      'دست‌کم ۶ ماه بیمه',
      'آگهی‌های ۲۴ ساعت گذشته',
      // The formatters join a number to its unit or scale word with a no-break space.
    ].map((text) => text.replace(/ (?=کیلومتر|سال|ماه|تومان|میلیارد|ساعت)/g, String.fromCharCode(0xa0))),
  );
  const peugeot = chips.find((chip) => chip.key === 'make:peugeot');
  assert.deepEqual(peugeot?.without.filters.make, ['kia']);
  const kia = chips.find((chip) => chip.key === 'make:kia');
  assert.deepEqual(kia?.without.filters.make, ['peugeot']);
  const price = chips.find((chip) => chip.key === 'price');
  assert.equal(price?.without.filters.price, undefined);
  assert.equal(Object.keys(price?.without.filters ?? {}).length, Object.keys(search.filters).length - 1);
});

test('removing a chip from a catalogue leaves the catalogue', () => {
  const [chip] = chipsOf(catalogueSearch('karshenas-pick'));
  assert.ok(chip !== undefined);
  assert.equal(chip.without.catalogue, undefined);
});

test('the vocabulary for plain-Farsi search lists every filter, catalogue and order, with values in code', () => {
  const vocabulary = searchVocabulary();
  assert.equal(vocabulary.filters.length, FILTERS.length);
  assert.equal(vocabulary.catalogues.length, CATALOGUES.length);
  const fuel = vocabulary.filters.find((filter) => filter.id === 'fuel');
  assert.ok(fuel?.values?.some((value) => value.value === 'dual_fuel_factory'));
  assert.equal(vocabulary.filters.find((filter) => filter.id === 'make')?.valuesFrom, 'make');
  assert.equal(vocabulary.filters.find((filter) => filter.id === 'price')?.unit, 'tomans');
  // The same input gives the same text, so a prompt built from it has a stable version.
  assert.equal(JSON.stringify(searchVocabulary()), JSON.stringify(vocabulary));
});
