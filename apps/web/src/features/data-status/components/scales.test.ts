// @vitest-environment node
import { expect, test } from 'vitest';
import { axisTicks, axisTopMinutes } from '@/features/data-status/components/freshness-chart';
import { scaleEndPct } from '@/features/data-status/components/valuation-section';

// The chart's value axis and the error bars' scale (CS-66): rounded, and always holding their target or floor.

test('the chart axis ends on a rounded value above both the highest point and the one-day target', () => {
  expect(axisTopMinutes(214)).toBe(30 * 60);
  expect(axisTopMinutes(26 * 60)).toBe(30 * 60);
  expect(axisTopMinutes(60 * 60)).toBe(72 * 60);
  expect(axisTicks(30 * 60)).toEqual([0, 720, 1440]);
  expect(axisTicks(72 * 60)).toEqual([0, 1440, 2880, 4320]);
});

test('the error scale ends on a multiple of 5 percent, never below 15', () => {
  expect(scaleEndPct([3.96, 11.03])).toBe(15);
  expect(scaleEndPct([16.2])).toBe(20);
  expect(scaleEndPct([])).toBe(15);
});
