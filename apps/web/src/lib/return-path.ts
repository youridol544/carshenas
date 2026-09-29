import type { Route } from 'next';

// Where a person goes after signing in or out (ADR-0020 point 10). A `next` value comes from the address bar or a
// form, so it is anyone's text: only a path on this site is kept, never another site (an open redirect, OWASP) and
// never the sign-in or sign-up page itself.

export const HOME_PATH = '/';
export const SIGN_IN_PATH = '/sign-in';
export const SIGN_UP_PATH = '/sign-up';
export const ACCOUNT_PATH = '/account';
export const ADMIN_PATH = '/admin';

const PAGES_NEVER_RETURNED_TO: readonly string[] = [SIGN_IN_PATH, SIGN_UP_PATH];
const MAX_LENGTH = 2_048;
// Only for resolving: a path that leaves this origin once resolved was pointing at another site.
const THIS_SITE = 'https://carshenas.invalid';

/** A path on this site to return to, or undefined. `//evil.example`, `/\evil.example` and `https://…` are dropped. */
export function safeReturnPath(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > MAX_LENGTH || !value.startsWith('/')) return undefined;
  let url: URL;
  try {
    url = new URL(value, THIS_SITE);
  } catch {
    return undefined;
  }
  if (url.origin !== THIS_SITE || value.startsWith('//') || value.startsWith('/\\')) return undefined;
  if (PAGES_NEVER_RETURNED_TO.includes(url.pathname)) return undefined;
  return `${url.pathname}${url.search}${url.hash}`;
}

export function isAdminPath(path: string): boolean {
  const { pathname } = new URL(path, THIS_SITE);
  return pathname === ADMIN_PATH || pathname.startsWith(`${ADMIN_PATH}/`);
}

/** A superadmin lands on the dashboard, or on `next` inside it; a buyer on `next` outside it, or the home page. */
export function landingAfterSignIn(next: string | undefined, isSuperadmin: boolean): string {
  if (isSuperadmin) return next !== undefined && isAdminPath(next) ? next : ADMIN_PATH;
  return next !== undefined && !isAdminPath(next) ? next : HOME_PATH;
}

/** A link to a page that keeps `next` when there is one worth returning to (never the home page). */
export function withReturnPath(
  page: typeof SIGN_IN_PATH | typeof SIGN_UP_PATH,
  next: string | undefined,
): Route {
  const kept = safeReturnPath(next);
  return (
    kept === undefined || kept === HOME_PATH ? page : `${page}?next=${encodeURIComponent(kept)}`
  ) as Route;
}
