import type { Page } from '@playwright/test';
import { removeListingPages, seedListingPages, type ListingPageSeed } from '../../fixtures/listing-page';
import { fetchesSince, pasteDemand, pasteSeed, wantedCount, type PasteSeed } from '../../fixtures/paste-link';
import { expect, test as base } from '../../fixtures/test';
import { inspectLayout, waitForHydration } from '../../gorilla/layout';

// Pasting a listing's link (CS-65): the box on the home page, on the search page and on /check, and what comes back for
// each kind of link. Listings are seeded as Divar's (fixtures/listing-page.ts, fixtures/paste-link.ts): a rated one with
// a market value of 740 million tomans against an asking price of 640 million (a «معامله‌ی عالی»), one the daily run did
// not rate (rated on the spot), one seen on a list page only, one that left the market, and a token nobody has seen. No
// test opens Divar: every request the page makes is watched, and the crawler's log must not grow.

const COPY = {
  label: 'لینک آگهی را بچسبانید',
  submit: 'ارزیابی قیمت',
  h1: 'لینک آگهی را بچسبانید، ارزیابی را همین‌جا ببینید',
  steps: 'چطور؟',
  great: 'معامله‌ی عالی',
  analysis: 'تحلیل قیمت',
  full: 'دیدن همه‌ی جزئیات',
  openOn: 'رفتن به آگهی در دیوار',
  notALink: 'این لینک نیست',
  onlyDivar: 'فعلاً فقط آگهی‌های دیوار را ارزیابی می‌کنیم',
  divarOther: 'لینک یک آگهی نیست',
  notFound: 'این آگهی را هنوز ندیده‌ایم',
  unread: 'این آگهی را دیده‌ایم، اما هنوز کامل نخوانده‌ایم',
  off: 'این آگهی دیگر روی بازار نیست',
  bestDeals: 'بهترین معامله‌های امروز',
  paste: 'چسباندن لینک از حافظه‌ی دستگاه',
  clear: 'پاک کردن لینک',
} as const;

const test = base.extend<{ listings: ListingPageSeed; paste: PasteSeed }>({
  listings: async ({}, use) => {
    const seed = await seedListingPages();
    await use(seed);
    await removeListingPages(seed);
  },
  // Seeded once for the run (fixtures/global-setup.ts): the tests of both projects run side by side and share the model's demand.
  paste: async ({}, use) => {
    await use(pasteSeed());
  },
});

const linkOf = (key: string) => `https://divar.ir/v/${key}`;
const box = (page: Page) => page.getByRole('textbox', { name: COPY.label });

/** Every request to Divar itself (not its photo host, which the fixtures answer) fails the test. */
function watchDivar(page: Page): string[] {
  const requests: string[] = [];
  page.on('request', (request) => {
    const { hostname } = new URL(request.url());
    if (hostname === 'divar.ir' || hostname.endsWith('.divar.ir')) requests.push(request.url());
  });
  return requests;
}

async function pasteIntoBox(page: Page, text: string): Promise<void> {
  await box(page).focus();
  // A real paste event, with the text on the clipboard it carries: what a long press and «Paste» does.
  await box(page).evaluate((input, value) => {
    const data = new DataTransfer();
    data.setData('text', value);
    input.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
    );
  }, text);
}

async function openCheck(page: Page, path = '/check'): Promise<void> {
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await waitForHydration(page);
}

