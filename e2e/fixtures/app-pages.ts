import type { Page } from '@playwright/test';
import { expect } from './test';

export type AppPage = {
  name: string;
  path: string;
  /** CSS selector the gorilla stays inside; `body` for a whole page. */
  scope: string;
  /** Resolves when the page is usable: its heading shows and React has hydrated every control. */
  ready: (page: Page) => Promise<void>;
};

/**
 * Resolves once React has hydrated every link, button and field. A streamed boundary, such as the header's account
 * slot, hydrates after the heading shows; a test that rewrites text or clicks before then meets markup React has not
 * taken over (a text rewrite made it throw error #418, a hydration mismatch, 2026-09-29).
 */
async function hydrated(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    [...document.querySelectorAll('a[href], button, input, select, textarea')].every((element) =>
      Object.keys(element).some((key) => key.startsWith('__reactProps$')),
    ),
  );
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
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await hydrated(page);
    },
  },
  {
    name: 'sign-in',
    path: '/sign-in',
    scope: 'body',
    ready: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: 'ورود به کارشناس' })).toBeVisible();
      await hydrated(page);
    },
  },
  {
    name: 'sign-up',
    path: '/sign-up',
    scope: 'body',
    ready: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: 'ثبت‌نام در کارشناس' })).toBeVisible();
      await hydrated(page);
    },
  },
  {
    name: 'design language',
    path: '/design',
    scope: 'body',
    ready: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: 'زبان طراحی کارشناس' })).toBeVisible();
      await hydrated(page);
    },
  },
];
