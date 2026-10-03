import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FileBackLink } from '@/features/search-files/components/search-file-screen';
import { FilesBoundary } from '@/features/search-files/components/files-boundary';
import { FilesSkeleton } from '@/features/search-files/components/files-states';
import { SearchFilesList } from '@/features/search-files/components/search-files-list';
import { SEARCH_FILES_COPY } from '@/features/search-files/search-files-copy';

export const metadata: Metadata = { title: SEARCH_FILES_COPY.title, robots: { index: false } };

// The buyer's search files (CS-70). The heading prerenders; the files stream in behind a skeleton of their own cards,
// and a failure to read them stays inside the page. A visitor gets a real 307 to sign in from src/proxy.ts; the list
// still checks the session itself.
export default function SearchFilesPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 pt-6 pb-16">
      <div className="flex flex-col items-start gap-2">
        <FileBackLink />
        <h1 className="text-title font-bold">{SEARCH_FILES_COPY.title}</h1>
        <p className="max-w-reading text-secondary text-pretty text-muted">{SEARCH_FILES_COPY.lead}</p>
      </div>
      <FilesBoundary>
        <Suspense fallback={<FilesSkeleton />}>
          <SearchFilesList />
        </Suspense>
      </FilesBoundary>
    </main>
  );
}
