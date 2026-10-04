import type { Page, TestInfo } from '@playwright/test';
import { newPassword, signIn, signUp, superadminFor, uniqueUsername } from '../../fixtures/accounts';
import {
  decideAndNotify,
  noticesOf,
  removeBuyers,
  removeFilesOfBuyer,
  removeModel,
  requestOf,
  seedBuyer,
  seedFileFor,
  seedFileWithSearch,
  seedModel,
  seedRequest,
} from '../../fixtures/crawl-requests';
import { removeSearchListings, seedSearchListings } from '../../fixtures/search-listings';
import { expect, test } from '../../fixtures/test';
import { waitForHydration } from '../../gorilla/layout';

// Crawl requests (CS-71, ADR-0036): a buyer whose search file finds few cars asks the superadmin for a deeper crawl of
// the model («درخواست جست‌وجوی بیشتر»); two buyers asking for one model make one request; the superadmin sees
// the demand per model, each request with the files that depend on it, approves it or declines it with a reason, and
// each buyer is told once. The page says plainly that an approval only queues the model while reading is paused.
// Each test makes a catalogue model of its own (fixtures/crawl-requests.ts), so the file is about a car that is not
// read in depth and has no matches, whatever the index holds, and removes it afterwards.

const COPY = {
  cardTitle: 'درخواست جست‌وجوی بیشتر',
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

test.describe('crawl requests', () => {
  test('a buyer whose file finds few cars is offered a deeper crawl, asks, and sees where it stands', async ({
    page,
    a11y,
    rtl,
  }, testInfo) => {
    const model = await seedModel('پیشنهاد');
    const ali = uniqueUsername('ali');
    try {
      await signUp(page, ali, newPassword());
      const aliFile = await seedFileFor(ali, model, 'پرونده‌ی علی');
      await openFile(page, aliFile);
      const card = page.locator('[data-crawl-card]');
      await expect(card.getByRole('heading', { name: COPY.cardTitle })).toBeVisible();
      await expect(card).toContainText(model.nameFa);
      await expect(card.locator('[data-request-state]')).toHaveCount(0);
      // The rule that offers the card is in the info control beside its title, with its numbers.
      await card.getByRole('button', { name: /توضیح درباره/ }).click();
      const popover = page.getByRole('dialog');
      await expect(popover).toContainText('۱۰');
      await expect(popover).toContainText('۳');
      await shot(page, testInfo, '1-buyer-card-info');
      await page.keyboard.press('Escape');
      await expect(popover).toHaveCount(0);
      await a11y.check();
      await rtl.expectNoHorizontalOverflow();
      await shot(page, testInfo, '2-buyer-card-offer');

      await card.getByRole('button', { name: COPY.submit }).click();
      await expect(card.locator('[data-request-state="pending"]')).toHaveText(COPY.pending);
      await expect(card.getByRole('button', { name: COPY.submit })).toHaveCount(0);
      expect(await requestOf(model)).toMatchObject({ state: 'pending', files: 1, buyers: 1 });
      await a11y.check();
      await shot(page, testInfo, '3-buyer-card-asked');

      // The file's card in the list says where the request stands.
      await page.goto('/account/searches');
      await expect(
        page.locator(`[data-search-file="${String(aliFile)}"] [data-file-crawl="pending"]`),
      ).toContainText(COPY.pending);
      await rtl.expectNoHorizontalOverflow();
      await shot(page, testInfo, '4-buyer-list-badge');
    } finally {
      await removeModel(model, [ali]);
    }
  });

  test('a second buyer asking for the same model joins the one request', async ({ page }) => {
    const model = await seedModel('مشترک');
    const ali = uniqueUsername('ali');
    const sara = uniqueUsername('sara');
    try {
      // Ali asked before: his request exists, pending, with his file.
      await seedBuyer(ali);
      await seedRequest(model, [await seedFileFor(ali, model, 'پرونده‌ی علی')]);
      await signUp(page, sara, newPassword());
      const saraFile = await seedFileFor(sara, model, 'پرونده‌ی سارا');
      await openFile(page, saraFile);
      const card = page.locator('[data-crawl-card]');
      await expect(card).toContainText('کس دیگری پیش‌تر درخواست داده');
      await card.getByRole('button', { name: COPY.submit }).click();
      // The press is answered when the card stops offering it and says the buyer will hear back.
      await expect(card.getByRole('button', { name: COPY.submit })).toHaveCount(0);
      await expect(card).toContainText('پاسخ را در اعلان‌ها می‌بینید');
      expect(await requestOf(model)).toMatchObject({ state: 'pending', files: 2, buyers: 2 });
    } finally {
      await removeModel(model, [ali, sara]);
      await removeBuyers([ali]);
    }
  });

  test('the superadmin sees the demand, the files behind a request and their buyers, approves it, and each buyer is told once', async ({
    page,
    a11y,
    rtl,
  }, testInfo) => {
    const model = await seedModel('تأیید');
    const ali = uniqueUsername('ali');
    const sara = uniqueUsername('sara');
    try {
      await Promise.all([seedBuyer(ali), seedBuyer(sara)]);
      const aliFile = await seedFileFor(ali, model, 'پرونده‌ی علی');
      const aliSecond = await seedFileFor(ali, model, 'پرونده‌ی دوم علی');
      const saraFile = await seedFileFor(sara, model, 'پرونده‌ی سارا');
      await seedRequest(model, [aliFile, aliSecond, saraFile]);

      const { username, password } = superadminFor(testInfo.workerIndex);
      await page.goto('/sign-in');
      await signIn(page, username, password);
      await expect(page).toHaveURL(/\/admin$/);
      await page.getByRole('link', { name: COPY.adminTitle }).click();
      await expect(page).toHaveURL(/\/admin\/crawl-requests$/);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(COPY.adminTitle);
      await expect(page.getByRole('heading', { name: COPY.demandHeading })).toBeVisible();
      const row = page.locator('[data-crawl-request]').filter({ hasText: model.nameFa });
      await expect(row).toHaveCount(1);
      // Two buyers, three files: the demand counts buyers, and each file shows its buyer and its search.
      await expect(row).toContainText('۲ خریدار');
      await expect(row).toContainText('۳ پرونده');
      await expect(row.locator('[data-request-file]')).toHaveCount(3);
      await expect(row).toContainText(ali);
      await expect(row).toContainText(sara);
      await expect(row.locator('[data-request-state="pending"]').first()).toBeVisible();
      // The paused crawl is said plainly: nothing is requested from any site.
      await expect(page.getByRole('note')).toContainText('هیچ درخواستی به هیچ سایتی نمی‌فرستد');
      await rtl.expectNoHorizontalOverflow();
      await a11y.check();
      await shot(page, testInfo, '5-admin-requests');

      // Every file shows the requests it depends on.
      await page.goto('/admin/search-files');
      await expect(
        page
          .locator('[data-admin-search-file]:visible')
          .filter({ hasText: sara })
          .locator('[data-file-requests]'),
      ).toContainText(model.nameFa);

      await page.goto('/admin/crawl-requests');
      await waitForHydration(page);
      const again = page.locator('[data-crawl-request]').filter({ hasText: model.nameFa });
      await again.getByRole('button', { name: new RegExp(`^${COPY.approve}`) }).click();
      await expect(again.locator('[data-request-state="approved"]').first()).toHaveText(COPY.approved);
      await expect(again).toContainText('خبردار شدند');
      const decided = await requestOf(model);
      expect(decided).toMatchObject({ state: 'approved', files: 3, buyers: 2 });
      expect(decided?.decidedBy).toBe(username);
      expect(decided?.decidedAt).toBeInstanceOf(Date);
      await shot(page, testInfo, '6-admin-approved');
      // Each buyer is told once: Ali has two files and one notice.
      expect(await noticesOf(ali)).toHaveLength(1);
      expect(await noticesOf(sara)).toHaveLength(1);
    } finally {
      await removeModel(model, [ali, sara]);
      await removeBuyers([ali, sara]);
    }
  });

  test('the buyer sees an approval on the file, in the list and in the inbox, with the delay said plainly', async ({
    page,
    a11y,
    rtl,
  }, testInfo) => {
    const model = await seedModel('اعلان');
    const ali = uniqueUsername('ali');
    try {
      await signUp(page, ali, newPassword());
      const fileId = await seedFileFor(ali, model, 'پرونده‌ی علی');
      const requestId = await seedRequest(model, [fileId]);
      await decideAndNotify(requestId, 'approved', ali, fileId, model.nameFa, null);
      await openFile(page, fileId);
      const card = page.locator('[data-crawl-card]');
      await expect(card.locator('[data-request-state="approved"]')).toHaveText(COPY.approved);
      await expect(card).toContainText('با تأخیر');
      await expect(page.locator('[data-ask-crawl]')).toHaveCount(0);
      await a11y.check();
      await rtl.expectNoHorizontalOverflow();
      await shot(page, testInfo, '7-buyer-approved');

      await page.goto('/account/searches');
      await expect(
        page.locator(`[data-search-file="${String(fileId)}"] [data-file-crawl="approved"]`),
      ).toBeVisible();

      await page.goto('/account/notifications');
      const notice = page.getByRole('link', {
        name: new RegExp(`درخواست شما برای .*${model.nameFa}.* تأیید شد`),
      });
      await expect(notice).toBeVisible();
      await shot(page, testInfo, '8-buyer-notice');
      await notice.click();
      await expect(page).toHaveURL(new RegExp(`/account/searches/${String(fileId)}$`));
    } finally {
      await removeModel(model, [ali]);
    }
  });

  test('the superadmin declines a request with a reason, which the buyer is told', async ({
    page,
    a11y,
    rtl,
  }, testInfo) => {
    const model = await seedModel('رد');
    const buyer = uniqueUsername('neda');
    try {
      await seedBuyer(buyer);
      await seedRequest(model, [await seedFileFor(buyer, model, 'پرونده‌ی ندا')]);
      const { username, password } = superadminFor(testInfo.workerIndex);
      await page.goto('/sign-in');
      await signIn(page, username, password);
      await expect(page).toHaveURL(/\/admin$/);
      await page.goto('/admin/crawl-requests');
      await waitForHydration(page);
      const row = page.locator('[data-crawl-request]').filter({ hasText: model.nameFa });
      await expect(row).toHaveCount(1);
      await row.getByRole('button', { name: new RegExp(`^${COPY.decline}`) }).click();
      // A decline needs its reason, and the approve button is gone while it is written.
      const reason = row.getByRole('textbox');
      await expect(reason).toBeFocused();
      await expect(row.getByRole('button', { name: new RegExp(`^${COPY.approve}`) })).toHaveCount(0);
      await rtl.expectNoHorizontalOverflow();
      await a11y.check();
      await shot(page, testInfo, '9-admin-decline-reason');
      await reason.fill(COPY.reason);
      await row.getByRole('button', { name: COPY.declineSubmit }).click();
      await expect(row.locator('[data-request-state="declined"]').first()).toHaveText(COPY.declined);
      await expect(row).toContainText(COPY.reason);
      expect(await requestOf(model)).toMatchObject({ state: 'declined', reason: COPY.reason });
      expect(await noticesOf(buyer)).toHaveLength(1);
      // A declined request is not offered a second decline, only a reconsideration.
      await expect(row.getByRole('button', { name: new RegExp(`^${COPY.decline}`) })).toHaveCount(0);
      await shot(page, testInfo, '10-admin-declined');
    } finally {
      await removeModel(model, [buyer]);
      await removeBuyers([buyer]);
    }
  });

  test('a declined request gives its reason to the buyer, and the card offers no second ask', async ({
    page,
    a11y,
  }, testInfo) => {
    const model = await seedModel('بازگشت');
    const buyer = uniqueUsername('neda');
    try {
      await signUp(page, buyer, newPassword());
      const fileId = await seedFileFor(buyer, model, 'پرونده‌ی ندا');
      const requestId = await seedRequest(model, [fileId]);
      await decideAndNotify(requestId, 'declined', buyer, fileId, model.nameFa, COPY.reason);
      await openFile(page, fileId);
      const card = page.locator('[data-crawl-card]');
      await expect(card.locator('[data-request-state="declined"]')).toHaveText(COPY.declined);
      await expect(card).toContainText(COPY.reason);
      await expect(card.getByRole('button', { name: COPY.submit })).toHaveCount(0);
      await a11y.check();
      await shot(page, testInfo, '11-buyer-declined');
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
