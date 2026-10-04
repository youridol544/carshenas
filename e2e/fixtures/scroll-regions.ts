import type { Page } from '@playwright/test';

/** One element that is a scroll container, as the page lays it out right now. Lengths are CSS pixels. */
export type ScrollRegion = {
  /** Tag, role, accessible label and first classes: enough to find it. */
  readonly name: string;
  /** The axes it can scroll along at this moment (its content is bigger than it is and its overflow allows it). */
  readonly scrollsSideways: boolean;
  readonly scrollsDown: boolean;
  /** The space the browser took for a scrollbar along the bottom or the side of it: positive means a visible scrollbar. */
  readonly horizontalScrollbar: number;
  readonly verticalScrollbar: number;
  /** The nearest scroll container around it that can scroll, or null: a scroll area inside a scroll area. */
  readonly insideRegion: string | null;
  /** Inside an open dialog (the filters sheet), whose one panel scrolls while the page behind it does not. */
  readonly inDialog: boolean;
};

/**
 * Every element that scrolls (or could): what it is called, whether it can scroll now, how much room a scrollbar took
 * from it, and whether another scroll container around it can scroll too. The page itself is not listed. Run it in a
 * browser that draws scrollbars (launched without --hide-scrollbars, no phone emulation), or the scrollbar columns are
 * always zero; `scrollbar-width: none` makes them zero for real.
 */
export async function scanScrollRegions(page: Page): Promise<ScrollRegion[]> {
  return page.evaluate(() => {
    const root = document.scrollingElement;
    const nameOf = (element: Element) =>
      [
        element.tagName.toLowerCase(),
        element.getAttribute('role') === null ? '' : `[role=${element.getAttribute('role') ?? ''}]`,
        element.getAttribute('aria-label') === null
          ? ''
          : `«${(element.getAttribute('aria-label') ?? '').slice(0, 24)}»`,
        typeof element.className === 'string'
          ? `.${element.className.split(/\s+/).slice(0, 3).join('.')}`
          : '',
      ].join('');
    const measure = (element: Element) => {
      const style = getComputedStyle(element);
      const sideways = ['auto', 'scroll'].includes(style.overflowX);
      const down = ['auto', 'scroll'].includes(style.overflowY);
      const borderX = parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
      const borderY = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
      const box = element as HTMLElement;
      return {
        container: sideways || down,
        scrollsSideways: sideways && box.scrollWidth > box.clientWidth + 1,
        scrollsDown: down && box.scrollHeight > box.clientHeight + 1,
        horizontalScrollbar: sideways ? Math.max(0, box.offsetHeight - box.clientHeight - borderY) : 0,
        verticalScrollbar: down ? Math.max(0, box.offsetWidth - box.clientWidth - borderX) : 0,
      };
    };
    const regions: ScrollRegion[] = [];
    for (const element of document.querySelectorAll('*')) {
      if (element === root || element === document.body || element === document.documentElement) continue;
      const own = measure(element);
      if (!own.container) continue;
      let insideRegion: string | null = null;
      for (let parent = element.parentElement; parent !== null; parent = parent.parentElement) {
        if (parent === root || parent === document.body || parent === document.documentElement) break;
        const outer = measure(parent);
        if (outer.scrollsSideways || outer.scrollsDown) {
          insideRegion = nameOf(parent);
          break;
        }
      }
      regions.push({
        name: nameOf(element),
        scrollsSideways: own.scrollsSideways,
        scrollsDown: own.scrollsDown,
        horizontalScrollbar: own.horizontalScrollbar,
        verticalScrollbar: own.verticalScrollbar,
        insideRegion,
        inDialog: element.closest('[role="dialog"]') !== null,
      });
    }
    return regions;
  });
}
