import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ChevronRight } from 'lucide-react';
import { Icon } from '@/components/ui/icon';
import { InboxBoundary } from '@/features/notifications/components/inbox-boundary';
import { InboxSkeleton } from '@/features/notifications/components/inbox-states';
import { NotificationInbox } from '@/features/notifications/components/notification-inbox';
import { NOTIFICATIONS_COPY } from '@/features/notifications/notifications-copy';
import { ACCOUNT_COPY } from '@/features/accounts/accounts-copy';
import { ACCOUNT_PATH } from '@/lib/return-path';

export const metadata: Metadata = { title: NOTIFICATIONS_COPY.title, robots: { index: false } };

// The inbox (CS-68). Its heading prerenders; the notifications stream in behind a skeleton of their own rows, and a
// failure to read them stays inside the page. A visitor gets a real 307 to sign in from src/proxy.ts; the inbox still
// checks the session itself.
export default function NotificationsPage({ searchParams }: PageProps<'/account/notifications'>) {
  return (
    <main className="mx-auto flex w-full max-w-reading flex-1 flex-col gap-8 px-4 pt-6 pb-16">
      <div className="flex flex-col items-start gap-2">
        {/* Back to the account: the chevron points right, the way back in a right-to-left page. */}
        <Link
          href={ACCOUNT_PATH}
          className="-ms-2 inline-flex min-h-11 items-center gap-1 rounded-control px-2 text-secondary text-muted transition-colors hover:bg-surface-hover"
        >
          <Icon icon={ChevronRight} size={16} />
          {ACCOUNT_COPY.accountPage.title}
        </Link>
        <h1 className="text-title font-bold">{NOTIFICATIONS_COPY.title}</h1>
        <p className="text-secondary text-pretty text-muted">{NOTIFICATIONS_COPY.lead}</p>
      </div>
      <InboxBoundary>
        <Suspense fallback={<InboxSkeleton />}>
          <NotificationInbox searchParams={searchParams} />
        </Suspense>
      </InboxBoundary>
    </main>
  );
}
