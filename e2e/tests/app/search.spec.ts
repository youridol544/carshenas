import type { Locator, Page } from '@playwright/test';
import {
  removeSearchListings,
  seedSearchListings,
  SEEDED_COUNT,
  type SearchSeed,
} from '../../fixtures/search-listings';
import { expect, test as base } from '../../fixtures/test';
import { inflateText, inspectLayout, waitForHydration } from '../../gorilla/layout';

// The search page (CS-61): what a buyer sees and does on /search, on seeded listings. Thirty listings of one catalogue
// model carry a word of their own, so `?q=<token>` shows only them, whatever else the index holds; their prices step by
// a million tomans and their deal gaps by two percent, so the order and every filter have known answers
// (fixtures/search-listings.ts). Each test seeds its own and removes them when it ends. Photos and the click-out are never
// followed: the photo host is answered with a drawn stand-in (fixtures/source-photos.ts) and the click-out's address is
// read, never opened.

const COPY = {
  title: 'جست‌وجوی خودرو',
  results: 'نتیجه‌های جست‌وجو',
  more: 'نمایش بیشتر',
  retry: 'تلاش دوباره',
  noPhoto: 'بدون عکس',
  unrated: 'بدون ارزیابی',
  negotiable: 'توافقی',
  installment: 'فروش قسطی',
  filters: /^فیلترها/,
  sheetTitle: 'فیلترها',
  closeSheet: 'بستن',
  clearFilters: 'پاک کردن فیلترها',
  sort: 'مرتب‌سازی',
  catalogues: 'مجموعه‌های آماده',
  all: 'همه‌ی آگهی‌ها',
  family: 'خانوادگی',
  expert: 'پیشنهاد کارشناس',
  noResults: 'آگهی‌ای با این فیلترها پیدا نشد',
  clearAll: 'پاک کردن همه‌ی فیلترها',
  searchBox: 'جست‌وجو در آگهی‌ها',
  searchSubmit: 'جست‌وجو',
  ignoredLead: 'بخشی از آدرس این جست‌وجو قابل‌استفاده نبود و نادیده گرفته شد:',
  dealFilter: 'ارزیابی قیمت',
  dealGoodOrBetter: 'معامله‌ی خوب یا بهتر',
  paintFree: 'بدون رنگ',
  skipToResults: 'پرش به نتایج',
  loadFailed: 'آگهی‌های بعدی بارگذاری نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.',
  added: 'دیگر اضافه شد.',
  lowKm: 'کم‌کارکرد نسبت به سن',
  viewPage: 'دیدن ارزیابی قیمت و جزئیات',
  exactRule: 'معیار دقیق',
  deals: {
    great: 'معامله‌ی عالی',
    good: 'معامله‌ی خوب',
    fair: 'قیمت منصفانه',
    high: 'گران',
    overpriced: 'خیلی گران',
  },
} as const;

const test = base.extend<{ seed: SearchSeed }>({
  seed: async ({}, use) => {
    const seed = await seedSearchListings();
    await use(seed);
    await removeSearchListings(seed);
  },
});

const list = (page: Page) => page.getByRole('list', { name: COPY.results });
// The cards are the list's own items (the save-search banner, `data-extra`, sits among them but is not a card); the
// condition chips inside them are items of lists of their own.
const cards = (page: Page) => list(page).locator(':scope > li:not([data-extra])');

/** Opens the seeded listings (and any further address parameters) and waits until React runs the page. */
async function openSeeded(page: Page, seed: SearchSeed, extra = ''): Promise<void> {
  await page.goto(`/search?q=${seed.token}${extra}`);
  await expect(list(page)).toBeVisible();
  await waitForHydration(page);
}

function isPhone(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) < 1024;
}

/** The buyer's filter controls: the rail on a desktop, the sheet on a phone (opened here). */
async function filterPanel(page: Page): Promise<Locator> {
  if (!isPhone(page)) return page.getByRole('complementary');
  await page.getByRole('button', { name: COPY.filters }).click();
  return page.getByRole('dialog', { name: COPY.sheetTitle });
}

