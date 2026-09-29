'use client';

import { CircleAlert } from 'lucide-react';
import { Icon } from '@/components/ui/icon';
import { ACCOUNT_COPY } from '@/features/accounts/accounts-copy';

// After a failed submit, the list of what to fix, under the heading (GOV.UK error summary): it takes focus so a
// screen reader starts there, and each problem that belongs to a field links to it. The parent gives it a new key for
// every answer, so a second failed attempt focuses it again.

/** `id` names the problem (the field it belongs to, or the form's own failure), once per answer. */
export type SummaryProblem = { id: string; fieldId?: string; message: React.ReactNode };

// Stable, so it runs when the summary mounts, not on every render.
function focusWhenShown(node: HTMLDivElement | null) {
  node?.focus();
}

function focusField(event: React.MouseEvent<HTMLAnchorElement>, fieldId: string) {
  const field = document.getElementById(fieldId);
  if (field === null) return;
  event.preventDefault();
  field.focus();
  field.scrollIntoView({ block: 'center' });
}

export function ErrorSummary({ problems }: { problems: readonly SummaryProblem[] }) {
  return (
    <div
      ref={focusWhenShown}
      tabIndex={-1}
      aria-labelledby="error-summary-title"
      className="flex flex-col gap-2 rounded-card border border-danger bg-danger-subtle p-4"
    >
      <h2 id="error-summary-title" className="flex items-center gap-2 text-control font-semibold text-danger">
        <Icon icon={CircleAlert} />
        {ACCOUNT_COPY.errors.summaryHeading}
      </h2>
      <ul className="flex flex-col gap-1 text-secondary text-default">
        {problems.map((problem) => (
          <li key={problem.id}>
            {problem.fieldId === undefined ? (
              problem.message
            ) : (
              <a
                href={`#${problem.fieldId}`}
                onClick={(event) => {
                  focusField(event, problem.fieldId ?? '');
                }}
                className="text-danger underline"
              >
                {problem.message}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
