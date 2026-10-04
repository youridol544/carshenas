import { describe, expect, test } from 'vitest';
import { formatRangeEnd, rangeProblem, readRangeEnd } from '@/features/search/range-input';

describe('the typed ends of a range', () => {
  test('digits in any script and separators are read; empty is no end', () => {
    expect(readRangeEnd('۱۲۰٬۰۰۰')).toEqual({ ok: true, value: 120_000 });
    expect(readRangeEnd('120,000')).toEqual({ ok: true, value: 120_000 });
    expect(readRangeEnd(' ٦٠ ٠٠٠ ')).toEqual({ ok: true, value: 60_000 });
    expect(readRangeEnd('1400')).toEqual({ ok: true, value: 1400 });
    expect(readRangeEnd('')).toEqual({ ok: true, value: undefined });
    expect(readRangeEnd('   ')).toEqual({ ok: true, value: undefined });
  });

  test('anything else is not a number', () => {
    expect(readRangeEnd('abc')).toEqual({ ok: false, problem: 'not_a_number' });
    expect(readRangeEnd('۱۰ کیلومتر')).toEqual({ ok: false, problem: 'not_a_number' });
    expect(readRangeEnd('-5')).toEqual({ ok: false, problem: 'not_a_number' });
    expect(readRangeEnd('1e5')).toEqual({ ok: false, problem: 'not_a_number' });
    expect(readRangeEnd('9'.repeat(20))).toEqual({ ok: false, problem: 'not_a_number' });
  });

  test('an end is shown in Persian digits, with thousands marks except a year', () => {
    expect(formatRangeEnd('km', 60_000)).toBe('۶۰٬۰۰۰');
    expect(formatRangeEnd('year', 1400)).toBe('۱۴۰۰');
    expect(formatRangeEnd('cc', 1600)).toBe('۱٬۶۰۰');
    expect(formatRangeEnd('km', undefined)).toBe('');
  });

  test('the bounds are checked first, then the order', () => {
    const bounds = { min: 500, max: 9000 };
    expect(rangeProblem(bounds, 499, undefined)).toEqual({ problem: 'outside', end: 'min' });
    expect(rangeProblem(bounds, undefined, 9001)).toEqual({ problem: 'outside', end: 'max' });
    expect(rangeProblem(bounds, 2000, 1600)).toEqual({ problem: 'order', end: 'both' });
    expect(rangeProblem(bounds, 1600, 1600)).toBeNull();
    expect(rangeProblem(bounds, undefined, undefined)).toBeNull();
  });
});
