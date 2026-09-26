import { expect, test } from '../../fixtures/test';

// The floor every screen of the real application must clear: Farsi, right-to-left, no sideways scroll,
// accessible, quiet console (the shared fixtures fail the test on console errors and failed requests).

test.describe('home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('is a Farsi right-to-left document named for the product', async ({ page, rtl }) => {
    await rtl.expectDocumentRtl();
    await expect(page).toHaveTitle('کارشناس');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('کارشناس');
  });

  test('fits the viewport without horizontal scroll', async ({ rtl }) => {
    await rtl.expectNoHorizontalOverflow();
  });

  test('has no detectable accessibility violations', async ({ a11y }) => {
    await a11y.check();
  });
});
