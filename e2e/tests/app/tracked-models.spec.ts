import type { Locator, Page, TestInfo } from '@playwright/test';
import { newPassword, signIn, signUp, superadminFor, uniqueUsername } from '../../fixtures/accounts';
import {
  removeBuyers,
  removeModel,
  seedBuyer,
  seedFileFor,
  seedModel,
  seedRequest,
} from '../../fixtures/crawl-requests';
import {
  crawlIsPaused,
  seedModelListings,
  trackedChangesOf,
  trackedRowOf,
} from '../../fixtures/tracked-models';
import { expect, test } from '../../fixtures/test';
import { waitForHydration } from '../../gorilla/layout';

// Tracked models (CS-53, ADR-0037): the superadmin chooses which models are read in depth, from the models not covered
// yet by their active listings; every change is recorded with who made it; each covered model shows its sync and how
// far the reading of its listings' details has come, and, while the crawl is paused, says plainly that the rest is
// queued. A model an approved crawl request made shows who approved it and when, and is taken back by declining the
// request. Each test makes a catalogue model of its own with a few listings (fixtures/tracked-models.ts), so a card
// has a backfill to show whatever the index holds, and removes it afterwards. Nothing here reaches a listing site.

const COPY = {
  title: 'مدل‌های پوشش‌داده‌شده',
  track: 'پوشش بده',
  pause: 'توقف خواندن',
  resume: 'ادامه‌ی خواندن',
  untrack: 'حذف از فهرست',
  confirmUntrack: 'بله، حذف شود',
  cancel: 'انصراف',
  stateTracking: 'در حال خواندن',
  stateQueued: 'در صف',
  statePaused: 'متوقف',
  high: 'بالا',
  low: 'کم',
  normal: 'معمولی',
  untrackedHeading: 'مدل‌هایی که پوشش داده نمی‌شوند',
  trackedHeading: 'مدل‌هایی که پوشش داده می‌شوند',
  historyHeading: 'تاریخچه‌ی تغییرها',
  notFound: 'این صفحه پیدا نشد',
  approve: 'تأیید',
  decline: 'رد با دلیل',
  declineSubmit: 'رد کردن درخواست',
  reason: 'ظرفیت پر است',
} as const;

const SHOTS = process.env.CS53_SHOTS;

async function shot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  if (SHOTS === undefined || SHOTS === '') return;
  await page.screenshot({ path: `${SHOTS}/${name}-${testInfo.project.name}.png`, fullPage: false });
}

/** The letters a test model's Persian name ends with: a search for them finds that model alone. */
function searchWord(nameFa: string): string {
  return nameFa.split(' ').at(-1) ?? nameFa;
}

async function openAdmin(page: Page, testInfo: TestInfo, path: string): Promise<void> {
  const { username, password } = superadminFor(testInfo.workerIndex);
  await page.goto('/sign-in');
  await signIn(page, username, password);
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto(path);
  await waitForHydration(page);
}

function cardOf(page: Page, nameFa: string): Locator {
  return page.locator('[data-tracked-model]').filter({ hasText: nameFa });
}

