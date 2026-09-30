import {
  at,
  cholesky,
  choleskySolve,
  inverseQuadraticForm,
  zeroMatrix,
  type SquareMatrix,
} from './linear-algebra.ts';
import {
  MAX_SEGMENT_ERROR_PCT,
  MIN_SEGMENT_COMPARABLES,
  MIN_TRIM_COMPARABLES,
  MODEL_AGE_SLOPE_SCALE,
  OUTLIER_PRICE_FACTOR,
  OUTLIER_RESIDUAL_MADS,
  PRIOR_STRENGTH,
  SHARED_PRIORS,
  SHARED_TERMS,
  sharedFeatures,
  ZERO_KM_BELOW_KM,
  type ListingAttributes,
  type SharedTerm,
} from './method.ts';

// The price model of S01 ("The price model"), fitted by ridge regression toward the appraisers' priors:
//   ln(price) = level[model] + level[trim] + slope[model]·age + Σ b_term·feature_term
// with slope[model] = the pooled age slope + the model's deviation, pulled toward zero. A coefficient that leaves its
// allowed range is fixed at the bound and the rest refitted (an active set), so thin data cannot learn that paint
// raises a price. Leave-one-out predictions come from the hat matrix (exact for a ridge fit with the bounds held).

export type Comparable = {
  readonly listingId: number;
  readonly modelId: number;
  readonly trimId: number | null;
  readonly attributes: ListingAttributes;
  readonly askingPriceToman: number;
};

export type FittedModel = {
  readonly shared: Readonly<Record<SharedTerm, number>>;
  /** Per catalogue model: its level and its whole age slope, on the log scale. */
  readonly models: ReadonlyMap<number, { readonly level: number; readonly ageSlope: number }>;
  /** Per trim with enough comparables: its model and its level's offset from the model's. */
  readonly trims: ReadonlyMap<number, { readonly modelId: number; readonly level: number }>;
};

export type Segment = {
  readonly modelId: number;
  readonly comparableCount: number;
  readonly zeroKmCount: number;
  readonly minModelYearSh: number;
  readonly maxModelYearSh: number;
  readonly errorPct: number | null;
  readonly ratesListings: boolean;
};

export type FittedComparable = {
  readonly comparable: Comparable;
  readonly isOutlier: boolean;
  /** exp of the fit's prediction for the comparable on its own day, in whole tomans. */
  readonly fittedValueToman: number;
};

export type Valuation = {
  readonly model: FittedModel;
  readonly segments: readonly Segment[];
  readonly comparables: readonly FittedComparable[];
};

const LEVEL_PENALTY = 1e-8;

type Row = { readonly comparable: Comparable; readonly y: number };

type Layout = {
  readonly size: number;
  readonly modelIndex: ReadonlyMap<number, number>;
  readonly trimIndex: ReadonlyMap<number, number>;
  readonly target: readonly number[];
  readonly penalty: readonly number[];
};

const sharedIndex = new Map(SHARED_TERMS.map((term, index) => [term, index]));
const logBound = (fraction: number): number => Math.log1p(fraction);

function layoutFor(rows: readonly Row[]): Layout {
  const modelIndex = new Map<number, number>();
  const trimCounts = new Map<number, number>();
  for (const { comparable } of rows) {
    if (!modelIndex.has(comparable.modelId))
      modelIndex.set(comparable.modelId, SHARED_TERMS.length + 2 * modelIndex.size);
    if (comparable.trimId !== null)
      trimCounts.set(comparable.trimId, (trimCounts.get(comparable.trimId) ?? 0) + 1);
  }
  const trimIndex = new Map<number, number>();
  let size = SHARED_TERMS.length + 2 * modelIndex.size;
  for (const [trimId, count] of trimCounts) if (count >= MIN_TRIM_COMPARABLES) trimIndex.set(trimId, size++);
  const target = new Array<number>(size).fill(0);
  const penalty = new Array<number>(size).fill(0);
  for (const [term, index] of sharedIndex) {
    const prior = SHARED_PRIORS[term];
    target[index] = logBound(prior.prior);
    // The pooled age slope is the mean of the models' slopes, each model's deviation pulled toward it; its own prior
    // weighs one listing, or a single large model would split its slope halfway toward the prior.
    penalty[index] = (term === 'age_slope' ? 1 : PRIOR_STRENGTH) * prior.scale ** 2;
  }
  for (const index of modelIndex.values()) {
    penalty[index] = LEVEL_PENALTY;
    penalty[index + 1] = PRIOR_STRENGTH * MODEL_AGE_SLOPE_SCALE ** 2;
  }
  for (const index of trimIndex.values()) penalty[index] = PRIOR_STRENGTH;
  return { size, modelIndex, trimIndex, target, penalty };
}

function designRow(comparable: Comparable, layout: Layout, referenceYearSh: number): Map<number, number> {
  const features = sharedFeatures(comparable.attributes, referenceYearSh);
  const row = new Map<number, number>();
  for (const [term, index] of sharedIndex) if (features[term] !== 0) row.set(index, features[term]);
  const modelAt = layout.modelIndex.get(comparable.modelId);
  if (modelAt !== undefined) {
    row.set(modelAt, 1);
    if (features.age_slope !== 0) row.set(modelAt + 1, features.age_slope);
  }
  const trimAt = comparable.trimId === null ? undefined : layout.trimIndex.get(comparable.trimId);
  if (trimAt !== undefined) row.set(trimAt, 1);
  return row;
}

