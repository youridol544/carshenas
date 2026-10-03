import type { Page } from '@playwright/test';
import { removeModelPage, seedModelPage, type ModelPageSeed } from '../../fixtures/model-page';
import { expect, test as base } from '../../fixtures/test';
import { waitForHydration } from '../../gorilla/layout';

// The model page (CS-67): what a buyer sees on /models/<make>/<model> and the way to it, on a make and two models of
// the seed's own (fixtures/model-page.ts): one with 29 listings in four model years and a valuation history, one with
// none. The history is eight daily runs over 32 days for model year 1400 (so its trend is drawn by the week, with a
// 30-day change and no 90-day change), two runs for 1398 (a short history), one run for 1401 and 1399 (none). The
// numbers the page prints are the seed's, worked out in the fixture, so a figure that drifts fails here.

const COPY = {
  models: 'مدل‌ها',
  sample: /عکس نمونه از بدنه‌ی سدان/,
  trend: 'روند قیمت',
  trendInfo: 'توضیح درباره‌ی روند قیمت',
  rangeInfo: 'توضیح درباره‌ی محدوده‌ی قیمت',
  valueInfo: 'توضیح درباره‌ی ارزش بازار',
  ratingsInfo: 'توضیح درباره‌ی ارزیابی آگهی‌ها',
  dealsInfo: 'توضیح درباره‌ی ترتیب بهترین معامله‌ها',
  popularInfo: 'توضیح درباره‌ی مدل پرطرفدار',
  table: 'جدول عددهای نمودار',
  short: 'تاریخچه‌ی قیمت هنوز کوتاه است',
  none: 'برای این سال ساخت هنوز روندی نداریم',
  deals: 'بهترین معامله‌های این مدل',
  great: 'معامله‌ی عالی',
  empty: 'الان آگهی‌ای از این مدل نداریم',
  notYet: /هنوز تاریخچه نداریم/,
  close: 'بستن',
} as const;

const test = base.extend<{ seed: ModelPageSeed }>({
  seed: async ({}, use) => {
    const seed = await seedModelPage();
    await use(seed);
    await removeModelPage(seed);
  },
});

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024;
const href = (seed: ModelPageSeed, year?: number) =>
  `/models/${seed.make.slug}/${seed.model.slug}${year === undefined ? '' : `?year=${String(year)}`}`;

async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await waitForHydration(page);
}

/** The streamed sections have arrived: the skeletons' status line is gone. */
async function settled(page: Page): Promise<void> {
  await expect(page.getByRole('status').filter({ hasText: 'در حال بارگذاری اطلاعات مدل' })).toHaveCount(0);
}

/** A price as the page prints it: three significant digits for an estimate, in Persian digits. */
function millions(toman: number): RegExp {
  const digits = Math.round(toman / 1_000_000).toLocaleString('fa-IR', { useGrouping: false });
  return new RegExp(`${digits}٬۰۰۰٬۰۰۰`);
}

