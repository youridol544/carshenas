import type { Page } from '@playwright/test';
import { APP_PAGES } from '../../fixtures/app-pages';
import {
  measureButtonCentring,
  measureControlCentring,
  type ButtonCentring,
} from '../../fixtures/button-centring';
import { expect, test } from '../../fixtures/test';
import { waitForHydration } from '../../gorilla/layout';

// The label of a button sits in the middle of it, in every state (owner's feedback of 2026-10-04: «بفهم» and «ارزیابی
// قیمت» leaned to the right, because the pending indicator kept a slot of its own beside the label). The pending
// indicator is an overlay in the button's padding (Spinner), so it can never move the label. The sample page
// (/design/buttons) holds every level in every state; the real buttons are measured where the owner saw the fault, and
// every centred action on every page of the app is measured too. The two projects are the two widths: 412 px and 1440 px.
// Within one pixel: a Persian label's own box has a pixel of side bearing.

const TOLERANCE = 1;
const STATES = ['آماده', 'در حال انجام', 'غیرفعال'] as const;
const LEVELS = ['کنش اصلی', 'کنش دوم', 'کنش سوم'] as const;

async function spinnersAllShowing(page: Page, pending: number): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const spinners = [...document.querySelectorAll('[data-pending] > [data-spinner]')];
          return `${String(spinners.length)}:${String(spinners.every((spinner) => getComputedStyle(spinner).opacity === '1'))}`;
        }),
      { message: 'the pending buttons show their spinner after the pending delay' },
    )
    .toBe(`${String(pending)}:true`);
}

/** The rows of the sample page, by level and then by state, each in the order the page shows them. */
async function sampleRows(page: Page): Promise<Map<string, Map<string, ButtonCentring[]>>> {
  const rows = await measureButtonCentring(page, { selector: 'main button' });
  const byLevel = new Map<string, Map<string, ButtonCentring[]>>();
  for (const row of rows) {
    const [level = '', state = ''] = row.group.split('، ');
    const states = byLevel.get(level) ?? new Map<string, ButtonCentring[]>();
    states.set(state, [...(states.get(state) ?? []), row]);
    byLevel.set(level, states);
  }
  return byLevel;
}

test.describe('the shared button', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/design/buttons');
    await expect(page.getByRole('heading', { level: 1, name: 'حالت‌های دکمه' })).toBeVisible();
    // the pending samples of the three levels: five primary, five secondary, four tertiary (a link-like action never stretches)
    await spinnersAllShowing(page, 14);
  });

  test('keeps its label in the middle of it when idle, pending and disabled, at every level', async ({
    page,
  }) => {
    const rows = await measureButtonCentring(page, { selector: 'main button' });
    // three levels, three states: five samples of the primary and the secondary, four of the tertiary
    expect(rows).toHaveLength(3 * 5 + 3 * 5 + 3 * 4);
    for (const row of rows) {
      expect(
        Math.abs(row.offset),
        `${row.group}: «${row.name}» is ${String(row.offset)} px off`,
      ).toBeLessThanOrEqual(TOLERANCE);
    }
  });

  test('keeps its size and the place of its label from one state to the next', async ({ page }) => {
    const byLevel = await sampleRows(page);
    expect([...byLevel.keys()]).toEqual([...LEVELS]);
    for (const [level, states] of byLevel) {
      const idle = states.get(STATES[0]) ?? [];
      expect(idle.length, level).toBeGreaterThan(3);
      for (const state of STATES.slice(1)) {
        const other = states.get(state) ?? [];
        expect(other.length, `${level}, ${state}`).toBe(idle.length);
        idle.forEach((row, index) => {
          const same = other[index];
          expect(same, `${level}, ${state}`).toBeDefined();
          const where = `${level}: «${row.name}» when ${state}`;
          expect(same?.width, `${where}: the button's width`).toBeCloseTo(row.width, 0);
          expect(same?.contentLeft, `${where}: the label's place`).toBeCloseTo(row.contentLeft, 0);
          expect(same?.contentRight, `${where}: the label's place`).toBeCloseTo(row.contentRight, 0);
        });
      }
    }
  });

  test('has nothing for an accessibility scan to find, in any state', async ({ a11y }) => {
    await a11y.check();
  });

  test('keeps the pending spinner clear of the label, in the padding at the end of the button', async ({
    page,
  }) => {
    const byLevel = await sampleRows(page);
    let checked = 0;
    for (const [level, states] of byLevel) {
      for (const row of states.get('در حال انجام') ?? []) {
        checked += 1;
        // the page is right to left: the spinner is at the left end, the label starts to its right
        expect(row.spinnerGap, `${level}: «${row.name}» has its spinner showing`).not.toBeNull();
        expect(
          row.spinnerGap ?? 0,
          `${level}: «${row.name}» keeps 8 px from its spinner`,
        ).toBeGreaterThanOrEqual(7.5);
      }
    }
    expect(checked).toBe(14);
  });
});

