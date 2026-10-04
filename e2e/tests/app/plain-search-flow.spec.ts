import type { Page } from '@playwright/test';
import { newPassword, signUp, uniqueUsername } from '../../fixtures/accounts';
import { fileRows, removeFilesOf } from '../../fixtures/search-files';
import { removeSearchListings, seedSearchListings, type SearchSeed } from '../../fixtures/search-listings';
import {
  addressOf,
  ask,
  chipNames,
  chipsRegion,
  expectResultsShown,
  primeSentenceSearch,
  resultsCount,
  searchBar,
  SMART_COPY,
  whenInteractive,
} from '../../fixtures/smart-search';
import { expect, test as base } from '../../fixtures/test';

// The smart search on the search page, the whole flow (CS-62, CS-93, CS-111): write a sentence in the one box, press Enter
// or the one button, and land on /search with the filters it meant already applied and shown, in one step: no «understood»
// panel to approve, no disclosure, no second button. The address becomes the canonical filter form with the sentence kept
// in it, so Back brings the previous search and its sentence back, a chip taken off updates the results at once, and the
// sentence stays editable. Thirty seeded listings with a word of their own give the counts exact answers
// (fixtures/search-listings.ts).

const SENTENCE = 'پژو ۲۰۶ تیپ ۲ بدون رنگ زیر ۷۰۰ میلیون';

const test = base.extend<{ seed: SearchSeed }>({
  seed: async ({}, use) => {
    const seed = await seedSearchListings();
    await use(seed);
    await removeSearchListings(seed);
  },
});

test.beforeAll(async ({ browser }, testInfo) => {
  await primeSentenceSearch(browser, testInfo.project.use.baseURL);
});

async function openSearch(page: Page, address = '/search'): Promise<void> {
  await page.goto(address);
  await expect(searchBar(page)).toBeVisible();
  await whenInteractive(page);
}

test.describe('one step', () => {
  test('Enter lands on the results with the filters applied and shown, and focus is never lost', async ({
    page,
  }) => {
    await openSearch(page);
    const before = await page.evaluate(() => history.length);
    await ask(searchBar(page), SENTENCE);
    await expect(page).toHaveURL(/model=peugeot\.206/);
    await expectResultsShown(page);
    const query = addressOf(page).searchParams;
    expect(query.get('trim')).toBe('peugeot.206.2');
    expect(query.get('price')).toBe('..700000000');
    expect(query.get('nopaint')).toBe('1');
    expect(await chipNames(page)).toHaveLength(4);
    // One step in the history, not two: no address of the sentence alone was passed through on the way.
    expect(await page.evaluate(() => history.length)).toBe(before + 1);
    // With a keyboard of its own the focus stays in the box, ready to edit the sentence; on a phone the on-screen
    // keyboard goes with the box and focus lands on the count of the results, which says what the search found.
    const touch = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
    if (touch) await expect(page.getByRole('heading', { level: 2, name: /آگهی/ }).first()).toBeFocused();
    else await expect(searchBar(page)).toBeFocused();
    await expect(searchBar(page)).toHaveValue(SENTENCE);
  });

  test('the one button does the same as Enter', async ({ page }) => {
    await openSearch(page);
    await searchBar(page).fill(SENTENCE);
    await page.getByRole('button', { name: SMART_COPY.submit, exact: true }).click();
    await expect(page).toHaveURL(/model=peugeot\.206/);
    expect(addressOf(page).searchParams.get('ask')).toBe(SENTENCE);
    await expect(
      chipsRegion(page).getByRole('button', { name: SMART_COPY.remove('بدون رنگ') }),
    ).toBeVisible();
  });

  test('there is no confirm step: no «understood» panel, no disclosure and no second button', async ({
    page,
  }) => {
    await openSearch(page);
    await expect(page.getByText(SMART_COPY.gone.disclosure)).toHaveCount(0);
    await searchBar(page).fill(SENTENCE);
    await expect(page.getByRole('button', { name: SMART_COPY.gone.understand })).toHaveCount(0);
    await expect(page.getByRole('button', { name: SMART_COPY.gone.apply })).toHaveCount(0);
    // The bar's form has one submit button: the clear button beside the text is not one.
    const kinds = await page
      .getByRole('search')
      .getByRole('button')
      .evaluateAll((buttons) => buttons.map((button) => button.getAttribute('type')));
    expect(kinds.filter((kind) => kind === 'submit')).toHaveLength(1);
    await searchBar(page).press('Enter');
    await expect(page).toHaveURL(/model=peugeot\.206/);
    await expect(page.getByRole('button', { name: SMART_COPY.gone.apply })).toHaveCount(0);
  });

  test('a sentence replaces the search: the filters of the old one are not carried over', async ({
    page,
  }) => {
    await openSearch(page, '/search?deal=good&gearbox=automatic');
    await ask(searchBar(page), 'پراید');
    await expect(page).toHaveURL(/make=pride/);
    const query = addressOf(page).searchParams;
    expect(query.has('deal')).toBe(false);
    expect(query.has('gearbox')).toBe(false);
    expect(await chipNames(page)).toEqual([SMART_COPY.remove('پراید')]);
  });
});

