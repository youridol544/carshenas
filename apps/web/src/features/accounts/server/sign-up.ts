import 'server-only';
import { passwordProblem } from '@carshenas/accounts/password';
import { hashPassword, PasswordHashingBusyError } from '@carshenas/accounts/password-hash';
import { normalizePassword } from '@carshenas/accounts/password-rules';
import { normalizeUsername, usernameProblem } from '@carshenas/accounts/username';
import type { FormFailure, PasswordError, UsernameError } from '@/features/accounts/accounts-types';
import { insertBuyer } from '@/features/accounts/server/account-mutations';
import { isUsernameTaken } from '@/features/accounts/server/account-queries';
import { startSession, type StartedSession } from '@/server/auth/sessions';
import { countInWindow } from '@/server/auth/throttle';
import { env } from '@/server/env';

// Signing up (ADR-0020 points 2, 3, 8): the address's hourly count first, before any work, so a burst can neither
// hash its way past the limit nor enumerate usernames quickly; then the rules, the hash and the insert, whose unique
// constraint alone says whether the name is taken.

export type SignUpResult =
  | { status: 'created'; accountId: number; username: string; session: StartedSession }
  | { status: 'rejected'; username: string; usernameError?: UsernameError; passwordError?: PasswordError }
  | { status: 'failed'; username: string; failure: FormFailure };

export async function signUp(
  typed: { username: string; password: string },
  client: { address: string },
): Promise<SignUpResult> {
  const username = normalizeUsername(typed.username);
  const window = await countInWindow('sign_up_address', client.address, env.signUpAddressLimit);
  if (window.status === 'throttled') {
    return {
      status: 'failed',
      username,
      failure: { kind: 'throttled', retryAfterSeconds: window.retryAfterSeconds },
    };
  }

  const password = normalizePassword(typed.password);
  const nameProblem = usernameProblem(username);
  let usernameError: UsernameError | undefined = nameProblem === 'reserved' ? 'taken' : nameProblem;
  const passwordError = passwordProblem(password, { username });
  if (passwordError !== undefined && usernameError === undefined && (await isUsernameTaken(username))) {
    // Only advice, so everything can be fixed in one go; the insert, which this answer never reaches, decides.
    usernameError = 'taken';
  }
  if (usernameError !== undefined || passwordError !== undefined) {
    return { status: 'rejected', username, usernameError, passwordError };
  }

  let passwordHash: string;
  try {
    passwordHash = await hashPassword(password);
  } catch (error) {
    if (error instanceof PasswordHashingBusyError) {
      return { status: 'failed', username, failure: { kind: 'busy' } };
    }
    throw error;
  }
  const inserted = await insertBuyer(username, passwordHash);
  if (inserted.status === 'taken') return { status: 'rejected', username, usernameError: 'taken' };
  // Undefined only if `pnpm account:superadmin` promoted this very name in the same instant (it sets a new
  // password): the name is someone else's now.
  const session = await startSession(inserted.id, passwordHash);
  if (session === undefined) return { status: 'rejected', username, usernameError: 'taken' };
  return { status: 'created', accountId: inserted.id, username, session };
}
