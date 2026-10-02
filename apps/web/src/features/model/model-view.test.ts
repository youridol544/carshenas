import { expect, test } from 'vitest';
import { formatPercent } from '@carshenas/locale/format-number';
import {
  changeText,
  changesOver,
  daysBetween,
  modalYear,
  niceStep,
  trendView,
  weekStart,
  weeklyPoints,
  yearBars,
} from '@/features/model/model-view';
import type { TrendDay } from '@/features/model/model-types';

// The rules of the model page's trend (CS-67), tested without a browser: when a day is a point, when a history is
// long enough to draw, when a change is stated, and where a point sits.

function day(date: string, median: number, count = 20): TrendDay {
  return {
    date,
    count,
    medianToman: median,
    lowToman: median - 50_000_000,
    highToman: median + 50_000_000,
    marketValueToman: median,
  };
}

function run(from: string, length: number, start = 1_000_000_000, step = 5_000_000): TrendDay[] {
  return Array.from({ length }, (_, i) => {
    const date = new Date(Date.parse(`${from}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10);
    return day(date, start + i * step);
  });
}

test('a week starts on Saturday in Iran', () => {
  // 2026-10-03 is a Saturday, 2026-10-02 a Friday, 2026-10-04 a Sunday.
  expect(weekStart('2026-10-03')).toBe('2026-10-03');
  expect(weekStart('2026-10-04')).toBe('2026-10-03');
  expect(weekStart('2026-10-09')).toBe('2026-10-03');
  expect(weekStart('2026-10-02')).toBe('2026-09-26');
  expect(daysBetween('2026-09-26', '2026-10-03')).toBe(7);
});

test('days with too few listings are not points, and fewer than three points is a short history', () => {
  const view = trendView([day('2026-09-30', 1e9, 3), day('2026-10-01', 1.01e9, 12), day('2026-10-02', 1.02e9, 14)]);
  expect(view.days.map((d) => d.date)).toEqual(['2026-10-01', '2026-10-02']);
  expect(view.status).toBe('short');
  expect(view.chart).toBeNull();
  expect(trendView([]).status).toBe('none');
  expect(trendView([day('2026-10-02', 1e9, 7)]).status).toBe('none');
});

test('three days of history draw a chart with a point for every day', () => {
  const view = trendView(run('2026-09-30', 3));
  expect(view.status).toBe('ready');
  expect(view.granularity).toBe('day');
  expect(view.chart?.points).toHaveLength(3);
  const xs = view.chart?.points.map((point) => point.x) ?? [];
  expect(xs).toEqual([...xs].sort((a, b) => a - b));
  expect(xs[0]).toBeGreaterThan(0);
  expect(xs.at(-1)).toBeLessThan(100);
});

test('a long history is drawn by the week: the last day of each Saturday-week', () => {
  const view = trendView(run('2026-08-01', 60));
  expect(view.granularity).toBe('week');
  expect(view.drawn.length).toBeLessThan(11);
  expect(view.drawn.length).toBeGreaterThanOrEqual(8);
  for (const point of view.drawn.slice(0, -1)) {
    const next = weeklyPoints(view.days).find((candidate) => candidate.date > point.date);
    expect(next).toBeDefined();
  }
  expect(view.drawn.at(-1)?.date).toBe('2026-09-29');
});

test('a higher price is drawn nearer the top, and the band encloses the line', () => {
  const view = trendView(run('2026-09-30', 4));
  const points = view.chart?.points ?? [];
  expect(points[3]?.yMedian).toBeLessThan(points[0]?.yMedian ?? 0);
  for (const point of points) {
    expect(point.yHigh).toBeLessThan(point.yMedian);
    expect(point.yLow).toBeGreaterThan(point.yMedian);
    expect(point.yHigh).toBeGreaterThanOrEqual(0);
    expect(point.yLow).toBeLessThanOrEqual(100);
  }
  expect(view.chart?.line.startsWith('M')).toBe(true);
  expect(view.chart?.band.endsWith('Z')).toBe(true);
});

test('the axis has round Persian labels from the lowest band edge to above the highest', () => {
  const view = trendView(run('2026-09-30', 4));
  const ticks = view.chart?.yTicks ?? [];
  expect(ticks.length).toBeGreaterThanOrEqual(3);
  expect(ticks[0]?.y).toBeGreaterThanOrEqual(ticks.at(-1)?.y ?? 0);
  for (const tick of ticks) expect(tick.label).toMatch(/^[۰-۹٫]+.(میلیارد|میلیون)$/);
  expect(niceStep(37_000_000)).toBe(50_000_000);
  expect(niceStep(1_400_000_000)).toBe(2_000_000_000);
  expect(niceStep(2.4)).toBe(2.5);
});

test('a change is stated only when the history reaches back to that many days', () => {
  const short = changesOver(run('2026-09-30', 4));
  expect(short.map((change) => change.ratio)).toEqual([null, null]);
  const long = changesOver(run('2026-06-01', 120));
  const [month, quarter] = long;
  expect(month?.days).toBe(30);
  expect(month?.ratio).toBeCloseTo((1_000_000_000 + 119 * 5_000_000) / (1_000_000_000 + 89 * 5_000_000) - 1, 6);
  expect(quarter?.days).toBe(90);
  expect(quarter?.ratio).toBeCloseTo((1_000_000_000 + 119 * 5_000_000) / (1_000_000_000 + 29 * 5_000_000) - 1, 6);
});

test('the nearest point within the tolerance serves, one farther away does not', () => {
  const sparse = [day('2026-08-01', 1e9), day('2026-09-26', 1.1e9)];
  // 56 days apart: no point within 4 days of 30 days back
  expect(changesOver(sparse)[0]?.ratio).toBeNull();
  const near = [day('2026-08-28', 1e9), day('2026-09-26', 1.1e9)];
  expect(changesOver(near)[0]?.ratio).toBeCloseTo(0.1, 6);
});

test('a rise is bad news, a fall good, a flat one says so, and the sign is always printed', () => {
  expect(changeText(0.034)).toEqual({ tone: 'rise', figure: `+${formatPercent(0.03)}`, words: 'گران‌تر شده' });
  expect(changeText(-0.052).tone).toBe('fall');
  expect(changeText(-0.052).figure).toBe(`${String.fromCharCode(0x2212)}${formatPercent(0.05)}`);
  expect(changeText(0.004)).toEqual({ tone: 'flat', figure: null, words: 'تقریباً بدون تغییر' });
});

test('the year the trend defaults to is the most listed, the newer among equals; bars are shares of the highest median', () => {
  const years = [
    { year: 1402, count: 10, medianToman: 900, marketValueToman: null, medianMileageKm: null },
    { year: 1400, count: 30, medianToman: 600, marketValueToman: null, medianMileageKm: null },
    { year: 1401, count: 30, medianToman: 750, marketValueToman: null, medianMileageKm: null },
    { year: 1399, count: 5, medianToman: null, marketValueToman: null, medianMileageKm: null },
  ];
  expect(modalYear(years)).toBe(1401);
  expect(modalYear([])).toBeNull();
  expect(yearBars(years).map((bar) => Math.round(bar.share * 100))).toEqual([100, 67, 83, 0]);
});
