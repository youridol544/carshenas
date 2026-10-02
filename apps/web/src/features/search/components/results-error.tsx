'use client';

import { TriangleAlert } from 'lucide-react';
import { catchError, type ErrorInfo } from 'next/error';
import { ErrorReference, useErrorReference } from '@/components/layout/error-reference';
import { actionClasses } from '@/components/ui/action-link';
import { Icon } from '@/components/ui/icon';
import { SEARCH_COPY } from '@/features/search/search-copy';

// The results when reading them failed (the database was unreachable, a query timed out): the failure stays in the
// results' own place instead of replacing the page, so the buyer keeps the search box, the filters and the address,
// and can try again. It says what happened in plain words, carries the reference code that finds the log line
// (ADR-0016), and retry() asks the server again without a reload. A redirect or the not-found page still passes through.

function ResultsErrorFallback(_props: object, { error, retry }: ErrorInfo) {
  const code = useErrorReference(error instanceof Error ? error : new Error('the search results failed'));
  return (
    <section
      role="alert"
      className="flex flex-col items-start gap-3 rounded-card border border-divider bg-surface-muted p-6"
    >
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-danger-subtle text-danger">
        <Icon icon={TriangleAlert} size={24} />
      </span>
      <h2 className="text-heading font-bold text-balance">{SEARCH_COPY.error.title}</h2>
      <p className="text-body text-pretty text-muted">{SEARCH_COPY.error.body}</p>
      <ErrorReference code={code} />
      <button
        type="button"
        onClick={(event) => {
          // The button goes with the failure: focus waits on the page's heading, which stays, not at the top of the page.
          event.currentTarget.closest('main')?.querySelector('h1')?.focus({ preventScroll: true });
          retry();
        }}
        className={actionClasses('primary')}
      >
        {SEARCH_COPY.error.retry}
      </button>
    </section>
  );
}

export const ResultsErrorBoundary = catchError(ResultsErrorFallback);
