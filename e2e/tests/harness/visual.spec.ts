import { expect, test } from '../../fixtures/test';

// Screenshot comparisons only run with E2E_VISUAL=1, and baselines are only ever produced inside the
// official Playwright container (pnpm test:visual:update) so fonts and rasterisation are identical in CI.

test('listings page matches the baseline', { tag: '@visual' }, async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-17T08:00:00Z'));
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveText('۴ آگهی');
  await expect(page).toHaveScreenshot('listings.png', { fullPage: true });
});
