import 'server-only';
import { toPersianDigits } from '@carshenas/locale/digits';
import { formatDate } from '@carshenas/locale/format-date';
import { formatCount, formatMileage, formatPercent } from '@carshenas/locale/format-number';
import { formatTomanEstimate, toToman } from '@carshenas/locale/toman';
import type { Explanation } from '@/features/listing/listing-explanation';
import type { ExpectedFigures } from '@/server/db/listing-test-database';

// Checks an explanation's figures against the recomputation of the same numbers from the stored rows
// (expectedFigures in src/server/db/listing-test-database.ts), for the faithfulness tests of CS-64.

const py = (value: number) => toPersianDigits(String(value));
const range = (low: number, high: number, one: (value: number) => string, last = one) =>
  low === high ? last(low) : `${one(low)} تا ${last(high)}`;
const wholePercent = (value: number) => formatPercent(Math.round(Math.abs(value)) / 100);

/**
 * How the page must write a figure, from the recomputed values alone: the displayed text is checked as well as the
 * number, so a figure cannot be right in the rows and wrong on the screen. `gap` is the one with words around its number
 * (the digits are checked).
 */
export function expectedText(id: string, values: readonly number[]): string | undefined {
  const [first = Number.NaN, second = Number.NaN] = values;
  if (id.startsWith('adjustment_') || id === 'age_slope') return wholePercent(first);
  switch (id) {
    case 'market_value':
      return formatTomanEstimate(toToman(first));
    case 'run_date':
      return formatDate(new Date(first).toISOString().slice(0, 10));
    case 'gap':
      return Math.round(Math.abs(first)) === 0 ? undefined : wholePercent(first);
    case 'segment_count':
    case 'near_count':
    case 'window_days':
    case 'method_version':
      return formatCount(first);
    case 'segment_years':
    case 'near_years_range':
      return range(first, second, py);
    case 'near_km_range':
      return range(first, second, formatCount, formatMileage);
    case 'segment_error':
      return formatPercent(first / 100);
    case 'model_year':
      return py(first);
    case 'mileage':
    case 'mileage_away':
    case 'mileage_norm':
    case 'method_norm':
      return formatMileage(first);
    default:
      return undefined;
  }
}

/** The figures that are rules, not rows: the explanation quotes them, and the tests read them from the rules' own homes. */
export const RULE_FIGURES = new Set([
  'min_comparables',
  'max_segment_error',
  'min_near_year',
  'near_years',
  'installment_guard',
  'outlier_factor',
]);

export type FigureCheck = {
  readonly checked: number;
  readonly wrong: readonly string[];
  readonly unverified: readonly string[];
};

/** Compares each figure of an explanation with the recomputation: the ones that do not match, and the ones nothing checks. */
export function checkFigures(explanation: Explanation, expected: ExpectedFigures): FigureCheck {
  const wrong: string[] = [];
  const unverified: string[] = [];
  let checked = 0;
  for (const figure of explanation.figures) {
    if (RULE_FIGURES.has(figure.id)) continue;
    const truth = expected.get(figure.id);
    if (truth === undefined) {
      unverified.push(figure.id);
      continue;
    }
    checked += 1;
    const same =
      truth.length === figure.values.length &&
      truth.every(
        (value, index) =>
          Math.abs(value - (figure.values[index] ?? Number.NaN)) < 1e-6 * Math.max(1, Math.abs(value)),
      );
    if (!same) wrong.push(`${figure.id}: shown ${figure.values.join(',')} stored ${truth.join(',')}`);
    const text = expectedText(figure.id, truth);
    if (text === undefined) {
      if (figure.id !== 'gap') unverified.push(`${figure.id} (text)`);
    } else if (figure.id === 'gap' ? !figure.text.includes(text) : figure.text !== text) {
      wrong.push(`${figure.id}: displays «${figure.text}», the stored values write «${text}»`);
    }
  }
  return { checked, wrong, unverified };
}
