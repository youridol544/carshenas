import type { Locator, Page } from '@playwright/test';
import {
  COPY as ACCOUNT,
  fillCredentials,
  newPassword,
  signIn,
  signUp,
  signOut,
  superadminFor,
  uniqueUsername,
} from '../../fixtures/accounts';
import { fileRows, hasLooked, removeFilesOf, rewindLastLook } from '../../fixtures/search-files';
import { removeSearchListings, seedSearchListings, type SearchSeed } from '../../fixtures/search-listings';
import { expect, test as base } from '../../fixtures/test';
import { waitForHydration } from '../../gorilla/layout';

// Search files (CS-70, ADR-0031): «بسپارش به کارشناس» turns the search on the page into a file Karshenas keeps. A visitor
// is asked to sign up first and comes back to the same search with the dialog open; a buyer names the file and makes it,
// sees that a second press finds the first, and manages it: pause, resume, rename, close, delete. The file's page shows
// the matches ranked by deal and marks what is new since the buyer last looked; the account page and the superadmin's
// section list the files. Thirty seeded listings of one model carry a word of their own, so the search `?q=<token>` finds
// exactly them whatever else the index holds (fixtures/search-listings.ts); a test that makes files removes them.

const COPY = {
  save: 'بسپارش به کارشناس',
  dialogTitle: 'این جست‌وجو را به کارشناس بسپارید',
  signedOutTitle: 'برای سپردن جست‌وجو وارد شوید',
  signUp: 'ثبت‌نام',
  signIn: 'ورود',
  nameLabel: 'نام پرونده',
  submit: 'ساختن پرونده',
  created: 'پرونده ساخته شد',
  openFile: 'دیدن پرونده',
  existsTitle: 'این جست‌وجو را پیش‌تر سپرده‌اید',
  watching: 'در حال پایش',
  paused: 'متوقف',
  closed: 'بسته',
  pause: 'توقف پایش',
  resume: 'ادامه‌ی پایش',
  reopen: 'باز کردن دوباره',
  menu: 'کارهای پرونده',
  rename: 'تغییر نام',
  renameSubmit: 'ذخیره‌ی نام',
  closeFile: 'بستن پرونده',
  deleteFile: 'پاک کردن پرونده',
  deleteConfirm: 'پاک کردن',
  listTitle: 'پرونده‌های جست‌وجو',
  emptyList: 'هنوز پرونده‌ای ندارید',
  newBadge: 'تازه',
  results: 'نتیجه‌های جست‌وجو',
  adminTitle: 'پرونده‌های جست‌وجو',
} as const;

const test = base.extend<{ seed: SearchSeed }>({
  seed: async ({}, use) => {
    const seed = await seedSearchListings();
    await use(seed);
    await removeSearchListings(seed);
  },
});

/** The seeded listings' search: their own word and the make, so the page has a word and a chip to hand over. */
function searchAddress(seed: SearchSeed): string {
  return `/search?q=${seed.token}&make=peugeot`;
}

async function openSearch(page: Page, seed: SearchSeed): Promise<void> {
  await page.goto(searchAddress(seed));
  await expect(page.getByRole('list', { name: COPY.results })).toBeVisible();
  await waitForHydration(page);
}

function saveButton(page: Page): Locator {
  return page.locator('[data-save-search="button"]');
}

function dialog(page: Page): Locator {
  return page.getByRole('dialog');
}

/** Makes a file of the search on the page, with the name the dialog offers or one given; returns the file's name. */
async function makeFile(page: Page, name?: string): Promise<string> {
  await saveButton(page).click();
  const box = dialog(page);
  await expect(box.getByRole('heading', { name: COPY.dialogTitle })).toBeVisible();
  const field = box.getByRole('textbox', { name: COPY.nameLabel });
  await expect(field).toBeVisible();
  if (name !== undefined) await field.fill(name);
  const chosen = await field.inputValue();
  await box.getByRole('button', { name: COPY.submit }).click();
  await expect(box.getByRole('heading', { name: COPY.created })).toBeVisible();
  return chosen;
}

