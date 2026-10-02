import type { Route } from 'next';

// Where a person goes after signing in or out (ADR-0020 point 10). A `next` value comes from the address bar or a
// form, so it is anyone's text: only a path on this site is kept, never another site (an open redirect, OWASP) and
// never the sign-in or sign-up page itself. A path that passes is typed as a Route: it was checked here, at run time.

export const HOME_PATH = '/' as Route;
export const SIGN_IN_PATH = '/sign-in' as Route;
export const SIGN_UP_PATH = '/sign-up' as Route;
export const ACCOUNT_PATH = '/account' as Route;
export const ADMIN_PATH = '/admin' as Route;
export const NOTIFICATIONS_PATH = '/account/notifications' as Route;
export const MARKED_PATH = '/account/marked' as Route;
export const SEARCH_PATH = '/search' as Route;

const PAGES_NEVER_RETURNED_TO: readonly string[] = [SIGN_IN_PATH, SIGN_UP_PATH];
const MAX_LENGTH = 2_048;
// Only for resolving: a path that leaves this origin once resolved was pointing at another site.
const THIS_SITE = 'https://carshenas.invalid';

/**
 * A path on this site to return to, or undefined. `//evil.example`, `/\evil.example` and `https://…` are dropped, and
 * so is anything that only becomes one once resolved: `/..//evil.example` resolves to `//evil.example`, which a browser
 * reads, as a redirect's Location, as another site. So the check is on the path that is returned, not on the input.
 */
export function safeReturnPath(value: unknown): Route | undefined {
  if (typeof value !== 'string' || value.length > MAX_LENGTH || !value.startsWith('/')) return undefined;
  let url: URL;
  try {
    url = new URL(value, THIS_SITE);
  } catch {
    return undefined;
  }
  if (url.origin !== THIS_SITE) return undefined;
  const path = `${url.pathname}${url.search}${url.hash}`;
  if (path.startsWith('//') || new URL(path, THIS_SITE).origin !== THIS_SITE) return undefined;
  if (PAGES_NEVER_RETURNED_TO.includes(url.pathname)) return undefined;
  return path as Route;
}

function isUnder(path: string, section: string): boolean {
  const { pathname } = new URL(path, THIS_SITE);
  return pathname === section || pathname.startsWith(`${section}/`);
}

export function isAdminPath(path: string): boolean {
  return isUnder(path, ADMIN_PATH);
}

/** A page only a signed-in person may see: nowhere to land after signing out. */
export function needsAccount(path: string): boolean {
  return isUnder(path, ACCOUNT_PATH) || isUnder(path, ADMIN_PATH);
}

/** A superadmin lands on the dashboard, or on `next` inside it; a buyer on `next` outside it, or the home page. */
export function landingAfterSignIn(next: Route | undefined, isSuperadmin: boolean): Route {
  if (isSuperadmin) return next !== undefined && isAdminPath(next) ? next : ADMIN_PATH;
  return next !== undefined && !isAdminPath(next) ? next : HOME_PATH;
}

/** A link to a page that keeps `next` when there is one worth returning to (never the home page). */
export function withReturnPath(page: Route, next: string | undefined): Route {
  const kept = safeReturnPath(next);
  return kept === undefined || kept === HOME_PATH ? page : `${page}?next=${encodeURIComponent(kept)}`;
}
