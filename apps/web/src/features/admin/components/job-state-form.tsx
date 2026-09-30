'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { actionClasses } from '@/components/ui/action-link';
import { FieldMessage } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { changeJobStateAction } from '@/features/admin/admin-actions';
import { JOB_STATE_RESULT, WORKER_COPY } from '@/features/admin/admin-copy';
import type { ChangeJobStateState, JobAction } from '@/features/admin/admin-types';

// A failed job's one control (CS-41 criterion 2): retry a job out of attempts, cancel one waiting to run again. The
// form carries the state the page showed, so the section changes nothing the person has not seen, and the action it
// asks for, never a toggle. Once the section has answered, the control stays answered until the next visit: the job
// the person just retried is waiting to run again, and the button must not turn into a cancel under their finger (the
// design review of 2026-09-30). A cancel takes a second press on «بله، لغو شود», since it cannot be undone from here.

type JobStateFormProps = {
  queue: string;
  jobId: string;
  seenState: 'failed' | 'retry' | 'cancelled';
  /** The job's own line, which names the buttons: every failure has buttons with the same words. */
  describedBy: string;
};

const IDLE: ChangeJobStateState = { status: 'idle' };

type Result = { message: string; tone: 'neutral' | 'danger' | 'success' | 'warning' };

function describe(state: ChangeJobStateState): Result | undefined {
  switch (state.status) {
    case 'idle':
      return undefined;
    case 'changed':
      return { message: JOB_STATE_RESULT.changed[state.action], tone: 'success' };
    case 'unchanged':
      return { message: JOB_STATE_RESULT.unchanged[state.action], tone: 'neutral' };
    case 'stale':
      return { message: JOB_STATE_RESULT.stale, tone: 'warning' };
    case 'failed':
      return { message: JOB_STATE_RESULT.failed, tone: 'danger' };
    case 'invalid':
      return { message: JOB_STATE_RESULT.invalid, tone: 'danger' };
  }
}

function SubmitButton({
  action,
  label,
  describedBy,
  level,
  focusOnMount = false,
}: {
  action: JobAction;
  label: string;
  describedBy: string;
  level: 'secondary' | 'tertiary';
  /** Takes focus when it appears in place of the button that was pressed, so focus is never lost. */
  focusOnMount?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      ref={(node) => {
        if (focusOnMount) node?.focus();
      }}
      type="submit"
      name="action"
      value={action}
      aria-describedby={describedBy}
      aria-disabled={pending}
      data-pending={pending ? '' : undefined}
      onClick={(event) => {
        if (pending) event.preventDefault();
      }}
      className={`group gap-2 ${actionClasses(level)}`}
    >
      {label}
      <Spinner />
    </button>
  );
}

/**
 * A cancelled job stays in the list for a while, answered: the form stays mounted, so its answer is still said, and
 * offers nothing more.
 */
export function JobStateForm({ queue, jobId, seenState, describedBy }: JobStateFormProps) {
  const [state, formAction] = useActionState(changeJobStateAction, IDLE);
  // closed: the cancel button; asking: the question with its two answers; kept: the cancel button again, focused.
  const [confirm, setConfirm] = useState<'closed' | 'asking' | 'kept'>('closed');
  const result = describe(state);
  // The job did what the person asked, or already had: nothing more to press on this visit.
  const answered = state.status === 'changed' || state.status === 'unchanged' || seenState === 'cancelled';
  const action: JobAction = seenState === 'failed' ? 'retry' : 'cancel';
  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <input type="hidden" name="queue" value={queue} />
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="seenState" value={seenState} />
      {answered ? (
        state.status === 'idle' ? (
          <p className="text-secondary text-muted">{WORKER_COPY.cancelledHere}</p>
        ) : null
      ) : action === 'retry' ? (
        <SubmitButton action="retry" label={WORKER_COPY.retry} describedBy={describedBy} level="secondary" />
      ) : confirm === 'asking' ? (
        <div role="group" aria-label={WORKER_COPY.cancelQuestion} className="flex flex-col items-start gap-2">
          <p className="text-secondary">{WORKER_COPY.cancelQuestion}</p>
          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton
              action="cancel"
              label={WORKER_COPY.cancelConfirm}
              describedBy={describedBy}
              level="secondary"
              focusOnMount
            />
            <button
              type="button"
              aria-describedby={describedBy}
              onClick={() => {
                setConfirm('kept');
              }}
              className={actionClasses('tertiary')}
            >
              {WORKER_COPY.cancelKeep}
            </button>
          </div>
        </div>
      ) : (
        <button
          ref={(node) => {
            if (confirm === 'kept') node?.focus();
          }}
          type="button"
          aria-describedby={describedBy}
          onClick={() => {
            setConfirm('asking');
          }}
          className={actionClasses('secondary')}
        >
          {WORKER_COPY.cancel}
        </button>
      )}
      <FieldMessage id={`${describedBy}-result`} tone={result?.tone ?? 'neutral'} role="status">
        {result === undefined || state.status === 'idle' ? null : (
          <span
            key={state.submission}
            // The pressed button is gone once the job is answered: focus moves to the answer instead of the page.
            tabIndex={answered ? -1 : undefined}
            ref={(node) => {
              if (answered) node?.focus();
            }}
          >
            {result.message}
          </span>
        )}
      </FieldMessage>
    </form>
  );
}
