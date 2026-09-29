import { APP_PAGES } from '../../fixtures/app-pages';
import { expect, test } from '../../fixtures/test';
import {
  inflateText,
  inspectLayout,
  keyboardWalk,
  scaleDefaultFontSize,
  slowDown,
  waitForHydration,
} from '../../gorilla/layout';

// The deterministic half of the gorilla tests: every page in fixtures/app-pages.ts under the conditions cheap phones and
// flaky mobile networks produce. No sideways scroll, no text cut off by its box, no control under 44 px
// (.claude/rules/ui.md; WCAG 2.5.8 itself asks for 24), and a keyboard path through the page.

const WIDTHS: Record<string, readonly number[]> = {
  mobile: [320, 360, 412],
  iphone: [375, 393],
  desktop: [768, 1024, 1440, 1920],
};
const MIN_TARGET = 44;

for (const target of APP_PAGES) {
  test.describe(`${target.name} page under stress`, () => {
    test('keeps its layout at every width of the project', async ({ page }, testInfo) => {
      for (const width of WIDTHS[testInfo.project.name] ?? [page.viewportSize()?.width ?? 412]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(target.path);
        await target.ready(page);
        const report = await inspectLayout(page, { minTarget: MIN_TARGET });
        expect.soft(report.overflowPx, `${width}px: the page scrolls sideways`).toBeLessThanOrEqual(1);
        expect.soft(report.clipped, `${width}px: text cut off by its box`).toEqual([]);
        expect.soft(report.smallTargets, `${width}px: controls under ${MIN_TARGET}px`).toEqual([]);
        expect
          .soft(report.misorderedSigns, `${width}px: a percent sign on the wrong side of its number`)
          .toEqual([]);
        expect.soft(report.brokenWords, `${width}px: a Persian word split across lines`).toEqual([]);
        expect
          .soft(report.brokenNumbers, `${width}px: a number split inside a group or from its unit`)
          .toEqual([]);
      }
    });

    test('keeps its layout when every string is long Farsi', async ({ page }, testInfo) => {
      const narrowest = Math.min(...(WIDTHS[testInfo.project.name] ?? [page.viewportSize()?.width ?? 412]));
      await page.setViewportSize({ width: narrowest, height: 900 });
      await page.goto(target.path);
      await target.ready(page);
      await waitForHydration(page);
      await inflateText(page);
      const report = await inspectLayout(page, { minTarget: MIN_TARGET });
      expect(report.overflowPx, `${narrowest}px: the page scrolls sideways`).toBeLessThanOrEqual(1);
      expect(report.clipped, 'text cut off by its box').toEqual([]);
    });

    test('grows its text with the browser font size and keeps its layout', async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'uses a Chromium DevTools Protocol call');
      await page.goto(target.path);
      await target.ready(page);
      const heading = page.getByRole('heading', { level: 1 });
      const before = await heading.evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
      await scaleDefaultFontSize(page, 2);
      await page.reload();
      await target.ready(page);
      const after = await heading.evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
      // WCAG 1.4.4: text follows the reader's setting. Sizes in px would stay put.
      expect(after / before, `heading ${before}px -> ${after}px`).toBeGreaterThanOrEqual(1.9);
      const report = await inspectLayout(page, { minTarget: MIN_TARGET });
      expect(report.overflowPx, 'the page scrolls sideways at double text size').toBeLessThanOrEqual(1);
      expect(report.clipped, 'text cut off by its box at double text size').toEqual([]);
      expect(report.brokenWords, 'a Persian word split across lines at double text size').toEqual([]);
      expect(
        report.brokenNumbers,
        'a number split inside a group or from its unit at double text size',
      ).toEqual([]);
    });

    test('shows its content before a slow network has finished, and keeps its layout', async ({ page }) => {
      // Every script, style and font waits 400 ms: a congested mobile network. The page must be readable as soon
      // as its HTML has arrived, not only after everything has loaded.
      await slowDown(page, 400, (url) => url.pathname !== target.path);
      let loaded = false;
      page.once('load', () => {
        loaded = true;
      });
      await page.goto(target.path, { waitUntil: 'commit' });
      await target.ready(page);
      expect(loaded, 'the content only appeared after every slow resource had loaded').toBe(false);
      await page.waitForLoadState('load');
      expect((await inspectLayout(page, { minTarget: MIN_TARGET })).overflowPx).toBeLessThanOrEqual(1);
    });

    test('can be used from the keyboard', async ({ page }) => {
      await page.goto(target.path);
      await target.ready(page);
      const walk = await keyboardWalk(page);
      expect(
        walk.problems,
        walk.stops.map((stop) => `${stop.step}. ${stop.element} "${stop.name}"`).join('\n'),
      ).toEqual([]);
    });
  });

  test.describe(`${target.name} page when its scripts fail to load`, () => {
    // The failed script requests are the point; the shared console guard must not fail on them.
    test.use({ failOnBrowserErrors: false });

    test('still shows its server-rendered content without breaking the layout', async ({ page }) => {
      await page.route(/\/_next\/static\/.+\.js(\?.*)?$/, (route) => route.abort('failed'));
      await page.goto(target.path);
      await target.ready(page);
      expect((await inspectLayout(page, { minTarget: MIN_TARGET })).overflowPx).toBeLessThanOrEqual(1);
    });
  });
}
