import 'server-only';

// What a request says about the host it was sent to and the page that sent it. Next.js fills X-Forwarded-Host and
// X-Forwarded-Proto from the connection when a request has none; behind the reverse proxy (CS-37) the proxy passes
// the public Host and scheme, which Next.js's own Server Action check relies on too.

type RequestHeaders = Pick<Headers, 'get'>;

function firstValue(value: string | null): string {
  return (value ?? '').split(',')[0]?.trim().toLowerCase() ?? '';
}

/** The host and port the request was addressed to: carshenas.ir, 127.0.0.1:3000, [::1]:3200. */
function requestAuthority(headers: RequestHeaders): string {
  return firstValue(headers.get('x-forwarded-host') ?? headers.get('host'));
}

/** The host without its port. */
export function requestHost(headers: RequestHeaders): string {
  const authority = requestAuthority(headers);
  if (authority.startsWith('[')) return authority.slice(0, authority.indexOf(']') + 1);
  return authority.split(':')[0] ?? '';
}

const LOOPBACK_HOST = /^(localhost|127(\.\d{1,3}){3}|\[::1\])$/;

/**
 * Plain http to this machine itself: development and the browser tests. There cookies drop `Secure` and the
 * `__Host-` prefix, because Playwright's WebKit refuses every Secure cookie over http (ADR-0020 point 6). A deployment
 * answers on a public host, where cookies are always `__Host-` and Secure, whatever the scheme header says.
 */
export function isPlainHttpLoopback(headers: RequestHeaders): boolean {
  const scheme = firstValue(headers.get('x-forwarded-proto')) || 'http';
  return scheme === 'http' && LOOPBACK_HOST.test(requestHost(headers));
}

/** The name of the session or device cookie for this request: `__Host-session`, or `session` over plain loopback http. */
export function accountCookieName(kind: 'session' | 'device', headers: RequestHeaders): string {
  return isPlainHttpLoopback(headers) ? kind : `__Host-${kind}`;
}

/**
 * Whether a request that changes state came from a page of this site (ADR-0020 point 7): `Sec-Fetch-Site` when the
 * browser sends it, otherwise an `Origin` naming this host; a request with neither is refused, and so is
 * `Origin: null`. Next.js checks Server Actions too, but lets a request without `Origin` through.
 */
export function isSameOriginRequest(headers: RequestHeaders): boolean {
  const site = headers.get('sec-fetch-site');
  if (site !== null) return site === 'same-origin';
  const origin = headers.get('origin');
  if (origin === null || origin === 'null') return false;
  try {
    return new URL(origin).host === requestAuthority(headers);
  } catch {
    return false;
  }
}
