import type { Locator, Page } from '@playwright/test';
import { scanScrollRegions } from '../../fixtures/scroll-regions';
import { expect, test } from '../../fixtures/test';
import { waitForHydration } from '../../gorilla/layout';

// The filters never scroll inside themselves (CS-112; the owner, 2026-10-04: «on the search page the filters have vertical
// scroll inside facet lists (make, model, colour…): remove it»). A list shows its top options and grows in place with
// «نمایش بیشتر», so the page scrolls; the rail beside the results is pinned only while all of it fits the window; the
// phone's sheet has one scroll area and nothing scrolls inside that. They run on the lane's real data: the list of models
// holds more than seven, so it is cut after its first five, and the colours (written in code) are fifteen.

const COPY = {
  model: 'مدل',
  colour: 'رنگ',
  more: /^نمایش بیشتر/,
  fewer: 'نمایش کمتر',
  sheet: 'فیلترها',
} as const;

async function openSearch(page: Page): Promise<void> {
  await page.goto('/search');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await waitForHydration(page);
}

/** Every closed group of filters opened, so each list is on the page. */
async function openEveryGroup(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const details of document.querySelectorAll('details')) details.open = true;
  });
}

const options = (list: Locator) => list.getByRole('checkbox');

test.describe('on a desktop', () => {
  test.skip(({ isMobile }) => isMobile, 'the phone has a sheet: see below');

  test('the rail has no scroll of its own, however tall its lists grow', async ({ page }) => {
    await openSearch(page);
    const rail = page.getByRole('complementary');
    await openEveryGroup(page);
    const before = await rail.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        overflowY: style.overflowY,
        maxHeight: style.maxHeight,
        height: element.getBoundingClientRect().height,
      };
    });
    expect(before.overflowY).toBe('visible');
    expect(before.maxHeight).toBe('none');
    const more = rail.getByRole('button', { name: COPY.more });
    for (let press = 0; press < 6 && (await more.count()) > 0; press += 1) await more.first().click();
    const after = await rail.evaluate((element) => ({
      height: element.getBoundingClientRect().height,
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
    }));
    // the rail itself grew, and has nothing left to scroll
    expect(after.height).toBeGreaterThan(before.height);
    expect(after.scrollHeight).toBeLessThanOrEqual(after.clientHeight + 1);
    expect((await scanScrollRegions(page)).filter((region) => region.scrollsDown)).toEqual([]);
  });

  test('a list shows its top options and grows in place, with the focus staying on the button', async ({
    page,
  }) => {
    await openSearch(page);
    const rail = page.getByRole('complementary');
    // the models: the longest list of the five that are always open
    const models = rail.getByRole('group', { name: COPY.model, exact: true });
    const shown = await options(models).count();
    expect(shown, 'the top five, nothing chosen').toBe(5);
    // one button in both of its states, so the same locator follows it from «نمایش بیشتر» to «نمایش کمتر»
    const more = models.getByRole('button', { name: /^نمایش (بیشتر|کمتر)/ });
    await expect(more).toBeVisible();
    await expect(more).toHaveAccessibleName(COPY.more);
    const pageHeight = () => page.evaluate(() => document.documentElement.scrollHeight);
    const heightBefore = await pageHeight();
    await more.click();
    // the same button grew the list: more options, the button still there and still focused, the page taller
    expect(await options(models).count()).toBeGreaterThan(shown);
    await expect(more).toBeFocused();
    expect(await pageHeight()).toBeGreaterThanOrEqual(heightBefore);
    // to the end, and back
    for (
      let guard = 0;
      guard < 12 && (await models.getByRole('button', { name: COPY.more }).count()) > 0;
      guard += 1
    ) {
      await models.getByRole('button', { name: COPY.more }).click();
    }
    const fewer = models.getByRole('button', { name: COPY.fewer });
    await expect(fewer).toBeVisible();
    await fewer.click();
    await expect(options(models)).toHaveCount(shown);
  });

  test('the colours show their first six and grow like the lists of models', async ({ page }) => {
    await openSearch(page);
    await openEveryGroup(page);
    const colours = page.getByRole('complementary').getByRole('group', { name: COPY.colour, exact: true });
    await expect(options(colours)).toHaveCount(6);
    await colours.getByRole('button', { name: COPY.more }).click();
    expect(await options(colours).count()).toBeGreaterThan(6);
    await expect(colours.getByRole('button', { name: COPY.fewer })).toBeVisible();
  });

  test('the rail is pinned beside the results only while all of it fits the window', async ({ page }) => {
    await openSearch(page);
    const rail = page.getByRole('complementary');
    const height = await rail.evaluate((element) => element.getBoundingClientRect().height);
    const position = () => rail.evaluate((element) => getComputedStyle(element).position);
    // a window taller than the rail: it is pinned, and stays in view while the results scroll past
    await page.setViewportSize({ width: 1440, height: Math.ceil(height) + 80 });
    await expect
      .poll(position, { message: `a window taller than the ${String(height)} px rail` })
      .toBe('sticky');
    // a window shorter than the rail: it would be cut off at the bottom with no way to reach it, so it scrolls away with the page
    await page.setViewportSize({ width: 1440, height: Math.max(300, Math.floor(height) - 120) });
    await expect
      .poll(position, { message: `a window shorter than the ${String(height)} px rail` })
      .toBe('static');
  });
});

test.describe('on a phone', () => {
  test.skip(({ isMobile }) => !isMobile, 'the desktop has a rail: see above');

  test('the sheet scrolls as one area, its lists grow inside it, and nothing scrolls inside that', async ({
    page,
  }) => {
    await openSearch(page);
    await page.getByRole('button', { name: /^فیلترها/ }).click();
    const sheet = page.getByRole('dialog', { name: COPY.sheet });
    await expect(sheet).toBeVisible();
    await openEveryGroup(page);
    const more = sheet.getByRole('button', { name: COPY.more });
    for (let press = 0; press < 6 && (await more.count()) > 0; press += 1) await more.first().click();
    const regions = await scanScrollRegions(page);
    const scrolling = regions.filter((region) => region.scrollsDown);
    // one area scrolls, it is the sheet's panel, and it is not inside another
    expect(scrolling).toHaveLength(1);
    expect(scrolling[0]?.inDialog).toBe(true);
    expect(scrolling[0]?.insideRegion).toBeNull();
    expect(regions.filter((region) => region.insideRegion !== null)).toEqual([]);
  });
});
