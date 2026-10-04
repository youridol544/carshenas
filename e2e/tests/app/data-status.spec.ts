import { expect, test } from '../../fixtures/test';

// The public data-status page (CS-66) on the real app and its database: how fresh the index is, per source and for
// the whole index; a source that is not being updated says so, with the date of its latest data; market values and
// the published evaluation; every number in Persian digits; nothing technical (no addresses, errors or traces).
// The figures are whatever the database holds, so the tests check what must hold for any of them.

const COPY = {
  title: 'تازگی داده‌ها',
  sources: 'منبع‌ها',
  targets: 'هدف‌های تازگی',
  valuation: 'ارزش بازار',
  extraction: 'خواندن متن آگهی‌ها',
  how: 'آگهی‌ها چطور تازه می‌مانند',
  figures: ['آگهی فعال', 'آگهی تازه', 'رفته از بازار', 'زمان از آخرین بررسی'],
  states: ['به‌روز', 'با تأخیر', 'به‌روز نمی‌شود'],
  notUpdating: 'به‌روز نمی‌شود',
  latestData: 'آخرین داده‌هایش از',
  chartTable: 'عددهای نمودار',
} as const;

test.beforeEach(async ({ page }) => {
  await page.goto('/status');
  await expect(page.getByRole('heading', { level: 1, name: COPY.title })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: COPY.sources })).toBeVisible();
});

test('is a Farsi right-to-left page, named in the title, that fits the screen and passes axe', async ({
  page,
  rtl,
  a11y,
}) => {
  await rtl.expectDocumentRtl();
  await expect(page).toHaveTitle(`${COPY.title} | کارشناس`);
  await rtl.expectNoHorizontalOverflow();
  await a11y.check();
});

test('shows the whole index in four figures and each part of the report, in Persian digits', async ({
  page,
  rtl,
}) => {
  for (const label of COPY.figures) {
    await expect(
      page
        .getByRole('term')
        .filter({ hasText: new RegExp(`^${label}$`) })
        .first(),
    ).toBeVisible();
  }
  for (const name of [COPY.targets, COPY.valuation, COPY.extraction]) {
    await expect(page.getByRole('region', { name })).toBeVisible();
  }
  // How the index is kept: an aside beside the figures on a desktop, a disclosure under the lead on a phone.
  await expect(page.getByText(COPY.how, { exact: true }).filter({ visible: true })).toHaveCount(1);
  // Every figure, date and count reads in Persian digits; model names may carry Latin letters, never Latin digits.
  await rtl.expectPersianDigits(page.getByRole('main'));
});

test('every source shows its state, and one that is not being updated gives the date of its latest data', async ({
  page,
}) => {
  const cards = page.getByRole('region', { name: COPY.sources }).getByRole('article');
  await expect(cards.first()).toBeVisible();
  // Divar, the one source crawled today, is always listed.
  await expect(page.getByRole('article', { name: 'دیوار' })).toBeVisible();
  for (const card of await cards.all()) {
    const badge = card.getByText(new RegExp(`^(${COPY.states.join('|')})$`));
    await expect(badge).toBeVisible();
    if ((await badge.textContent()) === COPY.notUpdating) {
      const note = card.getByText(COPY.latestData, { exact: false });
      await expect(note).toBeVisible();
      await expect(note.locator('time')).toHaveText(/[۰-۹]+ \S+ [۰-۹]{4}/);
    }
  }
});

test('shows no fetched address, error or trace: a visitor sees facts, not internals', async ({ page }) => {
  const text = await page.getByRole('main').innerText();
  expect(text).not.toMatch(/https?:\/\/|divar\.ir|trace|error|Error|خطای سرور/);
});

test('the chart has a table of its hourly figures, opened from the keyboard', async ({ page }) => {
  const summary = page.getByText(COPY.chartTable).first();
  test.skip((await summary.count()) === 0, 'no hourly measurement in the last 48 hours');
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('table').first()).toBeVisible();
});

test('nothing moves while the figures arrive', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'layout-shift entries exist only in Chromium');
  await page.addInitScript(() => {
    let total = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & {
        value: number;
        hadRecentInput: boolean;
      })[])
        if (!entry.hadRecentInput) total += entry.value;
    }).observe({ type: 'layout-shift', buffered: true });
    Object.defineProperty(window, 'layoutShiftTotal', { get: () => total });
  });
  await page.goto('/status');
  await expect(page.getByRole('heading', { level: 2, name: COPY.sources })).toBeVisible();
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  expect(await page.evaluate(() => Number(Reflect.get(window, 'layoutShiftTotal')))).toBe(0);
});
