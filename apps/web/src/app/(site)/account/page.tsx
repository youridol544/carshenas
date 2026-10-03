import type { Metadata } from 'next';
import { ACCOUNT_COPY } from '@/features/accounts/accounts-copy';
import { AccountOverview } from '@/features/accounts/components/account-overview';
import { loadAccountPage } from '@/features/accounts/server/account-page-data';
import { Suspense } from 'react';
import {
  SearchFilesCard,
  SearchFilesCardSkeleton,
} from '@/features/search-files/components/search-files-card';
import { NotificationsCard } from '@/features/notifications/components/notifications-card';

export const metadata: Metadata = { title: ACCOUNT_COPY.accountPage.title, robots: { index: false } };

// Reads the session at request time. A visitor gets a real 307 to sign in and back from src/proxy.ts; the page's
// own check stays, since a proxy is never the guard.
export const instant = false;

export default async function AccountPage() {
  const account = await loadAccountPage();
  return (
    <AccountOverview
      username={account.username}
      createdAt={account.createdAt}
      isSuperadmin={account.role === 'superadmin'}
    >
      <NotificationsCard accountId={account.id} />
      <Suspense fallback={<SearchFilesCardSkeleton />}>
        <SearchFilesCard accountId={account.id} />
      </Suspense>
    </AccountOverview>
  );
}
