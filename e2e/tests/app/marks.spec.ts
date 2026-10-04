import type { Locator, Page } from '@playwright/test';
import { COPY, newPassword, signIn, signOut, signUp, uniqueUsername } from '../../fixtures/accounts';
import { removeListingPages, seedListingPages, type ListingPageSeed } from '../../fixtures/listing-page';
import { changePrice, MARKS, notifyMarks, setStatus } from '../../fixtures/marks';
import { NOTIFICATIONS, openInbox, unreadText } from '../../fixtures/notifications';
import { removeSearchListings, seedSearchListings, type SearchSeed } from '../../fixtures/search-listings';
import { expect, test as base } from '../../fixtures/test';
import { inflateText, inspectLayout, waitForHydration } from '../../gorilla/layout';

// Marked listings (CS-69): a buyer marks a listing on a result card and on the listing page, sees it on their marked
// page with the price it had when marked beside the price now, and is told in the inbox when the price falls or the car
// sells or comes back; a visitor is asked to sign in and returns to the same listing with it marked. Listings are seeded
// (fixtures/listing-page.ts, search-listings.ts); a price falling or a car selling is written the way the crawl would
// write it, and the producer runs once (`pnpm marks:notify`), as the worker's marks.notify job does every two minutes.

type Fixtures = { seed: ListingPageSeed; search: SearchSeed };

const test = base.extend<Fixtures>({
  seed: async ({}, use) => {
    const seed = await seedListingPages();
    await use(seed);
    await removeListingPages(seed);
  },
  search: async ({}, use) => {
    const seed = await seedSearchListings();
    await use(seed);
    await removeSearchListings(seed);
  },
});

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024;
const markButtons = (page: Page) => page.getByRole('button', { name: MARKS.markNamed });
/** Every control for the listing that is showing: the one beside the title, and on a phone the one in the bar. */
const pressedStates = (buttons: Locator) =>
  buttons.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-pressed')));

