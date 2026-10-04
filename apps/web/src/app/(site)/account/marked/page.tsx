import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ChevronRight } from 'lucide-react';
import { Icon } from '@/components/ui/icon';
import { ACCOUNT_COPY } from '@/features/accounts/accounts-copy';
import { MarkedBoundary } from '@/features/marked-listings/components/marked-boundary';
import { MarkedInfo } from '@/features/marked-listings/components/marked-info';
import { MarkedSkeleton } from '@/features/marked-listings/components/marked-states';
import { MarkedView } from '@/features/marked-listings/components/marked-view';
import { MARKED_COPY } from '@/features/marked-listings/marked-copy';
import { ACCOUNT_PATH } from '@/lib/return-path';

export const metadata: Metadata = { title: MARKED_COPY.title, robots: { index: false } };

// The marked listings (CS-69). The heading prerenders; the listings stream in behind a skeleton of their own rows, and a
// failure to read them stays inside the page. A visitor gets a real 307 to sign in from src/proxy.ts; the view still
// checks the session itself.
export default function MarkedPage({ searchParams }: PageProps<'/account/marked'>) {
  return (
    <main className="mx-auto flex w-full max-w-reading flex-1 flex-col gap-6 px-4 pt-6 pb-16">
      <div className="flex flex-col items-start gap-2">
        {/* Back to the account: the chevron points right, the way back in a right-to-left page. */}
        <Link
          href={ACCOUNT_PATH}
          className="-ms-2 inline-flex min-h-11 items-center gap-1 rounded-control px-2 text-secondary text-muted transition-colors hover:bg-surface-hover"
        >
          <Icon icon={ChevronRight} size={16} />
          {ACCOUNT_COPY.accountPage.title}
        </Link>
        <div className="flex items-center gap-1">
          <h1 className="text-title font-bold">{MARKED_COPY.title}</h1>
          <MarkedInfo />
        </div>
      </div>
      <MarkedBoundary>
        <Suspense fallback={<MarkedSkeleton />}>
          <MarkedView searchParams={searchParams} />
        </Suspense>
      </MarkedBoundary>
    </main>
  );
}
