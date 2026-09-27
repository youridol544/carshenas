import { expect, test } from '../../fixtures/test';
import { inspectLayout } from '../../gorilla/layout';

// The design-language sample page (/design): the licensed typeface actually renders, every number the formatters
// produce is in Persian digits, left-to-right runs keep their order inside Persian text, and the page holds up
// on a phone. Its visual baseline is made in the official Playwright container (pnpm e2e:visual).

test.beforeEach(async ({ page }) => {
  await page.goto('/design');
  await page.evaluate(() => document.fonts.ready);
});

test('renders right to left in the self-hosted typeface, not a system fallback', async ({ page, rtl }) => {
  await rtl.expectDocumentRtl();
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toHaveText('زبان طراحی کارشناس');
  const typeface = await heading.evaluate((element) => {
    const family = getComputedStyle(element).fontFamily.split(',')[0]?.trim() ?? '';
    const face = [...document.fonts].find((f) => `"${f.family}"` === family || f.family === family);
    return {
      family,
      status: face?.status,
      renders: document.fonts.check(`700 24px ${family}`, 'کارشناس'),
    };
  });
  expect(typeface.status, `the first family is ${typeface.family}`).toBe('loaded');
  expect(typeface.renders).toBe(true);
});

test('prints every amount, count and date in Persian digits', async ({ page, rtl }) => {
  const formats = page.getByRole('region', { name: 'مبلغ‌ها، اعداد و تاریخ‌ها' }).getByRole('definition');
  await expect(formats.first()).toHaveText('۱٬۲۵۰٬۰۰۰٬۰۰۰ تومان');
  await rtl.expectPersianDigits(formats);
  await rtl.expectPersianDigits(page.getByRole('region', { name: 'نمونهٔ آگهی' }));
});

test('shows every percent sign to the left of its number, where Persian reads it', async ({ page }) => {
  await expect(page.getByText('۸\u200F٪ زیر ارزش بازار').first()).toBeVisible();
  expect((await inspectLayout(page)).misorderedSigns).toEqual([]);
});

test('keeps left-to-right runs whole inside Persian text', async ({ page }) => {
  const samples = page.getByRole('region', { name: 'متن چپ‌به‌راست درون متن فارسی' });
  const vin = samples.getByText('NAAM01CE9KR123456');
  await expect(vin).toHaveAttribute('dir', 'ltr');
  // The label comes first in reading order, so in RTL it sits to the right of the VIN.
  const label = await samples
    .getByRole('listitem')
    .first()
    .evaluate((item) => {
      const range = document.createRange();
      const textNode = item.firstChild;
      if (!textNode) return null;
      range.selectNodeContents(textNode);
      return range.getBoundingClientRect().x;
    });
  const vinBox = await vin.boundingBox();
  expect(label).not.toBeNull();
  expect(vinBox).not.toBeNull();
  expect(label ?? 0).toBeGreaterThan(vinBox?.x ?? 0);
});

test('fits a phone without sideways scroll and passes axe', async ({ page, rtl, a11y }) => {
  for (const width of [320, 412]) {
    await page.setViewportSize({ width, height: 900 });
    await rtl.expectNoHorizontalOverflow();
  }
  await a11y.check();
});

test('matches its baseline', { tag: '@visual' }, async ({ page }) => {
  await expect(page).toHaveScreenshot('design.png', { fullPage: true });
});
