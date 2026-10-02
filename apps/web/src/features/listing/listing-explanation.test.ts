// @vitest-environment node
import { expect, test } from 'vitest';
import { toLatinDigits } from '@carshenas/locale/digits';
import { formatMileage } from '@carshenas/locale/format-number';
import {
  adjustmentPct,
  buildExplanation,
  mileageAboveNorm,
  valuationAge,
  type Explanation,
} from '@/features/listing/listing-explanation';
import {
  comparablesFixture,
  listingFactsFixture,
  valuationFactsFixture,
} from '@/features/listing/listing-fixtures';
import type { NoRatingReason } from '@/features/listing/listing-types';

const NO_BREAK_SPACE = '\u00A0';

// «چرا این ارزیابی؟» is written by code from stored facts (CS-64): these tests prove that each number is a recorded
// figure with its source, that every digit group of the text belongs to a figure, and that the sizes are the price
// model's own arithmetic. listing-explanation.db.test.ts checks the figures against the database.

/** Every run of digits in a text, in Latin digits, without separators: «۱٬۲۲۳٬۰۰۰٬۰۰۰» is 1223000000. */
export function digitGroups(text: string): string[] {
  return (
    toLatinDigits(text)
      .replace(/(?<=\d)[٬,](?=\d)/g, '')
      .match(/\d+(?:[.٫]\d+)?/g) ?? []
  );
}

/** The text a buyer reads, without the catalogue names it quotes (a name's own digits are stored text, not figures). */
function allText(explanation: Explanation): string {
  let text = [explanation.verdict, ...explanation.lines.map((line) => line.text), ...explanation.method].join(
    '\n',
  );
  for (const name of explanation.names) text = text.replaceAll(name, '');
  return text;
}

/** The digit groups of every figure's own text. */
function figureGroups(explanation: Explanation): Set<string> {
  return new Set(explanation.figures.flatMap((figure) => digitGroups(figure.text)));
}

const input = () => ({
  listing: listingFactsFixture(),
  valuation: valuationFactsFixture(),
  comparables: comparablesFixture(),
});

test('every digit group of the explanation is the text of a recorded figure', () => {
  const explanation = buildExplanation(input());
  const allowed = figureGroups(explanation);
  const stray = digitGroups(allText(explanation)).filter((group) => !allowed.has(group));
  expect(stray).toEqual([]);
  // The model's year, the market value, its date and the comparables' count are among them.
  const ids = explanation.figures.map((figure) => figure.id);
  expect(ids).toEqual(
    expect.arrayContaining(['market_value', 'run_date', 'segment_count', 'segment_years', 'gap']),
  );
});

test('every figure names where it comes from', () => {
  for (const figure of buildExplanation(input()).figures) {
    expect(figure.source.length).toBeGreaterThan(5);
    expect(figure.values.length).toBeGreaterThan(0);
    expect(figure.values.every((value) => Number.isFinite(value))).toBe(true);
  }
});

test('the verdict is the gap in whole percent and the rating comes with it', () => {
  const explanation = buildExplanation(input());
  expect(explanation.verdict).toBe('قیمت این آگهی ۲۱٪ زیر ارزش بازار است.'.replace('٪', '\u200F٪'));
  const gap = explanation.figures.find((figure) => figure.id === 'gap');
  expect(gap?.values).toEqual([-21.49]);
});

test('an adjustment is exp(coefficient × the car’s value) − 1, shown in whole percent, largest first', () => {
  const explanation = buildExplanation(input());
  const ids = explanation.lines.filter((line) => line.direction !== undefined).map((line) => line.id);
  // 160,000 km at 1395 is 10 years old: 200,000 km is the norm, so 40,000 km below it raises the value by 3 %.
  expect(mileageAboveNorm(160_000, valuationAge(1405, 1395), 20_000)).toBe(-40_000);
  expect(adjustmentPct(-0.08, -0.4)).toBeCloseTo(3.25, 2);
  expect(adjustmentPct(0.095, 1)).toBeCloseTo(9.97, 2);
  expect(ids).toContain('gearbox_automatic');
  expect(ids).toContain('mileage_deviation');
  expect(ids).toContain('body_minor');
  expect(ids).not.toContain('off_colour');
  // The age comes first, then the sizes run from the largest to the smallest.
  const sizes = ids.map((id) => {
    const figure = explanation.figures.find(
      (candidate) => candidate.id === (id === 'age' ? 'age_slope' : `adjustment_${id}`),
    );
    return Math.abs(figure?.values[0] ?? 0);
  });
  expect(ids[0]).toBe('age');
  const rest = sizes.slice(1);
  expect(rest).toEqual([...rest].sort((first, second) => second - first));
  const mileageLine = explanation.lines.find((line) => line.id === 'mileage_deviation');
  expect(mileageLine?.text).toContain(formatMileage(160_000));
  expect(mileageLine?.text).toContain(formatMileage(40_000));
  expect(mileageLine?.text).toContain('کمتر از کارکرد معمول');
  expect(mileageLine?.direction).toBe('up');
});