test.describe('the answer page', () => {
  test('before a link: the box, how to get a link, and nothing to dismiss', async ({ page, rtl, a11y }) => {
    await openCheck(page);
    await rtl.expectDocumentRtl();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(COPY.h1);
    await expect(box(page)).toBeVisible();
    await expect(box(page)).toHaveAttribute('dir', 'ltr');
    await expect(page.getByRole('heading', { name: COPY.steps })).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'لینکش را کپی کنید' })).toBeVisible();
    await rtl.expectNoHorizontalOverflow();
    await a11y.check();
  });

  test('a pasted link of a rated listing is answered on the page, in under five seconds, with the numbers from the database', async ({
    page,
    listings,
    rtl,
  }) => {
    const divar = watchDivar(page);
    const started = new Date();
    await openCheck(page);
    const begun = Date.now();
    await pasteIntoBox(page, linkOf(`e2e-lp-${listings.token}-rated`));
    await expect(page).toHaveURL(/\/check\?link=/);
    const answer = page.locator('[data-check-answer]');
    await expect(answer).toBeVisible();
    expect(Date.now() - begun, 'milliseconds from paste to answer').toBeLessThan(5000);
    await expect(answer.getByRole('heading', { level: 2 }).first()).toContainText('پژو ۲۰۶');
    const price = answer.locator('[data-price]');
    await expect(price).toHaveText(/۶۴۰٬۰۰۰٬۰۰۰\s+تومان/);
    await rtl.expectPersianDigits(price);
    await expect(answer.getByText(COPY.great, { exact: true }).first()).toBeVisible();
    await expect(answer.getByText(/ارزش بازار:\s*۷۴۰٬۰۰۰٬۰۰۰\s+تومان/)).toBeVisible();
    await expect(answer.getByRole('region', { name: COPY.analysis })).toBeVisible();
    // The box still holds the link, and the address is the whole state.
    await expect(box(page)).toHaveValue(linkOf(`e2e-lp-${listings.token}-rated`));
    await rtl.expectNoHorizontalOverflow();
    expect(divar, 'requests to Divar').toEqual([]);
    expect(await fetchesSince(started), 'rows the crawler logged').toBe(0);
  });

  test('«see all the details» opens the listing’s own page, and the click-out opens on the source in a new tab', async ({
    page,
    listings,
  }) => {
    await openCheck(page, `/check?link=${encodeURIComponent(linkOf(`e2e-lp-${listings.token}-rated`))}`);
    const answer = page.locator('[data-check-answer]');
    const out = answer.getByRole('link', { name: new RegExp(COPY.openOn) });
    await expect(out).toHaveAttribute('href', /^https:\/\//);
    await expect(out).toHaveAttribute('target', '_blank');
    await answer.getByRole('link', { name: COPY.full }).click();
    await expect(page).toHaveURL(new RegExp(`/listings/${String(listings.ids.rated)}$`));
    await expect(page.getByRole('heading', { level: 1 })).toContainText('پژو ۲۰۶');
  });

  test('a listing the daily run did not rate is rated on the spot, the same way, and counts as demand for its model', async ({
    page,
    paste,
  }) => {
    const before = await pasteDemand(paste.modelId);
    await openCheck(page, `/check?link=${encodeURIComponent(linkOf(paste.keys.fresh))}`);
    const answer = page.locator('[data-check-answer]');
    await expect(answer.locator('[data-price]')).toHaveText(/۶۴۰٬۰۰۰٬۰۰۰\s+تومان/);
    // A market value from the fitted model: the line under the price names it.
    await expect(answer.getByText(/ارزش بازار:/).first()).toBeVisible();
    await expect(answer.getByRole('region', { name: COPY.analysis })).toBeVisible();
    // The other project's run counts the same model at the same time: at least this paste, never fewer.
    expect(await pasteDemand(paste.modelId)).toBeGreaterThanOrEqual(before + 1);
  });

  test('a listing seen only on a list page says so, counts the request for its model and offers rated listings of it', async ({
    page,
    paste,
  }) => {
    const before = await pasteDemand(paste.modelId);
    await openCheck(page, `/check?link=${encodeURIComponent(linkOf(paste.keys.unread))}`);
    await expect(page.getByRole('heading', { name: COPY.unread })).toBeVisible();
    await expect(page.getByText('درخواست شما شمرده شد')).toBeVisible();
    await expect(page.locator('[data-price]')).toHaveCount(0);
    // The other project's run counts the same model at the same time: at least this paste, never fewer.
    expect(await pasteDemand(paste.modelId)).toBeGreaterThanOrEqual(before + 1);
    await expect(page.getByRole('link', { name: /دیدن همه‌ی آگهی‌های/ }).first()).toHaveAttribute(
      'href',
      /\/search\?.*model/,
    );
  });

  test('a link we have never seen is kept as a wanted link, honestly, and nothing is fetched', async ({
    page,
    paste,
    a11y,
  }) => {
    const divar = watchDivar(page);
    const started = new Date();
    // A token of its own, so the count is this test's alone (the other project runs the same test).
    const never = `e2e-pl-${paste.token}-n${String(Date.now() % 1_000_000)}`;
    await openCheck(page, `/check?link=${encodeURIComponent(linkOf(never))}`);
    await expect(page.getByRole('heading', { name: COPY.notFound })).toBeVisible();
    await expect(page.getByText('لینکش را ثبت کردیم')).toBeVisible();
    await expect(page.getByText(COPY.bestDeals)).toBeVisible();
    expect(await wantedCount(never)).toBe(1);
    await a11y.check();
    expect(divar).toEqual([]);
    expect(await fetchesSince(started)).toBe(0);
  });

  test('a listing that left the market says so and leads to its page', async ({ page, listings }) => {
    await openCheck(page, `/check?link=${encodeURIComponent(linkOf(`e2e-lp-${listings.token}-gone`))}`);
    await expect(page.getByRole('heading', { name: COPY.off })).toBeVisible();
    await page.getByRole('link', { name: /آخرین وضعیت/ }).click();
    await expect(page).toHaveURL(new RegExp(`/listings/${String(listings.ids.gone)}$`));
  });

  test('an address that carries no usable link says why, in place', async ({ page }) => {
    await openCheck(page, `/check?link=${encodeURIComponent('https://bama.ir/car/detail-abc-peugeot')}`);
    await expect(page.getByRole('heading', { name: new RegExp(COPY.onlyDivar) })).toBeVisible();
    await expect(page.getByRole('heading', { name: new RegExp('باما') })).toBeVisible();
    await page.goto(`/check?link=${encodeURIComponent('https://divar.ir/s/tehran/car')}`);
    await expect(page.getByRole('heading', { name: new RegExp(COPY.divarOther) })).toBeVisible();
  });

  test('keeps its layout, with no control under 44 px, in every state', async ({ page, listings }) => {
    for (const path of [
      '/check',
      `/check?link=${encodeURIComponent(linkOf(`e2e-lp-${listings.token}-rated`))}`,
      `/check?link=${encodeURIComponent(linkOf(`e2e-lp-${listings.token}-gone`))}`,
    ]) {
      await openCheck(page, path);
      const report = await inspectLayout(page, { minTarget: 44 });
      expect(report.overflowPx, path).toBeLessThanOrEqual(1);
      expect(report.clipped, path).toEqual([]);
      expect(report.smallTargets, path).toEqual([]);
      expect(report.brokenNumbers, path).toEqual([]);
    }
  });
});

