import type { Page } from '@playwright/test';
import { assumeMileage, removeListingPages, seedListingPages } from '../../fixtures/listing-page';
import { removeSearchListings, seedSearchListings } from '../../fixtures/search-listings';
import { expect, test } from '../../fixtures/test';
import { inspectLayout, waitForHydration } from '../../gorilla/layout';

// A mileage read in thousands (CS-101, ADR-0040) is said so wherever it is shown: on the listing page under the
// mileage, and on the result card, each with an info control that explains the rule. The words are @carshenas/search's
// (mileage-reading.ts), the numbers Persian digits through the locale formatters.

const LINE = /۱۰۰\s+کیلومتر نوشته شده\. از روی قیمت و سال، احتمالاً ۱۰۰٬۰۰۰\s+کیلومتر است\./;
const PERCENT = /۱۵\u200f٪/;
const INFO = 'توضیح درباره‌ی کارکرد تخمینی';

async function expectInfoOpens(page: Page, scope: ReturnType<Page['locator']>): Promise<void> {
  const button = scope.getByRole('button', { name: INFO });
  await expect(button).toBeVisible();
  await button.click();
  const popup = page.getByRole('dialog');
  await expect(popup).toContainText('هزار کیلومتر');
  await expect(popup).not.toContainText('(«');
  // The thresholds of the valuation run are not quoted (CS-110, the voice guide section 5): the reason is in a buyer's terms.
  await expect(popup).not.toContainText(PERCENT);
  await expect(popup).not.toContainText('۴۰٬۰۰۰');
  await expect(popup).toContainText('بعید است');
  await page.keyboard.press('Escape');
  await expect(popup).toBeHidden();
}

test('the listing page says the mileage was read in thousands, and the info control explains the rule', async ({
  page,
}, testInfo) => {
  const seed = await seedListingPages();
  try {
    await assumeMileage({ id: seed.ids.rated });
    await page.goto(`/listings/${String(seed.ids.rated)}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await waitForHydration(page);
    const note = page.locator('[data-mileage-note]');
    await expect(note).toHaveText(LINE);
    // The mileage itself is the assumed one, with the digits Persian.
    await expect(page.getByRole('term').filter({ hasText: 'کارکرد' }).locator('..')).toContainText('۱۰۰٬۰۰۰');
    await expectInfoOpens(page, note);
    const layout = await inspectLayout(page);
    expect(layout.overflowPx).toBeLessThanOrEqual(0);
    expect([layout.smallTargets, layout.brokenNumbers, layout.brokenWords]).toEqual([[], [], []]);
    await page.screenshot({ path: testInfo.outputPath('listing-assumed-mileage.png'), fullPage: false });
  } finally {
    await removeListingPages(seed);
  }
});

test('a result card says the mileage was read in thousands, with the same info control', async ({
  page,
}, testInfo) => {
  const seed = await seedSearchListings();
  try {
    const first = seed.listings[0];
    if (first === undefined) throw new Error('no seeded listing');
    await assumeMileage({ key: first.key });
    await page.goto(`/search?q=${seed.token}`);
    await waitForHydration(page);
    const note = page.locator('[data-mileage-note]');
    await expect(note).toHaveCount(1);
    await expect(note).toHaveText(/۱۰۰\s+کیلومتر نوشته شده/);
    await expect(note.locator('..')).toContainText('احتمالاً');
    await expectInfoOpens(page, note);
    await page.screenshot({ path: testInfo.outputPath('card-assumed-mileage.png'), fullPage: false });
  } finally {
    await removeSearchListings(seed);
  }
});