test.describe('a model with listings and a history', () => {
  test('shows the name, the figures, a sample photograph and one primary action', async ({
    page,
    seed,
    rtl,
    a11y,
  }) => {
    await open(page, href(seed));
    await settled(page);
    await rtl.expectDocumentRtl();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(seed.model.name);
    await expect(page).toHaveTitle(new RegExp(`^${seed.model.name}`));
    await expect(
      page.getByText(
        `${String(seed.numbers.count).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)] ?? d)} آگهی در بازار`,
      ),
    ).toBeVisible();
    // The four figures, each with its label; the range is two prices.
    for (const label of ['میانه‌ی قیمت آگهی‌ها', 'محدوده‌ی قیمت', 'ارزش بازار', 'کارکرد معمول']) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByText(/تومان/).first()).toBeVisible();
    // The photograph is the body type's sample and says so.
    await expect(page.getByText(COPY.sample)).toBeVisible();
    await rtl.expectPersianDigits(page.locator('main dl').first());
    await rtl.expectNoHorizontalOverflow();
    await a11y.check();
  });

  test('offers every model year as a link, and a year changes the page to that year', async ({
    page,
    seed,
  }) => {
    await open(page, href(seed));
    const years = page.getByRole('navigation', { name: 'نمایش بر پایه‌ی سال ساخت' });
    await expect(years.getByRole('link')).toHaveCount(1 + seed.numbers.years.length);
    await expect(years.getByRole('link', { name: /همه‌ی سال‌ها/ })).toHaveAttribute('aria-current', 'page');
    await years.getByRole('link', { name: /^۱۴۰۰/ }).click();
    await expect(page).toHaveURL(new RegExp(`${seed.model.slug}\\?year=1400$`));
    await expect(page.getByRole('link', { name: /^دیدن ۱۲ آگهی مدل ۱۴۰۰$/ })).toBeVisible();
    await expect(years.getByRole('link', { name: /^۱۴۰۰/ })).toHaveAttribute('aria-current', 'page');
    // «همه‌ی سال‌ها» goes back.
    await years.getByRole('link', { name: /همه‌ی سال‌ها/ }).click();
    await expect(page).toHaveURL(new RegExp(`${seed.model.slug}$`));
  });

  test('draws the trend of the model year with the most listings, by the week, and says which year it is', async ({
    page,
    seed,
    rtl,
  }) => {
    await open(page, href(seed));
    const trend = page.getByRole('region', { name: new RegExp(`^${COPY.trend}`) });
    await expect(trend.getByRole('heading', { level: 2 })).toHaveText(`${COPY.trend}، مدل ۱۴۰۰`);
    // Not chosen by the buyer: the page says why it is this year.
    await expect(trend).toContainText('بیشترین آگهی را دارد');
    const chart = trend.getByRole('img', { name: /نمودار میانه‌ی قیمت آگهی‌های مدل ۱۴۰۰/ });
    await expect(chart).toBeVisible();
    // The latest median, in full digits, is the seed's.
    await expect(trend).toContainText(millions(seed.numbers.latestMedianToman));
    // 30 days back there is a run (a rise, which is bad news and printed with its sign); 90 days back there is not.
    const changes = trend.getByRole('definition').or(trend.locator('dd'));
    await expect(trend.getByText('نسبت به ۳۰ روز پیش')).toBeVisible();
    await expect(trend).toContainText(/\+.{1,2}٪?\s*گران‌تر شده|\+[۰-۹]+/);
    await expect(trend.getByText('گران‌تر شده')).toBeVisible();
    await expect(trend.getByText('نسبت به ۹۰ روز پیش')).toBeVisible();
    await expect(trend.getByText(COPY.notYet)).toBeVisible();
    await expect(changes.first()).toBeVisible();
    // The axis is in Persian digits and the dots are one a week.
    await rtl.expectPersianDigits(trend);
    await expect(trend.getByText('هر نقطه یک هفته است', { exact: false })).toBeVisible();
  });

  test('has the same numbers as a table, in the text alternative', async ({ page, seed }) => {
    await open(page, href(seed));
    const trend = page.getByRole('region', { name: new RegExp(`^${COPY.trend}`) });
    await trend.getByText(COPY.table).click();
    const table = trend.getByRole('table');
    await expect(table).toBeVisible();
    // Every day with enough listings is a row, not only the days the chart draws.
    await expect(table.getByRole('row')).toHaveCount(1 + seed.numbers.runs);
    await expect(table.getByRole('columnheader')).toContainText(['تاریخ', 'تعداد آگهی', 'میانه‌ی قیمت']);
    await expect(table.getByRole('row').nth(1)).toContainText(millions(seed.numbers.latestMedianToman));
    await expect(table.getByRole('row').nth(1)).toContainText('۱۲');
  });

  test('says a short history is short, and does not draw it', async ({ page, seed }) => {
    await open(page, href(seed, 1398));
    const trend = page.getByRole('region', { name: new RegExp(`^${COPY.trend}`) });
    await expect(trend.getByRole('heading', { level: 2 })).toHaveText(`${COPY.trend}، مدل ۱۳۹۸`);
    await expect(trend.getByText(COPY.short)).toBeVisible();
    await expect(trend.getByRole('img')).toHaveCount(0);
    // The two days it has are listed, open, so nothing is hidden.
    await expect(trend.getByRole('table').getByRole('row')).toHaveCount(3);
    // The year was chosen by the buyer: no note about a default.
    await expect(trend).not.toContainText('بیشترین آگهی را دارد');
  });

  test('says there is no trend for a year with too few listings', async ({ page, seed, a11y }) => {
    await open(page, href(seed, 1401));
    const trend = page.getByRole('region', { name: new RegExp(`^${COPY.trend}`) });
    await expect(trend.getByText(COPY.none)).toBeVisible();
    await expect(trend.getByRole('img')).toHaveCount(0);
    await a11y.check();
  });

  test('shows the best deals with the result card, cheapest against its value first, and leads to all of them', async ({
    page,
    seed,
  }) => {
    await open(page, href(seed));
    await settled(page);
    const deals = page.getByRole('region', { name: COPY.deals });
    const cards = deals.getByRole('article');
    await expect(cards).toHaveCount(6);
    await expect(cards.first().getByText(COPY.great, { exact: true })).toBeVisible();
    // A card does not repeat the link to the page it is on.
    await expect(deals.getByRole('link', { name: /^صفحه‌ی مدل/ })).toHaveCount(0);
    await deals.getByRole('link', { name: 'دیدن همه‌ی آگهی‌ها' }).click();
    await expect(page).toHaveURL(/\/search\?.*model=/);
    await expect(page.locator('[data-results-count]')).toContainText(
      String(seed.numbers.count).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)] ?? d),
    );
  });

  test('has an info control for every rule, with the text of the shared definitions', async ({
    page,
    seed,
  }) => {
    await open(page, href(seed));
    await settled(page);
    const checks: [string, RegExp][] = [
      [COPY.rangeInfo, /ارزان‌ترین.*گران‌ترین/s],
      [COPY.valueInfo, /ارزش بازار/],
      [COPY.ratingsInfo, /ارزش بازار همان خودرو/],
      [COPY.trendInfo, /ثبت‌های روزانه/],
      [COPY.dealsInfo, /زیر ارزش بازار/],
      [COPY.popularInfo, /مدلی که آگهی‌های زیادی/],
    ];
    for (const [name, text] of checks) {
      const button = page.getByRole('button', { name });
      await button.scrollIntoViewIfNeeded();
      await button.click();
      const popup = page.getByRole('dialog');
      await expect(popup).toContainText(text);
      await page.keyboard.press('Escape');
      await expect(popup).toHaveCount(0);
      await expect(button).toBeFocused();
    }
  });

  test('the rule texts state the numbers the queries use', async ({ page, seed }) => {
    await open(page, href(seed));
    await page.getByRole('button', { name: COPY.rangeInfo }).click();
    await expect(page.getByRole('dialog')).toContainText(/۱۰.?٪ ارزان‌ترین و ۱۰.?٪ گران‌ترین/);
    await expect(page.getByRole('dialog')).toContainText(/می‌ماند ۸۰.?٪ میانی/);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: COPY.trendInfo }).click();
    await expect(page.getByRole('dialog')).toContainText('۸ آگهی');
    await expect(page.getByRole('dialog')).toContainText('۳ نقطه');
  });

  test('holds the page still while the sections arrive', async ({ page, seed, browserName }) => {
    test.skip(browserName !== 'chromium', 'layout-shift entries exist only in Chromium');
    await page.addInitScript(() => {
      let total = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as (PerformanceEntry & {
          value: number;
          hadRecentInput: boolean;
        })[]) {
          if (!entry.hadRecentInput) total += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
      Object.defineProperty(window, 'layoutShiftTotal', { get: () => total });
    });
    await open(page, href(seed));
    await settled(page);
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    const shift = await page.evaluate(() => Number(Reflect.get(window, 'layoutShiftTotal')));
    expect(shift, 'layout shift while the model page loads').toBeLessThan(0.05);
  });

  test('fits the screen: no sideways scroll, the chart inside its frame, targets of 44 px', async ({
    page,
    seed,
    rtl,
  }) => {
    await open(page, href(seed));
    await settled(page);
    await rtl.expectNoHorizontalOverflow();
    const chart = page.getByRole('img', { name: /نمودار میانه‌ی قیمت/ });
    const box = await chart.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual((viewport?.width ?? 0) + 1);
    expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
    const small = await page.evaluate(() =>
      [...document.querySelectorAll('main a, main button, main summary')]
        .map((element) => ({ element, rect: element.getBoundingClientRect() }))
        .filter(({ rect }) => rect.width > 0 && rect.height > 0 && rect.height < 43.5)
        .map(({ element }) => `${element.tagName} ${element.textContent?.trim().slice(0, 30) ?? ''}`),
    );
    // Inline links inside a sentence are exempt; the controls of the page are not.
    expect(small.filter((line) => !/^A (صفحه‌ی مدل|دیوار)/.test(line))).toEqual([]);
    if (isPhone(page)) expect(viewport?.width).toBeLessThan(500);
  });
});

