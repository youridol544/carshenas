import type { Page, TestInfo } from '@playwright/test';
import { newPassword, signIn, signUp, superadminFor, uniqueUsername } from '../../fixtures/accounts';
import {
  noticesOf,
  removeModel,
  requestOf,
  removeFilesOfBuyer,
  seedFileFor,
  seedFileWithSearch,
  seedModel,
  type TestModel,
} from '../../fixtures/crawl-requests';
import { removeSearchListings, seedSearchListings } from '../../fixtures/search-listings';
import { expect, test } from '../../fixtures/test';
import { waitForHydration } from '../../gorilla/layout';

// Crawl requests (CS-71, ADR-0032): a buyer whose search file finds few cars asks the superadmin for a deeper crawl of
// the model («از کارشناس بخواهید بیشتر بگردد»); two buyers asking for one model make one request; the superadmin sees
// the demand per model, each request with the files that depend on it, approves it or declines it with a reason, and
// each buyer is told once. The page says plainly that an approval only queues the model while reading is paused.
// Each test makes a catalogue model of its own (fixtures/crawl-requests.ts), so the file is about a car that is not
// read in depth and has no matches, whatever the index holds, and removes it afterwards.

const COPY = {
  cardTitle: 'از کارشناس بخواهید بیشتر بگردد',
  submit: 'ثبت درخواست',
  pending: 'در انتظار تأیید',
  approved: 'تأیید شد',
  declined: 'رد شد',
  approve: 'تأیید',
  decline: 'رد با دلیل',
  declineSubmit: 'رد کردن درخواست',
  adminTitle: 'درخواست‌های جست‌وجوی بیشتر',
  demandHeading: 'تقاضا به تفکیک مدل',
  reason: 'این مدل خارج از بازار تهران است',
  filesTitle: 'پرونده‌های جست‌وجو',
} as const;

const SHOTS = process.env.CS71_SHOTS;

async function shot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  if (SHOTS === undefined || SHOTS === '') return;
  await page.screenshot({ path: `${SHOTS}/${name}-${testInfo.project.name}.png`, fullPage: false });
}

async function openFile(page: Page, fileId: number): Promise<void> {
  await page.goto(`/account/searches/${String(fileId)}`);
  await expect(page.locator('[data-crawl-card]')).toBeVisible();
  await waitForHydration(page);
}

async function adminContext(
  browser: import('@playwright/test').Browser,
  page: Page,
  testInfo: TestInfo,
): Promise<{ admin: Page; close: () => Promise<void> }> {
  const context = await browser.newContext({
    locale: 'fa-IR',
    timezoneId: 'Asia/Tehran',
    viewport: page.viewportSize(),
    baseURL: testInfo.project.use.baseURL,
  });
  const admin = await context.newPage();
  const { username, password } = superadminFor(testInfo.workerIndex);
  await admin.goto('/sign-in');
  await signIn(admin, username, password);
  await expect(admin).toHaveURL(/\/admin$/);
  return { admin, close: () => context.close() };
}

