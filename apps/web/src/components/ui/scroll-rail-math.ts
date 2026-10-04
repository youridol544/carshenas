// The arithmetic of a row that scrolls sideways (ScrollRail), apart from the browser so it can be tested: which way the
// row can still move, and how far a press of «بعدی» or «قبلی» moves it. In every browser `scrollLeft` is 0 at the start
// of the row and counts away from it, so it is positive in a left-to-right row and negative in a right-to-left one
// (MDN, `Element.scrollLeft`); the distance travelled is its absolute value either way.

/** Pixels of slack at either end: a sub-pixel remainder is not "more". */
const EDGE = 2;
/** A press moves a little less than a screenful, so the item that was last in view is still in view, first. */
const STEP = 0.85;

export type RailReach = { readonly previous: boolean; readonly next: boolean };
export type RailDirection = 'previous' | 'next';

type RailBox = { readonly scrollLeft: number; readonly clientWidth: number; readonly scrollWidth: number };

/** Which ways the row can still move; both false when everything fits. */
export function railReach({ scrollLeft, clientWidth, scrollWidth }: RailBox): RailReach {
  const travelled = Math.abs(scrollLeft);
  return { previous: travelled > EDGE, next: scrollWidth - clientWidth - travelled > EDGE };
}

/** The `left` of the `scrollBy` for one press: toward the end is positive in a left-to-right row, negative in a right-to-left one. */
export function railStep(direction: RailDirection, clientWidth: number, rightToLeft: boolean): number {
  const toward = direction === 'next' ? 1 : -1;
  return toward * (rightToLeft ? -1 : 1) * clientWidth * STEP;
}
