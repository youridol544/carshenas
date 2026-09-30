import { AccountMenu } from '@/features/accounts/components/account-menu';
import { SignInLink } from '@/features/accounts/components/sign-in-link';
import { currentAccount } from '@/server/auth/current-account';
import { captureError } from '@/server/observability/logger';

// The header's account slot: the visitor's way in, or the signed-in person's menu. It reads the session, so with
// Cache Components it streams inside its own boundary while the rest of the page prerenders. The route may pass how
// to count the account's unread notifications (CS-68), which the menu shows as a badge; one feature never imports
// another, so the route composes them. A count that cannot be read leaves the menu without a badge, never broken.

type AccountSlotProps = { unreadNotifications?: (accountId: number) => Promise<number> };

async function unreadCountOf(
  accountId: number,
  count: AccountSlotProps['unreadNotifications'],
): Promise<number | undefined> {
  if (count === undefined) return undefined;
  try {
    return await count(accountId);
  } catch (error) {
    captureError(error, { message: 'counting unread notifications failed', fields: { accountId } });
    return undefined;
  }
}

export async function AccountSlot({ unreadNotifications }: AccountSlotProps) {
  const account = await currentAccount();
  if (account === null) return <SignInLink />;
  return (
    <AccountMenu
      username={account.username}
      isSuperadmin={account.role === 'superadmin'}
      unreadCount={await unreadCountOf(account.id, unreadNotifications)}
    />
  );
}

/**
 * Keeps the slot's height while the session is read, at the header's inline end. Its width may change freely: nothing
 * else in the row sits on that side, so what arrives moves nothing.
 */
export function AccountSlotFrame({ children }: { children?: React.ReactNode }) {
  return <div className="flex min-h-11 items-center justify-end">{children}</div>;
}