type Solution = {
  readonly beta: Float64Array;
  readonly factor: SquareMatrix;
  readonly free: readonly number[];
};

function required<K, V>(map: ReadonlyMap<K, V>, key: K): V {
  const value = map.get(key);
  if (value === undefined) throw new Error(`missing ${String(key)}`);
  return value;
}

/** Ridge solve with some coefficients fixed: the free ones minimise ‖y − Xβ‖² + Σ λ_j (β_j − target_j)². */
function solve(
  rows: readonly Map<number, number>[],
  ys: readonly number[],
  layout: Layout,
  fixed: ReadonlyMap<number, number>,
): Solution {
  const free = [...Array(layout.size).keys()].filter((index) => !fixed.has(index));
  const position = new Map(free.map((index, place) => [index, place]));
  const n = free.length;
  const a = zeroMatrix(n);
  const b = new Float64Array(n);
  rows.forEach((row, r) => {
    let y = at(ys, r);
    for (const [index, value] of row) {
      const fixedValue = fixed.get(index);
      if (fixedValue !== undefined) y -= value * fixedValue;
    }
    const entries = [...row].flatMap(([index, value]) => {
      const place = position.get(index);
      return place === undefined ? [] : [[place, value] as const];
    });
    for (const [i, xi] of entries) {
      b[i] = at(b, i) + xi * y;
      for (const [j, xj] of entries) a.values[i * n + j] = at(a.values, i * n + j) + xi * xj;
    }
  });
  free.forEach((index, place) => {
    const penalty = at(layout.penalty, index);
    a.values[place * n + place] = at(a.values, place * n + place) + penalty;
    b[place] = at(b, place) + penalty * at(layout.target, index);
  });
  const factor = cholesky(a);
  const solved = choleskySolve(factor, b);
  const beta = new Float64Array(layout.size);
  free.forEach((index, place) => {
    beta[index] = at(solved, place);
  });
  for (const [index, value] of fixed) beta[index] = value;
  return { beta, factor, free };
}

function fitRows(rows: readonly Row[], referenceYearSh: number) {
  const layout = layoutFor(rows);
  const design = rows.map((row) => designRow(row.comparable, layout, referenceYearSh));
  const ys = rows.map((row) => row.y);
  const fixed = new Map<number, number>();
  let solution = solve(design, ys, layout, fixed);
  const slopeIndex = required(sharedIndex, 'age_slope');
  for (let round = 0; round < 50; round++) {
    let changed = false;
    for (const [term, index] of sharedIndex) {
      if (fixed.has(index)) continue;
      const prior = SHARED_PRIORS[term];
      const value = at(solution.beta, index);
      const bounded = Math.min(Math.max(value, logBound(prior.min)), logBound(prior.max));
      if (bounded !== value) {
        fixed.set(index, bounded);
        changed = true;
      }
    }
    const pooledSlope = at(solution.beta, slopeIndex);
    const slopeMin = logBound(SHARED_PRIORS.age_slope.min);
    const slopeMax = logBound(SHARED_PRIORS.age_slope.max);
    for (const index of layout.modelIndex.values()) {
      const deviation = index + 1;
      if (fixed.has(deviation)) continue;
      const total = pooledSlope + at(solution.beta, deviation);
      const bounded = Math.min(Math.max(total, slopeMin), slopeMax);
      if (bounded !== total) {
        fixed.set(deviation, bounded - pooledSlope);
        changed = true;
      }
    }
    if (!changed) break;
    solution = solve(design, ys, layout, fixed);
  }
  const { beta } = solution;
  const predictions = design.map((row) =>
    [...row].reduce((sum, [index, value]) => sum + value * at(beta, index), 0),
  );
  const positions = new Map(solution.free.map((index, place) => [index, place]));
  const leaveOneOut = design.map((row, r) => {
    const sparse = new Map<number, number>();
    for (const [index, value] of row) {
      const place = positions.get(index);
      if (place !== undefined) sparse.set(place, value);
    }
    const leverage = inverseQuadraticForm(solution.factor, sparse);
    const residual = at(ys, r) - at(predictions, r);
    return at(ys, r) - residual / Math.max(1 - leverage, 1e-6);
  });
  const shared = Object.fromEntries(
    SHARED_TERMS.map((term) => [term, at(beta, required(sharedIndex, term))]),
  ) as Record<SharedTerm, number>;
  const models = new Map(
    [...layout.modelIndex].map(([modelId, index]) => [
      modelId,
      { level: at(beta, index), ageSlope: shared.age_slope + at(beta, index + 1) },
    ]),
  );
  const trimModel = new Map(
    rows.flatMap(({ comparable }) =>
      comparable.trimId === null ? [] : [[comparable.trimId, comparable.modelId] as const],
    ),
  );
  const trims = new Map(
    [...layout.trimIndex].map(([trimId, index]) => [
      trimId,
      { modelId: required(trimModel, trimId), level: at(beta, index) },
    ]),
  );
  return { model: { shared, models, trims } satisfies FittedModel, predictions, leaveOneOut };
}

