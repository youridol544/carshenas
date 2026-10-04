import { toLatinDigits } from '@carshenas/locale/digits';

// Reads what a buyer pasted (CS-65), by code, with no model and no network: the text may be a bare address, an address
// with its scheme, or a message that carries one («نگاه کن: https://divar.ir/v/…»). A Divar listing's address ends with
// the listing's token (`/v/<token>`, or `/v/<slug>/<token>` for the long form that carries the title), and the token is
// what the listing table keeps as `source_listing_key`. The long form's slug is the ad's title (CS-115): it is kept, as
// text, for the catalogue's names to read the car from; it is never fetched and never shown. Anything else is told apart
// by what the buyer should do next: not a link at all, a link of another site (only Divar is supported), a Divar
// address that is not one listing's. The same function runs in the browser (so a wrong paste is answered at once) and
// on the server (which never trusts it).

export const MAX_PASTE_LENGTH = 2000;
/** The most characters of an ad's title the reader keeps: a car's name is in the first words. */
export const MAX_SLUG_LENGTH = 200;

/** The token shape the database accepts (wanted_link_key_format): what Divar's tokens look like, with room to spare. */
const TOKEN = /^[A-Za-z0-9_-]{6,32}$/;
/** The first thing in the text that looks like an address: an optional scheme, a dotted host, an optional path. */
const ADDRESS = /(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:[/?#][^\s]*)?/i;
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;
const TRAILING_PUNCTUATION = /[.,;:!?)\]}»،؛؟"'\u06D4]+$/u;

/** Sites buyers are likely to paste from, named in the message so it is plain that the paste was understood. */
const KNOWN_SITES: Readonly<Record<string, string>> = {
  'bama.ir': 'باما',
  'sheypoor.com': 'شیپور',
  'iranecar.com': 'ایران‌ایکار',
  'khodro45.com': 'خودرو۴۵',
  'karnameh.com': 'کارنامه',
  'truecar.ir': 'ترو کار',
};

export type LinkReading =
  /** Nothing but blanks. */
  | { readonly kind: 'empty' }
  /** No address in the text. */
  | { readonly kind: 'not_a_link' }
  /** An address of another site; `name` is the site's Farsi name when it is a known one. */
  | { readonly kind: 'other_site'; readonly host: string; readonly name: string | null }
  /** A Divar address that is not one listing's (a category page, the home page, a search). */
  | { readonly kind: 'divar_other' }
  /** A Divar listing: its token, and the title its address carries (dashes as written), null for the short form. */
  | { readonly kind: 'divar_listing'; readonly token: string; readonly slug: string | null };

function hostOf(address: string): URL | null {
  const withScheme = /^https?:\/\//i.test(address) ? address : `https://${address}`;
  return URL.canParse(withScheme) ? new URL(withScheme) : null;
}

function isDivarHost(host: string): boolean {
  return host === 'divar.ir' || host.endsWith('.divar.ir');
}

function decoded(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** What a pasted text is. Total: it never throws, whatever it is given. */
export function readPastedLink(text: string): LinkReading {
  const clean = toLatinDigits(text.slice(0, MAX_PASTE_LENGTH).replace(INVISIBLE, '')).trim();
  if (clean === '') return { kind: 'empty' };
  const found = ADDRESS.exec(clean)?.[0];
  if (found === undefined) return { kind: 'not_a_link' };
  const url = hostOf(found.replace(TRAILING_PUNCTUATION, ''));
  if (url === null) return { kind: 'not_a_link' };
  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, '');
  if (!isDivarHost(host)) {
    const known = Object.entries(KNOWN_SITES).find(([site]) => host === site || host.endsWith(`.${site}`));
    return { kind: 'other_site', host, name: known?.[1] ?? null };
  }
  const segments = url.pathname
    .split('/')
    .filter((segment) => segment !== '')
    .map(decoded);
  const token = segments.length >= 2 && segments[0] === 'v' ? segments.at(-1) : undefined;
  if (token === undefined || !TOKEN.test(token)) return { kind: 'divar_other' };
  const slug = toLatinDigits(segments.slice(1, -1).join(' '))
    .replace(INVISIBLE, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SLUG_LENGTH)
    .trim();
  return { kind: 'divar_listing', token, slug: slug === '' ? null : slug };
}

/**
 * The tidy address the answer page is asked for: shareable, and the same for every way of writing a listing's link. It
 * keeps the title when the link had one, because the car is read from it.
 */
export function canonicalDivarAddress(
  listing: string | { readonly token: string; readonly slug: string | null },
): string {
  const { token, slug } = typeof listing === 'string' ? { token: listing, slug: null } : listing;
  return slug === null || slug === ''
    ? `https://divar.ir/v/${token}`
    : `https://divar.ir/v/${encodeURIComponent(slug)}/${token}`;
}

/** The token in the answer page's address (`?link=`), or the reason there is none. */
export function readLinkParam(value: string | undefined): LinkReading {
  return value === undefined ? { kind: 'empty' } : readPastedLink(value);
}
