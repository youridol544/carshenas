import 'server-only';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { keyedHash } from '@carshenas/accounts/keyed-hash';
import { env } from '@/server/env';

// The device cookie's value (OWASP, "Slow Down Online Guessing Attacks with Device Cookies"; ADR-0020 point 8):
// `<account id>.<nonce>.<signature>`, signed with the auth key, given to a browser when it signs in. Sign-in attempts
// that carry one for the account being signed into count on their own throttle row, so guesses from anywhere else
// never make the owner of the account wait. Nothing is stored for it: rotating the key forgets every device.

function signature(accountId: number, nonce: string): Buffer {
  return keyedHash(env.authKey, 'device_cookie', `${accountId}.${nonce}`);
}

export function newDeviceToken(accountId: number): string {
  const nonce = randomBytes(16).toString('base64url');
  return `${accountId}.${nonce}.${signature(accountId, nonce).toString('base64url')}`;
}

/**
 * The key the throttle counts this device's attempts by, when the cookie is ours and was given for this account;
 * otherwise undefined, and the attempt counts against the account name like any stranger's.
 */
export function deviceKeyFor(token: string | undefined, accountId: number): string | undefined {
  const [id, nonce, mac, ...rest] = token?.split('.') ?? [];
  if (rest.length > 0 || id !== String(accountId) || !nonce || !mac) return undefined;
  const expected = signature(accountId, nonce);
  const given = Buffer.from(mac, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return undefined;
  return `${accountId}.${nonce}`;
}
