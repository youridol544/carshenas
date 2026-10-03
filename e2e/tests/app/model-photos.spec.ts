import type { Page, TestInfo } from '@playwright/test';
import { newPassword, signIn, signUp, superadminFor, uniqueUsername } from '../../fixtures/accounts';
import { photoChangesOf, photoLinkOf, removePhotoLink } from '../../fixtures/model-photos';
import { expect, test } from '../../fixtures/test';
import { waitForHydration } from '../../gorilla/layout';

// Model photos (CS-97, ADR-0038): the superadmin gives a popular model an https image link; the home page's tiles and
// the models index show that photo (from its own host, no referrer, never stored by us) and keep the «نمونه» label for
// the body type's sample only; a photo that stops loading falls back to the sample without the tile changing size. The
// photo host is a made-up one answered by the fixture (fixtures/source-photos.ts), so no test reaches a real site.
// The test uses the first popular model the index has and removes its link afterwards.

const COPY = {
  title: 'عکس مدل‌های پرطرفدار',
  field: 'نشانی عکس',
  save: 'ذخیره‌ی عکس',
  replace: 'جایگزین کردن عکس',
  clear: 'برداشتن عکس',
  saved: 'ذخیره شد',
  cleared: 'برداشته شد',
  sample: 'عکس نمونه',
  notFound: 'این صفحه پیدا نشد',
} as const;

const GOOD = 'https://e2e-model-photos.cars-cdn.ir/pars-front.png';
const BROKEN = 'https://e2e-model-photos.cars-cdn.ir/broken-pars.png';

const SHOTS = process.env.CS97_SHOTS;

async function shot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  if (SHOTS === undefined || SHOTS === '') return;
  await page.screenshot({ path: `${SHOTS}/${name}-${testInfo.project.name}.png`, fullPage: false });
}

