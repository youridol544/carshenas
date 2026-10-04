// Showing what just appeared (CS-115): an answer that was asked for, the panel that asks a visitor to sign in, the state that
// replaces the button a buyer pressed. On a phone these start below the fold, and what matters in each is at its end (the
// way forward, the request's state), so the window is scrolled down by what hides the end of the element, never more: its
// start stays in view. An element taller than the screen stays where it is. The window is scrolled, not scrollIntoView,
// which would also move the keyboard's starting point (Chrome); and with no animation: the thing the buyer asked for is
// simply there.

/** The room kept between an element brought into view and the screen's edge, in pixels. */
const MARGIN = 16;

/** How far the window must scroll down to show the whole of an element that fits the screen; zero when it shows already. */
export function hiddenBelow(
  box: { readonly height: number; readonly bottom: number },
  screen: number,
): number {
  const hidden = box.bottom + MARGIN - screen;
  return hidden > 0 && box.height + 2 * MARGIN <= screen ? hidden : 0;
}

export function revealEnd(element: Element): void {
  const hidden = hiddenBelow(element.getBoundingClientRect(), window.innerHeight);
  if (hidden > 0) window.scrollBy({ top: hidden, behavior: 'instant' });
}
