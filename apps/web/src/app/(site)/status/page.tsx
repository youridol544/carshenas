import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DataStatusBoundary } from '@/features/data-status/components/data-status-boundary';
import { DataStatusContent } from '@/features/data-status/components/data-status-content';
import { DataStatusSkeleton } from '@/features/data-status/components/data-status-report';
import { HowItWorks } from '@/features/data-status/components/how-it-works';
import { STATUS_COPY } from '@/features/data-status/data-status-copy';

export const metadata: Metadata = { title: STATUS_COPY.title, description: STATUS_COPY.lead };

// The public data-status page (CS-66): the title, the lead and how the index is kept prerender as the shell; the
// figures stream in from a one-minute cache inside their own boundary, which keeps a failed read in their place.
export default function StatusPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-4 py-8 sm:py-12">
      <header className="flex flex-col gap-3">
        <h1 className="text-title font-bold text-balance">{STATUS_COPY.title}</h1>
        <p className="max-w-reading text-body text-pretty text-muted">{STATUS_COPY.lead}</p>
        <p className="max-w-reading text-secondary text-pretty text-muted">{STATUS_COPY.leadNumbers}</p>
      </header>
      <DataStatusBoundary>
        <Suspense fallback={<DataStatusSkeleton />}>
          <div className="flex flex-col gap-12">
            <DataStatusContent />
          </div>
        </Suspense>
      </DataStatusBoundary>
      <HowItWorks />
    </main>
  );
}
