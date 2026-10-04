import type { MetadataRoute } from 'next';

// How the deployment shows itself to the outside (CS-119, ADR-0017 point 10). The demo is unlisted: every response
// says noindex and robots.txt closes the whole site, until CARSHENAS_UNLISTED=0 opens it. In a production build every
// response also carries the security headers, and HSTS when the visitor came over https. Pure functions over plain
// values, so each rule is unit-tested; src/server/env.ts reads the environment and src/proxy.ts applies the headers.

export type Exposure = {
  /** Keep the site out of search engines: every response says noindex and robots.txt disallows everything. */
  readonly unlisted: boolean;
  /** Send the security headers: on in a production build, off in development so its tools keep working. */
  readonly securityHeaders: boolean;
};

export type RequestFacts = {
  /** `https` or `http`: the scheme the visitor used, as the reverse proxy reports it. */
  readonly protocol: string;
  /** The host the visitor asked for, without its port. */
  readonly host: string;
};

export type ResponseHeader = readonly [name: string, value: string];

export const ROBOTS_TAG_UNLISTED = 'noindex, nofollow, noarchive, nosnippet, noimageindex';

/** A year. Never `includeSubDomains` or `preload`: this is one demo host, and neither can be taken back. */
export const HSTS_VALUE = 'max-age=31536000';

const SECURITY_HEADERS: readonly ResponseHeader[] = [
  ['X-Content-Type-Options', 'nosniff'],
  ['X-Frame-Options', 'DENY'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ['Cross-Origin-Opener-Policy', 'same-origin'],
  ['Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()'],
  // Only the directives that need no nonce: Next.js writes inline scripts, so a script policy would need every page
  // rendered per request. These close framing, a changed base address, a form sent elsewhere and plugins.
  [
    'Content-Security-Policy',
    "base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'",
  ],
];

const SWITCHED_ON = ['1', 'true'];
const SWITCHED_OFF = ['0', 'false'];

/**
 * CARSHENAS_UNLISTED: `1` or `true` unlists the site, `0` or `false` lists it; unset, a production build is unlisted
 * and development is not. Any other value stops the server with a message saying which, like the other switches.
 */
export function readExposure(environment: Readonly<Record<string, string | undefined>>): Exposure {
  const production = environment.NODE_ENV === 'production';
  const value = environment.CARSHENAS_UNLISTED?.trim().toLowerCase() ?? '';
  if (value !== '' && !SWITCHED_ON.includes(value) && !SWITCHED_OFF.includes(value)) {
    throw new Error(`CARSHENAS_UNLISTED must be 1, true, 0 or false; it is ${JSON.stringify(value)}.`);
  }
  return { unlisted: value === '' ? production : SWITCHED_ON.includes(value), securityHeaders: production };
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/** An address or a loopback name: a browser ignores HSTS for an address, and localhost must never be pinned to https. */
function hasNoHstsName(host: string): boolean {
  return IPV4.test(host) || host.startsWith('[') || host === 'localhost' || host.endsWith('.localhost');
}

/** The headers every response carries, in the order they are set. Empty when nothing applies (development). */
export function exposureHeaders(exposure: Exposure, request: RequestFacts): readonly ResponseHeader[] {
  const headers: ResponseHeader[] = [];
  if (exposure.unlisted) headers.push(['X-Robots-Tag', ROBOTS_TAG_UNLISTED]);
  if (exposure.securityHeaders) {
    headers.push(...SECURITY_HEADERS);
    if (request.protocol === 'https' && !hasNoHstsName(request.host)) {
      headers.push(['Strict-Transport-Security', HSTS_VALUE]);
    }
  }
  return headers;
}

/**
 * What robots.txt says. Unlisted: nothing may be crawled. Listed: the pages are open, and the places that are no one's
 * business (the superadmin section, the buyer's account, the API) stay closed.
 */
export function robotsRules(exposure: Exposure): MetadataRoute.Robots {
  if (exposure.unlisted) return { rules: { userAgent: '*', disallow: '/' } };
  return { rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/account', '/api/'] } };
}
