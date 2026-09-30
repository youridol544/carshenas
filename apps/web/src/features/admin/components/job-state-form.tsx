'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { actionClasses } from '@/components/ui/action-link';
import { FieldMessage } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { changeJobStateAction } from '@/features/admin/admin-actions';
import { JOB_STATE_RESULT, WORKER_COPY } from '@/features/admin/admin-copy';
import type { ChangeJobStateState, JobAction } from '@/features/admin/admin-types';

// A failed job's one control (CS-41 criterion 2): retry a job out of attempts, cancel one waiting to run again. The
// form carries the state the page showed, so the section changes nothing the person has not seen, and the action it
// asks for, never a toggle. As on the sources screen, the button stays the same element in every state and the line
// under it says what happened, politely.

type JobStateFormProps = {
  queue: string;
  jobId: string;
  seenState: 'failed' | 'retry';
  /** The job's own line, which names the button: every failure has a button with the same words. */
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

function ActionButton({ action, describedBy }: { action: JobAction; describedBy: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="action"
      value={action}
      aria-describedby={describedBy}
      aria-disabled={pending}
      data-pending={pending ? '' : undefined}
      onClick={(event) => {
        if (pending) event.preventDefault();
      }}
      className={`group gap-2 ${actionClasses('secondary')}`}
    >
      {action === 'retry' ? WORKER_COPY.retry : WORKER_COPY.cancel}
      <Spinner />
    </button>
  );
}

export function JobStateForm({ queue, jobId, seenState, describedBy }: JobStateFormProps) {
  const [state, formAction] = useActionState(changeJobStateAction, IDLE);
  const result = describe(state);
  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <input type="hidden" name="queue" value={queue} />
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="seenState" value={seenState} />
      <ActionButton action={seenState === 'failed' ? 'retry' : 'cancel'} describedBy={describedBy} />
      <FieldMessage id={`${describedBy}-result`} tone={result?.tone ?? 'neutral'} role="status">
        {result === undefined || state.status === 'idle' ? null : (
          <span key={state.submission}>{result.message}</span>
        )}
      </FieldMessage>
    </form>
  );
}
