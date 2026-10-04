import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DataStatusBoundary } from '@/features/data-status/components/data-status-boundary';
import { DataStatusContent } from '@/features/data-status/components/data-status-content';
import { DataStatusSkeleton } from '@/features/data-status/components/data-status-report';
import { HowItWorksAside, HowItWorksDisclosure } from '@/features/data-status/components/how-it-works';
import { STATUS_COPY } from '@/features/data-status/data-status-copy';

export const metadata: Metadata = { title: STATUS_COPY.title, description: STATUS_COPY.lead };

// The public data-status page (CS-66). The shell prerenders: the title, the lead and how the index is kept (a
// disclosure under the lead on a phone, an aside beside the figures on a desktop). The figures stream in from a
// one-minute cache inside their own boundary, which keeps a failed read in their place; nothing sits under them in
// their column, so their arrival moves nothing.
export default function StatusPage() {
  return (
    <main className="mx-auto grid w-full max-w-5xl flex-1 content-start gap-x-12 gap-y-8 px-4 py-8 sm:py-12 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <header className="flex flex-col gap-3 lg:col-span-2">
        <h1 className="text-title font-bold text-balance">{STATUS_COPY.title}</h1>
        <p className="max-w-reading text-body text-pretty text-muted">{STATUS_COPY.lead}</p>
        <HowItWorksDisclosure />
      </header>
      <div className="flex min-w-0 flex-col gap-12">
        <DataStatusBoundary>
          <Suspense fallback={<DataStatusSkeleton />}>
            <DataStatusContent />
          </Suspense>
        </DataStatusBoundary>
      </div>
      <div className="hidden lg:block">
        <div className="sticky top-8">
          <HowItWorksAside />
        </div>
      </div>
    </main>
  );
}
