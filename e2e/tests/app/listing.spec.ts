import type { Page } from '@playwright/test';
import {
  pendingRechecks,
  removeListingPages,
  seedListingPages,
  type ListingPageSeed,
} from '../../fixtures/listing-page';
import { expect, test as base } from '../../fixtures/test';
import { inflateText, inspectLayout, waitForHydration } from '../../gorilla/layout';

// The listing page (CS-64): what a buyer sees and does on /listings/[id], on seeded listings of one model (fixtures/
// listing-page.ts): a rated one with everything, a stale one, one with a market value and no rating, an instalment
// sale and one that left the market. A market value of 740 million tomans and an asking price of 640 million give a
// gap of -13.51 %, a «معامله‌ی عالی». Photos and the click-out are never followed: the photo host is answered with a
// drawn stand-in (fixtures/source-photos.ts) and the click-out's address is read, never opened.

const COPY = {
  analysis: 'تحلیل قیمت',
  infoButton: 'توضیح درباره‌ی ارزیابی قیمت',
  why: 'چرا این ارزیابی؟',
  great: 'معامله‌ی عالی',
  unrated: 'بدون ارزیابی',
  comparables: 'آگهی‌های مشابهی که ارزش بازار از آن‌ها حساب شد',
  history: 'تاریخچه‌ی قیمت',
  condition: 'وضعیت خودرو',
  risks: 'نکته‌های احتیاط',
  facts: 'مشخصات',
  openOn: 'دیدن آگهی در دیوار',
  gallery: 'عکس‌های آگهی',
  next: 'عکس بعدی',
  previous: 'عکس قبلی',
  back: 'بازگشت به جست‌وجو',
  queued: 'بررسی مجدد در صف است',
  similar: 'آگهی‌های مشابهی که هنوز روی بازارند',
  notFound: 'این آگهی پیدا نشد',
  notFoundPage: 'صفحه پیدا نشد',
  offMarket: 'این آگهی دیگر روی دیوار نیست',
} as const;

const test = base.extend<{ seed: ListingPageSeed }>({
  seed: async ({}, use) => {
    const seed = await seedListingPages();
    await use(seed);
    await removeListingPages(seed);
  },
});

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024;

