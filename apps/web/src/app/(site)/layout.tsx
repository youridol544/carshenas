import { Suspense } from 'react';
import { SiteHeader } from '@/components/layout/site-header';
import { AccountSlot, AccountSlotFrame } from '@/features/accounts/components/account-slot';
import { countUnreadNotifications } from '@/features/notifications/server/notification-queries';

// Product pages: the site header with its account slot. The slot reads the session inside its own boundary, so the
// rest of each page still prerenders (Cache Components); its frame keeps the space, so nothing shifts when it arrives.
// The menu counts the buyer's unread notifications (CS-68) in the same boundary, so its badge arrives with it.
export default function SiteLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader
        accountSlot={
          <AccountSlotFrame>
            <Suspense>
              <AccountSlot unreadNotifications={countUnreadNotifications} />
            </Suspense>
          </AccountSlotFrame>
        }
      />
      {children}
    </div>
  );
}
