// Dense linear algebra for the valuation fit (CS-51): the normal equations of a few hundred coefficients, solved by
// Cholesky. A square matrix is a flat Float64Array in row-major order with its size.

export type SquareMatrix = { readonly size: number; readonly values: Float64Array };

/** A checked read: the fit's indices are computed, so an index out of range is a bug worth an exception. */
export function at(values: ArrayLike<number>, index: number): number {
  const value = values[index];
  if (value === undefined) throw new RangeError(`index ${String(index)} out of range`);
  return value;
}

export function zeroMatrix(size: number): SquareMatrix {
  return { size, values: new Float64Array(size * size) };
}

/** The lower-triangular L with A = L·Lᵀ, for a symmetric positive definite A. Throws when A is not. */
export function cholesky(a: SquareMatrix): SquareMatrix {
  const n = a.size;
  const l = zeroMatrix(n);
  const lv = l.values;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = at(a.values, i * n + j);
      for (let k = 0; k < j; k++) sum -= at(lv, i * n + k) * at(lv, j * n + k);
      if (i === j) {
        if (!(sum > 0)) throw new Error('matrix is not positive definite');
        lv[i * n + i] = Math.sqrt(sum);
      } else {
        lv[i * n + j] = sum / at(lv, j * n + j);
      }
    }
  }
  return l;
}

/** Solves L·Lᵀ·x = b given the Cholesky factor L. */
export function choleskySolve(l: SquareMatrix, b: ArrayLike<number>): Float64Array {
  const n = l.size;
  const lv = l.values;
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let sum = at(b, i);
    for (let k = 0; k < i; k++) sum -= at(lv, i * n + k) * at(y, k);
    y[i] = sum / at(lv, i * n + i);
  }
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let sum = at(y, i);
    for (let k = i + 1; k < n; k++) sum -= at(lv, k * n + i) * at(x, k);
    x[i] = sum / at(lv, i * n + i);
  }
  return x;
}

/** xᵀ·A⁻¹·x for a sparse x (index → value), from A's Cholesky factor: ‖L⁻¹x‖². */
export function inverseQuadraticForm(l: SquareMatrix, x: ReadonlyMap<number, number>): number {
  const n = l.size;
  const lv = l.values;
  let first = n;
  for (const index of x.keys()) first = Math.min(first, index);
  const z = new Float64Array(n);
  let total = 0;
  for (let i = first; i < n; i++) {
    let sum = x.get(i) ?? 0;
    for (let k = first; k < i; k++) sum -= at(lv, i * n + k) * at(z, k);
    const zi = sum / at(lv, i * n + i);
    z[i] = zi;
    total += zi * zi;
  }
  return total;
}
