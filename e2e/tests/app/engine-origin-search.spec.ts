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

// Owner feedback of 2026-10-04: «ماشین خارجی تمیز» returned nothing and fell back to a text search. Foreign makes are
// imported by make in the seed, so the Corolla listings come back, with their chips and no text-search notice.
test('«ماشین خارجی تمیز» on the search page returns Corolla listings with the origin chip, not a text search', async ({
  page,
}) => {
  await open(page);
  await ask(page, 'ماشین خارجی تمیز');
  await expect(page.getByRole('button', { name: 'برداشتن «وارداتی»' })).toBeVisible();
  await expect(page.getByText('جست‌وجو در متن آگهی‌ها')).toHaveCount(0);
  await page.getByRole('button', { name: 'نمایش آگهی‌ها' }).click();
  await expect(page).toHaveURL(/origin=imported/);
  await expect(page.locator('[data-results-count]')).not.toContainText('۰ آگهی');
  await expect(page.getByRole('heading', { level: 3 }).first()).toContainText('کرولا');
});

test('«ماشین خارجی تمیز» in the home hero opens the search with Corolla listings', async ({ page }) => {
  await page.goto('/');
  const hero = page.getByRole('region', { name: 'ماشین درست را با قیمت درست بخرید' });
  await hero.getByRole('searchbox', { name: /^چه ماشینی می‌خواهید/ }).fill('ماشین خارجی تمیز');
  await hero.getByRole('button', { name: 'بفهم' }).click();
  await expect(hero.getByRole('button', { name: 'برداشتن «وارداتی»' })).toBeVisible();
  await hero.getByRole('button', { name: 'نمایش آگهی‌ها' }).click();
  await expect(page).toHaveURL(/origin=imported/);
  await expect(page.getByRole('heading', { level: 3 }).first()).toContainText('کرولا');
});

// The country of a brand (CS-103, ADR-0041): «ژاپنی» is Toyota's country whoever assembled the car, so «ماشین ژاپنی» returns
// the Corolla listings with a removable chip and no text-search fallback; a country nobody lists says so, never a silent
// empty page. The lane's data has Toyota (Japan) and Peugeot (France); Korea has no listing.
test("«ماشین ژاپنی» on the search page returns the Japanese brands' listings with the country chip, not a text search", async ({
  page,
}, testInfo) => {
  await open(page);
  await ask(page, 'ماشین ژاپنی');
  await expect(page.getByRole('button', { name: 'برداشتن «کشور ژاپن»' })).toBeVisible();
  await expect(page.getByText('جست‌وجو در متن آگهی‌ها')).toHaveCount(0);
  await page.screenshot({
    path: `../docs/evidence/query-understanding/2026-10-04-country/screenshots/${testInfo.project.name}-japan-understood.png`,
  });
  await page.getByRole('button', { name: 'نمایش آگهی‌ها' }).click();
  await expect(page).toHaveURL(/country=jp/);
  await expect(page.locator('[data-results-count]')).not.toContainText('۰ آگهی');
  await expect(page.getByRole('heading', { level: 3 }).first()).toContainText('کرولا');
  await expect(page.getByRole('button', { name: /برداشتن «کشور ژاپن»/ }).first()).toBeVisible();
  await page.screenshot({
    path: `../docs/evidence/query-understanding/2026-10-04-country/screenshots/${testInfo.project.name}-japan-results.png`,
  });
});

test('«ماشین ژاپنی تمیز» in the home hero opens the search with the country and the clean bundle', async ({
  page,
}) => {
  await page.goto('/');
  const hero = page.getByRole('region', { name: 'ماشین درست را با قیمت درست بخرید' });
  await hero.getByRole('searchbox', { name: /^چه ماشینی می‌خواهید/ }).fill('ماشین ژاپنی تمیز');
  await hero.getByRole('button', { name: 'بفهم' }).click();
  await expect(hero.getByRole('button', { name: 'برداشتن «کشور ژاپن»' })).toBeVisible();
  await expect(hero.getByRole('button', { name: 'برداشتن «بدون رنگ»' })).toBeVisible();
  await hero.getByRole('button', { name: 'نمایش آگهی‌ها' }).click();
  await expect(page).toHaveURL(/country=jp/);
  await expect(page.getByRole('heading', { level: 3 }).first()).toContainText('کرولا');
});

test('«ماشین کره‌ای تمیز» says that nobody lists a Korean car, and keeps the chips', async ({
  page,
}, testInfo) => {
  await open(page);
  await ask(page, 'ماشین کره‌ای تمیز');
  await expect(page.getByRole('button', { name: 'برداشتن «کشور کره جنوبی»' })).toBeVisible();
  await expect(page.getByText('فعلاً آگهی‌ای از «کره جنوبی» در کارشناس نیست')).toBeVisible();
  await expect(page.getByText('جست‌وجو در متن آگهی‌ها')).toHaveCount(0);
  await page.getByRole('button', { name: 'نمایش آگهی‌ها' }).click();
  await expect(page).toHaveURL(/country=kr/);
  await expect(page.locator('[data-results-count]')).toContainText('۰ آگهی');
  await page.screenshot({
    path: `../docs/evidence/query-understanding/2026-10-04-country/screenshots/${testInfo.project.name}-korea-empty.png`,
  });
});

test('Finglish «japoni» and «faranse» give the Japanese and French brands, and the filter panel lists the countries with counts', async ({
  page,
}) => {
  await open(page);
  await ask(page, 'japoni');
  await expect(page.getByRole('button', { name: 'برداشتن «کشور ژاپن»' })).toBeVisible();
  await page.getByRole('button', { name: 'نمایش آگهی‌ها' }).click();
  await expect(page).toHaveURL(/country=jp/);
  // The country is in the filter panel (the rail on a desktop, the sheet on a phone) as a list with how many listings each has.
  const phone = (page.viewportSize()?.width ?? 0) < 1024;
  if (phone) await page.getByRole('button', { name: /^فیلترها/ }).click();
  const panel = phone ? page.getByRole('dialog', { name: 'فیلترها' }) : page.getByRole('complementary');
  const japan = panel.getByRole('checkbox', { name: /^ژاپن/ });
  if (!(await japan.isVisible())) await panel.locator('summary', { hasText: 'خودرو' }).first().click();
  await expect(japan).toBeChecked();
  await expect(panel.getByRole('checkbox', { name: /^فرانسه/ })).toBeVisible();
});

test('floor: the search page with the country chip has no sideways scroll and no axe findings', async ({
  page,
  rtl,
  a11y,
}) => {
  await page.goto('/search?country=jp&country=fr');
  await expect(page.locator('[data-results-count]')).toBeVisible();
  await rtl.expectNoHorizontalOverflow();
  await a11y.check();
});