async function open(page: Page, id: number): Promise<void> {
  await page.goto(`/listings/${String(id)}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await waitForHydration(page);
}

/** The one primary action that is showing: the bar on a phone, the column beside the photos on a desktop. */
const clickOut = (page: Page) => page.getByRole('link', { name: new RegExp(COPY.openOn) });

test.describe('a rated listing', () => {
  test('shows its title, price, verdict and the market value with its date', async ({ page, seed, rtl }) => {
    await open(page, seed.ids.rated);
    await rtl.expectDocumentRtl();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('پژو ۲۰۶');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('مدل ۱۳۹۸');
    const price = page.locator('[data-price]');
    await expect(price).toHaveText(/۶۴۰٬۰۰۰٬۰۰۰\s+تومان/);
    await rtl.expectPersianDigits(price);
    // The badge beside the price, and the gap to the market value, rounded to whole percent.
    const badge = page.getByText(COPY.great, { exact: true }).first();
    await expect(badge).toBeVisible();
    await expect(page.getByText(/۱۴.{0,2}\s*زیر ارزش بازار/).first()).toBeVisible();
    await expect(page.getByText(/ارزش بازار:\s*۷۴۰٬۰۰۰٬۰۰۰\s+تومان/)).toBeVisible();
    await rtl.expectNoHorizontalOverflow();
  });

  test('draws the five bands as one bar with a marker, named for a screen reader', async ({ page, seed }) => {
    await open(page, seed.ids.rated);
    const analysis = page.getByRole('region', { name: COPY.analysis });
    await expect(analysis).toBeVisible();
    const gauge = analysis.getByRole('img');
    await expect(gauge).toHaveAccessibleName(/قیمت این آگهی.*ارزش بازار.*۷۴۰/);
    for (const rating of ['معامله‌ی عالی', 'معامله‌ی خوب', 'قیمت منصفانه', 'گران', 'خیلی گران']) {
      await expect(analysis.getByText(rating, { exact: true }).first()).toBeAttached();
    }
    // The cheap end is on the right in this right-to-left page, and the marker of a price 13.5 % below the market value
    // sits among the first bands (the right half).
    const bar = await gauge.boundingBox();
    const marker = await analysis.locator('[style*="inset-inline-start"]').last().boundingBox();
    expect(bar).not.toBeNull();
    expect(marker).not.toBeNull();
    if (bar === null || marker === null) return;
    const share = (bar.x + bar.width - (marker.x + marker.width / 2)) / bar.width;
    expect(share).toBeGreaterThan(0.1);
    expect(share).toBeLessThan(0.3);
  });

  test('explains the rating in sentences whose numbers are the stored ones', async ({ page, seed }) => {
    await open(page, seed.ids.rated);
    const analysis = page.getByRole('region', { name: COPY.analysis });
    await expect(analysis.getByRole('heading', { name: COPY.why })).toBeVisible();
    const text = (await analysis.innerText()).replace(/ /g, ' ');
    expect(text).toContain('قیمت این آگهی');
    expect(text).toMatch(/ارزش بازار این خودرو ۷۴۰٬۰۰۰٬۰۰۰ تومان است/);
    // The method is one tap away, in the page.
    await analysis.getByText('روش محاسبه').click();
    await expect(analysis.getByText(/هر روز، از آگهی‌های/)).toBeVisible();
  });

  test('explains itself: the info control opens a popover with the bands and Escape closes it', async ({
    page,
    seed,
  }) => {
    await open(page, seed.ids.rated);
    const button = page.getByRole('button', { name: COPY.infoButton });
    await button.click();
    const popup = page.getByRole('dialog');
    await expect(popup).toContainText('معامله‌ی عالی');
    await expect(popup).toContainText(/۱۰.?٪/);
    await page.keyboard.press('Escape');
    await expect(popup).toBeHidden();
    await expect(button).toBeFocused();
  });

  test('has one click-out to the source, in a new tab, and no other primary action showing', async ({
    page,
    seed,
  }) => {
    await open(page, seed.ids.rated);
    const links = clickOut(page);
    await expect(links).toHaveCount(1);
    await expect(links).toHaveAttribute(
      'href',
      new RegExp(`^https://test\\.example/post/e2e-lp-${seed.token}-rated$`),
    );
    await expect(links).toHaveAttribute('target', '_blank');
    await expect(links).toHaveAttribute('rel', /noopener/);
    await expect(links).toHaveAccessibleName(/در زبانه‌ی جدید باز می‌شود/);
    const box = await links.boundingBox();
    const viewport = page.viewportSize();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(48);
    if (isPhone(page) && box !== null && viewport !== null) {
      // On a phone the bar stays in reach: it is at the bottom of the screen without scrolling.
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      expect(box.y).toBeGreaterThan(viewport.height * 0.7);
    }
  });

  test('shows the photos from the source’s own address, with no referrer, and steps through them', async ({
    page,
    seed,
  }) => {
    await open(page, seed.ids.rated);
    const gallery = page.getByRole('group', { name: COPY.gallery });
    const first = gallery.locator('[aria-roledescription="slide"] img').first();
    await expect(first).toHaveAttribute(
      'src',
      new RegExp(`^https://s100\\.divarcdn\\.com/static/photo/e2e/${seed.token}-1\\.webp$`),
    );
    await expect(first).toHaveAttribute('referrerpolicy', 'no-referrer');
    await expect(gallery).toContainText(`عکس ۱ از ۵`);
    await gallery.getByRole('button', { name: COPY.next }).click();
    await expect(gallery.getByText('عکس ۲ از ۵')).toBeVisible();
    await expect(gallery.getByRole('button', { name: COPY.previous })).toBeEnabled();
    await gallery.getByRole('button', { name: 'رفتن به عکس ۴' }).click();
    await expect(gallery.getByText('عکس ۴ از ۵')).toBeVisible();
    // Every slide reserved its 4:3 box before its photo arrived.
    const boxes = await gallery
      .locator('[aria-roledescription="slide"]')
      .evaluateAll((slides) =>
        slides.map((slide) => slide.getBoundingClientRect().width / slide.getBoundingClientRect().height),
      );
    for (const ratio of boxes) expect(ratio).toBeCloseTo(4 / 3, 1);
  });

  test('lists the comparables, each leading to its own listing page', async ({ page, seed }) => {
    await open(page, seed.ids.rated);
    const section = page.getByRole('region', { name: COPY.comparables });
    const rows = section.getByRole('list', { name: 'آگهی‌های مشابه' }).getByRole('link');
    await expect(rows).toHaveCount(seed.ids.comparables.length);
    await expect(rows.first()).toHaveAttribute('href', `/listings/${String(seed.ids.comparables[0])}`);
    await expect(rows.first()).toContainText(/۷۰۰٬۰۰۰٬۰۰۰\s+تومان/);
    await expect(rows.first()).toContainText(/۷۳۵٬۰۰۰٬۰۰۰\s+تومان/);
    await expect(rows.nth(2)).toContainText('از بازار رفته');
    await rows.first().click();
    await expect(page).toHaveURL(new RegExp(`/listings/${String(seed.ids.comparables[0])}$`));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('tells the price history from the first price, with the old price struck through and the days on market', async ({
    page,
    seed,
  }) => {
    await open(page, seed.ids.rated);
    const history = page.getByRole('region', { name: COPY.history });
    const rows = history.getByRole('list', { name: 'تغییرهای قیمت' }).getByRole('listitem');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText('کاهش قیمت');
    await expect(rows.first()).toContainText(/۶۴۰٬۰۰۰٬۰۰۰\s+تومان/);
    await expect(rows.first().locator('s')).toContainText(/۷۰۰٬۰۰۰٬۰۰۰\s+تومان/);
    await expect(rows.first()).toContainText(/۹.?٪\s*کمتر/);
    await expect(rows.last()).toContainText('آگهی منتشر شد');
    await expect(history).toContainText(/۶۰٬۰۰۰٬۰۰۰\s+تومان\s+کمتر از قیمت اول/);
    // Days on market and the history's first row are the same day: 12 days.
    await expect(history.getByText('روز روی بازار').locator('..')).toContainText('۱۲');
  });

  test('shows the seller’s declared condition and what the text states with the phrase it was read from', async ({
    page,
    seed,
  }) => {
    await open(page, seed.ids.rated);
    const section = page.getByRole('region', { name: COPY.condition });
    await expect(section).toContainText('بدنه: خط و خش جزئی');
    await expect(section).toContainText('موتور سالم');
    await expect(section).toContainText('دوررنگ');
    await expect(section.locator('q', { hasText: 'دور رنگ' })).toBeVisible();
    await expect(section.locator('q', { hasText: 'شاسی ها سالم' })).toBeVisible();
    // The seller's field says almost no paint and the text says «دور رنگ»: the page says they disagree.
    const risks = page.getByRole('region', { name: COPY.risks });
    await expect(risks).toContainText('بدنه را بدون رنگ‌شدگی ثبت کرده');
  });

  test('lists the facts the listing states', async ({ page, seed }) => {
    await open(page, seed.ids.rated);
    const facts = page.getByRole('region', { name: COPY.facts });
    await expect(facts).toContainText('۱۳۹۸');
    await expect(facts).toContainText(/۹۰٬۰۰۰\s+کیلومتر/);
    await expect(facts).toContainText('دیوار');
  });

  test('says when it was last checked and records no re-check request when that is recent', async ({
    page,
    seed,
  }) => {
    await open(page, seed.ids.rated);
    await expect(page.getByText(/^آخرین بررسی:/)).toBeVisible();
    await expect(page.getByText(COPY.queued)).toHaveCount(0);
    expect(await pendingRechecks(seed.ids.rated)).toBe(0);
  });
});

