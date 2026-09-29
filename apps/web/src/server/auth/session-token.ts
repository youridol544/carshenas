import 'server-only';
import { createHash, randomBytes } from 'node:crypto';

// A session's token (ADR-0020 point 5, ADR-0013 point 2): 32 random bytes, 256 bits where ASVS asks for 128, sent as
// base64url in the cookie. The database keeps only its SHA-256, so a copy of account_session signs nobody in, and a
// row is found by the hash of whatever the cookie holds.

const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/;

function sha256(token: string): Buffer {
  return createHash('sha256').update(token, 'ascii').digest();
}

export function newSessionToken(): { token: string; tokenSha256: Buffer } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenSha256: sha256(token) };
}

/** The hash to look a cookie's token up by, or undefined when the value cannot be a token of ours. */
export function sessionTokenSha256(token: string): Buffer | undefined {
  return TOKEN_FORMAT.test(token) ? sha256(token) : undefined;
}
