import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fitValuation, predictLn, type Comparable } from './fit.ts';
import { at, cholesky, choleskySolve, inverseQuadraticForm } from './linear-algebra.ts';
import { dealRatingForGap, SHARED_PRIORS, type ListingAttributes } from './method.ts';

// The valuation fit (CS-51, S01 "The price model"): it recovers known coefficients from synthetic listings, holds
// every coefficient inside its bounds, lets a thin model borrow the pooled slope, drops price outliers, and rates at
// the thresholds' edges.

const YEAR = 1405;

function defined<T>(value: T | undefined): T {
  assert.ok(value !== undefined);
  return value;
}

/** A deterministic generator, so the synthetic markets are the same on every run. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function attributes(overrides: Partial<ListingAttributes>): ListingAttributes {
  return {
    modelYearSh: 1400,
    mileageKm: 100_000,
    gearbox: 'manual',
    fuel: 'petrol',
    bodyCondition: 'intact',
    frontChassisCondition: 'intact',
    rearChassisCondition: 'intact',
    colourFamily: 'white',
    daysBeforeAsOf: 0,
    ...overrides,
  };
}

type Truth = { level: number; ageSlope: number; mileage: number; painted: number; noise: number };

function market(
  seed: number,
  models: readonly { modelId: number; count: number; truth: Truth }[],
): Comparable[] {
  const next = random(seed);
  let listingId = 1;
  return models.flatMap(({ modelId, count, truth }) =>
    Array.from({ length: count }, () => {
      const modelYearSh = 1390 + Math.floor(next() * 15);
      const age = Math.max(YEAR - modelYearSh, 0);
      const mileageKm = Math.round(Math.max(age, 0.5) * 20_000 * (0.5 + next()));
      const painted = next() < 0.25;
      const deviation = (mileageKm - 20_000 * Math.max(age, 0.5)) / 100_000;
      const ln =
        truth.level +
        truth.ageSlope * age +
        truth.mileage * deviation +
        (painted ? truth.painted : 0) +
        truth.noise * (next() - 0.5);
      return {
        listingId: listingId++,
        modelId,
        trimId: null,
        attributes: attributes({
          modelYearSh,
          mileageKm,
          bodyCondition: painted ? 'partly_repainted' : 'intact',
        }),
        askingPriceToman: Math.round(Math.exp(ln)),
      };
    }),
  );
}

test('the solver inverts a small positive definite system', () => {
  const a = { size: 3, values: Float64Array.from([4, 2, 0, 2, 5, 1, 0, 1, 3]) };
  const rhs = [2, 1, 3];
  const l = cholesky(a);
  const x = choleskySolve(l, rhs);
  for (let i = 0; i < 3; i++) {
    let back = 0;
    for (let j = 0; j < 3; j++) back += at(a.values, i * 3 + j) * at(x, j);
    assert.ok(Math.abs(back - at(rhs, i)) < 1e-12);
  }
  // e₁ᵀ A⁻¹ e₁ equals the first coordinate of the solution of A x = e₁.
  const first = at(choleskySolve(l, [1, 0, 0]), 0);
  assert.ok(Math.abs(inverseQuadraticForm(l, new Map([[0, 1]])) - first) < 1e-12);
});

test('recovers the true coefficients of a synthetic market within tolerance', () => {
  const truth = {
    level: Math.log(1_500_000_000),
    ageSlope: -0.07,
    mileage: -0.1,
    painted: -0.08,
    noise: 0.04,
  };
  const comparables = market(1, [
    { modelId: 1, count: 400, truth },
    { modelId: 2, count: 400, truth: { ...truth, level: Math.log(900_000_000), ageSlope: -0.05 } },
  ]);
  const { model, segments } = fitValuation(comparables, YEAR);
  assert.ok(
    Math.abs(defined(model.models.get(1)).ageSlope - -0.07) < 0.01,
    `slope ${defined(model.models.get(1)).ageSlope}`,
  );
  assert.ok(Math.abs(defined(model.models.get(2)).ageSlope - -0.05) < 0.01);
  assert.ok(
    Math.abs(model.shared.mileage_deviation - -0.1) < 0.03,
    `mileage ${model.shared.mileage_deviation}`,
  );
  assert.ok(Math.abs(model.shared.body_painted - -0.08) < 0.02, `painted ${model.shared.body_painted}`);
  for (const segment of segments) {
    assert.equal(segment.comparableCount > 390, true);
    assert.ok(defined(segment.errorPct ?? undefined) < 2, `error ${segment.errorPct}`);
    assert.equal(segment.ratesListings, true);
  }
});

test('holds a coefficient at its bound when the data say otherwise', () => {
  // Painted cars priced 10 % higher in a noisy market: the fit must not learn that paint raises a price.
  const truth = { level: Math.log(1_000_000_000), ageSlope: -0.06, mileage: -0.08, painted: 0.1, noise: 0.2 };
  const { model } = fitValuation(market(2, [{ modelId: 1, count: 400, truth }]), YEAR);
  assert.equal(model.shared.body_painted, Math.log1p(SHARED_PRIORS.body_painted.max));
  for (const [term, prior] of Object.entries(SHARED_PRIORS)) {
    const value = model.shared[term as keyof typeof SHARED_PRIORS];
    assert.ok(value >= Math.log1p(prior.min) - 1e-12 && value <= Math.log1p(prior.max) + 1e-12, term);
  }
});

test('a thin model borrows the pooled age slope and is not rated', () => {
  const truth = {
    level: Math.log(1_000_000_000),
    ageSlope: -0.09,
    mileage: -0.08,
    painted: -0.06,
    noise: 0.03,
  };
  const comparables = market(3, [
    { modelId: 1, count: 300, truth },
    // Four listings of a cheaper model, whose own slope is noise: its slope stays near the pooled one.
    { modelId: 2, count: 4, truth: { ...truth, level: Math.log(400_000_000) } },
  ]);
  const { model, segments } = fitValuation(comparables, YEAR);
  const thin = defined(model.models.get(2));
  assert.ok(Math.abs(thin.ageSlope - model.shared.age_slope) < 0.01, `thin slope ${thin.ageSlope}`);
  assert.ok(Math.abs(thin.level - Math.log(400_000_000)) < 0.1, `thin level ${thin.level}`);
  const segment = defined(segments.find((s) => s.modelId === 2));
  assert.equal(segment.comparableCount, 4);
  assert.equal(segment.ratesListings, false);
});

test('drops listings priced far from their model as outliers', () => {
  const truth = {
    level: Math.log(1_000_000_000),
    ageSlope: -0.06,
    mileage: -0.08,
    painted: -0.06,
    noise: 0.03,
  };
  const comparables = market(4, [{ modelId: 1, count: 100, truth }]);
  const placeholder = { ...defined(comparables[0]), listingId: 9001, askingPriceToman: 11_000_000 };
  const doubled = {
    ...defined(comparables[1]),
    listingId: 9002,
    askingPriceToman: defined(comparables[1]).askingPriceToman * 2,
  };
  const { comparables: fitted, segments } = fitValuation([...comparables, placeholder, doubled], YEAR);
  const outliers = fitted.filter((c) => c.isOutlier).map((c) => c.comparable.listingId);
  assert.deepEqual(outliers.sort(), [9001, 9002]);
  assert.equal(defined(segments[0]).comparableCount, 100);
});

test('predicts on the run day from the stored coefficients alone', () => {
  const truth = {
    level: Math.log(1_000_000_000),
    ageSlope: -0.06,
    mileage: -0.08,
    painted: -0.06,
    noise: 0.03,
  };
  const { model } = fitValuation(market(5, [{ modelId: 1, count: 60, truth }]), YEAR);
  const listing = {
    modelId: 1,
    trimId: null,
    attributes: attributes({ modelYearSh: 1398, mileageKm: 140_000 }),
  };
  const ln = defined(predictLn(model, listing, YEAR));
  const expected = Math.log(1_000_000_000) - 0.06 * 7 - 0.08 * 0;
  assert.ok(Math.abs(ln - expected) < 0.05, `ln ${ln} against ${expected}`);
  assert.equal(predictLn(model, { ...listing, modelId: 99 }, YEAR), undefined);
});

test('rates by price gap at the thresholds of S01', () => {
  const cases: readonly (readonly [number, string])[] = [
    [-25, 'great'],
    [-10, 'great'],
    [-9.99, 'good'],
    [-4, 'good'],
    [-3.99, 'fair'],
    [0, 'fair'],
    [3.99, 'fair'],
    [4, 'high'],
    [9.99, 'high'],
    [10, 'overpriced'],
    [80, 'overpriced'],
  ];
  for (const [gap, rating] of cases) assert.equal(dealRatingForGap(gap), rating, `gap ${gap}`);
});
