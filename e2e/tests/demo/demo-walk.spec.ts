import { existsSync } from 'node:fs';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Locator, Page } from '@playwright/test';
import { waitForHydration } from '../../gorilla/layout';
import {
  SMART_COPY,
  ask,
  chipNames,
  chipsRegion,
  expectResultsShown,
  heroBox,
  searchBar,
  whenInteractive,
} from '../../fixtures/smart-search';
import { expect, test } from '../../fixtures/test';

// The demo rehearsal (CS-120; docs/submission/demo-script.md, shot-list.md, recording-day.md). One command, `pnpm e2e:demo`,
// walks the five-minute demo path on the running app and its real data, scene by scene, on a phone and on a desktop
// screen: the home page, a plain-Farsi search, a great deal and its explanation, a price drop, an unrated listing, an
// expensive one, a pasted link, the status page and a model page. It saves a screenshot of each moment and writes
// walk-report.md: what each scene found (the count a sentence returned, the price a listing shows, how long the answer took),
// so the recording matches the repository on the day. A scene that fails is named in the report with the listing to
// replace, and the walk goes on to the next one.
//
// It is not part of `pnpm e2e`: it has its own configuration (playwright.demo.config.ts), seeds nothing, removes nothing and
// needs the app running already. It reads real data, so its examples are inputs: the defaults below were true on
// 2026-10-04, and every one can be replaced from the environment on the day (see the shot list).
//
//   DEMO_BASE_URL            where the app runs (default http://127.0.0.1:3000)
//   DEMO_SENTENCE            the plain-Farsi sentence of scene 2
//   DEMO_LISTING_GREAT       the listing id of a great deal (scene 3)
//   DEMO_LISTING_DROP        a rated listing whose price dropped
//   DEMO_LISTING_UNRATED     a listing with no rating and a reason
//   DEMO_LISTING_OVERPRICED  an expensive one
//   DEMO_PASTED_LINK         a Divar link to paste (scene 4); an ad the database holds
//   DEMO_MODEL_PATH          the model page (default /models/peugeot/206)
//   DEMO_PROBE_SENTENCES     sentences to count, separated by |, with no screenshot
//   DEMO_REAL_PHOTOS=1       let the browser load Divar's photos from Divar's addresses (the product as a visitor sees it).
//                            Unset, every photo is a drawn stand-in and nothing leaves the machine for a listing site.
//   DEMO_SHOTS_DIR           where the screenshots and the report go (default e2e/demo-shots/<time>)

const env = (name: string, fallback: string): string => {
  const value = process.env[name]?.trim();
  return value === undefined || value === '' ? fallback : value;
};

const DEMO = {
  sentence: env('DEMO_SENTENCE', '۲۰۶ تیپ ۲ بدون رنگ زیر ۱ میلیارد'),
  listings: {
    great: Number(env('DEMO_LISTING_GREAT', '89002')),
    drop: Number(env('DEMO_LISTING_DROP', '892')),
    unrated: Number(env('DEMO_LISTING_UNRATED', '5432')),
    overpriced: Number(env('DEMO_LISTING_OVERPRICED', '107176')),
  },
  pastedLink: env('DEMO_PASTED_LINK', 'https://divar.ir/v/ga56Oz0e'),
  modelPath: env('DEMO_MODEL_PATH', '/models/peugeot/206'),
  probes: env(
    'DEMO_PROBE_SENTENCES',
    [
      '۲۰۶ تیپ ۵ بدون رنگ زیر ۱٫۳ میلیارد',
      '۲۰۷ اتوماتیک بدون تصادف زیر ۲ میلیارد و ۵۰۰ میلیون',
      'یک ماشین تمیز، کم‌کارکرد و بی‌دردسر',
      'ماشین ژاپنی تمیز',
    ].join('|'),
  )
    .split('|')
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence !== ''),
  realPhotos: process.env.DEMO_REAL_PHOTOS === '1',
};

// Words of the product the walk looks for. They are copy: a rewrite of the text (TODO-09) changes them here, in one place.
const WORDS = {
  analysis: 'تحلیل قیمت',
  comparables: /مشابهی که ارزش بازار/,
  history: /تاریخچه/,
  valuation: /^ارزش بازار$/,
  extraction: /^خواندن متن/,
};

