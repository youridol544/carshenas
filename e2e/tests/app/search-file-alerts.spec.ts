import type { Locator, Page } from '@playwright/test';
import { newPassword, signIn, signUp, superadminFor, uniqueUsername } from '../../fixtures/accounts';
import {
  alertsMuted,
  removeFilesOf,
  removeMatchingRuns,
  rewindLastLook,
  seedMatchingRuns,
  sendDigest,
} from '../../fixtures/search-files';
import { removeSearchListings, seedSearchListings, type SearchSeed } from '../../fixtures/search-listings';
import { expect, test as base } from '../../fixtures/test';
import { waitForHydration } from '../../gorilla/layout';

// Alerts of a search file (CS-72, ADR-0035): the matching job's digest reaches the buyer's inbox with a link to the file,
// whose page marks what is new, shows when Karshenas last told them and lets them mute this one file, with an info
// control that explains the rules. The matching itself (what a digest holds, the watermark, the cap, idempotency) is
// tested on the database by the worker; here a digest is made through the same function the job writes through.

const COPY = {
  save: 'بسپارش به کارشناس',
  nameLabel: 'نام پرونده',
  submit: 'ساختن پرونده',
  created: 'پرونده ساخته شد',
  openFile: 'دیدن پرونده',
  results: 'نتیجه‌های جست‌وجو',
  alertsLabel: 'هشدار آگهی تازه',
  infoLabel: 'توضیح درباره‌ی هشدار پرونده',
  infoTitle: 'هشدار پرونده چطور کار می‌کند؟',
  mutedNote: 'هشدار این پرونده خاموش است',
  mutedChip: 'هشدار خاموش',
  lastAlert: 'آخرین هشدار',
  newBadge: 'تازه',
} as const;

const test = base.extend<{ seed: SearchSeed }>({
  seed: async ({}, use) => {
    const seed = await seedSearchListings();
    await use(seed);
    await removeSearchListings(seed);
  },
});

async function makeFile(page: Page, seed: SearchSeed, name: string): Promise<number> {
  await page.goto(`/search?q=${seed.token}&make=peugeot`);
  await expect(page.getByRole('list', { name: COPY.results })).toBeVisible();
  await waitForHydration(page);
  await page.locator('[data-save-search="button"]').click();
  const box = page.getByRole('dialog');
  const field = box.getByRole('textbox', { name: COPY.nameLabel });
  await expect(field).toBeVisible();
  await field.fill(name);
  await box.getByRole('button', { name: COPY.submit }).click();
  await expect(box.getByRole('heading', { name: COPY.created })).toBeVisible();
  await box.getByRole('link', { name: COPY.openFile }).click();
  await expect(page).toHaveURL(/\/account\/searches\/\d+$/);
  return Number(page.url().split('/').at(-1));
}

function switchOf(page: Page): Locator {
  return page.getByRole('switch', { name: COPY.alertsLabel });
}

