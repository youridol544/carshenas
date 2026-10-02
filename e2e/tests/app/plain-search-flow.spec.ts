import { expect, test } from '../../fixtures/test';

// Plain-Farsi search on the search page, the whole flow (CS-62, CS-93): open the box, write a sentence, see what was
// understood, take a filter off, apply, and land on /search with the rest in the address and in the page's own chips.
// The model is off (the master switch's default), so code alone reads the sentence and the box says so.

const SENTENCE = 'پژو ۲۰۶ تیپ ۲ بدون رنگ زیر ۷۰۰ میلیون';
const OWNER_EXAMPLE = 'یک ماشین تمیز کم کار و بیدردسر میخوام که همه چیش از نظر فنی خوب باشه و تمیز باشه';

async function open(page: import('@playwright/test').Page) {
  await page.goto('/search');
  await page.getByText('با یک جمله بگویید چه می‌خواهید').click();
}

async function ask(page: import('@playwright/test').Page, sentence: string) {
  await page.getByRole('searchbox', { name: 'ماشین مورد نظرتان را بنویسید' }).fill(sentence);
  await page.getByRole('button', { name: 'بفهم' }).click();
}

test('a sentence becomes chips, one is taken off, and applying opens the search with the rest', async ({
  page,
}, testInfo) => {
  await open(page);
  await ask(page, SENTENCE);
  await expect(page.getByRole('button', { name: 'برداشتن «بدون رنگ»' })).toBeVisible();
  await page.screenshot({
    path: `../docs/evidence/query-understanding/2026-10-02/screenshots/${testInfo.project.name}-search-page-understood.png`,
  });
  await page.getByRole('button', { name: 'برداشتن «بدون رنگ»' }).click();
  await page.getByRole('button', { name: 'نمایش آگهی‌ها' }).click();
  await expect(page).toHaveURL(/model=peugeot\.206/);
  const url = new URL(page.url());
  expect(url.searchParams.get('trim')).toBe('peugeot.206.2');
  expect(url.searchParams.get('price')).toBe('..700000000');
  expect(url.searchParams.has('nopaint')).toBe(false);
  // The page's own applied chips show what the sentence became.
  await expect(page.getByRole('button', { name: /پژو ۲۰۶/ }).first()).toBeVisible();
});

test('the owner’s vague request opens the search with the clean-and-easy filters', async ({
  page,
}, testInfo) => {
  await open(page);
  await ask(page, OWNER_EXAMPLE);
  await expect(page.getByRole('button', { name: 'برداشتن «موتور سالم»' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: /این‌ها را هم گذاشتم/ }).first()).toBeVisible();
  await page.getByRole('button', { name: 'نمایش آگهی‌ها' }).click();
  await expect(page).toHaveURL(/catalogue=/);
  // The box closes so the results are what is on screen.
  await expect(page.getByRole('searchbox', { name: 'ماشین مورد نظرتان را بنویسید' })).toBeHidden();
  await page.screenshot({
    path: `../docs/evidence/query-understanding/2026-10-02/screenshots/${testInfo.project.name}-search-page-owner-applied.png`,
  });
});

test('words nobody could read are said on the search page and can be searched as text', async ({ page }) => {
  await open(page);
  await ask(page, 'پژو ۲۰۶ خوشگل');
  await expect(page.getByText('فهم هوشمند جمله فعلاً خاموش است')).toBeVisible();
  await page.getByRole('button', { name: 'جست‌وجو در متن آگهی‌ها' }).click();
  await page.getByRole('button', { name: 'نمایش آگهی‌ها' }).click();
  await expect(page).toHaveURL(/q=/);
});

test('floor: the search page with the box open has no sideways scroll and no axe findings', async ({
  page,
  rtl,
  a11y,
}) => {
  await open(page);
  await ask(page, OWNER_EXAMPLE);
  await expect(page.getByRole('button', { name: /^برداشتن/ }).first()).toBeVisible();
  await rtl.expectNoHorizontalOverflow();
  await a11y.check();
});
