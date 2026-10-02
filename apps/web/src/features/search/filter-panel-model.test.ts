// @vitest-environment node
import { expect, test } from 'vitest';
import { FILTERS } from '@carshenas/search/filters';
import {
  appliedIn,
  FEATURED_FILTER_IDS,
  normalizeForMatch,
  panelLayout,
  toggled,
  withFilter,
} from '@/features/search/filter-panel-model';

test('every filter has exactly one place in the panel, and the source filter waits for a second source', () => {
  const layout = panelLayout(2);
  const placed = [...layout.featured, ...layout.groups.flatMap((group) => group.filters)].map(
    (filter) => filter.id,
  );
  expect(placed.toSorted()).toEqual(FILTERS.map((filter) => filter.id).toSorted());
  expect(new Set(placed).size).toBe(placed.length);

  const alone = panelLayout(1);
  const aloneIds = [...alone.featured, ...alone.groups.flatMap((group) => group.filters)].map(
    (filter) => filter.id,
  );
  expect(aloneIds).not.toContain('source');
  expect(aloneIds).toHaveLength(FILTERS.length - 1);
  expect(panelLayout(0).groups.flatMap((group) => group.filters.map((filter) => filter.id))).not.toContain(
    'source',
  );
});

test('the featured filters come first, in the definitions’ order, and the groups follow the sheet’s order', () => {
  const layout = panelLayout(1);
  expect(layout.featured.map((filter) => filter.id)).toEqual(
    FILTERS.map((filter) => filter.id).filter((id) =>
      (FEATURED_FILTER_IDS as readonly string[]).includes(id),
    ),
  );
  expect(layout.groups.map((group) => group.group)).toEqual([
    'car',
    'condition',
    'terms',
    'place',
    'listing',
  ]);
});

test('applied filters are counted among the ones asked about', () => {
  const layout = panelLayout(1);
  const filters = { paint_free: true as const, no_accident: true as const, make: ['peugeot'] };
  expect(appliedIn(filters, layout.featured)).toBe(1);
  expect(appliedIn(filters, layout.groups.find((group) => group.group === 'condition')?.filters ?? [])).toBe(
    2,
  );
});

test('a filter is set, replaced and removed without touching the others', () => {
  const start = { make: ['peugeot'] };
  expect(withFilter(start, 'paint_free', true)).toEqual({ make: ['peugeot'], paint_free: true });
  expect(withFilter(start, 'make', ['kia'])).toEqual({ make: ['kia'] });
  expect(withFilter(start, 'make', undefined)).toEqual({});
  expect(start).toEqual({ make: ['peugeot'] });
});

test('a value the shared schema refuses leaves the filters as they were', () => {
  const start = { make: ['peugeot'] };
  expect(withFilter(start, 'price', { min: 5, max: 1 })).toEqual(start);
  expect(withFilter(start, 'deal', 'excellent')).toEqual(start);
});

test('a choice toggles one value and is no filter when it is empty', () => {
  expect(toggled(undefined, 'a', true)).toEqual(['a']);
  expect(toggled(['a'], 'b', true)).toEqual(['a', 'b']);
  expect(toggled(['a', 'b'], 'a', false)).toEqual(['b']);
  expect(toggled(['a'], 'a', false)).toBeUndefined();
  expect(toggled(['a'], 'a', true)).toEqual(['a']);
});

test('names and typed words are compared without digit scripts, Arabic letters, invisible marks or case', () => {
  expect(normalizeForMatch('پژو ۲۰۶')).toBe(normalizeForMatch('پژو 206'));
  expect(normalizeForMatch('علي')).toBe(normalizeForMatch('علی'));
  expect(normalizeForMatch('كوييك')).toBe(normalizeForMatch('کوییک'));
  expect(normalizeForMatch('  Sonata   GLS ')).toBe('sonata gls');
  expect(normalizeForMatch(`می${String.fromCharCode(0x200c)}خواهم`)).toBe('میخواهم');
});
