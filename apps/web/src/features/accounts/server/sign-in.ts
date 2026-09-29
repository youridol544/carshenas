import 'server-only';
import {
  hashNeedsUpgrade,
  hashPassword,
  PasswordHashingBusyError,
  verifyPassword,
  verifyUnknownAccount,
} from '@carshenas/accounts/password-hash';
import { normalizePassword } from '@carshenas/accounts/password-rules';
import { normalizeUsername } from '@carshenas/accounts/username';
import { findAccountForSignIn } from '@/features/accounts/server/account-queries';
import { replacePasswordHash } from '@/features/accounts/server/account-mutations';
import type { AccountRole } from '@/server/auth/sessions';
import { deviceKeyFor } from '@/server/auth/device-token';
import {
  claimStreakAttempt,
  clearStreak,
  countInWindow,
  peekWindow,
  recordStreakFailure,
  releaseStreakAttempt,
  type StreakScope,
} from '@/server/auth/throttle';
import { env } from '@/server/env';

// Signing in (ADR-0020 points 4 and 8). The same path for every name, known or not: the address's hourly count, one
// attempt at a time per name (or per device that signed into this account before), a real verification (against a
// dummy hash when no account has the name), and one answer for a wrong username or password.

export type SignInResult =
  | { status: 'signed_in'; accountId: number; role: AccountRole; username: string }
  | { status: 'wrong'; username: string; failuresInARow: number; accountId: number | undefined }
  | {
      status: 'throttled';
      username: string;
      retryAfterSeconds: number;
      scope: StreakScope | 'sign_in_address';
    }
  | { status: 'busy'; username: string };

export async function signIn(
  typed: { username: string; password: string },
  client: { address: string; deviceToken: string | undefined },
): Promise<SignInResult> {
  const username = normalizeUsername(typed.username);
  const password = normalizePassword(typed.password);

  const addressWindow = await peekWindow('sign_in_address', client.address, env.signInAddressLimit);
  if (addressWindow.status === 'throttled') {
    return {
      status: 'throttled',
      username,
      retryAfterSeconds: addressWindow.retryAfterSeconds,
      scope: 'sign_in_address',
    };
  }

  const account = await findAccountForSignIn(username);
  const deviceKey = account === undefined ? undefined : deviceKeyFor(client.deviceToken, account.id);
  const streak: { scope: StreakScope; value: string } =
    deviceKey === undefined
      ? { scope: 'sign_in_account', value: username }
      : { scope: 'sign_in_device', value: deviceKey };
  const claim = await claimStreakAttempt(streak.scope, streak.value);
  if (claim.status === 'throttled') {
    return { status: 'throttled', username, retryAfterSeconds: claim.retryAfterSeconds, scope: streak.scope };
  }

  let matches: boolean;
  try {
    if (account === undefined) {
      await verifyUnknownAccount(password);
      matches = false;
    } else {
      matches = await verifyPassword(account.passwordHash, password);
    }
  } catch (error) {
    // The attempt never ran: it costs the person nothing.
    await releaseStreakAttempt(streak.scope, streak.value);
    if (error instanceof PasswordHashingBusyError) return { status: 'busy', username };
    throw error;
  }

  if (account === undefined || !matches) {
    const failuresInARow = await recordStreakFailure(streak.scope, streak.value);
    await countInWindow('sign_in_address', client.address, env.signInAddressLimit);
    return { status: 'wrong', username, failuresInARow, accountId: account?.id };
  }

  await clearStreak(streak.scope, streak.value);
  if (hashNeedsUpgrade(account.passwordHash)) {
    await replacePasswordHash(account.id, await hashPassword(password));
  }
  return { status: 'signed_in', accountId: account.id, role: account.role, username };
}