test.describe('tracked models', () => {
  test('the superadmin covers a model, sets its priority, pauses, resumes and removes it, and each change is recorded', async ({
    page,
    a11y,
    rtl,
  }, testInfo) => {
    const model = await seedModel('پوشش');
    try {
      // Four active listings, one of them read: a quarter of the details are in.
      await seedModelListings(model, { unread: 3, read: 1 });
      const paused = await crawlIsPaused();
      // While the crawl is paused nothing is being read, so a tracked model is queued, never «reading».
      const reading = paused ? COPY.stateQueued : COPY.stateTracking;
      const admin = superadminFor(testInfo.workerIndex).username;
      await openAdmin(
        page,
        testInfo,
        `/admin/tracked-models?q=${encodeURIComponent(searchWord(model.nameFa))}`,
      );
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(COPY.title);
      await expect(page.getByRole('heading', { name: COPY.untrackedHeading })).toBeVisible();
      if (paused)
        await expect(page.locator('[data-crawl-paused]')).toContainText('هیچ درخواستی به هیچ سایتی نمی');

      // The model is listed by its active listings and not yet covered.
      const row = page.locator('[data-untracked-model]').filter({ hasText: model.nameFa });
      await expect(row).toHaveCount(1);
      await expect(row).toContainText('۴ آگهی فعال');
      await expect(cardOf(page, model.nameFa)).toHaveCount(0);
      await rtl.expectNoHorizontalOverflow();
      await a11y.check();
      await shot(page, testInfo, '1-untracked-row');

      // Cover it with the high priority.
      await row.getByRole('combobox', { name: new RegExp(`^اولویت`) }).selectOption({ label: COPY.high });
      await row.getByRole('button', { name: new RegExp(`^${COPY.track}`) }).click();
      const card = cardOf(page, model.nameFa);
      await expect(card).toHaveCount(1);
      await expect(card.locator('[data-state-badge]')).toHaveText(reading);
      await expect(card).toHaveAttribute('data-tracked-priority', 'high');
      await expect(page.locator('[data-untracked-model]').filter({ hasText: model.nameFa })).toHaveCount(0);
      // Who created it and how is on the card; the progress is the share of active listings whose page was read.
      await expect(card.locator('[data-origin-line]')).toContainText(admin);
      await expect(card.locator('[data-backfill-value]')).toContainText('۱ از ۴');
      await expect(card.locator('[data-backfill-value]')).toContainText('۲۵');
      await expect(card.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');
      await expect(card.locator('[data-fact="active"]')).toContainText('۴');
      await expect(card.locator('[data-fact="new"]')).toContainText('۴');
      await expect(card.locator('[data-fact="sweep"]')).toContainText('هنوز نشده');
      await expect(card.locator('[data-fact="valued"]')).toContainText('هنوز محاسبه نشده');
      // With the crawl paused the three unread listings are queued, and the card says it is not moving.
      if (paused) {
        await expect(card.locator('[data-backfill-status]')).toHaveAttribute(
          'data-backfill-status',
          'queued-paused',
        );
        await expect(card.locator('[data-backfill-status]')).toContainText('۳ آگهی در صف');
        await expect(card.locator('[data-backfill-status]')).toContainText('متوقف');
      }
      expect(await trackedRowOf(model)).toMatchObject({
        state: 'tracking',
        priority: 'high',
        origin: 'superadmin',
        createdBy: admin,
      });
      await rtl.expectNoHorizontalOverflow();
      await a11y.check();
      await shot(page, testInfo, '2-tracked-card');

      // Priority: one press, the state it asks for; pressing the current one sends nothing.
      await card.getByRole('button', { name: COPY.low, exact: true }).click();
      await expect(card.getByRole('button', { name: COPY.low, exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(card.getByRole('status')).toContainText('اولویت ثبت شد');
      await expect(card).toHaveAttribute('data-tracked-priority', 'low');
      expect((await trackedRowOf(model))?.priority).toBe('low');

      // Pause: the model keeps its data and says so; resume brings it back.
      await card.getByRole('button', { name: new RegExp(`^${COPY.pause}`) }).click();
      await expect(card.locator('[data-state-badge]')).toHaveText(COPY.statePaused);
      await expect(card.locator('[data-backfill-status]')).toContainText(
        'آخرین داده‌اش با تاریخ آن نمایش داده می‌شود',
      );
      expect((await trackedRowOf(model))?.state).toBe('paused');
      await shot(page, testInfo, '3-paused-card');
      await card.getByRole('button', { name: new RegExp(`^${COPY.resume}`) }).click();
      await expect(card.locator('[data-state-badge]')).toHaveText(reading);
      expect((await trackedRowOf(model))?.state).toBe('tracking');

      // Removing asks first, in place; cancelling changes nothing, confirming takes the model out of the list.
      await card.getByRole('button', { name: new RegExp(`^${COPY.untrack}`) }).click();
      const confirmation = card.getByRole('group', { name: COPY.untrack });
      await expect(confirmation).toBeVisible();
      await shot(page, testInfo, '4-confirm-untrack');
      await confirmation.getByRole('button', { name: COPY.cancel }).click();
      await expect(confirmation).toHaveCount(0);
      expect(await trackedRowOf(model)).not.toBeNull();
      await card.getByRole('button', { name: new RegExp(`^${COPY.untrack}`) }).click();
      await confirmation.getByRole('button', { name: COPY.confirmUntrack }).click();
      await expect(cardOf(page, model.nameFa)).toHaveCount(0);
      await expect(page.locator('[data-untracked-model]').filter({ hasText: model.nameFa })).toHaveCount(1);
      expect(await trackedRowOf(model)).toBeNull();

      // Every change was recorded with the superadmin who made it, and outlives the row.
      expect(await trackedChangesOf(model)).toEqual([
        { action: 'tracked', by: admin },
        { action: 'priority_changed', by: admin },
        { action: 'paused', by: admin },
        { action: 'resumed', by: admin },
        { action: 'untracked', by: admin },
      ]);
      // The latest changes list shows them with their names.
      const recent = page.locator('#recent').locator('xpath=..').locator('..');
      await expect(recent).toContainText(admin);
      await rtl.expectNoHorizontalOverflow();
      await a11y.check();
      await shot(page, testInfo, '5-after-untrack');
    } finally {
      await removeModel(model, []);
    }
  });

  test('a card keeps its history, and a model made by an approved crawl request shows who approved it and is taken back by declining', async ({
    page,
    a11y,
    rtl,
  }, testInfo) => {
    const model = await seedModel('درخواست');
    const buyer = uniqueUsername('neda');
    try {
      await seedModelListings(model, { unread: 2, read: 0 });
      await seedBuyer(buyer);
      await seedRequest(model, [await seedFileFor(buyer, model, 'پرونده‌ی ندا')]);
      const admin = superadminFor(testInfo.workerIndex).username;
      await openAdmin(page, testInfo, '/admin/crawl-requests');
      const request = page.locator('[data-crawl-request]').filter({ hasText: model.nameFa });
      await request.getByRole('button', { name: new RegExp(`^${COPY.approve}`) }).click();
      await expect(request.locator('[data-request-state="approved"]').first()).toBeVisible();
      expect(await trackedRowOf(model)).toMatchObject({
        state: 'tracking',
        origin: 'request',
        createdBy: admin,
      });

      await page.goto(`/admin/tracked-models`);
      await waitForHydration(page);
      const card = cardOf(page, model.nameFa);
      await expect(card).toHaveCount(1);
      await expect(card).toHaveAttribute('data-tracked-origin', 'request');
      await expect(card.locator('[data-origin-line]')).toContainText('از درخواست خریداران');
      await expect(card.locator('[data-origin-line]')).toContainText(admin);
      await expect(card.locator('[data-origin-line]')).toContainText('تأییدشده و در صف خواندن');
      // Held by the request: it cannot be paused either, and the card says why.
      await expect(card.locator('[data-intent="pause"]')).toHaveCount(0);
      await expect(card).toContainText('نه متوقف می‌شود و نه حذف');
      // Not read yet: it is declined, not removed, so its buyers hear why.
      await expect(card.locator('[data-untrack-open]')).toHaveCount(0);
      await expect(card.getByRole('link', { name: 'باز کردن درخواست‌ها' })).toBeVisible();
      await card.getByText(COPY.historyHeading).click();
      await expect(card.locator('details')).toContainText('از درخواست تأییدشده پوشش داده شد');
      await rtl.expectNoHorizontalOverflow();
      await a11y.check();
      await shot(page, testInfo, '6-request-card');

      // The crawl-request screen lists it as read now, from the request.
      await page.goto('/admin/crawl-requests');
      await expect(page.locator('[data-tracked-model]').filter({ hasText: model.nameFa })).toContainText(
        'از درخواست تأییدشده',
      );

      // Declining the approved request takes the model back.
      await page.goto('/admin/crawl-requests');
      await waitForHydration(page);
      const again = page.locator('[data-crawl-request]').filter({ hasText: model.nameFa });
      await again.getByRole('button', { name: new RegExp(`^${COPY.decline}`) }).click();
      await again.getByRole('textbox').fill(COPY.reason);
      await again.getByRole('button', { name: COPY.declineSubmit }).click();
      await expect(again.locator('[data-request-state="declined"]').first()).toBeVisible();
      expect(await trackedRowOf(model)).toBeNull();
      expect((await trackedChangesOf(model)).map((change) => change.action)).toEqual([
        'from_request',
        'request_withdrawn',
      ]);
      await page.goto('/admin/tracked-models');
      await expect(cardOf(page, model.nameFa)).toHaveCount(0);
    } finally {
      await removeModel(model, [buyer]);
      await removeBuyers([buyer]);
    }
  });

  test('the dashboard links to the screen', async ({ page }, testInfo) => {
    await openAdmin(page, testInfo, '/admin');
    await page.getByRole('link', { name: COPY.title }).click();
    await expect(page).toHaveURL(/\/admin\/tracked-models$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(COPY.title);
    await expect(page.getByRole('heading', { name: COPY.trackedHeading })).toBeVisible();
  });
});

test.describe('everyone else', () => {
  test.use({
    ignoreBrowserErrors: [
      [/\[http 404\] GET .*\/admin\/tracked-models/, /Failed to load resource.*404/],
      { scope: 'test' },
    ],
  });

  test('gets a real 404 from the screen, as a visitor and as a buyer', async ({ page, request }) => {
    const visitorRequest = await request.get('/admin/tracked-models', { maxRedirects: 0 });
    expect(visitorRequest.status()).toBe(404);
    const visitor = await page.goto('/admin/tracked-models');
    expect(visitor?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(COPY.notFound);
    await signUp(page, uniqueUsername(), newPassword());
    const buyer = await page.goto('/admin/tracked-models');
    expect(buyer?.status()).toBe(404);
  });
});
