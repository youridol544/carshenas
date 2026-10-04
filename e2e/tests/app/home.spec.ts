import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import type { Page } from '@playwright/test';
import pg from 'pg';
import { expect, test } from '../../fixtures/test';
import { inspectLayout, waitForHydration } from '../../gorilla/layout';
import {
  ask,
  chipsRegion,
  expectResultsShown,
  heroBox,
  primeSentenceSearch,
  searchBar,
  SMART_COPY,
  whenInteractive,
} from '../../fixtures/smart-search';

// The home page (CS-63): the floor every screen clears (Farsi, right-to-left, no sideways scroll, accessible, quiet
// console), then what the page is for: the hero with its photographs and credit, the search box that understands plain
// Farsi, the body types that have listings, the catalogues as rows of cards with their info controls, the measured
// numbers, the footer's credits and status link, and the loading numbers on a phone profile. It runs on the lane's
// real data (the catalogue counts the worker keeps), asserting what the database says, never fixed numbers.

const COPY = {
  motto: 'ماشین درست را با قیمت درست بخرید',
  searchbox: /^چه ماشینی می‌خواهید/,
  pause: 'توقف نمایش عکس‌ها',
  play: 'ادامه‌ی نمایش عکس‌ها',
  bodyTypes: 'نوع بدنه',
  expert: 'پیشنهاد کارشناس',
  seeAll: 'دیدن همه',
  how: 'کارشناس چطور کار می‌کند؟',
  credits: 'منبع عکس‌های صفحه‌ی اصلی',
  statusLink: 'تازگی داده‌ها',
  exampleVague: 'یه ماشین تمیز و بی‌دردسر می‌خوام',
  exampleModel: 'پژو ۲۰۶ تیپ ۵ بدون رنگ زیر ۷۰۰ میلیون',
  azadiPhotographer: 'Thomas Jaehnel',
} as const;

const REPOSITORY_SETTINGS = fileURLToPath(new URL('../../../.env', import.meta.url));
function migrateUrl(): string {
  const fromEnvironment = process.env.DATABASE_MIGRATE_URL;
  if (fromEnvironment !== undefined && fromEnvironment !== '') return fromEnvironment;
  const url = parseEnv(readFileSync(REPOSITORY_SETTINGS, 'utf8')).DATABASE_MIGRATE_URL;
  if (url === undefined || url === '') throw new Error('DATABASE_MIGRATE_URL is not set');
  return url;
}

/** What the worker counted: the body types and the catalogues that hold listings. */
async function readCounted() {
  const client = new pg.Client({ connectionString: migrateUrl() });
  await client.connect();
  try {
    const { rows } = await client.query<{
      facet: string;
      value: string;
      label_fa: string;
      listing_count: number;
    }>(
      `select facet, value, label_fa, listing_count from search_facet_count
       where facet in ('body_type', 'catalogue', 'total') and listing_count > 0 order by facet, position`,
    );
    return {
      bodyTypes: rows.filter((row) => row.facet === 'body_type'),
      catalogues: rows.filter((row) => row.facet === 'catalogue'),
      total: rows.find((row) => row.facet === 'total')?.listing_count ?? 0,
    };
  } finally {
    await client.end();
  }
}

/** A page whose clock stands still until the test moves it, so the slider's timers are the test's. */
async function frozenHome(page: Page) {
  await page.clock.install({ time: new Date('2026-10-02T12:00:00Z') });
  await page.goto('/', { waitUntil: 'commit' });
  await page.clock.pauseAt(new Date('2026-10-02T12:00:01Z'));
  // Hydration is awaited in steps of real time with the page's clock moved by a few milliseconds at most, so the
  // slider (armed 1.5 s after load) has not started: waitForFunction itself would wait on the frozen clock.
  const hydrated = () =>
    page.evaluate(() => {
      const controls = [...document.querySelectorAll('a[href], button, input:not([type="hidden"])')];
      return (
        controls.length > 0 &&
        controls.every((element) => Object.keys(element).some((key) => key.startsWith('__reactProps$')))
      );
    });
  for (let attempt = 0; attempt < 100 && !(await hydrated().catch(() => false)); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await page.clock.runFor(1);
  }
  await expect(page.getByRole('heading', { level: 1, name: COPY.motto })).toBeVisible();
}