test.describe('the other states', () => {
  // The 404 answers are the point, so the browser's own note of them is not a problem.
  test.use({ ignoreBrowserErrors: [[/404/], { scope: 'test' }] });

  test('a model with no listing says so, and offers a way on', async ({ page, seed, a11y }) => {
    await open(page, `/models/${seed.make.slug}/${seed.emptyModel.slug}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(seed.emptyModel.name);
    await expect(page.getByRole('heading', { name: COPY.empty })).toBeVisible();
    await expect(page.getByRole('region', { name: new RegExp(`^${COPY.trend}`) })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'دیدن آگهی‌های دیگر' })).toBeVisible();
    await a11y.check();
  });

  test('a model year with no listing says so and goes back to all years', async ({ page, seed }) => {
    await open(page, href(seed, 1390));
    await expect(page.getByRole('heading', { name: 'آگهی‌ای از مدل ۱۳۹۰ نداریم' })).toBeVisible();
    await page.getByRole('link', { name: 'همه‌ی سال‌ها' }).first().click();
    await expect(page).toHaveURL(new RegExp(`${seed.model.slug}$`));
  });

  for (const [name, path] of [
    ['a model that is not in the catalogue', '/models/peugeot/no-such-model'],
    ['a make that is not in the catalogue', '/models/no-such-make/206'],
    ['a slug that cannot be a slug', '/models/PEUGEOT/206'],
    ['a path with a segment too many', '/models/peugeot/206/extra'],
    ['a make alone', '/models/peugeot'],
  ] as const) {
    test(`${name} answers a real 404 with a way back`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });
  }

  test('the 404 of an unknown model is the site\u2019s own Farsi page, right to left, with a way home', async ({
    page,
    rtl,
    a11y,
  }) => {
    await page.goto('/models/peugeot/no-such-model');
    await rtl.expectDocumentRtl();
    await expect(page.getByRole('heading', { level: 1, name: 'این صفحه پیدا نشد' })).toBeVisible();
    await a11y.check();
    await page.getByRole('link', { name: 'بازگشت به صفحه‌ی اصلی' }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe('the way to a model page', () => {
  test('the models index lists the models by make and opens a model page', async ({ page, a11y, rtl }) => {
    // The index is read from a cache that lives two minutes (the model queries' lifetime), so it holds the market as it
    // was a moment ago, not the seed of this test: what the model queries return for a seeded model is the database
    // test's business (model-queries.db.test.ts).
    await open(page, '/models');
    await settled(page);
    await rtl.expectDocumentRtl();
    await expect(page.getByRole('heading', { level: 1, name: 'مدل‌های خودرو' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'مدل‌های پرطرفدار' })).toBeVisible();
    const makes = page
      .getByRole('region', { name: /./ })
      .filter({ has: page.getByRole('heading', { level: 3 }) });
    await expect(makes.first()).toBeVisible();
    await rtl.expectNoHorizontalOverflow();
    await a11y.check();
    const first = makes.first().getByRole('link').first();
    const name = (await first.innerText()).split('\n')[0] ?? '';
    await first.click();
    await expect(page).toHaveURL(/\/models\/[a-z0-9-]+\/[a-z0-9-]+$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(name.trim().slice(0, 6));
  });

  test('the home page offers the popular models, with the search definition of popular', async ({ page }) => {
    await open(page, '/');
    const section = page.getByRole('region', { name: 'مدل‌های پرطرفدار' });
    await expect(section).toBeVisible();
    await expect(section.getByRole('link').first()).toBeVisible();
    await section.getByRole('button', { name: COPY.popularInfo }).click();
    await expect(page.getByRole('dialog')).toContainText(/یکی از ۱۵ مدلی که بیشترین آگهی فعال/);
    await page.keyboard.press('Escape');
    await section.getByRole('link', { name: 'همه‌ی مدل‌ها' }).click();
    await expect(page).toHaveURL(/\/models$/);
  });

  test('a search for one model leads to the model page, and a search for several does not', async ({
    page,
    seed,
  }) => {
    await page.goto(`/search?model=${seed.make.slug}.${seed.model.slug}`);
    await expect(page.locator('[data-results-count]')).toBeVisible();
    await waitForHydration(page);
    const notice = page.getByText('ارزش بازار، محدوده‌ی قیمت و روند قیمت.');
    await expect(notice).toBeVisible();
    await page.getByRole('link', { name: 'دیدن صفحه‌ی مدل' }).click();
    await expect(page).toHaveURL(new RegExp(`/models/${seed.make.slug}/${seed.model.slug}$`));
    await page.goBack();
    // A card holds one link, to its listing: a second one in every card would double the Tab stops of the page.
    await expect(page.getByRole('article').first().getByRole('link')).toHaveCount(1);
    // Two models are not one model: no line about a page.
    await page.goto(`/search?model=${seed.make.slug}.${seed.model.slug}&model=peugeot.206`);
    await expect(page.locator('[data-results-count]')).toBeVisible();
    await expect(page.getByRole('link', { name: 'دیدن صفحه‌ی مدل' })).toHaveCount(0);
  });

  test('the listing page links to its model page and to the rest of its listings', async ({ page }) => {
    await open(page, `/listings/${process.env.E2E_LISTING_ID ?? '1'}`);
    const links = page.getByRole('list', { name: 'مدل این خودرو' });
    await expect(links.getByRole('link', { name: /^صفحه‌ی .*: قیمت و روند$/ })).toHaveAttribute(
      'href',
      '/models/peugeot/206',
    );
    await expect(links.getByRole('link', { name: 'بقیه‌ی آگهی‌های این مدل' })).toHaveAttribute(
      'href',
      /\/search\?.*model=peugeot\.206/,
    );
  });

  test('the footer links to the models', async ({ page }) => {
    await open(page, '/status');
    await page.getByRole('contentinfo').getByRole('link', { name: 'مدل‌های خودرو' }).click();
    await expect(page).toHaveURL(/\/models$/);
    expect(COPY.models).toBe('مدل‌ها');
  });
});
