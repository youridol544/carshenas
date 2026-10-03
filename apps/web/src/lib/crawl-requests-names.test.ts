import { expect, test } from 'vitest';
import { carNameOf } from '@/lib/crawl-requests-names';

test('a trim names its car with its own Persian name, in Persian digits', () => {
  expect(
    carNameOf({
      makeFa: 'پژو',
      makeEn: 'Peugeot',
      modelFa: 'پژو ۲۰۶',
      modelEn: 'Peugeot 206',
      trimFa: 'پژو 206 تیپ ۵',
    }),
  ).toBe('پژو ۲۰۶ تیپ ۵');
});

test('a model without a Persian name takes its make’s Persian name in place of the English one', () => {
  expect(
    carNameOf({ makeFa: 'آلفارومئو', makeEn: 'Alfa Romeo', modelFa: null, modelEn: 'Alfa Romeo MiTo' }),
  ).toBe('آلفارومئو MiTo');
  expect(carNameOf({ makeFa: null, makeEn: 'Amg', modelFa: null, modelEn: 'Amg Arka' })).toBe('Amg Arka');
});
