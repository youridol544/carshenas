import 'server-only';
import { normalizeUsername, usernameProblem } from '@carshenas/accounts/username';
import type { UsernameAvailability } from '@/features/accounts/accounts-types';
import { isUsernameTaken } from '@/features/accounts/server/account-queries';
import { countInWindow } from '@/server/auth/throttle';
import { env } from '@/server/env';

// Whether a name is free, asked while someone types it on the sign-up page (ADR-0020 point 2). Advice only: the
// insert still decides. Usernames are enumerable through sign-up anyway, so the defence is the count per address,
// taken before the lookup; a reserved name is answered as taken, like one somebody holds.

export async function checkUsernameAvailability(
  typed: string,
  address: string,
): Promise<UsernameAvailability> {
  const window = await countInWindow('username_check_address', address, env.usernameCheckAddressLimit);
  if (window.status === 'throttled') return { status: 'throttled' };
  const username = normalizeUsername(typed);
  const problem = usernameProblem(username);
  if (problem === 'reserved') return { status: 'taken' };
  if (problem !== undefined) return { status: 'invalid', problem };
  return (await isUsernameTaken(username)) ? { status: 'taken' } : { status: 'available' };
}
