import { Suspense } from 'react';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { AccountSlot, AccountSlotFrame } from '@/features/accounts/components/account-slot';
import { BodyTypeCredits } from '@/features/body-types/components/body-type-credits';
import { HeroPhotoCredits } from '@/features/home/components/hero-photo-credits';
import { HOME_COPY } from '@/features/home/home-copy';
import { countUnreadNotifications } from '@/features/notifications/server/notification-queries';

// Product pages: the site header with its account slot. The slot reads the session inside its own boundary, so the
// rest of each page still prerenders (Cache Components); its frame keeps the space, so nothing shifts when it arrives.
// The footer (CS-63) credits every photograph the product shows, the home page's and the body types'.
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
      <SiteFooter
        label={HOME_COPY.footer.label}
        searchLabel={HOME_COPY.footer.search}
        statusLabel={HOME_COPY.footer.status}
        modelsLabel={HOME_COPY.footer.models}
        credits={
          <>
            <HeroPhotoCredits />
            <BodyTypeCredits />
          </>
        }
      />
    </div>
  );
}