test.describe('a stale listing', () => {
  test('records one re-check request when it is opened and says it is in the queue', async ({
    page,
    seed,
  }) => {
    await open(page, seed.ids.stale);
    await expect(page.getByText(/^آخرین بررسی:/)).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: COPY.queued })).toBeVisible();
    await expect.poll(() => pendingRechecks(seed.ids.stale)).toBe(1);
    // Opened again, or in a second tab, it asks once.
    await page.reload();
    await expect(page.getByRole('status').filter({ hasText: COPY.queued })).toBeVisible();
    await expect.poll(() => pendingRechecks(seed.ids.stale)).toBe(1);
  });
});

test.describe('a listing with a market value and no rating', () => {
  test('says why, shows the marker against the value and names no band', async ({ page, seed }) => {
    await open(page, seed.ids.unrated);
    const analysis = page.getByRole('region', { name: COPY.analysis });
    await expect(analysis).toContainText('قیمت این آگهی را ارزیابی نمی‌کنیم');
    await expect(analysis).toContainText('نمایشگاه‌ها قیمت خودروی صفر');
    await expect(page.getByText(COPY.unrated).first()).toBeVisible();
    await expect(analysis.getByText('معامله‌ی عالی', { exact: true })).toHaveCount(0);
    await expect(analysis.getByRole('img')).toHaveAccessibleName(/قیمت این آگهی.*ارزش بازار.*۷۷۰/);
    // No band is drawn: only the neutral bar with the marker.
    await expect(analysis.getByText('خیلی گران', { exact: true })).toHaveCount(0);
  });

  test('an instalment sale shows its down payment as such and no marker', async ({ page, seed }) => {
    await open(page, seed.ids.installment);
    await expect(page.getByText('پیش‌پرداخت', { exact: true }).first()).toBeVisible();
    await expect(page.locator('[data-price]')).toHaveText(/۲۰۰٬۰۰۰٬۰۰۰\s+تومان/);
    await expect(page.getByText(/مبلغ بالا فقط پیش‌پرداخت است/)).toBeVisible();
    await expect(page.getByRole('region', { name: COPY.risks })).toContainText('پیش‌پرداخت باشد');
    const analysis = page.getByRole('region', { name: COPY.analysis });
    await expect(analysis).toContainText('پیش‌پرداخت یک فروش قسطی است');
    await expect(analysis.locator('[style*="inset-inline-start"]')).toHaveCount(1);
  });
});

