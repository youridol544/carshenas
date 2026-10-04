import { expect, test } from '../../fixtures/test';

// The not-found page for any address the app does not have. Its own 404 is the expected answer here, so only that
// response is let through the browser-log guard. The error pages are covered by unit tests beside them.

// An array option goes in Playwright's [value, options] tuple, or its first element is taken as the value.
test.use({
  ignoreBrowserErrors: [
    [/\[http 404\] GET .*\/no-such-page$/, /Failed to load resource.*404/],
    { scope: 'test' },
  ],
});

test('an unknown address answers 404 with a Farsi, right-to-left page and a way home', async ({
  page,
  rtl,
  a11y,
}) => {
  const response = await page.goto('/no-such-page');
  expect(response?.status()).toBe(404);
  await rtl.expectDocumentRtl();
  await expect(page).toHaveTitle('صفحه پیدا نشد | کارشناس');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('این صفحه پیدا نشد');
  await rtl.expectPersianDigits(page.getByRole('main'));
  await rtl.expectNoHorizontalOverflow();
  await a11y.check();

  await page.getByRole('link', { name: 'صفحه‌ی اصلی' }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('ماشین درست را با قیمت درست بخرید');
});

test('the not-found page matches its baseline', { tag: '@visual' }, async ({ page }) => {
  await page.goto('/no-such-page');
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot('not-found.png');
});