test.describe('the box', () => {
  test('a pasted text that is no listing link is answered at once, with no round trip', async ({ page }) => {
    await openCheck(page);
    const requests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/check')) requests.push(request.url());
    });
    await pasteIntoBox(page, 'پژو ۲۰۶ تیپ ۵');
    await expect(page.getByText(COPY.notALink)).toBeVisible();
    await expect(box(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(box(page)).toBeFocused();
    await expect(page).toHaveURL(/\/check$/);
    expect(requests).toEqual([]);
    // Typing again takes the message away.
    await box(page).fill('divar');
    await expect(page.getByText(COPY.notALink)).toHaveCount(0);
  });

  test('another site is named and refused; only Divar is supported', async ({ page }) => {
    await openCheck(page);
    await pasteIntoBox(page, 'https://www.sheypoor.com/v/123456');
    await expect(page.getByText(COPY.onlyDivar)).toBeVisible();
    await expect(page.getByText(/شیپور/)).toBeVisible();
    await expect(page).toHaveURL(/\/check$/);
  });

  test('typing a link and pressing the button works too, and shows the wait', async ({ page, listings }) => {
    await openCheck(page);
    await box(page).fill(`نگاه کن ${linkOf(`e2e-lp-${listings.token}-rated`)} ممنون`);
    await page.getByRole('button', { name: COPY.submit }).click();
    await expect(page.locator('[data-check-answer]')).toBeVisible();
    await expect(page).toHaveURL(/\/check\?link=https%3A%2F%2Fdivar\.ir%2Fv%2F/);
    // The clear button empties the box and keeps the focus in it.
    await page.getByRole('button', { name: COPY.clear }).click();
    await expect(box(page)).toHaveValue('');
    await expect(box(page)).toBeFocused();
  });

  test('a link reads back the same from Back', async ({ page, listings }) => {
    await openCheck(page);
    await pasteIntoBox(page, linkOf(`e2e-lp-${listings.token}-rated`));
    await expect(page.locator('[data-check-answer]')).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/check$/);
    await expect(box(page)).toHaveValue('');
  });
});

test.describe('the entry points', () => {
  test('the home page’s hero takes a link and lands on its answer', async ({ page, listings }) => {
    await page.goto('/');
    await waitForHydration(page);
    await expect(box(page)).toBeVisible();
    await pasteIntoBox(page, linkOf(`e2e-lp-${listings.token}-rated`));
    await expect(page).toHaveURL(/\/check\?link=/);
    await expect(page.locator('[data-check-answer] [data-price]')).toHaveText(/۶۴۰٬۰۰۰٬۰۰۰\s+تومان/);
  });

  test('the home page says why to paste and explains which links work, in an info control', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForHydration(page);
    await expect(page.getByText('آگهی‌ای را پیدا کرده‌اید؟')).toBeVisible();
    const info = page.getByRole('button', { name: 'توضیح درباره‌ی لینک آگهی' });
    await info.click();
    await expect(page.getByText('فقط آگهی‌های دیوار را ارزیابی می‌کنیم')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText('فقط آگهی‌های دیوار را ارزیابی می‌کنیم')).toHaveCount(0);
    await expect(info).toBeFocused();
  });

  test('the search page takes a link above its own box', async ({ page, listings }) => {
    await page.goto('/search');
    await waitForHydration(page);
    await expect(box(page)).toBeVisible();
    await pasteIntoBox(page, linkOf(`e2e-lp-${listings.token}-rated`));
    await expect(page).toHaveURL(/\/check\?link=/);
    await expect(page.locator('[data-check-answer]')).toBeVisible();
  });

  test('keeps the home and search pages free of sideways scroll with the box in them', async ({
    page,
    rtl,
  }) => {
    for (const path of ['/', '/search']) {
      await page.goto(path);
      await waitForHydration(page);
      await expect(box(page)).toBeVisible();
      await rtl.expectNoHorizontalOverflow();
    }
  });
});
