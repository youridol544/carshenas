import { expect, test } from '../../fixtures/test';

// Runs against the bundled fixture site, a mock listings page independent of the app. It proves the harness:
// fa-IR locale, Tehran time, RTL, Persian digits, network, interaction, accessibility, both viewports.

test.describe('fixture listings page', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-09-17T08:00:00Z'));
    await page.goto('/');
    await expect(page.getByRole('status')).toHaveText('۴ آگهی');
  });

  test('is a Farsi right-to-left document without horizontal scroll', async ({ rtl }) => {
    await rtl.expectDocumentRtl();
    await rtl.expectNoHorizontalOverflow();
  });

  test('renders Persian digits and today in the Jalali calendar', async ({ page, rtl }) => {
    await rtl.expectPersianDigits(page.getByRole('list', { name: 'فهرست آگهی‌ها' }));
    await expect(page.getByRole('time')).toHaveText('۲۶ شهریور ۱۴۰۵');
  });

  test('mirrors the header: logo on the right, saved listings on the left', async ({ page, rtl }) => {
    await rtl.expectInlineOrder(
      page.getByRole('link', { name: 'کارشناس' }),
      page.getByRole('button', { name: /نشان‌شده‌ها/ }),
    );
  });

  test('shows two listing columns on phones and four on desktop', async ({ page, isMobile }) => {
    const columns = await page
      .getByRole('list', { name: 'فهرست آگهی‌ها' })
      .evaluate((list) => getComputedStyle(list).gridTemplateColumns.split(' ').length);
    expect(columns).toBe(isMobile ? 2 : 4);
  });

  test('saves a listing and announces it', async ({ page }) => {
    await page.getByRole('button', { name: 'نشان کردن پژو پارس' }).click();
    await expect(page.getByRole('button', { name: 'نشان‌شده‌ها، ۱ آگهی' })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('نشان شد');
  });

  test('has no detectable accessibility violations', async ({ a11y }) => {
    await a11y.check();
  });
});
