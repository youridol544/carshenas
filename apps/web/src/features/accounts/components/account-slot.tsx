import { AccountMenu } from '@/features/accounts/components/account-menu';
import { SignInLink } from '@/features/accounts/components/sign-in-link';
import { currentAccount } from '@/server/auth/current-account';

// The header's account slot: the visitor's way in, or the signed-in person's menu. It reads the session, so with
// Cache Components it streams inside its own boundary while the rest of the page prerenders; the fallback is an empty
// box of the same size, so nothing in the header moves when it arrives (craft L-4).

export async function AccountSlot() {
  const account = await currentAccount();
  if (account === null) return <SignInLink />;
  return <AccountMenu username={account.username} isSuperadmin={account.role === 'superadmin'} />;
}

/** Keeps the slot's box, at the header's inline end, while the session is read. */
export function AccountSlotFrame({ children }: { children?: React.ReactNode }) {
  return <div className="flex min-h-11 min-w-36 items-center justify-end">{children}</div>;
}