test.describe('the buttons where the fault was seen', () => {
  test('«بفهم» on the home page is centred, idle and while it reads the sentence', async ({ page }) => {
    await page.goto('/');
    await waitForHydration(page);
    const button = page.getByRole('button', { name: 'بفهم', exact: true });
    await expect(button).toBeVisible();
    expect(Math.abs((await measureControlCentring(button)).offset)).toBeLessThanOrEqual(TOLERANCE);

    // hold the answer, so the button stays pending for as long as the measurement takes
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/search/understand', async (route) => {
      await held;
      await route.continue();
    });
    await page.getByRole('searchbox').fill('پژو ۲۰۶ تیپ ۲ زیر ۷۰۰ میلیون');
    await button.click();
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await expect
      .poll(() =>
        button.evaluate(
          (element) => getComputedStyle(element.querySelector('[data-spinner]') ?? element).opacity,
        ),
      )
      .toBe('1');
    const pending = await measureControlCentring(button);
    expect(
      Math.abs(pending.offset),
      `the pending button's label is ${String(pending.offset)} px off`,
    ).toBeLessThanOrEqual(TOLERANCE);
    expect(pending.spinnerGap ?? 0).toBeGreaterThanOrEqual(7.5);
    release();
  });

  test('«ارزیابی قیمت» on the check page is centred, idle and while it looks the listing up', async ({
    page,
  }) => {
    await page.goto('/check');
    await waitForHydration(page);
    const button = page.getByRole('button', { name: 'ارزیابی قیمت', exact: true });
    await expect(button).toBeVisible();
    expect(Math.abs((await measureControlCentring(button)).offset)).toBeLessThanOrEqual(TOLERANCE);

    // The answer never comes: the request is held and never sent on, so the lookup leaves nothing behind in the data.
    await page.route(
      (url) => url.pathname === '/check' && url.searchParams.has('link'),
      () => new Promise<void>(() => undefined),
    );
    await page
      .getByRole('textbox', { name: 'لینک آگهی را بچسبانید' })
      .fill('https://divar.ir/v/e2e-button-label');
    await button.click();
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await expect
      .poll(() =>
        button.evaluate(
          (element) => getComputedStyle(element.querySelector('[data-spinner]') ?? element).opacity,
        ),
      )
      .toBe('1');
    const pending = await measureControlCentring(button);
    expect(
      Math.abs(pending.offset),
      `the pending button's label is ${String(pending.offset)} px off`,
    ).toBeLessThanOrEqual(TOLERANCE);
    expect(pending.spinnerGap ?? 0).toBeGreaterThanOrEqual(7.5);
  });
});

test.describe('every centred action in the product', () => {
  for (const entry of APP_PAGES) {
    test(`on ${entry.name} the label of each is in the middle`, async ({ page }) => {
      await page.goto(entry.path);
      await entry.ready(page);
      await entry.loaded?.(page);
      await waitForHydration(page);
      const rows = await measureButtonCentring(page);
      for (const row of rows) {
        expect(Math.abs(row.offset), `«${row.name}» is ${String(row.offset)} px off`).toBeLessThanOrEqual(
          TOLERANCE,
        );
      }
    });
  }

  test('on a search for a catalogue, where «بسپارش به کارشناس» is offered as a button and as a banner, each is in the middle', async ({
    page,
  }) => {
    await page.goto('/search?catalogue=karshenas-pick');
    await expect(page.getByRole('heading', { level: 1, name: 'جست‌وجوی خودرو' })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'در حال بارگذاری آگهی‌ها' })).toHaveCount(0);
    await waitForHydration(page);
    const rows = await measureButtonCentring(page);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(Math.abs(row.offset), `«${row.name}» is ${String(row.offset)} px off`).toBeLessThanOrEqual(
        TOLERANCE,
      );
    }
  });

  test('the apply button of the filter sheet is in the middle on a phone', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'the filters are a rail on a desktop: a sheet opens on a phone only');
    await page.goto('/search');
    await waitForHydration(page);
    await page.getByRole('button', { name: /^فیلترها/ }).click();
    const sheet = page.getByRole('dialog', { name: 'فیلترها' });
    await expect(sheet).toBeVisible();
    const rows = await measureButtonCentring(page, { scope: '[role="dialog"]' });
    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const row of rows) {
      expect(Math.abs(row.offset), `«${row.name}» is ${String(row.offset)} px off`).toBeLessThanOrEqual(
        TOLERANCE,
      );
    }
  });
});
