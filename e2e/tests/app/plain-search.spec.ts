import type { Page } from '@playwright/test';
import { removeSearchListings, seedSearchListings, type SearchSeed } from '../../fixtures/search-listings';
import {
  addressOf,
  ask,
  chipNames,
  chipsRegion,
  expectResultsShown,
  primeSentenceSearch,
  resultsCount,
  searchBar,
  SMART_COPY,
  whenInteractive,
} from '../../fixtures/smart-search';
import { expect, test as base } from '../../fixtures/test';

// What a sentence becomes on the search page (CS-62, CS-111, docs/specs/S04-plain-farsi-search.md): the filters it meant
// as removable chips in plain words, the owner's vague request as the clean-and-easy catalogue, the words nobody could
// read as a quiet chip that finds listings or are left out and said when they would find none, the notes about what the
// code did with a word, and the model's switch off by default (nothing waits, nothing is asked, nothing is said).
// Runs against the lane database's real catalogue; thirty seeded listings with a word of their own make the words
// cases exact (fixtures/search-listings.ts). No test reaches a language model.

const SENTENCE = 'پژو ۲۰۶ تیپ ۲ بدون رنگ زیر ۷۰۰ میلیون';
const UNKNOWN_WORD = 'zzqnoword';

const test = base.extend<{ seed: SearchSeed }>({
  seed: async ({}, use) => {
    const seed = await seedSearchListings();
    await use(seed);
    await removeSearchListings(seed);
  },
});

test.beforeAll(async ({ browser }, testInfo) => {
  await primeSentenceSearch(browser, testInfo.project.use.baseURL);
});

async function openSearch(page: Page): Promise<void> {
  await page.goto('/search');
  await expect(searchBar(page)).toBeVisible();
  await whenInteractive(page);
}

async function land(page: Page, sentence: string): Promise<void> {
  await openSearch(page);
  await ask(searchBar(page), sentence);
  await expect(page).toHaveURL(/[?&]ask=/);
  await expectResultsShown(page);
}

test.describe('what a sentence becomes', () => {
  test('a sentence becomes removable chips in plain words, and stays in the box', async ({ page }) => {
    await land(page, SENTENCE);
    const names = await chipNames(page);
    expect(names).toHaveLength(4);
    for (const name of ['پژو ۲۰۶', 'بدون رنگ', 'میلیون']) {
      expect(names.some((one) => one.includes(name))).toBe(true);
    }
    await expect(
      chipsRegion(page).getByRole('button', { name: SMART_COPY.remove('بدون رنگ') }),
    ).toBeVisible();
    const query = addressOf(page).searchParams;
    expect(query.get('model')).toBe('peugeot.206');
    expect(query.get('trim')).toBe('peugeot.206.2');
    expect(query.get('price')).toBe('..700000000');
    expect(query.get('nopaint')).toBe('1');
    expect(query.get('ask')).toBe(SENTENCE);
    await expect(searchBar(page)).toHaveValue(SENTENCE);
  });

  test('the owner’s vague request lands on the clean-and-easy catalogue, each filter shown as a chip', async ({
    page,
  }) => {
    await land(page, SMART_COPY.ownerSentence);
    expect(addressOf(page).searchParams.get('catalogue')).toBe('clean-and-easy');
    const strip = page.getByRole('toolbar', { name: SMART_COPY.catalogues });
    await expect(
      strip.getByRole('link', { name: new RegExp(`^${SMART_COPY.cleanCatalogue}`) }),
    ).toHaveAttribute('aria-current', 'true');
    await expect(page.getByRole('region', { name: SMART_COPY.cleanCatalogue })).toBeVisible();
    // The clean-and-easy filters, each one named: low mileage for its age, a popular model, paint free, no accident, no
    // replaced parts (clean body), and a sound engine, gearbox and chassis (technically sound).
    for (const name of [
      'کم‌کارکرد نسبت به سن',
      'مدل پرطرفدار',
      'بدون رنگ',
      'بدون تصادف',
      'بدون تعویض بدنه',
      'موتور سالم',
      'گیربکس سالم',
      'شاسی سالم و پلمپ',
    ]) {
      await expect(chipsRegion(page).getByRole('button', { name: SMART_COPY.remove(name) })).toBeVisible();
    }
  });

  test('a vague sentence that does not name the technical condition lands with the clean and low-mileage chips', async ({
    page,
  }) => {
    await land(page, SMART_COPY.examples.vague);
    const query = addressOf(page).searchParams;
    for (const filter of ['lowkm', 'popular', 'nopaint', 'noaccident', 'noreplaced']) {
      expect(query.get(filter)).toBe('1');
    }
    for (const name of ['کم‌کارکرد نسبت به سن', 'مدل پرطرفدار', 'بدون رنگ', 'بدون تصادف']) {
      await expect(chipsRegion(page).getByRole('button', { name: SMART_COPY.remove(name) })).toBeVisible();
    }
  });

  test('a price, a year and a mileage land as chips', async ({ page }) => {
    await land(page, 'سمند ۱۴۰۰ زیر ۵۰۰ میلیون زیر ۱۰۰ هزار کیلومتر');
    const query = addressOf(page).searchParams;
    expect(query.get('make')).toBe('samand');
    expect(query.get('year')).toBe('1400..1400');
    expect(query.get('km')).toBe('..100000');
    expect(query.get('price')).toBe('..500000000');
    const names = (await chipNames(page)).join(' | ');
    expect(names).toContain('سمند');
    expect(names).toContain('مدل ۱۴۰۰');
    expect(names).toContain('کارکرد تا ۱۰۰٬۰۰۰ کیلومتر');
    expect(names).toContain('تا ۵۰۰ میلیون تومان');
  });

  test('a make the index does not collect is said, not matched to something else', async ({ page }) => {
    await land(page, 'مزدا ۳');
    await expect(page.getByText(/هنوز در کارشناس جمع‌آوری نمی‌شود/)).toBeVisible();
    await expect(chipsRegion(page).getByRole('button', { name: SMART_COPY.remove('مزدا') })).toBeVisible();
    // Nothing is collected for it: the filters are kept, and the panel names what to take off.
    await expect(page.getByRole('heading', { name: SMART_COPY.noResults })).toBeVisible();
  });

  test('a city outside the market and a number no car has are said, and are not filters', async ({
    page,
  }) => {
    await land(page, 'پژو ۲۰۶ اصفهان');
    await expect(page.getByText(/«اصفهان» را ندارم/)).toBeVisible();
    expect(await chipNames(page)).toHaveLength(1);
    await openSearch(page);
    await ask(searchBar(page), 'پژو ۲۰۶ قیمت ۱ تومان');
    await expect(page.getByText(/«قیمت ۱ تومان» برای خودرو عدد ممکنی نیست/)).toBeVisible();
    expect(await chipNames(page)).toHaveLength(1);
  });
});

