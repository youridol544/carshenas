import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CheckForm } from '@/features/check-link/components/check-form';
import { CheckErrorBoundary } from '@/features/check-link/components/check-error';
import { CheckResult } from '@/features/check-link/components/check-result';
import { CheckAnswerSkeleton } from '@/features/check-link/components/check-skeleton';
import { PasteLinkForm } from '@/features/check-link/components/paste-link-form';
import { CHECK_COPY } from '@/features/check-link/check-copy';

export const metadata: Metadata = {
  title: CHECK_COPY.title,
  description: CHECK_COPY.description,
  robots: { index: false },
};

// The pasted link's page (CS-65): the heading, the box (in the static shell, it needs no data) and, under it, the answer
// for the link the address carries, in its own boundary with its skeleton and its failure. The address is the whole
// state: `/check?link=https://divar.ir/v/<token>` can be shared, reloaded and gone Back to.
export default function CheckPage({ searchParams }: PageProps<'/check'>) {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 pt-6 pb-16">
      <header className="flex max-w-reading flex-col gap-2">
        {/* tabIndex: where focus waits while the answer is read again after a failure */}
        <h1 tabIndex={-1} className="text-title font-bold text-balance">
          {CHECK_COPY.page.h1}
        </h1>
        <p className="text-body text-pretty text-muted">{CHECK_COPY.page.lead}</p>
      </header>
      <div className="max-w-2xl">
        <Suspense fallback={<PasteLinkForm primary />}>
          <CheckForm />
        </Suspense>
      </div>
      <CheckErrorBoundary>
        <Suspense fallback={<CheckAnswerSkeleton />}>
          <CheckResult searchParams={searchParams} />
        </Suspense>
      </CheckErrorBoundary>
    </main>
  );
}
