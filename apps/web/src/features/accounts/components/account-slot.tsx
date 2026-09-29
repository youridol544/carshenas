import { AccountMenu } from '@/features/accounts/components/account-menu';
import { SignInLink } from '@/features/accounts/components/sign-in-link';
import { currentAccount } from '@/server/auth/current-account';

// The header's account slot: the visitor's way in, or the signed-in person's menu. It reads the session, so with
// Cache Components it streams inside its own boundary while the rest of the page prerenders.

export async function AccountSlot() {
  const account = await currentAccount();
  if (account === null) return <SignInLink />;
  return <AccountMenu username={account.username} isSuperadmin={account.role === 'superadmin'} />;
}

/**
 * Keeps the slot's height while the session is read, at the header's inline end. Its width may change freely: nothing
 * else in the row sits on that side, so what arrives moves nothing.
 */
export function AccountSlotFrame({ children }: { children?: React.ReactNode }) {
  return <div className="flex min-h-11 items-center justify-end">{children}</div>;
}
