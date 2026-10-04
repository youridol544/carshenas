import type { Locator, Page } from '@playwright/test';
import { expect, test } from '../../fixtures/test';
import { waitForHydration } from '../../gorilla/layout';

// The rows that scroll sideways (CS-112; the owner, 2026-10-04: no scrollbar on any row, the previous and next buttons
// do the job, with a scroll effect, the way Jabama does it): a mouse gets «قبلی» and «بعدی» that move a row by most of a
// screenful, smoothly (instantly under reduced motion); they are real buttons a keyboard reaches; a row whose items fit
// has none and cannot scroll; a finger swipes a row natively, with no scrollbar to show. The scrollbars themselves are
// looked for on every public page in no-scrollbars.spec.ts. The desktop project is a mouse; the mobile project is a finger.

const COPY = {
  expert: 'پیشنهاد کارشناس',
  previous: 'قبلی',
  next: 'بعدی',
  catalogues: 'مجموعه‌های آماده',
  all: 'همه‌ی آگهی‌ها',
} as const;

async function loadedHome(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'در حال بارگذاری آگهی‌ها' })).toHaveCount(0);
  await waitForHydration(page);
}

const expertRow = (page: Page) => page.locator('section[data-catalogue="karshenas-pick"]');
const expertRail = (page: Page) => expertRow(page).getByRole('list', { name: COPY.expert });
const expertButtons = (page: Page) => expertRow(page).getByRole('group', { name: COPY.expert });
const scrollLeft = (rail: Locator) => rail.evaluate((element) => element.scrollLeft);

