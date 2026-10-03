import { toLatinDigits, toPersianDigits } from '@carshenas/locale/digits';
import { formatCount } from '@carshenas/locale/format-number';
import { withoutBidiControls } from '@carshenas/locale/text';
import type { RangeUnit } from '@carshenas/search/kinds';

// The typed ends of a range filter (CS-102): what a buyer types into «حداقل» and «حداکثر» is read in any digit script
// with or without separators, checked against the filter's bounds, and shown back in Persian digits (with thousands
// marks, except a model year, which is not a count). Pure, so the control, its tests and the screen readers' text agree.

export type RangeProblem = 'not_a_number' | 'outside' | 'order';

export type ReadEnd =
  | { readonly ok: true; readonly value: number | undefined }
  | { readonly ok: false; readonly problem: 'not_a_number' };

/** An end as typed: empty is no end; digits in any script with spaces and the usual separators between thousands. */
export function readRangeEnd(text: string): ReadEnd {
  const plain = toLatinDigits(withoutBidiControls(text)).replace(/[\s,٬،.٫']/g, '');
  if (plain === '') return { ok: true, value: undefined };
  if (!/^\d{1,16}$/.test(plain)) return { ok: false, problem: 'not_a_number' };
  const value = Number(plain);
  return Number.isSafeInteger(value) ? { ok: true, value } : { ok: false, problem: 'not_a_number' };
}

/** An end as the field shows it: Persian digits, with thousands marks unless it is a year. */
export function formatRangeEnd(unit: RangeUnit, value: number | undefined): string {
  if (value === undefined) return '';
  return unit === 'year' ? toPersianDigits(String(value)) : formatCount(value);
}

/** The first thing wrong with the two ends (the bounds, then their order), or null. */
export function rangeProblem(
  bounds: { readonly min: number; readonly max: number },
  min: number | undefined,
  max: number | undefined,
): { readonly problem: RangeProblem; readonly end: 'min' | 'max' | 'both' } | null {
  if (min !== undefined && (min < bounds.min || min > bounds.max)) return { problem: 'outside', end: 'min' };
  if (max !== undefined && (max < bounds.min || max > bounds.max)) return { problem: 'outside', end: 'max' };
  if (min !== undefined && max !== undefined && min > max) return { problem: 'order', end: 'both' };
  return null;
}