test.describe('search page', () => {
  test('lists the seeded listings best deal first, as cards with their facts', async ({ page, seed }) => {
    await openSeeded(page, seed);
    await expect(cards(page)).toHaveCount(24);
    const first = cards(page).first();
    await expect(first.getByRole('heading', { level: 3 })).toContainText('پژو ۲۰۶');
    // the best deal: the lowest gap, with its badge, its gap in words and the price in full Persian digits
    await expect(first).toContainText(COPY.deals.great);
    await expect(first).toContainText('زیر ارزش بازار');
    await expect(first).toContainText('۶۱۱٬۰۰۰٬۰۰۰ تومان');
    await expect(first).toContainText('کیلومتر');
    await expect(first).toContainText('تهران');
    await expect(first).toContainText('دیوار');
    await expect(first).toContainText('روز روی بازار');
  });

  test('says how many listings match, in Persian digits', async ({ page, seed, rtl }) => {
    await openSeeded(page, seed);
    const count = page.getByRole('heading', {
      level: 2,
      name: new RegExp(`^${String.fromCharCode(0x6f3)}${String.fromCharCode(0x6f0)}`),
    });
    await expect(count).toBeVisible();
    await rtl.expectPersianDigits(count);
    await expect(count).toContainText('آگهی');
  });

  test('is a right-to-left page that fits the screen and passes the accessibility scan', async ({
    page,
    seed,
    rtl,
    a11y,
  }) => {
    await openSeeded(page, seed);
    await rtl.expectDocumentRtl();
    await rtl.expectNoHorizontalOverflow();
    await a11y.check();
  });

  test('keeps its layout at the narrowest phone, with long Farsi and at double text size', async ({
    page,
    seed,
  }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await openSeeded(page, seed);
    const plain = await inspectLayout(page, { minTarget: 44 });
    expect(plain.overflowPx).toBeLessThanOrEqual(1);
    expect(plain.clipped).toEqual([]);
    expect(plain.smallTargets).toEqual([]);
    expect(plain.brokenWords).toEqual([]);
    expect(plain.brokenNumbers).toEqual([]);
    await inflateText(page);
    const inflated = await inspectLayout(page, { minTarget: 44 });
    expect(inflated.overflowPx).toBeLessThanOrEqual(1);
    expect(inflated.clipped).toEqual([]);
  });

  test('a card leads to its own listing page in the same tab', async ({ page, seed }) => {
    await openSeeded(page, seed);
    const link = cards(page).first().getByRole('link');
    await expect(link).toHaveAttribute('href', /^\/listings\/\d+$/);
    await expect(link).not.toHaveAttribute('target', '_blank');
    await expect(link).toHaveAccessibleName(new RegExp(COPY.viewPage));
  });

  test('a listing without a price or a rating shows words for it and no deal badge', async ({
    page,
    seed,
  }) => {
    await openSeeded(page, seed);
    await page.getByRole('button', { name: COPY.more }).click();
    await expect(cards(page)).toHaveCount(SEEDED_COUNT);
    const unrated = cards(page).filter({ hasText: COPY.unrated });
    await expect(unrated.first()).toContainText('۶۳۱٬۰۰۰٬۰۰۰ تومان');
    const negotiable = cards(page).filter({ hasText: COPY.negotiable });
    await expect(negotiable).not.toHaveCount(0);
    await expect(negotiable.first()).not.toContainText(COPY.deals.great);
    await expect(negotiable.first()).not.toContainText('ارزش بازار');
    const installment = cards(page).filter({ hasText: COPY.installment });
    await expect(installment).toHaveCount(1);
  });

  test('photos load from the source in a reserved frame, and a missing photo shows the placeholder', async ({
    page,
    seed,
  }) => {
    await openSeeded(page, seed);
    const images = list(page).locator('img');
    await expect(images.first()).toHaveAttribute('referrerpolicy', 'no-referrer');
    // every photo frame has its 4:3 box, with a photo or without one
    const frames = await cards(page).evaluateAll((items) =>
      items.map((item) => {
        const frame = item.querySelector('article > div > div');
        const box = frame?.getBoundingClientRect();
        return box === undefined ? null : box.width / box.height;
      }),
    );
    for (const ratio of frames) expect(ratio).toBeCloseTo(4 / 3, 1);
    // the seeded listing 0 has no photo: its placeholder says so
    await expect(cards(page).filter({ hasText: COPY.noPhoto }).first()).toBeVisible();
  });

  test.describe('when the photo host answers with an error', () => {
    test.use({ ignoreBrowserErrors: [[/divarcdn\.com/], { scope: 'test' }] });

    test('a photo that does not load falls back to the same placeholder', async ({ page, seed }) => {
      await page.route(/divarcdn\.com/, (route) => route.fulfill({ status: 404, body: '' }));
      await openSeeded(page, seed);
      // the photos in view fail to load and give way to the placeholder; those below the fold have not been asked for
      for (const index of [0, 1, 2, 3]) await expect(cards(page).nth(index)).toContainText(COPY.noPhoto);
    });
  });

  test.describe('without a photo host that answers', () => {
    test.use({ failOnBrowserErrors: false });

    test('the frames keep their boxes while every photo is still on its way', async ({ page, seed }) => {
      await page.route(/divarcdn\.com/, () => undefined);
      await page.goto(`/search?q=${seed.token}`, { waitUntil: 'domcontentloaded' });
      await expect(list(page)).toBeVisible();
      const heights = await list(page)
        .locator('img')
        .evaluateAll((images) => images.map((image) => image.getBoundingClientRect().height));
      expect(heights.length).toBeGreaterThan(0);
      expect(heights.filter((height) => height === 0)).toEqual([]);
    });
  });

  test('the address holds the search: filters apply from it, chips show them and a bad value is named', async ({
    page,
    seed,
  }) => {
    await openSeeded(page, seed, '&deal=good&nopaint=1&year=abc&sort=zzz');
    await expect(page.getByText(COPY.ignoredLead)).toBeVisible();
    await expect(page.getByText(COPY.ignoredLead)).toContainText('سال ساخت');
    await expect(page.getByText(COPY.ignoredLead)).toContainText(COPY.sort);
    const chips = page.getByRole('region', { name: 'فیلترهای فعال' });
    await expect(chips.getByRole('button', { name: /معامله‌ی خوب یا بهتر/ })).toBeVisible();
    await expect(chips.getByRole('button', { name: /بدون رنگ/ })).toBeVisible();
    // only seeded listings that are good or better and paint-free remain: all have the paint-free chip
    const shown = await cards(page).count();
    expect(shown).toBeGreaterThan(0);
    expect(shown).toBeLessThan(SEEDED_COUNT);
    for (const card of await cards(page).all()) await expect(card).toContainText(COPY.paintFree);
  });

  test('the order follows the sort control and the address', async ({ page, seed }) => {
    await openSeeded(page, seed);
    await page.getByRole('combobox', { name: COPY.sort }).selectOption('price_asc');
    await expect(page).toHaveURL(/sort=price_asc/);
    await expect(cards(page).first()).toContainText('۶۱۱٬۰۰۰٬۰۰۰ تومان');
    await page.getByRole('combobox', { name: COPY.sort }).selectOption('price_desc');
    await expect(page).toHaveURL(/sort=price_desc/);
    await expect(cards(page).first()).toContainText('۶۴۰٬۰۰۰٬۰۰۰ تومان');
  });

  test('more listings load a page at a time, with focus on the first new card', async ({
    page,
    seed,
    rtl,
  }) => {
    await openSeeded(page, seed);
    await expect(cards(page)).toHaveCount(24);
    await expect(page.getByText('۲۴ از ۳۰ آگهی نمایش داده شد')).toBeVisible();
    await page.getByRole('button', { name: COPY.more }).click();
    await expect(cards(page)).toHaveCount(SEEDED_COUNT);
    await expect(page.getByText(`۶ آگهی ${COPY.added}`)).toBeAttached();
    await expect(page.getByRole('button', { name: COPY.more })).toHaveCount(0);
    await expect(page.getByText('۳۰ از ۳۰ آگهی نمایش داده شد')).toBeVisible();
    // focus went to the first of the six new cards
    const focusedCard = await page.evaluate(() => {
      const item = document.activeElement?.closest('ol > li');
      return item === null || item === undefined
        ? -1
        : [...(item.parentElement?.children ?? [])]
            .filter((child) => !child.hasAttribute('data-extra'))
            .indexOf(item);
    });
    expect(focusedCard).toBe(24);
    await rtl.expectNoHorizontalOverflow();
  });

  test('changing the order shows the new list from its top, and Back brings the first list back from its top', async ({
    page,
    seed,
  }) => {
    test.skip(
      !isPhone(page),
      'the order select scrolls out of view on a desktop; the phone has it in the sticky row',
    );
    await openSeeded(page, seed);
    await page.getByRole('button', { name: COPY.more }).click();
    await expect(cards(page)).toHaveCount(SEEDED_COUNT);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const deep = await page.evaluate(() => window.scrollY);
    expect(deep).toBeGreaterThan(1500);
    await page.getByRole('combobox', { name: COPY.sort }).selectOption('price_asc');
    await expect(page).toHaveURL(/sort=price_asc/);
    await expect(cards(page).first()).toContainText('۶۱۱٬۰۰۰٬۰۰۰ تومان');
    // the first card of the new order is on screen, not the middle of an old list
    await expect(cards(page).first()).toBeInViewport();
    await page.goBack();
    await expect(page).not.toHaveURL(/sort=/);
    await expect(cards(page).first()).toContainText(COPY.deals.great);
    await expect(cards(page).first()).toBeInViewport();
  });

  test('a skip link passes the filter rail to the results', async ({ page, seed }) => {
    await openSeeded(page, seed);
    const skip = page.getByRole('link', { name: COPY.skipToResults });
    for (let press = 0; press < 12; press += 1) {
      await page.keyboard.press('Tab');
      if (await skip.evaluate((link) => link === document.activeElement)) break;
    }
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 2, name: /آگهی/ }).first()).toBeFocused();
  });

  test('only the controls of the layout that is shown exist, never a rail and a sheet', async ({
    page,
    seed,
  }) => {
    await openSeeded(page, seed);
    await expect(page.getByRole('combobox', { name: COPY.sort })).toHaveCount(1);
    await expect(page.getByRole('complementary')).toHaveCount(isPhone(page) ? 0 : 1);
    await expect(page.getByRole('button', { name: COPY.filters })).toHaveCount(isPhone(page) ? 1 : 0);
  });

  test('on a desktop the first card starts high on the screen', async ({ page, seed }) => {
    test.skip(isPhone(page), 'a desktop layout');
    await openSeeded(page, seed);
    const top = await cards(page)
      .first()
      .evaluate((card) => card.getBoundingClientRect().top);
    expect(top).toBeLessThan(450);
    const second = await cards(page)
      .nth(1)
      .evaluate((card) => card.getBoundingClientRect().top);
    expect(Math.abs(second - top)).toBeLessThan(2);
  });

  test('a touch opens an info control and the text stays until it is closed', async ({ page, seed }) => {
    test.skip(!isPhone(page), 'touch emulation is the phone profile');
    await openSeeded(page, seed);
    const panel = await filterPanel(page);
    await panel.getByRole('button', { name: new RegExp(`^توضیح درباره‌ی «${COPY.dealFilter}»`) }).tap();
    const deal = page.getByRole('dialog', { name: COPY.dealFilter });
    await expect(deal).toContainText(COPY.deals.great);
    await page.keyboard.press('Escape');
    await expect(deal).toBeHidden();
  });

  test.describe('when the api answers badly', () => {
    test.use({ ignoreBrowserErrors: [[/api\/search/], { scope: 'test' }] });

    test('a failed page keeps what is shown, says why and tries again', async ({ page, seed }) => {
      await openSeeded(page, seed);
      await page.route('**/api/search?*', (route) =>
        route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
      );
      await page.getByRole('button', { name: COPY.more }).click();
      await expect(page.getByRole('alert').filter({ hasText: COPY.loadFailed })).toBeVisible();
      await expect(cards(page)).toHaveCount(24);
      await page.unroute('**/api/search?*');
      await page.getByRole('button', { name: COPY.retry }).click();
      await expect(cards(page)).toHaveCount(SEEDED_COUNT);
      await expect(page.getByRole('alert').filter({ hasText: COPY.loadFailed })).toHaveCount(0);
    });
  });

  test('a search that finds nothing names the filter whose removal brings listings back', async ({
    page,
    seed,
  }) => {
    await page.goto(`/search?q=${seed.token}&deal=great&price=..600000000&nopaint=1`);
    await expect(page.getByRole('heading', { level: 2, name: COPY.noResults })).toBeVisible();
    // the words and each filter are candidates; the price is the one that brings the seeded listings back
    const suggestion = page.getByRole('button', { name: /^برداشتن.*میلیون.*آگهی/ });
    await expect(suggestion).toBeVisible();
    await expect(page.getByRole('combobox', { name: COPY.sort })).toHaveCount(0);
    await expect(page.getByRole('button', { name: COPY.clearAll })).toBeVisible();
    await suggestion.click();
    await expect(page).not.toHaveURL(/price=/);
    await expect(cards(page).first()).toBeVisible();
  });

  test('the catalogues are one-tap collections, each with its count and what it applies', async ({
    page,
  }) => {
    await page.goto('/search');
    await waitForHydration(page);
    const strip = page.getByRole('toolbar', { name: COPY.catalogues });
    await expect(strip.getByRole('link', { name: new RegExp(`^${COPY.expert}`) })).toBeVisible();
    await expect(strip.getByRole('link', { name: COPY.all })).toHaveAttribute('aria-current', 'true');
    await strip.getByRole('link', { name: new RegExp(`^${COPY.family}`) }).click();
    await expect(page).toHaveURL(/catalogue=family/);
    await expect(strip.getByRole('link', { name: new RegExp(`^${COPY.family}`) })).toHaveAttribute(
      'aria-current',
      'true',
    );
    await expect(page.getByRole('region', { name: COPY.family })).toBeVisible();
    // the catalogue's filters show as chips, each removable
    const chips = page.getByRole('region', { name: 'فیلترهای فعال' });
    await expect(chips.getByRole('button').first()).toBeVisible();
    await strip.getByRole('link', { name: COPY.all }).click();
    await expect(page).toHaveURL(/\/search$/);
  });

  test('the strip is one Tab stop, and the arrow keys move along it, the left arrow to the next', async ({
    page,
  }) => {
    await page.goto('/search');
    await waitForHydration(page);
    const strip = page.getByRole('toolbar', { name: COPY.catalogues });
    const all = strip.getByRole('link', { name: COPY.all });
    await all.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(strip.getByRole('link', { name: new RegExp(`^${COPY.expert}`) })).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(strip.getByRole('button', { name: new RegExp(COPY.expert) })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(strip.getByRole('link', { name: new RegExp(`^${COPY.expert}`) })).toBeFocused();
    await page.keyboard.press('End');
    await expect(strip.getByRole('button').last()).toBeFocused();
    // Tab leaves the strip for the next control instead of visiting every chip
    await page.keyboard.press('Tab');
    await expect(strip.getByRole('button').last()).not.toBeFocused();
  });

  test('every catalogue explains what it applies in the definitions’ own words, and Escape closes it', async ({
    page,
  }) => {
    await page.goto('/search');
    await waitForHydration(page);
    const info = page.getByRole('button', { name: new RegExp(`^توضیح درباره‌ی «${COPY.family}»`) }).first();
    await info.click();
    const popup = page.getByRole('dialog', { name: COPY.family });
    await expect(popup).toBeVisible();
    await expect(popup).toContainText('ترتیب نمایش');
    await expect(popup).toContainText('شرط‌ها');
    await expect(popup).toContainText('حداکثر ۱۰ سال');
    await page.keyboard.press('Escape');
    await expect(popup).toBeHidden();
    await expect(info).toBeFocused();
  });

  test('every filter explains itself, the numbers coming from the definitions', async ({ page, seed }) => {
    await openSeeded(page, seed);
    const panel = await filterPanel(page);
    // a rule filter: the owner's example, in the definition's own words and numbers
    await panel.getByRole('group').first().waitFor({ state: 'attached' });
    const groups = panel.locator('details');
    const car = groups.first();
    await car.locator('summary').click();
    await car.getByRole('button', { name: new RegExp(`^توضیح درباره‌ی «${COPY.lowKm}»`) }).click();
    const popup = page.getByRole('dialog', { name: COPY.lowKm });
    await expect(popup).toContainText(COPY.exactRule);
    await expect(popup).toContainText('حداکثر ۱۲٬۰۰۰ کیلومتر برای هر سال عمر خودرو');
    await page.keyboard.press('Escape');
    await expect(popup).toBeHidden();
    // the deal filter explains each rating against market value
    await panel.getByRole('button', { name: new RegExp(`^توضیح درباره‌ی «${COPY.dealFilter}»`) }).click();
    const deal = page.getByRole('dialog', { name: COPY.dealFilter });
    await expect(deal).toContainText(COPY.deals.great);
    await expect(deal).toContainText('کمتر از ارزش بازار');
  });

  test('on a phone the filters are a batch: a draft with a live count, applied with one button', async ({
    page,
    seed,
  }) => {
    test.skip(!isPhone(page), 'the desktop applies each change at once, below');
    await openSeeded(page, seed);
    const sheet = await filterPanel(page);
    await expect(sheet).toBeVisible();
    const apply = sheet.getByRole('button', { name: /^نمایش\s۳۰\sآگهی/ });
    await expect(apply).toBeVisible();
    await sheet.getByRole('combobox', { name: COPY.dealFilter }).selectOption('good');
    // the count follows the draft before anything is applied
    await expect(sheet.getByRole('button', { name: /^نمایش\s.*\sآگهی/ })).not.toHaveAccessibleName(
      /^نمایش\s۳۰\sآگهی/,
    );
    await expect(page).not.toHaveURL(/deal=good/);
    await sheet.getByRole('button', { name: /^نمایش\s.*\sآگهی/ }).click();
    await expect(page).toHaveURL(/deal=good/);
    await expect(sheet).toBeHidden();
    await expect(page.getByRole('button', { name: /^فیلترها،\s۱\sفیلتر\sفعال/ })).toBeVisible();
    await expect(
      page
        .getByRole('region', { name: 'فیلترهای فعال' })
        .getByRole('button', { name: /معامله‌ی خوب یا بهتر/ }),
    ).toBeVisible();
    // closing the sheet throws a draft away
    const again = await filterPanel(page);
    await again.getByRole('combobox', { name: COPY.dealFilter }).selectOption('');
    await page.keyboard.press('Escape');
    await expect(again).toBeHidden();
    await expect(page).toHaveURL(/deal=good/);
    await expect(page.getByRole('button', { name: COPY.filters })).toBeFocused();
  });

  test('on a desktop the filters sit in a rail at the inline start and apply at once', async ({
    page,
    seed,
  }) => {
    test.skip(isPhone(page), 'a phone has the sheet, above');
    await openSeeded(page, seed);
    const rail = await filterPanel(page);
    const railBox = await rail.boundingBox();
    const listBox = await list(page).boundingBox();
    // in right-to-left the inline start is the right-hand side
    expect((railBox?.x ?? 0) > (listBox?.x ?? 0)).toBe(true);
    await rail.getByRole('combobox', { name: COPY.dealFilter }).selectOption('great');
    await expect(page).toHaveURL(/deal=great/);
    await expect(page.getByRole('region', { name: 'فیلترهای فعال' })).toBeVisible();
    const great = await cards(page).count();
    expect(great).toBeLessThan(SEEDED_COUNT);
    // Back returns to the search before the filter
    await page.goBack();
    await expect(page).not.toHaveURL(/deal=great/);
    await expect(cards(page)).toHaveCount(24);
  });

  test('a chip removes only its own filter', async ({ page, seed }) => {
    await openSeeded(page, seed, '&deal=good&nopaint=1');
    const chips = page.getByRole('region', { name: 'فیلترهای فعال' });
    await chips.getByRole('button', { name: /بدون رنگ/ }).click();
    await expect(page).not.toHaveURL(/nopaint/);
    await expect(page).toHaveURL(/deal=good/);
    await chips.getByRole('button', { name: COPY.clearFilters }).click();
    await expect(page).not.toHaveURL(/deal=/);
    await expect(chips).toHaveCount(0);
  });

  test('the search box reads a sentence: its words go in the address, the sentence stays in the box', async ({
    page,
    seed,
  }) => {
    await openSeeded(page, seed, '&nopaint=1');
    await page.getByRole('searchbox', { name: COPY.searchBox }).fill(`${seed.token} پژو ۲۰۶`);
    await page.getByRole('button', { name: COPY.searchSubmit, exact: true }).click();
    await expect(page).toHaveURL(/q=qzx/);
    await expect(page).toHaveURL(/model=peugeot\.206/);
    // A new sentence is a new search: the filter of the old one is not carried over, and the one box is the whole search.
    await expect(page).not.toHaveURL(/nopaint=1/);
    await expect(page).toHaveURL(new RegExp(`ask=${seed.token}`));
    await expect(page.getByRole('searchbox', { name: COPY.searchBox })).toHaveValue(`${seed.token} پژو ۲۰۶`);
    await expect(cards(page).first()).toBeVisible();
  });

  test('the header leads here and marks the page', async ({ page, seed }) => {
    await openSeeded(page, seed);
    await expect(
      page.getByRole('navigation', { name: 'پیمایش اصلی' }).getByRole('link', { name: 'جست‌وجو' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  test('nothing moves while the page loads, and the cards never jump when photos arrive', async ({
    page,
    seed,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'layout-shift entries exist only in Chromium');
    await page.addInitScript(() => {
      let total = 0;
      new PerformanceObserver((entries) => {
        for (const entry of entries.getEntries() as (PerformanceEntry & {
          value: number;
          hadRecentInput: boolean;
        })[]) {
          if (!entry.hadRecentInput) total += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
      Object.defineProperty(window, 'layoutShiftTotal', { get: () => total });
    });
    await openSeeded(page, seed);
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    expect(await page.evaluate(() => Number(Reflect.get(window, 'layoutShiftTotal')))).toBeLessThan(0.02);
  });

  test('a skeleton row is as tall as a real one', async ({ page, seed }) => {
    test.skip(!isPhone(page), 'measured at phone width, where a card is a narrow column');
    await page.setViewportSize({ width: 412, height: 915 });
    await openSeeded(page, seed);
    await page.route('**/api/search?*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    const loadMore = page.getByRole('button', { name: COPY.more });
    await loadMore.click();
    const rows = list(page).locator(':scope > li:not([data-extra])');
    await expect(rows.nth(24)).toBeAttached();
    const skeleton = (await rows.nth(24).boundingBox())?.height ?? 0;
    // the most common height among the real cards: a card with one line of chips, the usual one
    const heights = await rows.evaluateAll((items) =>
      items.slice(0, 24).map((item) => Math.round(item.getBoundingClientRect().height)),
    );
    const counts = new Map<number, number>();
    for (const height of heights) counts.set(height, (counts.get(height) ?? 0) + 1);
    const [usual] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [0];
    expect(Math.abs(skeleton - usual)).toBeLessThanOrEqual(1);
  });
});

test.describe('search page with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('nothing slides, scales or shimmers', async ({ page, seed }) => {
    await openSeeded(page, seed);
    const moving = await page.evaluate(() =>
      document
        .getAnimations()
        .filter(
          (animation) => animation.playState === 'running' && animation.effect instanceof KeyframeEffect,
        )
        .filter((animation) =>
          (animation.effect as KeyframeEffect)
            .getKeyframes()
            .some((frame) =>
              ['transform', 'translate', 'scale', 'rotate'].some((property) => property in frame),
            ),
        )
        .map((animation) => (animation instanceof CSSAnimation ? animation.animationName : animation.id)),
    );
    expect(moving).toEqual([]);
  });
});