async function loadedHome(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: COPY.motto })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'در حال بارگذاری آگهی‌ها' })).toHaveCount(0);
  await waitForHydration(page);
}

test.describe('home page', () => {
  test('is a Farsi right-to-left document named for the product, with the motto as its one heading', async ({
    page,
    rtl,
  }) => {
    await loadedHome(page);
    await rtl.expectDocumentRtl();
    await expect(page).toHaveTitle('کارشناس');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(COPY.motto);
  });

  test('fits the viewport without horizontal scroll, text clipping or small targets', async ({
    page,
    rtl,
  }) => {
    await loadedHome(page);
    await rtl.expectNoHorizontalOverflow();
    const report = await inspectLayout(page, { minTarget: 44 });
    expect(report.clipped).toEqual([]);
    expect(report.smallTargets).toEqual([]);
    expect(report.brokenWords).toEqual([]);
    expect(report.brokenNumbers).toEqual([]);
  });

  test('has no detectable accessibility violations', async ({ page, a11y }) => {
    await loadedHome(page);
    await a11y.check();
  });

  test('has no accessibility violations with a catalogue’s info popover open', async ({ page, a11y }) => {
    await loadedHome(page);
    await page.getByRole('button', { name: `توضیح درباره‌ی «${COPY.expert}»` }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await a11y.check();
  });
});

test.describe('hero', () => {
  test('shows the first photograph from our own origin and no third party is asked for one', async ({
    page,
  }) => {
    const hosts = new Set<string>();
    page.on('request', (request) => hosts.add(new URL(request.url()).host));
    await loadedHome(page);
    const first = page.locator('[data-hero-slide]').first().locator('img');
    await expect(first).toHaveAttribute('src', /^\/home\/hero\/milad-dusk-traffic-960\.webp$/);
    await expect(first).toHaveAttribute('fetchpriority', 'high');
    await expect(first).toHaveAttribute('loading', 'eager');
    expect(await first.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(
      true,
    );
    // the browser chose a modern file from the picture, from our own server
    expect(await first.evaluate((image: HTMLImageElement) => new URL(image.currentSrc).pathname)).toMatch(
      /^\/home\/hero\/milad-dusk-traffic-\d+\.(avif|webp)$/,
    );
    const outside = [...hosts].filter(
      (host) =>
        /unsplash|wikimedia|wikipedia|creativecommons/.test(host) ||
        host.includes('images.') ||
        host.includes('upload.'),
    );
    expect(outside).toEqual([]);
  });

  test('has the motto, one line of what the site does and the search box, in the photograph’s own box', async ({
    page,
  }) => {
    await loadedHome(page);
    const hero = page.getByRole('region', { name: COPY.motto });
    await expect(hero.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(hero.getByRole('searchbox', { name: COPY.searchbox })).toBeVisible();
    await expect(hero.getByRole('button', { name: COPY.exampleVague })).toBeVisible();
    await expect(hero.getByRole('button', { name: COPY.exampleModel })).toBeVisible();
  });

  test('credits the photograph that is showing, in a line over it', async ({ page }) => {
    await loadedHome(page);
    const credit = page.locator('[data-hero-credit]');
    await expect(credit).toContainText('Mohammad Amirahmadi');
    await expect(credit.getByRole('link', { name: 'Unsplash License' })).toHaveAttribute(
      'href',
      'https://unsplash.com/license',
    );
  });

  test('changes photograph every six seconds, shows the Azadi credit while it shows, and pauses on request', async ({
    page,
  }) => {
    await frozenHome(page);
    const showing = () => page.locator('[data-hero-slide][data-active]').getAttribute('data-hero-slide');
    const credit = page.locator('[data-hero-credit]');
    expect(await showing()).toBe('milad-dusk-traffic');

    // armed 1.5 s after the page has loaded; only then is the next photograph requested
    await expect(page.locator('[data-hero-slide]')).toHaveCount(1);
    await page.clock.runFor(1600);
    await expect(page.locator('[data-hero-slide]')).toHaveCount(2);
    await page.clock.runFor(5900);
    expect(await showing()).toBe('milad-dusk-traffic');
    await page.clock.runFor(200);
    expect(await showing()).toBe('hakim-golden-hour');
    await expect(credit).toContainText('Safa Daneshvar');

    // the fourth hold: the CC BY photograph, whose credit is a licence term
    await page.clock.runFor(6000 * 3);
    expect(await showing()).toBe('azadi-night-traffic');
    await expect(credit).toContainText(COPY.azadiPhotographer);
    await expect(credit.getByRole('link', { name: 'CC BY 2.0' })).toHaveAttribute(
      'href',
      /creativecommons\.org\/licenses\/by\/2\.0/,
    );
    await expect(credit).toBeVisible();

    // paused: it stays; resumed: it goes on
    await page.getByRole('button', { name: COPY.pause }).click();
    await page.clock.runFor(30_000);
    expect(await showing()).toBe('azadi-night-traffic');
    await page.getByRole('button', { name: COPY.play }).click();
    await expect(page.getByRole('button', { name: COPY.pause })).toBeVisible();
    await page.clock.runFor(6100);
    expect(await showing()).toBe('tehran-moon-aerial');
  });

  test('keeps white text above 4.5:1 over every photograph (measured on the rendered pixels)', async ({
    page,
  }, testInfo) => {
    // six photographs, each waited for through its fade and read back pixel by pixel
    test.setTimeout(120_000);
    await frozenHome(page);
    const slideCount = 6;
    for (let index = 0; index < slideCount; index++) {
      if (index > 0) {
        await page.clock.runFor(index === 1 ? 7600 : 6000);
        await expect(page.locator('[data-hero-slide][data-active] img')).toHaveCount(1);
      }
      const id = await page.locator('[data-hero-slide][data-active]').getAttribute('data-hero-slide');
      // the fade is a CSS transition on real time: wait for the photograph to be the only one showing
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              [...document.querySelectorAll<HTMLElement>('[data-hero-slide]')]
                .map((slide) => Number(getComputedStyle(slide).opacity))
                .filter((opacity) => opacity > 0 && opacity < 1).length,
          ),
        )
        .toBe(0);
      await page.evaluate(() => {
        for (const element of document.querySelectorAll<HTMLElement>(
          '#home-title, #home-title + p, [role="search"]',
        )) {
          element.style.visibility = 'hidden';
        }
        for (const element of document.querySelectorAll<HTMLElement>(
          'section[aria-labelledby="home-title"] .hero-enter, .hero-enter-2, .hero-enter-3',
        )) {
          element.style.animation = 'none';
        }
      });
      const boxes = await page.evaluate(() =>
        ['#home-title', '#home-title + p'].map((selector) => {
          const box = document.querySelector(selector)?.getBoundingClientRect();
          return box === undefined
            ? null
            : { x: box.x, y: box.y + window.scrollY, width: box.width, height: box.height };
        }),
      );
      const shotBuffer = await page.screenshot({ fullPage: true });
      await writeFile(testInfo.outputPath(`hero-without-text-${id}.png`), shotBuffer);
      const shot = shotBuffer.toString('base64');
      const worst = await page.evaluate(
        async ({ shot, boxes }) => {
          const image = new Image();
          image.src = `data:image/png;base64,${shot}`;
          await image.decode();
          const scale = image.width / document.documentElement.clientWidth;
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          if (context === null) throw new Error('no canvas');
          context.drawImage(image, 0, 0);
          const channel = (value: number) => {
            const unit = value / 255;
            return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
          };
          let lowest = Infinity;
          for (const box of boxes) {
            if (box === null) continue;
            const { data } = context.getImageData(
              Math.round(box.x * scale),
              Math.round(box.y * scale),
              Math.max(1, Math.round(box.width * scale)),
              Math.max(1, Math.round(box.height * scale)),
            );
            const lights: number[] = [];
            for (let at = 0; at < data.length; at += 4) {
              lights.push(
                0.2126 * channel(data[at] ?? 0) +
                  0.7152 * channel(data[at + 1] ?? 0) +
                  0.0722 * channel(data[at + 2] ?? 0),
              );
            }
            lights.sort((first, second) => first - second);
            // the 99th percentile: a lit window or a star behind a word is not what the eye reads the word against
            const light = lights[Math.floor(lights.length * 0.99)] ?? 1;
            lowest = Math.min(lowest, 1.05 / (light + 0.05));
          }
          return lowest;
        },
        { shot, boxes },
      );
      await testInfo.attach(`contrast-${id}.txt`, {
        body: `${worst.toFixed(2)}:1`,
        contentType: 'text/plain',
      });
      expect.soft(worst, `white text over ${id}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('does not change while the tab is hidden', async ({ page }) => {
    await frozenHome(page);
    await page.clock.runFor(1600);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.clock.runFor(30_000);
    expect(await page.locator('[data-hero-slide][data-active]').getAttribute('data-hero-slide')).toBe(
      'milad-dusk-traffic',
    );
  });

  test('shows one still photograph, no other file and no pause button, when the buyer prefers reduced motion', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const heroFiles: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/home/hero/') && !request.url().endsWith('.json'))
        heroFiles.push(request.url());
    });
    await frozenHome(page);
    await page.clock.runFor(60_000);
    await expect(page.locator('[data-hero-slide]')).toHaveCount(1);
    await expect(page.getByRole('button', { name: COPY.pause })).toHaveCount(0);
    expect(heroFiles.every((url) => url.includes('milad-dusk-traffic'))).toBe(true);
  });
});

test.describe('search box', () => {
  test.beforeAll(async ({ browser }, testInfo) => {
    await primeSentenceSearch(browser, testInfo.project.use.baseURL);
  });

  // One box, one button: the buyer writes a sentence, presses Enter or the button, and lands on the search page with the
  // filters it meant already applied and shown (CS-111). No «understood» panel, no second step.

  test('a typed sentence lands on the results with its filters applied and shown, in one step', async ({
    page,
  }) => {
    await loadedHome(page);
    await whenInteractive(page);
    const before = await page.evaluate(() => history.length);
    await ask(heroBox(page), 'پژو ۲۰۶ تیپ ۵ بدون رنگ زیر ۷۰۰ میلیون');
    await expect(page).toHaveURL(/\/search\?/);
    const query = new URL(page.url()).searchParams;
    expect(query.get('model')).toBe('peugeot.206');
    expect(query.get('trim')).toBe('peugeot.206.5');
    expect(query.get('nopaint')).toBe('1');
    expect(query.get('price')).toBe('..700000000');
    expect(query.get('ask')).toBe('پژو ۲۰۶ تیپ ۵ بدون رنگ زیر ۷۰۰ میلیون');
    await expectResultsShown(page);
    await expect(
      chipsRegion(page).getByRole('button', { name: SMART_COPY.remove('بدون رنگ') }),
    ).toBeVisible();
    await expect(searchBar(page)).toHaveValue('پژو ۲۰۶ تیپ ۵ بدون رنگ زیر ۷۰۰ میلیون');
    expect(await page.evaluate(() => history.length)).toBe(before + 1);
  });

  test('the one button does the same as Enter', async ({ page }) => {
    await loadedHome(page);
    await whenInteractive(page);
    await heroBox(page).fill('پراید');
    await page.getByRole('search').getByRole('button', { name: SMART_COPY.submit, exact: true }).click();
    await expect(page).toHaveURL(/make=pride/);
    await expectResultsShown(page);
  });

  test('an example chip submits at once: one click shows results', async ({ page }) => {
    await loadedHome(page);
    await whenInteractive(page);
    await page.getByRole('button', { name: SMART_COPY.examples.vague }).click();
    await expect(page).toHaveURL(/\/search\?/);
    await expectResultsShown(page);
    const query = new URL(page.url()).searchParams;
    expect(query.get('lowkm')).toBe('1');
    expect(query.get('ask')).toBe(SMART_COPY.examples.vague);
    await expect(
      chipsRegion(page).getByRole('button', { name: SMART_COPY.remove('کم‌کارکرد نسبت به سن') }),
    ).toBeVisible();
    await expect(
      chipsRegion(page).getByRole('button', { name: SMART_COPY.remove('بدون رنگ') }),
    ).toBeVisible();
  });

  test('every example chip leads to its own filters', async ({ page }) => {
    const wanted = [
      { example: SMART_COPY.examples.model, filter: 'model', value: 'peugeot.206' },
      { example: SMART_COPY.examples.family, filter: 'body', value: 'sedan' },
    ] as const;
    for (const { example, filter, value } of wanted) {
      await loadedHome(page);
      await whenInteractive(page);
      await page.getByRole('button', { name: example }).click();
      await expect(page).toHaveURL(/\/search\?/);
      expect(new URL(page.url()).searchParams.getAll(filter)).toContain(value);
      expect(new URL(page.url()).searchParams.get('ask')).toBe(example);
    }
  });

  test('there is no confirm step and no second button: the hero’s search has the one button', async ({
    page,
  }) => {
    await loadedHome(page);
    await heroBox(page).fill('پژو ۲۰۶');
    await expect(page.getByRole('button', { name: SMART_COPY.gone.understand })).toHaveCount(0);
    await expect(page.getByRole('button', { name: SMART_COPY.gone.apply })).toHaveCount(0);
    await expect(
      page
        .getByRole('tabpanel', { name: SMART_COPY.submit })
        .getByRole('button', { name: SMART_COPY.submit, exact: true }),
    ).toHaveCount(1);
  });

  test('Back returns to the home page with what was typed still in the box', async ({ page }) => {
    await loadedHome(page);
    await whenInteractive(page);
    await ask(heroBox(page), 'سمند بدون تصادف');
    await expect(page).toHaveURL(/make=samand/);
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(heroBox(page)).toHaveValue('سمند بدون تصادف');
    await page.goForward();
    await expect(page).toHaveURL(/make=samand/);
    await expect(searchBar(page)).toHaveValue('سمند بدون تصادف');
  });

  test('an empty box leads to every listing', async ({ page }) => {
    await loadedHome(page);
    await whenInteractive(page);
    await page.getByRole('search').getByRole('button', { name: SMART_COPY.submit, exact: true }).click();
    await expect(page).toHaveURL(/\/search$/);
    await expectResultsShown(page);
  });

  test('says nothing about a model and waits for none: a sentence the code could not read in full shows its results', async ({
    page,
  }) => {
    const asked: string[] = [];
    await page.route('**/api/search/understand', async (route) => {
      asked.push(route.request().url());
      await route.continue();
    });
    await loadedHome(page);
    await whenInteractive(page);
    await ask(heroBox(page), 'پژو ۲۰۶ zzqnoword');
    await expect(page).toHaveURL(/model=peugeot\.206/);
    await expectResultsShown(page);
    await expect(page.getByText('فقط بخش ساده‌ی جمله را خواندیم')).toHaveCount(0);
    await expect(page.getByText(SMART_COPY.reading)).toHaveCount(0);
    await whenInteractive(page);
    expect(asked).toEqual([]);
  });

  test.describe('when the request fails', () => {
    // The failure is the point: the browser's own report of it is expected.
    test.use({
      ignoreBrowserErrors: [[/\[requestfailed\] POST/, /Failed to load resource/], { scope: 'test' }],
    });

    test('a request that never arrives keeps the sentence and says what to do', async ({ page }) => {
      await loadedHome(page);
      await whenInteractive(page);
      await page.route(
        (url) => url.pathname === '/',
        (route) => (route.request().method() === 'POST' ? route.abort() : route.continue()),
      );
      await heroBox(page).fill('پژو ۲۰۶');
      await heroBox(page).press('Enter');
      await expect(page.getByRole('alert').filter({ hasText: SMART_COPY.failed })).toBeVisible();
      await expect(heroBox(page)).toHaveValue('پژو ۲۰۶');
      await expect(page).toHaveURL(/\/$/);
    });
  });

  test.describe('before the script has loaded, or with none', () => {
    test.use({ javaScriptEnabled: false });

    test('the hero still works: the form is posted and the server sends the buyer to the results', async ({
      page,
    }) => {
      await page.goto('/');
      await heroBox(page).fill('پژو ۲۰۶ بدون رنگ');
      await heroBox(page).press('Enter');
      await expect(page).toHaveURL(/model=peugeot\.206/);
      const query = new URL(page.url()).searchParams;
      expect(query.get('nopaint')).toBe('1');
      expect(query.get('ask')).toBe('پژو ۲۰۶ بدون رنگ');
      // The page itself needs its script to be drawn (its results stream into hidden elements that a script reveals):
      // what a form without one can do is end at the right address.
    });

    test('an example chip works too', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: SMART_COPY.examples.family }).click();
      await expect(page).toHaveURL(/\/search\?/);
      expect(new URL(page.url()).searchParams.get('ask')).toBe(SMART_COPY.examples.family);
    });
  });
});

test.describe('body types', () => {
  test('offers only the body types that have listings, each opening the search filtered by it', async ({
    page,
  }) => {
    const counted = await readCounted();
    expect(counted.bodyTypes.length).toBeGreaterThan(0);
    await loadedHome(page);
    const section = page.getByRole('region', { name: COPY.bodyTypes });
    const tiles = section.getByRole('link');
    // the body types with listings, and «همه» last
    await expect(tiles).toHaveCount(counted.bodyTypes.length + 1);
    await expect(tiles.last()).toHaveAttribute('href', '/search');
    for (const bodyType of counted.bodyTypes) {
      const tile = section.getByRole('link', { name: new RegExp(`^${bodyType.label_fa}`) });
      await expect(tile).toHaveAttribute('href', new RegExp(`/search\\?.*body=${bodyType.value}`));
    }
    // a body type with no listing is not offered
    await expect(section.getByRole('link', { name: /^کوپه/ })).toHaveCount(
      counted.bodyTypes.some((row) => row.value === 'coupe') ? 1 : 0,
    );
  });

  test('four columns on a phone fill the row, so few types leave no orphan', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the phone grid');
    await loadedHome(page);
    const tiles = await page.getByRole('region', { name: COPY.bodyTypes }).getByRole('link').all();
    const tops = await Promise.all(
      tiles
        .slice(0, 4)
        .map((tile) => tile.evaluate((element) => Math.round(element.getBoundingClientRect().top))),
    );
    expect(new Set(tops).size).toBe(1);
  });

  test('a tap opens the search page filtered by that body type', async ({ page }) => {
    const [first] = (await readCounted()).bodyTypes;
    if (first === undefined) throw new Error('no body type has listings');
    await loadedHome(page);
    await page
      .getByRole('region', { name: COPY.bodyTypes })
      .getByRole('link', { name: new RegExp(`^${first.label_fa}`) })
      .click();
    await expect(page).toHaveURL(/\/search\?/);
    await expect(page.getByRole('heading', { level: 1, name: 'جست‌وجوی خودرو' })).toBeVisible();
    await expect(
      page.getByRole('group', { name: 'فیلترهای فعال' }).or(page.getByLabel('فیلترهای فعال')),
    ).toContainText(first.label_fa);
  });
});

test.describe('catalogue rows', () => {
  test('are rows of listing cards, «پیشنهاد کارشناس» first, one for each catalogue that holds listings', async ({
    page,
  }) => {
    const counted = await readCounted();
    await loadedHome(page);
    const rows = page.locator('section[data-catalogue]');
    await expect(rows).toHaveCount(Math.min(4, counted.catalogues.length));
    // the others are chips, each with its info control too
    const others = page.locator('[data-catalogue-chip]');
    await expect(others).toHaveCount(Math.max(0, counted.catalogues.length - 4));
    for (const chip of await others.all()) {
      await expect(chip.getByRole('link')).toHaveAttribute('href', /\/search\?catalogue=/);
      await expect(chip.getByRole('button', { name: /^توضیح درباره‌ی/ })).toBeVisible();
    }
    await expect(rows.first()).toHaveAttribute('data-catalogue', 'karshenas-pick');
    await expect(rows.first().getByRole('heading', { level: 2, name: COPY.expert })).toBeVisible();
    for (const row of await rows.all()) {
      await expect(row.getByRole('article').first()).toBeVisible();
      // a card has a price and a way out; the row ends in a tile that opens everything
      await expect(row.getByRole('link', { name: /^دیدن همه‌ی .* آگهی$/ })).toBeVisible();
    }
  });

  test('«دیدن همه» opens the search page with the catalogue’s own filters', async ({ page }) => {
    await loadedHome(page);
    const first = page.locator('section[data-catalogue="karshenas-pick"]');
    await first.getByRole('link', { name: `دیدن همه‌ی آگهی‌های «${COPY.expert}»` }).click();
    await expect(page).toHaveURL(/\/search\?/);
    expect(new URL(page.url()).searchParams.get('catalogue')).toBe('karshenas-pick');
  });

  test('has an info control beside every catalogue title, explaining it from its definition', async ({
    page,
  }) => {
    await loadedHome(page);
    // The fifth place on the page went to the popular models (CS-67), so the catalogue whose rule is a number is the third.
    const row = page.locator('section[data-catalogue="clean-and-easy"]');
    const control = row.getByRole('button', { name: /^توضیح درباره‌ی/ });
    await control.click();
    const popup = page.getByRole('dialog');
    await expect(popup).toContainText('مدل پرطرفدار');
    await expect(popup).toContainText('۱۲٬۰۰۰');
    await page.keyboard.press('Escape');
    await expect(popup).toHaveCount(0);
    // every row has one
    const rows = await page.locator('section[data-catalogue]').count();
    await expect(
      page.locator('section[data-catalogue]').getByRole('button', { name: /^توضیح درباره‌ی/ }),
    ).toHaveCount(rows);
  });

  test('the rail scrolls sideways and a mouse has previous and next buttons', async ({ page }, testInfo) => {
    await loadedHome(page);
    const row = page.locator('section[data-catalogue="karshenas-pick"]');
    const rail = row.getByRole('list', { name: COPY.expert });
    const before = await rail.evaluate((element) => element.scrollLeft);
    if (testInfo.project.name === 'desktop') {
      await row.getByRole('button', { name: 'بعدی' }).click();
      await expect
        .poll(async () => rail.evaluate((element) => element.scrollLeft))
        .toBeLessThan(before - 100);
      await row.getByRole('button', { name: 'قبلی' }).click();
      await expect.poll(async () => rail.evaluate((element) => element.scrollLeft)).toBeGreaterThan(-5);
    } else {
      await rail.evaluate((element) => {
        element.scrollBy({ left: -300 });
      });
      await expect.poll(async () => rail.evaluate((element) => element.scrollLeft)).toBeLessThan(-100);
      await expect(row.getByRole('button', { name: 'بعدی' })).toBeHidden();
    }
  });
});

test.describe('how it works, the numbers, the footer', () => {
  test('says how it works in three steps with measured numbers from the database', async ({ page }) => {
    const counted = await readCounted();
    await loadedHome(page);
    const section = page.getByRole('region', { name: COPY.how });
    await expect(section.getByRole('listitem')).toHaveCount(3);
    const searchable = new Intl.NumberFormat('fa-IR').format(counted.total);
    await expect(section.getByText(searchable, { exact: true })).toBeVisible();
    await expect(section.getByText('آگهی در جست‌وجو')).toBeVisible();
    // the rating's info control is the price rating's own definition
    await section.getByRole('button', { name: /^توضیح درباره‌ی «ارزیابی قیمت»/ }).click();
    await expect(page.getByRole('dialog')).toContainText('ارزش بازار');
    await page.keyboard.press('Escape');
    await expect(section.getByRole('link', { name: /همه‌ی اعداد/ })).toHaveAttribute('href', '/status');
  });

  test('links to the status page in the footer, and lists every photograph’s credit there', async ({
    page,
  }) => {
    await loadedHome(page);
    const footer = page.getByRole('contentinfo');
    await expect(footer.getByRole('link', { name: COPY.statusLink })).toHaveAttribute('href', '/status');
    await footer.getByText(COPY.credits).click();
    const items = footer.locator('[data-credit-of]');
    await expect(items).toHaveCount(6);
    const azadi = footer.locator('[data-credit-of="azadi-night-traffic"]');
    await expect(azadi).toContainText(COPY.azadiPhotographer);
    await expect(azadi).toContainText('CC BY 2.0');
    await expect(azadi.getByRole('link', { name: 'CC BY 2.0' })).toHaveAttribute(
      'href',
      /creativecommons\.org\/licenses\/by\/2\.0/,
    );
    await expect(azadi).toContainText('پلاک‌ها محو شده‌اند');
  });

  test('the closing call to action opens the search page', async ({ page }) => {
    await loadedHome(page);
    await page.getByRole('link', { name: 'دیدن همه‌ی آگهی‌ها', exact: true }).click();
    await expect(page).toHaveURL(/\/search$/);
  });
});

// Loading numbers on a phone profile: a Pixel-class screen on the "slow 4G" of Lighthouse (1.6 Mbit/s down, 150 ms
// round trip) with a CPU four times slower than this machine, against the production build the project's web server
// runs. The thresholds are the task's: the largest contentful paint under 2.5 s (Core Web Vitals "good"), and a layout
// shift under 0.1 (also "good"). The numbers are attached to the report.
test.describe('loading on a phone profile', () => {
  test('the largest contentful paint is the photograph, under 2.5 s, and nothing shifts', async ({
    page,
    browserName,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'mobile' || browserName !== 'chromium',
      'a phone profile, in Chromium',
    );
    await page.addInitScript(() => {
      const state = { lcp: 0, element: '', cls: 0 };
      (window as unknown as { __vitals: typeof state }).__vitals = state;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as unknown as {
          startTime: number;
          element?: Element;
          url?: string;
        }[]) {
          state.lcp = entry.startTime;
          state.element = `${entry.element?.tagName ?? '?'} ${entry.url ?? ''}`.trim();
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
          if (!entry.hadRecentInput) state.cls += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    // Three cold loads: this machine runs other work, and one load's paint time moves by a second with it; the median
    // is the number the task's limit is held to, and all three are in the report.
    const runs: { lcp: number; element: string; cls: number }[] = [];
    for (let run = 0; run < 3; run++) {
      await page.goto('/', { waitUntil: 'load' });
      await expect(page.getByRole('status').filter({ hasText: 'در حال بارگذاری آگهی‌ها' })).toHaveCount(0, {
        timeout: 15_000,
      });
      // let the last paints and the first slide change settle
      await page.waitForTimeout(3000);
      runs.push(
        await page.evaluate(
          () => (window as unknown as { __vitals: { lcp: number; element: string; cls: number } }).__vitals,
        ),
      );
    }
    await testInfo.attach('vitals.json', {
      body: JSON.stringify(runs, null, 2),
      contentType: 'application/json',
    });
    const lcps = runs.map((run) => run.lcp).sort((first, second) => first - second);
    const median = lcps[1] ?? Infinity;
    console.log(
      `LCP ${lcps.map((value) => value.toFixed(0)).join(', ')} ms, median ${median.toFixed(0)}; CLS ${runs.map((run) => run.cls.toFixed(4)).join(', ')}; element ${runs[0]?.element ?? ''}`,
    );
    for (const run of runs) expect(run.element).toMatch(/^IMG .*\/home\/hero\//);
    expect(median).toBeLessThan(2500);
    for (const run of runs) expect(run.cls).toBeLessThan(0.1);
  });
});
