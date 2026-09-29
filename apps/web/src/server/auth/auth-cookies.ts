import 'server-only';
import { cookies, headers } from 'next/headers';
import { isPlainHttpLoopback } from '@/server/auth/request-origin';

// The two cookies of accounts (ADR-0020 points 6 and 8), both HttpOnly and SameSite=Lax, written only by Server Actions:
// the session, which ends with its row, and the device, which lets a browser that signed into an account before keep
// signing in while someone else is guessing at it. Over https each is a `__Host-` cookie (Secure, this host only,
// Path=/); over plain http on a loopback host, the name drops the prefix and the cookie drops Secure.

type CookieKind = 'session' | 'device';

// Browsers keep a cookie at most 400 days (Chrome since 2022; RFC 6265bis).
const DEVICE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

async function cookieSettings(kind: CookieKind): Promise<{ name: string; secure: boolean }> {
  return isPlainHttpLoopback(await headers())
    ? { name: kind, secure: false }
    : { name: `__Host-${kind}`, secure: true };
}

async function read(kind: CookieKind): Promise<string | undefined> {
  const { name } = await cookieSettings(kind);
  return (await cookies()).get(name)?.value;
}

async function write(kind: CookieKind, value: string, lifetime: { expires: Date } | { maxAge: number }) {
  const { name, secure } = await cookieSettings(kind);
  (await cookies()).set(name, value, { httpOnly: true, secure, sameSite: 'lax', path: '/', ...lifetime });
}

export function readSessionCookie(): Promise<string | undefined> {
  return read('session');
}

/** The cookie lives exactly as long as its session row. */
export function writeSessionCookie(token: string, expiresAt: Date): Promise<void> {
  return write('session', token, { expires: expiresAt });
}

/** Expired with the same attributes it was set with: a browser ignores a `__Host-` Set-Cookie without Secure and Path=/. */
export function deleteSessionCookie(): Promise<void> {
  return write('session', '', { maxAge: 0 });
}

export function readDeviceCookie(): Promise<string | undefined> {
  return read('device');
}

export function writeDeviceCookie(value: string): Promise<void> {
  return write('device', value, { maxAge: DEVICE_MAX_AGE_SECONDS });
}