test.describe('the words no filter could name', () => {
  test('words the listings have are looked for and shown as a quiet chip that is taken off like any', async ({
    page,
    seed,
  }) => {
    await land(page, `${seed.token} پژو ۲۰۶`);
    const word = chipsRegion(page).getByRole('button', { name: SMART_COPY.remove(seed.token) });
    await expect(word).toBeVisible();
    await expect(word).toContainText(`«${seed.token}»`);
    expect(addressOf(page).searchParams.get('q')).toBe(seed.token);
    await expect(resultsCount(page, '۳۰')).toBeVisible();
    // No note: nothing was left out.
    await expect(page.getByRole('region', { name: SMART_COPY.sentenceRegion })).toHaveCount(0);
    await word.click();
    await expect(page).not.toHaveURL(/[?&]q=/);
    expect(addressOf(page).searchParams.get('ask')).toBe(`${seed.token} پژو ۲۰۶`);
    await expect(chipsRegion(page).getByRole('button', { name: SMART_COPY.remove(seed.token) })).toHaveCount(
      0,
    );
  });

  test('words that would empty the results are left out, said, and put back by one tap', async ({ page }) => {
    await land(page, `پژو ۲۰۶ ${UNKNOWN_WORD}`);
    // Results, not a dead end: the filters alone find listings, the word found none.
    await expect(page.getByRole('list', { name: SMART_COPY.results })).toBeVisible();
    expect(addressOf(page).searchParams.has('q')).toBe(false);
    const notes = page.getByRole('region', { name: SMART_COPY.sentenceRegion });
    await expect(notes).toContainText(SMART_COPY.dropped(UNKNOWN_WORD));
    await expect(searchBar(page)).toHaveValue(`پژو ۲۰۶ ${UNKNOWN_WORD}`);

    await notes.getByRole('button', { name: SMART_COPY.putBack(UNKNOWN_WORD) }).click();
    await expect(page).toHaveURL(new RegExp(`[?&]q=${UNKNOWN_WORD}(&|$)`));
    // The buyer asked for it: the panel says nothing was found and names what to take off, never a dead end.
    await expect(page.getByRole('heading', { name: SMART_COPY.noResults })).toBeVisible();
    await expect(page.getByRole('region', { name: SMART_COPY.sentenceRegion })).toHaveCount(0);
    const word = chipsRegion(page).getByRole('button', { name: SMART_COPY.remove(UNKNOWN_WORD) });
    await expect(word).toBeVisible();
    await word.click();
    await expect(page.getByRole('list', { name: SMART_COPY.results })).toBeVisible();
  });

  test('of two unread words the one that finds listings stays, step by step', async ({ page, seed }) => {
    await land(page, `${seed.token} پژو ۲۰۶ ${UNKNOWN_WORD}`);
    expect(addressOf(page).searchParams.get('q')).toBe(seed.token);
    await expect(
      chipsRegion(page).getByRole('button', { name: SMART_COPY.remove(seed.token) }),
    ).toBeVisible();
    await expect(page.getByRole('region', { name: SMART_COPY.sentenceRegion })).toContainText(
      SMART_COPY.dropped(UNKNOWN_WORD),
    );
    await expect(page.getByRole('list', { name: SMART_COPY.results })).toBeVisible();
    await expect(resultsCount(page, '۳۰')).toBeVisible();
  });

  test('nonsense is not a dead end: it is left out, said, and everything is shown', async ({ page }) => {
    await land(page, 'asdfgh');
    expect(addressOf(page).searchParams.has('q')).toBe(false);
    await expect(page.getByRole('region', { name: SMART_COPY.sentenceRegion })).toContainText(
      SMART_COPY.dropped('asdfgh'),
    );
    await expect(page.getByRole('list', { name: SMART_COPY.results })).toBeVisible();
    expect(await chipNames(page)).toEqual([]);
    await page
      .getByRole('region', { name: SMART_COPY.sentenceRegion })
      .getByRole('button', { name: SMART_COPY.putBack('asdfgh') })
      .click();
    await expect(page.getByRole('heading', { name: SMART_COPY.noResults })).toBeVisible();
    await expect(chipsRegion(page).getByRole('button', { name: SMART_COPY.remove('asdfgh') })).toBeVisible();
  });
});