/** Waits until the row has stopped moving (a smooth scroll is over): five frames in a row at the same place. */
function settled(rail: Locator): Promise<number> {
  return rail.evaluate(
    (element) =>
      new Promise<number>((resolve) => {
        let last = element.scrollLeft;
        let still = 0;
        const tick = () => {
          const now = element.scrollLeft;
          still = now === last ? still + 1 : 0;
          last = now;
          if (still >= 5) resolve(now);
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
}

/** The row's `scrollLeft` once for each frame for `milliseconds`, started before `act` runs. */
async function samplesWhile(rail: Locator, act: () => Promise<void>, milliseconds = 1000): Promise<number[]> {
  const sampling = rail.evaluate(
    (element, duration) =>
      new Promise<number[]>((resolve) => {
        const samples: number[] = [];
        const start = performance.now();
        const tick = () => {
          samples.push(element.scrollLeft);
          if (performance.now() - start < duration) requestAnimationFrame(tick);
          else resolve(samples);
        };
        tick();
      }),
    milliseconds,
  );
  await act();
  return sampling;
}

test.describe('with a mouse', () => {
  test.skip(({ isMobile }) => isMobile, 'a finger has no buttons: see the swipe test');

  test('«بعدی» and «قبلی» move a catalogue row by most of a screenful, with a smooth scroll', async ({
    page,
  }) => {
    await loadedHome(page);
    const rail = expertRail(page);
    const next = expertButtons(page).getByRole('button', { name: COPY.next });
    const previous = expertButtons(page).getByRole('button', { name: COPY.previous });
    await expect(next).toBeVisible();
    // at the start of the row it can only go on
    await expect(previous).toHaveAttribute('aria-disabled', 'true');
    await expect(next).toHaveAttribute('aria-disabled', 'false');

    const width = await rail.evaluate((element) => element.clientWidth);
    const samples = await samplesWhile(rail, () => next.click());
    const travelled = Math.abs(samples.at(-1) ?? 0);
    // about a screen (the row snaps to a card, so a card more or less than 85 %), going toward the end: negative, right to left
    expect(samples.at(-1)).toBeLessThan(0);
    expect(travelled).toBeGreaterThan(width * 0.5);
    expect(travelled).toBeLessThanOrEqual(width * 1.1);
    // smooth: the motion went through several places on the way, not one jump
    expect(new Set(samples.map((value) => Math.round(value))).size).toBeGreaterThan(4);
    await expect(previous).toHaveAttribute('aria-disabled', 'false');

    await previous.click();
    await expect.poll(() => scrollLeft(rail)).toBeGreaterThan(-5);
    await expect(previous).toHaveAttribute('aria-disabled', 'true');
  });

  test('the buttons are real buttons in the Tab order: Enter and Space work, and at the end of the row the focus stays on the one that cannot move', async ({
    page,
  }) => {
    await loadedHome(page);
    const rail = expertRail(page);
    const next = expertButtons(page).getByRole('button', { name: COPY.next });
    await next.focus();
    await expect(next).toBeFocused();
    expect(await next.evaluate((element) => element.tabIndex)).toBeGreaterThanOrEqual(0);
    await page.keyboard.press('Enter');
    await expect.poll(() => scrollLeft(rail)).toBeLessThan(-100);
    const afterEnter = await scrollLeft(rail);
    await page.keyboard.press('Space');
    await expect.poll(() => scrollLeft(rail)).toBeLessThan(afterEnter - 100);
    // keep pressing: at the end the button says it cannot move, and the focus is still on it
    for (let press = 0; press < 30 && (await next.getAttribute('aria-disabled')) === 'false'; press += 1) {
      await page.keyboard.press('Enter');
      await settled(rail);
    }
    await expect(next).toHaveAttribute('aria-disabled', 'true');
    await expect(next).toBeFocused();
    const atEnd = await scrollLeft(rail);
    await page.keyboard.press('Enter');
    expect(await settled(rail)).toBe(atEnd);
  });

  test('a row has its buttons exactly while it has more to show: a row that fits has none and cannot scroll', async ({
    page,
  }) => {
    await loadedHome(page);
    // every row of cards or tiles on the page: its list, and the buttons in its heading
    let overflowing = 0;
    for (const section of await page.getByRole('main').locator('section[aria-labelledby]').all()) {
      const rail = section.locator('ul[aria-label]').first();
      const buttons = section.locator('[data-rail-button="next"]');
      if ((await rail.count()) === 0 || (await buttons.count()) === 0) continue;
      const reach = await rail.evaluate((element) => element.scrollWidth - element.clientWidth);
      if (reach > 1) {
        overflowing += 1;
        await expect(section.getByRole('button', { name: COPY.next })).toBeVisible();
      } else {
        // a row whose items fit: no button, and nothing to scroll (the arithmetic is in scroll-rail-math.test.ts)
        await expect(buttons).toBeHidden();
      }
    }
    expect(overflowing, 'at least one row overflows, or this test proves nothing').toBeGreaterThan(0);
  });

  test('the catalogue strip on the search page has the same buttons over its two ends, and hands the focus on', async ({
    page,
  }) => {
    await page.goto('/search');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await waitForHydration(page);
    const strip = page.getByRole('navigation', { name: COPY.catalogues });
    const rail = strip.getByRole('list');
    const next = strip.getByRole('button', { name: COPY.next });
    const previous = strip.getByRole('button', { name: COPY.previous });
    // the strip overflows on a desktop of this data, or this test proves nothing
    expect(await rail.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeGreaterThan(1);
    await expect(next).toBeVisible();
    await expect(previous).toBeHidden();

    await next.focus();
    for (let press = 0; press < 20 && (await next.isVisible()); press += 1) {
      await page.keyboard.press('Enter');
      await settled(rail);
    }
    // the end of the strip: «بعدی» is gone, «قبلی» is there, and it has the focus the other one had
    await expect(next).toBeHidden();
    await expect(previous).toBeVisible();
    await expect(previous).toBeFocused();
    for (let press = 0; press < 20 && (await previous.isVisible()); press += 1) {
      await previous.click();
      await settled(rail);
    }
    await expect(previous).toBeHidden();
    await expect(next).toBeVisible();
    expect(await scrollLeft(rail)).toBeGreaterThan(-5);
  });
});

test.describe('with a mouse in a window as narrow as a phone', () => {
  test.skip(({ isMobile }) => isMobile, 'a finger has no buttons');
  test.use({ viewport: { width: 412, height: 900 } });

  test('the year chips of a model page scroll with the same buttons, and the chosen year is in view after the page reloads', async ({
    page,
  }) => {
    await page.goto('/models/peugeot/206');
    await expect(page.getByRole('heading', { level: 1, name: 'پژو ۲۰۶' })).toBeVisible();
    await waitForHydration(page);
    const years = page.getByRole('navigation', { name: 'نمایش بر پایه‌ی سال ساخت' });
    const rail = years.getByRole('list');
    // a model with many years: its chips overflow a phone's width, or this test proves nothing
    expect(await rail.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeGreaterThan(1);
    const next = years.getByRole('button', { name: COPY.next });
    await expect(next).toBeVisible();
    await next.click();
    await expect.poll(() => scrollLeft(rail)).toBeLessThan(-100);
    for (let press = 0; press < 20 && (await next.isVisible()); press += 1) {
      await next.click();
      await settled(rail);
    }
    // the last year, at the far end of the row: chosen, and in view when the page comes back with its row at the start
    const last = years.getByRole('link').last();
    await last.click();
    await expect(page).toHaveURL(/year=/);
    await expect(last).toHaveAttribute('aria-current', 'page');
    const [chip, row] = [await last.boundingBox(), await rail.boundingBox()];
    if (chip === null || row === null) throw new Error('the chip or the row has no box');
    expect(chip.x).toBeGreaterThanOrEqual(row.x - 1);
    expect(chip.x + chip.width).toBeLessThanOrEqual(row.x + row.width + 1);
  });
});

test.describe('with reduced motion', () => {
  test.skip(({ isMobile }) => isMobile, 'a finger has no buttons');
  test.use({ reducedMotion: 'reduce' });

  test('the buttons move a row at once, with no scroll effect', async ({ page }) => {
    await loadedHome(page);
    const rail = expertRail(page);
    const next = expertButtons(page).getByRole('button', { name: COPY.next });
    const samples = await samplesWhile(rail, () => next.click(), 800);
    const places = new Set(samples.map((value) => Math.round(value)));
    // the row stood at the start, then was at its new place: no place on the way
    expect(places.size).toBeLessThanOrEqual(2);
    expect(samples.at(-1)).toBeLessThan(-100);
  });
});

test.describe('with a finger', () => {
  test.skip(({ isMobile }) => !isMobile, 'a mouse is tested above');

  test('a row has no buttons and no scrollbar, and a swipe scrolls it natively', async ({ page }) => {
    await loadedHome(page);
    await expect(expertButtons(page).getByRole('button', { name: COPY.next })).toBeHidden();
    const rail = expertRail(page);
    await rail.evaluate((element) => {
      element.scrollIntoView({ block: 'center' });
    });
    expect(await rail.evaluate((element) => getComputedStyle(element).scrollbarWidth)).toBe('none');
    const box = await rail.boundingBox();
    if (box === null) throw new Error('the row has no box');
    // a real swipe, as touch events reach the browser's own input pipeline: the finger goes right, which carries the
    // content right and shows what comes next in a right-to-left row
    const session = await page.context().newCDPSession(page);
    const [startX, y] = [box.x + 100, box.y + box.height / 2];
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: startX, y }] });
    for (let step = 1; step <= 12; step += 1) {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: startX + step * 20, y }],
      });
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    // toward the end of a right-to-left row, which is leftwards: negative
    await expect.poll(() => scrollLeft(rail)).toBeLessThan(-100);
  });
});
