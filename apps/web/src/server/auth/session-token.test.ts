// @vitest-environment node
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { newSessionToken, sessionTokenSha256 } from '@/server/auth/session-token';

test('a session token is 32 random bytes in base64url, and the database gets only its SHA-256', () => {
  const first = newSessionToken();
  const second = newSessionToken();
  expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(Buffer.from(first.token, 'base64url')).toHaveLength(32);
  expect(first.token).not.toBe(second.token);
  expect(first.tokenSha256).toEqual(createHash('sha256').update(first.token).digest());
  expect(sessionTokenSha256(first.token)).toEqual(first.tokenSha256);
});

test('a cookie value that cannot be one of our tokens is not looked up at all', () => {
  expect(sessionTokenSha256('')).toBeUndefined();
  expect(sessionTokenSha256('x'.repeat(42))).toBeUndefined();
  expect(sessionTokenSha256(`${'x'.repeat(42)}=`)).toBeUndefined();
  expect(sessionTokenSha256("' OR 1=1 --")).toBeUndefined();
});
