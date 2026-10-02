import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ResultsErrorBoundary } from '@/features/search/components/results-error';
import { SearchScreen } from '@/features/search/components/search-screen';
import { SearchScreenSkeleton } from '@/features/search/components/search-screen-skeleton';
import { SEARCH_COPY } from '@/features/search/search-copy';

export const metadata: Metadata = {
  title: SEARCH_COPY.title,
  description: 'آگهی‌های خودروی کارکرده با ارزیابی قیمت و ارزش بازار، از بهترین معامله شروع می‌شود.',
};

// The search page (CS-61): the heading is part of the prerendered shell; everything that depends on the address
// (the search, the filters, the results) streams inside the boundary, and a failure to read them stays in its place with a
// way to retry. CS-62 plugs plain-Farsi understanding in through SearchScreen's `understanding` prop.
export default function SearchPage({ searchParams }: PageProps<'/search'>) {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 pt-6 pb-16">
      <h1 className="text-title font-bold">{SEARCH_COPY.title}</h1>
      <ResultsErrorBoundary>
        <Suspense fallback={<SearchScreenSkeleton />}>
          <SearchScreen searchParams={searchParams} />
        </Suspense>
      </ResultsErrorBoundary>
    </main>
  );
}
