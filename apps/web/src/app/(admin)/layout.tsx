import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SiteHeader } from '@/components/layout/site-header';
import { AccountSlot, AccountSlotFrame } from '@/features/accounts/components/account-slot';

// The superadmin section's own route group (CS-40): never indexed, and no page of it renders for anyone but the
// superadmin, which each page and query checks itself (ADR-0020 point 10); this layout guards nothing.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AdminLayout({ children }: LayoutProps<'/'>) {
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
