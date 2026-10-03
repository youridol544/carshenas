import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ResultsErrorBoundary } from '@/features/search/components/results-error';
import { SearchScreen } from '@/features/search/components/search-screen';
import { SearchScreenSkeleton } from '@/features/search/components/search-screen-skeleton';
import { PlainSearchPanel } from '@/features/search-understanding/components/plain-search-panel';
import { SEARCH_COPY } from '@/features/search/search-copy';
import { SaveSearchButton } from '@/features/search-files/components/save-search-button';
import { suggestFileName } from '@/features/search-files/search-file-name';
import { searchHref, toStoredSearch } from '@carshenas/search/search';

export const metadata: Metadata = {
  title: SEARCH_COPY.title,
  description: 'آگهی‌های خودروی کارکرده با ارزیابی قیمت و ارزش بازار، از بهترین معامله شروع می‌شود.',
};

// The search page (CS-61): the heading is part of the prerendered shell; everything that depends on the address
// (the search, the filters, the results) streams inside the boundary, and a failure to read them stays in its place with a
// way to retry. CS-62 plugs plain-Farsi understanding in through SearchScreen's `understanding` prop (a client leaf, so the page stays
// a server file); a feature never imports another feature, so the composition is here. So is «بسپارش به کارشناس»
// (CS-70): the screen says where it goes, search files supply the button.
export default function SearchPage({ searchParams }: PageProps<'/search'>) {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 pt-6 pb-16">
      {/* tabIndex: where focus waits while the results are read again after a failure (results-error.tsx) */}
      <h1 tabIndex={-1} className="text-title font-bold">
        {SEARCH_COPY.title}
      </h1>
      <ResultsErrorBoundary>
        <Suspense fallback={<SearchScreenSkeleton />}>
          <SearchScreen
            searchParams={searchParams}
            understanding={<PlainSearchPanel />}
            saveSearch={({ search, chips, openOnArrival }) => {
              const common = {
                search: toStoredSearch(search),
                chips,
                suggestedName: suggestFileName(chips),
                href: searchHref(search),
              };
              return {
                button: <SaveSearchButton {...common} variant="button" openOnArrival={openOnArrival} />,
                banner: <SaveSearchButton {...common} variant="banner" />,
              };
            }}
          />
        </Suspense>
      </ResultsErrorBoundary>
    </main>
  );
}
