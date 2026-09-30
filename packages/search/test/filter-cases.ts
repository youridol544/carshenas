// Each filter's test (CS-58 criterion 5): values and the fixtures of fixtures.ts each one must keep, exactly. The type
// makes a filter without cases a compile error, and search.test.ts fails when a filter's cases never both keep and
// drop a fixture; filters.db.test.ts runs every case through its SQL on the scratch database.
import type { CatalogueId } from '../src/catalogues.ts';
import type { FilterId } from '../src/filters.ts';
import type { FilterValue } from '../src/search.ts';
import { YEAR, type FixtureName } from './fixture-names.ts';

export type FilterCase<Id extends FilterId> = {
  readonly value: FilterValue<Id>;
  readonly keeps: readonly FixtureName[];
};

export const FILTER_CASES: { readonly [Id in FilterId]: readonly FilterCase<Id>[] } = {
  make: [
    { value: ['tst-alpha'], keeps: ['A', 'B', 'D'] },
    { value: ['tst-alpha', 'tst-beta'], keeps: ['A', 'B', 'C', 'D'] },
  ],
  model: [{ value: ['tst-alpha.city'], keeps: ['A', 'B'] }],
  trim: [{ value: ['tst-alpha.city.base'], keeps: ['A'] }],
  body_type: [
    { value: ['suv'], keeps: ['C'] },
    { value: ['sedan', 'hatchback'], keeps: ['A', 'B', 'D'] },
  ],
  year: [
    { value: { min: YEAR - 3 }, keeps: ['A', 'C', 'D'] },
    { value: { max: YEAR - 3 }, keeps: ['A', 'B'] },
    { value: { min: YEAR - 8, max: YEAR - 1 }, keeps: ['A', 'B', 'C'] },
  ],
  age: [
    { value: 3, keeps: ['A', 'C', 'D'] },
    { value: 0, keeps: ['D'] },
  ],
  mileage: [
    { value: { max: 20_000 }, keeps: ['A', 'C', 'D'] },
    { value: { min: 100_000 }, keeps: ['B'] },
  ],
  low_mileage_for_age: [{ value: true, keeps: ['A', 'C', 'D'] }],
  popular_model: [{ value: true, keeps: ['A', 'B', 'D'] }],
  price: [
    { value: { max: 1_000_000_000 }, keeps: ['A', 'D', 'E'] },
    { value: { min: 1_000_000_000 }, keeps: ['B'] },
    { value: { min: 800_000_000, max: 950_000_000 }, keeps: ['A', 'D'] },
  ],
  deal: [
    { value: 'great', keeps: ['A'] },
    { value: 'good', keeps: ['A', 'B'] },
    { value: 'overpriced', keeps: ['A', 'B', 'D', 'E'] },
  ],
  gearbox: [{ value: ['automatic'], keeps: ['B', 'C'] }],
  fuel: [{ value: ['dual_fuel_factory', 'hybrid'], keeps: ['B', 'C'] }],
  colour: [{ value: ['white'], keeps: ['A', 'B'] }],
  paint_free: [{ value: true, keeps: ['A', 'D'] }],
  body_condition: [
    { value: 'minor_scratches', keeps: ['A'] },
    { value: 'repainted_around', keeps: ['A', 'B'] },
  ],
  engine_condition: [
    { value: ['sound'], keeps: ['A', 'B'] },
    { value: ['replaced'], keeps: ['C'] },
  ],
  gearbox_condition: [{ value: ['sound'], keeps: ['A', 'B', 'C'] }],
  chassis: [
    { value: ['intact'], keeps: ['A', 'B', 'D'] },
    { value: ['repainted'], keeps: ['E'] },
    { value: ['damaged'], keeps: ['C'] },
  ],
  no_accident: [{ value: true, keeps: ['A', 'D', 'E'] }],
  no_replaced_parts: [{ value: true, keeps: ['A', 'C', 'D', 'E'] }],
  not_ride_hailing: [{ value: true, keeps: ['A', 'C', 'D', 'E'] }],
  insurance: [
    { value: 6, keeps: ['A'] },
    { value: 3, keeps: ['A', 'B'] },
  ],
  swap: [{ value: true, keeps: ['A', 'D'] }],
  installments: [{ value: true, keeps: ['B', 'D'] }],
  no_free_zone_plate: [{ value: true, keeps: ['A', 'B', 'D', 'E'] }],
  city: [{ value: ['tst-city-b'], keeps: ['C'] }],
  district: [{ value: ['tst-city-a.ونک'], keeps: ['A'] }],
  seller: [{ value: ['dealer'], keeps: ['B', 'E'] }],
  source: [{ value: ['tst_search_b'], keeps: ['B'] }],
  has_photo: [{ value: true, keeps: ['A', 'C'] }],
  posted_within: [
    { value: 1, keeps: ['A'] },
    { value: 3, keeps: ['A', 'D'] },
  ],
};

/** What each catalogue keeps of the fixtures; a catalogue missing here is a compile error. */
export const CATALOGUE_CASES: Readonly<Record<CatalogueId, readonly FixtureName[]>> = {
  'karshenas-pick': ['A'],
  'great-deals-under-1b': ['A'],
  'clean-and-easy': ['A'],
  family: ['A', 'B'],
  'low-mileage': ['A', 'C', 'D'],
  automatic: ['B'],
  'ride-hailing': ['A', 'B'],
  installments: ['B', 'D'],
  newest: ['A'],
};
