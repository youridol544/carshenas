import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { waitForHydration } from '../gorilla/layout';
import { expect } from './test';

// Accounts for the browser tests (CS-39). Buyers sign up through the page like anyone; a superadmin is made the one
// way the product allows, `pnpm account:superadmin`, which runs as the migration role from the repository's .env, so
// these tests need the database the app under test uses (the local one, or CI's from CS-38).

const REPOSITORY = fileURLToPath(new URL('../..', import.meta.url));

export const COPY = {
  signInLink: 'ورود / ثبت‌نام',
  username: 'نام کاربری',
  password: 'رمز عبور',
  signIn: 'ورود',
  signUp: 'ثبت‌نام',
  menu: 'منوی حساب کاربری',
  account: 'حساب کاربری',
  admin: 'پنل مدیریت',
  signOut: 'خروج از حساب',
  wrong: 'نام کاربری یا رمز عبور درست نیست.',
  summary: 'این موارد را درست کنید',
} as const;

/** A name nobody has, within the username rules. */
export function uniqueUsername(prefix = 'e2e'): string {
  return `${prefix}_${randomBytes(5).toString('hex')}`;
}

/** Long enough, not common, not built from a name. */
export function newPassword(): string {
  return `blue tiger ${randomBytes(6).toString('hex')}`;
}

/** One superadmin per test worker, given a fresh password on every run. */
export function superadminFor(workerIndex: number): { username: string; password: string } {
  const username = `e2e_superadmin_${String(workerIndex)}`;
  const password = `e2e-${randomBytes(16).toString('hex')}`;
  execFileSync('pnpm', ['--silent', 'account:superadmin', username, '--reset-password', '--password-stdin'], {
    cwd: REPOSITORY,
    input: `${password}\n`,
    stdio: ['pipe', 'ignore', 'inherit'],
  });
  return { username, password };
}

/**
 * The visible form's fields, by role: Next.js keeps the page it just left in the document, hidden, and a role
 * locator, unlike a label locator, skips what is hidden.
 */
export function usernameField(page: Page) {
  return page.getByRole('textbox', { name: COPY.username, exact: true });
}

export function passwordField(page: Page) {
  return page.getByRole('textbox', { name: COPY.password, exact: true });
}

export async function fillCredentials(page: Page, username: string, password: string): Promise<void> {
  await usernameField(page).fill(username);
  await passwordField(page).fill(password);
}

/** Signs up through the page; signing up also signs in and comes back to the home page. */
export async function signUp(page: Page, username: string, password: string): Promise<void> {
  await page.goto('/sign-up');
  await fillCredentials(page, username, password);
  await page.getByRole('button', { name: COPY.signUp, exact: true }).click();
  await expect(page.getByRole('button', { name: COPY.menu })).toBeVisible();
}

/**
 * Sends the sign-in form, once React has taken it over: a dev server can show the page before it hydrates, and a form
 * filled that early went out with an empty username (CS-40's task review). A failed attempt's answer has arrived once
 * the password field is empty again.
 */
export async function signIn(page: Page, username: string, password: string): Promise<void> {
  await waitForHydration(page);
  await fillCredentials(page, username, password);
  await page.getByRole('button', { name: COPY.signIn, exact: true }).click();
}

export function errorSummary(page: Page) {
  return page.getByRole('heading', { name: COPY.summary }).locator('..');
}

export async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: COPY.menu }).click();
  await page.getByRole('menuitem', { name: COPY.signOut }).click();
  // «ورود / ثبت‌نام», or «ورود» alone where the header is narrow.
  await expect(page.getByRole('link', { name: new RegExp(`^${COPY.signIn}`) })).toBeVisible();
}
