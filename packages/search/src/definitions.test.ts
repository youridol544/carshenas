import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CATALOGUE_CASES, FILTER_CASES } from '../test/filter-cases.ts';
import { FIXTURE_NAMES } from '../test/fixture-names.ts';
import { CATALOGUES } from './catalogues.ts';
import { FILTERS } from './filters.ts';
import { DATABASE_OPTIONS, FILTER_GROUPS } from './kinds.ts';
import { SearchFiltersSchema } from './search.ts';
import { SORTS } from './sorts.ts';

// The registry's own rules (CS-58 criteria 1, 2 and 5): every filter, catalogue and order carries its Farsi label and
// description, and every filter and catalogue has cases that the integration tests run. A definition that lacks any
// of them fails here.

const PERSIAN_LETTER = /[\u0600-\u06FF]/;
// Arabic yeh and kaf where Persian ones belong, and invisible characters other than the zero-width non-joiner and
// the no-break space the locale's formatters put between a number and its unit, and the right-to-left mark
// formatPercent puts before a percent sign (a stray one anywhere else is still refused).
const WRONG_CHARACTERS = /[\u064A\u0643\u200B\u200E\u202A-\u202E\u2060-\u2069\u061C\uFEFF]|\u200F(?!\u066A)/;

function assertFarsi(text: string, what: string) {
  assert.ok(text.trim() !== '', `${what} is empty`);
  assert.match(text, PERSIAN_LETTER, `${what} is not in Farsi: ${text}`);
  assert.doesNotMatch(
    text,
    WRONG_CHARACTERS,
    `${what} has an Arabic letter or an invisible character: ${text}`,
  );
}

test('every filter has a Farsi label, a Farsi description that ends a sentence, buyer words and a group', () => {
  for (const filter of FILTERS) {
    assertFarsi(filter.label, `${filter.id}'s label`);
    assertFarsi(filter.description, `${filter.id}'s description`);
    assert.match(filter.description, /\.$/, `${filter.id}'s description ends with a full stop`);
    assert.ok(filter.words.length > 0, `${filter.id} has no buyer words`);
    for (const word of filter.words) assertFarsi(word, `${filter.id}'s word`);
    assert.ok(filter.group in FILTER_GROUPS, `${filter.id}'s group`);
  }
});

test('every option of a filter has a Farsi label, and a database-backed filter names where its options come from', () => {
  for (const filter of FILTERS) {
    if (filter.kind === 'choice' && filter.options === undefined) {
      assert.ok(DATABASE_OPTIONS.includes(filter.optionsFrom), filter.id);
      continue;
    }
    if (filter.kind !== 'choice' && filter.kind !== 'ranked') continue;
    const values = filter.options.map((option) => option.value);
    assert.equal(new Set(values).size, values.length, `${filter.id} repeats an option`);
    for (const option of filter.options) assertFarsi(option.label, `${filter.id}.${option.value}`);
  }
});

test('filter ids and URL parameters are unique, lower case, and clear of the search’s own parameters', () => {
  const ids = FILTERS.map((filter) => filter.id);
  const params = FILTERS.map((filter) => filter.param);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(params).size, params.length);
  for (const param of params) {
    assert.match(param, /^[a-z]{1,20}$/);
    assert.ok(!['q', 'sort', 'catalogue', 'page', 'after'].includes(param), param);
  }
});

test('the source and body-type filters, and the catalogue’s names, read their options from the database', () => {
  const fromDatabase = FILTERS.flatMap((filter) =>
    filter.kind === 'choice' && filter.options === undefined ? [filter.optionsFrom] : [],
  );
  for (const expected of ['source', 'body_type', 'make', 'model', 'trim', 'city', 'district'] as const) {
    assert.ok(fromDatabase.includes(expected), expected);
  }
});

test('every filter has cases that both keep and drop a fixture', () => {
  for (const filter of FILTERS) {
    const cases = FILTER_CASES[filter.id];
    assert.ok(cases.length > 0, `${filter.id} has no test`);
    assert.ok(
      cases.some((entry) => entry.keeps.length > 0),
      `${filter.id} has no case that keeps a fixture`,
    );
    assert.ok(
      cases.some((entry) => entry.keeps.length < FIXTURE_NAMES.length),
      `${filter.id} has no case that drops a fixture`,
    );
    for (const entry of cases) {
      assert.ok(
        filter.schema.safeParse(entry.value).success,
        `${filter.id}'s case ${JSON.stringify(entry.value)} is not a valid value`,
      );
    }
  }
  assert.deepEqual(Object.keys(FILTER_CASES).sort(), FILTERS.map((filter) => filter.id).sort());
});

test('every catalogue has a Farsi title and description, a reason, buyer words, valid filters and a test', () => {
  const ids = CATALOGUES.map((catalogue) => catalogue.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const catalogue of CATALOGUES) {
    assert.match(catalogue.id, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assertFarsi(catalogue.title, `${catalogue.id}'s title`);
    assertFarsi(catalogue.description, `${catalogue.id}'s description`);
    assert.ok(catalogue.reason.length > 40, `${catalogue.id} does not say why it exists`);
    assert.ok(catalogue.words.length > 0, `${catalogue.id} has no buyer words`);
    assert.ok(Object.keys(catalogue.filters).length > 0, `${catalogue.id} filters nothing`);
    assert.ok(
      SearchFiltersSchema.safeParse(catalogue.filters).success,
      `${catalogue.id}'s filters are not valid`,
    );
    assert.ok(Object.hasOwn(CATALOGUE_CASES, catalogue.id), `${catalogue.id} has no test`);
  }
  assert.deepEqual(Object.keys(CATALOGUE_CASES).sort(), [...ids].sort());
});

test('«پیشنهاد کارشناس» comes first: good or better deals in good condition', () => {
  const [first] = CATALOGUES;
  assert.equal(first.id, 'karshenas-pick');
  assert.equal(first.title, 'پیشنهاد کارشناس');
  assert.equal(first.filters.deal, 'good');
  assert.equal(first.filters.paint_free, true);
  assert.deepEqual(first.filters.engine_condition, ['sound']);
});

test('the vague requests of CS-62 are expressible: clean, low mileage for its age, technically sound, trouble-free', () => {
  const clean = CATALOGUES.find((catalogue) => catalogue.id === 'clean-and-easy');
  assert.ok(clean !== undefined);
  assert.deepEqual(clean.filters, {
    paint_free: true,
    no_accident: true,
    no_replaced_parts: true,
    engine_condition: ['sound'],
    gearbox_condition: ['sound'],
    chassis: ['intact'],
    low_mileage_for_age: true,
    popular_model: true,
  });
  for (const word of ['تمیز', 'بی‌دردسر', 'کم کار']) assert.ok(clean.words.includes(word), word);
});

test('every order has a Farsi label and description and a column to order by', () => {
  for (const sort of SORTS) {
    assertFarsi(sort.label, `${sort.id}'s label`);
    assertFarsi(sort.description, `${sort.id}'s description`);
    assert.ok(sort.orderBy.length > 0);
  }
  assert.equal(SORTS[0].id, 'best_deal');
});
