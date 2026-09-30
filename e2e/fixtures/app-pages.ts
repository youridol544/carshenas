import type { Page } from '@playwright/test';
import { expect } from './test';

export type AppPage = {
  name: string;
  path: string;
  /** CSS selector the gorilla stays inside; `body` for a whole page. */
  scope: string;
  /** Resolves when the page is usable. */
  ready: (page: Page) => Promise<void>;
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
    ready: async (page) => {
      await expect(page.getByRole('heading', { level: 2, name: 'منبع‌ها' })).toBeVisible();
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
