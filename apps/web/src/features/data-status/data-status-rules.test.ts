// @vitest-environment node
import { expect, test } from 'vitest';
import {
  daysBetween,
  DELAYED_AFTER_MINUTES,
  FRESHNESS_TARGETS,
  indexState,
  judgeTargets,
  sourceState,
} from '@/features/data-status/data-status-rules';
import { formatErrorPct, formatHours, formatMinutes } from '@/features/data-status/data-status-format';

// What the data-status page judges from its figures (CS-66): a source's state, the index's state, and ADR-0017's
// freshness targets against what was measured.

const NOW = '2026-10-01T08:00:00.000Z';
const minutesBefore = (minutes: number) => new Date(Date.parse(NOW) - minutes * 60_000).toISOString();

test('an enabled source read within the hour is live, then delayed; a paused or stopped one is not being updated', () => {
  expect(sourceState('enabled', minutesBefore(5), NOW)).toBe('live');
  expect(sourceState('enabled', minutesBefore(DELAYED_AFTER_MINUTES), NOW)).toBe('live');
  expect(sourceState('enabled', minutesBefore(DELAYED_AFTER_MINUTES + 1), NOW)).toBe('delayed');
  expect(sourceState('enabled', null, NOW)).toBe('delayed');
  expect(sourceState('paused', minutesBefore(5), NOW)).toBe('not_updating');
  expect(sourceState('stopped_on_block', minutesBefore(5), NOW)).toBe('not_updating');
});

test('the index is live while any source is, delayed while any is delayed, and otherwise not being updated', () => {
  expect(indexState(['not_updating', 'live'])).toBe('live');
  expect(indexState(['not_updating', 'delayed'])).toBe('delayed');
  expect(indexState(['not_updating'])).toBe('not_updating');
  expect(indexState([])).toBe('not_updating');
});

test('each target is met at its bound, missed past it, and unmeasured without a measurement', () => {
  const met = judgeTargets({
    sources: [{ postingToStoredMedianMinutes: 40 }, { postingToStoredMedianMinutes: null }],
    shownCheckMedianMinutes: FRESHNESS_TARGETS.resultsMedianMinutes,
    valuation: { asOfDate: '2026-09-30' },
    tehranToday: '2026-10-01',
  });
  expect(met).toEqual([
    { key: 'newListing', status: 'met', measured: 40 },
    { key: 'resultsMedian', status: 'met', measured: FRESHNESS_TARGETS.resultsMedianMinutes },
    { key: 'valuationDaily', status: 'met', measured: 1 },
  ]);

  // The slowest source decides the promise for new listings.
  const missed = judgeTargets({
    sources: [{ postingToStoredMedianMinutes: 40 }, { postingToStoredMedianMinutes: 162 }],
    shownCheckMedianMinutes: FRESHNESS_TARGETS.resultsMedianMinutes + 1,
    valuation: { asOfDate: '2026-09-29' },
    tehranToday: '2026-10-01',
  });
  expect(missed.map((result) => result.status)).toEqual(['missed', 'missed', 'missed']);

  const unmeasured = judgeTargets({
    sources: [],
    shownCheckMedianMinutes: null,
    valuation: null,
    tehranToday: '2026-10-01',
  });
  expect(unmeasured.map((result) => result.status)).toEqual(['unmeasured', 'unmeasured', 'unmeasured']);
});

test('days between Tehran dates count whole calendar days', () => {
  expect(daysBetween('2026-09-30', '2026-09-30')).toBe(0);
  expect(daysBetween('2026-09-30', '2026-10-01')).toBe(1);
  expect(daysBetween('2026-03-20', '2026-03-21')).toBe(1);
});

test('durations read in the largest whole unit, and an error in whole percent with its sign on the left', () => {
  expect(formatMinutes(22)).toBe('۲۲\u00A0دقیقه');
  expect(formatMinutes(291)).toBe('۵\u00A0ساعت');
  expect(formatMinutes(3 * 24 * 60)).toBe('۳\u00A0روز');
  expect(formatHours(48)).toBe('۴۸\u00A0ساعت');
  expect(formatErrorPct(6.87)).toBe('۷\u200F٪');
});