async function openListing(page: Page, id: number): Promise<void> {
  await page.goto(`/listings/${String(id)}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await waitForHydration(page);
}

async function newBuyer(page: Page): Promise<{ username: string; password: string }> {
  const credentials = { username: uniqueUsername(), password: newPassword() };
  await signUp(page, credentials.username, credentials.password);
  return credentials;
}

/** The marked page's row for a listing, found by the heading of its title. */
const rowOf = (page: Page, title: RegExp | string) =>
  page.getByRole('listitem').filter({ has: page.getByRole('heading', { level: 2, name: title }) });

test.describe('a buyer marking a listing', () => {
  test('marks and unmarks on the listing page, and every control for it agrees', async ({
    page,
    seed,
    rtl,
  }) => {
    await newBuyer(page);
    await openListing(page, seed.ids.rated);
    const buttons = markButtons(page);
    // Beside the title, and on a phone also in the bar that stays in reach, next to the click-out.
    await expect(buttons).toHaveCount(isPhone(page) ? 2 : 1);
    expect(await pressedStates(buttons)).toEqual(
      Array.from({ length: isPhone(page) ? 2 : 1 }, () => 'false'),
    );

    await buttons.first().click();
    // Optimistic: pressed at once, in every control, then confirmed by the server and kept across a reload.
    expect(new Set(await pressedStates(buttons))).toEqual(new Set(['true']));
    await expect(page.getByRole('status').filter({ hasText: 'آگهی نشان شد.' })).toBeAttached();
    await page.reload();
    await waitForHydration(page);
    await expect.poll(async () => new Set(await pressedStates(buttons))).toEqual(new Set(['true']));
    await rtl.expectNoHorizontalOverflow();

    await buttons.last().click();
    expect(new Set(await pressedStates(buttons))).toEqual(new Set(['false']));
    await expect(page.getByRole('status').filter({ hasText: 'نشان آگهی برداشته شد.' })).toBeAttached();
    await page.reload();
    await waitForHydration(page);
    await expect.poll(async () => new Set(await pressedStates(buttons))).toEqual(new Set(['false']));
  });

  test('marks on a result card, and the card shows it on the next visit', async ({ page, search }) => {
    await newBuyer(page);
    await page.goto(`/search?q=${search.token}`);
    await waitForHydration(page);
    const first = page.getByRole('list', { name: 'نتایج جست‌وجو' }).getByRole('listitem').first();
    const button = first.getByRole('button', { name: MARKS.markNamed });
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    // The press is not a click on the card: it did not open the listing.
    await expect(page).toHaveURL(/\/search\?/);
    await page.reload();
    await waitForHydration(page);
    await expect(
      page
        .getByRole('list', { name: 'نتایج جست‌وجو' })
        .getByRole('listitem')
        .first()
        .getByRole('button', { name: MARKS.markNamed }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  test.describe('when the server cannot be reached', () => {
    // The test cuts the action's request on purpose; the browser reports that failure, which is the point.
    test.use({
      ignoreBrowserErrors: [
        [/requestfailed\] POST /, /Failed to fetch/, /Failed to load resource: net::ERR_FAILED/],
        { scope: 'test' },
      ],
    });

    test('the control goes back, an overlay says so in Farsi, and the retry marks it', async ({
      page,
      seed,
    }) => {
      await newBuyer(page);
      await openListing(page, seed.ids.rated);
      const buttons = markButtons(page);
      await page.route('**/listings/**', (route) =>
        route.request().method() === 'POST' ? route.abort('failed') : route.fallback(),
      );
      await buttons.first().click();
      await expect(page.getByText(MARKS.failure)).toBeVisible();
      expect(new Set(await pressedStates(buttons))).toEqual(new Set(['false']));

      await page.unroute('**/listings/**');
      await page.getByRole('button', { name: MARKS.retry }).click();
      await expect.poll(async () => new Set(await pressedStates(buttons))).toEqual(new Set(['true']));
      await expect(page.getByText(MARKS.failure)).toBeHidden();
    });
  });
});

test.describe('a visitor marking a listing', () => {
  test('is asked to sign in, and comes back to the same listing with it marked', async ({ page, seed }) => {
    const { username, password } = await newBuyer(page);
    await signOut(page);
    await openListing(page, seed.ids.rated);
    const buttons = markButtons(page);
    await buttons.first().click();
    const popup = page.getByRole('dialog');
    await expect(popup.getByText(MARKS.visitorHeading)).toBeVisible();
    await popup.getByRole('link', { name: MARKS.signIn, exact: true }).click();
    await expect(page).toHaveURL(
      `/sign-in?next=${encodeURIComponent(`/listings/${String(seed.ids.rated)}`)}`,
    );
    await signIn(page, username, password);
    await expect(page).toHaveURL(`/listings/${String(seed.ids.rated)}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect.poll(async () => new Set(await pressedStates(buttons))).toEqual(new Set(['true']));
    await expect(page.getByRole('status').filter({ hasText: MARKS.announcedBack })).toBeAttached();
    // And it is really kept: the marked page lists it.
    await page.goto('/account/marked');
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(1);
  });

  test('is sent to sign in by the marked page, and back to it afterwards', async ({ page }) => {
    await page.goto('/account/marked');
    await expect(page).toHaveURL('/sign-in?next=%2Faccount%2Fmarked');
  });

  test('can close the invitation with Escape and is not marked', async ({ page, seed }) => {
    await openListing(page, seed.ids.rated);
    const button = markButtons(page).first();
    await button.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(button).toBeFocused();
    await expect(button).toHaveAttribute('aria-pressed', 'false');
  });
});