test('an effect under half a percent is left out: it does not move the value', () => {
  const explanation = buildExplanation({
    ...input(),
    valuation: valuationFactsFixture({
      coefficients: { gearbox_automatic: 0.004, body_minor: -0.0001 },
      modelAgeSlope: null,
    }),
    listing: listingFactsFixture({ mileageKm: null }),
  });
  expect(explanation.lines.some((line) => line.direction !== undefined)).toBe(false);
});

test('the figures of the comparables are their count and the ranges of the listed ones', () => {
  const explanation = buildExplanation(input());
  const byId = (id: string) => explanation.figures.find((figure) => figure.id === id)?.values;
  expect(byId('segment_count')).toEqual([412]);
  expect(byId('segment_years')).toEqual([1380, 1404]);
  expect(byId('near_count')).toEqual([3]);
  expect(byId('near_years_range')).toEqual([1394, 1396]);
  expect(byId('near_km_range')).toEqual([90_000, 200_000]);
  expect(byId('segment_error')).toEqual([7]);
});

const REASONS: readonly NoRatingReason[] = [
  'unmatched_model',
  'missing_attributes',
  'excluded_condition',
  'too_few_comparables',
  'uncertain_segment',
  'year_out_of_range',
  'unknown_price',
  'no_asking_price',
  'placeholder_price',
  'installment_price',
  'dealer_new_car',
  'price_outlier',
];

test('every reason for no rating has its sentence, and its numbers are figures too', () => {
  for (const reason of REASONS) {
    const explanation = buildExplanation({
      ...input(),
      valuation: valuationFactsFixture({ dealRating: null, priceGapPct: null, noRatingReason: reason }),
    });
    const line = explanation.lines.find((candidate) => candidate.id === 'reason');
    expect(line?.text.length).toBeGreaterThan(20);
    expect(explanation.verdict).toContain('ارزیابی نمی‌کنیم');
    const allowed = figureGroups(explanation);
    expect(digitGroups(allText(explanation)).filter((group) => !allowed.has(group))).toEqual([]);
  }
});

test('an instalment listing’s reason says the price is a down payment; a guarded one names the 20 %', () => {
  const instalment = buildExplanation({
    ...input(),
    listing: listingFactsFixture({
      priceType: 'installment',
      askingPriceToman: null,
      downPaymentToman: 200_000_000,
    }),
    valuation: valuationFactsFixture({
      dealRating: null,
      priceGapPct: null,
      ratedPriceToman: null,
      noRatingReason: 'installment_price',
    }),
  });
  expect(instalment.lines.find((line) => line.id === 'reason')?.text).toContain('پیش‌پرداخت');
  const guarded = buildExplanation({
    ...input(),
    listing: listingFactsFixture({ acceptsInstallments: true }),
    valuation: valuationFactsFixture({
      dealRating: null,
      priceGapPct: null,
      noRatingReason: 'installment_price',
    }),
  });
  expect(guarded.figures.map((figure) => figure.id)).toContain('installment_guard');
});

test('a listing with no valuation says so, with no number to invent', () => {
  const explanation = buildExplanation({ ...input(), valuation: null });
  expect(explanation.figures).toEqual([]);
  expect(digitGroups(allText(explanation))).toEqual([]);
});

test('a listing with no year gets no adjustments for age or mileage, and no crash', () => {
  const explanation = buildExplanation({
    ...input(),
    listing: listingFactsFixture({ modelYearSh: null, mileageKm: null }),
  });
  expect(explanation.lines.some((line) => line.direction !== undefined)).toBe(false);
});

test('the method paragraph quotes the run’s own window, norm and version', () => {
  const explanation = buildExplanation(input());
  const ids = explanation.figures.map((figure) => figure.id);
  expect(ids).toEqual(expect.arrayContaining(['window_days', 'method_norm', 'method_version']));
  expect(explanation.method.join(' ')).toContain(`۳۰${NO_BREAK_SPACE}روز`);
});
