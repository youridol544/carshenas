'use client';

import { TriangleAlert } from 'lucide-react';
import { catchError, type ErrorInfo } from 'next/error';
import { ErrorReference, useErrorReference } from '@/components/layout/error-reference';
import { actionClasses } from '@/components/ui/action-link';
import { Icon } from '@/components/ui/icon';
import { CHECK_COPY } from '@/features/check-link/check-copy';

// When the answer could not be read (the database did not answer): the failure stays in the answer's place, so the box
// and the link in the address are still there; it carries the reference code for the log (ADR-0016) and a retry.

function CheckErrorFallback(_props: object, { error, retry }: ErrorInfo) {
  const code = useErrorReference(error instanceof Error ? error : new Error('the pasted link answer failed'));
  return (
    <section
      role="alert"
      className="flex flex-col items-start gap-3 rounded-card border border-divider bg-surface-muted p-6"
    >
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-danger-subtle text-danger">
        <Icon icon={TriangleAlert} size={24} />
      </span>
      <h2 className="text-heading font-bold text-balance">{CHECK_COPY.error.title}</h2>
      <p className="text-body text-pretty text-muted">{CHECK_COPY.error.body}</p>
      <ErrorReference code={code} />
      <button
        type="button"
        onClick={() => {
          retry();
        }}
        className={actionClasses('primary')}
      >
        {CHECK_COPY.error.retry}
      </button>
    </section>
  );
}

export const CheckErrorBoundary = catchError(CheckErrorFallback);
