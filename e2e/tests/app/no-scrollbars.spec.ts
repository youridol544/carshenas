import type { Page } from '@playwright/test';
import { APP_PAGES } from '../../fixtures/app-pages';
import { scanScrollRegions, type ScrollRegion } from '../../fixtures/scroll-regions';
import { expect, test } from '../../fixtures/test';
import { waitForHydration } from '../../gorilla/layout';

// No visible scrollbar on a row, no scroll area inside another, and nothing scrolling inside the filters (CS-112, the
// owner's feedback of 2026-10-04): on every public page, at the two widths of the product, 412 px and 1440 px. The
// scrollbars are really drawn here: the browser is not launched with --hide-scrollbars and does not pretend to be a
// phone (whose scrollbars are overlays that take no room), so a row that has a scrollbar loses height to it and the scan
// sees it. The one vertical scroll area the product keeps on these pages is the panel of the open filters sheet, a modal
// dialog whose page behind it does not scroll; a table or a row that is wider than its box may scroll sideways, with no
// bar. The rows' own behaviour is in scroll-rails.spec.ts.

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'it sets its own widths and its own browser');
});
test.use({ isMobile: false, hasTouch: false, launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

const WIDTHS = [412, 1440] as const;

/** The pages anyone can open; the three that need a sign-in or the superadmin are not in the list. */
const PUBLIC = APP_PAGES;

function problems(regions: readonly ScrollRegion[]): string[] {
  const found: string[] = [];
  for (const region of regions) {
    if (region.horizontalScrollbar > 0) {
      found.push(`${region.name} shows a horizontal scrollbar of ${String(region.horizontalScrollbar)} px`);
    }
    if (region.insideRegion !== null && (region.scrollsSideways || region.scrollsDown)) {
      found.push(`${region.name} scrolls inside ${region.insideRegion}`);
    }
    if (region.scrollsDown && !region.inDialog) {
      found.push(`${region.name} scrolls vertically, and it is not the panel of a dialog`);
    }
  }
  return found;
}

/** Every closed disclosure open, so the tables and the filter groups that sit in them are on the page to be scanned. */
async function openEveryDisclosure(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const details of document.querySelectorAll('details')) details.open = true;
  });
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

for (const width of WIDTHS) {
  test.describe(`at ${String(width)} px`, () => {
    test.use({ viewport: { width, height: 900 } });

    for (const entry of PUBLIC) {
      test(`${entry.name} has no scrollbar on a row, and no scroll area inside another`, async ({
        page,
        rtl,
      }) => {
        await page.goto(entry.path);
        await entry.ready(page);
        await entry.loaded?.(page);
        await waitForHydration(page);
        await openEveryDisclosure(page);
        await rtl.expectNoHorizontalOverflow();
        expect(problems(await scanScrollRegions(page))).toEqual([]);
      });
    }

    test('an info popover opened on the home page shows its whole explanation, with nothing to scroll', async ({
      page,
    }) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await waitForHydration(page);
      await page
        .getByRole('button', { name: /^توضیح درباره‌ی/ })
        .first()
        .click();
      const popup = page.getByRole('dialog');
      await expect(popup).toBeVisible();
      const regions = await scanScrollRegions(page);
      // the popup keeps overflow-y: auto as a safety net for very large text, and at the normal size it has nothing to scroll
      const inPopup = regions.filter((region) => region.inDialog);
      expect(inPopup.length).toBeGreaterThan(0);
      expect(inPopup.filter((region) => region.scrollsDown || region.scrollsSideways)).toEqual([]);
      expect(problems(regions)).toEqual([]);
    });

    test('the search page with its filter lists grown has no scroll area in the filters either', async ({
      page,
    }) => {
      await page.goto('/search');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await waitForHydration(page);
      let panel = page.getByRole('complementary');
      if (width < 1024) {
        await page.getByRole('button', { name: /^فیلترها/ }).click();
        panel = page.getByRole('dialog', { name: 'فیلترها' });
        await expect(panel).toBeVisible();
      }
      await expect(panel.getByRole('group', { name: 'برند' })).toBeVisible();
      // every group open, and every list grown to its end
      await openEveryDisclosure(page);
      const more = panel.getByRole('button', { name: /^نمایش بیشتر/ });
      // the lists grown several times over: the rail or the sheet is far taller, and still nothing scrolls inside it
      for (let press = 0; press < 6 && (await more.count()) > 0; press += 1) await more.first().click();
      const regions = await scanScrollRegions(page);
      expect(problems(regions)).toEqual([]);
      // the rail on a desktop never scrolls at all; the sheet's one panel is the only vertical scroll area on the page
      const vertical = regions.filter((region) => region.scrollsDown);
      if (width >= 1024) expect(vertical).toEqual([]);
      else expect(vertical.map((region) => region.inDialog)).toEqual(vertical.map(() => true));
    });
  });
}