test.describe('model photos', () => {
  // The photo that "does not load" is a 404 on purpose.
  test.use({
    ignoreBrowserErrors: [[/broken-pars|pars-front/, /Failed to load resource.*404/], { scope: 'test' }],
  });

  test('the superadmin sets a photo from a preview, the tiles show it with no sample label, a dead photo falls back without a jump, and it can be removed', async ({
    page,
    a11y,
    rtl,
  }, testInfo) => {
    const { username, password } = superadminFor(testInfo.workerIndex);
    await page.goto('/sign-in');
    await signIn(page, username, password);
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto('/admin/model-photos');
    await waitForHydration(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(COPY.title);
    const rows = page.locator('[data-photo-model]');
    test.skip((await rows.count()) < 2, 'the index has no popular model to give a photo');
    // Each project takes its own model, so the two run side by side.
    const row = rows.nth(testInfo.project.name === 'desktop' ? 1 : 0);
    const key = (await row.getAttribute('data-photo-model')) ?? '';
    const [makeSlug = '', modelSlug = ''] = key.split('.');
    try {
      await expect(row).toHaveAttribute('data-photo-saved', 'no');
      const input = row.getByRole('textbox', { name: new RegExp(COPY.field) });
      const save = row.getByRole('button', { name: new RegExp(`^${COPY.save}`) });

      // A bad address is told at once and cannot be saved; so is one whose picture does not load.
      await input.fill('http://cdn.cars-cdn.ir/a.jpg');
      await expect(row).toContainText('https://');
      await expect(save).toBeDisabled();
      await input.fill(BROKEN);
      await expect(row.locator('[data-photo-preview="failed"]')).toBeVisible();
      await expect(save).toBeDisabled();
      await expect(row).toContainText('تا بارگذاری نشود ذخیره نمی‌شود');

      // A good one previews, and only then saves.
      await input.fill(GOOD);
      await expect(row.locator('[data-photo-preview="loaded"]')).toBeVisible();
      await expect(save).toBeEnabled();
      await rtl.expectNoHorizontalOverflow();
      await a11y.check();
      await shot(page, testInfo, '1-preview');
      await save.click();
      await expect(row.getByRole('status').last()).toContainText(COPY.saved);
      await expect(row).toHaveAttribute('data-photo-saved', 'yes');
      await expect(row.locator('[data-photo-origin]')).toContainText(username);
      expect(await photoLinkOf(makeSlug, modelSlug)).toEqual({ url: GOOD, setBy: username });
      await shot(page, testInfo, '2-saved');

      // The home page's tile shows the model's photo from its own address, with no referrer, and no sample label.
      await page.goto('/');
      const tile = page.locator(`[data-model-tile="${key}"]`).first();
      const photo = tile.locator('[data-model-photo="remote"] img');
      await expect(photo).toHaveAttribute('src', GOOD);
      await expect(photo).toHaveAttribute('referrerpolicy', 'no-referrer');
      await expect(tile.locator('[data-sample-label]')).toHaveCount(0);
      await expect
        .poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth))
        .toBeGreaterThan(0);
      const withPhoto = await tile.boundingBox();
      await shot(page, testInfo, '3-home-tile');

      // The same on the models index.
      await page.goto('/models');
      await expect(
        page.locator(`[data-model-tile="${key}"]`).first().locator('[data-model-photo="remote"] img'),
      ).toHaveAttribute('src', GOOD);

      // The photo stops loading (its host removed it): the sample comes back with its label and the tile keeps its size.
      await page.route(GOOD, (route) => route.fulfill({ status: 404, body: 'gone' }));
      await page.goto('/');
      const fallen = page.locator(`[data-model-tile="${key}"]`).first();
      await expect(fallen.locator('[data-sample-label]')).toHaveText(COPY.sample);
      await expect(fallen.locator('[data-model-photo="remote"]')).toHaveCount(0);
      const without = await fallen.boundingBox();
      expect(Math.abs((without?.height ?? 0) - (withPhoto?.height ?? 1))).toBeLessThan(1);
      expect(Math.abs((without?.width ?? 0) - (withPhoto?.width ?? 1))).toBeLessThan(1);
      await shot(page, testInfo, '4-home-fallback');
      await page.unroute(GOOD);

      // Removing it brings the sample back everywhere.
      await page.goto('/admin/model-photos');
      await waitForHydration(page);
      const again = page.locator(`[data-photo-model="${key}"]`);
      await again.getByRole('button', { name: new RegExp(`^${COPY.clear}`) }).click();
      await expect(again.getByRole('status').last()).toContainText(COPY.cleared);
      await expect(again).toHaveAttribute('data-photo-saved', 'no');
      expect(await photoLinkOf(makeSlug, modelSlug)).toBeNull();
      expect((await photoChangesOf(makeSlug, modelSlug)).map((change) => change.action)).toEqual([
        'set',
        'cleared',
      ]);
      await page.goto('/');
      await expect(
        page.locator(`[data-model-tile="${key}"]`).first().locator('[data-sample-label]'),
      ).toHaveText(COPY.sample);
    } finally {
      await removePhotoLink(makeSlug, modelSlug);
    }
  });

  test('the dashboard links to the screen', async ({ page }, testInfo) => {
    const { username, password } = superadminFor(testInfo.workerIndex);
    await page.goto('/sign-in');
    await signIn(page, username, password);
    await expect(page).toHaveURL(/\/admin$/);
    await page.getByRole('link', { name: COPY.title }).click();
    await expect(page).toHaveURL(/\/admin\/model-photos$/);
  });
});

test.describe('everyone else', () => {
  test.use({
    ignoreBrowserErrors: [
      [/\[http 404\] GET .*\/admin\/model-photos/, /Failed to load resource.*404/],
      { scope: 'test' },
    ],
  });

  test('gets a real 404 from the screen, as a visitor and as a buyer', async ({ page, request }) => {
    const visitorRequest = await request.get('/admin/model-photos', { maxRedirects: 0 });
    expect(visitorRequest.status()).toBe(404);
    const visitor = await page.goto('/admin/model-photos');
    expect(visitor?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(COPY.notFound);
    await signUp(page, uniqueUsername(), newPassword());
    const buyer = await page.goto('/admin/model-photos');
    expect(buyer?.status()).toBe(404);
  });
});
