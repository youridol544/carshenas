import type { Page } from '@playwright/test';
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
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
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
    name: 'design language',
    path: '/design',
    scope: 'body',
    ready: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: 'زبان طراحی کارشناس' })).toBeVisible();
    },
  },
];