/** ln(value) of a listing under a fitted model; undefined when its model was not fitted. */
export function predictLn(
  model: FittedModel,
  listing: Pick<Comparable, 'modelId' | 'trimId' | 'attributes'>,
  referenceYearSh: number,
): number | undefined {
  const fitted = model.models.get(listing.modelId);
  if (fitted === undefined) return undefined;
  const features = sharedFeatures(listing.attributes, referenceYearSh);
  let value = fitted.level + fitted.ageSlope * features.age_slope;
  for (const term of SHARED_TERMS) if (term !== 'age_slope') value += model.shared[term] * features[term];
  const trim = listing.trimId === null ? undefined : model.trims.get(listing.trimId);
  if (trim !== undefined) value += trim.level;
  return value;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? at(sorted, middle) : (at(sorted, middle - 1) + at(sorted, middle)) / 2;
}

function groupBy<T, K>(items: readonly T[], key: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const group = groups.get(k);
    if (group === undefined) groups.set(k, [item]);
    else group.push(item);
  }
  return groups;
}

/**
 * The whole of S01's fit: outliers by price against the model's median, a first fit, outliers by residual, the final
 * fit, and each model's segment with its leave-one-out error. Throws on no comparables.
 */
export function fitValuation(comparables: readonly Comparable[], referenceYearSh: number): Valuation {
  if (comparables.length === 0) throw new Error('no comparables to fit');
  const outliers = new Set<number>();
  // Against the median of the same model within two model years (the whole model when fewer than three are that
  // close): a model's prices span more than the factor across twenty years, never within a few.
  for (const group of groupBy(comparables, (c) => c.modelId).values()) {
    for (const c of group) {
      const near = group.filter(
        (other) => Math.abs(other.attributes.modelYearSh - c.attributes.modelYearSh) <= 2,
      );
      const middle = median((near.length >= 3 ? near : group).map((other) => other.askingPriceToman));
      const ratio = c.askingPriceToman / middle;
      if (ratio > OUTLIER_PRICE_FACTOR || ratio < 1 / OUTLIER_PRICE_FACTOR) outliers.add(c.listingId);
    }
  }
  const rowsOf = (items: readonly Comparable[]): Row[] =>
    items.map((comparable) => ({ comparable, y: Math.log(comparable.askingPriceToman) }));
  const first = rowsOf(comparables.filter((c) => !outliers.has(c.listingId)));
  const firstFit = fitRows(first, referenceYearSh);
  const residuals = first.map((row, r) => row.y - at(firstFit.predictions, r));
  const center = median(residuals);
  const spread = 1.4826 * median(residuals.map((residual) => Math.abs(residual - center)));
  first.forEach((row, r) => {
    if (spread > 0 && Math.abs(at(residuals, r) - center) > OUTLIER_RESIDUAL_MADS * spread)
      outliers.add(row.comparable.listingId);
  });
  const kept = rowsOf(comparables.filter((c) => !outliers.has(c.listingId)));
  const final = fitRows(kept, referenceYearSh);

  const errors = new Map<number, number[]>();
  kept.forEach((row, r) => {
    const percentage =
      (Math.abs(Math.exp(at(final.leaveOneOut, r)) - row.comparable.askingPriceToman) * 100) /
      row.comparable.askingPriceToman;
    const list = errors.get(row.comparable.modelId) ?? [];
    list.push(percentage);
    errors.set(row.comparable.modelId, list);
  });
  const segments: Segment[] = [];
  for (const [modelId, group] of groupBy(
    kept.map((row) => row.comparable),
    (c) => c.modelId,
  )) {
    const years = group.map((c) => c.attributes.modelYearSh);
    const modelErrors = errors.get(modelId) ?? [];
    const errorPct = modelErrors.length >= 3 ? Math.round(median(modelErrors) * 100) / 100 : null;
    segments.push({
      modelId,
      comparableCount: group.length,
      zeroKmCount: group.filter((c) => c.attributes.mileageKm < ZERO_KM_BELOW_KM).length,
      minModelYearSh: Math.min(...years),
      maxModelYearSh: Math.max(...years),
      errorPct,
      ratesListings:
        group.length >= MIN_SEGMENT_COMPARABLES && errorPct !== null && errorPct <= MAX_SEGMENT_ERROR_PCT,
    });
  }
  const segmentModels = new Set(segments.map((segment) => segment.modelId));
  const fittedComparables = comparables.flatMap((comparable) => {
    if (!segmentModels.has(comparable.modelId)) return [];
    const ln = predictLn(final.model, comparable, referenceYearSh);
    if (ln === undefined) return [];
    return [
      {
        comparable,
        isOutlier: outliers.has(comparable.listingId),
        fittedValueToman: Math.round(Math.exp(ln)),
      },
    ];
  });
  return { model: final.model, segments, comparables: fittedComparables };
}
