import type { Metadata } from 'next';
import { ACCOUNT_COPY } from '@/features/accounts/accounts-copy';
import { AccountOverview } from '@/features/accounts/components/account-overview';
import { loadAccountPage } from '@/features/accounts/server/account-page-data';

export const metadata: Metadata = { title: ACCOUNT_COPY.accountPage.title, robots: { index: false } };

// Reads the session before anything is sent: a visitor is redirected to sign in and back, with a real redirect.
export const instant = false;

export default async function AccountPage() {
  const account = await loadAccountPage();
  return (
    <AccountOverview
      username={account.username}
      createdAt={account.createdAt}
      isSuperadmin={account.role === 'superadmin'}
    />
  );
}
