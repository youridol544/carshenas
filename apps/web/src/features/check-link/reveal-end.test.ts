import { afterEach, expect, test, vi } from 'vitest';
import { hiddenBelow, revealEnd } from '@/features/check-link/reveal-end';

// What is scrolled when something appears below the fold (CS-115): the window moves down by what hides the end of an
// element that fits the screen, never more, and never for one that already shows or is taller than the screen.

const SCREEN = 800;
const SCREEN_HEIGHT = Object.getOwnPropertyDescriptor(window, 'innerHeight');

afterEach(() => {
  vi.restoreAllMocks();
  if (SCREEN_HEIGHT !== undefined) Object.defineProperty(window, 'innerHeight', SCREEN_HEIGHT);
});

test('an element whose end is hidden and that fits the screen is scrolled down by what hides it and the margin', () => {
  // Its end is 120 px under the screen's edge: 16 px more are kept clear.
  expect(hiddenBelow({ height: 300, bottom: SCREEN + 120 }, SCREEN)).toBe(136);
});

test('an element that shows whole, with the margin kept under it, is not moved; one a pixel short of it is moved by that pixel', () => {
  expect(hiddenBelow({ height: 300, bottom: 500 }, SCREEN)).toBe(0);
  expect(hiddenBelow({ height: 300, bottom: SCREEN - 16 }, SCREEN)).toBe(0);
  expect(hiddenBelow({ height: 300, bottom: SCREEN - 15 }, SCREEN)).toBe(1);
});

test('an element taller than the screen stays where it is; so does one that would not keep its margins on the screen', () => {
  expect(hiddenBelow({ height: SCREEN + 200, bottom: SCREEN + 900 }, SCREEN)).toBe(0);
  // It fits, but only without the margins: moving it would push its start out or leave no room around it.
  expect(hiddenBelow({ height: SCREEN - 31, bottom: SCREEN + 900 }, SCREEN)).toBe(0);
  expect(hiddenBelow({ height: SCREEN - 32, bottom: SCREEN + 900 }, SCREEN)).toBe(916);
});

test('the window is scrolled by that, at once, and not at all when nothing is hidden', () => {
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: SCREEN });
  const scroll = vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined);
  const element = document.createElement('div');
  const box = vi.spyOn(element, 'getBoundingClientRect');
  box.mockReturnValue({ height: 200, bottom: SCREEN + 50 } as DOMRect);
  revealEnd(element);
  expect(scroll).toHaveBeenCalledExactlyOnceWith({ top: 66, behavior: 'instant' });
  scroll.mockClear();
  box.mockReturnValue({ height: 200, bottom: 400 } as DOMRect);
  revealEnd(element);
  expect(scroll).not.toHaveBeenCalled();
});