test.describe('after landing', () => {
  test('taking a chip off updates the results at once, and the sentence stays in the box and in the address', async ({
    page,
    seed,
  }) => {
    await openSearch(page);
    await ask(searchBar(page), `${seed.token} پژو ۲۰۶ بدون رنگ`);
    await expect(page).toHaveURL(/nopaint=1/);
    await expect(resultsCount(page, '۱۵')).toBeVisible();
    await chipsRegion(page)
      .getByRole('button', { name: SMART_COPY.remove('بدون رنگ') })
      .click();
    await expect(resultsCount(page, '۳۰')).toBeVisible();
    await expect(page).not.toHaveURL(/nopaint=1/);
    expect(addressOf(page).searchParams.get('ask')).toBe(`${seed.token} پژو ۲۰۶ بدون رنگ`);
    await expect(searchBar(page)).toHaveValue(`${seed.token} پژو ۲۰۶ بدون رنگ`);
    // The sentence is the buyer's: Enter reads it again and the chip is back.
    await searchBar(page).press('Enter');
    await expect(page).toHaveURL(/nopaint=1/);
    await expect(resultsCount(page, '۱۵')).toBeVisible();
  });

  test('the sentence stays editable: a change and Enter make a new search', async ({ page, seed }) => {
    await openSearch(page);
    await ask(searchBar(page), `${seed.token} پژو ۲۰۶`);
    await expect(resultsCount(page, '۳۰')).toBeVisible();
    await searchBar(page).press('End');
    await searchBar(page).pressSequentially(' بدون رنگ');
    await searchBar(page).press('Enter');
    await expect(page).toHaveURL(/nopaint=1/);
    await expect(resultsCount(page, '۱۵')).toBeVisible();
    expect(addressOf(page).searchParams.get('ask')).toBe(`${seed.token} پژو ۲۰۶ بدون رنگ`);
  });

  test('Back brings the previous search and its sentence back, and Forward the next', async ({ page }) => {
    await openSearch(page);
    await ask(searchBar(page), 'پراید');
    await expect(page).toHaveURL(/make=pride/);
    await ask(searchBar(page), 'سمند بدون تصادف');
    await expect(page).toHaveURL(/make=samand/);
    await page.goBack();
    await expect(page).toHaveURL(/make=pride/);
    await expect(searchBar(page)).toHaveValue('پراید');
    expect(await chipNames(page)).toEqual([SMART_COPY.remove('پراید')]);
    await page.goForward();
    await expect(page).toHaveURL(/make=samand/);
    await expect(searchBar(page)).toHaveValue('سمند بدون تصادف');
    await expect(
      chipsRegion(page).getByRole('button', { name: SMART_COPY.remove('بدون تصادف') }),
    ).toBeVisible();
  });

  test('clearing the box empties it and lets go of the sentence in the address; the chips stay', async ({
    page,
  }) => {
    await openSearch(page);
    await ask(searchBar(page), SENTENCE);
    await expect(page).toHaveURL(/model=peugeot\.206/);
    await page.getByRole('button', { name: SMART_COPY.clearBox }).click();
    await expect(searchBar(page)).toHaveValue('');
    await expect(searchBar(page)).toBeFocused();
    await expect(page).not.toHaveURL(/[?&]ask=/);
    await expect(page).toHaveURL(/model=peugeot\.206/);
    expect(await chipNames(page)).toHaveLength(4);
  });

  test('«پاک کردن فیلترها» clears every chip and the sentence with them', async ({ page }) => {
    await openSearch(page);
    await ask(searchBar(page), SENTENCE);
    await expect(page).toHaveURL(/model=peugeot\.206/);
    await chipsRegion(page).getByRole('button', { name: SMART_COPY.clearFilters }).click();
    await expect(page).toHaveURL(/\/search$/);
    await expect(searchBar(page)).toHaveValue('');
    await expect(chipsRegion(page)).toHaveCount(0);
  });

  test('a link pasted into the box still goes to its check, never to the sentence reading', async ({
    page,
  }) => {
    await openSearch(page);
    await searchBar(page).fill('https://divar.ir/v/AbCdEf12');
    await expect(page.getByRole('button', { name: SMART_COPY.checkLink })).toBeVisible();
    await searchBar(page).press('Enter');
    await expect(page).toHaveURL(/\/check\?link=/);
  });
});

