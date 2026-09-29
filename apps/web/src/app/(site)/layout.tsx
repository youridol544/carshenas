import { Suspense } from 'react';
import { SiteHeader } from '@/components/layout/site-header';
import { AccountSlot, AccountSlotFrame } from '@/features/accounts/components/account-slot';

// Product pages: the site header with its account slot. The slot reads the session inside its own boundary, so the
// rest of each page still prerenders (Cache Components); its frame keeps the space, so nothing shifts when it arrives.
export default function SiteLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader
        accountSlot={
          <AccountSlotFrame>
            <Suspense>
              <AccountSlot />
            </Suspense>
          </AccountSlotFrame>
        }
      />
      {children}
    </div>
  );
}
