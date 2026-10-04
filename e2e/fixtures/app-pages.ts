import type { Page } from '@playwright/test';
import type { CoverageSeed } from './check-coverage';
import { expect } from './test';

export type AppPage = {
  name: string;
  path: string;
  /** CSS selector the gorilla stays inside; `body` for a whole page. */
  scope: string;
  /** Resolves when the page is usable. */
  ready: (page: Page) => Promise<void>;
  /** Resolves when what streams in behind the shell has arrived; tests that measure the whole page wait for it. */
  loaded?: (page: Page) => Promise<void>;
};

/**
 * The address of the answer for an ad whose car is one the coverage tests made (fixtures/check-coverage.ts, handed over by the
 * global setup): a model Carshenas does not read, or a make with models of its own to choose among. Without the seed (the
 * harness's own run) it is the empty page.
 */
function coverageAnswer(kind: 'model' | 'make'): string {
  const text = process.env.E2E_COVERAGE_SEED;
  if (text === undefined) return '/check';
  const seed = JSON.parse(text) as CoverageSeed;
  const slug = kind === 'model' ? seed.models['mobile:layout']?.slug : seed.makes['mobile:chooser']?.slug;
  if (slug === undefined) return '/check';
  return `/check?link=${encodeURIComponent(`https://divar.ir/v/${encodeURIComponent(slug)}/stressmatrix1`)}`;
}

/**
 * Every page of the app. The layout stress matrix (tests/app/layout-stress.spec.ts) and the gorilla
 * (tests/chaos/) cover each entry, so add a page here in the same change that adds its route. The /diagnostics
 * routes are not listed: they fail on purpose, answer not-found unless CARSHENAS_DIAGNOSTICS=1, and
 * tests/app/observability.spec.ts covers them.
 */
export const APP_PAGES: readonly AppPage[] = [
  {
    name: 'home',
    path: '/',
    scope: 'body',
    ready: async (page) => {
      // The hero is part of the prerendered shell; the body types and catalogue rows stream in behind it.
      await expect(
        page.getByRole('heading', { level: 1, name: 'ماشین درست را با قیمت درست بخرید' }),
      ).toBeVisible();
    },
    loaded: async (page) => {
      await expect(page.getByRole('status').filter({ hasText: 'در حال بارگذاری آگهی‌ها' })).toHaveCount(0);
    },
  },
  {
    name: 'search',
    path: '/search',
    scope: 'body',
    ready: async (page) => {
      // The heading is part of the prerendered shell. The results stream in behind it, after the stylesheet when the
      // network is slow, so waiting for them here would fail the slow-network test; every other test loads the
      // page first, and tests/app/search.spec.ts looks at the cards themselves.
      await expect(page.getByRole('heading', { level: 1, name: 'جست‌وجوی خودرو' })).toBeVisible();
    },
    loaded: async (page) => {
      // The skeleton's own status line goes when the results are in.
      await expect(page.getByRole('status').filter({ hasText: 'در حال بارگذاری آگهی‌ها' })).toHaveCount(0);
    },
  },
  {
    // A rated listing seeded for the run (fixtures/global-setup.ts), whose page was read an hour ago.
    name: 'listing',
    path: `/listings/${process.env.E2E_LISTING_ID ?? '1'}`,
    scope: 'body',
    ready: async (page) => {
      // The listing page is a blocking route (its title, price and first photo are in the first response), so the
      // heading is there when the document is.
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    },
    loaded: async (page) => {
      await expect(
        page
          .getByRole('region', { name: 'تحلیل قیمت این آگهی' })
          .or(page.getByRole('heading', { name: 'تحلیل قیمت' })),
      ).toBeVisible();
    },
  },
  {
    name: 'check a link',
    path: '/check',
    scope: 'body',
    ready: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: 'ارزیابی لینک آگهی' })).toBeVisible();
    },
  },
  {
    // The answer for the seeded rated listing's link (fixtures/global-setup.ts hands its token over).
    name: 'check a link, answered',
    path: `/check?link=${encodeURIComponent(`https://divar.ir/v/e2e-lp-${process.env.E2E_LISTING_TOKEN ?? 'none'}-rated`)}`,
    scope: 'body',
    ready: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: 'ارزیابی لینک آگهی' })).toBeVisible();
    },
    loaded: async (page) => {
      await expect(page.locator('[data-check-answer]')).toBeVisible();
    },
  },
  {
    // The car is not one Carshenas reads (CS-115): the limit, the cars it reads, the one action.
    name: 'check a link, outside coverage',
    path: coverageAnswer('model'),
    scope: 'body',
    ready: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: 'ارزیابی لینک آگهی' })).toBeVisible();
    },
    loaded: async (page) => {
      await expect(page.locator('[data-check-answer]')).toBeVisible();
    },
  },
  {
    // Only the make is told: the buyer picks the model among its models.
    name: 'check a link, only the make is told',
    path: coverageAnswer('make'),
    scope: 'body',
    ready: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: 'ارزیابی لینک آگهی' })).toBeVisible();
    },
    loaded: async (page) => {
      await expect(page.locator('[data-check-answer]')).toBeVisible();
    },
  },
  {
    // A short link has no title: not told, with what a full link looks like.
    name: 'check a link, no title',
    path: `/check?link=${encodeURIComponent('https://divar.ir/v/stressmatrix2')}`,
    scope: 'body',
    ready: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: 'ارزیابی لینک آگهی' })).toBeVisible();
    },
    loaded: async (page) => {
      await expect(page.locator('[data-check-answer]')).toBeVisible();
    },
  },
  {
    name: 'models',
    path: '/models',
    scope: 'body',
    ready: async (page) => {
      // The heading is the prerendered shell; the models stream in behind it.
      await expect(page.getByRole('heading', { level: 1, name: 'مدل‌های خودرو' })).toBeVisible();
    },
    loaded: async (page) => {
      await expect(page.getByRole('status').filter({ hasText: 'در حال بارگذاری اطلاعات مدل' })).toHaveCount(
        0,
      );
    },
  },
  {
    // A catalogue model that has listings in the lane's data, or none: either way a designed page (CS-67).
    name: 'model',
    path: '/models/peugeot/206',
    scope: 'body',
    ready: async (page) => {
      // A blocking route: the name is in the first response; the trend and the deals stream in behind it.
      await expect(page.getByRole('heading', { level: 1, name: 'پژو ۲۰۶' })).toBeVisible();
    },
    loaded: async (page) => {
      await expect(page.getByRole('status').filter({ hasText: 'در حال بارگذاری اطلاعات مدل' })).toHaveCount(
        0,
      );
    },
  },
  {
    name: 'sign-in',
    path: '/sign-in',
    scope: 'body',
    ready: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: 'ورود به کارشناس' })).toBeVisible();
    },
  },
  {
    name: 'sign-up',
    path: '/sign-up',
    scope: 'body',
    ready: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: 'ثبت‌نام در کارشناس' })).toBeVisible();
    },
  },
  {
    name: 'data status',
    path: '/status',
    scope: 'body',
    // The shell is the title and the lead; the figures stream in after it, as a slow network allows.
    ready: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: 'تازگی داده‌ها' })).toBeVisible();
    },
  },
  {
    name: 'design language',
    path: '/design',
    scope: 'body',
    ready: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: 'زبان طراحی کارشناس' })).toBeVisible();
    },
  },
];