test.describe('the marked page', () => {
  test('says what it is for when nothing is marked, and leads to search', async ({ page, rtl, a11y }) => {
    await newBuyer(page);
    await page.goto('/account/marked');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(MARKS.pageTitle);
    await expect(page.getByRole('heading', { name: MARKS.emptyHeading })).toBeVisible();
    await expect(page.getByRole('main').getByRole('link', { name: 'جست‌وجوی خودرو' })).toHaveAttribute(
      'href',
      '/search',
    );
    await rtl.expectNoHorizontalOverflow();
    await a11y.check();
  });

  test('is reached from the account menu and lists each marked listing with its price now', async ({
    page,
    seed,
    rtl,
    a11y,
  }) => {
    await newBuyer(page);
    for (const id of [seed.ids.rated, seed.ids.stale]) {
      await openListing(page, id);
      await markButtons(page).first().click();
      await expect(markButtons(page).first()).toHaveAttribute('aria-pressed', 'true');
      // Let the server confirm before the page is left, so the mark is not lost to the navigation.
      await expect(page.getByRole('status').filter({ hasText: 'آگهی نشان شد.' })).toBeAttached();
    }
    await page.getByRole('button', { name: COPY.menu }).click();
    await page.getByRole('menuitem', { name: MARKS.menuItem }).click();
    await expect(page).toHaveURL('/account/marked');
    await expect(page).toHaveTitle(`${MARKS.pageTitle} | کارشناس`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(MARKS.pageTitle);

    const rows = page.getByRole('listitem').filter({ has: page.getByRole('heading', { level: 2 }) });
    await expect(rows).toHaveCount(2);
    await expect(page.getByRole('status').filter({ hasText: /^[۰-۹]+\sآگهی$/ })).toHaveText(/^۲\sآگهی$/);
    const rated = rows.filter({ hasText: /۶۴۰٬۰۰۰٬۰۰۰/ });
    await expect(rated).toHaveCount(1);
    await expect(rated.getByRole('link')).toHaveAttribute('href', `/listings/${String(seed.ids.rated)}`);
    // Its rating from the valuation, a word and a colour; nothing changed yet, so no badge.
    await expect(rated.getByText('معامله‌ی عالی')).toBeVisible();
    await expect(rated.getByText(MARKS.priceDown)).toHaveCount(0);
    await rtl.expectDocumentRtl();
    await rtl.expectPersianDigits(rated.getByText(/تومان/).first());
    await rtl.expectNoHorizontalOverflow();
    await a11y.check();
  });

  test('a mark taken off is dimmed in place and comes back with the same control, and is gone after a reload', async ({
    page,
    seed,
  }) => {
    await newBuyer(page);
    for (const id of [seed.ids.rated, seed.ids.stale]) {
      await openListing(page, id);
      await markButtons(page).first().click();
      await expect(page.getByRole('status').filter({ hasText: 'آگهی نشان شد.' })).toBeAttached();
    }
    await page.goto('/account/marked');
    await waitForHydration(page);
    const rows = page.getByRole('listitem').filter({ has: page.getByRole('heading', { level: 2 }) });
    await expect(rows).toHaveCount(2);
    const first = rows.first();
    const button = first.getByRole('button', { name: MARKS.markNamed });
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    const before = await button.boundingBox();
    const heightBefore = (await first.boundingBox())?.height;
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect(first.getByText(MARKS.unmarkedNotice)).toBeVisible();
    // Nothing moves under the thumb: the control stays where it was, and the row keeps its height. The hint and the
    // control stay at full strength (they are not dimmed with the rest of the row).
    const after = await button.boundingBox();
    const heightAfter = (await first.boundingBox())?.height;
    expect(after?.y).toBeCloseTo(before?.y ?? -1, 0);
    expect(after?.x).toBeCloseTo(before?.x ?? -1, 0);
    expect(heightAfter).toBeCloseTo(heightBefore ?? -1, 0);
    expect(
      await first
        .getByText(MARKS.unmarkedNotice)
        .evaluate((node) => getComputedStyle(node.parentElement ?? node).opacity),
    ).toBe('1');
    expect(await button.evaluate((node) => getComputedStyle(node).opacity)).toBe('1');
    await expect(page.getByRole('status').filter({ hasText: /^[۰-۹]+\sآگهی$/ })).toHaveText(/^۱\sآگهی$/);
    // The slip of a thumb costs nothing: the same control puts it back.
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('status').filter({ hasText: /^[۰-۹]+\sآگهی$/ })).toHaveText(/^۲\sآگهی$/);
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('status').filter({ hasText: 'نشان آگهی برداشته شد.' })).toBeAttached();
    await page.reload();
    await expect(rows).toHaveCount(1);
  });
});

