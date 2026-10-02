import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FilesBoundary } from '@/features/search-files/components/files-boundary';
import { FileScreenSkeleton } from '@/features/search-files/components/files-states';
import { SearchFileScreen } from '@/features/search-files/components/search-file-screen';
import { SEARCH_FILES_COPY } from '@/features/search-files/search-files-copy';

export const metadata: Metadata = { title: SEARCH_FILES_COPY.title, robots: { index: false } };

// One search file (CS-70). The file's own name arrives with its data, so the shell is the frame in grey; a failure
// stays inside the page, and an id that is not the buyer's is not found. A visitor gets a real 307 to sign in from
// src/proxy.ts; the screen still checks the session itself.
export default function SearchFilePage({ params }: PageProps<'/account/searches/[id]'>) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 pt-6 pb-16">
      <FilesBoundary>
        <Suspense fallback={<FileScreenSkeleton />}>
          <SearchFileScreen params={params} />
        </Suspense>
      </FilesBoundary>
    </main>
  );
}