test.describe('crawl requests', () => {
  test('two buyers ask for one model, the superadmin approves it, and both are told once', async ({
    page,
    browser,
    a11y,
    rtl,
  }, testInfo) => {
    const model: TestModel = await seedModel('تأیید');
    const ali = uniqueUsername('ali');
    const sara = uniqueUsername('sara');
    const people = [ali, sara];
    try {
      // Ali: a file about a model that is not read in depth and finds no cars.
      await signUp(page, ali, newPassword());
      const aliFile = await seedFileFor(ali, model, 'پرونده‌ی علی');
      await openFile(page, aliFile);
      const card = page.locator('[data-crawl-card]');
      await expect(card.getByRole('heading', { name: COPY.cardTitle })).toBeVisible();
      await expect(card).toContainText(model.nameFa);
      await expect(card.locator('[data-request-state]')).toHaveCount(0);
      // The rule that offers the card is in the info control beside its title, with its number.
      await card.getByRole('button', { name: /توضیح درباره/ }).click();
      const popover = page.getByRole('dialog');
      await expect(popover).toContainText('۱۰');
      await expect(popover).toContainText('۳');
      await page.keyboard.press('Escape');
      await expect(popover).toHaveCount(0);
      await a11y.check();
      await rtl.expectNoHorizontalOverflow();
      await shot(page, testInfo, '1-buyer-card-offer');

      await card.getByRole('button', { name: COPY.submit }).click();
      await expect(card.locator('[data-request-state="pending"]')).toHaveText(COPY.pending);
      await expect(card.getByRole('button', { name: COPY.submit })).toHaveCount(0);
      expect(await requestOf(model)).toMatchObject({ state: 'pending', files: 1, buyers: 1 });
      await a11y.check();
      await shot(page, testInfo, '2-buyer-card-asked');

      // The file's card in the list says where the request stands.
      await page.goto('/account/searches');
      await expect(page.locator(`[data-search-file="${String(aliFile)}"] [data-file-crawl="pending"]`)).toContainText(
        COPY.pending,
      );
      await rtl.expectNoHorizontalOverflow();
      await shot(page, testInfo, '3-buyer-list-badge');

      // Sara asks for the same model: one request, two files.
      const saraContext = await browser.newContext({
        locale: 'fa-IR',
        timezoneId: 'Asia/Tehran',
        viewport: page.viewportSize(),
        baseURL: testInfo.project.use.baseURL,
      });
      try {
        const saraPage = await saraContext.newPage();
        await signUp(saraPage, sara, newPassword());
        const saraFile = await seedFileFor(sara, model, 'پرونده‌ی سارا');
        await openFile(saraPage, saraFile);
        const saraCard = saraPage.locator('[data-crawl-card]');
        await expect(saraCard).toContainText('کس دیگری پیش‌تر درخواست داده');
        await saraCard.getByRole('button', { name: COPY.submit }).click();
        await expect(saraCard.locator('[data-request-state="pending"]')).toBeVisible();
        expect(await requestOf(model)).toMatchObject({ state: 'pending', files: 2, buyers: 2 });
      } finally {
        await saraContext.close();
      }

      // The superadmin: demand, the dependent files with their buyers, and the decision.
      const { admin, close } = await adminContext(browser, page, testInfo);
      try {
        await admin.getByRole('link', { name: COPY.adminTitle }).click();
        await expect(admin).toHaveURL(/\/admin\/crawl-requests$/);
        await expect(admin.getByRole('heading', { level: 1 })).toHaveText(COPY.adminTitle);
        await expect(admin.getByRole('heading', { name: COPY.demandHeading })).toBeVisible();
        const row = admin.locator('[data-crawl-request]').filter({ hasText: model.nameFa });
        await expect(row).toHaveCount(1);
        await expect(row).toContainText('۲ خریدار');
        await expect(row).toContainText(ali);
        await expect(row).toContainText(sara);
        await expect(row.locator('[data-request-state="pending"]').first()).toBeVisible();
        // The paused crawl is said plainly: nothing is requested from any site.
        await expect(admin.getByRole('note')).toContainText('هیچ درخواستی به هیچ سایتی نمی‌فرستد');
        await rtl.expectNoHorizontalOverflow();
        await a11y.check();
        await shot(admin, testInfo, '4-admin-requests');

        // The files screen lists the requests of each file too (every file to its requests).
        await admin.goto('/admin/search-files');
        await expect(
          admin.locator('[data-admin-search-file]:visible').filter({ hasText: ali }).locator('[data-file-requests]'),
        ).toContainText(model.nameFa);

        await admin.goto('/admin/crawl-requests');
        const again = admin.locator('[data-crawl-request]').filter({ hasText: model.nameFa });
        await waitForHydration(admin);
        await again.getByRole('button', { name: new RegExp(`^${COPY.approve}`) }).click();
        await expect(again.locator('[data-request-state="approved"]').first()).toHaveText(COPY.approved);
        await expect(again).toContainText('خبردار شدند');
        const decided = await requestOf(model);
        expect(decided).toMatchObject({ state: 'approved', files: 2, buyers: 2 });
        expect(decided?.decidedBy).toMatch(/^e2e_superadmin_/);
        expect(decided?.decidedAt).toBeInstanceOf(Date);
        await shot(admin, testInfo, '5-admin-approved');

        // Pressing again, or deciding what is decided, tells no one twice.
        expect((await noticesOf(ali)).map((notice) => notice.eventKey)).toHaveLength(1);
        expect((await noticesOf(sara)).map((notice) => notice.eventKey)).toHaveLength(1);
      } finally {
        await close();
      }

      // Ali sees it on his file, in the list and in his notices.
      await openFile(page, aliFile);
      await expect(page.locator('[data-crawl-card] [data-request-state="approved"]')).toHaveText(COPY.approved);
      await expect(page.locator('[data-crawl-card]')).toContainText('خواندن آگهی‌ها اکنون متوقف است');
      await expect(page.locator('[data-ask-crawl]')).toHaveCount(0);
      await shot(page, testInfo, '6-buyer-approved');
      await page.goto('/account/notifications');
      await expect(page.getByRole('link', { name: new RegExp(`درخواست شما برای .*${model.nameFa}.* تأیید شد`) })).toBeVisible();
      await shot(page, testInfo, '7-buyer-notice');
    } finally {
      await removeModel(model, people);
    }
  });

  test('the superadmin declines with a reason, the buyer reads it, and the card offers no second ask', async ({
    page,
    browser,
    a11y,
    rtl,
  }, testInfo) => {
    const model = await seedModel('رد');
    const buyer = uniqueUsername('neda');
    try {
      await signUp(page, buyer, newPassword());
      const fileId = await seedFileFor(buyer, model, 'پرونده‌ی ندا');
      await openFile(page, fileId);
      await page.locator('[data-crawl-card]').getByRole('button', { name: COPY.submit }).click();
      await expect(page.locator('[data-crawl-card] [data-request-state="pending"]')).toBeVisible();

      const { admin, close } = await adminContext(browser, page, testInfo);
      try {
        await admin.goto('/admin/crawl-requests?state=pending');
        await waitForHydration(admin);
        const row = admin.locator('[data-crawl-request]').filter({ hasText: model.nameFa });
        await expect(row).toHaveCount(1);
        await row.getByRole('button', { name: new RegExp(`^${COPY.decline}`) }).click();
        // A decline needs its reason, and the approve button is gone while it is written.
        const reason = row.getByRole('textbox');
        await expect(reason).toBeFocused();
        await expect(row.getByRole('button', { name: new RegExp(`^${COPY.approve}`) })).toHaveCount(0);
        await rtl.expectNoHorizontalOverflow();
        await a11y.check();
        await shot(admin, testInfo, '8-admin-decline-reason');
        await reason.fill(COPY.reason);
        await row.getByRole('button', { name: COPY.declineSubmit }).click();
        await expect(row.locator('[data-request-state="declined"]').first()).toHaveText(COPY.declined);
        expect(await requestOf(model)).toMatchObject({ state: 'declined', reason: COPY.reason });
      } finally {
        await close();
      }

      await openFile(page, fileId);
      const card = page.locator('[data-crawl-card]');
      await expect(card.locator('[data-request-state="declined"]')).toHaveText(COPY.declined);
      await expect(card).toContainText(COPY.reason);
      await expect(card.getByRole('button', { name: COPY.submit })).toHaveCount(0);
      await a11y.check();
      await shot(page, testInfo, '9-buyer-declined');
      expect((await noticesOf(buyer)).map((notice) => notice.eventKey)).toHaveLength(1);
      await page.goto('/account/notifications');
      await expect(page.getByText(COPY.reason)).toBeVisible();
    } finally {
      await removeModel(model, [buyer]);
    }
  });

  test('a file that names no model is told to, and a file with many cars is not offered a crawl', async ({
    page,
  }) => {
    const seed = await seedSearchListings();
    const buyer = uniqueUsername('kian');
    try {
      await signUp(page, buyer, newPassword());
      // Few cars and only a make: the card says a model is needed and offers nothing.
      const makeOnly = await seedFileWithSearch(buyer, 'فقط برند', { make: ['peugeot'] });
      await page.goto(`/account/searches/${String(makeOnly)}`);
      const card = page.locator('[data-crawl-card]');
      await expect(card).toContainText('یک مدل یا تیپ را مشخص کنید');
      await expect(card.getByRole('button', { name: COPY.submit })).toHaveCount(0);
      // Many cars (the thirty seeded ones): nothing to ask for, so no card at all.
      const many = await seedFileWithSearch(buyer, 'خودروهای زیاد', { make: ['peugeot'] }, seed.token);
      await page.goto(`/account/searches/${String(many)}`);
      await expect(page.getByRole('heading', { name: 'آگهی‌های مطابق' })).toBeVisible();
      await expect(page.locator('[data-crawl-card]')).toHaveCount(0);
    } finally {
      await removeFilesOfBuyer(buyer);
      await removeSearchListings(seed);
    }
  });
});