test.describe('the model’s switch is off, which is its default', () => {
  test('a sentence the code could not read in full shows its results at once, with no waiting line and no question to the model', async ({
    page,
  }) => {
    const asked: string[] = [];
    await page.route('**/api/search/understand', async (route) => {
      asked.push(route.request().url());
      await route.continue();
    });
    await land(page, `پژو ۲۰۶ ${UNKNOWN_WORD}`);
    await expect(page.getByRole('list', { name: SMART_COPY.results })).toBeVisible();
    await expect(page.getByText(SMART_COPY.reading)).toHaveCount(0);
    // The page is interactive and its effects have run: a question would have been asked by now.
    await whenInteractive(page);
    expect(asked).toEqual([]);
  });
});

test.describe('the floor', () => {
  test('is right to left, fits the screen, passes the accessibility scan and its chips are 44 px targets', async ({
    page,
    seed,
    rtl,
    a11y,
  }) => {
    await land(page, `${seed.token} پژو ۲۰۶ ${UNKNOWN_WORD}`);
    await rtl.expectDocumentRtl();
    await rtl.expectNoHorizontalOverflow();
    await a11y.check();
    for (const chip of await chipsRegion(page).getByRole('button').all()) {
      const box = await chip.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(43.5);
    }
    await expect(page.getByRole('button', { name: SMART_COPY.remove(seed.token) })).toBeVisible();
  });

  test('nothing moves while a page with a sentence, a quiet chip and a line about left-out words loads', async ({
    page,
    seed,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'layout-shift entries exist only in Chromium');
    await page.addInitScript(() => {
      let total = 0;
      new PerformanceObserver((entries) => {
        for (const entry of entries.getEntries() as (PerformanceEntry & {
          value: number;
          hadRecentInput: boolean;
        })[]) {
          if (!entry.hadRecentInput) total += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
      Object.defineProperty(window, 'layoutShiftTotal', { get: () => total });
    });
    const sentence = `${seed.token} پژو ۲۰۶ ${UNKNOWN_WORD}`;
    await page.goto(`/search?q=${seed.token}&model=peugeot.206&ask=${encodeURIComponent(sentence)}`);
    await expect(page.getByRole('region', { name: SMART_COPY.sentenceRegion })).toBeVisible();
    await expect(page.getByRole('list', { name: SMART_COPY.results })).toBeVisible();
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    expect(await page.evaluate(() => Number(Reflect.get(window, 'layoutShiftTotal')))).toBeLessThan(0.02);
  });

  test('screenshots for the evidence', async ({ page, seed }, testInfo) => {
    await land(page, `${seed.token} پژو ۲۰۶ ${UNKNOWN_WORD}`);
    await expect(page.getByRole('region', { name: SMART_COPY.sentenceRegion })).toBeVisible();
    await page.screenshot({
      path: `../docs/evidence/query-understanding/2026-10-04/screenshots/${testInfo.project.name}-words-kept-and-left-out.png`,
    });
    await openSearch(page);
    await ask(searchBar(page), SMART_COPY.ownerSentence);
    await expect(page.getByRole('region', { name: SMART_COPY.cleanCatalogue })).toBeVisible();
    await page.screenshot({
      path: `../docs/evidence/query-understanding/2026-10-04/screenshots/${testInfo.project.name}-owner-sentence.png`,
    });
  });
});
