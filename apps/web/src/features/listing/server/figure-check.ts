import 'server-only';
import type { Explanation } from '@/features/listing/listing-explanation';
import type { ExpectedFigures } from '@/server/db/listing-test-database';

// Checks an explanation's figures against the recomputation of the same numbers from the stored rows
// (expectedFigures in src/server/db/listing-test-database.ts), for the faithfulness tests of CS-64.

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
  }
  return { checked, wrong, unverified };
}
