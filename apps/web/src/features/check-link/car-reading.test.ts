import { fixtureLexicon } from '@carshenas/search/understand/fixture';
import { describe, expect, test } from 'vitest';
import { coverageOf, readCarOfLink } from '@/features/check-link/car-reading';

// The ten models Carshenas reads in depth on 2026-10-04 (tracked_model, state tracking), as the fixture catalogue names them.
const coverage = coverageOf([
  'dena.plus',
  'peugeot.206',
  'peugeot.405',
  'peugeot.207i',
  'peugeot.pars',
  'pride.131',
  'quick.manual',
  'samand.lx',
  'samand.soren',
  'toyota.corolla',
]);
const lexicon = fixtureLexicon();
const read = (slug: string | null) => readCarOfLink(slug, lexicon, coverage);

describe('a link whose title names a car', () => {
  test('a model Carshenas reads is covered, however the title writes it', () => {
    expect(read('پژو-۲۰۶-تیپ-۵-مدل-۱۳۹۸')).toEqual({ kind: 'model', modelKey: 'peugeot.206', covered: true });
    expect(read('206-تیپ-2')).toEqual({ kind: 'model', modelKey: 'peugeot.206', covered: true });
    expect(read('پراید-۱۳۱-مدل-۹۶')).toEqual({ kind: 'model', modelKey: 'pride.131', covered: true });
  });

  test('a model the catalogue has and Carshenas does not read is named and not covered', () => {
    expect(read('Hyundai-Elantra-2012')).toEqual({
      kind: 'model',
      modelKey: 'hyundai.elantra',
      covered: false,
    });
    expect(read('Kia-Cerato')).toEqual({ kind: 'model', modelKey: 'kia.cerato', covered: false });
  });

  test('a make none of whose models is read settles the question without the model', () => {
    expect(read('هیوندای-النترا-مدل-۹۸')).toEqual({ kind: 'make_outside', makeKey: 'hyundai' });
    expect(read('کیا-سراتو-۲۰۱۶')).toEqual({ kind: 'make_outside', makeKey: 'kia' });
  });
});

describe('a link whose car cannot be told is never called unsupported', () => {
  test('the short form carries no title', () => {
    expect(read(null)).toEqual({ kind: 'unreadable', reason: 'no_title', makeKey: null });
  });

  test('a title that names no car, or two', () => {
    expect(read('فروش-فوری-خودرو')).toEqual({ kind: 'unreadable', reason: 'no_car', makeKey: null });
    expect(read('پژو-۲۰۶-و-پژو-۴۰۵')).toEqual({ kind: 'unreadable', reason: 'two_cars', makeKey: null });
  });

  test('a make some of whose models are read does not settle which model the title is about', () => {
    expect(read('پراید-مدل-۹۵')).toEqual({ kind: 'unreadable', reason: 'make_only', makeKey: 'pride' });
    expect(read('دنا-اتومات-صفر-۴۰۵')).toEqual({ kind: 'unreadable', reason: 'make_only', makeKey: 'dena' });
  });
});

test('coverage names the makes of its models', () => {
  expect(coverage.makeKeys).toEqual(new Set(['dena', 'peugeot', 'pride', 'quick', 'samand', 'toyota']));
  expect(coverageOf([]).makeKeys.size).toBe(0);
});
