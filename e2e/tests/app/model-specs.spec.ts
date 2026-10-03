import type { Locator, Page, TestInfo } from '@playwright/test';
import { superadminFor } from '../../fixtures/accounts';
import { removeModel, seedModel } from '../../fixtures/crawl-requests';
import { inheritedBy, seedSpecListing, seedTrim, specChangesOf, specOf } from '../../fixtures/model-specs';
import { seedModelListings } from '../../fixtures/tracked-models';
import { expect, test } from '../../fixtures/test';
import { waitForHydration } from '../../gorilla/layout';
import { signIn } from '../../fixtures/accounts';

// Engine volume and origin (CS-99, ADR-0039): the superadmin sets, changes and removes them for a model and for a trim
// from the tracked-models screen, finds a model nobody lists by its name, and every change is recorded with who made it.
// Each test makes a catalogue model of its own (and a trim) and removes it afterwards. Nothing here reaches a listing site.

const COPY = {
  heading: 'حجم موتور و مبدأ مدل‌ها',
  save: 'ذخیره',
  clear: 'برداشتن مقدارها',
  volume: 'حجم موتور (سی‌سی)',
  origin: 'مبدأ',
  imported: 'وارداتی',
  domestic: 'ایرانی',
  unknown: 'نامشخص',
  saved: 'ذخیره شد',
  removed: 'برداشته شد',
  missingBadge: 'ناقص',
  search: 'جست‌وجوی مدل در فهرست',
  notNumber: 'حجم را فقط با رقم بنویسید',
  range: 'حجم موتور باید از',
  empty: 'حجم یا مبدأ را بگذارید',
  noListings: 'بدون آگهی فعال',
} as const;

const SHOTS = process.env.CS99_SHOTS;

async function shot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  if (SHOTS === undefined || SHOTS === '') return;
  await page.screenshot({ path: `${SHOTS}/${name}-${testInfo.project.name}.png`, fullPage: false });
}

function searchWord(nameFa: string): string {
  return nameFa.split(' ').at(-1) ?? nameFa;
}

async function openSpecs(page: Page, testInfo: TestInfo, nameFa: string): Promise<Locator> {
  const { username, password } = superadminFor(testInfo.workerIndex);
  await page.goto('/sign-in');
  await signIn(page, username, password);
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto(`/admin/tracked-models?s=${encodeURIComponent(searchWord(nameFa))}`);
  await waitForHydration(page);
  return page.locator('[data-spec-model]').filter({ hasText: nameFa });
}

