'use client';

import { catchError, type ErrorInfo } from 'next/error';
import { ErrorReference, useErrorReference } from '@/components/layout/error-reference';
import { actionClasses } from '@/components/ui/action-link';
import { SEARCH_FILES_COPY } from '@/features/search-files/search-files-copy';

// The files' pages when their rows could not be read (the database did not answer): the failure stays inside the page,
// under its heading and the header, says the files are safe, carries a reference for the log and retries in place. A
// redirect to sign in still passes through (catchError).

function FilesFallback(_props: object, { error, retry }: ErrorInfo) {
  const code = useErrorReference(error instanceof Error ? error : new Error('search files failed to load'));
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-card border border-divider bg-surface p-6"
    >
      <h2 className="text-heading font-bold">{SEARCH_FILES_COPY.list.errorTitle}</h2>
      <p className="max-w-reading text-body text-pretty text-muted">{SEARCH_FILES_COPY.list.errorBody}</p>
      <ErrorReference code={code} />
      <button
        type="button"
        onClick={() => {
          retry();
        }}
        className={actionClasses('secondary')}
      >
        {SEARCH_FILES_COPY.list.retry}
      </button>
    </div>
  );
}

export const FilesBoundary = catchError(FilesFallback);
