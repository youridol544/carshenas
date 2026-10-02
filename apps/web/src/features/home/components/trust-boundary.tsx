'use client';

import { catchError, type ErrorInfo } from 'next/error';
import { ErrorReference, useErrorReference } from '@/components/layout/error-reference';
import { actionClasses } from '@/components/ui/action-link';
import { HOME_COPY } from '@/features/home/home-copy';

// A failure to read the measured figures stays in their place (CS-63): the three steps above them still read, and the
// failure comes with a reference for the log and a way to try again, as on the data-status page (CS-66).
function TrustFallback(_props: object, { error, retry }: ErrorInfo) {
  const code = useErrorReference(
    error instanceof Error ? error : new Error('the home figures failed to load'),
  );
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-card bg-surface p-4">
      <p className="text-control font-semibold">{HOME_COPY.how.errorTitle}</p>
      <p className="text-secondary text-pretty text-muted">{HOME_COPY.how.errorBody}</p>
      <ErrorReference code={code} />
      <button
        type="button"
        onClick={() => {
          retry();
        }}
        className={actionClasses('secondary')}
      >
        {HOME_COPY.how.retry}
      </button>
    </div>
  );
}

export const TrustBoundary = catchError(TrustFallback);
