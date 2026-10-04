'use client';

import { catchError, type ErrorInfo } from 'next/error';
import { ErrorReference, useErrorReference } from '@/components/layout/error-reference';
import { actionClasses } from '@/components/ui/action-link';
import { STATUS_COPY } from '@/features/data-status/data-status-copy';

// When the figures cannot be read (the database did not answer), the failure stays in the figures' place: the title
// and the lead still show, with a reference for the log and a way to try again (CS-66).

function DataStatusFallback(_props: object, { error, retry }: ErrorInfo) {
  const code = useErrorReference(
    error instanceof Error ? error : new Error('the data status failed to load'),
  );
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-card bg-surface-muted p-4 sm:p-6">
      <p className="text-heading font-bold">{STATUS_COPY.errorTitle}</p>
      <ErrorReference code={code} />
      <button
        type="button"
        onClick={() => {
          retry();
        }}
        className={actionClasses('secondary')}
      >
        {STATUS_COPY.retry}
      </button>
    </div>
  );
}

export const DataStatusBoundary = catchError(DataStatusFallback);
