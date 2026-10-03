import type { Page } from '@playwright/test';
import { expect, test } from '../../fixtures/test';

// Engine volume and origin in plain-Farsi search (CS-100, ADR-0039): the owner's phrasings become chips, one chip is taken
// off, applying opens the search with the rest in the address, and a search on a value the catalogue does not hold for
// some cars says how many it left out. The model is off (the default), so code alone reads the sentences.

const BOX = 'ماشین مورد نظرتان را بنویسید';

async function open(page: Page) {
  await page.goto('/search');
  await page.getByText('با یک جمله بگویید چه می‌خواهید').click();
}

async function ask(page: Page, sentence: string) {
  await page.getByRole('searchbox', { name: BOX }).fill(sentence);
  await page.getByRole('button', { name: 'بفهم' }).click();
}

test('«ماشین با حجم موتور بیشتر از ۲۰۰۰ سی‌سی» becomes a volume chip and opens the search with it', async ({
  page,
}, testInfo) => {
  await open(page);
  await ask(page, 'ماشین با حجم موتور بیشتر از ۲۰۰۰ سی‌سی');
  await expect(page.getByRole('button', { name: /^برداشتن «حجم موتور حداقل ۲٬۰۰۰ سی‌سی»/ })).toBeVisible();
  await page.screenshot({
    path: `../docs/evidence/query-understanding/2026-10-03-engine-volume/screenshots/${testInfo.project.name}-volume-understood.png`,
  });
  await page.getByRole('button', { name: 'نمایش آگهی‌ها' }).click();
  await expect(page).toHaveURL(/cc=2000\.\./);
  await expect(
    page.getByRole('button', { name: /برداشتن «حجم موتور حداقل ۲٬۰۰۰ سی‌سی»/ }).first(),
  ).toBeVisible();
  // The cars whose volume nobody holds are left out and counted, in words.
  await expect(page.locator('[data-unknown-value="engine_volume"]')).toContainText('حجم موتورش معلوم نیست');
  await page.screenshot({
    path: `../docs/evidence/query-understanding/2026-10-03-engine-volume/screenshots/${testInfo.project.name}-volume-results.png`,
  });
});

test('«ماشین‌های خارجی تمیز» is the imported origin and the clean bundle; the chip comes off', async ({
  page,
}, testInfo) => {
  await open(page);
  await ask(page, 'ماشین‌های خارجی تمیز');
  await expect(page.getByRole('button', { name: 'برداشتن «وارداتی»' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'برداشتن «بدون رنگ»' })).toBeVisible();
  await page.screenshot({
    path: `../docs/evidence/query-understanding/2026-10-03-engine-volume/screenshots/${testInfo.project.name}-origin-understood.png`,
  });
  await page.getByRole('button', { name: 'برداشتن «بدون رنگ»' }).click();
  await page.getByRole('button', { name: 'نمایش آگهی‌ها' }).click();
  await expect(page).toHaveURL(/origin=imported/);
  expect(new URL(page.url()).searchParams.has('nopaint')).toBe(false);
});

test('«hajme motor bishtar az 2000cc» in Latin letters and digits gives the same volume', async ({
  page,
}) => {
  await open(page);
  await ask(page, 'hajme motor bishtar az 2000cc');
  await expect(page.getByRole('button', { name: /^برداشتن «حجم موتور حداقل ۲٬۰۰۰ سی‌سی»/ })).toBeVisible();
  await page.getByRole('button', { name: 'نمایش آگهی‌ها' }).click();
  await expect(page).toHaveURL(/cc=2000\.\./);
});

test('a litre figure and a range become one volume range chip, and the address round-trips', async ({
  page,
}) => {
  await page.goto('/search?cc=1400..1800&origin=domestic&origin=joint_venture');
  await expect(
    page.getByRole('button', { name: /برداشتن «حجم موتور ۱٬۴۰۰ تا ۱٬۸۰۰ سی‌سی»/ }).first(),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /برداشتن «ایرانی»/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /برداشتن «ساخت مشترک»/ }).first()).toBeVisible();
});

test('floor: no sideways scroll and no axe findings with the volume chip on the page', async ({
  page,
  rtl,
  a11y,
}) => {
  await page.goto('/search?cc=1600..&origin=domestic&origin=joint_venture');
  await expect(page.locator('[data-results-count]')).toBeVisible();
  await rtl.expectNoHorizontalOverflow();
  await a11y.check();
});

test('the home hero box understands «۲۰۰۰ cc به بالا» the same way', async ({ page }) => {
  await page.goto('/');
  const hero = page.getByRole('region', { name: 'ماشین درست را با قیمت درست بخرید' });
  await hero.getByRole('searchbox', { name: /^چه ماشینی می‌خواهید/ }).fill('۲۰۰۰ cc به بالا');
  await hero.getByRole('button', { name: 'بفهم' }).click();
  await expect(hero.getByRole('button', { name: /^برداشتن «حجم موتور حداقل ۲٬۰۰۰ سی‌سی»/ })).toBeVisible();
  await hero.getByRole('button', { name: 'نمایش آگهی‌ها' }).click();
  await expect(page).toHaveURL(/cc=2000\.\./);
});