test.describe('search file alerts', () => {
  test('a digest reaches the inbox, opens the file with what is new marked, and the file says when it last told the buyer', async ({
    page,
    seed,
    rtl,
    a11y,
  }) => {
    const username = uniqueUsername('alerts');
    await signUp(page, username, newPassword());
    try {
      const name = 'پژو ۲۰۶ تیپ ۵';
      const fileId = await makeFile(page, seed, name);
      // The buyer has not looked for three days; the seeded listings came since, and Karshenas tells them so.
      await page.goto('/account/searches');
      await rewindLastLook(username, 3);
      expect(
        await sendDigest(username, fileId, { fileName: name, newCount: 3, goodCount: 2 }),
      ).not.toBeNull();

      await page.goto('/account/notifications');
      const row = page.getByRole('region').getByRole('listitem').first();
      const link = row.getByRole('link');
      await expect(link).toHaveAccessibleName(/^خوانده‌نشده: ۳\sآگهی تازه برای «/);
      await expect(link).toHaveAttribute('href', `/account/searches/${String(fileId)}`);
      await expect(link).not.toHaveAttribute('target', '_blank');
      await expect(row).toContainText('آگهی از آن‌ها قیمت خوب یا عالی دارد');
      await rtl.expectPersianDigits(row.getByText(/آگهی از آن‌ها/));
      // A digest has no price to show: its row is compact, not a third empty.
      const height = (await row.boundingBox())?.height ?? 0;
      expect(height).toBeGreaterThan(0);
      expect(height).toBeLessThanOrEqual(130);
      await rtl.expectNoHorizontalOverflow();
      await a11y.check();
      await page.screenshot({ path: test.info().outputPath('inbox.png') });

      // The file's card in the list shows when the buyer was last told.
      await page.goto('/account/searches');
      const card = page.locator('[data-search-file]');
      await expect(card.locator('[data-last-alert]')).toContainText(COPY.lastAlert);
      await expect(card.locator('[data-new-count]')).toBeVisible();

      // The notification leads to the file, whose cards carry the «تازه» mark.
      await page.goto('/account/notifications');
      await link.click();
      await expect(page).toHaveURL(`/account/searches/${String(fileId)}`);
      await expect(page.locator('[data-listing-mark]').first()).toHaveText(COPY.newBadge);
      await expect(switchOf(page)).toBeChecked();
      await rtl.expectNoHorizontalOverflow();
      await a11y.check();
      await page.screenshot({ path: test.info().outputPath('file.png'), fullPage: true });
    } finally {
      await removeFilesOf(username);
    }
  });

  test('a buyer mutes the alerts of one file: the switch holds after a reload, the list says so, and no digest is made', async ({
    page,
    seed,
  }) => {
    const username = uniqueUsername('alerts');
    await signUp(page, username, newPassword());
    try {
      const name = 'پژو بی‌صدا';
      const fileId = await makeFile(page, seed, name);
      await waitForHydration(page);
      const alerts = switchOf(page);
      await expect(alerts).toBeChecked();
      await alerts.click();
      await expect(alerts).not.toBeChecked();
      await expect.poll(async () => alertsMuted(fileId), { timeout: 10_000 }).toBe(true);
      await expect(page.getByText(COPY.mutedNote)).toBeVisible();
      await page.reload();
      await expect(switchOf(page)).not.toBeChecked();

      await page.goto('/account/searches');
      await expect(page.locator('[data-search-file] [data-alerts-muted]')).toHaveText(COPY.mutedChip);
      // create_notification() creates nothing from a muted file, whoever asks.
      expect(await sendDigest(username, fileId, { fileName: name, newCount: 1, goodCount: 1 })).toBeNull();

      // Turned back on, it tells again.
      await page.goto(`/account/searches/${String(fileId)}`);
      await waitForHydration(page);
      await switchOf(page).click();
      await expect(switchOf(page)).toBeChecked();
      await expect.poll(async () => alertsMuted(fileId), { timeout: 10_000 }).toBe(false);
      expect(
        await sendDigest(username, fileId, { fileName: name, newCount: 1, goodCount: 1 }),
      ).not.toBeNull();
    } finally {
      await removeFilesOf(username);
    }
  });

  test('the info control explains the rules from the same numbers the job enforces, and Escape closes it', async ({
    page,
    seed,
    rtl,
    a11y,
  }) => {
    const username = uniqueUsername('alerts');
    await signUp(page, username, newPassword());
    try {
      await makeFile(page, seed, 'پژو توضیح');
      await waitForHydration(page);
      const info = page.getByRole('button', { name: COPY.infoLabel });
      await info.click();
      const popup = page.getByRole('dialog', { name: COPY.infoTitle });
      await expect(popup).toBeVisible();
      await expect(popup).toContainText('۵ دقیقه');
      await expect(popup).toContainText('۲ ساعت');
      await expect(popup).toContainText('۸ اعلان');
      await rtl.expectPersianDigits(popup.getByText(/دقیقه/));
      await rtl.expectNoHorizontalOverflow();
      await a11y.check();
      await page.screenshot({ path: test.info().outputPath('info.png') });
      await page.keyboard.press('Escape');
      await expect(popup).toBeHidden();
      await expect(info).toBeFocused();
    } finally {
      await removeFilesOf(username);
    }
  });

  test('a paused file keeps the buyer’s choice and says why nothing arrives', async ({ page, seed }) => {
    const username = uniqueUsername('alerts');
    await signUp(page, username, newPassword());
    try {
      await makeFile(page, seed, 'پژو متوقف');
      await waitForHydration(page);
      await page.getByRole('button', { name: 'توقف پایش' }).click();
      await expect(page.getByText('پرونده پایش نمی‌شود')).toBeVisible();
      await expect(switchOf(page)).toBeChecked();
    } finally {
      await removeFilesOf(username);
    }
  });

  test('the superadmin sees the matching runs: when, how many buyers were told, what was read and how long it took', async ({
    page,
  }, testInfo) => {
    const marker = await seedMatchingRuns();
    try {
      const { username, password } = superadminFor(testInfo.workerIndex);
      await page.goto('/sign-in');
      await signIn(page, username, password);
      await expect(page).toHaveURL(/\/admin$/);
      await page.goto('/admin/search-files');
      const runs = page.locator('[data-matching-run]');
      await expect(page.getByRole('heading', { name: 'پایش پرونده‌ها' })).toBeVisible();
      const told = runs.filter({ has: page.locator('[data-matching-notified="4"]') });
      await expect(told).toHaveCount(1);
      await expect(told).toContainText('۴ اعلان');
      await expect(told).toContainText('۱۲ پرونده');
      await expect(told).toContainText('۹ آگهی تازه');
      await expect(told).toContainText('۲ کاهش قیمت');
      await expect(told).toContainText('۱٫۲ ثانیه');
      await expect(runs.filter({ hasText: '۴۱ میلی‌ثانیه' })).toHaveCount(1);
      await page.screenshot({ path: testInfo.outputPath('admin.png') });
    } finally {
      await removeMatchingRuns(marker);
    }
  });
});