test.describe('what happens to a marked listing', () => {
  test('a price drop reaches the inbox once, and the marked page shows both prices and the change', async ({
    page,
    seed,
    rtl,
  }) => {
    await newBuyer(page);
    await openListing(page, seed.ids.rated);
    await markButtons(page).first().click();
    await expect(page.getByRole('status').filter({ hasText: 'آگهی نشان شد.' })).toBeAttached();

    await changePrice(seed.ids.rated, 600_000_000);
    notifyMarks();
    // A second pass tells nothing twice.
    notifyMarks();

    await openInbox(page);
    await expect(page.getByRole('status').filter({ hasText: /اعلان/ })).toHaveText(unreadText('۱'));
    const row = page.getByRole('region', { name: NOTIFICATIONS.today }).getByRole('listitem');
    await expect(row).toHaveCount(1);
    await expect(row.getByRole('link')).toHaveAccessibleName(/^خوانده‌نشده: قیمت .+ کم شد/);
    await expect(row.getByRole('link')).toHaveAttribute('href', `/listings/${String(seed.ids.rated)}`);
    await expect(row.getByText(/۶۰۰٬۰۰۰٬۰۰۰\s+تومان/)).toBeVisible();

    await page.goto('/account/marked');
    const listing = page.getByRole('listitem').filter({ has: page.getByRole('heading', { level: 2 }) });
    await expect(listing).toHaveCount(1);
    await expect(listing.getByText(/۶۰۰٬۰۰۰٬۰۰۰\s+تومان/).first()).toBeVisible();
    // The price on the day it was marked, struck through, and the change in words and as a badge.
    await expect(listing.getByRole('deletion')).toHaveText(/۶۴۰٬۰۰۰٬۰۰۰\s+تومان/);
    await expect(listing.getByText(MARKS.priceDown, { exact: true })).toBeVisible();
    await expect(listing.getByText(/ارزان‌تر از روزی که نشانش کردید/)).toBeVisible();
    await rtl.expectNoHorizontalOverflow();

    // The filters are links: one keeps what fell, another what left the market, and the counts say how many.
    await page.getByRole('link', { name: new RegExp(`^${MARKS.filters.dropped}`) }).click();
    await expect(page).toHaveURL('/account/marked?show=dropped');
    await expect(listing).toHaveCount(1);
    await page.getByRole('link', { name: new RegExp(`^${MARKS.filters.off}`) }).click();
    await expect(page.getByRole('heading', { name: 'آگهی‌ای با این فیلتر ندارید' })).toBeVisible();
  });

  test('a sale and a return each reach the inbox once, and the marked page says what became of it', async ({
    page,
    seed,
  }) => {
    await newBuyer(page);
    await openListing(page, seed.ids.stale);
    await markButtons(page).first().click();
    await expect(page.getByRole('status').filter({ hasText: 'آگهی نشان شد.' })).toBeAttached();

    await setStatus(seed.ids.stale, 'sold');
    notifyMarks();
    notifyMarks();
    await openInbox(page);
    const rows = page.getByRole('region', { name: NOTIFICATIONS.today }).getByRole('listitem');
    await expect(rows).toHaveCount(1);
    await expect(rows.first().getByRole('link')).toHaveAccessibleName(/فروخته شد/);

    await page.goto('/account/marked?show=off');
    const listing = page.getByRole('listitem').filter({ has: page.getByRole('heading', { level: 2 }) });
    await expect(listing).toHaveCount(1);
    await expect(listing.getByText(MARKS.sold, { exact: true })).toBeVisible();
    await expect(listing.getByText(/^از /)).toBeVisible();

    await setStatus(seed.ids.stale, 'active');
    notifyMarks();
    await openInbox(page);
    await expect(rows).toHaveCount(2);
    await expect(rows.first().getByRole('link')).toHaveAccessibleName(/به بازار برگشت/);
  });

  test('a buyer who muted price drops is told of a sale but not of the drop', async ({ page, seed }) => {
    await newBuyer(page);
    await openInbox(page);
    await page.getByRole('switch', { name: NOTIFICATIONS.priceDropSetting }).click();
    await expect(page.getByRole('switch', { name: NOTIFICATIONS.priceDropSetting })).not.toBeChecked();
    await openListing(page, seed.ids.stale);
    await markButtons(page).first().click();
    await expect(page.getByRole('status').filter({ hasText: 'آگهی نشان شد.' })).toBeAttached();
    await changePrice(seed.ids.stale, 500_000_000);
    notifyMarks();
    await setStatus(seed.ids.stale, 'expired');
    notifyMarks();
    await openInbox(page);
    const rows = page.getByRole('region', { name: NOTIFICATIONS.today }).getByRole('listitem');
    await expect(rows).toHaveCount(1);
    await expect(rows.first().getByRole('link')).toHaveAccessibleName(/منقضی شد/);
  });
});

test.describe('layout', () => {
  test('the marked page and the listing page with the control hold their layout, also with long Farsi', async ({
    page,
    seed,
    a11y,
  }) => {
    await newBuyer(page);
    for (const id of [seed.ids.rated, seed.ids.gone]) {
      await openListing(page, id);
      await markButtons(page).first().click();
      await expect(page.getByRole('status').filter({ hasText: 'آگهی نشان شد.' })).toBeAttached();
      // The control beside the title, and the one in the bar, are real touch targets and move nothing.
      const report = await inspectLayout(page, { minTarget: 44 });
      expect(report.overflowPx).toBeLessThanOrEqual(1);
      expect(report.smallTargets).toEqual([]);
    }
    await page.goto('/account/marked');
    await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
    const report = await inspectLayout(page, { minTarget: 44 });
    expect(report.overflowPx).toBeLessThanOrEqual(1);
    expect(report.clipped).toEqual([]);
    expect(report.smallTargets).toEqual([]);
    expect(report.misorderedSigns).toEqual([]);
    expect(report.brokenWords).toEqual([]);
    expect(report.brokenNumbers).toEqual([]);
    await a11y.check();
    await inflateText(page);
    const inflated = await inspectLayout(page, { minTarget: 44 });
    expect(inflated.overflowPx).toBeLessThanOrEqual(1);
    expect(inflated.clipped).toEqual([]);
  });
});