const HIDE_DEV_BADGE = 'nextjs-portal{display:none!important}';
const SHOTS_ROOT = fileURLToPath(new URL('../../demo-shots', import.meta.url));

// A listing that left the market answers 404 and the scene says so; a photo host that refuses a visitor is not the walk's problem.
test.use({
  ignoreBrowserErrors: [[/divarcdn\.com/, /\[http 404\] GET .*\/listings\//], { scope: 'test' }],
});

type Scene = {
  id: string;
  title: string;
  ok: boolean;
  problem: string;
  seconds: number;
  facts: string[];
  shots: string[];
};

type Moment = {
  note: (line: string) => void;
  shot: (name: string, target?: Locator) => Promise<void>;
};

const firstLine = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).split('\n')[0]?.trim() ?? '';

const collapse = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** Fonts ready, no development badge, no focus ring, the images in view loaded: the page as a viewer sees it. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  });
  await page.addStyleTag({ content: HIDE_DEV_BADGE });
  await page
    .waitForFunction(
      () =>
        [...document.images]
          .filter((image) => {
            const box = image.getBoundingClientRect();
            return box.width > 0 && box.bottom > 0 && box.top < window.innerHeight;
          })
          .every((image) => image.complete),
      undefined,
      { timeout: 10_000 },
    )
    .catch(() => undefined);
}

/** «۴۴ آگهی»: the heading that counts the results, as it reads, or a word when the page has none. */
async function resultsCount(page: Page): Promise<string> {
  const heading = page
    .getByRole('heading', { level: 2 })
    .filter({ hasText: /[۰-۹]\s*آگهی\s*$/ })
    .first();
  return (await heading.count()) > 0 ? collapse(await heading.innerText()) : '(no count heading)';
}

/** Sideways overflow in pixels: what a viewer sees as a page that wobbles. */
const overflowOf = (page: Page): Promise<number> =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

async function openListing(page: Page, id: number): Promise<void> {
  const response = await page.goto(`/listings/${String(id)}`);
  if (response?.status() === 404) {
    throw new Error(
      `listing ${String(id)} is not on the market any more: pick another one (pnpm db:psql < docs/submission/pick-examples.sql)`,
    );
  }
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await waitForHydration(page);
}

/** What a listing page shows: its title, its price, its sections, and whether it asked for a re-check. */
async function describeListing(page: Page, moment: Moment): Promise<void> {
  moment.note(`title: ${collapse(await page.getByRole('heading', { level: 1 }).innerText())}`);
  const price = page.locator('[data-price]').first();
  await expect(price, 'the listing shows no price').toBeVisible();
  moment.note(`price: ${collapse(await price.innerText())}`);
  const sections = await page.getByRole('heading', { level: 2 }).allInnerTexts();
  moment.note(`sections: ${sections.map(collapse).join(' | ')}`);
  const recheck = page.locator('[data-recheck]').first();
  if ((await recheck.count()) > 0) {
    moment.note(
      `re-check: ${(await recheck.getAttribute('data-recheck')) ?? '?'} (the listing was last checked more than six hours ago; the page asked the worker to read it again)`,
    );
  }
}

/** Scrolls the price to the top of a phone screen, below the sticky header: the shot that shows the verdict and the gauge. */
async function scrollToPrice(page: Page): Promise<void> {
  await page.evaluate(() => {
    const price = document.querySelector('[data-price]');
    if (price) window.scrollTo(0, price.getBoundingClientRect().top + window.scrollY - 150);
  });
  await settle(page);
}

