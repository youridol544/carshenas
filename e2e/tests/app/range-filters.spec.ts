import type { Locator, Page } from '@playwright/test';
import { expect, test } from '../../fixtures/test';
import { waitForHydration } from '../../gorilla/layout';

// The typed minimum and maximum of a range filter (CS-102): mileage first, the same control for price, model year and
// the engine volume. Two fields that read digits in any script and show Persian digits with separators, the steps as
// quick picks, a Farsi message for a wrong value that applies nothing, one removable chip, and the address that round-
// trips. On a desktop the rail applies at once; on a phone the sheet applies with its button.

const COPY = {
  filters: /^فیلترها/,
  sheetTitle: 'فیلترها',
  minimum: 'حداقل کارکرد',
  maximum: 'حداکثر کارکرد',
  chip: 'کارکرد ۱۰٬۰۰۰ تا ۶۰٬۰۰۰ کیلومتر',
  order: 'حداقل بیشتر از حداکثر است.',
  notNumber: 'فقط عدد بنویسید',
  outside: 'بین ۰ و ۹٬۹۹۹٬۹۹۹ باشد.',
} as const;

function isPhone(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) < 1024;
}

/** The filter controls: the rail on a desktop, the sheet on a phone, opened here with the mileage's group open. */
async function panel(page: Page): Promise<Locator> {
  const scope = isPhone(page)
    ? (await page.getByRole('button', { name: COPY.filters }).click(),
      page.getByRole('dialog', { name: COPY.sheetTitle }))
    : page.getByRole('complementary');
  const field = scope.getByRole('textbox', { name: COPY.minimum });
  if (!(await field.isVisible())) await scope.locator('summary', { hasText: 'خودرو' }).first().click();
  await expect(field).toBeVisible();
  return scope;
}

async function apply(page: Page, scope: Locator): Promise<void> {
  if (isPhone(page)) {
    await scope.getByRole('button', { name: /^نمایش\s.*\sآگهی/ }).click();
    await expect(scope).toBeHidden();
  }
}

test.describe('typed range filters', () => {
  test('a minimum and a maximum are typed in any digits, shown in Persian digits, and become one chip and the address', async ({
    page,
    rtl,
  }, testInfo) => {
    await page.goto('/search');
    await waitForHydration(page);
    const scope = await panel(page);
    const minimum = scope.getByRole('textbox', { name: COPY.minimum });
    const maximum = scope.getByRole('textbox', { name: COPY.maximum });
    await minimum.fill('۱۰۰۰۰');
    await maximum.fill('60,000');
    await maximum.press('Enter');
    await expect(minimum).toHaveValue('۱۰٬۰۰۰');
    await expect(maximum).toHaveValue('۶۰٬۰۰۰');
    await rtl.expectNoHorizontalOverflow();
    await page.screenshot({
      path: `../docs/evidence/range-filters/${testInfo.project.name}-typed.png`,
    });
    await apply(page, scope);
    await expect(page).toHaveURL(/km=10000\.\.60000/);
    const chips = page.getByRole('region', { name: 'فیلترهای فعال' });
    await expect(chips.getByRole('button', { name: new RegExp(`برداشتن «${COPY.chip}»`) })).toBeVisible();
    // The chip comes off, and so does the address's parameter.
    await chips.getByRole('button', { name: new RegExp(`برداشتن «${COPY.chip}»`) }).click();
    await expect(page).not.toHaveURL(/km=/);
  });

  test('the address round-trips into the fields, and a wrong value is said and applies nothing', async ({
    page,
  }) => {
    await page.goto('/search?km=10000..60000');
    await waitForHydration(page);
    const scope = await panel(page);
    const minimum = scope.getByRole('textbox', { name: COPY.minimum });
    const maximum = scope.getByRole('textbox', { name: COPY.maximum });
    await expect(minimum).toHaveValue('۱۰٬۰۰۰');
    await expect(maximum).toHaveValue('۶۰٬۰۰۰');
    // A minimum above the maximum.
    await minimum.fill('70000');
    await minimum.press('Enter');
    await expect(scope.getByText(COPY.order)).toBeVisible();
    await expect(minimum).toHaveAttribute('aria-invalid', 'true');
    // Not a number, and a number outside the bounds.
    await minimum.fill('abc');
    await minimum.press('Enter');
    await expect(scope.getByText(COPY.notNumber)).toBeVisible();
    await minimum.fill('99999999');
    await minimum.press('Enter');
    await expect(scope.getByText(COPY.outside)).toBeVisible();
    // Nothing was applied: the address is as it was.
    expect(new URL(page.url()).searchParams.get('km')).toBe('10000..60000');
  });

  test('a quick pick fills the maximum in one press and a second press takes it back', async ({ page }) => {
    await page.goto('/search');
    await waitForHydration(page);
    const scope = await panel(page);
    const group = scope.getByRole('group', { name: /پیشنهاد سریع: کارکرد/ });
    await group.getByRole('button', { name: 'تا ۶۰٬۰۰۰ کیلومتر' }).click();
    await expect(scope.getByRole('textbox', { name: COPY.maximum })).toHaveValue('۶۰٬۰۰۰');
    await expect(group.getByRole('button', { name: 'تا ۶۰٬۰۰۰ کیلومتر' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await apply(page, scope);
    await expect(page).toHaveURL(/km=\.\.60000/);
    const again = await panel(page);
    await again
      .getByRole('group', { name: /پیشنهاد سریع: کارکرد/ })
      .getByRole('button', { name: 'تا ۶۰٬۰۰۰ کیلومتر' })
      .click();
    await apply(page, again);
    await expect(page).not.toHaveURL(/km=/);
  });

  test('an invalid value changes no height: the message line is reserved, so nothing below moves', async ({
    page,
  }) => {
    await page.goto('/search');
    await waitForHydration(page);
    const scope = await panel(page);
    const control = scope.locator('[data-range-control="mileage"]');
    const before = (await control.boundingBox())?.height ?? 0;
    const minimum = scope.getByRole('textbox', { name: COPY.minimum });
    for (const typed of ['abc', '99999999999', '70000']) {
      await minimum.fill(typed);
      if (typed === '70000') await scope.getByRole('textbox', { name: COPY.maximum }).fill('1000');
      await minimum.press('Enter');
      await expect(scope.locator('[role="status"]').filter({ hasText: /./ }).first()).toBeVisible();
      expect((await control.boundingBox())?.height ?? 0).toBe(before);
    }
  });

  test('the same control types an engine volume range', async ({ page }) => {
    await page.goto('/search');
    await waitForHydration(page);
    const scope = isPhone(page)
      ? (await page.getByRole('button', { name: COPY.filters }).click(),
        page.getByRole('dialog', { name: COPY.sheetTitle }))
      : page.getByRole('complementary');
    const minimum = scope.getByRole('textbox', { name: 'حداقل حجم موتور' });
    if (!(await minimum.isVisible())) await scope.locator('summary', { hasText: 'خودرو' }).first().click();
    await minimum.fill('۱۴۰۰');
    await scope.getByRole('textbox', { name: 'حداکثر حجم موتور' }).fill('1800');
    await scope.getByRole('textbox', { name: 'حداکثر حجم موتور' }).press('Enter');
    await apply(page, scope);
    await expect(page).toHaveURL(/cc=1400\.\.1800/);
    await expect(
      page
        .getByRole('region', { name: 'فیلترهای فعال' })
        .getByRole('button', { name: /حجم موتور ۱٬۴۰۰ تا ۱٬۸۰۰ سی‌سی/ }),
    ).toBeVisible();
  });
});