test.describe('engine volume and origin', () => {
  test("the superadmin sets, changes and removes a model's volume and origin, and each change is recorded", async ({
    page,
    a11y,
    rtl,
  }, testInfo) => {
    const model = await seedModel('موتور');
    try {
      // Three active listings that state no volume: the model misses both values.
      await seedModelListings(model, { unread: 2, read: 1 });
      const admin = superadminFor(testInfo.workerIndex).username;
      const card = await openSpecs(page, testInfo, model.nameFa);
      await expect(page.getByRole('heading', { name: COPY.heading })).toBeVisible();
      await expect(page.locator('[data-spec-coverage]')).toBeVisible();
      await expect(card).toHaveCount(1);
      await expect(card).toHaveAttribute('data-spec-missing', 'yes');
      await expect(card).toContainText(COPY.missingBadge);
      await expect(card.locator('[data-fact="volume"]')).toContainText(COPY.unknown);
      await expect(card.locator('[data-fact="listings"]')).toContainText('۳ آگهی فعال');
      await expect(card.locator('[data-spec-covered]')).toContainText('۰ از ۳ آگهی');
      await rtl.expectNoHorizontalOverflow();
      await a11y.check();
      await shot(page, testInfo, '1-missing');

      const form = card.locator('[data-spec-form][data-spec-scope="model"]');
      const volume = form.getByRole('textbox', { name: COPY.volume });
      // A volume that is not a number or outside 500 to 9,000 is said early and cannot be saved.
      await volume.fill('abc');
      await expect(form).toContainText(COPY.notNumber);
      await expect(form.getByRole('button', { name: new RegExp(`^${COPY.save}`) })).toBeDisabled();
      await volume.fill('۱۲');
      await expect(form).toContainText(COPY.range);
      await expect(form.getByRole('button', { name: new RegExp(`^${COPY.save}`) })).toBeDisabled();
      await shot(page, testInfo, '2-problem');

      // Persian digits are read; the origin is a list.
      await volume.fill('۲۰۰۰');
      await form
        .getByRole('combobox', { name: new RegExp(`^${COPY.origin}`) })
        .selectOption({ label: COPY.imported });
      await form.getByRole('button', { name: new RegExp(`^${COPY.save}`) }).click();
      await expect(form.getByRole('status').last()).toContainText(COPY.saved);
      await expect(card.locator('[data-fact="volume"]')).toContainText('۲٬۰۰۰ سی‌سی');
      await expect(card.locator('[data-fact="origin"]')).toContainText(COPY.imported);
      // The form keeps showing what was saved (React resets a form after its action).
      await expect(form.getByRole('combobox', { name: new RegExp(`^${COPY.origin}`) })).toHaveValue(
        'imported',
      );
      await expect(card.locator('[data-spec-covered]')).toContainText('۳ از ۳ آگهی');
      await expect(card).toHaveAttribute('data-spec-missing', 'no');
      expect(await specOf(model)).toEqual({
        volumeCc: 2000,
        origin: 'imported',
        source: 'superadmin',
        setBy: admin,
      });
      await expect(card.locator('[data-spec-source]')).toContainText(admin);
      await rtl.expectNoHorizontalOverflow();
      await a11y.check();
      await shot(page, testInfo, '3-saved');
    } finally {
      await removeModel(model, []);
    }
  });

  test('a saved spec is changed and removed, the card goes back to unknown, and the record keeps every state', async ({
    page,
    a11y,
    rtl,
  }, testInfo) => {
    const model = await seedModel('تغییر');
    try {
      await seedModelListings(model, { unread: 1, read: 1 });
      const admin = superadminFor(testInfo.workerIndex).username;
      const card = await openSpecs(page, testInfo, model.nameFa);
      const form = card.locator('[data-spec-form][data-spec-scope="model"]');
      const volume = form.getByRole('textbox', { name: COPY.volume });
      await volume.fill('2000');
      await form
        .getByRole('combobox', { name: new RegExp(`^${COPY.origin}`) })
        .selectOption({ label: COPY.imported });
      await form.getByRole('button', { name: new RegExp(`^${COPY.save}`) }).click();
      await expect(card.locator('[data-fact="volume"]')).toContainText('۲٬۰۰۰ سی‌سی');
      // Change both; the database function says it changed.
      await volume.fill('1600');
      await form
        .getByRole('combobox', { name: new RegExp(`^${COPY.origin}`) })
        .selectOption({ label: COPY.domestic });
      await form.getByRole('button', { name: new RegExp(`^${COPY.save}`) }).click();
      await expect(card.locator('[data-fact="volume"]')).toContainText('۱٬۶۰۰ سی‌سی');
      await expect(card.locator('[data-fact="origin"]')).toContainText(COPY.domestic);
      expect(await specOf(model)).toMatchObject({ volumeCc: 1600, origin: 'domestic' });

      // Removing is the state «nothing»: the card goes back to unknown, and the record keeps what was there.
      await form.getByRole('button', { name: new RegExp(`^${COPY.clear}`) }).click();
      await expect(card.locator('[data-fact="volume"]')).toContainText(COPY.unknown);
      await expect(card).toHaveAttribute('data-spec-missing', 'yes');
      await expect(volume).toHaveValue('');
      expect(await specOf(model)).toBeNull();
      expect(await specChangesOf(model)).toEqual([
        { action: 'added', by: admin, toVolumeCc: 2000, toOrigin: 'imported' },
        { action: 'changed', by: admin, toVolumeCc: 1600, toOrigin: 'domestic' },
        { action: 'removed', by: admin, toVolumeCc: null, toOrigin: null },
      ]);
      // The latest changes are on the card with their authors.
      await card.getByText('تغییرها', { exact: true }).click();
      await expect(card.locator('details').last()).toContainText(admin);
      await expect(card.locator('details').last()).toContainText('برداشته شد');
      await rtl.expectNoHorizontalOverflow();
      await a11y.check();
      await shot(page, testInfo, '4-removed-history');
    } finally {
      await removeModel(model, []);
    }
  });

  test("a trim has its own volume that beats the model's, a listing's own volume beats both, and a removed trim row falls back to the model", async ({
    page,
    rtl,
  }, testInfo) => {
    const model = await seedModel('تیپ');
    try {
      const trim = await seedTrim(model);
      const viaTrim = await seedSpecListing(model, { trim });
      const viaModel = await seedSpecListing(model);
      const own = await seedSpecListing(model, { trim, ownVolumeCc: 1830 });
      const card = await openSpecs(page, testInfo, model.nameFa);
      const modelForm = card.locator('[data-spec-form][data-spec-scope="model"]');
      await modelForm.getByRole('textbox', { name: COPY.volume }).fill('1800');
      await modelForm
        .getByRole('combobox', { name: new RegExp(`^${COPY.origin}`) })
        .selectOption({ label: COPY.imported });
      await modelForm.getByRole('button', { name: new RegExp(`^${COPY.save}`) }).click();
      await expect(card.locator('[data-fact="volume"]')).toContainText('۱٬۸۰۰ سی‌سی');
      expect(await inheritedBy(viaModel)).toEqual({ volumeCc: 1800, origin: 'imported' });
      expect(await inheritedBy(viaTrim)).toEqual({ volumeCc: 1800, origin: 'imported' });

      // The trim's row: it says what it inherits while empty, and its volume beats the model's.
      await card.locator('[data-spec-trims] summary').click();
      const trimRow = card.locator(`[data-spec-trim="${String(trim.id)}"]`);
      await expect(trimRow).toContainText(trim.nameFa);
      await expect(trimRow).toContainText('اگر خالی بماند، مقدار مدل می‌رسد');
      const trimForm = trimRow.locator('[data-spec-form]');
      await trimForm.getByRole('textbox', { name: COPY.volume }).fill('2000');
      await trimForm.getByRole('button', { name: new RegExp(`^${COPY.save}`) }).click();
      await expect(trimRow).toHaveAttribute('data-spec-trim-saved', 'yes');
      await expect(trimRow.getByRole('status').last()).toContainText(COPY.saved);
      expect(await specOf(model, trim)).toMatchObject({ volumeCc: 2000, origin: null, source: 'superadmin' });
      // The trim's volume, the model's origin; the listing's own volume beats both; another listing keeps the model's.
      expect(await inheritedBy(viaTrim)).toEqual({ volumeCc: 2000, origin: 'imported' });
      expect(await inheritedBy(own)).toEqual({ volumeCc: 1830, origin: 'imported' });
      // The model's trims now differ from its volume: a listing that names no trim has no known volume.
      expect(await inheritedBy(viaModel)).toEqual({ volumeCc: null, origin: 'imported' });
      await rtl.expectNoHorizontalOverflow();
      await shot(page, testInfo, '5-trim');

      await trimForm.getByRole('button', { name: new RegExp(`^${COPY.clear}`) }).click();
      await expect(trimRow).toHaveAttribute('data-spec-trim-saved', 'no');
      expect(await specOf(model, trim)).toBeNull();
      expect(await inheritedBy(viaTrim)).toEqual({ volumeCc: 1800, origin: 'imported' });
    } finally {
      await removeModel(model, []);
    }
  });

  test('a model nobody lists is found by its name and takes an origin alone; empty values are refused', async ({
    page,
    rtl,
  }, testInfo) => {
    const model = await seedModel('بی‌آگهی');
    try {
      const card = await openSpecs(page, testInfo, model.nameFa);
      await expect(card).toHaveCount(1);
      await expect(card).toContainText(COPY.noListings);
      await expect(card).toHaveAttribute('data-spec-missing', 'no');
      const form = card.locator('[data-spec-form][data-spec-scope="model"]');
      // Nothing typed: the save press is disabled, so an empty form cannot be sent.
      await expect(form.getByRole('button', { name: new RegExp(`^${COPY.save}`) })).toBeDisabled();
      await form
        .getByRole('combobox', { name: new RegExp(`^${COPY.origin}`) })
        .selectOption({ label: COPY.domestic });
      await form.getByRole('button', { name: new RegExp(`^${COPY.save}`) }).click();
      await expect(card.locator('[data-fact="origin"]')).toContainText(COPY.domestic);
      expect(await specOf(model)).toEqual({
        volumeCc: null,
        origin: 'domestic',
        source: 'superadmin',
        setBy: superadminFor(testInfo.workerIndex).username,
      });
      await rtl.expectNoHorizontalOverflow();
    } finally {
      await removeModel(model, []);
    }
  });

  test('the listing page and the model page show the volume and origin, and say where the volume comes from', async ({
    page,
    rtl,
  }, testInfo) => {
    const model = await seedModel('صفحه');
    try {
      const trim = await seedTrim(model);
      const viaModel = await seedSpecListing(model);
      const own = await seedSpecListing(model, { trim, ownVolumeCc: 1830 });
      const { username, password } = superadminFor(testInfo.workerIndex);
      await page.goto('/sign-in');
      await signIn(page, username, password);
      await expect(page).toHaveURL(/\/admin$/);
      await page.goto(`/admin/tracked-models?s=${encodeURIComponent(searchWord(model.nameFa))}`);
      await waitForHydration(page);
      const card = page.locator('[data-spec-model]').filter({ hasText: model.nameFa });
      const form = card.locator('[data-spec-form][data-spec-scope="model"]');
      await form.getByRole('textbox', { name: COPY.volume }).fill('1600');
      await form
        .getByRole('combobox', { name: new RegExp(`^${COPY.origin}`) })
        .selectOption({ label: COPY.domestic });
      await form.getByRole('button', { name: new RegExp(`^${COPY.save}`) }).click();
      await expect(card.locator('[data-fact="volume"]')).toContainText('۱٬۶۰۰ سی‌سی');

      await page.goto(`/listings/${String(viaModel)}`);
      const facts = page.locator('#facts-title').locator('..');
      await expect(facts).toContainText('حجم موتور');
      await expect(facts).toContainText('۱٬۶۰۰ سی‌سی (طبق مشخصات مدل)');
      await expect(facts).toContainText(COPY.domestic);
      await rtl.expectNoHorizontalOverflow();
      await shot(page, testInfo, '6-listing-page');
      await page.goto(`/listings/${String(own)}`);
      await expect(page.locator('#facts-title').locator('..')).toContainText('۱٬۸۳۰ سی‌سی (طبق عنوان آگهی)');

      await page.goto(`/models/${model.makeSlug}/${model.modelSlug}`);
      await expect(page.locator('[data-model-volume]')).toHaveText('۱٬۶۰۰ سی‌سی');
      await expect(page.locator('[data-model-origin]')).toHaveText(COPY.domestic);
      await rtl.expectNoHorizontalOverflow();
      await shot(page, testInfo, '7-model-page');
    } finally {
      await removeModel(model, []);
    }
  });

  test('a search that finds nothing says so', async ({ page }, testInfo) => {
    await openSpecs(page, testInfo, 'zzzz');
    await page.goto(`/admin/tracked-models?s=${encodeURIComponent('qqqqqq')}`);
    await expect(page.locator('[data-model-specs]')).toContainText('پیدا نشد');
    await expect(page.getByRole('search', { name: COPY.search })).toBeVisible();
  });
});
