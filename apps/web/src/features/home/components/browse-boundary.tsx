'use client';

import { catchError, type ErrorInfo } from 'next/error';
import { ErrorReference, useErrorReference } from '@/components/layout/error-reference';
import { actionClasses } from '@/components/ui/action-link';
import { SEARCH_COPY } from '@/features/search/search-copy';

// When the body types and the catalogues cannot be read (the database did not answer), the failure stays in their
// place: the hero and its search box above still work, and the failure says what happened, gives a reference for the
// log and a way to try again (CS-63; the words are the search page's own).
function BrowseFallback(_props: object, { error, retry }: ErrorInfo) {
  const code = useErrorReference(
    error instanceof Error ? error : new Error('the home catalogues failed to load'),
  );
  return (
    <div role="alert" className="mx-auto flex w-full max-w-7xl flex-col items-start gap-3 px-4 py-8">
      <p className="text-heading font-bold">{SEARCH_COPY.error.title}</p>
      <p className="max-w-reading text-secondary text-pretty text-muted">{SEARCH_COPY.error.body}</p>
      <ErrorReference code={code} />
      <button
        type="button"
        onClick={() => {
          retry();
        }}
        className={actionClasses('secondary')}
      >
        {SEARCH_COPY.error.retry}
      </button>
    </div>
  );
}

export const BrowseBoundary = catchError(BrowseFallback);