test.describe('the search handed to Karshenas', () => {
  test('saving a search that began as a sentence keeps its applied filters', async ({ page, seed }) => {
    const username = uniqueUsername('smart');
    await signUp(page, username, newPassword());
    await openSearch(page);
    await ask(searchBar(page), `${seed.token} پژو ۲۰۶ بدون رنگ`);
    await expect(page).toHaveURL(/nopaint=1/);
    await expect(resultsCount(page, '۱۵')).toBeVisible();
    try {
      await page.locator('[data-save-search="button"]').click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('button', { name: 'ساختن پرونده' }).click();
      await expect(dialog.getByRole('heading', { name: 'پرونده ساخته شد' })).toBeVisible();
      const [file] = await fileRows(username);
      expect(file?.search).toMatchObject({
        v: 1,
        q: seed.token,
        filters: { model: ['peugeot.206'], paint_free: true },
      });
    } finally {
      await removeFilesOf(username);
    }
  });
});

test.describe('when the request fails', () => {
  // The failure is the point: the browser's own report of it is expected.
  test.use({
    ignoreBrowserErrors: [[/\[requestfailed\] POST/, /Failed to load resource/], { scope: 'test' }],
  });

  test('a request that never arrives keeps the sentence and says what to do', async ({ page }) => {
    await openSearch(page);
    await page.route(
      (url) => url.pathname === '/search',
      (route) => (route.request().method() === 'POST' ? route.abort() : route.continue()),
    );
    await searchBar(page).fill(SENTENCE);
    await searchBar(page).press('Enter');
    await expect(page.getByRole('alert').filter({ hasText: SMART_COPY.failed })).toBeVisible();
    await expect(searchBar(page)).toHaveValue(SENTENCE);
    await expect(page).not.toHaveURL(/model=/);
    // Typing again clears the message.
    await searchBar(page).press('End');
    await searchBar(page).pressSequentially(' ۱');
    await expect(page.getByRole('alert').filter({ hasText: SMART_COPY.failed })).toHaveCount(0);
  });
});

test.describe('before the script has loaded', () => {
  // The scripts never arrive: the page is the server's HTML with the results streamed in, and the form is the browser's.
  test.use({ ignoreBrowserErrors: [[/_next\/static/, /Failed to load resource/], { scope: 'test' }] });

  test('the box still works: the form is posted and the server sends the buyer to the results', async ({
    page,
  }) => {
    await page.route(/\/_next\/static\/.*\.js/, (route) => route.abort());
    await page.goto('/search');
    await expect(searchBar(page)).toBeVisible();
    await searchBar(page).fill(SENTENCE);
    await searchBar(page).press('Enter');
    await expect(page).toHaveURL(/model=peugeot\.206/);
    const query = addressOf(page).searchParams;
    expect(query.get('nopaint')).toBe('1');
    expect(query.get('ask')).toBe(SENTENCE);
    await expect(searchBar(page)).toHaveValue(SENTENCE);
    await expect(
      chipsRegion(page).getByRole('button', { name: SMART_COPY.remove('بدون رنگ') }),
    ).toBeVisible();
  });
});
