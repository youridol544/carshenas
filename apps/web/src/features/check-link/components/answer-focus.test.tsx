import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { AnswerFocus, answerFocus } from '@/features/check-link/components/answer-focus';

// What an answer does when the buyer asked for it from the box (CS-115): its heading takes focus, and an answer that fits
// the screen is shown whole; a page opened on an address leaves focus and the scroll alone.

const SCREEN = 800;
const SCREEN_HEIGHT = Object.getOwnPropertyDescriptor(window, 'innerHeight');
const scroll = vi.fn();

function answerAt(rect: { height: number; bottom: number }) {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return (this.tagName === 'SECTION' ? rect : { height: 0, bottom: 0 }) as DOMRect;
  });
  return render(
    <>
      <section aria-label="عنوان پاسخ">
        <h2 data-answer-title tabIndex={-1}>
          عنوان پاسخ
        </h2>
      </section>
      <AnswerFocus />
    </>,
  );
}

beforeEach(() => {
  answerFocus.expected = false;
  scroll.mockClear();
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: SCREEN });
  vi.spyOn(window, 'scrollBy').mockImplementation(scroll);
});

afterEach(() => {
  vi.restoreAllMocks();
  if (SCREEN_HEIGHT !== undefined) Object.defineProperty(window, 'innerHeight', SCREEN_HEIGHT);
});

test('an answer asked for from the box takes focus at its heading, and one that fits is scrolled into view whole', () => {
  answerFocus.expected = true;
  answerAt({ height: 520, bottom: SCREEN + 140 });
  expect(screen.getByRole('heading', { name: 'عنوان پاسخ' })).toHaveFocus();
  expect(scroll).toHaveBeenCalledExactlyOnceWith({ top: 156, behavior: 'instant' });
  // The wish is spent: the next answer on the page is not moved unless it was asked for too.
  expect(answerFocus.expected).toBe(false);
});

test('an answer taller than the screen keeps its place, with focus on its heading', () => {
  answerFocus.expected = true;
  answerAt({ height: SCREEN + 400, bottom: SCREEN + 900 });
  expect(screen.getByRole('heading', { name: 'عنوان پاسخ' })).toHaveFocus();
  expect(scroll).not.toHaveBeenCalled();
});

test('an answer that shows whole is not scrolled', () => {
  answerFocus.expected = true;
  answerAt({ height: 400, bottom: 700 });
  expect(screen.getByRole('heading', { name: 'عنوان پاسخ' })).toHaveFocus();
  expect(scroll).not.toHaveBeenCalled();
});

test('a page opened on an address is left alone: no focus moved, nothing scrolled', () => {
  answerAt({ height: 520, bottom: SCREEN + 140 });
  expect(screen.getByRole('heading', { name: 'عنوان پاسخ' })).not.toHaveFocus();
  expect(scroll).not.toHaveBeenCalled();
});

test('the answer next to it takes focus, not another one the document still holds for a page kept hidden', () => {
  answerFocus.expected = true;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ height: 0, bottom: 0 } as DOMRect);
  render(
    <>
      <section aria-label="قدیمی">
        <h2 data-answer-title tabIndex={-1}>
          عنوان قدیمی
        </h2>
      </section>
      <section aria-label="تازه">
        <h2 data-answer-title tabIndex={-1}>
          عنوان تازه
        </h2>
      </section>
      <AnswerFocus />
    </>,
  );
  expect(screen.getByRole('heading', { name: 'عنوان تازه' })).toHaveFocus();
  expect(screen.getByRole('heading', { name: 'عنوان قدیمی' })).not.toHaveFocus();
});
