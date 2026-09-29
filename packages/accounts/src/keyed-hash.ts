import { createHmac } from 'node:crypto';

// HMAC-SHA-256 under the server's auth key (CARSHENAS_AUTH_KEY, ADR-0020 point 8): throttle rows are keyed by it
// instead of a typed username or a client address, and device cookies are signed with it. Without the key, a copy of
// the database cannot turn a hash back into an address by trying them all. The purpose is part of the input, so one
// key never gives two uses the same value.

export type KeyedHashPurpose =
  | 'sign_in_account'
  | 'sign_in_device'
  | 'sign_in_address'
  | 'sign_up_address'
  | 'username_check_address'
  | 'device_cookie';

export function keyedHash(key: Uint8Array, purpose: KeyedHashPurpose, value: string): Buffer {
  return createHmac('sha256', key).update(`${purpose}\n${value}`, 'utf8').digest();
}

/** The server's auth key from its base64 setting (CARSHENAS_AUTH_KEY): at least 32 bytes, or the server refuses to start. */
export function parseAuthKey(base64: string): Buffer {
  const key = Buffer.from(base64, 'base64');
  if (key.length < 32 || key.toString('base64').replace(/=+$/, '') !== base64.trim().replace(/=+$/, '')) {
    throw new Error('CARSHENAS_AUTH_KEY must be at least 32 random bytes in base64: openssl rand -base64 32');
  }
  return key;
}