test.describe('a listing that left the market', () => {
  test('says so first, offers similar listings still on the market and asks for no re-check', async ({
    page,
    seed,
  }) => {
    await open(page, seed.ids.gone);
    await expect(page.getByRole('status').filter({ hasText: COPY.offMarket })).toBeVisible();
    const similar = page.getByRole('region', { name: COPY.similar });
    await expect(similar).toBeVisible();
    const links = similar.getByRole('list').getByRole('link');
    await expect(links.first()).toBeVisible();
    // They are other listings, never this one.
    const hrefs = await links.evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href')));
    expect(hrefs.every((href) => /^\/listings\/\d+$/.test(href ?? ''))).toBe(true);
    expect(hrefs.includes(`/listings/${String(seed.ids.gone)}`)).toBe(false);
    await expect(page.getByText(COPY.queued)).toHaveCount(0);
    expect(await pendingRechecks(seed.ids.gone)).toBe(0);
    // Its price is the last one we saw, said so.
    await expect(page.getByText('آخرین قیمت آگهی')).toBeVisible();
  });
});

test.describe('an address that is no listing', () => {
  // The 404 answers are the point, so the browser's own note of them is not a problem.
  test.use({ ignoreBrowserErrors: [[/404/], { scope: 'test' }] });

  test('a missing id answers a real 404 with a way back', async ({ page }) => {
    const response = await page.goto('/listings/2000000000');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: /پیدا نشد/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'بازگشت به صفحه‌ی اصلی' })).toBeVisible();
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/);
  });

  test('an id that is not a number answers 404 too', async ({ page }) => {
    for (const segment of ['abc', '0', '-5', '1e3', '%DB%B1%DB%B2']) {
      const response = await page.goto(`/listings/${segment}`);
      expect(response?.status(), segment).toBe(404);
    }
  });

  test('a malformed percent-escape answers a Farsi 404, not the framework’s English error', async ({
    page,
    request,
  }) => {
    const response = await request.get('/listings/%E0%A4%A');
    expect(response.status()).toBe(404);
    const body = await response.text();
    expect(body).toContain('lang="fa"');
    expect(body).not.toContain('Bad Request');
    await page.goto('/listings/%E0%A4%A');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(COPY.notFoundPage);
  });
});

test.describe('layout and accessibility', () => {
  test('keeps its layout, has no axe violation and no control under 44 px', async ({
    page,
    seed,
    a11y,
    rtl,
  }) => {
    await open(page, seed.ids.rated);
    await expect(page.getByRole('region', { name: COPY.history })).toBeVisible();
    await rtl.expectNoHorizontalOverflow();
    const report = await inspectLayout(page, { minTarget: 44 });
    expect(report.overflowPx).toBeLessThanOrEqual(1);
    expect(report.clipped).toEqual([]);
    expect(report.smallTargets).toEqual([]);
    expect(report.misorderedSigns).toEqual([]);
    expect(report.brokenWords).toEqual([]);
    expect(report.brokenNumbers).toEqual([]);
    await a11y.check();
  });

  test('keeps its layout when every string is long Farsi', async ({ page, seed }) => {
    await open(page, seed.ids.rated);
    await inflateText(page);
    const report = await inspectLayout(page, { minTarget: 44 });
    expect(report.overflowPx).toBeLessThanOrEqual(1);
    expect(report.clipped).toEqual([]);
  });

  test('a page without a photo keeps the frame', async ({ page, seed }) => {
    await open(page, seed.ids.installment);
    const frame = page.getByText('بدون عکس').first();
    await expect(frame).toBeVisible();
    const box = await page
      .locator('main')
      .getByText('بدون عکس')
      .first()
      .locator('xpath=ancestor::div[contains(@class,"aspect-4/3")][1]')
      .boundingBox();
    expect(box).not.toBeNull();
    if (box !== null) expect(box.width / box.height).toBeCloseTo(4 / 3, 1);
  });

  test('the back link returns to the search', async ({ page, seed }) => {
    await open(page, seed.ids.rated);
    await expect(page.getByRole('link', { name: COPY.back })).toHaveAttribute('href', '/search');
  });
});
