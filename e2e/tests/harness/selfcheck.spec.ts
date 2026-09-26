import { expect, test } from '../../fixtures/test';

// Harness self-check: `pnpm selfcheck` must exit non-zero and leave a trace, a screenshot and an HTML report.
test.skip(!process.env.E2E_SELFCHECK_FAIL, 'only runs through `pnpm selfcheck`');

test('fails on purpose to prove failure artifacts', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('this text is not on the page', {
    timeout: 1_000,
  });
});

test('console guard fails a test whose page logs an error', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => console.error('selfcheck: deliberate console error'));
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
