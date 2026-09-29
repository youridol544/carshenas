import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SiteHeader } from '@/components/layout/site-header';
import { AccountSlot, AccountSlotFrame } from '@/features/accounts/components/account-slot';

// The superadmin section's own route group (CS-40): never indexed. Anyone but the superadmin gets a real 404 from
// src/proxy.ts, and each page, action and query checks the role itself (ADR-0020 point 10); this layout guards
// nothing.
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
