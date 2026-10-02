'use client';

import { catchError, type ErrorInfo } from 'next/error';
import { ErrorReference, useErrorReference } from '@/components/layout/error-reference';
import { actionClasses } from '@/components/ui/action-link';
import { NOTIFICATIONS_COPY } from '@/features/notifications/notifications-copy';

// The inbox when its notifications could not be read (the database did not answer): the failure stays inside the
// page, under its heading and the header, says the notifications are safe, carries a reference for the log and
// retries in place. A redirect to sign in still passes through (catchError).

function InboxFallback(_props: object, { error, retry }: ErrorInfo) {
  const code = useErrorReference(error instanceof Error ? error : new Error('the inbox failed to load'));
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-card border border-divider bg-surface p-6"
    >
      <h2 className="text-heading font-bold">{NOTIFICATIONS_COPY.error.heading}</h2>
      <p className="max-w-reading text-body text-pretty text-muted">{NOTIFICATIONS_COPY.error.body}</p>
      <ErrorReference code={code} />
      <button
        type="button"
        onClick={() => {
          retry();
        }}
        className={actionClasses('secondary')}
      >
        {NOTIFICATIONS_COPY.error.retry}
      </button>
    </div>
  );
}

export const InboxBoundary = catchError(InboxFallback);
