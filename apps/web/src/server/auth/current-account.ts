import 'server-only';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { withReturnPath, SIGN_IN_PATH } from '@/lib/return-path';
import { readSessionCookie } from '@/server/auth/auth-cookies';
import { findSessionAccount, type SessionAccount } from '@/server/auth/sessions';
import { sessionTokenSha256 } from '@/server/auth/session-token';

// Who is asking, next to the data (ADR-0020 point 10). Every protected page, Server Action and query calls one of these
// itself: a layout does not guard the pages under it and proxy.ts is never the boundary (Next.js data-security guide).
// Reading the session reads cookies, so a page that calls these renders at request time.

/** The signed-in account of this request, or null. Read once per request, whoever asks (React cache). */
export const currentAccount = cache(async (): Promise<SessionAccount | null> => {
  const token = await readSessionCookie();
  const tokenSha256 = token === undefined ? undefined : sessionTokenSha256(token);
  if (tokenSha256 === undefined) return null;
  return (await findSessionAccount(tokenSha256)) ?? null;
});

/** The signed-in account, or a redirect to sign-in that comes back to `returnPath`. */
export async function requireAccount(returnPath: string): Promise<SessionAccount> {
  const account = await currentAccount();
  if (account === null) redirect(withReturnPath(SIGN_IN_PATH, returnPath));
  return account;
}

/** The signed-in superadmin; anyone else gets the not-found page, so the section does not admit that it exists. */
export async function requireSuperadmin(): Promise<SessionAccount> {
  const account = await currentAccount();
  if (account?.role !== 'superadmin') notFound();
  return account;
}
