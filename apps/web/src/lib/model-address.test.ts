import { expect, test } from 'vitest';
import { modelHref, modelOfKey, readYearParam } from '@/lib/model-address';

test('an address is made from the make and model slugs, with the year only when one is chosen', () => {
  expect(modelHref({ makeSlug: 'peugeot', slug: '206' })).toBe('/models/peugeot/206');
  expect(modelHref({ makeSlug: 'peugeot', slug: '206' }, 1400)).toBe('/models/peugeot/206?year=1400');
  expect(modelOfKey('peugeot.206')).toEqual({ makeSlug: 'peugeot', slug: '206' });
  expect(modelOfKey('peugeot.206.type-5')).toBeNull();
  expect(modelOfKey(null)).toBeNull();
});

test('the year parameter is one Latin four-digit Jalali year, and nothing else', () => {
  expect(readYearParam('1400')).toBe(1400);
  expect(readYearParam('۱۴۰۰')).toBeNull();
  expect(readYearParam('2026')).toBeNull();
  expect(readYearParam('1400.5')).toBeNull();
  expect(readYearParam(['1400', '1401'])).toBeNull();
  expect(readYearParam(undefined)).toBeNull();
});
