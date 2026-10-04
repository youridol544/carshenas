import { COPY, newPassword, signUp, uniqueUsername } from '../../fixtures/accounts';
import { NOTIFICATIONS, notifySample, openInbox, unreadText } from '../../fixtures/notifications';
import { expect, test } from '../../fixtures/test';

// The notifications inbox (CS-68, ADR-0026): an unread notification reaches a signed-in buyer's header and inbox,
// reading it (one, then all) clears it, optimistically and for good, and a muted kind creates nothing. Each test signs
// up its own buyer and notifies them of real recent price drops through the database function every producer uses.

function accountButton(page: import('@playwright/test').Page) {
  return page.getByRole('button', { name: new RegExp(`^${COPY.menu}`) });
}

test('an unread notification shows in the header, and the inbox reads it, then all of them', async ({
  page,
  rtl,
  a11y,
}) => {
  const username = uniqueUsername();
  await signUp(page, username, newPassword());
  expect(notifySample(username, 3)).toEqual({ created: 3, skipped: 0 });

  await page.reload();
  await expect(accountButton(page)).toHaveAccessibleName(`${COPY.menu}، ${unreadText('۳')}`);
  await accountButton(page).click();
  await page.getByRole('menuitem', { name: new RegExp(`^${NOTIFICATIONS.menuItem}`) }).click();
  await expect(page).toHaveURL('/account/notifications');
  await expect(page).toHaveTitle(`${NOTIFICATIONS.title} | کارشناس`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(NOTIFICATIONS.title);

  const status = page.getByRole('status').filter({ hasText: /اعلان/ });
  await expect(status).toHaveText(unreadText('۳'));
  const today = page.getByRole('region', { name: NOTIFICATIONS.today });
  const rows = today.getByRole('listitem');
  await expect(rows).toHaveCount(3);
  // Each one names the car whose price dropped, both prices in tomans, and links to the listing's page here.
  const first = rows.first();
  const link = first.getByRole('link');
  await expect(link).toHaveAccessibleName(/^خوانده‌نشده: قیمت .+ کم شد/);
  await expect(link).toHaveAttribute('href', /^\/listings\/\d+$/);
  await expect(first.getByText(/تومان/).first()).toBeVisible();
  // Amounts, shares and times read in Persian digits; a car's name may carry a Latin code («V8») as written.
  await rtl.expectPersianDigits(first.getByText(/ارزان‌تر شده است/));
  await rtl.expectPersianDigits(first.getByRole('deletion'));
  await rtl.expectPersianDigits(first.locator('time'));
  await rtl.expectDocumentRtl();
  await rtl.expectNoHorizontalOverflow();
  await a11y.check();

  await first.getByRole('button', { name: NOTIFICATIONS.markRead }).click();
  await expect(status).toHaveText(unreadText('۲'));
  await expect(first.getByRole('button', { name: NOTIFICATIONS.markRead })).toBeHidden();
  await expect(link).toBeFocused();
  // It stays read: the header and a fresh load agree.
  await expect(accountButton(page)).toHaveAccessibleName(`${COPY.menu}، ${unreadText('۲')}`);
  await page.reload();
  await expect(status).toHaveText(unreadText('۲'));

  await page.getByRole('button', { name: NOTIFICATIONS.markAllRead }).click();
  await expect(status).toHaveText(NOTIFICATIONS.allRead);
  await expect(accountButton(page)).toHaveAccessibleName(COPY.menu);
  await page.reload();
  await expect(status).toHaveText(NOTIFICATIONS.allRead);
  await expect(page.getByRole('button', { name: NOTIFICATIONS.markRead })).toHaveCount(0);
});

test('opening a notification opens its listing page and marks it read', async ({ page }) => {
  const username = uniqueUsername();
  await signUp(page, username, newPassword());
  notifySample(username, 1);
  await openInbox(page);
  const status = page.getByRole('status').filter({ hasText: /اعلان/ });
  await expect(status).toHaveText(unreadText('۱'));

  await page.getByRole('region', { name: NOTIFICATIONS.today }).getByRole('link').click();
  await expect(page).toHaveURL(/\/listings\/\d+$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await openInbox(page);
  await expect(status).toHaveText(NOTIFICATIONS.allRead);
});

test('a muted kind creates no notification until it is turned back on', async ({ page, a11y }) => {
  const username = uniqueUsername();
  await signUp(page, username, newPassword());
  notifySample(username, 1);
  await openInbox(page);
  const setting = page.getByRole('switch', { name: NOTIFICATIONS.priceDropSetting });
  await expect(setting).toBeChecked();
  await setting.click();
  await expect(setting).not.toBeChecked();
  await a11y.check();
  await page.reload();
  await expect(setting).not.toBeChecked();

  // A producer that runs now creates nothing for this buyer, and the inbox keeps what it had.
  expect(notifySample(username, 2, 1)).toEqual({ created: 0, skipped: 2 });
  await page.reload();
  await expect(page.getByRole('region', { name: NOTIFICATIONS.today }).getByRole('listitem')).toHaveCount(1);

  await setting.click();
  await expect(setting).toBeChecked();
  await page.reload();
  await expect(setting).toBeChecked();
  expect(notifySample(username, 2, 1)).toEqual({ created: 2, skipped: 0 });
});

test('a new buyer finds an empty inbox that says what will arrive and leads to search', async ({
  page,
  rtl,
}) => {
  await signUp(page, uniqueUsername(), newPassword());
  await openInbox(page);
  await expect(page.getByRole('heading', { name: NOTIFICATIONS.emptyHeading })).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: NOTIFICATIONS.emptyAction })).toHaveAttribute(
    'href',
    '/',
  );
  await expect(accountButton(page)).toHaveAccessibleName(COPY.menu);
  await rtl.expectNoHorizontalOverflow();
});

test('a visitor asking for the inbox signs in and comes back to it', async ({ page }) => {
  await page.goto('/account/notifications');
  await expect(page).toHaveURL('/sign-in?next=%2Faccount%2Fnotifications');
});

test.describe('when marking read fails', () => {
  // The test cuts the action's request on purpose; the browser reports that failure, which is the point.
  test.use({
    ignoreBrowserErrors: [
      [
        /requestfailed\] POST .*\/account\/notifications/,
        /Failed to fetch/,
        /Failed to load resource: net::ERR_FAILED/,
      ],
      { scope: 'test' },
    ],
  });

  test('the unread mark comes back and an overlay says so, with a retry that works', async ({ page }) => {
    const username = uniqueUsername();
    await signUp(page, username, newPassword());
    notifySample(username, 1);
    await openInbox(page);
    const status = page.getByRole('status').filter({ hasText: /اعلان/ });
    await expect(status).toHaveText(unreadText('۱'));

    await page.route('**/account/notifications', (route) =>
      route.request().method() === 'POST' ? route.abort('failed') : route.fallback(),
    );
    await page.getByRole('button', { name: NOTIFICATIONS.markRead }).click();
    await expect(page.getByText(NOTIFICATIONS.failure)).toBeVisible();
    await expect(status).toHaveText(unreadText('۱'));
    await expect(page.getByRole('button', { name: NOTIFICATIONS.markRead })).toBeVisible();

    await page.unroute('**/account/notifications');
    await page.getByRole('button', { name: NOTIFICATIONS.retry }).click();
    await expect(status).toHaveText(NOTIFICATIONS.allRead);
    await expect(page.getByText(NOTIFICATIONS.failure)).toBeHidden();
  });
});
