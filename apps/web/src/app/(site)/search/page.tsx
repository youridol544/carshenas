import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PasteLinkForm } from '@/features/check-link/components/paste-link-form';
import { ResultsErrorBoundary } from '@/features/search/components/results-error';
import { SearchScreen } from '@/features/search/components/search-screen';
import { SearchScreenSkeleton } from '@/features/search/components/search-screen-skeleton';
import { PlainSearchPanel } from '@/features/search-understanding/components/plain-search-panel';
import { SEARCH_COPY } from '@/features/search/search-copy';

export const metadata: Metadata = {
  title: SEARCH_COPY.title,
  description: 'آگهی‌های خودروی کارکرده با ارزیابی قیمت و ارزش بازار، از بهترین معامله شروع می‌شود.',
};

// The search page (CS-61): the heading is part of the prerendered shell; everything that depends on the address
// (the search, the filters, the results) streams inside the boundary, and a failure to read them stays in its place with a
// way to retry. CS-62 plugs plain-Farsi understanding in through SearchScreen's `understanding` prop (a client leaf, so the page stays
// a server file); a feature never imports another feature, so the composition is here.
export default function SearchPage({ searchParams }: PageProps<'/search'>) {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 pt-6 pb-16">
      {/* The title and the box that takes a link (CS-65) share a row from 64 rem, so the first card stays high on the screen. */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        {/* tabIndex: where focus waits while the results are read again after a failure (results-error.tsx) */}
        <h1 tabIndex={-1} className="text-title font-bold">
          {SEARCH_COPY.title}
        </h1>
        <div className="lg:w-full lg:max-w-xl">
          <PasteLinkForm compact />
        </div>
      </div>
      <ResultsErrorBoundary>
        <Suspense fallback={<SearchScreenSkeleton />}>
          <SearchScreen searchParams={searchParams} understanding={<PlainSearchPanel />} />
        </Suspense>
      </ResultsErrorBoundary>
    </main>
  );
}
