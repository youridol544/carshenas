import type { Browser, Locator, Page } from '@playwright/test';
import { expect } from './test';

// The smart search's words and helpers for the browser tests (CS-111, docs/specs/S04-plain-farsi-search.md): one box that
// takes a sentence, Enter or the one button, and the results with the filters it meant already applied and shown. Every
// string a test matches on the box, the chips and the notes about the sentence is here, copied from the app's copy
// files (features/search/search-copy.ts, features/home/home-copy.ts, features/search-understanding/understanding-copy.ts),
// so a rewrite of that copy changes one place in the tests; Playwright snapshots keep the zero-width non-joiner that
// retyped Persian loses, so a changed string is copied from one.

export const SMART_COPY = {
  /** The hero's box, named by its label. */
  heroBox: /^چه ماشینی می‌خواهید/,
  /** The search page's box. */
  searchBox: 'جست‌وجو در آگهی‌ها',
  clearBox: 'پاک کردن عبارت جست‌وجو',
  /** The one button of both boxes. */
  submit: 'جست‌وجو',
  checkLink: 'ارزیابی لینک',
  examplesList: 'نمونه‌ی جمله',
  examples: {
    model: '۲۰۶ تیپ ۵ بدون رنگ زیر ۷۰۰ میلیون',
    vague: 'یک ماشین تمیز، کم‌کارکرد و بی‌دردسر',
    family: 'خانوادگی زیر ۱ میلیارد',
  },
  /** The owner's own vague sentence, which names the technical condition too: the clean-and-easy catalogue. */
  ownerSentence: 'یک ماشین تمیز کم کار و بیدردسر میخوام که همه چیش از نظر فنی خوب باشه و تمیز باشه',
  chipsRegion: 'فیلترهای فعال',
  clearFilters: 'پاک کردن فیلترها',
  remove: (text: string) => `برداشتن «${text}»`,
  sentenceRegion: 'درباره‌ی جمله',
  dropped: (words: string) => `آگهی‌ای با «${words}» پیدا نشد. بدون آن نشان می‌دهیم.`,
  putBack: (words: string) => `برگرداندن «${words}»`,
  reading: 'در حال خواندن بقیه‌ی جمله…',
  failed: 'جمله‌ی شما خوانده نشد و همین‌جا مانده است. دوباره امتحان کنید.',
  implausible: (words: string) => `«${words}» را نادیده گرفتیم. این عدد برای خودرو معنی ندارد.`,
  noResults: 'آگهی‌ای با این فیلترها پیدا نشد',
  catalogues: 'مجموعه‌های آماده',
  cleanCatalogue: 'تمیز و بی‌دردسر',
  results: 'نتیجه‌های جست‌وجو',
  /** What the removed two-step flow said: none of it may be on a page any more. */
  gone: { understand: 'بفهم', apply: 'نمایش آگهی‌ها', disclosure: 'با یک جمله بگویید چه می‌خواهید' },
} as const;

export const heroBox = (page: Page): Locator => page.getByRole('searchbox', { name: SMART_COPY.heroBox });
export const searchBar = (page: Page): Locator => page.getByRole('searchbox', { name: SMART_COPY.searchBox });

/** The applied chips (filters and words) as the page lists them. */
export const chipsRegion = (page: Page): Locator =>
  page.getByRole('region', { name: SMART_COPY.chipsRegion });

/** A text as it reads: the no-break spaces that keep a number with its word, as plain spaces. */
export function plain(text: string): string {
  return text.replaceAll('\u00a0', ' ').replaceAll('\u202f', ' ');
}

/** The names of the removable chips, «برداشتن «…»» each, in the order they are shown. */
export async function chipNames(page: Page): Promise<string[]> {
  const buttons = await chipsRegion(page)
    .getByRole('button', { name: /^برداشتن/ })
    .all();
  return Promise.all(buttons.map(async (button) => plain((await button.getAttribute('aria-label')) ?? '')));
}

/** The address as a test reads it: the search's parameters and the sentence kept beside them. */
export function addressOf(page: Page): URL {
  return new URL(page.url());
}

/** The results' count heading: «۱۵ آگهی». */
export const resultsCount = (page: Page, digits: string): Locator =>
  page.getByRole('heading', { level: 2, name: new RegExp(`^${digits}\\s`) });

/** Waits until the page's script runs: before that a submit is the browser's own, answered by a redirect. */
export async function whenInteractive(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    [...document.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea')].every(
      (element) => Object.keys(element).some((key) => key.startsWith('__reactProps$')),
    ),
  );
}

/** Types a sentence into a box and presses Enter. */
export async function ask(box: Locator, sentence: string): Promise<void> {
  await box.fill(sentence);
  await box.press('Enter');
}

/** The search page's results are on screen: the count heading is there, whatever it says. */
export async function expectResultsShown(page: Page): Promise<void> {
  await expect(
    page
      .getByRole('list', { name: SMART_COPY.results })
      .or(page.getByRole('heading', { name: SMART_COPY.noResults })),
  ).toBeVisible();
}

/**
 * Reads the server's caches once before a spec's tests: the lexicon of names a sentence is read against takes a few
 * seconds the first time on a busy machine, and no test's first search should be the one that pays for it. A bare
 * context: nothing outside the app's own host is reached.
 */
export async function primeSentenceSearch(browser: Browser, baseURL: string | undefined): Promise<void> {
  // Scripts on whatever the spec's own options say: a spec that tests the page without them still needs this one drawn.
  const context = await browser.newContext({
    javaScriptEnabled: true,
    ...(baseURL === undefined ? {} : { baseURL }),
  });
  const own = baseURL === undefined ? undefined : new URL(baseURL).host;
  await context.route(
    (url) => own !== undefined && url.host !== own,
    (route) => route.abort(),
  );
  const page = await context.newPage();
  await page.goto('/search?make=pride&ask=%D9%BE%D8%B1%D8%A7%DB%8C%D8%AF');
  await page
    .getByRole('list', { name: SMART_COPY.results })
    .or(page.getByRole('heading', { name: SMART_COPY.noResults }))
    .waitFor();
  await context.close();
}
