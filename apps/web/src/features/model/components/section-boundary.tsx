'use client';

import { catchError, type ErrorInfo } from 'next/error';
import { ErrorReference, useErrorReference } from '@/components/layout/error-reference';
import { actionClasses } from '@/components/ui/action-link';
import { MODEL_COPY } from '@/features/model/model-copy';

// A section of the model page that could not be read (the database did not answer) fails in its own place: the hero and
// the other sections stay, and the failure says what happened, gives a reference for the log and a way to try again.
// The words are the section's own (passed in), the retry's are the page's.
type FallbackProps = { title: string; body: string };

function SectionFallback({ title, body }: FallbackProps, { error, retry }: ErrorInfo) {
  const code = useErrorReference(error instanceof Error ? error : new Error('a model page section failed'));
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-card border border-divider p-4">
      <p className="text-heading font-bold">{title}</p>
      <p className="max-w-reading text-secondary text-pretty text-muted">{body}</p>
      <ErrorReference code={code} />
      <button
        type="button"
        onClick={() => {
          retry();
        }}
        className={actionClasses('secondary')}
      >
        {MODEL_COPY.retry}
      </button>
    </div>
  );
}

export const SectionBoundary = catchError(SectionFallback);
