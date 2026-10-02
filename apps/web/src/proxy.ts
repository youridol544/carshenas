import { NextResponse, type NextRequest } from 'next/server';
import { isAdminPath, SIGN_IN_PATH, withReturnPath } from '@/lib/return-path';
import { isUndecodablePath } from '@/lib/undecodable-path';
import { readListingId } from '@/lib/listing-id';
import { accountCookieName } from '@/server/auth/request-origin';
import { findSessionAccount } from '@/server/auth/sessions';
import { sessionTokenSha256 } from '@/server/auth/session-token';
import { probeListingPage } from '@/server/db/listing-existence';
import { probeModelPage } from '@/server/db/model-existence';

// Honest HTTP statuses for the pages that need an account (ADR-0020 point 10). With Cache Components every dynamic
// route streams its static shell first, so a redirect() or notFound() from the page arrives inside a 200; the
// bundled not-found.md says to run such a check in proxy instead. So a visitor asking for /account gets a real 307 to
// sign in, and anyone but the superadmin asking for /admin a real 404. This is never the authorisation boundary:
// the pages, their actions and their queries check the session themselves. Only document and navigation requests
// (GET, HEAD) pass here; a Server Action's POST goes on to the action, which checks for itself.

const NOT_FOUND = '/__not-found';
// The catalogue's slugs (the make_slug_format and model_slug_format checks): lower-case words joined by hyphens.
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export async function proxy(request: NextRequest): Promise<NextResponse> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return NextResponse.next();
  // The listing page's address (CS-64): a real 404 for an address that is no listing's, which the page cannot send itself
  // once it has started to stream, and for an escape Next.js cannot decode, which it would answer in English.
  if (request.nextUrl.pathname.startsWith('/listings/')) {
    const { pathname } = request.nextUrl;
    if (isUndecodablePath(pathname)) return NextResponse.rewrite(new URL(NOT_FOUND, request.url));
    const id = readListingId(pathname.slice('/listings/'.length));
    if (id === undefined) return NextResponse.rewrite(new URL(NOT_FOUND, request.url));
    // Only a probe that says the listing is missing is a 404; one that failed lets the page answer for itself.
    return (await probeListingPage(id)) === 'missing'
      ? NextResponse.rewrite(new URL(NOT_FOUND, request.url))
      : NextResponse.next();
  }
  // A model's page (CS-67): /models/<make>/<model>, a real 404 for a model that is not in the catalogue (the same reason),
  // and for a path under /models that no page answers. The index, /models, passes.
  if (request.nextUrl.pathname === '/models') return NextResponse.next();
  if (request.nextUrl.pathname.startsWith('/models/')) {
    const { pathname } = request.nextUrl;
    if (isUndecodablePath(pathname)) return NextResponse.rewrite(new URL(NOT_FOUND, request.url));
    const [makeSlug, modelSlug, ...rest] = pathname.slice('/models/'.length).split('/');
    if (makeSlug === undefined || modelSlug === undefined || rest.length > 0 || !SLUG.test(makeSlug) || !SLUG.test(modelSlug)) {
      return NextResponse.rewrite(new URL(NOT_FOUND, request.url));
    }
    return (await probeModelPage(makeSlug, modelSlug)) === 'missing'
      ? NextResponse.rewrite(new URL(NOT_FOUND, request.url))
      : NextResponse.next();
  }
  const token = request.cookies.get(accountCookieName('session', request.headers))?.value;
  const tokenSha256 = token === undefined ? undefined : sessionTokenSha256(token);
  const account = tokenSha256 === undefined ? undefined : await findSessionAccount(tokenSha256);
  const { pathname, search } = request.nextUrl;
  if (isAdminPath(pathname)) {
    // A path with no page behind it: the app's own not-found page, with its 404, at the address that was asked for.
    return account?.role === 'superadmin'
      ? NextResponse.next()
      : NextResponse.rewrite(new URL(NOT_FOUND, request.url));
  }
  if (account === undefined) {
    return NextResponse.redirect(new URL(withReturnPath(SIGN_IN_PATH, `${pathname}${search}`), request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/account', '/account/:path*', '/admin', '/admin/:path*', '/listings/:path*', '/models/:path*'],
};
