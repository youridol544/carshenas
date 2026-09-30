import { expect, test } from '../../fixtures/test';

// The body-type selector on /design (CS-57): one photo tile per body type, named in Farsi, as a native radio group;
// the photos are AVIF or WebP from our own origin, in 4:3 boxes that are reserved before a byte arrives.

const LEGEND = 'کدام بدنه را می‌خواهید؟';
const LABELS = [
  'سدان',
  'هاچ‌بک',
  'کراس‌اوور',
  'شاسی‌بلند',
  'وانت',
  'ون',
  'مینی‌ون',
  'کوپه',
  'کروک',
  'استیشن',
];

test('offers one tile per body type, each named in Farsi', async ({ page }) => {
  await page.goto('/design');
  const selector = page.getByRole('group', { name: LEGEND });
  const radios = selector.getByRole('radio');
  await expect(radios).toHaveCount(LABELS.length);
  for (const [index, label] of LABELS.entries()) {
    await expect(radios.nth(index)).toHaveAccessibleName(label);
    await expect(radios.nth(index)).not.toBeChecked();
  }
});

test('loads every photo from our own origin, sharp enough for its box, in a 4:3 frame', async ({
  page,
  browserName,
}) => {
  const photoRequests: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'image') photoRequests.push(request.url());
  });
  await page.goto('/design');
  const photos = page.getByRole('group', { name: LEGEND }).locator('img');
  await expect(photos).toHaveCount(LABELS.length);
  for (const photo of await photos.all()) {
    await photo.scrollIntoViewIfNeeded();
    await expect
      .poll(() => photo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0))
      .toBe(true);
    const { box, source, ratio } = await photo.evaluate((image: HTMLImageElement) => {
      const rect = image.getBoundingClientRect();
      return { box: rect.width, source: image.currentSrc, ratio: rect.width / rect.height };
    });
    expect(ratio).toBeCloseTo(4 / 3, 1);
    expect(new URL(source).origin).toBe(new URL(page.url()).origin);
    // Chromium and WebKit decode AVIF; the file chosen covers the box at the device's pixel ratio.
    if (browserName !== 'firefox') expect(source).toMatch(/\/body-types\/[a-z]+-\d+\.avif$/);
    // naturalWidth is divided by the srcset density, so the file's own width is read from its name.
    const fileWidth = Number(/-(\d+)\.(avif|webp)$/.exec(source)?.[1]);
    const ratioOfPixels = await page.evaluate(() => window.devicePixelRatio);
    expect(fileWidth).toBeGreaterThanOrEqual(Math.min(640, Math.floor(box * ratioOfPixels)));
  }
  expect(photoRequests.filter((url) => new URL(url).origin !== new URL(page.url()).origin)).toEqual([]);
});

test('reserves each photo box before the photo arrives', async ({ page }) => {
  await page.route(/\/body-types\/.*\.(avif|webp)$/, () => {}); // never answered
  await page.goto('/design', { waitUntil: 'domcontentloaded' });
  const photos = page.getByRole('group', { name: LEGEND }).locator('img');
  await expect(photos).toHaveCount(LABELS.length);
  const heights = await photos.evaluateAll((images) =>
    images.map((image) => image.getBoundingClientRect().height),
  );
  expect(heights.filter((height) => height === 0)).toEqual([]);
});

test('picks a body type with a tap and moves with the arrow keys', async ({ page }) => {
  await page.goto('/design');
  const selector = page.getByRole('group', { name: LEGEND });
  // The radio covers its whole tile, so a tap anywhere on the tile lands on it.
  await selector.getByRole('radio', { name: LABELS[3] }).click();
  await expect(selector.getByRole('radio', { name: LABELS[3] })).toBeChecked();
  // The chosen tile is told apart by more than its fill: its edge turns the action colour.
  const edge = (label: string) =>
    selector
      .locator('label')
      .filter({ has: page.getByRole('radio', { name: label, exact: true }) })
      .evaluate((tile) => getComputedStyle(tile).borderTopColor);
  expect(await edge(LABELS[3] ?? '')).not.toBe(await edge(LABELS[0] ?? ''));
  await page.keyboard.press('ArrowDown');
  await expect(selector.getByRole('radio', { name: LABELS[4] })).toBeChecked();
  await expect(selector.getByRole('radio', { name: LABELS[3] })).not.toBeChecked();
});

test('each tile is a target of at least 44 px', async ({ page }) => {
  await page.goto('/design');
  const tiles = page.getByRole('group', { name: LEGEND }).locator('label');
  for (const tile of await tiles.all()) {
    const box = await tile.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
});

test('credits every photographer and licence', async ({ page }) => {
  await page.goto('/design');
  await page.getByText('منبع عکس‌ها').click();
  // The site and the licence are named once; each photographer links to the photo's own page.
  await expect(page.getByRole('link', { name: 'Unsplash License' })).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Martin Katler' })).toHaveAttribute(
    'href',
    'https://unsplash.com/photos/SuD4h8Gpgok',
  );
});

test('fits a phone without sideways scroll and passes axe', async ({ page, rtl, a11y }) => {
  await page.goto('/design');
  for (const width of [320, 412]) {
    await page.setViewportSize({ width, height: 900 });
    await rtl.expectNoHorizontalOverflow();
  }
  await page.getByText('منبع عکس\u200cها').click();
  await a11y.check({ include: 'section[aria-labelledby="body-types"]' });
});

test('nothing on the page moves while the photos load', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'layout-shift entries exist only in Chromium');
  await page.addInitScript(() => {
    let total = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & {
        value: number;
        hadRecentInput: boolean;
      })[])
        if (!entry.hadRecentInput) total += entry.value;
    }).observe({ type: 'layout-shift', buffered: true });
    Object.defineProperty(window, 'layoutShiftTotal', { get: () => total });
  });
  await page.goto('/design');
  const photos = page.getByRole('group', { name: LEGEND }).locator('img');
  for (const photo of await photos.all()) {
    await photo.scrollIntoViewIfNeeded();
    await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.complete)).toBe(true);
  }
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  expect(await page.evaluate(() => Number(Reflect.get(window, 'layoutShiftTotal')))).toBe(0);
});
