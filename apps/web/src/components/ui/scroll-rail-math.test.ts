// @vitest-environment node
import { expect, test } from 'vitest';
import { railReach, railStep } from '@/components/ui/scroll-rail-math';

test('a row whose items all fit can move neither way', () => {
  expect(railReach({ scrollLeft: 0, clientWidth: 400, scrollWidth: 400 })).toEqual({
    previous: false,
    next: false,
  });
});

test('at its start a row that overflows can only go on', () => {
  expect(railReach({ scrollLeft: 0, clientWidth: 400, scrollWidth: 1000 })).toEqual({
    previous: false,
    next: true,
  });
});

test('in the middle it can go either way, whichever way the page is written (scrollLeft is negative right to left)', () => {
  expect(railReach({ scrollLeft: -250, clientWidth: 400, scrollWidth: 1000 })).toEqual({
    previous: true,
    next: true,
  });
  expect(railReach({ scrollLeft: 250, clientWidth: 400, scrollWidth: 1000 })).toEqual({
    previous: true,
    next: true,
  });
});

test('at its far end it can only go back', () => {
  expect(railReach({ scrollLeft: -600, clientWidth: 400, scrollWidth: 1000 })).toEqual({
    previous: true,
    next: false,
  });
});

test('a pixel of rounding at either end is not more to see', () => {
  expect(railReach({ scrollLeft: -1, clientWidth: 400, scrollWidth: 1000 }).previous).toBe(false);
  expect(railReach({ scrollLeft: -599, clientWidth: 400, scrollWidth: 1000 }).next).toBe(false);
});

test('a press moves toward the end by most of a screenful: leftwards in a right-to-left row, rightwards otherwise', () => {
  expect(railStep('next', 1000, true)).toBeCloseTo(-850);
  expect(railStep('previous', 1000, true)).toBeCloseTo(850);
  expect(railStep('next', 1000, false)).toBeCloseTo(850);
  expect(railStep('previous', 1000, false)).toBeCloseTo(-850);
});

test('a press moves less than a full width, so the item that was last in view stays in view', () => {
  expect(Math.abs(railStep('next', 400, true))).toBeLessThan(400);
});