test.describe('search files', () => {
  test('a visitor signs up first and comes back to the same search to hand it over', async ({
    page,
    seed,
    rtl,
    a11y,
  }) => {
    await openSearch(page, seed);
    await saveButton(page).click();
    const box = dialog(page);
    await expect(box.getByRole('heading', { name: COPY.signedOutTitle })).toBeVisible();
    // The dialog says what is being handed over: the words and the chips of this search.
    await expect(box.getByRole('list', { name: /./ }).or(box.getByRole('listitem').first())).toBeVisible();
    await a11y.check();
    await rtl.expectNoHorizontalOverflow();

    await box.getByRole('link', { name: COPY.signUp, exact: true }).click();
    await expect(page).toHaveURL(/\/sign-up\?next=/);
    const username = uniqueUsername('files');
    try {
      await fillCredentials(page, username, newPassword());
      await page.getByRole('button', { name: ACCOUNT.signUp, exact: true }).click();

      // Back on the same search, with the dialog open again, and the address forgot why.
      await expect(page).toHaveURL(new RegExp(`/search\\?.*q=${seed.token}`));
      await expect(page).not.toHaveURL(/save=1/);
      const back = dialog(page);
      await expect(back.getByRole('heading', { name: COPY.dialogTitle })).toBeVisible();
      await expect(back.getByRole('textbox', { name: COPY.nameLabel })).toHaveValue(/.+/);

      await back.getByRole('button', { name: COPY.submit }).click();
      await expect(back.getByRole('heading', { name: COPY.created })).toBeVisible();
      await back.getByRole('link', { name: COPY.openFile }).click();
      await expect(page).toHaveURL(/\/account\/searches\/\d+$/);
      await expect(page.getByText(COPY.watching, { exact: true }).first()).toBeVisible();
      expect(await fileRows(username)).toHaveLength(1);
    } finally {
      await removeFilesOf(username);
    }
  });

  test('a buyer makes a file, finds it again on a second press and sees it on the page, ranked by deal', async ({
    page,
    seed,
    rtl,
    a11y,
  }) => {
    const username = uniqueUsername('files');
    await signUp(page, username, newPassword());
    try {
      await openSearch(page, seed);
      const name = await makeFile(page, 'پژو ۲۰۶ تمیز');
      expect(name).toBe('پژو ۲۰۶ تمیز');
      await a11y.check();
      await dialog(page).getByRole('button', { name: 'ادامه‌ی جست‌وجو' }).click();
      await expect(dialog(page)).toBeHidden();

      // The same search again is the same file, never a second one.
      await saveButton(page).click();
      await expect(dialog(page).getByRole('heading', { name: COPY.existsTitle })).toBeVisible();
      await expect(dialog(page)).toContainText(name);
      await dialog(page).getByRole('link', { name: COPY.openFile }).click();

      await expect(page).toHaveURL(/\/account\/searches\/\d+$/);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
      const matches = page.locator('ol > li').filter({ has: page.getByRole('heading', { level: 3 }) });
      await expect(matches).toHaveCount(24);
      // The best deal first, as on the search page: the seeded model's lowest price carries the best rating.
      await expect(matches.first()).toContainText('معامله‌ی عالی');
      await expect(matches.first()).toContainText('۶۱۱٬۰۰۰٬۰۰۰ تومان');
      await rtl.expectDocumentRtl();
      await rtl.expectNoHorizontalOverflow();
      await a11y.check();
      expect(await fileRows(username)).toHaveLength(1);
    } finally {
      await removeFilesOf(username);
    }
  });

  test('a file is paused, resumed, renamed, closed, reopened and deleted from its page', async ({
    page,
    seed,
  }) => {
    const username = uniqueUsername('files');
    await signUp(page, username, newPassword());
    try {
      await openSearch(page, seed);
      await makeFile(page, 'پژو برای مدیریت');
      await dialog(page).getByRole('link', { name: COPY.openFile }).click();
      await expect(page).toHaveURL(/\/account\/searches\/\d+$/);
      await waitForHydration(page);
      const state = page.locator('[data-file-state]');
      await expect(state).toHaveText(COPY.watching);

      await page.getByRole('button', { name: COPY.pause }).click();
      await expect(state).toHaveText(COPY.paused);
      await expect.poll(async () => (await fileRows(username))[0]?.status).toBe('paused');
      // It stays paused: a fresh load agrees, and says what pausing means.
      await page.reload();
      await expect(state).toHaveText(COPY.paused);
      await expect(page.getByRole('note')).toContainText(COPY.paused);

      await page.getByRole('button', { name: COPY.resume }).click();
      await expect(state).toHaveText(COPY.watching);
      await expect.poll(async () => (await fileRows(username))[0]?.status).toBe('watching');

      await page.getByRole('button', { name: COPY.menu }).click();
      await page.getByRole('menuitem', { name: COPY.rename }).click();
      const box = dialog(page);
      await box.getByRole('textbox', { name: COPY.nameLabel }).fill('نام تازه‌ی پرونده');
      await box.getByRole('button', { name: COPY.renameSubmit }).click();
      await expect(box).toBeHidden();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('نام تازه‌ی پرونده');
      expect((await fileRows(username))[0]?.name).toBe('نام تازه‌ی پرونده');

      await page.getByRole('button', { name: COPY.menu }).click();
      await page.getByRole('menuitem', { name: COPY.closeFile }).click();
      await expect(state).toHaveText(COPY.closed);
      await page.getByRole('button', { name: COPY.reopen }).click();
      await expect(state).toHaveText(COPY.watching);

      await page.getByRole('button', { name: COPY.menu }).click();
      await page.getByRole('menuitem', { name: COPY.deleteFile }).click();
      await dialog(page).getByRole('button', { name: COPY.deleteConfirm }).click();
      await expect(page).toHaveURL(/\/account\/searches$/);
      await expect(page.getByRole('heading', { name: COPY.emptyList })).toBeVisible();
      expect(await fileRows(username)).toHaveLength(0);
    } finally {
      await removeFilesOf(username);
    }
  });

  test('what came since the buyer last looked is marked, and a look clears it', async ({ page, seed }) => {
    const username = uniqueUsername('files');
    await signUp(page, username, newPassword());
    try {
      await openSearch(page, seed);
      await makeFile(page, 'پژو تازه‌ها');
      await dialog(page).getByRole('link', { name: COPY.openFile }).click();
      await expect(page).toHaveURL(/\/account\/searches\/(\d+)$/);
      // Made a moment ago: what the search showed then is not new.
      await expect(page.locator('[data-new-summary]')).toHaveAttribute('data-new-summary', '0');
      await expect(page.locator('[data-listing-mark]')).toHaveCount(0);
      // The page records the look a moment after it is on screen; wait for it, so it cannot land after the next step.
      await expect.poll(async () => hasLooked(username), { timeout: 10_000 }).toBe(true);

      // Three days away: the seeded listings, first seen since, are new. The list says so, with how many.
      await rewindLastLook(username, 3);
      await page.goto('/account/searches');
      const card = page.locator('[data-search-file]');
      await expect(card).toContainText('۳۰ آگهی تازه');
      await card.getByRole('link').click();
      await expect(page).toHaveURL(/\/account\/searches\/\d+$/);
      await expect(page.locator('[data-new-summary]')).toHaveAttribute('data-new-summary', '30');
      await expect(page.locator('[data-listing-mark]')).toHaveCount(24);
      await expect(page.locator('[data-listing-mark]').first()).toHaveText(COPY.newBadge);

      // The page keeps showing what was new when it opened; the look it recorded clears it for the next visit.
      await expect.poll(async () => hasLooked(username), { timeout: 10_000 }).toBe(true);
      await expect(page.locator('[data-new-summary]')).toHaveAttribute('data-new-summary', '30');
      await page.reload();
      await expect(page.locator('[data-new-summary]')).toHaveAttribute('data-new-summary', '0');
      await expect(page.locator('[data-listing-mark]')).toHaveCount(0);
    } finally {
      await removeFilesOf(username);
    }
  });

  test('the account page and its menu lead to the buyer’s files, an empty list says what to do', async ({
    page,
    seed,
    rtl,
    a11y,
  }) => {
    const username = uniqueUsername('files');
    await signUp(page, username, newPassword());
    try {
      await page.goto('/account/searches');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(COPY.listTitle);
      await expect(page.getByRole('heading', { name: COPY.emptyList })).toBeVisible();
      await a11y.check();

      await openSearch(page, seed);
      const name = await makeFile(page, 'پژو برای فهرست');
      await dialog(page).getByRole('button', { name: 'ادامه‌ی جست‌وجو' }).click();

      await page.goto('/account');
      const card = page.getByRole('region', { name: COPY.listTitle });
      await expect(card).toContainText(name);
      await expect(card).toContainText('۱ پرونده');
      await page.getByRole('button', { name: ACCOUNT.menu }).click();
      await page.getByRole('menuitem', { name: COPY.listTitle }).click();
      await expect(page).toHaveURL(/\/account\/searches$/);
      const cardOfFile = page.locator('[data-search-file]');
      await expect(cardOfFile).toHaveCount(1);
      await expect(cardOfFile).toContainText(name);
      await expect(cardOfFile).toContainText(COPY.watching);
      // The matches are counted from the search table, in Persian digits.
      await expect(cardOfFile).toContainText('۳۰ آگهی');
      await rtl.expectPersianDigits(cardOfFile.getByText(/آگهی/).first());
      await rtl.expectNoHorizontalOverflow();
      await a11y.check();
      await cardOfFile.getByRole('link').click();
      await expect(page).toHaveURL(/\/account\/searches\/\d+$/);
    } finally {
      await removeFilesOf(username);
    }
  });

  test('a visitor never sees a file, and an address that is not the buyer’s is not found', async ({
    page,
    seed,
    browser,
  }) => {
    const owner = uniqueUsername('files');
    await signUp(page, owner, newPassword());
    try {
      await openSearch(page, seed);
      await makeFile(page, 'پژو خصوصی');
      await dialog(page).getByRole('link', { name: COPY.openFile }).click();
      await expect(page).toHaveURL(/\/account\/searches\/\d+$/);
      const address = page.url();

      // Another buyer, at the owner's address: not found, and nothing of the file.
      const other = await browser.newContext({ locale: 'fa-IR', timezoneId: 'Asia/Tehran' });
      try {
        const otherPage = await other.newPage();
        await signUp(otherPage, uniqueUsername('files'), newPassword());
        await otherPage.goto(address);
        await expect(otherPage.getByText('پژو خصوصی')).toHaveCount(0);
        await expect(otherPage.getByRole('heading', { name: /پیدا نشد|۴۰۴/ }).first()).toBeVisible();
      } finally {
        await other.close();
      }

      // A visitor is sent to sign in, and comes back to the file afterwards.
      await signOut(page);
      const visitor = await page.request.get(address, { maxRedirects: 0 });
      expect(visitor.status()).toBe(307);
      expect(visitor.headers().location).toContain('/sign-in');
    } finally {
      await removeFilesOf(owner);
    }
  });

  test('the superadmin lists every buyer’s files with the search and its match count', async ({
    page,
    seed,
    browser,
  }, testInfo) => {
    const buyer = uniqueUsername('files');
    await signUp(page, buyer, newPassword());
    try {
      await openSearch(page, seed);
      await makeFile(page, 'پژو برای مدیر');

      const admin = await browser.newContext({
        locale: 'fa-IR',
        timezoneId: 'Asia/Tehran',
        viewport: page.viewportSize(),
        baseURL: testInfo.project.use.baseURL,
      });
      try {
        const adminPage = await admin.newPage();
        const { username, password } = superadminFor(testInfo.workerIndex);
        await adminPage.goto('/sign-in');
        await signIn(adminPage, username, password);
        await expect(adminPage).toHaveURL(/\/admin$/);
        await adminPage.getByRole('link', { name: COPY.adminTitle }).click();
        await expect(adminPage).toHaveURL(/\/admin\/search-files$/);
        await expect(adminPage.getByRole('heading', { level: 1 })).toHaveText(COPY.adminTitle);
        const row = adminPage.locator('[data-admin-search-file]').filter({ hasText: buyer });
        await expect(row).toHaveCount(1);
        // The buyer by username, never a phone number; the search as chips; how many cars match it now.
        await expect(row).toContainText(seed.token);
        await expect(row).toContainText('پژو');
        await expect(row).toContainText('۳۰');
        await expect(row).toContainText(COPY.watching);
        await expect(adminPage.locator('[data-admin-file-totals]')).toContainText('پرونده');
        expect(await adminPage.content()).not.toMatch(/09\d{9}/);
      } finally {
        await admin.close();
      }
    } finally {
      await removeFilesOf(buyer);
    }
  });

  test('«بسپارش به کارشناس» is on the home page rows too, and asks a visitor to sign in', async ({
    page,
  }) => {
    await page.goto('/');
    const button = page.locator('[data-save-search="row"]').first();
    await expect(button).toBeVisible();
    await waitForHydration(page);
    await expect(button).toHaveAccessibleName(/^بسپارش «.+» به کارشناس$/);
    await button.click();
    await expect(dialog(page).getByRole('heading', { name: COPY.signedOutTitle })).toBeVisible();
    const signUpLink = dialog(page).getByRole('link', { name: COPY.signUp, exact: true });
    // It returns to the catalogue's own search, with the dialog to open again.
    expect(decodeURIComponent((await signUpLink.getAttribute('href')) ?? '')).toMatch(
      /next=\/search\?catalogue=[a-z_-]+&save=1$/,
    );
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
  });
});