test('the demo path, scene by scene, with a screenshot of each moment', async ({
  page,
  context,
  request,
}, testInfo) => {
  const project = testInfo.project.name;
  const baseURL = testInfo.project.use.baseURL ?? 'http://127.0.0.1:3000';
  const run = process.env.DEMO_RUN ?? new Date().toISOString().slice(0, 19).replaceAll(':', '-');
  const dir = process.env.DEMO_SHOTS_DIR ?? path.join(SHOTS_ROOT, run);
  await mkdir(dir, { recursive: true });

  // Fail early and plainly when the app is not there: nothing below makes sense without it.
  const alive = await request.get(baseURL).catch(() => undefined);
  if (alive === undefined || !alive.ok()) {
    throw new Error(
      `The app does not answer at ${baseURL}. Start it (pnpm dev, or pnpm build && pnpm start) or set DEMO_BASE_URL.`,
    );
  }

  // The shared fixture answers every listing photo with a drawn stand-in, so that no test reaches a listing site. A rehearsal
  // on the owner's own machine may want the real photos (DEMO_REAL_PHOTOS=1), which the product shows from Divar's own
  // addresses: a later route lets those requests through, and a later route wins.
  if (DEMO.realPhotos)
    await context.route(/^https:\/\/([a-z0-9-]+\.)*divarcdn\.com\//, (route) => route.continue());

  const scenes: Scene[] = [];

  async function scene(id: string, title: string, play: (moment: Moment) => Promise<void>): Promise<void> {
    const entry: Scene = { id, title, ok: true, problem: '', seconds: 0, facts: [], shots: [] };
    const moment: Moment = {
      note: (line) => {
        entry.facts.push(line);
      },
      shot: async (name, target) => {
        await settle(page);
        // 03-listing + «listing-price» is 03-listing-price-phone.png: the scene's number, the moment's name, the screen.
        const file = `${id.split('-')[0] ?? id}-${name}-${project}.png`;
        const options = { path: path.join(dir, file), animations: 'disabled' as const };
        if (target === undefined) await page.screenshot(options);
        else await target.screenshot(options);
        entry.shots.push(file);
      },
    };
    const started = Date.now();
    await test.step(`${id} ${title}`, async () => {
      try {
        await play(moment);
        const overflow = await overflowOf(page);
        if (overflow > 1) entry.facts.push(`WARNING: the page scrolls sideways by ${String(overflow)} px`);
      } catch (error) {
        entry.ok = false;
        entry.problem = firstLine(error);
        const file = `${id}-FAILED-${project}.png`;
        await page.screenshot({ path: path.join(dir, file) }).catch(() => undefined);
        entry.shots.push(file);
      }
    });
    entry.seconds = Math.round((Date.now() - started) / 100) / 10;
    scenes.push(entry);
  }

  // 01. The problem is said over the home page: the hero, its one box, the two ways in.
  await scene('01-home', 'The home page', async ({ note, shot }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await waitForHydration(page);
    note(`title of the page: ${await page.title()}`);
    await shot('home');
    const pasteTab = page.getByRole('tab', { name: SMART_COPY.checkLink });
    if ((await pasteTab.count()) > 0) {
      await pasteTab.click();
      await expect(pasteTab).toHaveAttribute('aria-selected', 'true');
      await shot('paste-tab');
      await page.getByRole('tab', { name: SMART_COPY.submit, exact: true }).click();
    }
  });

  // 02. A plain-Farsi search: the sentence typed in the hero's box lands on the results in one step.
  await scene('02-search', 'A plain-Farsi search', async ({ note, shot }) => {
    await page.goto('/');
    await waitForHydration(page);
    const box = heroBox(page);
    await expect(box).toBeVisible();
    const asked = Date.now();
    await ask(box, DEMO.sentence);
    await page.waitForURL(/\/search\?/, { timeout: 60_000 });
    await expectResultsShown(page);
    note(`sentence: ${DEMO.sentence}`);
    note(`it landed on the results in ${String(Date.now() - asked)} ms: ${decodeURIComponent(page.url())}`);
    const count = await resultsCount(page);
    note(`results: ${count}`);
    const chips = await chipNames(page);
    note(`chips (${String(chips.length)}): ${chips.join(' | ')}`);
    expect(chips.length, 'the sentence became no filter at all').toBeGreaterThan(0);
    expect(count, 'the page shows no count of results').toMatch(/[۰-۹]/);
    expect(count, 'the sentence found no listing: choose another with DEMO_SENTENCE').not.toMatch(/^۰\s/);
    const ids = await page
      .locator('a[href^="/listings/"]')
      .evaluateAll((links) =>
        links.slice(0, 6).map((link) => (link.getAttribute('href') ?? '').replace('/listings/', '')),
      );
    note(`the first results, best deals first: ${ids.join(', ')}`);
    await shot('search');
  });

  // 02b. A chip taken off updates the results at once, and Back brings the first search back.
  await scene('02b-chip', 'A filter chip taken off, then Back', async ({ note, shot }) => {
    await page.goto('/search');
    await waitForHydration(page);
    await whenInteractive(page);
    await ask(searchBar(page), DEMO.sentence);
    await page.waitForURL(/ask=/, { timeout: 60_000 });
    await expectResultsShown(page);
    const before = await resultsCount(page);
    const last = chipsRegion(page)
      .getByRole('button', { name: /^برداشتن/ })
      .last();
    await last.click();
    await expect.poll(() => resultsCount(page), { timeout: 20_000 }).not.toBe(before);
    note(`results: ${before}, then ${await resultsCount(page)} with the last chip off`);
    await shot('chip-off');
    await page.goBack();
    await expectResultsShown(page);
    note(`after Back: ${await resultsCount(page)}`);
  });

  // 03. A listing and its explanation: the verdict, the gauge, the reasons, the comparables, the price history.
  await scene('03-listing', 'A great deal and its explanation', async (moment) => {
    await openListing(page, DEMO.listings.great);
    await describeListing(page, moment);
    await moment.shot('listing');
    await scrollToPrice(page);
    await moment.shot('listing-price');
    const analysis = page.getByRole('region', { name: WORDS.analysis });
    if ((await analysis.count()) > 0) {
      await analysis.scrollIntoViewIfNeeded();
      await moment.shot('listing-analysis', analysis);
    } else {
      moment.note(`WARNING: no region named «${WORDS.analysis}»: the section's name changed (TODO-09)`);
    }
    const comparables = page.getByRole('heading', { level: 2, name: WORDS.comparables });
    if ((await comparables.count()) > 0) {
      await comparables.scrollIntoViewIfNeeded();
      await moment.shot('listing-comparables');
    } else {
      moment.note('WARNING: no comparables section');
    }
    const history = page.getByRole('heading', { level: 2, name: WORDS.history });
    if ((await history.count()) > 0) {
      await history.scrollIntoViewIfNeeded();
      await moment.shot('listing-history');
    }
  });

  // 03b. A price drop, seen in the price history.
  await scene('03b-drop', 'A listing whose price dropped', async (moment) => {
    await openListing(page, DEMO.listings.drop);
    await describeListing(page, moment);
    const history = page.getByRole('heading', { level: 2, name: WORDS.history });
    await expect(history, 'this listing has no price history section').toBeVisible();
    await history.scrollIntoViewIfNeeded();
    await moment.shot('history');
  });

  // 03c. A listing with no rating: the page says why.
  await scene('03c-unrated', 'A listing with no rating, and the reason', async (moment) => {
    await openListing(page, DEMO.listings.unrated);
    await describeListing(page, moment);
    await moment.shot('unrated');
    const analysis = page.getByRole('region', { name: WORDS.analysis });
    if ((await analysis.count()) > 0) {
      await analysis.scrollIntoViewIfNeeded();
      await moment.shot('unrated-analysis', analysis);
    }
  });

  // 03d. The other end of the gauge.
  await scene('03d-overpriced', 'An expensive listing', async (moment) => {
    await openListing(page, DEMO.listings.overpriced);
    await describeListing(page, moment);
    await moment.shot('overpriced');
  });

  // 04. A pasted link: a real paste event into the box, the answer, and how long it took.
  await scene('04-paste', 'A pasted link', async ({ note, shot }) => {
    await page.goto('/check');
    const field = page.getByRole('main').getByRole('textbox').first();
    await expect(field).toBeVisible();
    await waitForHydration(page);
    await field.focus();
    const pasted = Date.now();
    await field.evaluate((input, value) => {
      const data = new DataTransfer();
      data.setData('text', value);
      input.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
      );
    }, DEMO.pastedLink);
    const answer = page.locator('[data-check-answer]').first();
    await expect(answer, 'the pasted link got no answer').toBeVisible({ timeout: 30_000 });
    note(`link: ${DEMO.pastedLink}`);
    note(`answered in ${String(Date.now() - pasted)} ms`);
    const price = answer.locator('[data-price]').first();
    if ((await price.count()) > 0) note(`price: ${collapse(await price.innerText())}`);
    else
      note(
        'WARNING: the answer shows no price: the link is not a listing the database holds and rates (see the shot list, scene 4)',
      );
    await shot('paste');
  });

  // 05. How fresh the index is, and how accurate its numbers are: the status page.
  await scene('05-status', 'The data-status page', async ({ note, shot }) => {
    await page.goto('/status');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('term').first(), 'the status figures did not arrive').toBeVisible({
      timeout: 45_000,
    });
    const lines = (await page.getByRole('main').innerText())
      .split('\n')
      .map(collapse)
      .filter((line) => line !== '');
    note(`the page says (first lines): ${lines.slice(0, 28).join(' / ')}`);
    await shot('status');
    for (const [name, label] of [
      ['status-valuation', WORDS.valuation],
      ['status-extraction', WORDS.extraction],
    ] as const) {
      const region = page.getByRole('region', { name: label });
      if ((await region.count()) > 0) {
        await region.scrollIntoViewIfNeeded();
        await shot(name, region);
      } else {
        note(`WARNING: no region for ${name}`);
      }
    }
  });

  // 06. A model page, if there is time: today's price, by year, the ratings and the trend.
  await scene('06-model', 'A model page', async ({ note, shot }) => {
    await page.goto(DEMO.modelPath);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await waitForHydration(page);
    note(`title: ${collapse(await page.getByRole('heading', { level: 1 }).innerText())}`);
    note(
      `sections: ${(await page.getByRole('heading', { level: 2 }).allInnerTexts()).map(collapse).join(' | ')}`,
    );
    await shot('model');
  });

  // 07. The sentences to choose from: how many listings each returns today, with no screenshot.
  await scene('07-sentences', 'How many listings each sentence returns', async ({ note }) => {
    for (const sentence of DEMO.probes) {
      await page.goto('/search');
      await waitForHydration(page);
      await whenInteractive(page);
      await ask(searchBar(page), sentence);
      await page.waitForURL(/ask=/, { timeout: 60_000 });
      await expectResultsShown(page);
      note(`${sentence} -> ${await resultsCount(page)}; chips: ${(await chipNames(page)).join(' | ')}`);
    }
  });

  // The report: one file for the run, a section per project.
  const failed = scenes.filter((entry) => !entry.ok);
  const rows = scenes
    .map(
      (entry) =>
        `| ${entry.id} | ${entry.title} | ${entry.ok ? 'ok' : 'FAILED'} | ${String(entry.seconds)} | ${entry.ok ? `${String(entry.facts.filter((fact) => fact.startsWith('WARNING')).length)} warnings` : entry.problem.replaceAll('|', '/')} |`,
    )
    .join('\n');
  const details = scenes
    .map(
      (entry) =>
        `### ${entry.id} ${entry.title}: ${entry.ok ? 'ok' : `FAILED: ${entry.problem}`}\n\n${entry.facts.map((fact) => `- ${fact}`).join('\n')}${entry.facts.length > 0 ? '\n' : ''}\nScreenshots: ${entry.shots.length > 0 ? entry.shots.join(', ') : 'none'}\n`,
    )
    .join('\n');
  const reportFile = path.join(dir, 'walk-report.md');
  if (!existsSync(reportFile)) {
    await writeFile(
      reportFile,
      `# Demo walk, ${run}\n\nApp: ${baseURL}\nPhotos: ${DEMO.realPhotos ? "Divar's own, loaded from Divar" : 'drawn stand-ins, nothing reached a listing site'}\nThe numbers a scene found are examples of the day: \`docs/submission/numbers.md\` says which command prints each.\n`,
    );
  }
  await appendFile(
    reportFile,
    `\n## ${project}\n\n| Scene | What | Result | Seconds | Warnings or problem |\n|---|---|---|---|---|\n${rows}\n\n${details}`,
  );
  await testInfo.attach('walk-report.md', { path: reportFile, contentType: 'text/markdown' });
  console.log(
    `\nDemo walk (${project}): ${String(scenes.length - failed.length)} of ${String(scenes.length)} scenes ok. Screenshots and report: ${dir}`,
  );
  for (const entry of failed) console.log(`  FAILED ${entry.id}: ${entry.problem}`);

  expect(
    failed.map((entry) => `${entry.id}: ${entry.problem}`),
    'scenes that failed (the report says what each found)',
  ).toEqual([]);
});
