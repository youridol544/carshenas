'use server';

import { normalizeUsername } from '@carshenas/accounts/username';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { readAccountForm } from '@/features/accounts/accounts-schemas';
import type { SignInState, SignUpState } from '@/features/accounts/accounts-types';
import { signIn } from '@/features/accounts/server/sign-in';
import { signUp } from '@/features/accounts/server/sign-up';
import { HOME_PATH, landingAfterSignIn, needsAccount, safeReturnPath } from '@/lib/return-path';
import {
  deleteSessionCookie,
  readDeviceCookie,
  readSessionCookie,
  writeDeviceCookie,
  writeSessionCookie,
} from '@/server/auth/auth-cookies';
import { clientAddress } from '@/server/auth/client-address';
import { deviceKeyFor, newDeviceToken } from '@/server/auth/device-token';
import { isSameOriginRequest } from '@/server/auth/request-origin';
import { endSession, startSession, type AccountRole } from '@/server/auth/sessions';
import { sessionTokenSha256 } from '@/server/auth/session-token';
import { logger } from '@/server/observability/logger';

// Sign-up, sign-in and sign-out (ADR-0020). Every action is a public POST endpoint: each one checks that the request
// came from a page of this site, parses the whole form, lets the flow decide, and writes one log line with the
// outcome and the account id, never the typed username, the password, a token or an address (ADR-0016). A redirect
// comes last, outside any try.

const log = logger.child({ component: 'accounts' });

class CrossSiteRequestError extends Error {
  constructor() {
    super('a request that changes accounts came from outside this site');
    this.name = 'CrossSiteRequestError';
  }
}

function refuseCrossSite(requestHeaders: Headers): void {
  if (!isSameOriginRequest(requestHeaders)) throw new CrossSiteRequestError();
}

/** Ends whatever session this browser had, starts a new one (never reuse a token across sign-ins), and gives the
 * browser a device cookie for this account if it has none. */
async function beginSession(accountId: number, role: AccountRole): Promise<void> {
  const previous = await readSessionCookie();
  const previousHash = previous === undefined ? undefined : sessionTokenSha256(previous);
  if (previousHash !== undefined) await endSession(previousHash);
  const { token, expiresAt } = await startSession(accountId, role);
  await writeSessionCookie(token, expiresAt);
  if (deviceKeyFor(await readDeviceCookie(), accountId) === undefined) {
    await writeDeviceCookie(newDeviceToken(accountId));
  }
}

export async function signUpAction(_previous: SignUpState, formData: FormData): Promise<SignUpState> {
  const requestHeaders = await headers();
  refuseCrossSite(requestHeaders);
  const submission = Date.now();
  const form = readAccountForm(formData);
  if (form === undefined) {
    return {
      status: 'rejected',
      submission,
      username: '',
      usernameError: 'too_long',
      passwordError: 'too_long',
    };
  }

  const result = await signUp(form, { address: clientAddress(requestHeaders) });
  log.info('sign-up attempt', {
    outcome: result.status === 'failed' ? result.failure.kind : result.status,
    accountId: result.status === 'created' ? result.accountId : undefined,
  });
  if (result.status === 'rejected') {
    const { username, usernameError, passwordError } = result;
    return { status: 'rejected', submission, username, usernameError, passwordError };
  }
  if (result.status === 'failed') {
    return { status: 'rejected', submission, username: result.username, failure: result.failure };
  }

  await beginSession(result.accountId, 'buyer');
  redirect(landingAfterSignIn(safeReturnPath(form.next), false));
}

export async function signInAction(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const requestHeaders = await headers();
  refuseCrossSite(requestHeaders);
  const submission = Date.now();
  const form = readAccountForm(formData);
  if (form === undefined) {
    return { status: 'rejected', submission, username: '', failure: { kind: 'wrong', failuresInARow: 0 } };
  }
  const username = normalizeUsername(form.username);
  if (username === '' || form.password === '') {
    return {
      status: 'rejected',
      submission,
      username,
      usernameError: username === '' ? 'empty' : undefined,
      passwordError: form.password === '' ? 'empty' : undefined,
    };
  }

  const result = await signIn(form, {
    address: clientAddress(requestHeaders),
    deviceToken: await readDeviceCookie(),
  });
  log.info('sign-in attempt', {
    outcome: result.status,
    accountId: result.status === 'signed_in' || result.status === 'wrong' ? result.accountId : undefined,
    throttle: result.status === 'throttled' ? result.scope : undefined,
  });
  switch (result.status) {
    case 'wrong':
      return {
        status: 'rejected',
        submission,
        username,
        failure: { kind: 'wrong', failuresInARow: result.failuresInARow },
      };
    case 'throttled':
      return {
        status: 'rejected',
        submission,
        username,
        failure: { kind: 'throttled', retryAfterSeconds: result.retryAfterSeconds },
      };
    case 'busy':
      return { status: 'rejected', submission, username, failure: { kind: 'busy' } };
    case 'signed_in':
      break;
  }

  await beginSession(result.accountId, result.role);
  redirect(landingAfterSignIn(safeReturnPath(form.next), result.role === 'superadmin'));
}

/** Ends this browser's session and returns to the page it was on, unless that page needs an account. */
export async function signOutAction(formData: FormData): Promise<void> {
  refuseCrossSite(await headers());
  const token = await readSessionCookie();
  const tokenSha256 = token === undefined ? undefined : sessionTokenSha256(token);
  const accountId = tokenSha256 === undefined ? undefined : await endSession(tokenSha256);
  await deleteSessionCookie();
  log.info('signed out', { accountId });
  const next = safeReturnPath(formData.get('next'));
  redirect(next === undefined || needsAccount(next) ? HOME_PATH : next);
}
