'use client';

import { catchError, type ErrorInfo } from 'next/error';
import { ErrorReference, useErrorReference } from '@/components/layout/error-reference';
import { actionClasses } from '@/components/ui/action-link';
import { SOURCES_COPY } from '@/features/admin/admin-copy';

// A source's control when its answer never came back (the connection dropped, the server restarted): the failure stays
// inside the card instead of replacing the screen, says the change may or may not have landed, carries a reference
// for the log, and asks for the source as it now is. A redirect or the not-found page still passes through (catchError).

function SourceStateFallback(_props: object, { error, retry }: ErrorInfo) {
  // catchError types what was thrown as unknown; an answer that never arrived rejects with an Error.
  const code = useErrorReference(error instanceof Error ? error : new Error('the source state form failed'));
  return (
    <div role="alert" className="flex flex-col items-start gap-2">
      <p className="text-secondary text-pretty text-danger">{SOURCES_COPY.noAnswer}</p>
      <ErrorReference code={code} />
      <button
        type="button"
        onClick={() => {
          retry();
        }}
        className={actionClasses('secondary')}
      >
        {SOURCES_COPY.showCurrentState}
      </button>
    </div>
  );
}

export const SourceStateBoundary = catchError(SourceStateFallback);
