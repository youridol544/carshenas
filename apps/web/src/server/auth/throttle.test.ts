// @vitest-environment node
import { expect, test } from 'vitest';
import { waitAfterFailures } from '@/server/auth/throttle';

test('five failures in a row are free, then the wait starts at 30 seconds and doubles up to an hour', () => {
  expect([0, 1, 4].map(waitAfterFailures)).toEqual([0, 0, 0]);
  expect([5, 6, 7, 8, 11, 12, 40].map(waitAfterFailures)).toEqual([30, 60, 120, 240, 1920, 3600, 3600]);
});
